/*
文件功能：定义模板节点的数据模型、ID 规则、节点工厂和节点定义模板。
File purpose: Defines template-node data models, ID rules, node factories, and node definition templates.
*/

import { type Node, type NodeProps, type XYPosition } from '@xyflow/react'

export const TEMPLATE_NODE_TYPE = 'templateNode'

// --------- Types ---------

// 节点端口的基础定义：id 用于连线，label 用于界面显示。
// Base node port definition: id is used for connections, label is shown in the UI.
export type TemplateNodePort = {
  id: string
  label?: string
}

// 通用节点输出状态：给异步节点和数据源节点复用。
// Generic node output status: shared by async nodes and source nodes.
export type TemplateNodeOutputStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'blocked'

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
  getStatus?: (value: TValue) => TemplateNodeOutputStatus
  describe?: (output: TemplateNodeOutputData<TKind, TValue>) => string
}

// 声明节点输出端口时使用的配置；key 由外层对象名提供。
// Config used to declare node output ports; key is provided by the outer object name.
export type TemplateNodeOutputConfig<TKind extends string, TValue> = Omit<
  TemplateNodeOutputDefinition<TKind, TValue>,
  'key'
>

// 节点输入端口定义：key 是语义名，label 是显示名。
// Node input definition: key is semantic name, label is display name.
export type TemplateNodeInputDefinition = {
  key: string
  label?: string
}

export type TemplateNodeRenderOutputMap<TOutput> = Record<string, TOutput>
export type TemplateNodeExecutionValueMap = Record<string, unknown>
export type TemplateNodeExecutionResult = TemplateNodeExecutionValueMap | unknown[]
export type TemplateNodeExecutor = (
  inputs: unknown[],
) => Promise<TemplateNodeExecutionResult> | TemplateNodeExecutionResult
export type TemplateNodeDescriptionBuilder<TOutput extends TemplateNodeOutputData> = (
  outputs: TemplateNodeRenderOutputMap<TOutput>,
) => string

