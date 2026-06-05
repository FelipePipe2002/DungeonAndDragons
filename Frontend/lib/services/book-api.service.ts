import type {
  BackendBookDto as BookDto,
  BackendBookUploadSessionDto as BookUploadSessionDto,
  StoredBook,
} from "@/lib/types"
import {
  backendRequest,
  backendRequestBlob,
  buildBackendApiUrl,
  readBackendXsrfToken,
  BackendApiError,
} from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

export type BookUploadStatus = "awaiting_upload" | "processing" | "completed" | "failed"

export type BookUploadProgress = {
  fileName: string
  frontendPercent: number
  frontendUploadedBytes: number
  frontendTotalBytes: number
  backendStatus: BookUploadStatus
  backendPercent: number
  backendProcessedBytes: number
  backendTotalBytes: number | null
  backendErrorMessage?: string
}

export type BookUploadSession = {
  sessionId: string
  status: BookUploadStatus
  progressPercent: number
  processedBytes: number
  totalBytes: number | null
  errorMessage?: string
}

type UploadBookOptions = {
  onProgress?: (progress: BookUploadProgress) => void
}

function toStoredBook(dto: BookDto): StoredBook {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const fallbackPath = backendRoutes.books.byId(id)
  const downloadPath =
    typeof dto.downloadUrl === "string" && dto.downloadUrl.trim().length > 0
      ? dto.downloadUrl.trim()
      : fallbackPath

  return {
    id,
    filename: typeof dto.filename === "string" && dto.filename.trim().length > 0 ? dto.filename : `libro-${id}`,
    contentType:
      typeof dto.contentType === "string" && dto.contentType.trim().length > 0
        ? dto.contentType
        : "application/octet-stream",
    byteSize:
      typeof dto.byteSize === "number" && Number.isFinite(dto.byteSize) && dto.byteSize >= 0
        ? dto.byteSize
        : 0,
    downloadUrl: downloadPath.startsWith("/") ? buildBackendApiUrl(downloadPath) : downloadPath,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function normalizeUploadStatus(value: unknown): BookUploadStatus {
  switch (value) {
    case "processing":
    case "completed":
    case "failed":
      return value
    default:
      return "awaiting_upload"
  }
}

function normalizeUploadSession(dto: BookUploadSessionDto | null | undefined): BookUploadSession {
  const sessionId = typeof dto?.sessionId === "string" ? dto.sessionId.trim() : ""
  return {
    sessionId,
    status: normalizeUploadStatus(dto?.status),
    progressPercent:
      typeof dto?.progressPercent === "number" && Number.isFinite(dto.progressPercent)
        ? Math.max(0, Math.min(100, Math.round(dto.progressPercent)))
        : 0,
    processedBytes:
      typeof dto?.processedBytes === "number" && Number.isFinite(dto.processedBytes) && dto.processedBytes >= 0
        ? dto.processedBytes
        : 0,
    totalBytes:
      typeof dto?.totalBytes === "number" && Number.isFinite(dto.totalBytes) && dto.totalBytes >= 0
        ? dto.totalBytes
        : null,
    errorMessage:
      typeof dto?.errorMessage === "string" && dto.errorMessage.trim().length > 0 ? dto.errorMessage.trim() : undefined,
  }
}

function buildUploadProgress(
  file: File,
  frontendUploadedBytes: number,
  backendSession: ReturnType<typeof normalizeUploadSession> | null,
): BookUploadProgress {
  const frontendTotalBytes = Math.max(file.size, 0)
  const safeFrontendUploadedBytes = Math.max(0, Math.min(frontendUploadedBytes, frontendTotalBytes))

  return {
    fileName: file.name,
    frontendPercent:
      frontendTotalBytes > 0 ? Math.max(0, Math.min(100, Math.round((safeFrontendUploadedBytes * 100) / frontendTotalBytes))) : 0,
    frontendUploadedBytes: safeFrontendUploadedBytes,
    frontendTotalBytes,
    backendStatus: backendSession?.status ?? "awaiting_upload",
    backendPercent: backendSession?.progressPercent ?? 0,
    backendProcessedBytes: backendSession?.processedBytes ?? 0,
    backendTotalBytes: backendSession?.totalBytes ?? (frontendTotalBytes || null),
    backendErrorMessage: backendSession?.errorMessage,
  }
}

function extractUploadErrorMessage(payload: unknown, status: number) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim()
  }

  if (payload && typeof payload === "object") {
    const message = (payload as Record<string, unknown>).message
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim()
    }
  }

  return status === 401 || status === 403 ? "No autorizado. Inicia sesion nuevamente." : `Error HTTP ${status}`
}

export async function fetchBooks(): Promise<StoredBook[]> {
  const response = await backendRequest<BookDto[]>(backendRoutes.books.collection)
  return Array.isArray(response) ? response.map(toStoredBook) : []
}

