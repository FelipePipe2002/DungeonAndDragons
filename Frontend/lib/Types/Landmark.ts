import type { Building } from "./Building"
import type { Character } from "./Character"
import type { MediaAssetId, MediaAssetKind } from "./MediaAsset"
import type { Organization } from "./Organization"

export type LandmarkId = number

export const DUNGEON_MAP_JSON_TYPE = "mazmorra"
export const DUNGEON_MAP_JSON_VERSION = 1
export const DUNGEON_MAP_ERROR_MESSAGE = 'Las mazmorras solo permiten imagenes o JSON con type="mazmorra".'

export interface DungeonMapJsonContract {
  type: typeof DUNGEON_MAP_JSON_TYPE
  version?: number
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

export type LandmarkMapReference =
  | { kind: "asset"; filename: string }
  | { kind: "embedded"; dataUrl: string }
  | { kind: "external"; url: string }
  | { kind: "stored"; key: string }
  | { kind: "buildings"; source: "asset"; filename: string }
  | { kind: "buildings"; source: "external"; url: string }

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
  mapRotationDegrees?: number
  mapGridEnabled?: boolean
  mapGridCellSize?: number
  mapGridOffsetX?: number
  mapGridOffsetY?: number
  organizationMapLinks?: Record<number, number[]>
  hiddenMapBuildings?: number[]
  mapa?: LandmarkMapReference
  edificios: Building[]
  personajes: Character[]
  organizaciones: Organization[]
}
