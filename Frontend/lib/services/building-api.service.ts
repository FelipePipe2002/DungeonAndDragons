import type { Building } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"

type BuildingApiDto = {
  id: number
  landmarkId?: number | null
  nombre: string
  posicion?: number[] | null
  descripcion?: string | null
  tags?: string[] | null
  duenoId?: number | null
  mapBuildingIndex?: number | null
  organizationId?: number | null
}

type BuildingUpsertPayload = {
  landmarkId: number | null
  nombre: string
  posicion: [number, number] | null
  descripcion: string
  tags: string[]
  duenoId: number | null
  mapBuildingIndex: number | null
  organizationId: number | null
}

let buildingsCache: Building[] | null = null
let buildingsPromise: Promise<Building[]> | null = null
const buildingByIdCache = new Map<number, Building>()

function toOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function toPosition(value: number[] | null | undefined): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const x = Number(value[0])
  const y = Number(value[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return [x, y]
}

function toBuilding(dto: BuildingApiDto): Building {
  return {
    id: dto.id,
    landmarkId: typeof dto.landmarkId === "number" && dto.landmarkId > 0 ? dto.landmarkId : null,
    nombre: dto.nombre ?? "",
    posicion: toPosition(dto.posicion),
    descripcion: dto.descripcion ?? "",
    tags: toStringArray(dto.tags),
    duenoId: typeof dto.duenoId === "number" && dto.duenoId > 0 ? dto.duenoId : undefined,
    mapBuildingIndex:
      typeof dto.mapBuildingIndex === "number" && Number.isFinite(dto.mapBuildingIndex)
        ? dto.mapBuildingIndex
        : undefined,
    organizationId:
      typeof dto.organizationId === "number" && dto.organizationId > 0 ? dto.organizationId : undefined,
  }
}

async function hydrateOwnerNames(buildings: Building[]): Promise<Building[]> {
  const ownerIds = Array.from(
    new Set(
      buildings
        .map((building) => building.duenoId)
        .filter((ownerId): ownerId is number => typeof ownerId === "number" && ownerId > 0),
    ),
  )

  if (ownerIds.length === 0) {
    return buildings
  }

  const characters = await fetchCharacters().catch(() => [])
  const characterNameById = new Map(characters.map((character) => [character.id, character.nombre]))

  return buildings.map((building) => {
    if (!building.duenoId) return building
    return {
      ...building,
      duenoNombre: characterNameById.get(building.duenoId),
    }
  })
}

function toBuildingUpsertPayload(input: Omit<Building, "id">): BuildingUpsertPayload {
  return {
    landmarkId: typeof input.landmarkId === "number" && input.landmarkId > 0 ? input.landmarkId : null,
    nombre: input.nombre.trim(),
    posicion: input.posicion ?? null,
    descripcion: input.descripcion.trim(),
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))),
    duenoId: input.duenoId ?? null,
    mapBuildingIndex:
      typeof input.mapBuildingIndex === "number" && Number.isFinite(input.mapBuildingIndex)
        ? input.mapBuildingIndex
        : null,
    organizationId: input.organizationId ?? null,
  }
}

function writeBuildingsCache(buildings: Building[]) {
  buildingsCache = buildings
  buildingByIdCache.clear()
  for (const building of buildings) {
    buildingByIdCache.set(building.id, building)
  }
}

export async function fetchBuildings(forceRefresh = false): Promise<Building[]> {
  if (!forceRefresh && buildingsCache) {
    return buildingsCache
  }

  if (!forceRefresh && buildingsPromise) {
    return buildingsPromise
  }

  const pendingRequest = backendRequest<BuildingApiDto[]>("/v1/buildings")
    .then(async (response) => {
      const hydrated = await hydrateOwnerNames(response.map(toBuilding))
      writeBuildingsCache(hydrated)
      return hydrated
    })
    .finally(() => {
      buildingsPromise = null
    })

  buildingsPromise = pendingRequest
  return pendingRequest
}

export async function fetchBuildingById(buildingId: number): Promise<Building> {
  const cached = buildingByIdCache.get(buildingId)
  if (cached) {
    return cached
  }

  const response = await backendRequest<BuildingApiDto>(`/v1/buildings/${buildingId}`)
  const building = (await hydrateOwnerNames([toBuilding(response)]))[0]
  buildingByIdCache.set(building.id, building)
  return building
}

export async function createBuilding(input: Omit<Building, "id">): Promise<Building> {
  const response = await backendRequest<BuildingApiDto>("/v1/buildings", {
    method: "POST",
    body: toBuildingUpsertPayload(input),
  })

  const building = (await hydrateOwnerNames([toBuilding(response)]))[0]
  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.set(building.id, building)
  return building
}

export async function updateBuilding(
  buildingId: number,
  input: Omit<Building, "id">,
): Promise<Building> {
  const response = await backendRequest<BuildingApiDto>(`/v1/buildings/${buildingId}`, {
    method: "PUT",
    body: toBuildingUpsertPayload(input),
  })

  const building = (await hydrateOwnerNames([toBuilding(response)]))[0]
  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.set(building.id, building)
  return building
}

export async function deleteBuilding(buildingId: number): Promise<void> {
  await backendRequest<void>(`/v1/buildings/${buildingId}`, {
    method: "DELETE",
  })

  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.delete(buildingId)
}

export function getCachedBuildingName(buildingId: number) {
  return buildingByIdCache.get(buildingId)?.nombre ?? "Desconocido"
}

export function clearBuildingsCache() {
  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.clear()
}
