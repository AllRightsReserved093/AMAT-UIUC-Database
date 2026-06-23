/*
文件功能：提供节点图执行器，包括拓扑排序、输入构造、输出状态写回和结构变化判断。
File purpose: Provides the node graph executor, including topological sorting, input building, output state writes, and structural-change checks.
*/

import { type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react'
import {
  DATABASE_ROOT_NODE_TYPE,
  executeDatabaseRootNode,
} from './DatabaseRootNodeModel'
import {
  createNodeId,
  type TemplateNodeData,
  type TemplateNodeOutputData,
  type TemplateNodeOutputStatus,
} from './TemplateNode'

// --------- Executor Types ---------

type ExecutionResult = {
  status: 'ready' | 'error' | 'blocked'
  values: unknown[]
}

type NodeStateUpdater = (updater: (currentNodes: Node[]) => Node[]) => void
type TemplateOutput = TemplateNodeOutputData<string, unknown>
type TemplateData = TemplateNodeData<TemplateOutput>

// --------- Data Guards ---------

// 判断未知值是否是可写回模板节点的输出数据。
// Check whether an unknown value is template output data that can be written back.
function isTemplateOutputData(value: unknown): value is TemplateOutput {
  if (typeof value !== 'object' || value === null) return false

  const output = value as Partial<TemplateOutput>
  return typeof output.kind === 'string' && 'status' in output && 'value' in output
}

// 判断未知节点 data 是否包含模板节点输出端口。
// Check whether unknown node data contains template-node output ports.
function hasTemplateOutputs(data: unknown): data is TemplateData {
  if (typeof data !== 'object' || data === null) return false

  const templateData = data as Partial<TemplateData>
  return Array.isArray(templateData.outputs)
}

// --------- Graph Helpers ---------

// 根据现有同类型节点计算下一个可用创建顺序，避免删除节点后发生 id 冲突。
// Calculate the next available creation order for a node type and avoid id collisions after deletions.
export function getNextCreationOrder(nodes: Node[], nodeType: string): number {
  const existingIds = new Set(nodes.map((node) => node.id))
  let creationOrder = nodes.filter((node) => node.type === nodeType).length

  while (existingIds.has(createNodeId(nodeType, creationOrder))) {
    creationOrder += 1
  }

  return creationOrder
}

// 判断节点变化是否会影响执行结果；单纯拖动位置和选择状态不触发执行。
// Check whether node changes can affect execution; plain position and selection changes do not trigger execution.
export function hasExecutableNodeChange(changes: NodeChange[]): boolean {
  return changes.some((change) => (
    change.type !== 'position'
    && change.type !== 'dimensions'
    && change.type !== 'select'
  ))
}

// 判断边变化是否会影响执行结果；选择状态不触发执行。
// Check whether edge changes can affect execution; selection changes do not trigger execution.
export function hasExecutableEdgeChange(changes: EdgeChange[]): boolean {
  return changes.some((change) => change.type !== 'select')
}

// 按边依赖关系对节点进行拓扑排序；当前版本默认编辑器不会产生环。
// Sort nodes topologically by edge dependencies; this version assumes the editor prevents cycles.
function sortNodesTopologically(nodes: Node[], edges: Edge[]): Node[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const inDegree = new Map(nodes.map((node) => [node.id, 0]))
  const outgoingEdges = new Map<string, Edge[]>()

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return

    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
    outgoingEdges.set(edge.source, [...(outgoingEdges.get(edge.source) ?? []), edge])
  })

  const queue = nodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0)
  const sortedNodes: Node[] = []

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) continue

    sortedNodes.push(node)

    for (const edge of outgoingEdges.get(node.id) ?? []) {
      const nextDegree = (inDegree.get(edge.target) ?? 0) - 1
      inDegree.set(edge.target, nextDegree)

      if (nextDegree === 0) {
        const targetNode = nodes.find((candidate) => candidate.id === edge.target)
        if (targetNode) queue.push(targetNode)
      }
    }
  }

  const sortedIds = new Set(sortedNodes.map((node) => node.id))
  return [...sortedNodes, ...nodes.filter((node) => !sortedIds.has(node.id))]
}

// 根据端口 id 查找输出端口序号；缺少 handle 时默认使用第 0 个输出。
// Find output port index by port id; missing handles fall back to output index 0.
function getOutputIndex(node: Node | undefined, outputId: string | null | undefined): number {
  if (!node || !outputId || !hasTemplateOutputs(node.data)) return 0

  const index = node.data.outputs?.findIndex((output) => output.id === outputId) ?? -1
  return index >= 0 ? index : 0
}

// 根据端口 id 查找输入端口序号；缺少 handle 时默认使用第 0 个输入。
// Find input port index by port id; missing handles fall back to input index 0.
function getInputIndex(node: Node, inputId: string | null | undefined): number {
  if (!inputId || !hasTemplateOutputs(node.data)) return 0

  const index = node.data.inputs?.findIndex((input) => input.id === inputId) ?? -1
  return index >= 0 ? index : 0
}

