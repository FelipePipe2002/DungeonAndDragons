export type MapId = number

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
