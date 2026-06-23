/*
文件功能：集中导出节点系统的组件、工厂函数、类型和 React Flow 节点注册表。
File purpose: Centralizes exports for node-system components, factory helpers, types, and the React Flow node registry.
*/

import DatabaseRootNode from './DatabaseRootNode'
import NodeEditorExportNode from './NodeEditorExportNode'
import TemplateNode from './TemplateNode'

export {
  createDatabaseRootNode,
  executeDatabaseRootNode,
  DATABASE_FILENAMES_OUTPUT_ID,
  DATABASE_ROOT_NODE_ID,
  type DatabaseRootNodeModel,
  type DatabaseRootOutput,
} from './DatabaseRootNode'

export {
  NODE_EDITOR_EXPORT_NODE_TYPE,
  calculatePinnedExportNodePosition,
  createNodeEditorExportInputHandleId,
  createNodeEditorExportNode,
  createNodeEditorExportNodeId,
  type NodeEditorExportNodeData,
  type NodeEditorExportNodeModel,
  type NodeEditorExportOutlet,
} from './NodeEditorExportNodeModel'

export {
  TemplateNodeDefinition,
  createTemplateNode,
  createTemplateNodeData,
  createTemplateNodeProps,
  createTemplateOutputData,
  createInputPortId,
  createNodeId,
  createOutputPortId,
  describeTemplateOutput,
  getTemplateOutputData,
  useTemplateAsyncOutput,
  type TemplateNodeData,
  type TemplateNodeDataConfig,
  type TemplateNodeInputDefinition,
  type TemplateNodeModel,
  type TemplateNodeOutputData,
  type TemplateNodeOutputDefinition,
  type TemplateNodeOutputPort,
  type TemplateNodePort,
  type TemplateNodePosition,
  type TemplateNodeRenderOutputMap,
  type TemplateNodeOutputStatus,
  type TemplateAsyncOutputOptions,
} from './TemplateNode'

export const nodeTypes = {
  databaseRootNode: DatabaseRootNode,
  nodeEditorExportNode: NodeEditorExportNode,
  templateNode: TemplateNode,
}
