/*
文件功能：渲染数据库根节点。
File purpose: Renders the database root node.
*/

import { type NodeProps } from '@xyflow/react'
import {
  databaseRootDefinition,
  type DatabaseRootNodeModel,
} from './DatabaseRootNodeModel'
import TemplateNode from './TemplateNode'
import { createTemplateNodeProps } from './TemplateNodeModel'

// --------- Component Rendering ---------

// 数据库根节点组件：只渲染端口声明，不在前端执行数据查询。
// Database root node component: renders port declarations only, without running data queries in the frontend.
function DatabaseRootNode(props: NodeProps<DatabaseRootNodeModel>) {
  const templateData = databaseRootDefinition.createData(props.id)

  return <TemplateNode {...createTemplateNodeProps(props, templateData)} />
}

export default DatabaseRootNode
