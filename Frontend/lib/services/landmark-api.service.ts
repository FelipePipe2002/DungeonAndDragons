import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRequest } from "@/lib/services/backend-api.service"
import type {
  Building,
  Character,
  CharacterEvent,
  Landmark,
  LandmarkEvent,
  LandmarkMapReference,
  LandmarkType,
  MediaAssetKind,
  Organization,
  OrganizationMember,
} from "@/lib/types"
import { DUNGEON_MAP_ERROR_MESSAGE } from "@/lib/types"

const LANDMARK_INCLUDE_QUERY = "include=edificios,personajes,organizaciones"
const LANDMARKS_COLLECTION_PATH = `/v1/landmarks?${LANDMARK_INCLUDE_QUERY}`

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

type LandmarkApiEventDto = {
  nombre: string
  descripcion?: string | null
  fecha?: string | null
  posicion?: number[] | null
}

type LandmarkApiMapDto = {
  kind?: string | null
  source?: string | null
  filename?: string | null
  url?: string | null
  key?: string | null
  dataUrl?: string | null
}

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

type CharacterApiEventDto = {
  sesion: string
  descripcion: string
  fecha?: string | null
}

type CharacterApiDto = {
  id: number
  nombre: string
  clase: string
  raza: string
  descripcion: string
  tags?: string[] | null
  imagen?: string | null
  imagenAssetId?: number | null
  landmarkId?: number | null
  buildingIds?: number[] | null
  organizationIds?: number[] | null
  eventos?: CharacterApiEventDto[] | null
}

type OrganizationApiMemberDto = {
  personajeId: number
  nombre?: string | null
  profesion?: string | null
  raza?: string | null
  landmarkId?: number | null
  categoria?: string | null
}

type OrganizationApiDto = {
  id: number
  nombre: string
  descripcion?: string | null
  tags?: string[] | null
  imagen?: string | null
  imagenAssetId?: number | null
  categorias?: string[] | null
  edificios?: number[] | null
  miembros?: OrganizationApiMemberDto[] | null
  landmarks?: number[] | null
}

type LandmarkApiDto = {
  id: number
  icono?: string | null
  nombre: string
  tipo?: string | null
  estadoId?: number | null
  subdivisionId?: number | null
  escalaIcono?: number | null
  escalaTexto?: number | null
  mostrarLeyenda?: boolean | null
  posicion?: number[] | null
  tags?: string[] | null
  poblacion?: number | null
  descripcionCorta?: string | null
  historia?: string | null
  eventos?: LandmarkApiEventDto[] | null
  mapAssetId?: number | null
  mapAssetKind?: string | null
  mapRotationDegrees?: number | null
  mapGridEnabled?: boolean | null
  mapGridCellSize?: number | null
  mapGridOffsetX?: number | null
  mapGridOffsetY?: number | null
  organizationMapLinks?: string | null
  hiddenMapBuildings?: string | null
  mapa?: LandmarkApiMapDto | null
  edificios?: BuildingApiDto[] | null
  personajes?: CharacterApiDto[] | null
  organizaciones?: OrganizationApiDto[] | null
}

type LandmarkMapUpsertPayload =
  | { kind: "asset"; filename: string }
  | { kind: "embedded"; dataUrl: string }
  | { kind: "external"; url: string }
  | { kind: "stored"; key: string }
  | { kind: "buildings"; source: "asset"; filename: string }
  | { kind: "buildings"; source: "external"; url: string }

type OrganizationMapLinksPayload = Record<number, number[]>

type LandmarkEventUpsertPayload = {
  nombre: string
  descripcion: string
  fecha: string | null
  posicion: [number, number] | null
}

type LandmarkUpsertPayload = {
  icono: string
  nombre: string
  tipo: LandmarkType
  estadoId: number | null
  subdivisionId: number | null
  escalaIcono: number
  escalaTexto: number
  mostrarLeyenda: boolean
  posicion: [number, number]
  tags: string[]
  poblacion: number | null
  descripcionCorta: string | null
  historia: string | null
  eventos: LandmarkEventUpsertPayload[]
  mapRotationDegrees: number
  mapGridEnabled: boolean
  mapGridCellSize: number
  mapGridOffsetX: number
  mapGridOffsetY: number
  organizationMapLinks: string | null
  hiddenMapBuildings: string | null
  mapAssetId: number | null
  mapa: LandmarkMapUpsertPayload | null
}

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

function toOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function toNumberArray(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
}

function toPosition(value: number[] | null | undefined): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const x = Number(value[0])
  const y = Number(value[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return [x, y]
}

function dedupeNumbers(values: number[]) {
  return Array.from(new Set(values))
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values))
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isMediaAssetKind(value: unknown): value is MediaAssetKind {
  return value === "image" || value === "json" || value === "binary"
}

function toCharacterEvent(event: CharacterApiEventDto): CharacterEvent {
  return {
    sesion: event.sesion ?? "",
    descripcion: event.descripcion ?? "",
    fecha: toOptionalText(event.fecha),
  }
}

function toCharacter(dto: CharacterApiDto): Character {
  const imagenAssetId =
    typeof dto.imagenAssetId === "number" && Number.isFinite(dto.imagenAssetId) && dto.imagenAssetId > 0
      ? dto.imagenAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.nombre ?? "",
    clase: dto.clase ?? "",
    raza: dto.raza ?? "",
    descripcion: dto.descripcion ?? "",
    isPlayer: false,
    characterSheet: null,
    tags: toStringArray(dto.tags),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.imagen),
    imagenAssetId,
    landmarkId: typeof dto.landmarkId === "number" && dto.landmarkId > 0 ? dto.landmarkId : 0,
    buildingIds: toNumberArray(dto.buildingIds),
    organizationIds: toNumberArray(dto.organizationIds),
    eventos: Array.isArray(dto.eventos) ? dto.eventos.map(toCharacterEvent) : [],
  }
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

function toOrganizationMember(dto: OrganizationApiMemberDto): OrganizationMember {
  const characterId =
    typeof dto.personajeId === "number" && Number.isFinite(dto.personajeId) ? dto.personajeId : 0

  return {
    personajeId: characterId,
    nombre: toOptionalText(dto.nombre) ?? `Miembro ${characterId}`,
    profesion: toOptionalText(dto.profesion) ?? "",
    raza: toOptionalText(dto.raza) ?? "",
    landmarkId:
      typeof dto.landmarkId === "number" && Number.isFinite(dto.landmarkId) ? dto.landmarkId : 0,
    categoria: toOptionalText(dto.categoria) ?? "",
  }
}

function toOrganization(dto: OrganizationApiDto): Organization {
  const imagenAssetId =
    typeof dto.imagenAssetId === "number" && Number.isFinite(dto.imagenAssetId) && dto.imagenAssetId > 0
      ? dto.imagenAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.nombre ?? "",
    descripcion: dto.descripcion ?? "",
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.imagen),
    imagenAssetId,
    categorias: dedupeStrings(
      toStringArray(dto.categorias).map((category) => category.trim()).filter((category) => category.length > 0),
    ),
    edificios: dedupeNumbers(toNumberArray(dto.edificios)),
    miembros: Array.isArray(dto.miembros) ? dto.miembros.map(toOrganizationMember) : [],
    landmarks: dedupeNumbers(toNumberArray(dto.landmarks).filter((landmarkId) => landmarkId > 0)),
  }
}

function toLandmarkEvent(dto: LandmarkApiEventDto): LandmarkEvent {
  return {
    nombre: dto.nombre ?? "",
    descripcion: dto.descripcion ?? "",
    fecha: toOptionalText(dto.fecha),
    posicion: toPosition(dto.posicion),
  }
}

