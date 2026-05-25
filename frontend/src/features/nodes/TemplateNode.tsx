/*
文件功能：提供 React Flow 节点的通用视觉组件、节点定义抽象类、ID 规则、输出数据模型和异步输出 hook。
File purpose: Provides the shared React Flow node renderer, node definition base class, ID rules, output data model, and async output hook.

Implementation sketch:

  Concrete definition class
          |
          v
  TemplateNodeDefinition<TOutput>
          |
          +--> createNodeId / createInputId / createOutputId
          +--> createOutput / createData / createNode
          +--> render(...) -> TemplateNode

  TemplateNode renders:
          |
          +--> title / description
          +--> input labels + left target Handles
          +--> output labels + right source Handles
*/

import { useEffect, useState } from 'react'
import { Handle, Position, type Node, type NodeProps, type XYPosition } from '@xyflow/react'

const TEMPLATE_NODE_TYPE = 'templateNode'

// --------- Types ---------

// 节点端口的基础定义：id 用于连线，label 用于界面显示。
// Base node port definition: id is used for connections, label is shown in the UI.
export type TemplateNodePort = {
  id: string
  label?: string
}

// 通用节点输出状态：给异步节点和数据源节点复用。
// Generic node output status: shared by async nodes and source nodes.
export type TemplateNodeOutputStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked'

// 通用输出数据结构：kind 是数据类别标签，value 保存真实输出值。
// Generic output payload: kind is the data category tag, value stores the actual output.
export type TemplateNodeOutputData<TKind extends string = string, TValue = unknown> = {
  kind: TKind
  status: TemplateNodeOutputStatus
  value: TValue
  error?: string
}

// 输出端口定义：除了基础端口信息，还可以携带该输出端口产生的数据。
// Output port definition: extends the base port with custom data produced by this output.
export type TemplateNodeOutputPort<TOutput = unknown> = TemplateNodePort & {
  data?: TOutput
}

// 模板节点的 data 定义：控制标题、描述、输入端口和输出端口。
// Template node data definition: controls title, description, input ports, and output ports.
export type TemplateNodeData<TOutput = unknown> = {
  title: string
  description?: string
  inputs?: TemplateNodePort[]
  outputs?: TemplateNodeOutputPort<TOutput>[]
}

// React Flow 节点模型：把 TemplateNodeData 绑定到 templateNode 类型。
// React Flow node model: binds TemplateNodeData to the templateNode type.
export type TemplateNodeModel<TOutput = unknown> = Node<
  TemplateNodeData<TOutput>,
  typeof TEMPLATE_NODE_TYPE
>

// 创建模板 data 时使用的配置类型。
// Config type used when creating template node data.
export type TemplateNodeDataConfig<TOutput = unknown> = {
  title: string
  description?: string
  inputs?: TemplateNodePort[]
  outputs?: TemplateNodeOutputPort<TOutput>[]
}

// 创建模板节点时使用的配置类型，调用方不需要关心 React Flow 的 type 字段。
// Config type used when creating template nodes; callers do not need the React Flow type field.
export type TemplateNodeConfig<TOutput = unknown> = Omit<
  TemplateNodeModel<TOutput>,
  'data' | 'type'
> & {
  data: TemplateNodeDataConfig<TOutput>
}

// 节点输出端口定义：key 是语义名，kind 是数据类别，initialValue 是默认输出值。
// Node output definition: key is semantic name, kind is data category, initialValue is default output value.
export type TemplateNodeOutputDefinition<TKind extends string, TValue> = {
  key: string
  label?: string
  kind: TKind
  initialValue: TValue
}

// 节点输入端口定义：key 是语义名，label 是显示名。
// Node input definition: key is semantic name, label is display name.
export type TemplateNodeInputDefinition = {
  key: string
  label?: string
}

export type TemplateNodeRenderOutputMap<TOutput> = Record<string, TOutput>

export type TemplateAsyncOutputOptions<TOutput, TValue> = {
  initialOutput: TOutput
  load: () => Promise<TValue>
  toReadyOutput: (value: TValue) => TOutput
  toLoadingOutput: (currentOutput: TOutput) => TOutput
  toErrorOutput: (error: unknown) => TOutput
}

// --------- ID Helpers ---------

