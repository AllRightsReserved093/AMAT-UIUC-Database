/*
文件功能：定义节点编辑器的初始节点、初始连线和数据导出口配置。
File purpose: Defines the node editor's initial nodes, initial edges, and data export outlet config.
*/

import { type Edge, type Node, type XYPosition } from '@xyflow/react'
import {
  DATABASE_FILENAMES_OUTPUT_ID,
  DATABASE_ROOT_NODE_ID,
  createDatabaseRootNode,
} from './DatabaseRootNodeModel'
import {
  createNodeEditorExportNode,
  type NodeEditorExportOutlet,
} from './NodeEditorExportNodeModel'
import {
  createInputPortId,
  createNodeId,
  createOutputPortId,
  createTemplateNode,
} from './TemplateNode'

// --------- Node Identity ---------

const GEOMETRY_FILTER_NODE_ID = createNodeId('geometryFilter', 0)
const PREVIEW_OUTPUT_NODE_ID = createNodeId('previewOutput', 0)
const TEMPLATE_NODE_ID = createNodeId('templateNode', 0)
const INITIAL_EXPORT_NODE_X = 820
const INITIAL_EXPORT_NODE_Y = 70
const INITIAL_EXPORT_NODE_VERTICAL_STEP = 58

// --------- Export Outlets ---------

export const nodeEditorExportOutlets: NodeEditorExportOutlet[] = [
  {
    id: 'list',
    label: 'List',
    valueKind: 'file-name-list',
    order: 0,
  },
]

// --------- Export Node Layout ---------

// 临时初始位置；运行时 pinned 同步会根据当前 viewport 覆盖该位置。
// Temporary initial position; runtime pinned sync overrides it from the current viewport.
function getInitialExportNodePosition(order: number): XYPosition {
  return {
    x: INITIAL_EXPORT_NODE_X,
    y: INITIAL_EXPORT_NODE_Y + order * INITIAL_EXPORT_NODE_VERTICAL_STEP,
  }
}

// 按 order 创建导出口节点。一个 outlet 对应一个不可拖动的 React Flow node。
// Create export nodes by order. One outlet maps to one non-draggable React Flow node.
function createInitialExportNodes(outlets: NodeEditorExportOutlet[]): Node[] {
  return [...outlets]
    .sort((firstOutlet, secondOutlet) => firstOutlet.order - secondOutlet.order)
    .map((outlet) => createNodeEditorExportNode(
      outlet,
      getInitialExportNodePosition(outlet.order),
    ))
}

// --------- Initial Graph ---------

export const initialNodeEditorNodes: Node[] = [
  createDatabaseRootNode({ x: 60, y: 70 }),
  {
    id: GEOMETRY_FILTER_NODE_ID,
    position: { x: 300, y: 70 },
    data: { label: 'Geometry Filter' },
  },
  {
    id: PREVIEW_OUTPUT_NODE_ID,
    position: { x: 540, y: 160 },
    data: { label: 'Preview Output' },
  },
  createTemplateNode({
    id: TEMPLATE_NODE_ID,
    position: { x: 300, y: 260 },
    data: {
      title: 'Template Node',
      description: 'Configurable inputs, outputs, and output payloads.',
      inputs: [
        { id: createInputPortId(TEMPLATE_NODE_ID, 0), label: 'Geometry' },
        { id: createInputPortId(TEMPLATE_NODE_ID, 1), label: 'Settings' },
      ],
      outputs: [
        {
          id: createOutputPortId(TEMPLATE_NODE_ID, 0),
          label: 'Metadata',
          data: { kind: 'metadata', schema: 'foil-metadata-v1' },
        },
        {
          id: createOutputPortId(TEMPLATE_NODE_ID, 1),
          label: 'Preview',
          data: { kind: 'viewport-preview', format: 'svg-path' },
        },
      ],
    },
  }),
  ...createInitialExportNodes(nodeEditorExportOutlets),
]

export const initialNodeEditorEdges: Edge[] = [
  {
    id: 'dataset-to-filter',
    source: DATABASE_ROOT_NODE_ID,
    sourceHandle: DATABASE_FILENAMES_OUTPUT_ID,
    target: GEOMETRY_FILTER_NODE_ID,
  },
  {
    id: 'filter-to-output',
    source: GEOMETRY_FILTER_NODE_ID,
    target: PREVIEW_OUTPUT_NODE_ID,
  },
]
