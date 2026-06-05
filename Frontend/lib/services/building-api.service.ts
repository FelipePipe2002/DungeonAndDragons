import {
  normalizeMapGridCellSize,
  normalizeMapGridOffset,
  normalizeMapRotationDegrees,
} from "@/lib/map-grid"
import { toPosition, toStringArray } from "@/lib/dto-mappers"
import { UNKNOWN_LABEL } from "@/lib/display"
import { toOptionalText } from "@/lib/normalize"
import type {
  BackendBuildingDto,
  BackendBuildingUpsertPayload,
  Building,
  MediaAssetKind,
} from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"
import { fetchCharacters } from "@/lib/services/character-api.service"

let buildingsCache: Building[] | null = null
let buildingsPromise: Promise<Building[]> | null = null
const buildingByIdCache = new Map<number, Building>()

type FetchBuildingsOptions = {
  forceRefresh?: boolean
  hydrateOwnerNames?: boolean
}

function isMediaAssetKind(value: unknown): value is MediaAssetKind {
  return value === "image" || value === "json" || value === "other"
}

function toBuildingMapReference(dto: BackendBuildingDto["map"]): Building["mapa"] {
  if (!dto || typeof dto.kind !== "string") return undefined

  if (dto.kind === "asset" && typeof dto.filename === "string" && dto.filename.trim().length > 0) {
    return { kind: "asset", filename: dto.filename.trim() }
  }

  if (dto.kind === "embedded" && typeof dto.dataUrl === "string" && dto.dataUrl.trim().length > 0) {
    return { kind: "embedded", dataUrl: dto.dataUrl.trim() }
  }

  if (dto.kind === "external" && typeof dto.url === "string" && dto.url.trim().length > 0) {
    return { kind: "external", url: dto.url.trim() }
  }

  if (dto.kind === "stored" && typeof dto.key === "string" && dto.key.trim().length > 0) {
    return { kind: "stored", key: dto.key.trim() }
  }

  return undefined
}

function toBuildingMapPayload(map: Building["mapa"]): BackendBuildingUpsertPayload["map"] {
  if (!map) return null

  if (map.kind === "asset") {
    return { kind: "asset", filename: map.filename.trim() }
  }

  if (map.kind === "embedded") {
    return { kind: "embedded", dataUrl: map.dataUrl.trim() }
  }

  if (map.kind === "external") {
    return { kind: "external", url: map.url.trim() }
  }

  return { kind: "stored", key: map.key.trim() }
}

function toBuilding(dto: BackendBuildingDto): Building {
  const mapAssetId =
    typeof dto.mapAssetId === "number" && Number.isFinite(dto.mapAssetId) && dto.mapAssetId > 0
      ? dto.mapAssetId
      : undefined

  return {
    id: dto.id,
    landmarkId: typeof dto.landmarkId === "number" && dto.landmarkId > 0 ? dto.landmarkId : null,
    nombre: dto.name ?? "",
    posicion: toPosition(dto.position),
    descripcion: dto.description ?? "",
    tags: toStringArray(dto.tags),
    duenoId: typeof dto.ownerId === "number" && dto.ownerId > 0 ? dto.ownerId : undefined,
    mapBuildingIndex:
      typeof dto.mapBuildingIndex === "number" && Number.isFinite(dto.mapBuildingIndex)
        ? dto.mapBuildingIndex
        : undefined,
    organizationId:
      typeof dto.organizationId === "number" && dto.organizationId > 0 ? dto.organizationId : undefined,
    mapAssetId,
    mapAssetKind: isMediaAssetKind(dto.mapAssetKind) ? dto.mapAssetKind : undefined,
    mapRotationDegrees: normalizeMapRotationDegrees(dto.mapRotationDegrees),
    mapGridEnabled: typeof dto.mapGridEnabled === "boolean" ? dto.mapGridEnabled : false,
    mapGridCellSize: normalizeMapGridCellSize(dto.mapGridCellSize),
    mapGridOffsetX: normalizeMapGridOffset(dto.mapGridOffsetX),
    mapGridOffsetY: normalizeMapGridOffset(dto.mapGridOffsetY),
    mapa: toBuildingMapReference(dto.map),
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

function toBuildingUpsertPayload(input: Omit<Building, "id">): BackendBuildingUpsertPayload {
  const mapAssetId =
    typeof input.mapAssetId === "number" && Number.isFinite(input.mapAssetId) && input.mapAssetId > 0
      ? input.mapAssetId
      : null

  return {
    landmarkId: typeof input.landmarkId === "number" && input.landmarkId > 0 ? input.landmarkId : null,
    name: input.nombre.trim(),
    position: input.posicion ?? null,
    description: input.descripcion.trim(),
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))),
    ownerId: input.duenoId ?? null,
    mapBuildingIndex:
      typeof input.mapBuildingIndex === "number" && Number.isFinite(input.mapBuildingIndex)
        ? input.mapBuildingIndex
        : null,
    organizationId: input.organizationId ?? null,
    mapAssetId,
    mapRotationDegrees: normalizeMapRotationDegrees(input.mapRotationDegrees),
    mapGridEnabled: Boolean(input.mapGridEnabled),
    mapGridCellSize: normalizeMapGridCellSize(input.mapGridCellSize),
    mapGridOffsetX: normalizeMapGridOffset(input.mapGridOffsetX),
    mapGridOffsetY: normalizeMapGridOffset(input.mapGridOffsetY),
    map: mapAssetId ? null : toBuildingMapPayload(input.mapa),
  }
}

function writeBuildingsCache(buildings: Building[]) {
  buildingsCache = buildings
  buildingByIdCache.clear()
  for (const building of buildings) {
    buildingByIdCache.set(building.id, building)
  }
}

export async function fetchBuildings(options: boolean | FetchBuildingsOptions = false): Promise<Building[]> {
  const forceRefresh = typeof options === "boolean" ? options : options.forceRefresh === true
  const shouldHydrateOwnerNames = typeof options === "boolean" ? true : options.hydrateOwnerNames !== false

  if (!shouldHydrateOwnerNames) {
    const response = await backendRequest<BackendBuildingDto[]>(backendRoutes.buildings.collection())
    return response.map(toBuilding)
  }

  if (!forceRefresh && buildingsCache) {
    return buildingsCache
  }

  if (!forceRefresh && buildingsPromise) {
    return buildingsPromise
  }

  const pendingRequest = backendRequest<BackendBuildingDto[]>(backendRoutes.buildings.collection())
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

  const response = await backendRequest<BackendBuildingDto>(backendRoutes.buildings.byId(buildingId))
  const building = (await hydrateOwnerNames([toBuilding(response)]))[0]
  buildingByIdCache.set(building.id, building)
  return building
}

export async function createBuilding(input: Omit<Building, "id">): Promise<Building> {
  const response = await backendRequest<BackendBuildingDto>(backendRoutes.buildings.collection(), {
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
  const response = await backendRequest<BackendBuildingDto>(backendRoutes.buildings.byId(buildingId), {
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
  await backendRequest<void>(backendRoutes.buildings.byId(buildingId), {
    method: "DELETE",
  })

  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.delete(buildingId)
}

export function getCachedBuildingName(buildingId: number) {
  return buildingByIdCache.get(buildingId)?.nombre ?? UNKNOWN_LABEL
}

export function clearBuildingsCache() {
  buildingsCache = null
  buildingsPromise = null
  buildingByIdCache.clear()
}
