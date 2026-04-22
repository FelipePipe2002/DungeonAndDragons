import { backendRequest } from "@/lib/services/backend-api.service"
import type { Subdivision } from "@/lib/types"

type SubdivisionApiDto = {
  id: number
  estadoId: number
  nombre: string
  tipo: string
}

type SubdivisionUpsertPayload = {
  estadoId: number
  nombre: string
  tipo: string
}

function toSubdivision(dto: SubdivisionApiDto): Subdivision {
  return {
    id: dto.id,
    estadoId: typeof dto.estadoId === "number" && Number.isFinite(dto.estadoId) ? dto.estadoId : 0,
    nombre: dto.nombre ?? "",
    tipo: dto.tipo ?? "",
  }
}

function toUpsertPayload(input: Omit<Subdivision, "id">): SubdivisionUpsertPayload {
  return {
    estadoId: input.estadoId,
    nombre: input.nombre.trim(),
    tipo: input.tipo.trim(),
  }
}

export async function fetchSubdivisiones(estadoId?: number): Promise<Subdivision[]> {
  const qs = typeof estadoId === "number" && Number.isFinite(estadoId) && estadoId > 0 ? `?estadoId=${estadoId}` : ""
  const response = await backendRequest<SubdivisionApiDto[]>(`/v1/subdivisiones${qs}`)
  return response.map(toSubdivision)
}

export async function createSubdivision(input: Omit<Subdivision, "id">): Promise<Subdivision> {
  const response = await backendRequest<SubdivisionApiDto>("/v1/subdivisiones", {
    method: "POST",
    body: toUpsertPayload(input),
  })
  return toSubdivision(response)
}

export async function updateSubdivision(subdivisionId: number, input: Omit<Subdivision, "id">): Promise<Subdivision> {
  const response = await backendRequest<SubdivisionApiDto>(`/v1/subdivisiones/${subdivisionId}`, {
    method: "PUT",
    body: toUpsertPayload(input),
  })
  return toSubdivision(response)
}

export async function deleteSubdivision(subdivisionId: number): Promise<void> {
  await backendRequest<void>(`/v1/subdivisiones/${subdivisionId}`, {
    method: "DELETE",
  })
}
