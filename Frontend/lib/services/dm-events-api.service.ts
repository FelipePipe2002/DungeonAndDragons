import type { DmEvent } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"

type DmEventDto = {
  id: number
  titulo?: string | null
  descripcion?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type DmEventInput = {
  titulo?: string
  descripcion: string
}

function normalizeDmEvent(dto: DmEventDto): DmEvent {
  return {
    id: dto.id,
    titulo: typeof dto.titulo === "string" && dto.titulo.trim().length > 0 ? dto.titulo : undefined,
    descripcion: typeof dto.descripcion === "string" ? dto.descripcion : "",
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

export async function fetchDmEvents(): Promise<DmEvent[]> {
  const response = await backendRequest<DmEventDto[]>("/v1/dm-events")
  return Array.isArray(response) ? response.map(normalizeDmEvent) : []
}

export async function createDmEvent(payload: DmEventInput): Promise<DmEvent> {
  const response = await backendRequest<DmEventDto>("/v1/dm-events", {
    method: "POST",
    body: {
      titulo: payload.titulo?.trim() || null,
      descripcion: payload.descripcion,
    },
  })

  return normalizeDmEvent(response)
}

export async function deleteDmEvent(eventId: number): Promise<void> {
  await backendRequest<void>(`/v1/dm-events/${eventId}`, {
    method: "DELETE",
  })
}
