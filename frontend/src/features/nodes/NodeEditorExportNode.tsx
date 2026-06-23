/*
文件功能：渲染节点编辑器的数据导出口节点。
File purpose: Renders the node-editor data export node.
*/

import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useEffect, type CSSProperties } from 'react'
import {
  calculatePinnedExportNodeVisualScale,
  type NodeEditorExportNodeModel,
} from './NodeEditorExportNodeModel'

// --------- Render Helpers ---------

// 创建节点布局反向缩放样式，让 export node 不随 viewport zoom 改变视觉大小。
// Create inverse layout-scale styles so the export node does not visually resize with viewport zoom.
function createExportNodeStyle(viewportZoom: number): CSSProperties {
  return {
    '--node-editor-export-node-layout-scale': String(
      calculatePinnedExportNodeVisualScale(viewportZoom),
    ),
  } as CSSProperties
}

// --------- Component Rendering ---------

// 数据导出口节点组件：左侧提供连接点，右侧显示导出口名称。
// Data export node component: exposes a left-side connection point and shows the outlet label on the right.
function NodeEditorExportNode({ data, id }: NodeProps<NodeEditorExportNodeModel>) {
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [data.viewportZoom, id, updateNodeInternals])

  return (
    <div
      aria-label={`${data.label} export outlet`}
      className="node-editor-export-node"
      data-export-order={data.order}
      data-value-kind={data.valueKind}
      style={createExportNodeStyle(data.viewportZoom)}
    >
      <Handle
        className="node-editor-export-node-handle"
        id={data.inputHandleId}
        position={Position.Left}
        type="target"
      />
      <span className="node-editor-export-node-label">{data.label}</span>
    </div>
  )
}

export default NodeEditorExportNode
