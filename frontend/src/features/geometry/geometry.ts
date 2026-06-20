/*
文件功能：预留翼型几何处理函数的位置，后续用于解析 .dat 文本、归一化坐标和生成渲染路径。
File purpose: Reserves the airfoil geometry processing module for parsing .dat text, normalizing coordinates, and building render paths.
*/

import { ApiError, backendApi } from '../../api/backend'

export type GeometryFileMap = Record<string, string>

export type AirfoilPoint = {
  x: number
  y: number
}

export type GeometryBounds = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  width: number
  height: number
}

export type SvgPoint = {
  x: number
  y: number
}

export type SvgScaleMode = 'bounds' | 'chord'

export type SvgMapOptions = {
  width?: number
  height?: number
  padding?: number
  scaleMode?: SvgScaleMode
}

export type GeometryFilterResult = {
  points: AirfoilPoint[]
  bounds: GeometryBounds | null
  isRenderable: boolean
  warnings: string[]
}

export type ProcessedGeometry = {
  fileName: string
  rawText: string
  points: AirfoilPoint[]
  bounds: GeometryBounds | null
  isRenderable: boolean
  warnings: string[]
}

export type ProcessedGeometryMap = Record<string, ProcessedGeometry>

const DEFAULT_GEOMETRY_CATALOG_REYNOLDS_NUMBER = 1_000_000
const DEFAULT_SVG_WIDTH = 240
const DEFAULT_SVG_HEIGHT = 80
const DEFAULT_SVG_PADDING = 8
const DEFAULT_SVG_SCALE_MODE: SvgScaleMode = 'chord'
const SVG_PATH_NUMBER_FRACTION_DIGITS = 3

// 中文：从后端读取全部翼型几何文本，不做任何解析或清洗。
// English: Reads all airfoil geometry text from the backend without parsing or cleaning it.
export async function loadAllGeometries(signal?: AbortSignal): Promise<GeometryFileMap> {
  const response = await backendApi.getFullCatalogs(
    DEFAULT_GEOMETRY_CATALOG_REYNOLDS_NUMBER,
    signal,
  )
  const fileNames = response.file_catalogs.map((catalog) => catalog.file_name)

  if (fileNames.length === 0) return {}

  try {
    return await backendApi.getGeometryFiles(fileNames, signal)
  } catch (error) {
    if (!shouldUseGeometryFallback(error, signal)) throw error
    return loadAvailableGeometries(fileNames, signal)
  }
}

// 中文：处理后端返回的原始翼型几何文本，并返回按文件名索引的几何数据。
// English: Processes raw airfoil geometry text returned by the backend and returns geometry data keyed by file name.
export function processGeometries(rawFiles: GeometryFileMap): ProcessedGeometryMap {
  const processed: ProcessedGeometryMap = {}

  for (const [fileName, rawText] of Object.entries(rawFiles)) {
    processed[fileName] = processGeometry(fileName, rawText)
  }

  return processed
}

// 中文：把翼型 .dat 文本转换为按原始顺序排列的二维点数组。
// English: Converts airfoil .dat text into a 2D point array in original file order.
export function parseAirfoilPoints(rawText: string): AirfoilPoint[] {
  const points: AirfoilPoint[] = []
  const lines = rawText.split(/\r?\n|\r/)

  for (const line of lines) {
    const values = line.trim().split(/[\s,]+/)
    if (values.length < 2) continue

    const x = Number(values[0].replace(/[dD]/g, 'e'))
    const y = Number(values[1].replace(/[dD]/g, 'e'))

    points.push({ x, y })
  }

  return points
}

// 中文：计算点数组的外接范围，用于后续缩放、居中和 SVG 坐标映射。
// English: Calculates point-array bounds for later scaling, centering, and SVG coordinate mapping.
export function calculateBounds(points: AirfoilPoint[]): GeometryBounds | null {
  if (points.length === 0) return null

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity

  for (const point of points) {
    xMin = Math.min(xMin, point.x)
    xMax = Math.max(xMax, point.x)
    yMin = Math.min(yMin, point.y)
    yMax = Math.max(yMax, point.y)
  }

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    width: xMax - xMin,
    height: yMax - yMin,
  }
}

