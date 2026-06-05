import {
  toCharacterEvent,
  toNumberArray,
  toOrganizationMember,
  toPosition,
  toStringArray,
} from "@/lib/dto-mappers"
import {
  normalizeMapGridCellSize,
  normalizeMapGridOffset,
  normalizeMapRotationDegrees,
} from "@/lib/map-grid"
import { UNKNOWN_LABEL } from "@/lib/display"
import { dedupeNumbers, dedupeStrings, toOptionalText } from "@/lib/normalize"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"
import type {
  BackendBuildingDto,
  BackendCharacterDto,
  BackendLandmarkDto,
  BackendLandmarkEventDto,
  BackendLandmarkEventUpsertPayload,
  BackendLandmarkMapDto,
  BackendLandmarkMapUpsertPayload,
  BackendLandmarkReferenceDto,
  BackendLandmarkUpsertPayload,
  BackendOrganizationDto,
  Building,
  Character,
  Landmark,
  LandmarkEvent,
  LandmarkMapReference,
  LandmarkType,
  MediaAssetKind,
  Organization,
} from "@/lib/types"
import { DUNGEON_MAP_ERROR_MESSAGE } from "@/lib/types"

const LANDMARK_INCLUDE_VALUE = "edificios,personajes,organizaciones"
const LANDMARKS_COLLECTION_PATH = backendRoutes.landmarks.collection(LANDMARK_INCLUDE_VALUE)

export interface LandmarkReference {
  id: number
  nombre: string
}

function landmarkNameToSlug(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type OrganizationMapLinksPayload = Record<number, number[]>

let landmarksCache: Landmark[] | null = null
let landmarksPromise: Promise<Landmark[]> | null = null
let referencesCache: LandmarkReference[] | null = null
const landmarkByIdCache = new Map<number, Landmark>()

const LANDMARK_TYPES: LandmarkType[] = [
  "ciudad",
  "pueblo",
  "aldea",
  "fuerte",
  "puente",
  "bandera",
  "campamento",
  "mazmorra",
]

function isLandmarkType(value: unknown): value is LandmarkType {
  return typeof value === "string" && LANDMARK_TYPES.includes(value as LandmarkType)
}

function isMediaAssetKind(value: unknown): value is MediaAssetKind {
  return value === "image" || value === "json" || value === "binary"
}

function toCharacter(dto: BackendCharacterDto): Character {
  const imagenAssetId =
    typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
      ? dto.imageAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.name ?? "",
    clase: dto.characterClass ?? "",
    raza: dto.race ?? "",
    descripcion: dto.description ?? "",
    isPlayer: dto.isPlayer === true,
    characterSheet: null,
    tags: toStringArray(dto.tags),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.image),
    imagenAssetId,
    landmarkId: typeof dto.landmarkId === "number" && dto.landmarkId > 0 ? dto.landmarkId : 0,
    buildingIds: toNumberArray(dto.buildingIds),
    organizationIds: toNumberArray(dto.organizationIds),
    eventos: Array.isArray(dto.events) ? dto.events.map(toCharacterEvent) : [],
  }
}

function toBuilding(dto: BackendBuildingDto): Building {
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
  }
}

function toOrganization(dto: BackendOrganizationDto): Organization {
  const imagenAssetId =
    typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
      ? dto.imageAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.name ?? "",
    descripcion: dto.description ?? "",
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.image),
    imagenAssetId,
    categorias: dedupeStrings(
      toStringArray(dto.categories)
        .map((category) => category.trim())
        .filter((category) => category.length > 0),
    ),
    edificios: dedupeNumbers(toNumberArray(dto.buildingIds)),
    miembros: Array.isArray(dto.members) ? dto.members.map(toOrganizationMember) : [],
    landmarks: dedupeNumbers(toNumberArray(dto.landmarks).filter((landmarkId) => landmarkId > 0)),
  }
}

function toLandmarkEvent(dto: BackendLandmarkEventDto): LandmarkEvent {
  return {
    nombre: dto.title ?? "",
    descripcion: dto.description ?? "",
    fecha: toOptionalText(dto.date),
  }
}

function toLandmarkMapReference(dto: BackendLandmarkMapDto | null | undefined): LandmarkMapReference | undefined {
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

  if (dto.kind === "buildings" && dto.source === "asset" && typeof dto.filename === "string") {
    const filename = dto.filename.trim()
    if (filename.length > 0) {
      return { kind: "buildings", source: "asset", filename }
    }
  }

  if (dto.kind === "buildings" && dto.source === "external" && typeof dto.url === "string") {
    const url = dto.url.trim()
    if (url.length > 0) {
      return { kind: "buildings", source: "external", url }
    }
  }

  return undefined
}