// 创建节点定义时使用的声明式配置。
// Declarative config used to create a node definition.
export type TemplateNodeDefinitionConfig<TOutput extends TemplateNodeOutputData> = {
  nodeType: string
  title: string
  description?: string
  inputs?: TemplateNodeInputDefinition[]
  outputs:
    | TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>[]
    | Record<string, TemplateNodeOutputConfig<TOutput['kind'], TOutput['value']>>
  execute?: TemplateNodeExecutor
  describe?: TemplateNodeDescriptionBuilder<TOutput>
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

// --------- Definition Config Helpers ---------

// 把数组或对象形式的 outputs 统一转换成数组定义。
// Normalize array or object-form outputs into array definitions.
function normalizeOutputDefinitions<TOutput extends TemplateNodeOutputData>(
  outputs: TemplateNodeDefinitionConfig<TOutput>['outputs'],
): TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>[] {
  if (Array.isArray(outputs)) return outputs

  return Object.entries(outputs).map(([key, output]) => ({
    key,
    ...output,
  }))
}

// --------- Node Definition Template ---------

// 节点定义模板：集中处理 node id、port id、data 和 node 创建。
// Node definition template: centralizes node ids, port ids, data, and node creation.
export abstract class TemplateNodeDefinition<TOutput extends TemplateNodeOutputData> {
  abstract readonly nodeType: string
  abstract readonly title: string
  readonly description?: string
  readonly inputs: TemplateNodeInputDefinition[] = []
  abstract readonly outputs: TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>[]
  readonly execute?: TemplateNodeExecutor
  readonly describe?: TemplateNodeDescriptionBuilder<TOutput>

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
    status?: TemplateNodeOutputStatus,
    error?: string,
  ): TOutput {
    const outputDefinition = this.outputs[this.findOutputIndex(key)]
    const outputValue = value ?? outputDefinition.initialValue
    const outputStatus = this.getOutputStatus(outputDefinition, outputValue, status, error)

    return createTemplateOutputData(
      outputDefinition.kind,
      outputValue,
      outputStatus,
      error,
    ) as TOutput
  }

  // 根据输出值生成整组输出数据。
  // Create all output payloads from raw output values.
  createOutputMapFromValues(
    values: TemplateNodeExecutionValueMap = {},
    status?: TemplateNodeOutputStatus,
    error?: string,
  ): TemplateNodeRenderOutputMap<TOutput> {
    return Object.fromEntries(this.outputs.map((output) => [
      output.key,
      this.createOutput(output.key, values[output.key] as TOutput['value'] | undefined, status, error),
    ])) as TemplateNodeRenderOutputMap<TOutput>
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

  // 使用原始输出值创建 React Flow 节点实例。
  // Create a React Flow node instance from raw output values.
  createNodeFromValues({
    position,
    creationOrder = 0,
    values = {},
    status,
    error,
    description,
  }: {
    position: XYPosition
    creationOrder?: number
    values?: TemplateNodeExecutionValueMap
    status?: TemplateNodeOutputStatus
    error?: string
    description?: string
  }): Node<TemplateNodeData<TOutput>, string> {
    const outputs = this.createOutputMapFromValues(values, status, error)

    return this.createNode({
      position,
      creationOrder,
      outputs,
      description: description ?? this.describeOutputs(outputs),
    })
  }

  // 把执行函数返回的对象或数组统一转换成按端口顺序排列的数组。
  // Normalize object or array execution result into an array ordered by output ports.
  getExecutionValues(result: TemplateNodeExecutionResult): unknown[] {
    if (Array.isArray(result)) return result

    return this.outputs.map((output) => result[output.key])
  }

  // 把按端口顺序排列的数组转换回按输出 key 索引的对象。
  // Convert output-order values back into an object indexed by output key.
  createValueMapFromExecutionValues(values: unknown[]): TemplateNodeExecutionValueMap {
    return Object.fromEntries(this.outputs.map((output, index) => [
      output.key,
      values[index],
    ]))
  }

  // 根据输出数据生成节点描述。
  // Build the node description from output payloads.
  describeOutputs(outputs: TemplateNodeRenderOutputMap<TOutput>): string {
    if (this.describe) return this.describe(outputs)

    for (const outputDefinition of this.outputs) {
      const output = outputs[outputDefinition.key]
      if (!output) continue
      if (outputDefinition.describe) return outputDefinition.describe(output)
      return describeTemplateOutput(output)
    }

    return this.description ?? 'Node output is not loaded yet.'
  }

  private getOutputStatus(
    outputDefinition: TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>,
    value: TOutput['value'],
    status?: TemplateNodeOutputStatus,
    error?: string,
  ): TemplateNodeOutputStatus {
    if (error) return 'error'
    if (status) return status
    return outputDefinition.getStatus?.(value) ?? 'idle'
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

class ConfiguredTemplateNodeDefinition<TOutput extends TemplateNodeOutputData>
  extends TemplateNodeDefinition<TOutput> {
  readonly nodeType: string
  readonly title: string
  readonly description?: string
  readonly inputs: TemplateNodeInputDefinition[]
  readonly outputs: TemplateNodeOutputDefinition<TOutput['kind'], TOutput['value']>[]
  readonly execute?: TemplateNodeExecutor
  readonly describe?: TemplateNodeDescriptionBuilder<TOutput>

  constructor(config: TemplateNodeDefinitionConfig<TOutput>) {
    super()

    this.nodeType = config.nodeType
    this.title = config.title
    this.description = config.description
    this.inputs = config.inputs ?? []
    this.outputs = normalizeOutputDefinitions(config.outputs)
    this.execute = config.execute
    this.describe = config.describe
  }
}

// 用声明式配置定义节点，具体节点不需要再继承类。
// Define a node from declarative config, so concrete nodes do not need class inheritance.
export function defineTemplateNode<TOutput extends TemplateNodeOutputData>(
  config: TemplateNodeDefinitionConfig<TOutput>,
): TemplateNodeDefinition<TOutput> {
  return new ConfiguredTemplateNodeDefinition(config)
}

// 兼容旧命名；新节点优先使用 defineTemplateNode。
// Compatibility alias; new nodes should prefer defineTemplateNode.
export const createTemplateNodeDefinition = defineTemplateNode

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

export type { XYPosition as TemplateNodePosition }
