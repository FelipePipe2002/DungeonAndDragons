import type { BuildingId } from "./Building"
import type { CharacterSheet } from "./CharacterSheet"
import type { LandmarkId } from "./Landmark"
import type { MediaAssetId } from "./MediaAsset"
import type { OrganizationId } from "./Organization"

export type CharacterId = number

export interface CharacterEvent {
  sesion: string
  descripcion: string
  fecha?: string
}

export interface Character {
  id: CharacterId
  nombre: string
  clase: string
  raza: string
  descripcion: string
  isPlayer: boolean
  characterSheet: CharacterSheet | null
  tags: string[]
  imagen?: string
  imagenAssetId?: MediaAssetId
  tokenImageFocusX?: number
  tokenImageFocusY?: number
  tokenImageZoom?: number
  initiativeImageFocusX?: number
  initiativeImageFocusY?: number
  initiativeImageZoom?: number
  landmarkId: LandmarkId
  buildingIds: BuildingId[]
  organizationIds: OrganizationId[]
  eventos: CharacterEvent[]
}
