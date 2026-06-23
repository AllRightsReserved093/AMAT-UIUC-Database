/*
文件功能：集中导出节点系统的组件、工厂函数、类型和 React Flow 节点注册表。
File purpose: Centralizes exports for node-system components, factory helpers, types, and the React Flow node registry.
*/

import DatabaseRootNode from './DatabaseRootNode'
import {
  DATABASE_ROOT_NODE_TYPE,
  databaseRootDefinition,
} from './DatabaseRootNodeModel'
import NodeEditorExportNode from './NodeEditorExportNode'
import TemplateNode from './TemplateNode'
import {
  type TemplateNodeDefinition,
  type TemplateNodeOutputData,
} from './TemplateNodeModel'

export {
  DATABASE_ROOT_NODE_TYPE,
  createDatabaseRootNode,
  databaseRootDefinition,
  DATABASE_FILENAMES_OUTPUT_ID,
  DATABASE_ROOT_NODE_ID,
  type DatabaseRootNodeModel,
  type DatabaseRootOutput,
} from './DatabaseRootNodeModel'

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
  TEMPLATE_NODE_TYPE,
  TemplateNodeDefinition,
  defineTemplateNode,
  createTemplateNodeDefinition,
  createTemplateNode,
  createTemplateNodeData,
  createTemplateNodeProps,
  createTemplateOutputData,
  createInputPortId,
  createNodeId,
  createOutputPortId,
  describeTemplateOutput,
  getTemplateOutputData,
  type TemplateNodeData,
  type TemplateNodeDataConfig,
  type TemplateNodeDefinitionConfig,
  type TemplateNodeInputDefinition,
  type TemplateNodeModel,
  type TemplateNodeOutputData,
  type TemplateNodeOutputDefinition,
  type TemplateNodeOutputPort,
  type TemplateNodePort,
  type TemplateNodePosition,
  type TemplateNodeRenderOutputMap,
  type TemplateNodeOutputStatus,
} from './TemplateNodeModel'

export const nodeDefinitions: Record<string, TemplateNodeDefinition<TemplateNodeOutputData>> = {
  [DATABASE_ROOT_NODE_TYPE]: databaseRootDefinition as TemplateNodeDefinition<TemplateNodeOutputData>,
}

export function getNodeDefinition(
  nodeType: string | undefined,
): TemplateNodeDefinition<TemplateNodeOutputData> | undefined {
  if (!nodeType) return undefined
  return nodeDefinitions[nodeType]
}

export const nodeTypes = {
  databaseRootNode: DatabaseRootNode,
  nodeEditorExportNode: NodeEditorExportNode,
  templateNode: TemplateNode,
}