// 将创建顺序格式化成四位无符号整数文本，例如 0 -> 0000。
// Format creation order as a four-digit unsigned integer string, for example 0 -> 0000.
function formatCreationOrder(order: number): string {
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    throw new Error(`Node and port order must be an unsigned integer from 0 to 9999: ${order}`)
  }

  return order.toString().padStart(4, '0')
}

// 根据节点类型和该类型内的创建顺序生成节点 id。
// Create a node id from node type and creation order within that node type.
export function createNodeId(nodeType: string, creationOrder: number): string {
  return `${nodeType}${formatCreationOrder(creationOrder)}`
}

// 根据节点 id 和输入端口序号生成输入端口 id。
// Create an input port id from node id and input port order.
export function createInputPortId(nodeId: string, portOrder: number): string {
  return `${nodeId}i${formatCreationOrder(portOrder)}`
}

// 根据节点 id 和输出端口序号生成输出端口 id。
// Create an output port id from node id and output port order.
export function createOutputPortId(nodeId: string, portOrder: number): string {
  return `${nodeId}o${formatCreationOrder(portOrder)}`
}

// --------- Node Data Factory ---------

// 创建通用输出数据：实际节点只需要指定 kind、value 和当前状态。
// Create generic output payload: concrete nodes only provide kind, value, and current status.
export function createTemplateOutputData<TKind extends string, TValue>(
  kind: TKind,
  value: TValue,
  status: TemplateNodeOutputStatus = 'idle',
  error?: string,
): TemplateNodeOutputData<TKind, TValue> {
  return {
    kind,
    status,
    value,
    ...(error ? { error } : {}),
  }
}

// 创建模板节点 data：统一补齐 inputs/outputs 默认值，减少实际节点重复代码。
// Create template node data: fills default inputs/outputs to reduce repeated concrete-node code.
export function createTemplateNodeData<TOutput = unknown>(
  config: TemplateNodeDataConfig<TOutput>,
): TemplateNodeData<TOutput> {
  return {
    title: config.title,
    description: config.description,
    inputs: config.inputs ?? [],
    outputs: config.outputs ?? [],
  }
}

// 从模板 data 中读取指定输出端口的数据。
// Read one output payload from template data by output port id.
export function getTemplateOutputData<TOutput>(
  data: TemplateNodeData<TOutput>,
  outputId: string,
): TOutput | undefined {
  return data.outputs?.find((output) => output.id === outputId)?.data
}

// --------- Node Factory ---------

// 创建模板节点的工厂方法：调用方只传节点配置，这里统一补上 React Flow 需要的 type。
// Factory helper for template nodes: callers pass node config, and this fills the React Flow type.
export function createTemplateNode<TOutput = unknown>(
  nodeConfig: TemplateNodeConfig<TOutput>,
): TemplateNodeModel<TOutput> {
  return {
    ...nodeConfig,
    data: createTemplateNodeData(nodeConfig.data),
    type: TEMPLATE_NODE_TYPE,
  }
}

// 把专用节点的 props 适配成 TemplateNode 可渲染的 props。
// Adapt custom node props into props renderable by TemplateNode.
export function createTemplateNodeProps<TOutput>(
  props: NodeProps<Node<TemplateNodeData<TOutput>, string>>,
  data: TemplateNodeDataConfig<TOutput>,
): NodeProps<TemplateNodeModel<TOutput>> {
  return {
    ...props,
    data: createTemplateNodeData(data),
    type: TEMPLATE_NODE_TYPE,
  }
}

// --------- Node Definition Base Class ---------

// 节点定义抽象类：集中处理 node id、port id、data、node 创建和模板渲染。
// Node definition abstract class: centralizes node ids, port ids, data, node creation, and template rendering.
export abstract class TemplateNodeDefinition<TOutput extends TemplateNodeOutputData> {
  abstract readonly nodeType: string
  abstract readonly title: string
  readonly description?: string
  readonly inputs: TemplateNodeInputDefinition[] = []
  abstract readonly outputs: TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>[]

  // 根据该节点类型内的创建顺序生成节点 id。
  // Create node id from creation order within this node type.
  createNodeId(creationOrder: number): string {
    return createNodeId(this.nodeType, creationOrder)
  }

