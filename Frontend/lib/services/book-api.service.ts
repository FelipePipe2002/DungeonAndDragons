import type { StoredBook } from "@/lib/types"
import { backendRequest, buildBackendApiUrl } from "@/lib/services/backend-api.service"

type BookDto = {
  id: number
  filename?: string | null
  contentType?: string | null
  byteSize?: number | null
  downloadUrl?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

function toStoredBook(dto: BookDto): StoredBook {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const fallbackPath = `/v1/books/${id}`
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

export async function fetchBooks(): Promise<StoredBook[]> {
  const response = await backendRequest<BookDto[]>("/v1/books")
  return Array.isArray(response) ? response.map(toStoredBook) : []
}

export async function uploadBook(file: File): Promise<StoredBook> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await backendRequest<BookDto>("/v1/books", {
    method: "POST",
    body: formData,
  })

  return toStoredBook(response)
}

export async function deleteBook(bookId: number): Promise<void> {
  await backendRequest<void>(`/v1/books/${bookId}`, {
    method: "DELETE",
  })
}
