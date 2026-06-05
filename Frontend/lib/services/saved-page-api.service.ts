import type { BackendSavedPageDto, BackendSavedPageUpsertPayload, SavedPage } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

export type SavedPageInput = {
  titulo: string
  url: string
  selector?: string | null
}

function normalizeSavedPage(dto: BackendSavedPageDto): SavedPage {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const titulo = typeof dto.title === "string" && dto.title.trim().length > 0 ? dto.title.trim() : `Página ${id}`
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
  const response = await backendRequest<BackendSavedPageDto[]>(backendRoutes.pages.collection)
  return Array.isArray(response) ? response.map(normalizeSavedPage) : []
}

export async function createSavedPage(payload: SavedPageInput): Promise<SavedPage> {
  const response = await backendRequest<BackendSavedPageDto>(backendRoutes.pages.collection, {
    method: "POST",
    body: {
      title: payload.titulo,
      url: payload.url,
      selector: payload.selector,
    } satisfies BackendSavedPageUpsertPayload,
  })
  return normalizeSavedPage(response)
}

export async function updateSavedPage(pageId: number, payload: SavedPageInput): Promise<SavedPage> {
  const response = await backendRequest<BackendSavedPageDto>(backendRoutes.pages.byId(pageId), {
    method: "PUT",
    body: {
      title: payload.titulo,
      url: payload.url,
      selector: payload.selector,
    } satisfies BackendSavedPageUpsertPayload,
  })
  return normalizeSavedPage(response)
}

export async function deleteSavedPage(pageId: number): Promise<void> {
  await backendRequest<void>(backendRoutes.pages.byId(pageId), {
    method: "DELETE",
  })
}
