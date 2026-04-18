import type { DungeonMapPoint, DungeonRoom } from "../types.ts"
import { buildRoomSpatialLookup, roomCells, roomIndexForPoint } from "./core.ts"

export type { RoomSpatialLookup as SpatialIndex } from "./core.ts"

export function createSpatialIndex(rooms: DungeonRoom[]) {
  return buildRoomSpatialLookup(rooms)
}

export function roomOwnerIndex(index: ReturnType<typeof createSpatialIndex>, point: DungeonMapPoint) {
  return roomIndexForPoint(index, point)
}

export { roomCells }
