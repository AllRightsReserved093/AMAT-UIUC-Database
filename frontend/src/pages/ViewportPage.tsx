type ViewportPageProps = {
  displayText?: string
}

function ViewportPage({ displayText }: ViewportPageProps) {
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
        <div className="preview-empty">Visualization Preview</div>
      </div>
    </section>
  )
}

export default ViewportPage
