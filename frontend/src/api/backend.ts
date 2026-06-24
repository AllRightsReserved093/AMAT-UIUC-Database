/*
文件功能：保留旧的后端 API 统一入口，并聚合拆分后的 HTTP、翼型和节点图 API 模块。
File purpose: Keeps the legacy unified backend API entry and aggregates the split HTTP, airfoil, and node-graph API modules.
*/

import { airfoilApi } from './airfoilApi'
import { request } from './httpClient'
import { nodeGraphApi } from './nodeGraphApi'

export {
  airfoilApi,
  type AerodynamicMetadata,
  type AeroFilterRequest,
  type AeroFilterValue,
  type FileCatalogListResponse,
  type FileNameListResponse,
  type FoilMetadata,
  type GeometryFilterRequest,
  type GeometryFilterValue,
  type GeometryMetadata,
  type MetadataRequest,
  type MetadataResponse,
  type RangeFilter,
  type StatusResponse,
} from './airfoilApi'

export {
  ApiError,
  BACKEND_URL,
  type ApiErrorPayload,
  type JsonPrimitive,
  type JsonValue,
  type RequestOptions,
} from './httpClient'

export {
  nodeGraphApi,
  type NodeGraphExecutionDiagnostic,
  type NodeGraphExecutionEdge,
  type NodeGraphExecutionGraph,
  type NodeGraphExecutionNode,
  type NodeGraphExecutionOutlet,
  type NodeGraphExecutionRequest,
  type NodeGraphExecutionResponse,
  type NodeGraphOutletResult,
  type NodeGraphPort,
  type NodeGraphPortReference,
} from './nodeGraphApi'

export type HealthResponse = {
  status: string
}

// API 集中兼容出口。新代码可以按领域直接使用 airfoilApi 或 nodeGraphApi。
// Central compatibility API entry. New code may import airfoilApi or nodeGraphApi by domain.
export const backendApi = {
  // 检查后端是否在线。
  // Check whether the backend is online.
  health(signal?: AbortSignal) {
    return request<HealthResponse>('/health', { signal })
  },

  ...airfoilApi,
  ...nodeGraphApi,
}