// 读取节点当前输出值数组，供未知执行节点或阻塞节点保留已有数据。
// Read current node output values so unknown or blocked nodes can keep existing data.
function getCurrentOutputValues(node: Node): unknown[] {
  if (!hasTemplateOutputs(node.data)) return []

  return node.data.outputs?.map((output) => {
    if (isTemplateOutputData(output.data)) return output.data.value
    return output.data
  }) ?? []
}

// 从上游执行结果和边信息构造当前节点输入数组。
// Build the current node input array from upstream execution results and edge information.
function buildNodeInputs(
  node: Node,
  nodesById: Map<string, Node>,
  edges: Edge[],
  executionResults: Map<string, ExecutionResult>,
): { inputs: unknown[]; isBlocked: boolean } {
  const inputs: unknown[] = []
  let isBlocked = false

  edges
    .filter((edge) => edge.target === node.id)
    .forEach((edge) => {
      const sourceNode = nodesById.get(edge.source)
      const sourceResult = executionResults.get(edge.source)

      if (sourceResult?.status === 'error' || sourceResult?.status === 'blocked') {
        isBlocked = true
        return
      }

      const sourceValues = sourceResult?.values ?? (sourceNode ? getCurrentOutputValues(sourceNode) : [])
      const sourceIndex = getOutputIndex(sourceNode, edge.sourceHandle)
      const targetIndex = getInputIndex(node, edge.targetHandle)

      inputs[targetIndex] = sourceValues[sourceIndex]
    })

  return { inputs, isBlocked }
}

// --------- Output State Helpers ---------

// 根据执行状态生成通用节点描述。
// Build a generic node description from execution status.
function getExecutionDescription(status: TemplateNodeOutputStatus, error?: string): string {
  if (status === 'loading') return 'Executing node.'
  if (status === 'blocked') return 'Blocked by an upstream execution error.'
  if (status === 'error') return error ?? 'Node execution failed.'
  if (status === 'ready') return 'Node output is ready.'
  return 'Node output is not loaded yet.'
}

// 把指定节点的所有模板输出端口更新为同一个执行状态。
// Update all template output ports on a node to the same execution status.
function updateNodeOutputStatus(
  nodes: Node[],
  nodeId: string,
  status: TemplateNodeOutputStatus,
  values: unknown[] = [],
  error?: string,
): Node[] {
  return nodes.map((node) => {
    if (node.id !== nodeId || !hasTemplateOutputs(node.data)) return node

    const outputs = node.data.outputs?.map((output, index) => {
      if (!isTemplateOutputData(output.data)) return output

      const nextOutput: TemplateOutput = {
        kind: output.data.kind,
        status,
        value: values[index] ?? output.data.value,
        ...(error ? { error } : {}),
      }

      return {
        ...output,
        data: nextOutput,
      }
    })

    return {
      ...node,
      data: {
        ...node.data,
        description: getExecutionDescription(status, error),
        outputs,
      },
    }
  })
}

// 把 unknown 错误转换为可显示的错误消息。
// Convert an unknown error into a displayable error message.
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown node execution error'
}

// --------- Executor ---------

// 根据节点类型执行一个节点；第一版只写死支持 Database Root。
// Execute one node by node type; the first version only hard-codes Database Root support.
async function executeNodeByType(node: Node, inputs: unknown[]): Promise<unknown[]> {
  if (node.type === DATABASE_ROOT_NODE_TYPE) {
    return executeDatabaseRootNode(inputs)
  }

  return getCurrentOutputValues(node)
}

// 执行整张节点图，并把每个模板节点的输出状态写回 React Flow nodes。
// Execute the whole node graph and write each template node output state back into React Flow nodes.
export async function executeNodeGraph(
  nodes: Node[],
  edges: Edge[],
  setNodes: NodeStateUpdater,
  isExecutionCurrent: () => boolean,
) {
  const orderedNodes = sortNodesTopologically(nodes, edges)
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const executionResults = new Map<string, ExecutionResult>()

  for (const node of orderedNodes) {
    if (!isExecutionCurrent()) return

    const { inputs, isBlocked } = buildNodeInputs(node, nodesById, edges, executionResults)

    if (isBlocked) {
      const values = getCurrentOutputValues(node)
      executionResults.set(node.id, { status: 'blocked', values })
      setNodes((currentNodes) => updateNodeOutputStatus(currentNodes, node.id, 'blocked', values))
      continue
    }

    setNodes((currentNodes) => updateNodeOutputStatus(currentNodes, node.id, 'loading'))

    try {
      const values = await executeNodeByType(node, inputs)
      if (!isExecutionCurrent()) return

      executionResults.set(node.id, { status: 'ready', values })
      setNodes((currentNodes) => updateNodeOutputStatus(currentNodes, node.id, 'ready', values))
    } catch (error) {
      if (!isExecutionCurrent()) return

      const values = getCurrentOutputValues(node)
      const errorMessage = getErrorMessage(error)

      executionResults.set(node.id, { status: 'error', values })
      setNodes((currentNodes) => (
        updateNodeOutputStatus(currentNodes, node.id, 'error', values, errorMessage)
      ))
    }
  }
}
