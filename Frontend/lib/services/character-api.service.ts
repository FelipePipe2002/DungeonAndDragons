import { normalizeCharacterSheet } from "@/lib/character-sheet"
import type { Character, CharacterEvent, CharacterSheet } from "@/lib/types"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRequest } from "@/lib/services/backend-api.service"
import {
  fetchLandmarkReferences,
  type LandmarkReference,
} from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"

export type CharacterLandmarkReference = LandmarkReference

export interface CharacterBuildingReference {
  id: number
  nombre: string
  landmarkId: number | null
  duenoId?: number | null
}

export interface CharacterOrganizationReference {
  id: number
  nombre: string
  landmarks: number[]
}

export interface CharacterReferences {
  landmarks: CharacterLandmarkReference[]
  buildings: CharacterBuildingReference[]
  organizations: CharacterOrganizationReference[]
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
  isPlayer?: boolean | null
  characterSheet?: CharacterSheet | null
  tags?: string[] | null
  imagen?: string | null
  imagenAssetId?: number | null
  tokenImageFocusX?: number | null
  tokenImageFocusY?: number | null
  tokenImageZoom?: number | null
  initiativeImageFocusX?: number | null
  initiativeImageFocusY?: number | null
  initiativeImageZoom?: number | null
  landmarkId?: number | null
  buildingIds?: number[] | null
  organizationIds?: number[] | null
  eventos?: CharacterApiEventDto[] | null
}

type CharacterUpsertPayload = {
  nombre: string
  clase: string
  raza: string
  descripcion: string
  isPlayer: boolean
  characterSheet: CharacterSheet | null
  tags: string[]
  imagen: string | null
  imagenAssetId: number | null
  tokenImageFocusX: number | null
  tokenImageFocusY: number | null
  tokenImageZoom: number | null
  initiativeImageFocusX: number | null
  initiativeImageFocusY: number | null
  initiativeImageZoom: number | null
  landmarkId: number | null
  buildingIds: number[]
  organizationIds: number[]
  eventos: CharacterApiEventDto[]
}

type BuildingRefDto = {
  id: number
  nombre: string
  landmarkId?: number | null
  duenoId?: number | null
}

let charactersCache: Character[] | null = null
let charactersPromise: Promise<Character[]> | null = null
const characterByIdCache = new Map<number, Character>()

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
    isPlayer: dto.isPlayer === true,
    characterSheet: normalizeCharacterSheet(dto.characterSheet ?? null, {
      nombre: dto.nombre ?? "",
      raza: dto.raza ?? "",
      clase: dto.clase ?? "",
    }),
    tags: toStringArray(dto.tags),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.imagen),
    imagenAssetId,
    tokenImageFocusX:
      typeof dto.tokenImageFocusX === "number" && Number.isFinite(dto.tokenImageFocusX)
        ? dto.tokenImageFocusX
        : undefined,
    tokenImageFocusY:
      typeof dto.tokenImageFocusY === "number" && Number.isFinite(dto.tokenImageFocusY)
        ? dto.tokenImageFocusY
        : undefined,
    tokenImageZoom:
      typeof dto.tokenImageZoom === "number" && Number.isFinite(dto.tokenImageZoom) ? dto.tokenImageZoom : undefined,
    initiativeImageFocusX:
      typeof dto.initiativeImageFocusX === "number" && Number.isFinite(dto.initiativeImageFocusX)
        ? dto.initiativeImageFocusX
        : undefined,
    initiativeImageFocusY:
      typeof dto.initiativeImageFocusY === "number" && Number.isFinite(dto.initiativeImageFocusY)
        ? dto.initiativeImageFocusY
        : undefined,
    initiativeImageZoom:
      typeof dto.initiativeImageZoom === "number" && Number.isFinite(dto.initiativeImageZoom)
        ? dto.initiativeImageZoom
        : undefined,
    landmarkId: typeof dto.landmarkId === "number" && dto.landmarkId > 0 ? dto.landmarkId : 0,
    buildingIds: toNumberArray(dto.buildingIds),
    organizationIds: toNumberArray(dto.organizationIds),
    eventos: Array.isArray(dto.eventos) ? dto.eventos.map(toCharacterEvent) : [],
  }
}

