/*
文件功能：显示翼型库列表页面，目前使用占位 catalog 数据和占位预览图。
File purpose: Displays the airfoil library page with placeholder catalog data and placeholder preview images.

结构说明：本文件按“数据记录 -> 卡片模型 -> 视图组件 -> 页面入口”的顺序组织，减少 JSX 与数据处理逻辑混杂。
Structure note: This file is organized as data records -> card models -> view components -> page entry to keep JSX separate from data preparation.
*/

import AirfoilPreview from '../features/airfoil-library/AirfoilPreview'

// --------- Catalog Records ---------

// 中文：后续 catalog API 可直接替换这类轻量列表记录，几何和完整 metadata 不放在这里。
// English: The catalog API can later replace this lightweight list record; geometry and full metadata should stay outside it.
type AirfoilCatalogRecord = {
  fileName: string
  displayName: string
  path: string
  tags: string[]
}

const placeholderCatalogRecords: AirfoilCatalogRecord[] = [
  {
    fileName: 'naca2412.dat',
    displayName: 'NACA 2412',
    path: 'airfoils/naca/naca2412.dat',
    tags: ['Max t 12.0%', 'Max c 2.0%', '120 pts'],
  },
  {
    fileName: 'naca0012.dat',
    displayName: 'NACA 0012',
    path: 'airfoils/naca/naca0012.dat',
    tags: ['Max t 12.0%', 'Symmetric', '118 pts'],
  },
  {
    fileName: 'clarky.dat',
    displayName: 'Clark Y',
    path: 'airfoils/classic/clarky.dat',
    tags: ['Max t 11.7%', 'Flat lower', '142 pts'],
  },
  {
    fileName: 's1223.dat',
    displayName: 'Selig S1223',
    path: 'airfoils/selig/s1223.dat',
    tags: ['High lift', 'Re 200k', '160 pts'],
  },
  {
    fileName: 'e423.dat',
    displayName: 'Eppler E423',
    path: 'airfoils/eppler/e423.dat',
    tags: ['Low Re', 'Cambered', '136 pts'],
  },
  {
    fileName: 'fx63-137.dat',
    displayName: 'Wortmann FX 63-137',
    path: 'airfoils/wortmann/fx63-137.dat',
    tags: ['Max t 13.7%', 'Glider', '154 pts'],
  },
]

// --------- Card Models ---------

type AirfoilCardViewModel = {
  id: string
  title: string
  path: string
  previewLabel: string
  tags: string[]
}

type AirfoilLibraryHeaderProps = {
  title: string
  sortButtonLabel: string
}

type AirfoilListProps = {
  cards: AirfoilCardViewModel[]
}

type AirfoilCardProps = {
  card: AirfoilCardViewModel
}

// --------- Card Model Builders ---------

// 中文：把单条 catalog 记录转换为卡片显示模型。
// English: Converts one catalog record into a card display model.
function createAirfoilCardViewModel(record: AirfoilCatalogRecord): AirfoilCardViewModel {
  return {
    id: record.path,
    title: record.displayName,
    path: record.path,
    previewLabel: `${record.displayName} preview`,
    tags: record.tags,
  }
}

// --------- View Components ---------

// 中文：渲染翼型库面板标题和页面级操作按钮。
// English: Renders the airfoil library panel title and page-level actions.
function AirfoilLibraryHeader({ title, sortButtonLabel }: AirfoilLibraryHeaderProps) {
  return (
    <div className="panel-header">
      <span>{title}</span>
      <div className="panel-actions">
        <button type="button">{sortButtonLabel}</button>
      </div>
    </div>
  )
}

// 中文：渲染翼型列表容器，并把每个卡片模型交给卡片组件展示。
// English: Renders the airfoil list container and delegates each card model to the card component.
function AirfoilList({ cards }: AirfoilListProps) {
  return (
    <div className="airfoil-list">
      {cards.map((card) => (
        <AirfoilCard card={card} key={card.id} />
      ))}
    </div>
  )
}

// 中文：渲染单个翼型卡片，组合预览、基础信息和标签区域。
// English: Renders one airfoil card by composing preview, metadata, and tag sections.
function AirfoilCard({ card }: AirfoilCardProps) {
  return (
    <article className="airfoil-card">
      <div className="airfoil-thumb">
        <AirfoilPreview label={card.previewLabel} />
      </div>

      <div className="airfoil-meta">
        <h3>{card.title}</h3>
        <p>{card.path}</p>
      </div>

      <div className="airfoil-tags">
        {card.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </article>
  )
}

// --------- Page Entry ---------

// 中文：页面入口负责准备卡片模型，并组合页面级区域。
// English: The page entry prepares card models and composes page-level regions.
function AirfoilLibraryPage() {
  const cards = placeholderCatalogRecords.map(createAirfoilCardViewModel)

  return (
    <section className="panel airfoil-list-panel">
      <AirfoilLibraryHeader sortButtonLabel="Sort" title="Airfoil Library" />
      <AirfoilList cards={cards} />
    </section>
  )
}

export default AirfoilLibraryPage
