/*
文件功能：同步 pinned export node 的位置和 viewport 缩放数据。
File purpose: Synchronizes pinned export node positions and viewport zoom data.
*/

import { type Node, type ReactFlowInstance, type XYPosition } from '@xyflow/react'
import {
  NODE_EDITOR_EXPORT_NODE_TYPE,
  calculatePinnedExportNodePosition,
  type NodeEditorExportNodeData,
} from './NodeEditorExportNodeModel'

// --------- Type Guards ---------

// 判断节点是否是 pinned export node，后续只对这类节点做位置同步。
// Check whether a node is a pinned export node so only these nodes are repositioned.
function isNodeEditorExportNode(
  node: Node,
): node is Node<NodeEditorExportNodeData, typeof NODE_EDITOR_EXPORT_NODE_TYPE> {
  return node.type === NODE_EDITOR_EXPORT_NODE_TYPE
    && typeof (node.data as Partial<NodeEditorExportNodeData>).order === 'number'
}

// --------- Layout Helpers ---------

// 避免相同坐标重复创建新 node 对象，减少无意义的 React Flow 更新。
// Avoid creating new node objects for identical coordinates to reduce unnecessary React Flow updates.
function hasSamePosition(firstPosition: XYPosition, secondPosition: XYPosition): boolean {
  return firstPosition.x === secondPosition.x && firstPosition.y === secondPosition.y
}

// 根据当前编辑器尺寸和 viewport，把所有 export node 贴回节点编辑器右上侧。
// Pin all export nodes back to the upper-right side of the node editor from the current editor size and viewport.
export function updatePinnedExportNodePositions(
  nodes: Node[],
  flowInstance: ReactFlowInstance,
  editorElement: HTMLElement,
): Node[] {
  const editorBounds = editorElement.getBoundingClientRect()
  const viewportZoom = flowInstance.getZoom()
  let hasPositionChanges = false

  const nextNodes = nodes.map((node) => {
    if (!isNodeEditorExportNode(node)) return node

    const nextPosition = calculatePinnedExportNodePosition(node.data.order, {
      editorBounds: {
        top: editorBounds.top,
        right: editorBounds.right,
      },
      screenToFlowPosition: (clientPosition) => (
        flowInstance.screenToFlowPosition(clientPosition)
      ),
      viewportZoom,
    })
    const hasZoomChange = node.data.viewportZoom !== viewportZoom

    if (hasSamePosition(node.position, nextPosition) && !hasZoomChange) return node

    hasPositionChanges = true
    return {
      ...node,
      data: {
        ...node.data,
        viewportZoom,
      },
      position: nextPosition,
    }
  })

  return hasPositionChanges ? nextNodes : nodes
}