function toCharacterUpsertPayload(input: Omit<Character, "id">): CharacterUpsertPayload {
  const imagenAssetId =
    typeof input.imagenAssetId === "number" && Number.isFinite(input.imagenAssetId) && input.imagenAssetId > 0
      ? input.imagenAssetId
      : null

  return {
    nombre: input.nombre.trim(),
    clase: input.clase.trim(),
    raza: input.raza.trim(),
    descripcion: input.descripcion.trim(),
    isPlayer: input.isPlayer === true,
    characterSheet: normalizeCharacterSheet(input.characterSheet, {
      nombre: input.nombre,
      raza: input.raza,
      clase: input.clase,
    }),
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))),
    imagen: imagenAssetId ? null : toOptionalText(input.imagen) ?? null,
    imagenAssetId,
    tokenImageFocusX:
      typeof input.tokenImageFocusX === "number" && Number.isFinite(input.tokenImageFocusX)
        ? input.tokenImageFocusX
        : null,
    tokenImageFocusY:
      typeof input.tokenImageFocusY === "number" && Number.isFinite(input.tokenImageFocusY)
        ? input.tokenImageFocusY
        : null,
    tokenImageZoom:
      typeof input.tokenImageZoom === "number" && Number.isFinite(input.tokenImageZoom) ? input.tokenImageZoom : null,
    initiativeImageFocusX:
      typeof input.initiativeImageFocusX === "number" && Number.isFinite(input.initiativeImageFocusX)
        ? input.initiativeImageFocusX
        : null,
    initiativeImageFocusY:
      typeof input.initiativeImageFocusY === "number" && Number.isFinite(input.initiativeImageFocusY)
        ? input.initiativeImageFocusY
        : null,
    initiativeImageZoom:
      typeof input.initiativeImageZoom === "number" && Number.isFinite(input.initiativeImageZoom)
        ? input.initiativeImageZoom
        : null,
    landmarkId: input.landmarkId > 0 ? input.landmarkId : null,
    buildingIds: Array.from(new Set(input.buildingIds)),
    organizationIds: Array.from(new Set(input.organizationIds)),
    eventos: input.eventos.map((event) => ({
      sesion: event.sesion.trim(),
      descripcion: event.descripcion.trim(),
      fecha: toOptionalText(event.fecha) ?? null,
    })),
  }
}

async function fetchCharacterBuildingReferences(): Promise<CharacterBuildingReference[]> {
  const response = await backendRequest<BuildingRefDto[]>("/v1/buildings")
  return response
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      landmarkId: typeof item.landmarkId === "number" && item.landmarkId > 0 ? item.landmarkId : null,
      duenoId: typeof item.duenoId === "number" && item.duenoId > 0 ? item.duenoId : null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

async function fetchCharacterOrganizationReferences(
  forceRefresh = false,
): Promise<CharacterOrganizationReference[]> {
  const response = await fetchOrganizations(forceRefresh)
  return response
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      landmarks: toNumberArray(item.landmarks),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

export async function fetchCharacterReferences(forceRefresh = false): Promise<CharacterReferences> {
  const [landmarks, buildings, organizations] = await Promise.all([
    fetchLandmarkReferences(forceRefresh),
    fetchCharacterBuildingReferences(),
    fetchCharacterOrganizationReferences(forceRefresh),
  ])
  return { landmarks, buildings, organizations }
}

export async function fetchCharacters(forceRefresh = false): Promise<Character[]> {
  if (!forceRefresh && charactersCache) {
    return charactersCache
  }

  if (!forceRefresh && charactersPromise) {
    return charactersPromise
  }

  const pendingRequest = backendRequest<CharacterApiDto[]>("/v1/characters")
    .then((response) => {
      const characters = response.map(toCharacter)
      characterByIdCache.clear()
      for (const character of characters) {
        characterByIdCache.set(character.id, character)
      }
      charactersCache = characters
      return characters
    })
    .finally(() => {
      charactersPromise = null
    })

  charactersPromise = pendingRequest
  return pendingRequest
}

export async function fetchCharacterById(characterId: number): Promise<Character> {
  const cached = characterByIdCache.get(characterId)
  if (cached) {
    return cached
  }

  const response = await backendRequest<CharacterApiDto>(`/v1/characters/${characterId}`)
  const character = toCharacter(response)
  characterByIdCache.set(character.id, character)
  return character
}

export async function createCharacter(input: Omit<Character, "id">): Promise<Character> {
  const response = await backendRequest<CharacterApiDto>("/v1/characters", {
    method: "POST",
    body: toCharacterUpsertPayload(input),
  })

  charactersCache = null
  charactersPromise = null
  const character = toCharacter(response)
  characterByIdCache.set(character.id, character)
  return character
}

export async function updateCharacter(characterId: number, input: Omit<Character, "id">): Promise<Character> {
  const response = await backendRequest<CharacterApiDto>(`/v1/characters/${characterId}`, {
    method: "PUT",
    body: toCharacterUpsertPayload(input),
  })

  charactersCache = null
  charactersPromise = null
  const character = toCharacter(response)
  characterByIdCache.set(character.id, character)
  return character
}

export async function deleteCharacter(characterId: number): Promise<void> {
  await backendRequest<void>(`/v1/characters/${characterId}`, {
    method: "DELETE",
  })

  charactersCache = null
  charactersPromise = null
  characterByIdCache.delete(characterId)
}
