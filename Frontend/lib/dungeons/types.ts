export const DUNGEON_MAP_DOCUMENT_TYPE = "mazmorra"
export const DUNGEON_MAP_DOCUMENT_VERSION = 1
export const DUNGEON_MAP_DEFAULT_UNITS = "tile"

export type DungeonMapPoint = {
  x: number
  y: number
}

export type DungeonRoomMask = {
  width: number
  height: number
  cells: number[][]
}

export type DungeonRoomCellRect = {
  x: number
  y: number
  width: number
  height: number
}

export type DungeonMapMetadata = {
  name?: string
  seed?: string | number
  generator?: string
  notes?: string
}

export type DungeonRoomKind = "room" | "start" | "boss" | "treasure" | "hall" | "custom"
export type DungeonRoomShape = "rect" | "composite" | "mask"

export type DungeonRectRoom = {
  id: string
  kind?: DungeonRoomKind
  shape: "rect"
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export type DungeonCompositeRoom = {
  id: string
  kind?: DungeonRoomKind
  shape: "composite"
  parts: DungeonRoomCellRect[]
  label?: string
}

export type DungeonMaskRoom = {
  id: string
  kind?: DungeonRoomKind
  shape: "mask"
  x: number
  y: number
  mask: DungeonRoomMask
  label?: string
}

export type DungeonRoom = DungeonRectRoom | DungeonCompositeRoom | DungeonMaskRoom

export type DungeonCorridor = {
  id: string
  points: DungeonMapPoint[]
  width?: number
}

export type DungeonDoorDirection = "north" | "south" | "east" | "west"
export type DungeonDoorKind = "door" | "locked" | "secret"

export type DungeonDoor = {
  id: string
  x: number
  y: number
  direction?: DungeonDoorDirection
  kind?: DungeonDoorKind
}

export type DungeonMarker = {
  id: string
  x: number
  y: number
  kind: string
  label?: string
}

export type DungeonLightKind = "torch" | "magic" | "ambient"
export type DungeonLightMode = "radius" | "line-of-sight"
export type DungeonLightPlacement = "generated" | "manual"
export type DungeonLightOrientation = "north" | "east" | "south" | "west"

export type DungeonLightSource = {
  id: string
  x: number
  y: number
  kind: DungeonLightKind
  label?: string
  enabled?: boolean
  brightRadiusCells: number
  dimRadiusCells: number
  mode: DungeonLightMode
  placement?: DungeonLightPlacement
  wallMounted?: boolean
  orientation?: DungeonLightOrientation
}

export type DungeonMapLayout = {
  width: number
  height: number
  units?: "tile" | "cell"
  origin?: DungeonMapPoint
  rooms: DungeonRoom[]
  corridors?: DungeonCorridor[]
  doors?: DungeonDoor[]
  markers?: DungeonMarker[]
  lights?: DungeonLightSource[]
}

export type DungeonMapDocument = {
  type: typeof DUNGEON_MAP_DOCUMENT_TYPE
  version: typeof DUNGEON_MAP_DOCUMENT_VERSION
  metadata?: DungeonMapMetadata
  layout: DungeonMapLayout
}

export type NormalizedDungeonMapMetadata = {
  name: string | null
  seed: string | number | null
  generator: string | null
  notes: string | null
}

export type NormalizedDungeonRoom = {
  id: string
  kind: DungeonRoomKind
  shape: DungeonRoomShape
  x: number
  y: number
  width: number
  height: number
  cells: DungeonMapPoint[]
  spans: DungeonRoomCellRect[]
  labelAnchor: DungeonMapPoint
  label: string | null
}

export type NormalizedDungeonCorridor = {
  id: string
  points: DungeonMapPoint[]
  width: number | null
}

export type NormalizedDungeonDoor = {
  id: string
  x: number
  y: number
  direction: DungeonDoorDirection
  kind: DungeonDoorKind
}

export type NormalizedDungeonMarker = {
  id: string
  x: number
  y: number
  kind: string
  label: string | null
}

export type NormalizedDungeonLightSource = {
  id: string
  x: number
  y: number
  kind: DungeonLightKind
  label: string | null
  enabled: boolean
  brightRadiusCells: number
  dimRadiusCells: number
  mode: DungeonLightMode
  placement: DungeonLightPlacement | null
  wallMounted: boolean
  orientation: DungeonLightOrientation
}

export type NormalizedDungeonMap = {
  type: typeof DUNGEON_MAP_DOCUMENT_TYPE
  version: typeof DUNGEON_MAP_DOCUMENT_VERSION
  metadata: NormalizedDungeonMapMetadata
  bounds: {
    width: number
    height: number
    originX: number
    originY: number
    units: "tile" | "cell"
  }
  rooms: NormalizedDungeonRoom[]
  corridors: NormalizedDungeonCorridor[]
  doors: NormalizedDungeonDoor[]
  markers: NormalizedDungeonMarker[]
  lights: NormalizedDungeonLightSource[]
}
