const DEV_API_BASE_PATH = "http://localhost:8086/api"
const DEV_SITE_ORIGIN = "http://localhost:3000"
const PROD_SITE_ORIGIN = "https://dnd.felipebertoldi.com.ar"
const LOCAL_BACKEND_PORT = "8086"
const XSRF_HEADER_NAME = "X-XSRF-TOKEN"
const XSRF_STORAGE_KEY = "dnd_xsrf_token"

export class BackendApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "BackendApiError"
    this.status = status
    this.payload = payload
  }
}

type BackendRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  skipAuthRedirect?: boolean
}

function resolveAppMode() {
  return process.env.NEXT_PUBLIC_APP_MODE?.trim().toLowerCase() === "production"
    ? "production"
    : "development"
}

function resolveSiteOrigin() {
  const configuredSiteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim()
  if (configuredSiteOrigin) {
    return configuredSiteOrigin.replace(/\/+$/, "")
  }

  return resolveAppMode() === "production" ? PROD_SITE_ORIGIN : DEV_SITE_ORIGIN
}

function resolveApiBasePath() {
  const configuredBasePath = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  const appMode = resolveAppMode()

  if (configuredBasePath && configuredBasePath.length > 0) {
    return configuredBasePath.replace(/\/+$/, "")
  }

  if (appMode === "production") {
    return `${resolveSiteOrigin()}/api`
  }

  if (isBrowser()) {
    const hostname = window.location.hostname.trim().toLowerCase()
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
      return `${window.location.protocol}//${hostname}:${LOCAL_BACKEND_PORT}/api`
    }

    // In deployed environments the backend lives behind the same public origin under /api.
    // Using an absolute URL here can force cross-origin preflights and break authenticated writes.
    return "/api"
  }

  return DEV_API_BASE_PATH
}

export function buildBackendApiUrl(path: string) {
  if (!path.startsWith("/")) {
    throw new Error(`La ruta de backend debe comenzar con '/'. Recibido: ${path}`)
  }

  return `${resolveApiBasePath()}${path}`
}

function redirectToLogin() {
  if (!isBrowser()) return
  if (window.location.pathname === "/login") return

  const nextPath = `${window.location.pathname}${window.location.search}`
  const loginUrl = `/login?next=${encodeURIComponent(nextPath)}`
  window.location.replace(loginUrl)
}

function isBrowser() {
  return typeof window !== "undefined"
}

function readStoredXsrfToken() {
  if (!isBrowser()) return null
  return window.localStorage.getItem(XSRF_STORAGE_KEY)
}

export function readBackendXsrfToken() {
  return readStoredXsrfToken()
}

function writeStoredXsrfToken(token: string | null) {
  if (!isBrowser()) return
  if (!token) {
    window.localStorage.removeItem(XSRF_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(XSRF_STORAGE_KEY, token)
}

function looksLikeHtmlDocument(value: string) {
  const normalized = value.trimStart().slice(0, 256).toLowerCase()
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html")
}

function looksLikeAuthFailureMessage(value: string) {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes("invalid token") ||
    normalized.includes("token invalido") ||
    normalized.includes("token inválido") ||
    normalized.includes("no autorizado")
  )
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string") {
    const trimmed = payload.trim()
    if (trimmed.length === 0 || looksLikeHtmlDocument(trimmed)) {
      return fallback
    }
    return trimmed
  }

  if (typeof payload === "object" && payload !== null) {
    const maybeMessage = (payload as Record<string, unknown>).message
    if (typeof maybeMessage === "string") {
      const trimmed = maybeMessage.trim()
      if (trimmed.length > 0 && !looksLikeHtmlDocument(trimmed)) {
        return trimmed
      }
    }
  }

  return fallback
}

function createBackendRequestInit(options: BackendRequestOptions = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  const xsrfToken = readStoredXsrfToken()
  if (xsrfToken && !headers.has(XSRF_HEADER_NAME)) {
    headers.set(XSRF_HEADER_NAME, xsrfToken)
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  const isBlob = typeof Blob !== "undefined" && options.body instanceof Blob
  const hasBody = options.body !== undefined

  if (hasBody && !headers.has("Content-Type") && !isFormData && !isBlob) {
    headers.set("Content-Type", "application/json")
  }

  const body =
    !hasBody
      ? undefined
      : isFormData || isBlob || typeof options.body === "string"
        ? (options.body as BodyInit)
        : JSON.stringify(options.body)

  return {
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include" as const,
    cache: "no-store" as const,
    signal: options.signal,
  }
}

async function throwBackendResponseError(response: Response, options: BackendRequestOptions) {
  const payload = await parseResponsePayload(response)
  const isUnauthorizedStatus = response.status === 401 || response.status === 403
  const fallback =
    isUnauthorizedStatus
      ? "No autorizado. Inicia sesion nuevamente."
      : response.status === 404
        ? "Endpoint no encontrado. Verifica la URL del backend y que este levantado."
        : `Error HTTP ${response.status}`
  const errorMessage = extractErrorMessage(payload, fallback)
  const shouldRedirectToLogin =
    (isUnauthorizedStatus || looksLikeAuthFailureMessage(errorMessage)) && !options.skipAuthRedirect

  if (shouldRedirectToLogin) {
    clearBackendXsrfToken()
    redirectToLogin()
  }

  throw new BackendApiError(errorMessage, response.status, payload)
}

async function performBackendRequest(path: string, options: BackendRequestOptions = {}) {
  if (!path.startsWith("/")) {
    throw new Error(`La ruta de backend debe comenzar con '/'. Recibido: ${path}`)
  }

  const response = await fetch(`${resolveApiBasePath()}${path}`, createBackendRequestInit(options))

  const responseXsrfToken = response.headers.get(XSRF_HEADER_NAME)
  if (responseXsrfToken) {
    writeStoredXsrfToken(responseXsrfToken)
  }

  if (!response.ok) {
    await throwBackendResponseError(response, options)
  }

  return response
}

async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    return await response.text()
  } catch {
    return null
  }
}

export function getBackendErrorMessage(error: unknown, fallback = "No se pudo conectar con el backend.") {
  if (error instanceof BackendApiError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  const response = await performBackendRequest(path, options)

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await parseResponsePayload(response)

  return payload as T
}

export async function backendRequestBlob(path: string, options: BackendRequestOptions = {}): Promise<Blob> {
  const response = await performBackendRequest(path, options)
  return response.blob()
}

export function clearBackendXsrfToken() {
  writeStoredXsrfToken(null)
}
