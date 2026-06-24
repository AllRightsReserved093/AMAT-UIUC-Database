/*
文件功能：把节点编辑器里的 React Flow 图结构打包成后端执行用的 JSON 数据。
File purpose: Packages the React Flow graph from the node editor into backend-execution JSON data.
*/

import { type Edge, type Node } from '@xyflow/react'
import {
  NODE_EDITOR_OUTLET_NODE_TYPE,
  type NodeEditorOutletNodeModel,
} from '../nodes/NodeEditorOutletNodeModel'
import {
  type TemplateNodeData,
  type TemplateNodePort,
} from '../nodes/TemplateNodeModel'

// --------- Package Types ---------

export const NODE_GRAPH_PACKAGE_VERSION = 1

export type PackedNodeGraphPort = {
  id: string
  label?: string
  valueKind?: string
}

export type PackedNodeGraphPortReference = {
  nodeId: string
  portId: string
}

export type PackedNodeGraphNode = {
  id: string
  type: string
  isStartNode: boolean
  params: Record<string, unknown>
  inputs: PackedNodeGraphPort[]
  outputs: PackedNodeGraphPort[]
}

export type PackedNodeGraphEdge = {
  id: string
  source: PackedNodeGraphPortReference
  target: PackedNodeGraphPortReference
}

export type PackedNodeGraphOutlet = {
  id: string
  label: string
  valueKind: string
  order: number
  inputPortId: string
  sources: PackedNodeGraphPortReference[]
}

export type PackedNodeGraph = {
  version: typeof NODE_GRAPH_PACKAGE_VERSION
  startNodeIds: string[]
  nodes: PackedNodeGraphNode[]
  edges: PackedNodeGraphEdge[]
  outlets: PackedNodeGraphOutlet[]
}

type NodeDataWithParams = Partial<TemplateNodeData> & {
  params?: Record<string, unknown>
}

type EdgeHandleId = string | null | undefined
type EdgeHandleRole = 'source' | 'target'
type NodeIdSet = Set<string>
type OutletNode = NodeEditorOutletNodeModel
type OutletSourceMap = Map<string, PackedNodeGraphPortReference[]>
type PortKind = 'inputs' | 'outputs'
type TemplateNodeDataPart = Partial<TemplateNodeData>

// --------- Type Guards ---------

