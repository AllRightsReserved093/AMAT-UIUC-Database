/*
文件功能：渲染节点编辑器的 outlet 节点。
File purpose: Renders the node-editor outlet node.
*/

import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useEffect, type CSSProperties } from 'react'
import {
  calculatePinnedOutletNodeVisualScale,
  type NodeEditorOutletNodeModel,
} from './NodeEditorOutletNodeModel'

// --------- Render Helpers ---------

// 创建节点布局反向缩放样式，让 outlet node 不随 viewport zoom 改变视觉大小。
// Create inverse layout-scale styles so the outlet node does not visually resize with viewport zoom.
function createOutletNodeStyle(viewportZoom: number): CSSProperties {
  return {
    '--node-editor-outlet-node-layout-scale': String(
      calculatePinnedOutletNodeVisualScale(viewportZoom),
    ),
  } as CSSProperties
}

// --------- Component Rendering ---------

// Outlet 节点组件：左侧提供连接点，右侧显示 outlet 名称。
// Outlet node component: exposes a left-side connection point and shows the outlet label on the right.
function NodeEditorOutletNode({ data, id }: NodeProps<NodeEditorOutletNodeModel>) {
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [data.viewportZoom, id, updateNodeInternals])

  return (
    <div
      aria-label={`${data.label} outlet`}
      className="node-editor-outlet-node"
      data-outlet-order={data.order}
      data-value-kind={data.valueKind}
      style={createOutletNodeStyle(data.viewportZoom)}
    >
      <Handle
        className="node-editor-outlet-node-handle"
        id={data.inputHandleId}
        position={Position.Left}
        type="target"
      />
      <span className="node-editor-outlet-node-label">{data.label}</span>
    </div>
  )
}

export default NodeEditorOutletNode
