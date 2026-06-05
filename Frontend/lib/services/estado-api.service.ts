import { backendRequest } from "@/lib/services/backend-api.service"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"
import type {
  BackendEstadoDto as EstadoApiDto,
  BackendEstadoLandmarkDto,
  BackendEstadoMemberDto,
  BackendEstadoUpsertPayload as EstadoUpsertPayload,
  Estado,
} from "@/lib/types"

function toEstado(dto: EstadoApiDto): Estado {
  const imagenAssetId =
    typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
      ? dto.imageAssetId
      : undefined

  const territorioImagenAssetId =
    typeof dto.territoryImageAssetId === "number" &&
    Number.isFinite(dto.territoryImageAssetId) &&
    dto.territoryImageAssetId > 0
      ? dto.territoryImageAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.name ?? "",
    tipo: dto.type ?? "",
    descripcion: dto.description ?? "",
    historia: dto.history ?? "",
    gobiernoTipo: dto.governmentType ?? "",
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : dto.image ?? undefined,
    imagenAssetId,
    territorioImagen: territorioImagenAssetId
      ? buildAssetUrl(territorioImagenAssetId)
      : dto.territoryImage ?? undefined,
    territorioImagenAssetId,
    estadoPadreId:
      typeof dto.parentStateId === "number" && Number.isFinite(dto.parentStateId) && dto.parentStateId > 0
        ? dto.parentStateId
        : undefined,
    miembros: Array.isArray(dto.members)
      ? dto.members
          .filter((m): m is BackendEstadoMemberDto =>
            typeof m?.characterId === "number" && Number.isFinite(m.characterId) && m.characterId > 0,
          )
          .map((m) => ({ personajeId: m.characterId, rol: m.role ?? "" }))
      : [],
    landmarks: Array.isArray(dto.landmarks)
      ? dto.landmarks
          .filter((l): l is BackendEstadoLandmarkDto =>
            typeof l?.landmarkId === "number" && Number.isFinite(l.landmarkId) && l.landmarkId > 0,
          )
          .map((l) => ({ landmarkId: l.landmarkId, rol: l.role ?? "" }))
      : [],
    subdivisiones: [],
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
    name: input.nombre.trim(),
    type: input.tipo.trim(),
    description: input.descripcion.trim(),
    history: input.historia.trim(),
    governmentType: input.gobiernoTipo.trim(),
    image: imagenAssetId ? null : (input.imagen?.trim() || null),
    imageAssetId: imagenAssetId,
    territoryImage: territorioImagenAssetId ? null : (input.territorioImagen?.trim() || null),
    territoryImageAssetId: territorioImagenAssetId,
    parentStateId:
      typeof input.estadoPadreId === "number" && Number.isFinite(input.estadoPadreId) && input.estadoPadreId > 0
        ? input.estadoPadreId
        : null,
    members: (Array.isArray(input.miembros) ? input.miembros : [])
      .filter((m) => typeof m?.personajeId === "number" && Number.isFinite(m.personajeId) && m.personajeId > 0)
      .map((m) => ({ characterId: m.personajeId, role: (m.rol ?? "").trim() })),
    landmarks: (Array.isArray(input.landmarks) ? input.landmarks : [])
      .filter((l) => typeof l?.landmarkId === "number" && Number.isFinite(l.landmarkId) && l.landmarkId > 0)
      .map((l) => ({ landmarkId: l.landmarkId, role: (l.rol ?? "").trim() })),
  }
}

let estadosCache: Estado[] | null = null
let estadosPromise: Promise<Estado[]> | null = null

export async function fetchEstados(forceRefresh = false): Promise<Estado[]> {
  if (!forceRefresh && estadosCache) return estadosCache
  if (!forceRefresh && estadosPromise) return estadosPromise

  const pending = backendRequest<EstadoApiDto[]>(backendRoutes.estados.collection())
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
  const response = await backendRequest<EstadoApiDto>(backendRoutes.estados.byId(estadoId))
  return toEstado(response)
}

export async function createEstado(input: Omit<Estado, "id">): Promise<Estado> {
  const response = await backendRequest<EstadoApiDto>(backendRoutes.estados.collection(), {
    method: "POST",
    body: toUpsertPayload(input),
  })

  estadosCache = null
  estadosPromise = null
  return toEstado(response)
}

export async function updateEstado(estadoId: number, input: Omit<Estado, "id">): Promise<Estado> {
  const response = await backendRequest<EstadoApiDto>(backendRoutes.estados.byId(estadoId), {
    method: "PUT",
    body: toUpsertPayload(input),
  })

  estadosCache = null
  estadosPromise = null
  return toEstado(response)
}

export async function deleteEstado(estadoId: number): Promise<void> {
  await backendRequest<void>(backendRoutes.estados.byId(estadoId), {
    method: "DELETE",
  })

  estadosCache = null
  estadosPromise = null
}
