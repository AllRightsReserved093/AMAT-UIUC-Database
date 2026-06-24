/*
文件功能：提供节点图后端执行相关的前端 API 类型和请求函数。
File purpose: Provides frontend API types and request functions for backend node-graph execution.
*/

import { request } from './httpClient'

// --------- Graph Types ---------

// 节点图端口定义。id 只要求稳定唯一，不要求包含业务语义。
// Node-graph port definition. id only needs to be stable and unique; business meaning is not required.
export type NodeGraphPort = {
  id: string
  label?: string
  valueKind?: string
}

// 节点图端口引用：通过 nodeId 找节点，再通过 portId 找具体输入/输出口。
// Node-graph port reference: use nodeId to find the node, then portId to find the concrete input/output port.
export type NodeGraphPortReference = {
  nodeId: string
  portId: string
}

// 节点图节点定义。params 保持开放，由对应 node type 的后端执行器自行校验。
// Node-graph node definition. params stays open and is validated by the backend executor for each node type.
export type NodeGraphExecutionNode = {
  id: string
  type: string
  isStartNode?: boolean
  params: Record<string, unknown>
  inputs?: NodeGraphPort[]
  outputs?: NodeGraphPort[]
}

// 节点图连线定义。连线必须明确到输入/输出端口。
// Node-graph edge definition. Each edge must explicitly reference input/output ports.
export type NodeGraphExecutionEdge = {
  id: string
  source: NodeGraphPortReference
  target: NodeGraphPortReference
}

// 节点图出口定义。outlet 表示前端希望后端返回哪些最终数据。
// Node-graph outlet definition. An outlet declares which final data the frontend expects back from the backend.
export type NodeGraphExecutionOutlet = {
  id: string
  label?: string
  valueKind?: string
  order?: number
  inputPortId?: string
  sources: NodeGraphPortReference[]
}

// 节点图执行请求中的 graph。外层 API body 会再包一层 { graph }，方便以后加 execution options。
// Graph inside a node-graph execution request. The API body wraps it as { graph } so execution options can be added later.
export type NodeGraphExecutionGraph = {
  version: number
  startNodeIds?: string[]
  nodes: NodeGraphExecutionNode[]
  edges: NodeGraphExecutionEdge[]
  outlets: NodeGraphExecutionOutlet[]
}

export type NodeGraphExecutionRequest = {
  graph: NodeGraphExecutionGraph
}

// --------- Response Types ---------

export type NodeGraphExecutionDiagnostic = {
  level: 'info' | 'warning' | 'error'
  message: string
  nodeId?: string
  portId?: string
  outletId?: string
}

export type NodeGraphOutletResult = {
  status?: string
  valueKind?: string
  data?: unknown
  message?: string
}

export type NodeGraphExecutionResponse = {
  version: number
  status: string
  outlets: Record<string, NodeGraphOutletResult>
  diagnostics?: NodeGraphExecutionDiagnostic[]
}

// --------- API Functions ---------

export const nodeGraphApi = {
  // 把节点编辑器图发送给后端执行，并接收各 outlet 的结果。
  // Send a node-editor graph to the backend for execution and receive outlet results.
  executeNodeGraph(graph: NodeGraphExecutionGraph, signal?: AbortSignal) {
    const body: NodeGraphExecutionRequest = { graph }
    return request<NodeGraphExecutionResponse>('/node-graph/execute', {
      method: 'POST',
      body,
      signal,
    })
  },
}
