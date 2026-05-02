import type { Building } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import type { MediaAssetKind } from "@/lib/types"

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
  mapAssetId?: number | null
  mapAssetKind?: string | null
  mapRotationDegrees?: number | null
  mapGridEnabled?: boolean | null
  mapGridCellSize?: number | null
  mapGridOffsetX?: number | null
  mapGridOffsetY?: number | null
  mapa?: {
    kind?: string | null
    filename?: string | null
    url?: string | null
    key?: string | null
    dataUrl?: string | null
  } | null
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
  mapAssetId: number | null
  mapRotationDegrees: number
  mapGridEnabled: boolean
  mapGridCellSize: number
  mapGridOffsetX: number
  mapGridOffsetY: number
  mapa:
    | { kind: "asset"; filename: string }
    | { kind: "embedded"; dataUrl: string }
    | { kind: "external"; url: string }
    | { kind: "stored"; key: string }
    | null
}

let buildingsCache: Building[] | null = null
let buildingsPromise: Promise<Building[]> | null = null
const buildingByIdCache = new Map<number, Building>()

type FetchBuildingsOptions = {
  forceRefresh?: boolean
  hydrateOwnerNames?: boolean
}

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeMapRotationDegrees(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = Math.round(value)
  const snappedQuarterTurns = Math.round(normalized / 90)
  return ((snappedQuarterTurns % 4) + 4) % 4 * 90
}

function normalizeMapGridCellSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 48
  return Math.round(clamp(value, 8, 512) * 100) / 100
}

function normalizeMapGridOffset(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function isMediaAssetKind(value: unknown): value is MediaAssetKind {
  return value === "image" || value === "json" || value === "other"
}

function toBuildingMapReference(dto: BuildingApiDto["mapa"]): Building["mapa"] {
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

function toBuildingMapPayload(map: Building["mapa"]): BuildingUpsertPayload["mapa"] {
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

function toBuilding(dto: BuildingApiDto): Building {
  const mapAssetId =
    typeof dto.mapAssetId === "number" && Number.isFinite(dto.mapAssetId) && dto.mapAssetId > 0
      ? dto.mapAssetId
      : undefined

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
    mapAssetId,
    mapAssetKind: isMediaAssetKind(dto.mapAssetKind) ? dto.mapAssetKind : undefined,
    mapRotationDegrees: normalizeMapRotationDegrees(dto.mapRotationDegrees),
    mapGridEnabled: typeof dto.mapGridEnabled === "boolean" ? dto.mapGridEnabled : false,
    mapGridCellSize: normalizeMapGridCellSize(dto.mapGridCellSize),
    mapGridOffsetX: normalizeMapGridOffset(dto.mapGridOffsetX),
    mapGridOffsetY: normalizeMapGridOffset(dto.mapGridOffsetY),
    mapa: toBuildingMapReference(dto.mapa),
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
  const mapAssetId =
    typeof input.mapAssetId === "number" && Number.isFinite(input.mapAssetId) && input.mapAssetId > 0
      ? input.mapAssetId
      : null

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
    mapAssetId,
    mapRotationDegrees: normalizeMapRotationDegrees(input.mapRotationDegrees),
    mapGridEnabled: Boolean(input.mapGridEnabled),
    mapGridCellSize: normalizeMapGridCellSize(input.mapGridCellSize),
    mapGridOffsetX: normalizeMapGridOffset(input.mapGridOffsetX),
    mapGridOffsetY: normalizeMapGridOffset(input.mapGridOffsetY),
    mapa: mapAssetId ? null : toBuildingMapPayload(input.mapa),
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
    const response = await backendRequest<BuildingApiDto[]>("/v1/buildings")
    return response.map(toBuilding)
  }

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
