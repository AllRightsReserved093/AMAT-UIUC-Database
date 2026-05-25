/*
文件功能：提供节点编辑器页面，包括右键添加节点菜单、节点连线编辑和第一版前端内存执行器。
File purpose: Provides the node editor page, including the context menu for adding nodes, graph editing, and the first in-memory frontend executor.
*/

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react'

import {
  DATABASE_FILENAMES_OUTPUT_ID,
  DATABASE_ROOT_NODE_ID,
  createDatabaseRootNode,
  createInputPortId,
  createNodeId,
  createOutputPortId,
  createTemplateNode,
  executeDatabaseRootNode,
  nodeTypes,
  type TemplateNodeData,
  type TemplateNodeOutputData,
  type TemplateNodeOutputStatus,
} from '../features/nodes'
import '@xyflow/react/dist/style.css'

// --------- Node Identity ---------

const DATABASE_ROOT_NODE_TYPE = 'databaseRootNode'
const GEOMETRY_FILTER_NODE_ID = createNodeId('geometryFilter', 0)
const PREVIEW_OUTPUT_NODE_ID = createNodeId('previewOutput', 0)
const TEMPLATE_NODE_ID = createNodeId('templateNode', 0)

// --------- Editor Types ---------

type NodeMenuState = {
  screenPosition: XYPosition
  flowPosition: XYPosition
}

type ExecutionResult = {
  status: 'ready' | 'error' | 'blocked'
  values: unknown[]
}

type TemplateOutput = TemplateNodeOutputData<string, unknown>
type TemplateData = TemplateNodeData<TemplateOutput>

// --------- Initial Graph ---------

const initialNodes: Node[] = [
  createDatabaseRootNode({ x: 60, y: 70 }),
  {
    id: GEOMETRY_FILTER_NODE_ID,
    position: { x: 300, y: 70 },
    data: { label: 'Geometry Filter' },
  },
  {
    id: PREVIEW_OUTPUT_NODE_ID,
    position: { x: 540, y: 160 },
    data: { label: 'Preview Output' },
  },
  createTemplateNode({
    id: TEMPLATE_NODE_ID,
    position: { x: 300, y: 260 },
    data: {
      title: 'Template Node',
      description: 'Configurable inputs, outputs, and output payloads.',
      inputs: [
        { id: createInputPortId(TEMPLATE_NODE_ID, 0), label: 'Geometry' },
        { id: createInputPortId(TEMPLATE_NODE_ID, 1), label: 'Settings' },
      ],
      outputs: [
        {
          id: createOutputPortId(TEMPLATE_NODE_ID, 0),
          label: 'Metadata',
          data: { kind: 'metadata', schema: 'foil-metadata-v1' },
        },
        {
          id: createOutputPortId(TEMPLATE_NODE_ID, 1),
          label: 'Preview',
          data: { kind: 'viewport-preview', format: 'svg-path' },
        },
      ],
    },
  }),
]

const initialEdges: Edge[] = [
  {
    id: 'dataset-to-filter',
    source: DATABASE_ROOT_NODE_ID,
    sourceHandle: DATABASE_FILENAMES_OUTPUT_ID,
    target: GEOMETRY_FILTER_NODE_ID,
  },
  {
    id: 'filter-to-output',
    source: GEOMETRY_FILTER_NODE_ID,
    target: PREVIEW_OUTPUT_NODE_ID,
  },
]

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
function getNextCreationOrder(nodes: Node[], nodeType: string): number {
  const existingIds = new Set(nodes.map((node) => node.id))
  let creationOrder = nodes.filter((node) => node.type === nodeType).length

  while (existingIds.has(createNodeId(nodeType, creationOrder))) {
    creationOrder += 1
  }

  return creationOrder
}

// 判断节点变化是否会影响执行结果；单纯拖动位置和选择状态不触发执行。
// Check whether node changes can affect execution; plain position and selection changes do not trigger execution.
function hasExecutableNodeChange(changes: NodeChange[]): boolean {
  return changes.some((change) => (
    change.type !== 'position'
    && change.type !== 'dimensions'
    && change.type !== 'select'
  ))
}