function toLandmark(dto: BackendLandmarkDto): Landmark {
  const mapAssetId =
    typeof dto.mapAssetId === "number" && Number.isFinite(dto.mapAssetId) && dto.mapAssetId > 0
      ? dto.mapAssetId
      : undefined

  const estadoId =
    typeof dto.stateId === "number" && Number.isFinite(dto.stateId) && dto.stateId > 0
      ? dto.stateId
      : undefined
  const subdivisionId =
    typeof dto.subdivisionId === "number" && Number.isFinite(dto.subdivisionId) && dto.subdivisionId > 0
      ? dto.subdivisionId
      : undefined

  let organizationMapLinks: Record<number, number[]> | undefined
  if (dto.organizationMapLinks) {
    try {
      const parsed = JSON.parse(dto.organizationMapLinks)
      if (parsed && typeof parsed === "object") {
        organizationMapLinks = parsed as Record<number, number[]>
      }
    } catch {
      organizationMapLinks = undefined
    }
  }

  let hiddenMapBuildings: number[] | undefined
  if (dto.hiddenMapBuildings) {
    try {
      const parsed = JSON.parse(dto.hiddenMapBuildings)
      if (Array.isArray(parsed)) {
        hiddenMapBuildings = parsed.filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value),
        )
      }
    } catch {
      hiddenMapBuildings = undefined
    }
  }

  return {
    id: dto.id,
    icono: dto.icon ?? "",
    nombre: dto.name ?? "",
    tipo: isLandmarkType(dto.type) ? dto.type : "ciudad",
    estadoId,
    subdivisionId,
    escalaIcono:
      typeof dto.iconScale === "number" && Number.isFinite(dto.iconScale)
        ? dto.iconScale
        : 1,
    escalaTexto:
      typeof dto.textScale === "number" && Number.isFinite(dto.textScale)
        ? dto.textScale
        : 1,
    mostrarLeyenda: typeof dto.showLegend === "boolean" ? dto.showLegend : true,
    posicion: toPosition(dto.position) ?? [0.5, 0.5],
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    poblacion:
      typeof dto.population === "number" && Number.isFinite(dto.population)
        ? Math.max(0, Math.round(dto.population))
        : undefined,
    descripcionCorta: toOptionalText(dto.shortDescription),
    historia: toOptionalText(dto.history),
    eventos: Array.isArray(dto.events) ? dto.events.map(toLandmarkEvent) : [],
    mapAssetId,
    mapAssetKind: isMediaAssetKind(dto.mapAssetKind) ? dto.mapAssetKind : undefined,
    mapRotationDegrees:
      typeof dto.mapRotationDegrees === "number" && Number.isFinite(dto.mapRotationDegrees)
        ? normalizeMapRotationDegrees(dto.mapRotationDegrees)
        : 0,
    mapGridEnabled: typeof dto.mapGridEnabled === "boolean" ? dto.mapGridEnabled : false,
    mapGridCellSize:
      typeof dto.mapGridCellSize === "number" && Number.isFinite(dto.mapGridCellSize)
        ? normalizeMapGridCellSize(dto.mapGridCellSize)
        : 48,
    mapGridOffsetX:
      typeof dto.mapGridOffsetX === "number" && Number.isFinite(dto.mapGridOffsetX)
        ? normalizeMapGridOffset(dto.mapGridOffsetX)
        : 0,
    mapGridOffsetY:
      typeof dto.mapGridOffsetY === "number" && Number.isFinite(dto.mapGridOffsetY)
        ? normalizeMapGridOffset(dto.mapGridOffsetY)
        : 0,
    organizationMapLinks,
    hiddenMapBuildings,
    dungeonGeneratorConfig: toOptionalText(dto.dungeonGeneratorConfig),
    mapa: toLandmarkMapReference(dto.map),
    edificios: Array.isArray(dto.buildings) ? dto.buildings.map(toBuilding) : [],
    personajes: Array.isArray(dto.characters) ? dto.characters.map(toCharacter) : [],
    organizaciones: Array.isArray(dto.organizations)
      ? dto.organizations.map(toOrganization)
      : [],
  }
}

function toLandmarkMapPayload(
  map: LandmarkMapReference | undefined,
): BackendLandmarkMapUpsertPayload | null {
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

  if (map.kind === "stored") {
    return { kind: "stored", key: map.key.trim() }
  }

  if (map.source === "asset") {
    return { kind: "buildings", source: "asset", filename: map.filename.trim() }
  }

  return { kind: "buildings", source: "external", url: map.url.trim() }
}

