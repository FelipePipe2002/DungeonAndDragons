import type { MediaAssetKind, MediaAssetMetadata } from "@/lib/types"
import { backendRequest, buildBackendApiUrl } from "@/lib/services/backend-api.service"

type MediaAssetMetadataDto = {
  id: number
  kind?: string | null
  filename?: string | null
  contentType?: string | null
  byteSize?: number | null
  downloadUrl?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

function isMediaAssetKind(value: unknown): value is MediaAssetKind {
  return value === "image" || value === "json" || value === "book" || value === "binary"
}

function toMediaAssetMetadata(dto: MediaAssetMetadataDto): MediaAssetMetadata {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const fallbackPath = `/v1/assets/${id}`
  const downloadPath =
    typeof dto.downloadUrl === "string" && dto.downloadUrl.trim().length > 0
      ? dto.downloadUrl.trim()
      : fallbackPath

  return {
    id,
    kind: isMediaAssetKind(dto.kind) ? dto.kind : "binary",
    filename: typeof dto.filename === "string" ? dto.filename : `asset-${id}`,
    contentType: typeof dto.contentType === "string" ? dto.contentType : "application/octet-stream",
    byteSize:
      typeof dto.byteSize === "number" && Number.isFinite(dto.byteSize) && dto.byteSize >= 0
        ? dto.byteSize
        : 0,
    downloadUrl: downloadPath.startsWith("/") ? buildBackendApiUrl(downloadPath) : downloadPath,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function toUploadFile(file: File | Blob, filename?: string) {
  if (file instanceof File) {
    return file
  }

  return new File([file], filename?.trim() || "asset", {
    type: file.type || "application/octet-stream",
  })
}

export async function uploadAsset(
  file: File | Blob,
  options?: { filename?: string },
): Promise<MediaAssetMetadata> {
  const formData = new FormData()
  const uploadFile = toUploadFile(file, options?.filename)
  formData.append("file", uploadFile)

  const response = await backendRequest<MediaAssetMetadataDto>("/v1/assets", {
    method: "POST",
    body: formData,
  })

  return toMediaAssetMetadata(response)
}

export async function uploadJsonAsset(jsonText: string, filename: string): Promise<MediaAssetMetadata> {
  const normalizedFileName = filename.trim() || "map.json"
  const blob = new Blob([jsonText], { type: "application/json" })
  return uploadAsset(blob, { filename: normalizedFileName })
}

export async function fetchAssetMetadata(assetId: number): Promise<MediaAssetMetadata> {
  const response = await backendRequest<MediaAssetMetadataDto>(`/v1/assets/${assetId}/metadata`)
  return toMediaAssetMetadata(response)
}

export async function deleteAsset(assetId: number): Promise<void> {
  await backendRequest<void>(`/v1/assets/${assetId}`, {
    method: "DELETE",
  })
}

export function getBackendAssetIdFromUrl(url: string | null | undefined) {
  const normalizedUrl = url?.trim()
  if (!normalizedUrl) return null

  const matchAssetPath = (value: string) => {
    const match = value.match(/\/v1\/assets\/(\d+)(?:\D|$)/)
    if (!match) return null
    const assetId = Number.parseInt(match[1], 10)
    return Number.isFinite(assetId) && assetId > 0 ? assetId : null
  }

  if (normalizedUrl.startsWith("/api/v1/assets/") || normalizedUrl.startsWith("/v1/assets/")) {
    return matchAssetPath(normalizedUrl)
  }

  try {
    const parsed = new URL(normalizedUrl)
    return matchAssetPath(parsed.pathname)
  } catch {
    return null
  }
}

function isBackendAssetUrl(url: string) {
  const normalizedUrl = url.trim()
  if (!normalizedUrl) return false

  if (getBackendAssetIdFromUrl(normalizedUrl) !== null && normalizedUrl.startsWith("/api/v1/assets/")) {
    return true
  }

  return normalizedUrl.startsWith(buildBackendApiUrl("/v1/assets/"))
}

export async function fetchJsonAsset<T>(url: string): Promise<T> {
  const normalizedUrl = url.trim()

  const response = await fetch(normalizedUrl, {
    credentials: isBackendAssetUrl(normalizedUrl) ? "include" : "same-origin",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(
      `Failed to load map JSON (${normalizedUrl}): ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as T
}

export function buildAssetUrl(assetId: number) {
  return buildBackendApiUrl(`/v1/assets/${assetId}`)
}
