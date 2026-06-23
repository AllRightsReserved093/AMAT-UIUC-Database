/*
文件功能：定义节点编辑器数据导出口节点的类型、ID 规则、工厂函数和 pinned 坐标计算函数。
File purpose: Defines the node-editor data export node types, ID rules, factory helper, and pinned-position calculator.
*/

import { type Node, type XYPosition } from '@xyflow/react'

// --------- Node Identity ---------

// React Flow 节点类型名：用于 nodeTypes 注册，也用于 node.type 匹配。
// React Flow node type name: used for nodeTypes registration and node.type matching.
export const NODE_EDITOR_EXPORT_NODE_TYPE = 'nodeEditorExportNode'

// --------- Node Types ---------

// 节点编辑器的数据导出口配置。id 是稳定身份，order 只表示从上到下的显示顺序。
// Data export outlet config. id is stable identity, while order only controls top-to-bottom display order.
export type NodeEditorExportOutlet = {
  id: string
  label: string
  valueKind: string
  order: number
}

// 导出口节点 data：在导出口配置之外，补充 React Flow 连接 Handle 的 id。
// Export node data: extends the outlet config with the React Flow connection Handle id.
export type NodeEditorExportNodeData = NodeEditorExportOutlet & {
  inputHandleId: string
  viewportZoom: number
}

// 数据导出口的 React Flow 节点模型。
// React Flow node model for one data export outlet.
export type NodeEditorExportNodeModel = Node<
  NodeEditorExportNodeData,
  typeof NODE_EDITOR_EXPORT_NODE_TYPE
>

export type PinnedExportNodeEditorBounds = {
  top: number
  right: number
}

export type PinnedExportNodePositionContext = {
  editorBounds: PinnedExportNodeEditorBounds
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

const DEFAULT_EXPORT_NODE_WIDTH = 72
const DEFAULT_EXPORT_NODE_HEIGHT = 32
const DEFAULT_EXPORT_NODE_RIGHT_PADDING = 16
const DEFAULT_EXPORT_NODE_TOP_PADDING = 16
const DEFAULT_EXPORT_NODE_VERTICAL_GAP = 10

// --------- ID Helpers ---------

// 根据 outlet id 生成稳定的导出口节点 id。
// Create a stable export node id from the outlet id.
export function createNodeEditorExportNodeId(outletId: string): string {
  return `${NODE_EDITOR_EXPORT_NODE_TYPE}-${outletId}`
}

// 根据 outlet id 生成稳定的导出口输入 Handle id。
// Create a stable export input Handle id from the outlet id.
export function createNodeEditorExportInputHandleId(outletId: string): string {
  return `${createNodeEditorExportNodeId(outletId)}-input`
}

// --------- Position Calculation ---------

// 计算导出口节点内部的反向缩放值，让它在 viewport zoom 变化时保持固定视觉尺寸。
// Calculate the inverse inner scale that keeps export nodes visually fixed while the viewport zoom changes.
export function calculatePinnedExportNodeVisualScale(viewportZoom: number | undefined): number {
  if (!viewportZoom || viewportZoom <= 0) return 1
  return 1 / viewportZoom
}

// 根据 order、编辑器边界、viewport zoom 和 React Flow 坐标换算函数，计算 pinned 导出口节点的 flow 坐标。
// Calculate pinned export-node flow coordinates from order, editor bounds, viewport zoom, and React Flow's coordinate converter.
export function calculatePinnedExportNodePosition(
  order: number,
  context: PinnedExportNodePositionContext,
): XYPosition {
  const viewportZoom = context.viewportZoom && context.viewportZoom > 0
    ? context.viewportZoom
    : 1
  const nodeScale = context.nodeScale ?? calculatePinnedExportNodeVisualScale(viewportZoom)
  const nodeWidth = context.nodeWidth ?? DEFAULT_EXPORT_NODE_WIDTH
  const nodeHeight = context.nodeHeight ?? DEFAULT_EXPORT_NODE_HEIGHT
  const rightPadding = context.rightPadding ?? DEFAULT_EXPORT_NODE_RIGHT_PADDING
  const topPadding = context.topPadding ?? DEFAULT_EXPORT_NODE_TOP_PADDING
  const verticalGap = context.verticalGap ?? DEFAULT_EXPORT_NODE_VERTICAL_GAP
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

// 创建不可拖动、不可选中、不可删除，但可作为连线目标的数据导出口节点。
// Create a non-draggable, non-selectable, non-deletable data export node that can still receive connections.
export function createNodeEditorExportNode(
  outlet: NodeEditorExportOutlet,
  position: XYPosition,
): NodeEditorExportNodeModel {
  return {
    id: createNodeEditorExportNodeId(outlet.id),
    type: NODE_EDITOR_EXPORT_NODE_TYPE,
    position,
    data: {
      ...outlet,
      inputHandleId: createNodeEditorExportInputHandleId(outlet.id),
      viewportZoom: 1,
    },
    draggable: false,
    selectable: false,
    deletable: false,
  }
}
