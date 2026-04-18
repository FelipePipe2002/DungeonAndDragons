import type { SavedPage } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"

type SavedPageDto = {
  id?: number | null
  titulo?: string | null
  url?: string | null
  selector?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type SavedPageInput = {
  titulo: string
  url: string
  selector?: string | null
}

function normalizeSavedPage(dto: SavedPageDto): SavedPage {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const titulo = typeof dto.titulo === "string" && dto.titulo.trim().length > 0 ? dto.titulo.trim() : `Página ${id}`
  const url = typeof dto.url === "string" && dto.url.trim().length > 0 ? dto.url.trim() : ""
  const selector = typeof dto.selector === "string" && dto.selector.trim().length > 0 ? dto.selector.trim() : undefined

  return {
    id,
    titulo,
    url,
    selector,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

export async function fetchSavedPages(): Promise<SavedPage[]> {
  const response = await backendRequest<SavedPageDto[]>("/v1/pages")
  return Array.isArray(response) ? response.map(normalizeSavedPage) : []
}

export async function createSavedPage(payload: SavedPageInput): Promise<SavedPage> {
  const response = await backendRequest<SavedPageDto>("/v1/pages", {
    method: "POST",
    body: payload,
  })
  return normalizeSavedPage(response)
}

export async function updateSavedPage(pageId: number, payload: SavedPageInput): Promise<SavedPage> {
  const response = await backendRequest<SavedPageDto>(`/v1/pages/${pageId}`, {
    method: "PUT",
    body: payload,
  })
  return normalizeSavedPage(response)
}

export async function deleteSavedPage(pageId: number): Promise<void> {
  await backendRequest<void>(`/v1/pages/${pageId}`, {
    method: "DELETE",
  })
}
