/*
文件功能：定义模板节点的数据模型、ID 规则、节点工厂和节点定义模板。
File purpose: Defines template-node data models, ID rules, node factories, and node definition templates.
*/

import { type Node, type NodeProps, type XYPosition } from '@xyflow/react'

export const TEMPLATE_NODE_TYPE = 'templateNode'

// --------- Types ---------

// 节点端口的基础定义：id 用于连线，label 用于界面显示，valueKind 用于声明数据类型。
// Base node port definition: id is used for connections, label is shown in the UI, and valueKind declares the data kind.
export type TemplateNodePort = {
  id: string
  label?: string
  valueKind?: string
}

export type TemplateNodeInputPort = TemplateNodePort
export type TemplateNodeOutputPort = TemplateNodePort

// 模板节点的 data 定义：控制标题、描述、输入端口和输出端口。
// Template node data definition: controls title, description, input ports, and output ports.
export type TemplateNodeData = {
  title: string
  description?: string
  inputs?: TemplateNodeInputPort[]
  outputs?: TemplateNodeOutputPort[]
}

// React Flow 节点模型：把 TemplateNodeData 绑定到 templateNode 类型。
// React Flow node model: binds TemplateNodeData to the templateNode type.
export type TemplateNodeModel = Node<TemplateNodeData, typeof TEMPLATE_NODE_TYPE>

// 创建模板 data 时使用的配置类型。
// Config type used when creating template node data.
export type TemplateNodeDataConfig = TemplateNodeData

// 创建模板节点时使用的配置类型，调用方不需要关心 React Flow 的 type 字段。
// Config type used when creating template nodes; callers do not need the React Flow type field.
export type TemplateNodeConfig = Omit<TemplateNodeModel, 'data' | 'type'> & {
  data: TemplateNodeDataConfig
}

// 节点端口定义：key 是语义名，label 是显示名，valueKind 是后端执行时的数据类型声明。
// Node port definition: key is semantic name, label is display name, and valueKind declares backend execution data kind.
export type TemplateNodePortDefinition = {
  key: string
  label?: string
  valueKind?: string
}

export type TemplateNodeInputDefinition = TemplateNodePortDefinition
export type TemplateNodeOutputDefinition = TemplateNodePortDefinition
export type TemplateNodePortConfig = Omit<TemplateNodePortDefinition, 'key'>

// 创建节点定义时使用的声明式配置。
// Declarative config used to create a node definition.
export type TemplateNodeDefinitionConfig = {
  nodeType: string
  title: string
  description?: string
  inputs?: TemplateNodeInputDefinition[] | Record<string, TemplateNodePortConfig>
  outputs:
    | TemplateNodeOutputDefinition[]
    | Record<string, TemplateNodePortConfig>
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

// 创建模板节点 data：统一补齐 inputs/outputs 默认值，减少实际节点重复代码。
// Create template node data: fills default inputs/outputs to reduce repeated concrete-node code.
export function createTemplateNodeData(config: TemplateNodeDataConfig): TemplateNodeData {
  return {
    title: config.title,
    description: config.description,
    inputs: config.inputs ?? [],
    outputs: config.outputs ?? [],
  }
}

// --------- Node Factory ---------

// 创建模板节点的工厂方法：调用方只传节点配置，这里统一补上 React Flow 需要的 type。
// Factory helper for template nodes: callers pass node config, and this fills the React Flow type.
export function createTemplateNode(nodeConfig: TemplateNodeConfig): TemplateNodeModel {
  return {
    ...nodeConfig,
    data: createTemplateNodeData(nodeConfig.data),
    type: TEMPLATE_NODE_TYPE,
  }
}

// 把专用节点的 props 适配成 TemplateNode 可渲染的 props。
// Adapt custom node props into props renderable by TemplateNode.
export function createTemplateNodeProps(
  props: NodeProps<Node<TemplateNodeData, string>>,
  data: TemplateNodeDataConfig,
): NodeProps<TemplateNodeModel> {
  return {
    ...props,
    data: createTemplateNodeData(data),
    type: TEMPLATE_NODE_TYPE,
  }
}

// --------- Definition Config Helpers ---------

// 把数组或对象形式的端口定义统一转换成数组定义。
// Normalize array or object-form port definitions into array definitions.
function normalizePortDefinitions(
  ports: TemplateNodeDefinitionConfig['inputs'] | TemplateNodeDefinitionConfig['outputs'],
): TemplateNodePortDefinition[] {
  if (!ports) return []
  if (Array.isArray(ports)) return ports

  return Object.entries(ports).map(([key, port]) => ({
    key,
    ...port,
  }))
}

// --------- Node Definition Template ---------

// 节点定义模板：集中处理 node id、port id、data 和 node 创建。
// Node definition template: centralizes node ids, port ids, data, and node creation.
export abstract class TemplateNodeDefinition {
  abstract readonly nodeType: string
  abstract readonly title: string
  readonly description?: string
  readonly inputs: TemplateNodeInputDefinition[] = []
  readonly outputs: TemplateNodeOutputDefinition[] = []

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

  // 创建 React Flow 节点 data。
  // Create React Flow node data.
  createData(nodeId: string, description = this.description): TemplateNodeData {
    return createTemplateNodeData({
      title: this.title,
      description,
      inputs: this.inputs.map((input) => ({
        id: this.createInputId(input.key, nodeId),
        label: input.label,
        valueKind: input.valueKind,
      })),
      outputs: this.outputs.map((output) => ({
        id: this.createOutputId(output.key, nodeId),
        label: output.label,
        valueKind: output.valueKind,
      })),
    })
  }

  // 创建 React Flow 节点实例。
  // Create a React Flow node instance.
  createNode({
    position,
    creationOrder = 0,
    description,
  }: {
    position: XYPosition
    creationOrder?: number
    description?: string
  }): Node<TemplateNodeData, string> {
    const nodeId = this.createNodeId(creationOrder)

    return {
      id: nodeId,
      type: this.nodeType,
      position,
      data: this.createData(nodeId, description),
    }
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

class ConfiguredTemplateNodeDefinition extends TemplateNodeDefinition {
  readonly nodeType: string
  readonly title: string
  readonly description?: string
  readonly inputs: TemplateNodeInputDefinition[]
  readonly outputs: TemplateNodeOutputDefinition[]

  constructor(config: TemplateNodeDefinitionConfig) {
    super()

    this.nodeType = config.nodeType
    this.title = config.title
    this.description = config.description
    this.inputs = normalizePortDefinitions(config.inputs)
    this.outputs = normalizePortDefinitions(config.outputs)
  }
}

// 用声明式配置定义节点，具体节点不需要再继承类。
// Define a node from declarative config, so concrete nodes do not need class inheritance.
export function defineTemplateNode(config: TemplateNodeDefinitionConfig): TemplateNodeDefinition {
  return new ConfiguredTemplateNodeDefinition(config)
}

// 兼容旧命名；新节点优先使用 defineTemplateNode。
// Compatibility alias; new nodes should prefer defineTemplateNode.
export const createTemplateNodeDefinition = defineTemplateNode

export type { XYPosition as TemplateNodePosition }