// 判断边变化是否会影响执行结果；选择状态不触发执行。
// Check whether edge changes can affect execution; selection changes do not trigger execution.
function hasExecutableEdgeChange(changes: EdgeChange[]): boolean {
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
async function executeNodeGraph(
  nodes: Node[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
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

// --------- Component Rendering ---------

// 节点编辑器页面组件：负责编辑图结构、显示右键菜单，并在结构变化后触发执行器。
// Node editor page component: edits graph structure, shows the context menu, and triggers the executor after structural changes.
function NodeEditorPage() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const executionIdRef = useRef(0)
  const nodesRef = useRef<Node[]>(initialNodes)
  const edgesRef = useRef<Edge[]>(initialEdges)

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [executionVersion, setExecutionVersion] = useState(0)

  nodesRef.current = nodes
  edgesRef.current = edges

  // 关闭右键菜单。
  // Close the context menu.
  const closeNodeMenu = useCallback(() => {
    setNodeMenu(null)
  }, [])

  // 标记图结构已经变化，让执行器在下一轮渲染后重新执行。
  // Mark the graph structure as changed so the executor reruns after the next render.
  const requestExecution = useCallback(() => {
    setExecutionVersion((currentVersion) => currentVersion + 1)
  }, [])

  // 处理画布右键：阻止浏览器菜单，保存菜单显示坐标和节点放置坐标。
  // Handle canvas right-click: block the browser menu and store both menu and node placement positions.
  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const editorBounds = editorRef.current?.getBoundingClientRect()
    const screenPosition = {
      x: editorBounds ? event.clientX - editorBounds.left : event.clientX,
      y: editorBounds ? event.clientY - editorBounds.top : event.clientY,
    }
    const flowPosition = flowInstance?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) ?? { x: 0, y: 0 }

    setNodeMenu({
      screenPosition,
      flowPosition,
    })
  }, [flowInstance])

  // 添加一个 Database Root 节点，并使用当前右键位置作为放置位置。
  // Add one Database Root node and use the current context-menu position as placement position.
  const addDatabaseRootNode = useCallback(() => {
    if (!nodeMenu) return

    const placementPosition = nodeMenu.flowPosition

    setNodes((currentNodes) => {
      const creationOrder = getNextCreationOrder(currentNodes, DATABASE_ROOT_NODE_TYPE)
      return [
        ...currentNodes,
        createDatabaseRootNode(placementPosition, [], creationOrder),
      ]
    })

    closeNodeMenu()
    requestExecution()
  }, [closeNodeMenu, nodeMenu, requestExecution, setNodes])

  // 包装 React Flow 的节点变化处理，只在结构变化时触发执行器。
  // Wrap React Flow node changes and trigger the executor only for structural changes.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)

    if (hasExecutableNodeChange(changes)) {
      closeNodeMenu()
      requestExecution()
    }
  }, [closeNodeMenu, onNodesChange, requestExecution])

  // 包装 React Flow 的边变化处理，只在依赖关系变化时触发执行器。
  // Wrap React Flow edge changes and trigger the executor only when dependencies change.
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)

    if (hasExecutableEdgeChange(changes)) {
      closeNodeMenu()
      requestExecution()
    }
  }, [closeNodeMenu, onEdgesChange, requestExecution])

  // 连接两个节点后写入新边，并触发执行器。
  // Write a new edge after connecting two nodes, then trigger the executor.
  const handleConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge(connection, currentEdges))
    closeNodeMenu()
    requestExecution()
  }, [closeNodeMenu, requestExecution, setEdges])

  // 监听菜单外部点击和 Escape 键，按桌面应用菜单行为关闭菜单。
  // Listen for outside clicks and Escape to close the menu with desktop-app menu behavior.
  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!nodeMenu) return
      if (menuRef.current?.contains(event.target as globalThis.Node)) return

      closeNodeMenu()
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeNodeMenu()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [closeNodeMenu, nodeMenu])

  // 图结构变化后执行整张图；过期执行会被 executionIdRef 取消写回。
  // Execute the graph after structural changes; stale executions are prevented from writing back by executionIdRef.
  useEffect(() => {
    const executionId = executionIdRef.current + 1
    executionIdRef.current = executionId

    executeNodeGraph(
      nodesRef.current,
      edgesRef.current,
      setNodes,
      () => executionIdRef.current === executionId,
    )
  }, [executionVersion, setNodes])

  return (
    <div
      className="node-editor"
      onContextMenu={handleContextMenu}
      onWheel={closeNodeMenu}
      ref={editorRef}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onConnectStart={closeNodeMenu}
        onEdgesChange={handleEdgesChange}
        onInit={setFlowInstance}
        onMoveStart={closeNodeMenu}
        onNodesChange={handleNodesChange}
        onPaneClick={closeNodeMenu}
        fitView
      >
        <Background gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {nodeMenu && (
        <div
          className="node-editor-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          ref={menuRef}
          style={{
            left: nodeMenu.screenPosition.x,
            top: nodeMenu.screenPosition.y,
          }}
        >
          <div className="node-editor-context-menu-title">Add Node</div>
          <button type="button" onClick={addDatabaseRootNode}>
            Database Root
          </button>
        </div>
      )}
    </div>
  )
}

export default NodeEditorPage
