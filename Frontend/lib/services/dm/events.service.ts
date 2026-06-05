import type { BackendDmEventDto, BackendDmEventUpsertPayload, DmEvent } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

export type DmEventInput = {
  titulo?: string
  descripcion: string
}

function normalizeDmEvent(dto: BackendDmEventDto): DmEvent {
  return {
    id: dto.id,
    titulo: typeof dto.title === "string" && dto.title.trim().length > 0 ? dto.title : undefined,
    descripcion: typeof dto.description === "string" ? dto.description : "",
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

export async function fetchDmEvents(): Promise<DmEvent[]> {
  const response = await backendRequest<BackendDmEventDto[]>(backendRoutes.dm.events)
  return Array.isArray(response) ? response.map(normalizeDmEvent) : []
}

export async function createDmEvent(payload: DmEventInput): Promise<DmEvent> {
  const response = await backendRequest<BackendDmEventDto>(backendRoutes.dm.events, {
    method: "POST",
    body: {
      title: payload.titulo?.trim() || null,
      description: payload.descripcion,
    } satisfies BackendDmEventUpsertPayload,
  })

  return normalizeDmEvent(response)
}

export async function deleteDmEvent(eventId: number): Promise<void> {
  await backendRequest<void>(backendRoutes.dm.eventById(eventId), {
    method: "DELETE",
  })
}
