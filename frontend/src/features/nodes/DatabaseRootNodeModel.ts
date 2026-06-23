/*
文件功能：定义数据库根节点的类型、声明式节点定义和节点创建函数。
File purpose: Defines the database root node types, declarative node definition, and node factory.
*/

import { type Node } from '@xyflow/react'
import { backendApi } from '../../api/backend'
import {
  defineTemplateNode,
  type TemplateNodeData,
  type TemplateNodeOutputData,
  type TemplateNodePosition,
} from './TemplateNodeModel'

// --------- Node Identity ---------

// React Flow 节点类型名：用于 nodeTypes 注册，也用于 node.type 匹配。
// React Flow node type name: used for nodeTypes registration and node.type matching.
export const DATABASE_ROOT_NODE_TYPE = 'databaseRootNode'

// 文件名输出的数据类别：表示 value 是数据库中的翼型文件名列表。
// Filename output data category: means value is the airfoil filename list from the database.
const DATABASE_FILENAMES_KIND = 'database-filenames'

// 文件名输出端口的语义名称：模板层用它查找端口定义并生成稳定端口 id。
// Semantic name for the filename output port: the template layer uses it to find the port definition and generate a stable port id.
export const FILENAMES_OUTPUT_KEY = 'filenames'

// --------- Node Types ---------

// 数据库根节点的输出类型：kind 标明输出语义，value 保存所有翼型文件名。
// Output type for the database root node: kind marks the output meaning, and value stores all airfoil filenames.
export type DatabaseRootOutput = TemplateNodeOutputData<
  typeof DATABASE_FILENAMES_KIND,
  string[]
>

// 数据库根节点的 React Flow 节点模型。
// React Flow node model for the database root node.
export type DatabaseRootNodeModel = Node<
  TemplateNodeData<DatabaseRootOutput>,
  typeof DATABASE_ROOT_NODE_TYPE
>

// --------- Node Definition ---------

// 数据库根节点定义：只声明这个节点自己的类型、标题和输出端口。
// Database root node definition: only declares this node's type, title, and output port.
export const databaseRootDefinition = defineTemplateNode<DatabaseRootOutput>({
  nodeType: DATABASE_ROOT_NODE_TYPE,
  title: 'Database Root',
  outputs: {
    [FILENAMES_OUTPUT_KEY]: {
      label: 'Filenames',
      kind: DATABASE_FILENAMES_KIND,
      initialValue: [],
      getStatus: (fileNames) => (fileNames.length > 0 ? 'ready' : 'idle'),
      describe: (output) => {
        if (output.status === 'loading') return 'Loading airfoil file names from database.'
        if (output.status === 'blocked') return 'Waiting for upstream data.'
        if (output.status === 'error') return output.error ?? 'Failed to load airfoil file names.'
        if (output.status === 'ready') return `${output.value.length} airfoil file names loaded.`
        return 'Outputs all airfoil file names from the database.'
      },
    },
  },
  execute: async () => {
    const response = await backendApi.getAirfoilFileNames()

    return {
      [FILENAMES_OUTPUT_KEY]: response.file_names,
    }
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
  fileNames: string[] = [],
  creationOrder = 0,
): DatabaseRootNodeModel {
  return databaseRootDefinition.createNodeFromValues({
    position,
    creationOrder,
    values: {
      [FILENAMES_OUTPUT_KEY]: fileNames,
    },
  }) as DatabaseRootNodeModel
}
