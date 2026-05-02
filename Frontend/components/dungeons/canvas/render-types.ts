import type { NormalizedDungeonMap } from "@/lib/dungeons/types"

export type CanvasPoint = {
  x: number
  y: number
}

export type RenderOrigin = {
  x: number
  y: number
}

export type PixelRect = {
  left: number
  top: number
  width: number
  height: number
}

export type CorridorRenderSegment = {
  point: CanvasPoint
  left: number
  top: number
  width: number
  height: number
}

export type DungeonDisplayStyle = {
  roomColor: string
  corridorColor: string
  roomTextureUrl?: string
  corridorTextureUrl?: string
  roomTextureUrls?: string[]
  corridorTextureUrls?: string[]
  roomTextureRandomRotation?: boolean
  corridorTextureRandomRotation?: boolean
  doorColor: string
  showCorridorWalls: boolean
  wallWidth: number
  corridorWallColor: string
  roomWallColor: string
  imageSmoothingEnabled: boolean
  snapGridToPixel: boolean
}

export type DungeonCamera = {
  scale: number
  offset: CanvasPoint
}

export const BASE_CELL_SIZE = 32
export const ROOM_SPAN_OVERLAP_PX = 1
export const DOOR_VISUAL_THICKNESS = 0.22
export const CORRIDOR_WALL_THICKNESS = 0.18
export const HOME_PADDING_PX = 40
export const MIN_SCALE = 0.2
export const MAX_SCALE = 4
export const ZOOM_SENSITIVITY = 0.0015

export const DEFAULT_DUNGEON_DISPLAY_STYLE: DungeonDisplayStyle = {
  roomColor: "#c7a675",
  corridorColor: "#d5ba8e",
  roomTextureUrl: "",
  corridorTextureUrl: "",
  roomTextureUrls: [],
  corridorTextureUrls: [],
  roomTextureRandomRotation: false,
  corridorTextureRandomRotation: false,
  doorColor: "#426ea5",
  showCorridorWalls: true,
  wallWidth: CORRIDOR_WALL_THICKNESS,
  corridorWallColor: "#5a4631",
  roomWallColor: "#4a3a2a",
  imageSmoothingEnabled: false,
  snapGridToPixel: true,
}

export type DungeonViewport = {
  width: number
  height: number
}

export function renderOriginFromDungeon(dungeon: NormalizedDungeonMap | null): RenderOrigin {
  return {
    x: dungeon?.bounds.originX ?? 0,
    y: dungeon?.bounds.originY ?? 0,
  }
}