function assertDungeonLandmarkMapContract(input: Omit<Landmark, "id">) {
  if (input.tipo !== "mazmorra") {
    return
  }

  if (input.mapa) {
    throw new Error(DUNGEON_MAP_ERROR_MESSAGE)
  }

  if (input.mapAssetKind && input.mapAssetKind !== "image" && input.mapAssetKind !== "json") {
    throw new Error(DUNGEON_MAP_ERROR_MESSAGE)
  }
}

function toLandmarkUpsertPayload(input: Omit<Landmark, "id">): BackendLandmarkUpsertPayload {
  assertDungeonLandmarkMapContract(input)

  const mapAssetId =
    typeof input.mapAssetId === "number" && Number.isFinite(input.mapAssetId) && input.mapAssetId > 0
      ? input.mapAssetId
      : null

  const estadoId =
    typeof input.estadoId === "number" && Number.isFinite(input.estadoId) && input.estadoId > 0 ? input.estadoId : null
  const subdivisionId =
    typeof input.subdivisionId === "number" && Number.isFinite(input.subdivisionId) && input.subdivisionId > 0
      ? input.subdivisionId
      : null

  return {
    icon: input.icono.trim(),
    name: input.nombre.trim(),
    type: input.tipo,
    stateId: estadoId,
    subdivisionId,
    iconScale:
      typeof input.escalaIcono === "number" && Number.isFinite(input.escalaIcono) ? input.escalaIcono : 1,
    textScale:
      typeof input.escalaTexto === "number" && Number.isFinite(input.escalaTexto) ? input.escalaTexto : 1,
    showLegend: Boolean(input.mostrarLeyenda),
    position: input.posicion,
    tags: dedupeStrings(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    population:
      typeof input.poblacion === "number" && Number.isFinite(input.poblacion)
        ? Math.max(0, Math.round(input.poblacion))
        : null,
    shortDescription: toOptionalText(input.descripcionCorta) ?? null,
    history: toOptionalText(input.historia) ?? null,
    events: input.eventos.map((event) => ({
      title: event.nombre.trim(),
      description: event.descripcion.trim(),
      date: toOptionalText(event.fecha) ?? null,
      session: null,
    })),
    mapRotationDegrees: normalizeMapRotationDegrees(input.mapRotationDegrees),
    mapGridEnabled: Boolean(input.mapGridEnabled),
    mapGridCellSize: normalizeMapGridCellSize(input.mapGridCellSize),
    mapGridOffsetX: normalizeMapGridOffset(input.mapGridOffsetX),
    mapGridOffsetY: normalizeMapGridOffset(input.mapGridOffsetY),
    organizationMapLinks:
      input.organizationMapLinks && Object.keys(input.organizationMapLinks).length > 0
        ? JSON.stringify(input.organizationMapLinks)
        : null,
    hiddenMapBuildings:
      input.hiddenMapBuildings && input.hiddenMapBuildings.length > 0
        ? JSON.stringify(input.hiddenMapBuildings)
        : null,
    dungeonGeneratorConfig: toOptionalText(input.dungeonGeneratorConfig) ?? null,
    mapAssetId,
    map: mapAssetId ? null : toLandmarkMapPayload(input.mapa),
  }
}

function writeLandmarkReferencesCache(references: LandmarkReference[]) {
  referencesCache = references
}

function writeLandmarksCache(landmarks: Landmark[]) {
  landmarksCache = landmarks
  landmarkByIdCache.clear()
  for (const landmark of landmarks) {
    landmarkByIdCache.set(landmark.id, landmark)
  }
  writeLandmarkReferencesCache(
    landmarks
      .map((landmark) => ({
        id: landmark.id,
        nombre: landmark.nombre,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  )
}

function writeLandmarkToCaches(landmark: Landmark) {
  landmarkByIdCache.set(landmark.id, landmark)

  if (landmarksCache) {
    const nextLandmarks = landmarksCache.some((item) => item.id === landmark.id)
      ? landmarksCache.map((item) => (item.id === landmark.id ? landmark : item))
      : [...landmarksCache, landmark]
    writeLandmarksCache(nextLandmarks)
    return
  }

  if (referencesCache) {
    const nextReferences = referencesCache.some((item) => item.id === landmark.id)
      ? referencesCache.map((item) => (item.id === landmark.id ? { id: landmark.id, nombre: landmark.nombre } : item))
      : [...referencesCache, { id: landmark.id, nombre: landmark.nombre }]
    writeLandmarkReferencesCache(nextReferences.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")))
  }
}

export async function fetchLandmarks(forceRefresh = false): Promise<Landmark[]> {
  if (!forceRefresh && landmarksCache) {
    return landmarksCache
  }

  if (!forceRefresh && landmarksPromise) {
    return landmarksPromise
  }

  const pendingRequest = backendRequest<BackendLandmarkDto[]>(LANDMARKS_COLLECTION_PATH)
    .then((response) => {
      const landmarks = response.map(toLandmark)
      writeLandmarksCache(landmarks)
      return landmarks
    })
    .finally(() => {
      landmarksPromise = null
    })

  landmarksPromise = pendingRequest
  return pendingRequest
}

export async function fetchLandmarkById(landmarkId: number, forceRefresh = false): Promise<Landmark> {
  if (!forceRefresh) {
    const cached = landmarkByIdCache.get(landmarkId)
    if (cached) {
      return cached
    }

    const fromCollection = landmarksCache?.find((landmark) => landmark.id === landmarkId)
    if (fromCollection) {
      landmarkByIdCache.set(fromCollection.id, fromCollection)
      return fromCollection
    }
  }

  const response = await backendRequest<BackendLandmarkDto>(backendRoutes.landmarks.byId(landmarkId, LANDMARK_INCLUDE_VALUE))
  const landmark = toLandmark(response)
  writeLandmarkToCaches(landmark)
  return landmark
}

export async function fetchLandmarkBySlug(slug: string, forceRefresh = false): Promise<Landmark | null> {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) {
    return null
  }

  if (!forceRefresh) {
    const cachedLandmark =
      landmarksCache?.find((landmark) => landmarkNameToSlug(landmark.nombre) === normalizedSlug) ?? null
    if (cachedLandmark) {
      landmarkByIdCache.set(cachedLandmark.id, cachedLandmark)
      return cachedLandmark
    }

    const cachedById = Array.from(landmarkByIdCache.values()).find(
      (landmark) => landmarkNameToSlug(landmark.nombre) === normalizedSlug,
    )
    if (cachedById) {
      return cachedById
    }
  }

  const references = await fetchLandmarkReferences(forceRefresh)
  const matchedReference = references.find((landmark) => landmarkNameToSlug(landmark.nombre) === normalizedSlug)
  if (!matchedReference) {
    return null
  }

  return fetchLandmarkById(matchedReference.id, forceRefresh)
}

export async function fetchLandmarkReferences(forceRefresh = false): Promise<LandmarkReference[]> {
  if (!forceRefresh && referencesCache) {
    return referencesCache
  }

  if (!forceRefresh && landmarksCache) {
    return landmarksCache
      .map((landmark) => ({
        id: landmark.id,
        nombre: landmark.nombre,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }

  const response = await backendRequest<BackendLandmarkReferenceDto[]>(backendRoutes.landmarks.collection())
  const references = response
    .map((item) => ({
      id: item.id,
      nombre: item.name ?? "",
    }))
    .filter((item) => item.nombre.trim().length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  writeLandmarkReferencesCache(references)
  return references
}

export async function createLandmark(input: Omit<Landmark, "id">): Promise<Landmark> {
  const response = await backendRequest<BackendLandmarkDto>(backendRoutes.landmarks.collection(), {
    method: "POST",
    body: toLandmarkUpsertPayload(input),
  })

  landmarksCache = null
  landmarksPromise = null
  referencesCache = null
  return fetchLandmarkById(response.id, true)
}

export async function updateLandmark(
  landmarkId: number,
  input: Omit<Landmark, "id">,
): Promise<Landmark> {
  await backendRequest<BackendLandmarkDto>(backendRoutes.landmarks.byId(landmarkId), {
    method: "PUT",
    body: toLandmarkUpsertPayload(input),
  })

  landmarksCache = null
  landmarksPromise = null
  referencesCache = null
  return fetchLandmarkById(landmarkId, true)
}

export async function deleteLandmark(landmarkId: number): Promise<void> {
  await backendRequest<void>(backendRoutes.landmarks.byId(landmarkId), {
    method: "DELETE",
  })

  landmarksCache = null
  landmarksPromise = null
  referencesCache = null
  landmarkByIdCache.delete(landmarkId)
}

export function clearLandmarksCache() {
  landmarksCache = null
  landmarksPromise = null
  referencesCache = null
  landmarkByIdCache.clear()
}

export function getCachedLandmarkName(landmarkId: number) {
  return (
    landmarkByIdCache.get(landmarkId)?.nombre ??
    referencesCache?.find((landmark) => landmark.id === landmarkId)?.nombre ??
    UNKNOWN_LABEL
  )
}
