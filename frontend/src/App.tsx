/*
文件功能：应用外壳组件，负责主工作区布局、跨面板状态和顶层交互协调。
File purpose: Provides the application shell for workspace layout, cross-panel state, and top-level interaction coordination.
*/

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
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

function clampPanelSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function App() {
  const workspaceRef = useRef<HTMLDivElement>(null)
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

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = listBounds.right - moveEvent.clientX
      setListWidth(clampPanelSize(nextWidth, MIN_LIST_WIDTH, maxListWidth))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
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

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = bounds.right - moveEvent.clientX
      setSideWidth(clampPanelSize(nextWidth, MIN_SIDE_WIDTH, maxSideWidth))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function beginNodeResize(event: ReactPointerEvent) {
    event.preventDefault()
    const sideStack = event.currentTarget.parentElement
    if (!sideStack) return

    const bounds = sideStack.getBoundingClientRect()
    const maxNodeHeight = Math.max(MIN_PANEL_HEIGHT, bounds.height - MIN_PANEL_HEIGHT)

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextHeight = bounds.bottom - moveEvent.clientY
      setNodeHeight(clampPanelSize(nextHeight, MIN_PANEL_HEIGHT, maxNodeHeight))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function selectAirfoil(fileName: string) {
    setSelectedAirfoilFileName(fileName)
  }

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