function toLandmarkMapReference(dto: LandmarkApiMapDto | null | undefined): LandmarkMapReference | undefined {
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

function toLandmark(dto: LandmarkApiDto): Landmark {
  const position = toPosition(dto.posicion) ?? [0.5, 0.5]
  const mapAssetId =
    typeof dto.mapAssetId === "number" && Number.isFinite(dto.mapAssetId) && dto.mapAssetId > 0
      ? dto.mapAssetId
      : undefined

  const estadoId =
    typeof dto.estadoId === "number" && Number.isFinite(dto.estadoId) && dto.estadoId > 0 ? dto.estadoId : undefined
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
    icono: dto.icono ?? "",
    nombre: dto.nombre ?? "",
    tipo: isLandmarkType(dto.tipo) ? dto.tipo : "ciudad",
    estadoId,
    subdivisionId,
    escalaIcono:
      typeof dto.escalaIcono === "number" && Number.isFinite(dto.escalaIcono) ? dto.escalaIcono : 1,
    escalaTexto:
      typeof dto.escalaTexto === "number" && Number.isFinite(dto.escalaTexto) ? dto.escalaTexto : 1,
    mostrarLeyenda: typeof dto.mostrarLeyenda === "boolean" ? dto.mostrarLeyenda : true,
    posicion: position,
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    poblacion:
      typeof dto.poblacion === "number" && Number.isFinite(dto.poblacion) ? Math.max(0, Math.round(dto.poblacion)) : undefined,
    descripcionCorta: toOptionalText(dto.descripcionCorta),
    historia: toOptionalText(dto.historia),
    eventos: Array.isArray(dto.eventos) ? dto.eventos.map(toLandmarkEvent) : [],
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
    mapa: toLandmarkMapReference(dto.mapa),
    edificios: Array.isArray(dto.edificios) ? dto.edificios.map(toBuilding) : [],
    personajes: Array.isArray(dto.personajes) ? dto.personajes.map(toCharacter) : [],
    organizaciones: Array.isArray(dto.organizaciones) ? dto.organizaciones.map(toOrganization) : [],
  }
}

function toLandmarkMapPayload(
  map: LandmarkMapReference | undefined,
): LandmarkMapUpsertPayload | null {
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

function toLandmarkUpsertPayload(input: Omit<Landmark, "id">): LandmarkUpsertPayload {
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
    icono: input.icono.trim(),
    nombre: input.nombre.trim(),
    tipo: input.tipo,
    estadoId,
    subdivisionId,
    escalaIcono:
      typeof input.escalaIcono === "number" && Number.isFinite(input.escalaIcono) ? input.escalaIcono : 1,
    escalaTexto:
      typeof input.escalaTexto === "number" && Number.isFinite(input.escalaTexto) ? input.escalaTexto : 1,
    mostrarLeyenda: Boolean(input.mostrarLeyenda),
    posicion: input.posicion,
    tags: dedupeStrings(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    poblacion:
      typeof input.poblacion === "number" && Number.isFinite(input.poblacion)
        ? Math.max(0, Math.round(input.poblacion))
        : null,
    descripcionCorta: toOptionalText(input.descripcionCorta) ?? null,
    historia: toOptionalText(input.historia) ?? null,
    eventos: input.eventos.map((event) => ({
      nombre: event.nombre.trim(),
      descripcion: event.descripcion.trim(),
      fecha: toOptionalText(event.fecha) ?? null,
      posicion: event.posicion ?? null,
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
    mapAssetId,
    mapa: mapAssetId ? null : toLandmarkMapPayload(input.mapa),
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

  const pendingRequest = backendRequest<LandmarkApiDto[]>(LANDMARKS_COLLECTION_PATH)
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

  const response = await backendRequest<LandmarkApiDto>(`/v1/landmarks/${landmarkId}?${LANDMARK_INCLUDE_QUERY}`)
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

  const response = await backendRequest<LandmarkReference[]>("/v1/landmarks")
  const references = response
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  writeLandmarkReferencesCache(references)
  return references
}

export async function createLandmark(input: Omit<Landmark, "id">): Promise<Landmark> {
  const response = await backendRequest<LandmarkApiDto>("/v1/landmarks", {
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
  await backendRequest<LandmarkApiDto>(`/v1/landmarks/${landmarkId}`, {
    method: "PUT",
    body: toLandmarkUpsertPayload(input),
  })

  landmarksCache = null
  landmarksPromise = null
  referencesCache = null
  return fetchLandmarkById(landmarkId, true)
}

export async function deleteLandmark(landmarkId: number): Promise<void> {
  await backendRequest<void>(`/v1/landmarks/${landmarkId}`, {
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
    "Desconocido"
  )
}
