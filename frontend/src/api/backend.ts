// 本文件涉及的类型总览：
// Type overview used in this file:
//
// - JsonPrimitive / JsonValue:
//   JSON 基础值与递归 JSON 值，用于描述可传输的 JSON 数据。
//   JSON primitive and recursive JSON value types for transferable JSON data.
//
// - ApiErrorPayload / ApiError:
//   后端错误响应内容，以及前端统一抛出的 API 错误类。
//   Backend error payload shape and the unified API error class thrown by the frontend.
//
// - FileNameListResponse / StatusResponse:
//   通用接口响应类型：翼型文件名列表、状态响应。
//   Common response types: airfoil file-name list and status response.
//
// - RangeFilter / GeometryFilterValue / GeometryFilterRequest:
//   几何筛选相关类型，对应 POST /airfoils/filter/geometry。
//   Geometry filter types for POST /airfoils/filter/geometry.
//
// - AeroFilterValue / AeroFilterRequest:
//   气动筛选相关类型，对应 POST /airfoils/filter/aero。
//   Aerodynamic filter types for POST /airfoils/filter/aero.
//
// - MetadataRequest / MetadataResponse:
//   metadata 查询请求与响应类型，对应 POST /airfoils/metadata。
//   Metadata query request and response types for POST /airfoils/metadata.
//
// - FileCatalogListResponse:
//   轻量 catalog 列表响应类型，对应 GET /airfoils/catalog。
//   Lightweight catalog list response type for GET /airfoils/catalog.
//
// - GeometryMetadata / AerodynamicMetadata / FoilMetadata:
//   后端 metadata dataclass 的前端 TypeScript 镜像类型。
//   Frontend TypeScript mirror types of backend metadata dataclasses.
//
// - RequestOptions:
//   request<T>() 内部使用的 fetch 配置类型。
//   Internal fetch option type used by request<T>().

// 默认后端地址。开发时 FastAPI 通常运行在 8000 端口。
// Default backend URL. FastAPI usually runs on port 8000 in development.
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000'

// 单次请求超时时间，单位毫秒。
// Timeout for each request, in milliseconds.
const REQUEST_TIMEOUT_MS = 15000


// --------- Type Definitions ---------

// 实际使用的后端地址。可以通过 .env 里的 VITE_BACKEND_URL 覆盖。
// The active backend URL. It can be overridden by VITE_BACKEND_URL in .env.
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') ?? DEFAULT_BACKEND_URL

// JSON 基础类型。用于描述可以安全传给后端的 JSON 数据。
// JSON base types. Used to describe data that can be safely sent to the backend.
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

// 后端错误响应的通用形状。FastAPI 常见字段是 detail。
// Generic backend error payload shape. FastAPI commonly returns detail.
export type ApiErrorPayload = {
  detail?: unknown
  message?: string
  [key: string]: unknown
}

// 前端统一抛出的 API 错误类型。
// Unified API error type thrown by this frontend client.
export class ApiError extends Error {
  // HTTP 状态码。网络错误或超时时为 0。
  // HTTP status code. Network errors and timeouts use 0.
  readonly status: number

  // 后端返回的错误内容；如果没有响应体则为 null。
  // Error payload returned by the backend; null when no response body exists.
  readonly payload: ApiErrorPayload | string | null

