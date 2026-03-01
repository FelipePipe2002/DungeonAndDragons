export type MediaAssetId = number

export type MediaAssetKind = "image" | "json" | "book" | "binary"

export interface MediaAssetMetadata {
  id: MediaAssetId
  kind: MediaAssetKind
  filename: string
  contentType: string
  byteSize: number
  downloadUrl: string
  createdAt?: string
  updatedAt?: string
}