  // 根据输入端口语义 key 和节点 id 生成输入端口 id。
  // Create input port id from input semantic key and node id.
  createInputId(key: string, nodeId: string): string {
    return createInputPortId(nodeId, this.findInputIndex(key))
  }

  // 根据输出端口语义 key 和节点 id 生成输出端口 id。
  // Create output port id from output semantic key and node id.
  createOutputId(key: string, nodeId: string): string {
    return createOutputPortId(nodeId, this.findOutputIndex(key))
  }

  // 创建某个输出端口的输出数据。
  // Create output data for one output port.
  createOutput(
    key: string,
    value?: TOutput['value'],
    status: TemplateNodeOutputStatus = 'idle',
    error?: string,
  ): TOutput {
    const outputDefinition = this.outputs[this.findOutputIndex(key)]
    return createTemplateOutputData(
      outputDefinition.kind,
      value ?? outputDefinition.initialValue,
      status,
      error,
    ) as TOutput
  }

  // 创建 React Flow 节点 data。
  // Create React Flow node data.
  createData(
    nodeId: string,
    outputs: TemplateNodeRenderOutputMap<TOutput> = {},
    description = this.description,
  ): TemplateNodeData<TOutput> {
    return createTemplateNodeData({
      title: this.title,
      description,
      inputs: this.inputs.map((input) => ({
        id: this.createInputId(input.key, nodeId),
        label: input.label,
      })),
      outputs: this.outputs.map((output) => ({
        id: this.createOutputId(output.key, nodeId),
        label: output.label,
        data: outputs[output.key] ?? this.createOutput(output.key),
      })),
    })
  }

  // 从已有节点 data 中恢复某个输出端口的数据。
  // Restore one output port data from existing node data.
  getInitialOutput(data: TemplateNodeData<TOutput>, outputKey: string, nodeId: string): TOutput {
    return getTemplateOutputData(data, this.createOutputId(outputKey, nodeId))
      ?? this.createOutput(outputKey)
  }

  // 创建 React Flow 节点实例。
  // Create a React Flow node instance.
  createNode({
    position,
    creationOrder = 0,
    outputs = {},
    description,
  }: {
    position: XYPosition
    creationOrder?: number
    outputs?: TemplateNodeRenderOutputMap<TOutput>
    description?: string
  }): Node<TemplateNodeData<TOutput>, string> {
    const nodeId = this.createNodeId(creationOrder)

    return {
      id: nodeId,
      type: this.nodeType,
      position,
      data: this.createData(nodeId, outputs, description),
    }
  }

  // 使用 TemplateNode 渲染该定义对应的节点外观。
  // Render this definition through TemplateNode.
  render(
    props: NodeProps<Node<TemplateNodeData<TOutput>, string>>,
    outputs: TemplateNodeRenderOutputMap<TOutput> = {},
    description?: string,
  ) {
    return <TemplateNode {...createTemplateNodeProps(props, this.createData(props.id, outputs, description))} />
  }

  // 查找输入定义序号，用于生成端口 id。
  // Find input definition index for port id generation.
  private findInputIndex(key: string): number {
    const index = this.inputs.findIndex((input) => input.key === key)
    if (index < 0) throw new Error(`Unknown input key for ${this.nodeType}: ${key}`)
    return index
  }

  // 查找输出定义序号，用于生成端口 id。
  // Find output definition index for port id generation.
  private findOutputIndex(key: string): number {
    const index = this.outputs.findIndex((output) => output.key === key)
    if (index < 0) throw new Error(`Unknown output key for ${this.nodeType}: ${key}`)
    return index
  }
}

// --------- Async Output Hook ---------

// 管理异步输出状态：loading、ready、error。
// Manage async output state: loading, ready, and error.
export function useTemplateAsyncOutput<TOutput, TValue>({
  initialOutput,
  load,
  toErrorOutput,
  toLoadingOutput,
  toReadyOutput,
}: TemplateAsyncOutputOptions<TOutput, TValue>): TOutput {
  const [output, setOutput] = useState<TOutput>(initialOutput)

  useEffect(() => {
    let isMounted = true

    setOutput((currentOutput) => toLoadingOutput(currentOutput))

    load()
      .then((value) => {
        if (isMounted) setOutput(toReadyOutput(value))
      })
      .catch((error) => {
        if (isMounted) setOutput(toErrorOutput(error))
      })

    return () => {
      isMounted = false
    }
  }, [load, toErrorOutput, toLoadingOutput, toReadyOutput])

  return output
}

