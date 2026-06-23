/*
文件功能：渲染节点编辑器的数据导出口节点。
File purpose: Renders the node-editor data export node.
*/

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { type NodeEditorExportNodeModel } from './NodeEditorExportNodeModel'

// --------- Component Rendering ---------

// 数据导出口节点组件：左侧提供连接点，右侧显示导出口名称。
// Data export node component: exposes a left-side connection point and shows the outlet label on the right.
function NodeEditorExportNode({ data }: NodeProps<NodeEditorExportNodeModel>) {
  return (
    <div
      aria-label={`${data.label} export outlet`}
      className="node-editor-export-node"
      data-export-order={data.order}
      data-value-kind={data.valueKind}
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
