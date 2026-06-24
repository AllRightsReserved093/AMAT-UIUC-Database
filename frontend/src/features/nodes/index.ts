/*
文件功能：集中导出节点系统的组件、工厂函数、类型和 React Flow 节点注册表。
File purpose: Centralizes exports for node-system components, factory helpers, types, and the React Flow node registry.
*/

import DatabaseRootNode from './DatabaseRootNode'
import NodeEditorOutletNode from './NodeEditorOutletNode'
import TemplateNode from './TemplateNode'

export {
  DATABASE_ROOT_NODE_TYPE,
  createDatabaseRootNode,
  databaseRootDefinition,
  DATABASE_FILENAMES_OUTPUT_ID,
  DATABASE_ROOT_NODE_ID,
  type DatabaseRootNodeModel,
} from './DatabaseRootNodeModel'

export {
  NODE_EDITOR_OUTLET_NODE_TYPE,
  calculatePinnedOutletNodePosition,
  createNodeEditorOutletInputHandleId,
  createNodeEditorOutletNode,
  createNodeEditorOutletNodeId,
  type NodeEditorOutlet,
  type NodeEditorOutletNodeData,
  type NodeEditorOutletNodeModel,
} from './NodeEditorOutletNodeModel'

export {
  TEMPLATE_NODE_TYPE,
  TemplateNodeDefinition,
  defineTemplateNode,
  createTemplateNodeDefinition,
  createTemplateNode,
  createTemplateNodeData,
  createTemplateNodeProps,
  createInputPortId,
  createNodeId,
  createOutputPortId,
  type TemplateNodeData,
  type TemplateNodeDataConfig,
  type TemplateNodeDefinitionConfig,
  type TemplateNodeInputDefinition,
  type TemplateNodeInputPort,
  type TemplateNodeModel,
  type TemplateNodeOutputDefinition,
  type TemplateNodeOutputPort,
  type TemplateNodePortConfig,
  type TemplateNodePortDefinition,
  type TemplateNodePort,
  type TemplateNodePosition,
} from './TemplateNodeModel'

export const nodeTypes = {
  databaseRootNode: DatabaseRootNode,
  nodeEditorOutletNode: NodeEditorOutletNode,
  templateNode: TemplateNode,
}
