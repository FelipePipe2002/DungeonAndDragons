import type { CharacterId } from "./Character"
import type { LandmarkId } from "./Landmark"
import type { OrganizationId } from "./Organization"

export type BuildingId = number

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
