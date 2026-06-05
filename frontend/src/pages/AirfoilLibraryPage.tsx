/*
文件功能：显示翼型库列表页面，目前使用后端 catalog 结构的占位数据和占位预览图。
File purpose: Displays the airfoil library page with placeholder data that matches the backend catalog structure and placeholder preview images.

结构说明：本文件按“数据记录 -> 卡片模型 -> 视图组件 -> 页面入口”的顺序组织，减少 JSX 与数据处理逻辑混杂。
Structure note: This file is organized as data records -> card models -> view components -> page entry to keep JSX separate from data preparation.
*/

import { useEffect, useState } from 'react'
import AirfoilPreview from '../features/airfoil-library/AirfoilPreview'
import { backendApi, type FileCatalogListResponse } from '../api/backend'

// --------- Catalog Records ---------

const DEFAULT_CATALOG_REYNOLDS_NUMBER = 1_000_000

// 中文：后续 catalog API 可直接替换这类轻量列表记录，几何和完整 metadata 不放在这里。
// English: The catalog API can later replace this lightweight list record; geometry and full metadata should stay outside it.
type AirfoilCatalogRecord = FileCatalogListResponse['file_catalogs'][number]

const placeholderCatalogRecords: AirfoilCatalogRecord[] = [
  {
    file_name: '2032c.dat',
    file_path: 'coord_seligFmt_clean/2032c.dat',
    family_series: null,
    max_thickness: 0.0796,
    cl_cd_max: 111.78621468864901,
  },
  {
    file_name: '30p-30n.dat',
    file_path: 'coord_seligFmt_clean/30p-30n.dat',
    family_series: null,
    max_thickness: null,
    cl_cd_max: null,
  },
  {
    file_name: '30p-30n-flap.dat',
    file_path: 'coord_seligFmt_clean/30p-30n-flap.dat',
    family_series: null,
    max_thickness: 0.04612791614255768,
    cl_cd_max: 2.4628472167063413,
  },
  {
    file_name: '30p-30n-main.dat',
    file_path: 'coord_seligFmt_clean/30p-30n-main.dat',
    family_series: null,
    max_thickness: 0.11551370821109935,
    cl_cd_max: null,
  },
  {
    file_name: '30p-30n-slat.dat',
    file_path: 'coord_seligFmt_clean/30p-30n-slat.dat',
    family_series: null,
    max_thickness: null,
    cl_cd_max: null,
  },
  {
    file_name: 'a18.dat',
    file_path: 'coord_seligFmt_clean/a18.dat',
    family_series: null,
    max_thickness: 0.07345,
    cl_cd_max: 93.68299954636555,
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
  isLoading: boolean
  errorMessage: string | null
}

type AirfoilCardProps = {
  card: AirfoilCardViewModel
}

type CatalogImportState = {
  records: AirfoilCatalogRecord[]
  isLoading: boolean
  errorMessage: string | null
}

// --------- Catalog Import ---------

// 中文：从真实后端 catalog 导入一条翼型记录，先用于验证页面的数据链路。
// English: Imports one real airfoil record from the backend catalog to validate the page data path first.
async function importOneRealCatalogRecord(signal?: AbortSignal): Promise<AirfoilCatalogRecord[]> {
  const response = await backendApi.getFullCatalogs(DEFAULT_CATALOG_REYNOLDS_NUMBER, signal)
  return response.file_catalogs.slice(0, 1)
}

// --------- Card Model Builders ---------

// 中文：把单条 catalog 记录转换为卡片显示模型。
// English: Converts one catalog record into a card display model.
function createAirfoilCardViewModel(record: AirfoilCatalogRecord): AirfoilCardViewModel {
  return {
    id: record.file_name,
    title: record.file_name,
    path: record.file_path,
    previewLabel: `${record.file_name} preview`,
    tags: createAirfoilCatalogTags(record),
  }
}

// 中文：把轻量 catalog 字段转换为卡片底部标签。
// English: Converts lightweight catalog fields into the card footer tags.
function createAirfoilCatalogTags(record: AirfoilCatalogRecord): string[] {
  return [
    `Family ${formatMissingText(record.family_series)}`,
    `Max t ${formatPercent(record.max_thickness)}`,
    `CL/CD ${formatNumber(record.cl_cd_max)}`,
  ]
}

// 中文：显示可能为空的文本字段。
// English: Displays nullable text fields.
function formatMissingText(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'Unknown'
}

// 中文：把 0-1 的比例值显示为百分比。
// English: Displays a 0-1 ratio value as a percentage.
function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'Unknown'
}

// 中文：显示可能为空的数值字段。
// English: Displays nullable numeric fields.
function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : 'Unknown'
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
function AirfoilList({ cards, isLoading, errorMessage }: AirfoilListProps) {
  if (isLoading) {
    return (
      <div className="airfoil-list">
        <div className="airfoil-list-status">Loading catalog...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="airfoil-list">
        <div className="airfoil-list-status">{errorMessage}</div>
      </div>
    )
  }

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
  const [catalogImportState, setCatalogImportState] = useState<CatalogImportState>({
    records: placeholderCatalogRecords,
    isLoading: true,
    errorMessage: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    importOneRealCatalogRecord(controller.signal)
      .then((records) => {
        setCatalogImportState({
          records,
          isLoading: false,
          errorMessage: null,
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return

        setCatalogImportState({
          records: [],
          isLoading: false,
          errorMessage: error instanceof Error ? error.message : 'Failed to load catalog.',
        })
      })

    return () => {
      controller.abort()
    }
  }, [])

  const cards = catalogImportState.records.map(createAirfoilCardViewModel)

  return (
    <section className="panel airfoil-list-panel">
      <AirfoilLibraryHeader sortButtonLabel="Sort" title="Airfoil Library" />
      <AirfoilList
        cards={cards}
        errorMessage={catalogImportState.errorMessage}
        isLoading={catalogImportState.isLoading}
      />
    </section>
  )
}

export default AirfoilLibraryPage
