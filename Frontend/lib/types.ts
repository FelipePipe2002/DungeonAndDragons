export type LandmarkId = number
export type BuildingId = number
export type CharacterId = number
export type OrganizationId = number
export type MediaAssetId = number
export type MapId = number

export type MediaAssetKind = "image" | "json" | "binary"

export interface MediaAssetMetadata {
  id: MediaAssetId
  kind: MediaAssetKind
  filename: string
  contentType: string
  byteSize: number
  downloadUrl: string
  createdAt?: string
  updatedAt?: string
}

export type LandmarkType =
  | "ciudad"
  | "pueblo"
  | "aldea"
  | "fuerte"
  | "puente"
  | "bandera"
  | "campamento"
  | "mazmorra"

export interface LandmarkEvent {
  nombre: string
  descripcion: string
  fecha?: string
  posicion?: [number, number]
}

export type LandmarkMapReference = { kind: 'asset', filename: string } 
                                | { kind: 'embedded', dataUrl: string } 
                                | { kind: 'external', url: string } 
                                | { kind: 'stored', key: string }
                                | { kind: 'buildings', source: 'asset', filename: string }
                                | { kind: 'buildings', source: 'external', url: string }


export interface CharacterEvent {
  sesion: string
  descripcion: string
  fecha?: string
}

export interface OrganizationMember {
  personajeId: CharacterId
  nombre: string
  profesion: string
  raza: string
  landmarkId: LandmarkId
  categoria: string
}

export interface Building {
  id: BuildingId
  landmarkId: LandmarkId | null
  nombre: string
  posicion?: [number, number]
  descripcion: string
  tags: string[]
  duenoId?: CharacterId
  duenoNombre?: string
  mapBuildingIndex?: number
  organizationId?: OrganizationId
}

export interface Character {
  id: CharacterId
  nombre: string
  clase: string
  raza: string
  descripcion: string
  tags: string[]
  imagen?: string
  imagenAssetId?: MediaAssetId
  landmarkId: LandmarkId
  buildingIds: BuildingId[]
  organizationIds: OrganizationId[]
  eventos: CharacterEvent[]
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

export interface Landmark {
  id: LandmarkId
  icono: string
  nombre: string
  tipo: LandmarkType
  escalaIcono: number
  escalaTexto: number
  mostrarLeyenda: boolean
  posicion: [number, number]
  tags: string[]
  poblacion?: number
  descripcionCorta?: string
  historia?: string
  eventos: LandmarkEvent[]
  mapAssetId?: MediaAssetId
  mapAssetKind?: MediaAssetKind
  mapa?: LandmarkMapReference
  edificios: Building[]
  personajes: Character[]
  organizaciones: Organization[]
}

export interface TerritoryDefinition {
  id: string
  name: string
  posicion: [number, number]
  width: number
  height: number
  nextMapId?: MapId
}

export interface MapDefinition {
  id: MapId
  name: string
  imageUrl: string
  minScale?: number
  maxScale?: number
  initialScale?: number
  territories?: TerritoryDefinition[]
}
