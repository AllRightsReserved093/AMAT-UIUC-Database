/*
文件功能：提供节点图结构辅助函数，包括节点创建顺序和结构变化判断。
File purpose: Provides node graph structure helpers, including node creation order and structural-change checks.
*/

import { type EdgeChange, type Node, type NodeChange } from '@xyflow/react'
import { createNodeId } from '../nodes/TemplateNodeModel'

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

// 判断节点变化是否改变图结构；单纯拖动位置、尺寸和选择状态不算结构变化。
// Check whether node changes alter graph structure; plain position, dimension, and selection changes are not structural.
export function hasStructuralNodeChange(changes: NodeChange[]): boolean {
  return changes.some((change) => (
    change.type !== 'position'
    && change.type !== 'dimensions'
    && change.type !== 'select'
  ))
}

// 判断边变化是否改变图结构；选择状态不算结构变化。
// Check whether edge changes alter graph structure; selection changes are not structural.
export function hasStructuralEdgeChange(changes: EdgeChange[]): boolean {
  return changes.some((change) => change.type !== 'select')
}
