/*
文件功能：渲染数据库根节点。
File purpose: Renders the database root node.
*/

import { type NodeProps } from '@xyflow/react'
import {
  FILENAMES_OUTPUT_KEY,
  databaseRootDefinition,
  describeFilenameOutput,
  type DatabaseRootNodeModel,
} from './DatabaseRootNodeModel'

// --------- Component Rendering ---------

// 数据库根节点组件：只根据 node.data 渲染当前输出状态，不在组件内部执行后端请求。
// Database root node component: renders current output state from node.data only, without running backend requests inside the component.
function DatabaseRootNode(props: NodeProps<DatabaseRootNodeModel>) {
  const output = databaseRootDefinition.getInitialOutput(
    props.data,
    FILENAMES_OUTPUT_KEY,
    props.id,
  )

  return databaseRootDefinition.render(
    props,
    {
      [FILENAMES_OUTPUT_KEY]: output,
    },
    describeFilenameOutput(output),
  )
}

export default DatabaseRootNode