// --------- Description Helpers ---------

// 根据通用输出状态生成基础描述文本。
// Build a basic description from generic output status.
export function describeTemplateOutput(
  output: TemplateNodeOutputData<string, unknown>,
  labels: Partial<Record<TemplateNodeOutputStatus, string>> = {},
): string {
  if (output.status === 'loading') return labels.loading ?? 'Loading output data.'
  if (output.status === 'blocked') return labels.blocked ?? 'Waiting for upstream output data.'
  if (output.status === 'error') return output.error ?? labels.error ?? 'Failed to load output data.'
  if (output.status === 'ready') return labels.ready ?? 'Output data is ready.'
  return labels.idle ?? 'Output data is not loaded yet.'
}

// --------- Layout Helpers ---------

// 根据端口序号计算 Handle 的垂直位置，让多个端口均匀分布。
// Calculate vertical Handle position from port index so multiple ports are evenly distributed.
function getPortTopOffset(index: number, total: number): string {
  if (total <= 0) return '50%'

  const percentage = ((index + 1) / (total + 1)) * 100
  return `${percentage}%`
}

// 根据选中状态生成节点根元素 className。
// Build the root node className from selected state.
function getTemplateNodeClassName(selected?: boolean): string {
  return selected ? 'template-node is-selected' : 'template-node'
}

// 端口没有 label 时回退显示 id，避免界面出现空白端口名。
// Fall back to id when label is missing so the UI never shows a blank port name.
function getPortLabel(port: TemplateNodePort): string {
  return port.label ?? port.id
}

// --------- Data Helpers ---------

// 把输出端口数据转成可放进 data-output 属性的字符串。
// Serialize output port data into a string suitable for the data-output attribute.
function serializeOutputData(data: unknown): string {
  if (data === undefined) return 'null'

  try {
    return JSON.stringify(data) ?? 'null'
  } catch {
    return '"[unserializable]"'
  }
}

// --------- Render Helpers ---------

// 渲染一列端口标签。
// Render one column of port labels.
function renderPortLabels(ports: TemplateNodePort[]) {
  return ports.map((port) => (
    <div className="template-node-port-label" key={port.id}>
      {getPortLabel(port)}
    </div>
  ))
}

// 渲染左侧输入 Handle。
// Render left-side input Handles.
function renderInputHandles(inputs: TemplateNodePort[]) {
  return inputs.map((input, index) => (
    <Handle
      className="template-node-handle"
      id={input.id}
      key={input.id}
      position={Position.Left}
      style={{ top: getPortTopOffset(index, inputs.length) }}
      type="target"
    />
  ))
}

// 渲染右侧输出 Handle，并把每个输出端口的数据挂到 data-output 上。
// Render right-side output Handles and attach each output port payload to data-output.
function renderOutputHandles<TOutput>(outputs: TemplateNodeOutputPort<TOutput>[]) {
  return outputs.map((output, index) => (
    <Handle
      className="template-node-handle"
      data-output={serializeOutputData(output.data)}
      id={output.id}
      key={output.id}
      position={Position.Right}
      style={{ top: getPortTopOffset(index, outputs.length) }}
      type="source"
    />
  ))
}

// --------- Component Rendering ---------

// 模板节点组件：只负责通用节点外观渲染。
// Template node component: only renders shared node appearance.
function TemplateNode<TOutput = unknown>({
  data,
  selected,
}: NodeProps<TemplateNodeModel<TOutput>>) {
  const inputs = data.inputs ?? []
  const outputs = data.outputs ?? []

  return (
    <div className={getTemplateNodeClassName(selected)}>
      <div className="template-node-header">{data.title}</div>
      {data.description && <div className="template-node-description">{data.description}</div>}

      <div className="template-node-ports">
        <div className="template-node-port-list">{renderPortLabels(inputs)}</div>
        <div className="template-node-port-list is-output">{renderPortLabels(outputs)}</div>
      </div>

      {renderInputHandles(inputs)}
      {renderOutputHandles(outputs)}
    </div>
  )
}

export type { XYPosition as TemplateNodePosition }
export default TemplateNode