// 判断节点是否是编辑器 outlet node；outlet 不参与普通计算节点列表。
// Check whether a node is an editor outlet node; outlets are not part of the normal compute-node list.
function isOutletNode(node: Node): node is OutletNode {
  return node.type === NODE_EDITOR_OUTLET_NODE_TYPE
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// --------- Port Packing ---------

function packPort(port: TemplateNodePort): PackedNodeGraphPort {
  return {
    id: port.id,
    label: port.label,
    valueKind: port.valueKind,
  }
}

function packPorts(node: Node, portKind: PortKind): PackedNodeGraphPort[] {
  const ports = (node.data as TemplateNodeDataPart | undefined)?.[portKind]
  if (!Array.isArray(ports)) return []

  return ports.map(packPort)
}

// --------- Edge Packing ---------

function createPackedEdgeId(edge: Edge, index: number): string {
  return edge.id || `edge-${index.toString().padStart(4, '0')}`
}

function requireEdgeHandleId(edge: Edge, handleId: EdgeHandleId, handleRole: EdgeHandleRole): string {
  if (handleId) return handleId

  throw new Error(`Cannot package edge without ${handleRole} handle id: ${edge.id}`)
}

function packEdge(edge: Edge, index: number): PackedNodeGraphEdge {
  return {
    id: createPackedEdgeId(edge, index),
    source: {
      nodeId: edge.source,
      portId: requireEdgeHandleId(edge, edge.sourceHandle, 'source'),
    },
    target: {
      nodeId: edge.target,
      portId: requireEdgeHandleId(edge, edge.targetHandle, 'target'),
    },
  }
}

function packComputeEdges(edges: Edge[], outletNodeIds: NodeIdSet): PackedNodeGraphEdge[] {
  return edges
    .filter((edge) => !outletNodeIds.has(edge.source) && !outletNodeIds.has(edge.target))
    .map(packEdge)
}

// --------- Node Packing ---------

function getNodeType(node: Node): string {
  if (node.type) return node.type

  throw new Error(`Cannot package node without type: ${node.id}`)
}

function getNodeParams(node: Node): Record<string, unknown> {
  const params = (node.data as NodeDataWithParams | undefined)?.params
  if (!isRecord(params)) return {}

  return { ...params }
}

// 起点节点规则：有输出、没有声明输入、也没有普通边输入。
// Start-node rule: the node has outputs, declares no inputs, and has no normal incoming edge.
function isStartNode(inputs: PackedNodeGraphPort[], outputs: PackedNodeGraphPort[], incomingNodeIds: NodeIdSet, nodeId: string): boolean {
  return outputs.length > 0
    && inputs.length === 0
    && !incomingNodeIds.has(nodeId)
}

function packNode(node: Node, incomingNodeIds: NodeIdSet): PackedNodeGraphNode {
  const inputs = packPorts(node, 'inputs')
  const outputs = packPorts(node, 'outputs')

  return {
    id: node.id,
    type: getNodeType(node),
    isStartNode: isStartNode(inputs, outputs, incomingNodeIds, node.id),
    params: getNodeParams(node),
    inputs,
    outputs,
  }
}

function packNodes(nodes: Node[], incomingNodeIds: NodeIdSet): PackedNodeGraphNode[] {
  return nodes
    .filter((node) => !isOutletNode(node))
    .map((node) => packNode(node, incomingNodeIds))
}

// --------- Outlet Packing ---------

function createOutletSourceMap(edges: Edge[], outletNodeIds: NodeIdSet): OutletSourceMap {
  const sourceMap: OutletSourceMap = new Map()

  edges
    .filter((edge) => outletNodeIds.has(edge.target))
    .forEach((edge) => {
      const source = {
        nodeId: edge.source,
        portId: requireEdgeHandleId(edge, edge.sourceHandle, 'source'),
      }

      sourceMap.set(edge.target, [
        ...(sourceMap.get(edge.target) ?? []),
        source,
      ])
    })

  return sourceMap
}

function packOutletNode(node: OutletNode, sourceMap: OutletSourceMap): PackedNodeGraphOutlet {
  return {
    id: node.data.id,
    label: node.data.label,
    valueKind: node.data.valueKind,
    order: node.data.order,
    inputPortId: node.data.inputHandleId,
    sources: sourceMap.get(node.id) ?? [],
  }
}

function packOutlets(nodes: Node[], sourceMap: OutletSourceMap): PackedNodeGraphOutlet[] {
  return nodes
    .filter(isOutletNode)
    .sort((firstNode, secondNode) => firstNode.data.order - secondNode.data.order)
    .map((node) => packOutletNode(node, sourceMap))
}

// --------- Public Package Entry ---------

// 打包节点编辑器图结构，返回后端执行接口可以直接 JSON.stringify 的对象。
// Package the node-editor graph into an object that can be JSON.stringify-ed for backend execution.
export function packNodeEditorGraph(nodes: Node[], edges: Edge[]): PackedNodeGraph {
  const outletNodeIds = new Set(
    nodes
      .filter(isOutletNode)
      .map((node) => node.id),
  )
  const computeEdges = packComputeEdges(edges, outletNodeIds)
  const outletSourceMap = createOutletSourceMap(edges, outletNodeIds)
  const incomingNodeIds = new Set(computeEdges.map((edge) => edge.target.nodeId))
  const packedNodes = packNodes(nodes, incomingNodeIds)

  return {
    version: NODE_GRAPH_PACKAGE_VERSION,
    startNodeIds: packedNodes
      .filter((node) => node.isStartNode)
      .map((node) => node.id),
    nodes: packedNodes,
    edges: computeEdges,
    outlets: packOutlets(nodes, outletSourceMap),
  }
}
