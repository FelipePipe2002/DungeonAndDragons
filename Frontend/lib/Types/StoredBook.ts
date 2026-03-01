export interface StoredBook {
  id: number
  filename: string
  contentType: string
  byteSize: number
  downloadUrl: string
  createdAt?: string
  updatedAt?: string
}