export async function createBookUploadSession(): Promise<BookUploadSession> {
  return normalizeUploadSession(
    await backendRequest<BookUploadSessionDto>(backendRoutes.books.uploads, {
      method: "POST",
    }),
  )
}

export async function fetchBookUploadSession(sessionId: string): Promise<BookUploadSession> {
  return normalizeUploadSession(
    await backendRequest<BookUploadSessionDto>(backendRoutes.books.uploadSession(sessionId)),
  )
}

export async function fetchBookBlob(bookId: number): Promise<Blob> {
  return backendRequestBlob(backendRoutes.books.byId(bookId))
}

export function buildBookUrl(bookId: number) {
  return buildBackendApiUrl(backendRoutes.books.byId(bookId))
}

export async function uploadBook(file: File, options: UploadBookOptions = {}): Promise<StoredBook> {
  const createdSession = await createBookUploadSession()

  if (!createdSession.sessionId) {
    throw new Error("No se pudo iniciar la sesion de subida del libro.")
  }

  const emitProgress = (frontendUploadedBytes: number, backendSession: ReturnType<typeof normalizeUploadSession> | null) => {
    options.onProgress?.(buildUploadProgress(file, frontendUploadedBytes, backendSession))
  }

  let frontendUploadedBytes = 0
  let backendSession: ReturnType<typeof normalizeUploadSession> | null = createdSession
  let isPollingActive = true

  emitProgress(frontendUploadedBytes, backendSession)

  const pollBackendProgress = (async () => {
    while (isPollingActive) {
      try {
        const nextBackendSession = await fetchBookUploadSession(createdSession.sessionId)
        backendSession = nextBackendSession
        emitProgress(frontendUploadedBytes, backendSession)

        if (nextBackendSession.status === "completed" || nextBackendSession.status === "failed") {
          break
        }
      } catch {
        break
      }

      await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
  })()

  try {
    const uploadedBook = await new Promise<StoredBook>((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open("POST", buildBackendApiUrl(backendRoutes.books.uploadWithSession(createdSession.sessionId)))
      request.withCredentials = true
      request.responseType = "text"
      request.setRequestHeader("Accept", "application/json")

      const xsrfToken = readBackendXsrfToken()
      if (xsrfToken) {
        request.setRequestHeader("X-XSRF-TOKEN", xsrfToken)
      }

      request.upload.addEventListener("progress", (event) => {
        const totalBytes = event.lengthComputable && event.total > 0 ? event.total : file.size
        frontendUploadedBytes = totalBytes > 0 ? Math.min(event.loaded, totalBytes) : event.loaded
        emitProgress(frontendUploadedBytes, backendSession)
      })

      request.addEventListener("load", () => {
        const rawResponse = typeof request.responseText === "string" ? request.responseText : ""
        let parsedPayload: unknown = null

        if (rawResponse.trim().length > 0) {
          try {
            parsedPayload = JSON.parse(rawResponse)
          } catch {
            parsedPayload = rawResponse
          }
        }

        if (request.status < 200 || request.status >= 300) {
          reject(new BackendApiError(extractUploadErrorMessage(parsedPayload, request.status), request.status, parsedPayload))
          return
        }

        frontendUploadedBytes = file.size
        backendSession = {
          sessionId: createdSession.sessionId,
          status: "completed",
          progressPercent: 100,
          processedBytes: file.size,
          totalBytes: file.size,
          errorMessage: undefined,
        }
        emitProgress(frontendUploadedBytes, backendSession)
        resolve(toStoredBook(parsedPayload as BookDto))
      })

      request.addEventListener("error", () => {
        reject(new Error("No se pudo conectar con el backend."))
      })

      request.addEventListener("abort", () => {
        reject(new Error("La subida del libro fue cancelada."))
      })

      const formData = new FormData()
      formData.append("file", file)
      request.send(formData)
    })

    return uploadedBook
  } catch (error) {
    if (backendSession?.status !== "failed") {
      try {
        backendSession = await fetchBookUploadSession(createdSession.sessionId)
        if (backendSession.status !== "failed" && backendSession.status !== "completed") {
          backendSession = {
            ...backendSession,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "No se pudo subir el libro.",
          }
        }
      } catch {
        backendSession = {
          ...createdSession,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "No se pudo subir el libro.",
        }
      }
    }
    emitProgress(frontendUploadedBytes, backendSession)
    throw error
  } finally {
    isPollingActive = false
    await pollBackendProgress.catch(() => undefined)
  }
}

export async function deleteBook(bookId: number): Promise<void> {
  await backendRequest<void>(backendRoutes.books.byId(bookId), {
    method: "DELETE",
  })
}
