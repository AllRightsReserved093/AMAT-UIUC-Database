/*
文件功能：提供节点编辑器页面，负责 React Flow 编排、右键菜单和结构变化后的执行触发。
File purpose: Provides the node editor page, coordinating React Flow, the context menu, and execution triggers after graph changes.
*/

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react'

import {
  DATABASE_ROOT_NODE_TYPE,
  createDatabaseRootNode,
  nodeTypes,
} from '../features/nodes'
import {
  initialNodeEditorEdges,
  initialNodeEditorNodes,
} from '../features/node-editor/nodeEditorInitialGraph'
import {
  executeNodeGraph,
  getNextCreationOrder,
  hasExecutableEdgeChange,
  hasExecutableNodeChange,
} from '../features/node-editor/nodeGraphExecutor'
import { updatePinnedOutletNodePositions } from '../features/node-editor/pinnedOutletNodeLayout'
import '@xyflow/react/dist/style.css'

// --------- Editor Types ---------

type NodeMenuState = {
  screenPosition: XYPosition
  flowPosition: XYPosition
}

// 节点编辑器页面组件：负责编辑图结构、显示右键菜单，并在结构变化后触发执行器。
// Node editor page component: edits graph structure, shows the context menu, and triggers the executor after structural changes.
function NodeEditorPage() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const executionIdRef = useRef(0)
  const pinnedNodeSyncFrameRef = useRef<number | null>(null)
  const nodesRef = useRef<Node[]>(initialNodeEditorNodes)
  const edgesRef = useRef<Edge[]>(initialNodeEditorEdges)

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodeEditorNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialNodeEditorEdges)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [executionVersion, setExecutionVersion] = useState(0)

  // 关闭右键菜单。
  // Close the context menu.
  const closeNodeMenu = useCallback(() => {
    setNodeMenu(null)
  }, [])

  // 标记图结构已经变化，让执行器在下一轮渲染后重新执行。
  // Mark the graph structure as changed so the executor reruns after the next render.
  const requestExecution = useCallback(() => {
    setExecutionVersion((currentVersion) => currentVersion + 1)
  }, [])

  // 立即同步 pinned outlet node 坐标。
  // Immediately sync pinned outlet node coordinates.
  const syncPinnedOutletNodes = useCallback((activeFlowInstance = flowInstance) => {
    const editorElement = editorRef.current
    if (!activeFlowInstance || !editorElement) return

    setNodes((currentNodes) => (
      updatePinnedOutletNodePositions(currentNodes, activeFlowInstance, editorElement)
    ))
  }, [flowInstance, setNodes])

  // 把高频 viewport/resize 事件合并到下一帧执行。
  // Coalesce high-frequency viewport and resize events into the next animation frame.
  const schedulePinnedOutletNodeSync = useCallback((activeFlowInstance = flowInstance) => {
    if (!activeFlowInstance || pinnedNodeSyncFrameRef.current !== null) return

    pinnedNodeSyncFrameRef.current = window.requestAnimationFrame(() => {
      pinnedNodeSyncFrameRef.current = null
      syncPinnedOutletNodes(activeFlowInstance)
    })
  }, [flowInstance, syncPinnedOutletNodes])

  // React Flow 初始化后保存实例，并立刻把 outlet 节点贴到当前可见区域右上侧。
  // Store the React Flow instance after init and pin outlet nodes to the visible upper-right area immediately.
  const handleFlowInit = useCallback((activeFlowInstance: ReactFlowInstance) => {
    setFlowInstance(activeFlowInstance)
    syncPinnedOutletNodes(activeFlowInstance)
  }, [syncPinnedOutletNodes])

  // viewport 平移或缩放时立即重新计算 outlet 节点位置，减少 pinned node 的视觉滞后。
  // Recalculate outlet-node positions immediately when the viewport pans or zooms to reduce visual lag.
  const handleViewportMove = useCallback(() => {
    syncPinnedOutletNodes()
  }, [syncPinnedOutletNodes])

  // viewport 开始移动时关闭菜单，并保持 outlet 节点贴边。
  // Close the context menu when viewport movement starts, then keep outlet nodes pinned.
  const handleViewportMoveStart = useCallback(() => {
    closeNodeMenu()
    syncPinnedOutletNodes()
  }, [closeNodeMenu, syncPinnedOutletNodes])

  // 处理画布右键：阻止浏览器菜单，保存菜单显示坐标和节点放置坐标。
  // Handle canvas right-click: block the browser menu and store both menu and node placement positions.
  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    const editorBounds = editorRef.current?.getBoundingClientRect()
    const screenPosition = {
      x: editorBounds ? event.clientX - editorBounds.left : event.clientX,
      y: editorBounds ? event.clientY - editorBounds.top : event.clientY,
    }
    const flowPosition = flowInstance?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    }) ?? { x: 0, y: 0 }

    setNodeMenu({
      screenPosition,
      flowPosition,
    })
  }, [flowInstance])

  // 添加一个 Database Root 节点，并使用当前右键位置作为放置位置。
  // Add one Database Root node and use the current context-menu position as placement position.
  const addDatabaseRootNode = useCallback(() => {
    if (!nodeMenu) return

    const placementPosition = nodeMenu.flowPosition

    setNodes((currentNodes) => {
      const creationOrder = getNextCreationOrder(currentNodes, DATABASE_ROOT_NODE_TYPE)
      return [
        ...currentNodes,
        createDatabaseRootNode(placementPosition, [], creationOrder),
      ]
    })

    closeNodeMenu()
    requestExecution()
  }, [closeNodeMenu, nodeMenu, requestExecution, setNodes])

  // 包装 React Flow 的节点变化处理，只在结构变化时触发执行器。
  // Wrap React Flow node changes and trigger the executor only for structural changes.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)

    if (hasExecutableNodeChange(changes)) {
      closeNodeMenu()
      requestExecution()
    }
  }, [closeNodeMenu, onNodesChange, requestExecution])

  // 包装 React Flow 的边变化处理，只在依赖关系变化时触发执行器。
  // Wrap React Flow edge changes and trigger the executor only when dependencies change.
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes)

    if (hasExecutableEdgeChange(changes)) {
      closeNodeMenu()
      requestExecution()
    }
  }, [closeNodeMenu, onEdgesChange, requestExecution])

  // 连接两个节点后写入新边，并触发执行器。
  // Write a new edge after connecting two nodes, then trigger the executor.
  const handleConnect = useCallback((connection: Connection) => {
    setEdges((currentEdges) => addEdge(connection, currentEdges))
    closeNodeMenu()
    requestExecution()
  }, [closeNodeMenu, requestExecution, setEdges])

  // 监听菜单外部点击和 Escape 键，按桌面应用菜单行为关闭菜单。
  // Listen for outside clicks and Escape to close the menu with desktop-app menu behavior.
  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!nodeMenu) return
      if (menuRef.current?.contains(event.target as globalThis.Node)) return

      closeNodeMenu()
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeNodeMenu()
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [closeNodeMenu, nodeMenu])

  // 节点编辑器尺寸变化时重新同步 pinned outlet node。
  // Resync pinned outlet nodes when the node editor size changes.
  useEffect(() => {
    const editorElement = editorRef.current
    if (!flowInstance || !editorElement) return undefined

    const resizeObserver = new ResizeObserver(() => {
      schedulePinnedOutletNodeSync(flowInstance)
    })

    resizeObserver.observe(editorElement)
    schedulePinnedOutletNodeSync(flowInstance)

    return () => {
      resizeObserver.disconnect()
    }
  }, [flowInstance, schedulePinnedOutletNodeSync])

  // 组件卸载时清理尚未执行的 pinned node 同步帧。
  // Clear any pending pinned-node sync frame on component unmount.
  useEffect(() => (
    () => {
      if (pinnedNodeSyncFrameRef.current === null) return

      window.cancelAnimationFrame(pinnedNodeSyncFrameRef.current)
      pinnedNodeSyncFrameRef.current = null
    }
  ), [])

  // 同步最新图结构到 ref，供异步执行器读取。
  // Sync the latest graph structure into refs for the async executor.
  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [edges, nodes])

  // 图结构变化后执行整张图；过期执行会被 executionIdRef 取消写回。
  // Execute the graph after structural changes; stale executions are prevented from writing back by executionIdRef.
  useEffect(() => {
    const executionId = executionIdRef.current + 1
    executionIdRef.current = executionId

    executeNodeGraph(
      nodesRef.current,
      edgesRef.current,
      setNodes,
      () => executionIdRef.current === executionId,
    )
  }, [executionVersion, setNodes])

  return (
    <div className="node-editor">
      <div
        className="node-editor-canvas"
        onContextMenu={handleContextMenu}
        onWheel={closeNodeMenu}
        ref={editorRef}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          deleteKeyCode={['Delete', 'Backspace']}
          nodeTypes={nodeTypes}
          onConnect={handleConnect}
          onConnectStart={closeNodeMenu}
          onEdgesChange={handleEdgesChange}
          onInit={handleFlowInit}
          onMove={handleViewportMove}
          onMoveEnd={handleViewportMove}
          onMoveStart={handleViewportMoveStart}
          onNodesChange={handleNodesChange}
          onPaneClick={closeNodeMenu}
          fitView
        >
          <Background gap={20} size={1} />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {nodeMenu && (
          <div
            className="node-editor-context-menu"
            onContextMenu={(event) => event.preventDefault()}
            ref={menuRef}
            style={{
              left: nodeMenu.screenPosition.x,
              top: nodeMenu.screenPosition.y,
            }}
          >
            <div className="node-editor-context-menu-title">Add Node</div>
            <button type="button" onClick={addDatabaseRootNode}>
              Database Root
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NodeEditorPage
