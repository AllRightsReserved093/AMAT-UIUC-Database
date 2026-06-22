/*
文件功能：应用外壳组件，负责主工作区布局、跨面板状态和顶层交互协调。
File purpose: Provides the application shell for workspace layout, cross-panel state, and top-level interaction coordination.
*/

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { backendApi } from './api/backend'
import AirfoilLibraryPage from './pages/AirfoilLibraryPage'
import NodeEditorPage from './pages/NodeEditorPage'
import PropertiesPage from './pages/PropertiesPage'
import ViewportPage from './pages/ViewportPage'

const MIN_PREVIEW_WIDTH = 420
const MIN_LIST_WIDTH = 320
const MIN_SIDE_WIDTH = 280
const MIN_PANEL_HEIGHT = 180

type WorkspaceSizeVariable = '--list-width' | '--side-width' | '--node-height'

function clampPanelSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function App() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const pendingWorkspaceSizeFrameRef = useRef<number | null>(null)
  const pendingWorkspaceSizeUpdateRef = useRef<{
    name: WorkspaceSizeVariable
    value: number
  } | null>(null)
  const [viewportText, setViewportText] = useState<string>()
  const [listWidth, setListWidth] = useState(360)
  const [sideWidth, setSideWidth] = useState(420)
  const [nodeHeight, setNodeHeight] = useState(300)
  const [selectedAirfoilFileName, setSelectedAirfoilFileName] = useState<string | null>(null)

  useEffect(() => {
    function initializeApp() {
      console.log('App initialized')
      checkBackendConnection()
    }

    function checkBackendConnection() {
      backendApi.health()
        .then((response) => {
          setViewportText('This is a test text.')
          console.log('Backend status:', response.status)
        })
        .catch((error) => {
          console.error('Cannot connect to backend:', error)
        })
    }

    initializeApp()
  }, [])

  useEffect(() => {
    return () => {
      if (pendingWorkspaceSizeFrameRef.current === null) return
      window.cancelAnimationFrame(pendingWorkspaceSizeFrameRef.current)
    }
  }, [])

  // 中文：拖动过程中只写 workspace CSS 变量，不触发 React 重新渲染。
  // English: During dragging, only writes workspace CSS variables without triggering React renders.
  function scheduleWorkspaceSizeVariable(name: WorkspaceSizeVariable, value: number) {
    pendingWorkspaceSizeUpdateRef.current = { name, value }

    if (pendingWorkspaceSizeFrameRef.current !== null) return

    pendingWorkspaceSizeFrameRef.current = window.requestAnimationFrame(() => {
      const update = pendingWorkspaceSizeUpdateRef.current

      pendingWorkspaceSizeFrameRef.current = null
      pendingWorkspaceSizeUpdateRef.current = null

      if (!update) return
      setWorkspaceSizeVariable(update.name, update.value)
    })
  }

  // 中文：拖动结束时立即同步最后的视觉尺寸，并交给 React state 保存。
  // English: When dragging ends, immediately syncs the final visual size before saving it in React state.
  function flushWorkspaceSizeVariable(name: WorkspaceSizeVariable, value: number) {
    if (pendingWorkspaceSizeFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingWorkspaceSizeFrameRef.current)
      pendingWorkspaceSizeFrameRef.current = null
      pendingWorkspaceSizeUpdateRef.current = null
    }

    setWorkspaceSizeVariable(name, value)
  }

  function setWorkspaceSizeVariable(name: WorkspaceSizeVariable, value: number) {
    workspaceRef.current?.style.setProperty(name, `${value}px`)
  }

  function beginListResize(event: ReactPointerEvent) {
    event.preventDefault()
    const workspace = workspaceRef.current
    const listPanel = event.currentTarget.nextElementSibling
    if (!workspace || !(listPanel instanceof HTMLElement)) return

    const workspaceBounds = workspace.getBoundingClientRect()
    const listBounds = listPanel.getBoundingClientRect()
    const maxListWidth = Math.max(
      MIN_LIST_WIDTH,
      workspaceBounds.width - MIN_PREVIEW_WIDTH - MIN_SIDE_WIDTH - 12,
    )
    let nextListWidth = listWidth

    function handlePointerMove(moveEvent: PointerEvent) {
      nextListWidth = clampPanelSize(
        listBounds.right - moveEvent.clientX,
        MIN_LIST_WIDTH,
        maxListWidth,
      )
      scheduleWorkspaceSizeVariable('--list-width', nextListWidth)
    }

    function handlePointerEnd() {
      flushWorkspaceSizeVariable('--list-width', nextListWidth)
      setListWidth(nextListWidth)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
  }

  function beginSideResize(event: ReactPointerEvent) {
    event.preventDefault()
    const workspace = workspaceRef.current
    if (!workspace) return

    const bounds = workspace.getBoundingClientRect()
    const maxSideWidth = Math.max(
      MIN_SIDE_WIDTH,
      bounds.width - MIN_PREVIEW_WIDTH - MIN_LIST_WIDTH - 12,
    )
    let nextSideWidth = sideWidth

    function handlePointerMove(moveEvent: PointerEvent) {
      nextSideWidth = clampPanelSize(
        bounds.right - moveEvent.clientX,
        MIN_SIDE_WIDTH,
        maxSideWidth,
      )
      scheduleWorkspaceSizeVariable('--side-width', nextSideWidth)
    }

    function handlePointerEnd() {
      flushWorkspaceSizeVariable('--side-width', nextSideWidth)
      setSideWidth(nextSideWidth)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
  }

  function beginNodeResize(event: ReactPointerEvent) {
    event.preventDefault()
    const sideStack = event.currentTarget.parentElement
    if (!sideStack) return

    const bounds = sideStack.getBoundingClientRect()
    const maxNodeHeight = Math.max(MIN_PANEL_HEIGHT, bounds.height - MIN_PANEL_HEIGHT)
    let nextNodeHeight = nodeHeight

    function handlePointerMove(moveEvent: PointerEvent) {
      nextNodeHeight = clampPanelSize(
        bounds.bottom - moveEvent.clientY,
        MIN_PANEL_HEIGHT,
        maxNodeHeight,
      )
      scheduleWorkspaceSizeVariable('--node-height', nextNodeHeight)
    }

    function handlePointerEnd() {
      flushWorkspaceSizeVariable('--node-height', nextNodeHeight)
      setNodeHeight(nextNodeHeight)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
  }

  const selectAirfoil = useCallback(function selectAirfoil(fileName: string) {
    setSelectedAirfoilFileName((currentFileName) => {
      if (currentFileName === fileName) return currentFileName
      return fileName
    })
  }, [])

  function createWorkspaceStyle() {
    return {
      '--list-width': `${listWidth}px`,
      '--side-width': `${sideWidth}px`,
      '--node-height': `${nodeHeight}px`,
    } as CSSProperties
  }

  const workspaceStyle = createWorkspaceStyle()

  return (
    <div className="app" ref={workspaceRef} style={workspaceStyle}>
      <header className="app-titlebar">
        <div className="app-brand">
          <span className="app-icon" aria-hidden="true" />
          <span className="app-title">AMAT UIUC Database</span>
        </div>
        <nav className="app-menu" aria-label="Application menu">
          <button type="button">File</button>
          <button type="button">Edit</button>
          <button type="button">View</button>
        </nav>
        <div className="app-mode">Airfoil Workspace</div>
        <div className="window-buttons" aria-hidden="true">
          <button type="button" tabIndex={-1}>_</button>
          <button type="button" tabIndex={-1}>[]</button>
          <button type="button" tabIndex={-1}>X</button>
        </div>
      </header>

      <main className="workspace">
        <ViewportPage displayText={viewportText} />

        <div
          className="resize-handle resize-handle-vertical"
          onPointerDown={beginListResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize airfoil list"
        />

        <AirfoilLibraryPage
          onSelectAirfoil={selectAirfoil}
          selectedAirfoilFileName={selectedAirfoilFileName}
        />

        <div
          className="resize-handle resize-handle-vertical"
          onPointerDown={beginSideResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side panels"
        />

        <aside className="side-stack">
          <PropertiesPage />

          <div
            className="resize-handle resize-handle-horizontal"
            onPointerDown={beginNodeResize}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize node editor"
          />

          <section className="panel node-panel">
            <div className="panel-header">
              <span>Node Editor</span>
              <div className="panel-actions">
                <button type="button">Add</button>
              </div>
            </div>
            <NodeEditorPage />
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
