/*
文件功能：定义节点编辑器 outlet 节点的类型、ID 规则、工厂函数和 pinned 坐标计算函数。
File purpose: Defines the node-editor outlet node types, ID rules, factory helper, and pinned-position calculator.
*/

import { type Node, type XYPosition } from '@xyflow/react'

// --------- Node Identity ---------

// React Flow 节点类型名：用于 nodeTypes 注册，也用于 node.type 匹配。
// React Flow node type name: used for nodeTypes registration and node.type matching.
export const NODE_EDITOR_OUTLET_NODE_TYPE = 'nodeEditorOutletNode'

// --------- Node Types ---------

// 节点编辑器的 outlet 配置。id 是稳定身份，order 只表示从上到下的显示顺序。
// Node-editor outlet config. id is stable identity, while order only controls top-to-bottom display order.
export type NodeEditorOutlet = {
  id: string
  label: string
  valueKind: string
  order: number
}

// Outlet 节点 data：在 outlet 配置之外，补充 React Flow 连接 Handle 的 id。
// Outlet node data: extends the outlet config with the React Flow connection Handle id.
export type NodeEditorOutletNodeData = NodeEditorOutlet & {
  inputHandleId: string
  viewportZoom: number
}

// Outlet 的 React Flow 节点模型。
// React Flow node model for one outlet.
export type NodeEditorOutletNodeModel = Node<
  NodeEditorOutletNodeData,
  typeof NODE_EDITOR_OUTLET_NODE_TYPE
>

export type PinnedOutletNodeEditorBounds = {
  top: number
  right: number
}

export type PinnedOutletNodePositionContext = {
  editorBounds: PinnedOutletNodeEditorBounds
  screenToFlowPosition: (clientPosition: XYPosition) => XYPosition
  viewportZoom?: number
  nodeScale?: number
  nodeWidth?: number
  nodeHeight?: number
  rightPadding?: number
  topPadding?: number
  verticalGap?: number
}

// --------- Layout Defaults ---------

const DEFAULT_OUTLET_NODE_WIDTH = 72
const DEFAULT_OUTLET_NODE_HEIGHT = 32
const DEFAULT_OUTLET_NODE_RIGHT_PADDING = 16
const DEFAULT_OUTLET_NODE_TOP_PADDING = 16
const DEFAULT_OUTLET_NODE_VERTICAL_GAP = 10

// --------- ID Helpers ---------

// 根据 outlet id 生成稳定的 outlet 节点 id。
// Create a stable outlet node id from the outlet id.
export function createNodeEditorOutletNodeId(outletId: string): string {
  return `${NODE_EDITOR_OUTLET_NODE_TYPE}-${outletId}`
}

// 根据 outlet id 生成稳定的 outlet 输入 Handle id。
// Create a stable outlet input Handle id from the outlet id.
export function createNodeEditorOutletInputHandleId(outletId: string): string {
  return `${createNodeEditorOutletNodeId(outletId)}-input`
}

// --------- Position Calculation ---------

// 计算 outlet 节点内部的反向缩放值，让它在 viewport zoom 变化时保持固定视觉尺寸。
// Calculate the inverse inner scale that keeps outlet nodes visually fixed while the viewport zoom changes.
export function calculatePinnedOutletNodeVisualScale(viewportZoom: number | undefined): number {
  if (!viewportZoom || viewportZoom <= 0) return 1
  return 1 / viewportZoom
}

// 根据 order、编辑器边界、viewport zoom 和 React Flow 坐标换算函数，计算 pinned outlet 节点的 flow 坐标。
// Calculate pinned outlet-node flow coordinates from order, editor bounds, viewport zoom, and React Flow's coordinate converter.
export function calculatePinnedOutletNodePosition(
  order: number,
  context: PinnedOutletNodePositionContext,
): XYPosition {
  const viewportZoom = context.viewportZoom && context.viewportZoom > 0
    ? context.viewportZoom
    : 1
  const nodeScale = context.nodeScale ?? calculatePinnedOutletNodeVisualScale(viewportZoom)
  const nodeWidth = context.nodeWidth ?? DEFAULT_OUTLET_NODE_WIDTH
  const nodeHeight = context.nodeHeight ?? DEFAULT_OUTLET_NODE_HEIGHT
  const rightPadding = context.rightPadding ?? DEFAULT_OUTLET_NODE_RIGHT_PADDING
  const topPadding = context.topPadding ?? DEFAULT_OUTLET_NODE_TOP_PADDING
  const verticalGap = context.verticalGap ?? DEFAULT_OUTLET_NODE_VERTICAL_GAP
  const normalizedOrder = Number.isFinite(order) ? Math.max(0, Math.floor(order)) : 0
  const screenNodeWidth = nodeWidth * viewportZoom * nodeScale
  const screenNodeHeight = nodeHeight * viewportZoom * nodeScale

  const screenPosition = {
    x: context.editorBounds.right - rightPadding - screenNodeWidth,
    y: context.editorBounds.top + topPadding + normalizedOrder * (screenNodeHeight + verticalGap),
  }

  return context.screenToFlowPosition(screenPosition)
}

// --------- Node Factory ---------

// 创建不可拖动、不可选中、不可删除，但可作为连线目标的 outlet 节点。
// Create a non-draggable, non-selectable, non-deletable outlet node that can still receive connections.
export function createNodeEditorOutletNode(
  outlet: NodeEditorOutlet,
  position: XYPosition,
): NodeEditorOutletNodeModel {
  return {
    id: createNodeEditorOutletNodeId(outlet.id),
    type: NODE_EDITOR_OUTLET_NODE_TYPE,
    position,
    data: {
      ...outlet,
      inputHandleId: createNodeEditorOutletInputHandleId(outlet.id),
      viewportZoom: 1,
    },
    draggable: false,
    selectable: false,
    deletable: false,
  }
}
