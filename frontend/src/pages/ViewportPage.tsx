/*
文件功能：显示主 viewport 面板，负责渲染当前选中的翼型几何预览。
File purpose: Displays the main viewport panel and renders the currently selected airfoil geometry preview.
*/

type ViewportPageProps = {
  displayText?: string
  geometryErrorMessage?: string | null
  isGeometryLoading: boolean
  selectedAirfoilFileName: string | null
  selectedAirfoilPath?: string
}

function ViewportPage({
  displayText,
  geometryErrorMessage,
  isGeometryLoading,
  selectedAirfoilFileName,
  selectedAirfoilPath,
}: ViewportPageProps) {
  function renderViewportContent() {
    if (selectedAirfoilPath) {
      return (
        <svg
          aria-label={`${selectedAirfoilFileName} geometry preview`}
          className="viewport-airfoil"
          role="img"
          viewBox="0 0 240 80"
        >
          <path className="viewport-airfoil-shape" d={selectedAirfoilPath} vectorEffect="non-scaling-stroke" />
        </svg>
      )
    }

    if (geometryErrorMessage) {
      return <div className="preview-empty">{geometryErrorMessage}</div>
    }

    if (selectedAirfoilFileName && isGeometryLoading) {
      return <div className="preview-empty">Loading {selectedAirfoilFileName} geometry...</div>
    }

    if (selectedAirfoilFileName) {
      return <div className="preview-empty">Geometry unavailable for {selectedAirfoilFileName}</div>
    }

    return <div className="preview-empty">Visualization Preview</div>
  }

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <span>Viewport</span>
        <div className="panel-actions">
          <button type="button">Fit</button>
          <button type="button">Grid</button>
        </div>
      </div>
      <div className="preview-canvas">
        {displayText && <div className="preview-text">{displayText}</div>}
        <div className="preview-origin" />
        {renderViewportContent()}
      </div>
    </section>
  )
}

export default ViewportPage
