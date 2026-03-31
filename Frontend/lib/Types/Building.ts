import type { CharacterId } from "./Character"
import type { LandmarkId } from "./Landmark"
import type { MediaAssetId, MediaAssetKind } from "./MediaAsset"
import type { OrganizationId } from "./Organization"

export type BuildingId = number

export type BuildingMapReference =
  | { kind: "asset"; filename: string }
  | { kind: "embedded"; dataUrl: string }
  | { kind: "external"; url: string }
  | { kind: "stored"; key: string }

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
  mapAssetId?: MediaAssetId
  mapAssetKind?: MediaAssetKind
  mapRotationDegrees?: number
  mapGridEnabled?: boolean
  mapGridCellSize?: number
  mapGridOffsetX?: number
  mapGridOffsetY?: number
  mapa?: BuildingMapReference
}
