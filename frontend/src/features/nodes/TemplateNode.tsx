/*
文件功能：渲染模板节点的通用 React Flow 外观。
File purpose: Renders the shared React Flow appearance for template nodes.
*/

import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  type TemplateNodeModel,
  type TemplateNodeOutputPort,
  type TemplateNodePort,
} from './TemplateNodeModel'

// --------- Layout Helpers ---------

// 根据端口序号计算 Handle 的垂直位置，让多个端口均匀分布。
// Calculate vertical Handle position from port index so multiple ports are evenly distributed.
function getPortTopOffset(index: number, total: number): string {
  if (total <= 0) return '50%'

  const percentage = ((index + 1) / (total + 1)) * 100
  return `${percentage}%`
}

// 根据选中状态生成节点根元素 className。
// Build the root node className from selected state.
function getTemplateNodeClassName(selected?: boolean): string {
  return selected ? 'template-node is-selected' : 'template-node'
}

// 端口没有 label 时回退显示 id，避免界面出现空白端口名。
// Fall back to id when label is missing so the UI never shows a blank port name.
function getPortLabel(port: TemplateNodePort): string {
  return port.label ?? port.id
}

// --------- Render Helpers ---------

// 渲染一列端口标签。
// Render one column of port labels.
function renderPortLabels(ports: TemplateNodePort[]) {
  return ports.map((port) => (
    <div className="template-node-port-label" key={port.id}>
      {getPortLabel(port)}
    </div>
  ))
}

// 渲染左侧输入 Handle。
// Render left-side input Handles.
function renderInputHandles(inputs: TemplateNodePort[]) {
  return inputs.map((input, index) => (
    <Handle
      className="template-node-handle"
      id={input.id}
      key={input.id}
      position={Position.Left}
      style={{ top: getPortTopOffset(index, inputs.length) }}
      type="target"
    />
  ))
}

// 渲染右侧输出 Handle。
// Render right-side output Handles.
function renderOutputHandles(outputs: TemplateNodeOutputPort[]) {
  return outputs.map((output, index) => (
    <Handle
      className="template-node-handle"
      id={output.id}
      key={output.id}
      position={Position.Right}
      style={{ top: getPortTopOffset(index, outputs.length) }}
      type="source"
    />
  ))
}

// --------- Component Rendering ---------

// 模板节点组件：只负责通用节点外观渲染。
// Template node component: only renders shared node appearance.
function TemplateNode({
  data,
  selected,
}: NodeProps<TemplateNodeModel>) {
  const inputs = data.inputs ?? []
  const outputs = data.outputs ?? []

  return (
    <div className={getTemplateNodeClassName(selected)}>
      <div className="template-node-header">{data.title}</div>
      {data.description && <div className="template-node-description">{data.description}</div>}

      <div className="template-node-ports">
        <div className="template-node-port-list">{renderPortLabels(inputs)}</div>
        <div className="template-node-port-list is-output">{renderPortLabels(outputs)}</div>
      </div>

      {renderInputHandles(inputs)}
      {renderOutputHandles(outputs)}
    </div>
  )
}

export default TemplateNode
