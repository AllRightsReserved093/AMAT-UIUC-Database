/*
文件功能：提供前端访问 FastAPI 后端的通用 HTTP 客户端、URL 配置和统一错误类型。
File purpose: Provides the shared HTTP client, URL config, and unified error type for FastAPI backend access.
*/

// 默认后端地址。开发时 FastAPI 通常运行在 8000 端口。
// Default backend URL. FastAPI usually runs on port 8000 in development.
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000'

// 单次请求超时时间，单位毫秒。
// Timeout for each request, in milliseconds.
const REQUEST_TIMEOUT_MS = 15000

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

// request() 的内部配置。
// Internal options for request().
export type RequestOptions = {
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

// --------- Public Request Entry ---------

// 统一 fetch 封装：处理 URL、JSON、超时、取消、错误转换。
// Unified fetch wrapper: handles URL, JSON, timeout, abort, and error conversion.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
