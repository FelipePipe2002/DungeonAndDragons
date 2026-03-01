import type { BuildingId } from "./Building"
import type { CharacterId } from "./Character"
import type { LandmarkId } from "./Landmark"
import type { MediaAssetId } from "./MediaAsset"

export type OrganizationId = number

export interface OrganizationMember {
  personajeId: CharacterId
  nombre: string
  profesion: string
  raza: string
  landmarkId: LandmarkId
  categoria: string
}

export interface Organization {
  id: OrganizationId
  nombre: string
  descripcion: string
  tags: string[]
  imagen?: string
  imagenAssetId?: MediaAssetId
  categorias: string[]
  edificios: BuildingId[]
  miembros: OrganizationMember[]
  landmarks: LandmarkId[]
}
