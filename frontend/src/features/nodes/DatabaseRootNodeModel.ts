/*
文件功能：定义数据库根节点的类型、端口声明和节点创建函数。
File purpose: Defines the database root node types, port declaration, and node factory.
*/

import { type Node } from '@xyflow/react'
import {
  defineTemplateNode,
  type TemplateNodeData,
  type TemplateNodePosition,
} from './TemplateNodeModel'

// --------- Node Identity ---------

// React Flow 节点类型名：用于 nodeTypes 注册，也用于 node.type 匹配。
// React Flow node type name: used for nodeTypes registration and node.type matching.
export const DATABASE_ROOT_NODE_TYPE = 'databaseRootNode'

// 文件名输出的数据类别：后端执行节点图时用它判断端口数据类型。
// Filename output value kind: backend graph execution uses it to identify the port data type.
const DATABASE_FILENAMES_VALUE_KIND = 'file-name-list'

// 文件名输出端口的语义名称：模板层用它查找端口定义并生成稳定端口 id。
// Semantic name for the filename output port: the template layer uses it to find the port definition and generate a stable port id.
export const FILENAMES_OUTPUT_KEY = 'filenames'

// --------- Node Types ---------

// 数据库根节点的 React Flow 节点模型。
// React Flow node model for the database root node.
export type DatabaseRootNodeModel = Node<
  TemplateNodeData,
  typeof DATABASE_ROOT_NODE_TYPE
>

// --------- Node Definition ---------

// 数据库根节点定义：只声明这个节点自己的类型、标题和输出端口。
// Database root node definition: only declares this node's type, title, and output port.
export const databaseRootDefinition = defineTemplateNode({
  nodeType: DATABASE_ROOT_NODE_TYPE,
  title: 'Database Root',
  description: 'Provides database airfoil file names when the graph is executed by the backend.',
  outputs: {
    [FILENAMES_OUTPUT_KEY]: {
      label: 'Filenames',
      valueKind: DATABASE_FILENAMES_VALUE_KIND,
    },
  },
})

// --------- Public IDs ---------

// 默认数据库根节点 id：databaseRootNode0000。
// Default database root node id: databaseRootNode0000.
export const DATABASE_ROOT_NODE_ID = databaseRootDefinition.createNodeId(0)

// 默认文件名输出端口 id：databaseRootNode0000o0000。
// Default filename output port id: databaseRootNode0000o0000.
export const DATABASE_FILENAMES_OUTPUT_ID = databaseRootDefinition.createOutputId(
  FILENAMES_OUTPUT_KEY,
  DATABASE_ROOT_NODE_ID,
)

// --------- Node Factory ---------

// 创建数据库根节点实例。creationOrder 是该类型节点内部的创建顺序，从 0 开始。
// Create a database root node instance. creationOrder is the per-type creation order starting from 0.
export function createDatabaseRootNode(
  position: TemplateNodePosition,
  creationOrder = 0,
): DatabaseRootNodeModel {
  return databaseRootDefinition.createNode({
    position,
    creationOrder,
  }) as DatabaseRootNodeModel
}
