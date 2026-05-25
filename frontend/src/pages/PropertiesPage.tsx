function PropertiesPage() {
  return (
    <section className="panel properties-panel">
      <div className="panel-header">
        <span>Properties</span>
        <div className="panel-actions">
          <button type="button">Reset</button>
        </div>
      </div>
      <div className="properties-content">
        <label>
          Profile
          <select defaultValue="naca">
            <option value="naca">NACA 2412</option>
            <option value="custom">Custom Airfoil</option>
          </select>
        </label>
        <label>
          Reynolds Number
          <input defaultValue="1,000,000" />
        </label>
        <label>
          Angle of Attack
          <input defaultValue="4.0 deg" />
        </label>
        <div className="placeholder-group">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  )
}

export default PropertiesPage
