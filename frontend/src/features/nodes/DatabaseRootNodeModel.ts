/*
文件功能：定义数据库根节点的类型、节点创建函数和执行函数。
File purpose: Defines the database root node types, node factory, and execution function.
*/

import { type Node } from '@xyflow/react'
import { backendApi } from '../../api/backend'
import {
  TemplateNodeDefinition,
  type TemplateNodeData,
  type TemplateNodeOutputData,
  type TemplateNodeOutputDefinition,
  type TemplateNodePosition,
} from './TemplateNode'

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

// 数据库根节点定义类：只声明这个节点自己的类型、标题和输出端口。
// Database root node definition class: only declares this node's type, title, and output port.
class DatabaseRootNodeDefinition extends TemplateNodeDefinition<DatabaseRootOutput> {
  readonly nodeType = DATABASE_ROOT_NODE_TYPE
  readonly title = 'Database Root'
  readonly outputs: TemplateNodeOutputDefinition<typeof DATABASE_FILENAMES_KIND, string[]>[] = [
    {
      key: FILENAMES_OUTPUT_KEY,
      label: 'Filenames',
      kind: DATABASE_FILENAMES_KIND,
      initialValue: [],
    },
  ]
}

// 数据库根节点定义实例：复用模板层提供的 id、data、node 和 render 方法。
// Database root node definition instance: reuses template-layer id, data, node, and render methods.
export const databaseRootDefinition = new DatabaseRootNodeDefinition()

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

// --------- Output Helpers ---------

// 创建文件名列表输出。出错时状态为 error；有文件名时为 ready；空列表初始状态为 idle。
// Create filename-list output. Error becomes error; non-empty filenames become ready; an empty initial list stays idle.
function createFilenameOutput(fileNames: string[] = [], error?: string): DatabaseRootOutput {
  if (error) {
    return databaseRootDefinition.createOutput(FILENAMES_OUTPUT_KEY, fileNames, 'error', error)
  }

  return databaseRootDefinition.createOutput(
    FILENAMES_OUTPUT_KEY,
    fileNames,
    fileNames.length > 0 ? 'ready' : 'idle',
  )
}

// 根据当前输出状态生成节点描述文字。
// Build node description text from the current output status.
export function describeFilenameOutput(output: DatabaseRootOutput): string {
  if (output.status === 'loading') return 'Loading airfoil file names from database.'
  if (output.status === 'blocked') return 'Waiting for upstream data.'
  if (output.status === 'error') return output.error ?? 'Failed to load airfoil file names.'
  if (output.status === 'ready') return `${output.value.length} airfoil file names loaded.`
  return 'Outputs all airfoil file names from the database.'
}

// --------- Node Factory ---------

// 创建数据库根节点实例。creationOrder 是该类型节点内部的创建顺序，从 0 开始。
// Create a database root node instance. creationOrder is the per-type creation order starting from 0.
export function createDatabaseRootNode(
  position: TemplateNodePosition,
  fileNames: string[] = [],
  creationOrder = 0,
): DatabaseRootNodeModel {
  const output = createFilenameOutput(fileNames)

  return databaseRootDefinition.createNode({
    position,
    creationOrder,
    outputs: {
      [FILENAMES_OUTPUT_KEY]: output,
    },
    description: describeFilenameOutput(output),
  }) as DatabaseRootNodeModel
}

// --------- Node Execution ---------

// 执行数据库根节点。输入数组当前不使用，返回数组的第 0 项对应 Filenames 输出端口。
// Execute the database root node. The input array is unused for now, and return item 0 maps to the Filenames output port.
export async function executeDatabaseRootNode(inputs: unknown[]): Promise<unknown[]> {
  void inputs

  const response = await backendApi.getAirfoilFileNames()
  return [response.file_names]
}
