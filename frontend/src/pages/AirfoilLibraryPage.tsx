type AirfoilListItem = {
  name: string
  path: string
  info: string[]
}

const airfoilItems: AirfoilListItem[] = [
  {
    name: 'NACA 2412',
    path: 'airfoils/naca/naca2412.dat',
    info: ['Max t 12.0%', 'Max c 2.0%', '120 pts'],
  },
  {
    name: 'NACA 0012',
    path: 'airfoils/naca/naca0012.dat',
    info: ['Max t 12.0%', 'Symmetric', '118 pts'],
  },
  {
    name: 'Clark Y',
    path: 'airfoils/classic/clarky.dat',
    info: ['Max t 11.7%', 'Flat lower', '142 pts'],
  },
  {
    name: 'Selig S1223',
    path: 'airfoils/selig/s1223.dat',
    info: ['High lift', 'Re 200k', '160 pts'],
  },
  {
    name: 'Eppler E423',
    path: 'airfoils/eppler/e423.dat',
    info: ['Low Re', 'Cambered', '136 pts'],
  },
  {
    name: 'Wortmann FX 63-137',
    path: 'airfoils/wortmann/fx63-137.dat',
    info: ['Max t 13.7%', 'Glider', '154 pts'],
  },
]

function AirfoilLibraryPage() {
  return (
    <section className="panel airfoil-list-panel">
      <div className="panel-header">
        <span>Airfoil Library</span>
        <div className="panel-actions">
          <button type="button">Sort</button>
        </div>
      </div>
      <div className="airfoil-list">
        {airfoilItems.map((item, index) => (
          <article className="airfoil-card" key={item.name}>
            <div className="airfoil-thumb">
              <svg viewBox="0 0 300 200" role="img" aria-label={`${item.name} preview`}>
                <path className="airfoil-grid-line" d="M22 102 H278 M150 30 V170" />
                <path
                  className="airfoil-shape"
                  d={
                    index % 2 === 0
                      ? 'M28 104 C72 54 199 66 275 96 C205 122 76 126 28 104 Z'
                      : 'M28 103 C86 74 198 75 275 98 C204 116 84 117 28 103 Z'
                  }
                />
              </svg>
            </div>
            <div className="airfoil-meta">
              <h3>{item.name}</h3>
              <p>{item.path}</p>
            </div>
            <div className="airfoil-tags">
              {item.info.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default AirfoilLibraryPage