// 中文：把翼型坐标点按 bounds 或 chord 映射到 SVG/viewBox 坐标系，并自动反转 y 轴。
// English: Maps airfoil coordinate points into SVG/viewBox coordinates by bounds or chord, with the y-axis inverted.
export function mapPointsToSvg(points: AirfoilPoint[], bounds: GeometryBounds, options: SvgMapOptions = {}): SvgPoint[] {
  const width = options.width ?? DEFAULT_SVG_WIDTH
  const height = options.height ?? DEFAULT_SVG_HEIGHT
  const padding = Math.max(0, options.padding ?? DEFAULT_SVG_PADDING)
  const scaleMode = options.scaleMode ?? DEFAULT_SVG_SCALE_MODE
  const drawableWidth = width - padding * 2
  const drawableHeight = height - padding * 2

  if (
    points.length === 0 ||
    bounds.width === 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    drawableWidth <= 0 ||
    drawableHeight <= 0
  ) {
    return []
  }

  const scale =
    scaleMode === 'bounds' && bounds.height > 0
      ? Math.min(drawableWidth / bounds.width, drawableHeight / bounds.height)
      : drawableWidth / bounds.width

  if (!Number.isFinite(scale) || scale <= 0) return []

  const scaledWidth = bounds.width * scale
  const scaledHeight = bounds.height * scale
  const offsetX = padding + (drawableWidth - scaledWidth) / 2
  const offsetY = padding + (drawableHeight - scaledHeight) / 2

  return points.map((point) => ({
    x: offsetX + (point.x - bounds.xMin) * scale,
    y: offsetY + (bounds.yMax - point.y) * scale,
  }))
}

// 中文：把 SVG 坐标点转换成 <path> 可用的 d 字符串。
// English: Converts SVG coordinate points into a d string usable by <path>.
export function buildSvgPath(points: SvgPoint[], closePath = false): string {
  if (points.length < 2) return ''

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return ''
  }

  const formatNumber = (value: number) =>
    Number(value.toFixed(SVG_PATH_NUMBER_FRACTION_DIGITS)).toString()
  const firstPoint = points[0]
  if (!firstPoint) return ''

  const commands = [`M ${formatNumber(firstPoint.x)} ${formatNumber(firstPoint.y)}`]

  for (const point of points.slice(1)) {
    commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
  }

  if (closePath) commands.push('Z')

  return commands.join(' ')
}

// 中文：过滤无法安全渲染的点，并判断这组点是否足够用于渲染。
// English: Filters points that cannot be rendered safely and checks whether the point set is renderable.
export function filterRenderablePoints(points: AirfoilPoint[]): GeometryFilterResult {
  const warnings: string[] = []
  const filtered: AirfoilPoint[] = []
  let skippedPointCount = 0

  for (const point of points) {
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      filtered.push(point)
    } else {
      skippedPointCount += 1
    }
  }

  if (skippedPointCount > 0) {
    warnings.push(`Skipped ${skippedPointCount} point(s) with non-finite coordinates.`)
  }

  const bounds = calculateBounds(filtered)

  if (filtered.length < 2) {
    warnings.push('Geometry has fewer than two renderable points.')
    return { points: filtered, bounds, isRenderable: false, warnings }
  }

  if (!bounds || bounds.width === 0) {
    warnings.push('Geometry has zero x-span and cannot be scaled for rendering.')
    return { points: filtered, bounds, isRenderable: false, warnings }
  }

  return { points: filtered, bounds, isRenderable: true, warnings }
}

// 中文：处理单个翼型几何文件；当前完成点数组解析、过滤和 bounds 计算，后续接入渲染路径生成。
// English: Processes one airfoil geometry file; currently parses, filters, and calculates bounds before render-path generation is added.
function processGeometry(fileName: string, rawText: string): ProcessedGeometry {
  const parsedPoints = parseAirfoilPoints(rawText)
  const filtered = filterRenderablePoints(parsedPoints)

  return {
    fileName,
    rawText,
    points: filtered.points,
    bounds: filtered.bounds,
    isRenderable: filtered.isRenderable,
    warnings: filtered.warnings,
  }
}

// 中文：批量读取失败时逐个读取可用几何文件，跳过缺失或损坏的数据。
// English: Reads available geometry files one by one after a batch failure, skipping missing or broken data.
async function loadAvailableGeometries(fileNames: string[], signal?: AbortSignal): Promise<GeometryFileMap> {
  const available: GeometryFileMap = {}

  for (const fileName of fileNames) {
    try {
      const file = await backendApi.getGeometryFiles([fileName], signal)
      Object.assign(available, file)
    } catch (error) {
      if (!shouldUseGeometryFallback(error, signal)) throw error
    }
  }

  return available
}

// 中文：只对后端返回的文件级错误降级；取消、超时或网络错误继续抛出。
// English: Falls back only for backend file-level errors; aborts, timeouts, and network errors are rethrown.
function shouldUseGeometryFallback(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false
  if (error instanceof ApiError && error.status === 0) return false
  return true
}