  constructor(message: string, status: number, payload: ApiErrorPayload | string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

// GET /airfoils 的响应：文件名列表。
// Response from GET /airfoils: list of file names.
export type FileNameListResponse = {
  file_names: string[]
}

// 状态类接口的响应，例如插入成功后返回 { status: "ok" }。
// Response for status endpoints, for example { status: "ok" } after insert.
export type StatusResponse = {
  status: string
}

// 数值范围筛选：[最小值, 最大值]；null 表示该边界不限制。
// Numeric range filter: [min, max]; null means that side is unbounded.
export type RangeFilter = [number | null, number | null]

// 几何筛选项：范围、布尔值或 null。
// Geometry filter item: range, boolean, or null.
export type GeometryFilterValue = RangeFilter | boolean | null

// POST /airfoils/filter/geometry 的请求体。
// Request body for POST /airfoils/filter/geometry.
export type GeometryFilterRequest = {
  geo_filter: GeometryFilterValue[]
}

// 气动筛选项目前是范围或 null。
// Aerodynamic filter item is currently a range or null.
export type AeroFilterValue = RangeFilter | null

// POST /airfoils/filter/aero 的请求体。
// Request body for POST /airfoils/filter/aero.
export type AeroFilterRequest = {
  reynolds_number: number
  aero_filter: AeroFilterValue[]
}

// POST /airfoils/metadata 的请求体。
// Request body for POST /airfoils/metadata.
export type MetadataRequest = {
  file_names: string[]
}

// 后端 GeometryMetadata 的前端类型镜像。
// Frontend mirror of backend GeometryMetadata.
export type GeometryMetadata = {
  max_thickness?: number | null
  x_max_thickness?: number | null
  max_camber?: number | null
  x_max_camber?: number | null
  area_2d?: number | null
  leading_edge_radius?: number | null
  trailing_edge_thickness?: number | null
  trailing_edge_angle_deg?: number | null
  point_count_raw?: number | null
  point_count_clean?: number | null
  upper_point_count?: number | null
  lower_point_count?: number | null
  x_min?: number | null
  x_max?: number | null
  y_min?: number | null
  y_max?: number | null
  chord_raw?: number | null
  is_normalized?: boolean | null
  te_x_gap?: number | null
  te_y_gap?: number | null
  is_closed_curve?: boolean | null
  is_multi_element?: boolean | null
}

// 后端 AerodynamicMetadata 的前端类型镜像。
// Frontend mirror of backend AerodynamicMetadata.
export type AerodynamicMetadata = {
  reynolds_number?: number | null
  mach_number?: number | null
  n_crit?: number | null
  alpha_min_deg?: number | null
  alpha_max_deg?: number | null
  alpha_step_deg?: number | null
  cl_alpha?: number | null
  cl_max?: number | null
  cl_cd_max?: number | null
  cd_min?: number | null
  cm_0?: number | null
  alpha_stall_deg?: number | null
}

// 后端 FoilMetadata 的前端类型镜像。
// Frontend mirror of backend FoilMetadata.
export type FoilMetadata = {
  file_name: string
  path: string
  family_series?: string | null
  source?: string
  quality_flags?: string[]
  is_modified?: boolean
  is_smooth?: boolean
  is_naca?: boolean
  naca_code?: string | null
  schema_version?: string
  generated_at_utc?: string
  updated_at_utc?: string
  xfoil_version?: string | null
  geometry_metadata?: GeometryMetadata
  aerodynamic_metadata?: AerodynamicMetadata[]
  [key: string]: unknown
}

// metadata 接口可能返回单个 metadata，也可能返回按文件名分组的对象。
// The metadata endpoint may return one metadata item or a map keyed by file name.
export type MetadataResponse = FoilMetadata | Record<string, FoilMetadata>

export type FileCatalogListResponse = {
  file_catalogs: {
    file_name: string
    file_path: string
    family_series?: string | null
    max_thickness?: number | null
    cl_cd_max?: number | null
  }[]
}

// request() 的内部配置。
// Internal options for request().
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  headers?: HeadersInit
}

// --------- Internal Helper Functions ---------

// 拼出完整 API URL，并容忍调用方传入带或不带 / 的 path。
// Build a full API URL and accept paths with or without a leading slash.
function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${BACKEND_URL}${normalizedPath}`
}

// 根据响应类型解析返回体：JSON 就 parse JSON，否则按文本处理。
// Parse the response body by content type: JSON as JSON, otherwise text.
async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (response.status === 204) return null
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

// 统一 fetch 封装：处理 URL、JSON、超时、取消、错误转换。
// Unified fetch wrapper: handles URL, JSON, timeout, abort, and error conversion.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // 如果外部传入 signal，也把它连接到内部 controller。
  // If the caller passes a signal, wire it into this internal controller.
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    // body 存在时自动按 JSON 发送；GET 请求默认没有 body。
    // When body exists, send it as JSON automatically; GET has no body by default.
    const response = await fetch(buildUrl(path), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })

    const payload = await parseResponse(response)

    // 非 2xx 响应统一抛 ApiError，保留后端 payload 方便 UI 展示。
    // Non-2xx responses throw ApiError and preserve backend payload for UI display.
    if (!response.ok) {
      throw new ApiError(
        `Backend request failed: ${response.status} ${response.statusText}`,
        response.status,
        payload as ApiErrorPayload | string | null,
      )
    }

    return payload as T
  } catch (error) {
    // ApiError 已经是我们自己的错误类型，直接继续抛出。
    // ApiError is already our own error type, so rethrow it directly.
    if (error instanceof ApiError) throw error

    // AbortError 可能来自超时，也可能来自调用方主动取消。
    // AbortError can come from timeout or caller-initiated cancellation.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Backend request timed out or was aborted', 0, null)
    }

    // 网络错误、CORS 错误等没有 HTTP status，这里统一 status = 0。
    // Network errors, CORS errors, etc. have no HTTP status, so use status = 0.
    throw new ApiError(error instanceof Error ? error.message : 'Backend request failed', 0, null)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

// --------- Exported API Functions ---------

// API集中出口。
// Central API entry point
export const backendApi = {
  // 检查后端是否在线。
  // Check whether the backend is online.
  health(signal?: AbortSignal) {
    return request<{ status: string }>('/health', { signal })
  },

  // 获取所有翼型文件名。
  // Get all airfoil file names.
  getAirfoilFileNames(signal?: AbortSignal) {
    return request<FileNameListResponse>('/airfoils', { signal })
  },

  // 按几何 metadata 筛选翼型文件名。
  // Filter airfoil file names by geometry metadata.
  filterAirfoilsByGeometry(geoFilter: GeometryFilterValue[], signal?: AbortSignal) {
    const body: GeometryFilterRequest = { geo_filter: geoFilter }
    return request<FileNameListResponse>('/airfoils/filter/geometry', {
      method: 'POST',
      body,
      signal,
    })
  },

  // 按指定雷诺数和气动 metadata 筛选翼型文件名。
  // Filter airfoil file names by Reynolds number and aerodynamic metadata.
  filterAirfoilsByAero(
    reynoldsNumber: number,
    aeroFilter: AeroFilterValue[],
    signal?: AbortSignal,
  ) {
    const body: AeroFilterRequest = {
      reynolds_number: reynoldsNumber,
      aero_filter: aeroFilter,
    }

    return request<FileNameListResponse>('/airfoils/filter/aero', {
      method: 'POST',
      body,
      signal,
    })
  },

  // 根据文件名读取 metadata。
  // Read metadata by file names.
  getMetadata(fileNames: string[], signal?: AbortSignal) {
    const body: MetadataRequest = { file_names: fileNames }
    return request<MetadataResponse>('/airfoils/metadata', {
      method: 'POST',
      body,
      signal,
    })
  },

  // 读取全量轻量翼型 catalog。
  // Read the full lightweight airfoil catalog.
  getFullCatalogs(reynoldsNumber: number, signal?: AbortSignal) {
    const query = new URLSearchParams({
      reynolds_number: String(reynoldsNumber),
    })
    return request<FileCatalogListResponse>(`/airfoils/catalog?${query.toString()}`, {
      method: 'GET',
      signal,
    })
  },

  // 根据文件名读取几何文件。
  // Read geometry files by file names.
  getGeometryFiles(fileNames: string[], signal?: AbortSignal) {
    return request<Record<string, string>>('/airfoils/geometry/files', {
      method: 'POST',
      body: { file_names: fileNames },
      signal,
    })
  },

  // 插入一条翼型 metadata。
  // Insert one airfoil metadata record.
  insertMetadata(metadata: FoilMetadata, signal?: AbortSignal) {
    return request<StatusResponse>('/airfoils/metadata/insert', {
      method: 'POST',
      body: { metadata },
      signal,
    })
  },
}
