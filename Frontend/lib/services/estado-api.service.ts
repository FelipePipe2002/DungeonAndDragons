import { backendRequest } from "@/lib/services/backend-api.service"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import type { Estado } from "@/lib/types"

type EstadoApiDto = {
  id: number
  nombre: string
  tipo: string
  descripcion?: string | null
  historia?: string | null
  gobiernoTipo?: string | null
  imagen?: string | null
  imagenAssetId?: number | null
  territorioImagen?: string | null
  territorioImagenAssetId?: number | null
  estadoPadreId?: number | null
  miembros?: Array<{ personajeId: number; rol?: string | null }> | null
  landmarks?: Array<{ landmarkId: number; rol?: string | null }> | null
  subdivisiones?: string[] | null
}

type EstadoUpsertPayload = {
  nombre: string
  tipo: string
  descripcion: string
  historia: string
  gobiernoTipo: string
  imagen: string | null
  imagenAssetId: number | null
  territorioImagen: string | null
  territorioImagenAssetId: number | null
  estadoPadreId: number | null
  miembros: Array<{ personajeId: number; rol: string }>
  landmarks: Array<{ landmarkId: number; rol: string }>
  subdivisiones: string[]
}

function toEstado(dto: EstadoApiDto): Estado {
  const imagenAssetId =
    typeof dto.imagenAssetId === "number" && Number.isFinite(dto.imagenAssetId) && dto.imagenAssetId > 0
      ? dto.imagenAssetId
      : undefined

  const territorioImagenAssetId =
    typeof dto.territorioImagenAssetId === "number" &&
    Number.isFinite(dto.territorioImagenAssetId) &&
    dto.territorioImagenAssetId > 0
      ? dto.territorioImagenAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.nombre ?? "",
    tipo: dto.tipo ?? "",
    descripcion: dto.descripcion ?? "",
    historia: dto.historia ?? "",
    gobiernoTipo: dto.gobiernoTipo ?? "",
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : dto.imagen ?? undefined,
    imagenAssetId,
    territorioImagen: territorioImagenAssetId
      ? buildAssetUrl(territorioImagenAssetId)
      : dto.territorioImagen ?? undefined,
    territorioImagenAssetId,
    estadoPadreId:
      typeof dto.estadoPadreId === "number" && Number.isFinite(dto.estadoPadreId) && dto.estadoPadreId > 0
        ? dto.estadoPadreId
        : undefined,
    miembros: Array.isArray(dto.miembros)
      ? dto.miembros
          .filter((m): m is { personajeId: number; rol?: string | null } =>
            typeof m?.personajeId === "number" && Number.isFinite(m.personajeId) && m.personajeId > 0,
          )
          .map((m) => ({ personajeId: m.personajeId, rol: m.rol ?? "" }))
      : [],
    landmarks: Array.isArray(dto.landmarks)
      ? dto.landmarks
          .filter((l): l is { landmarkId: number; rol?: string | null } =>
            typeof l?.landmarkId === "number" && Number.isFinite(l.landmarkId) && l.landmarkId > 0,
          )
          .map((l) => ({ landmarkId: l.landmarkId, rol: l.rol ?? "" }))
      : [],
    subdivisiones: Array.isArray(dto.subdivisiones) ? dto.subdivisiones.filter((s): s is string => typeof s === "string") : [],
  }
}

function toUpsertPayload(input: Omit<Estado, "id">): EstadoUpsertPayload {
  const imagenAssetId =
    typeof input.imagenAssetId === "number" && Number.isFinite(input.imagenAssetId) && input.imagenAssetId > 0
      ? input.imagenAssetId
      : null

  const territorioImagenAssetId =
    typeof input.territorioImagenAssetId === "number" &&
    Number.isFinite(input.territorioImagenAssetId) &&
    input.territorioImagenAssetId > 0
      ? input.territorioImagenAssetId
      : null

  return {
    nombre: input.nombre.trim(),
    tipo: input.tipo.trim(),
    descripcion: input.descripcion.trim(),
    historia: input.historia.trim(),
    gobiernoTipo: input.gobiernoTipo.trim(),
    imagen: imagenAssetId ? null : (input.imagen?.trim() || null),
    imagenAssetId,
    territorioImagen: territorioImagenAssetId ? null : (input.territorioImagen?.trim() || null),
    territorioImagenAssetId,
    estadoPadreId:
      typeof input.estadoPadreId === "number" && Number.isFinite(input.estadoPadreId) && input.estadoPadreId > 0
        ? input.estadoPadreId
        : null,
    miembros: (Array.isArray(input.miembros) ? input.miembros : [])
      .filter((m) => typeof m?.personajeId === "number" && Number.isFinite(m.personajeId) && m.personajeId > 0)
      .map((m) => ({ personajeId: m.personajeId, rol: (m.rol ?? "").trim() })),
    landmarks: (Array.isArray(input.landmarks) ? input.landmarks : [])
      .filter((l) => typeof l?.landmarkId === "number" && Number.isFinite(l.landmarkId) && l.landmarkId > 0)
      .map((l) => ({ landmarkId: l.landmarkId, rol: (l.rol ?? "").trim() })),
    subdivisiones: (Array.isArray(input.subdivisiones) ? input.subdivisiones : [])
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0),
  }
}

let estadosCache: Estado[] | null = null
let estadosPromise: Promise<Estado[]> | null = null

export async function fetchEstados(forceRefresh = false): Promise<Estado[]> {
  if (!forceRefresh && estadosCache) return estadosCache
  if (!forceRefresh && estadosPromise) return estadosPromise

  const pending = backendRequest<EstadoApiDto[]>("/v1/estados")
    .then((response) => {
      const estados = response.map(toEstado)
      estadosCache = estados
      return estados
    })
    .finally(() => {
      estadosPromise = null
    })

  estadosPromise = pending
  return pending
}

export async function fetchEstadoById(estadoId: number): Promise<Estado> {
  const response = await backendRequest<EstadoApiDto>(`/v1/estados/${estadoId}`)
  return toEstado(response)
}

export async function createEstado(input: Omit<Estado, "id">): Promise<Estado> {
  const response = await backendRequest<EstadoApiDto>("/v1/estados", {
    method: "POST",
    body: toUpsertPayload(input),
  })

  estadosCache = null
  estadosPromise = null
  return toEstado(response)
}

export async function updateEstado(estadoId: number, input: Omit<Estado, "id">): Promise<Estado> {
  const response = await backendRequest<EstadoApiDto>(`/v1/estados/${estadoId}`, {
    method: "PUT",
    body: toUpsertPayload(input),
  })

  estadosCache = null
  estadosPromise = null
  return toEstado(response)
}

export async function deleteEstado(estadoId: number): Promise<void> {
  await backendRequest<void>(`/v1/estados/${estadoId}`, {
    method: "DELETE",
  })

  estadosCache = null
  estadosPromise = null
}
