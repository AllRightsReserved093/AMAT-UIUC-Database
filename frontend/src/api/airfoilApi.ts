/*
文件功能：提供翼型数据库相关的前端 API 类型和请求函数。
File purpose: Provides frontend API types and request functions for the airfoil database.
*/

import { request } from './httpClient'

// --------- Common Response Types ---------

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

// --------- Filter Types ---------

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

// --------- Metadata Types ---------

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

// --------- Catalog Types ---------

export type FileCatalogListResponse = {
  file_catalogs: {
    file_name: string
    file_path: string
    family_series?: string | null
    max_thickness?: number | null
    cl_cd_max?: number | null
  }[]
}

// --------- API Functions ---------

export const airfoilApi = {
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
  filterAirfoilsByAero(reynoldsNumber: number, aeroFilter: AeroFilterValue[], signal?: AbortSignal) {
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
