import type { DungeonCorridor, DungeonDoor, DungeonDoorDirection, DungeonMapPoint, DungeonRoom } from "../types.ts"

type DoorRebuildHelpers = {
  buildRoomSpatialLookup: (rooms: DungeonRoom[]) => { roomIndexByCell: Map<string, number> }
  roomIndexForPoint: (lookup: { roomIndexByCell: Map<string, number> }, point: DungeonMapPoint) => number
  compressPolylinePoints: (points: DungeonMapPoint[]) => DungeonMapPoint[]
}

export function directionBetween(from: DungeonMapPoint, to: DungeonMapPoint): DungeonDoorDirection | undefined {
  if (to.x > from.x) return "east"
  if (to.x < from.x) return "west"
  if (to.y > from.y) return "south"
  if (to.y < from.y) return "north"
  return undefined
}

export function rebuildDoorsFromCorridors(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  doors: DungeonDoor[],
  helpers: DoorRebuildHelpers,
) {
  const nextDoors: DungeonDoor[] = []
  const seenCells = new Set<string>()
  const seenRoomSides = new Set<string>()
  const roomLookup = helpers.buildRoomSpatialLookup(rooms)

  for (const corridor of corridors) {
    if (corridor.points.length < 2) continue

    const start = corridor.points[0]
    const firstStep = corridor.points[1] ?? start
    const startDirection = directionBetween(start, firstStep)
    if (startDirection) {
      const key = `${start.x},${start.y}`
      const roomIndex = helpers.roomIndexForPoint(roomLookup, start)
      if (roomIndex >= 0) {
        const roomSideKey = `${rooms[roomIndex].id}:${startDirection}`
        if (!seenCells.has(key) && !seenRoomSides.has(roomSideKey)) {
          seenCells.add(key)
          seenRoomSides.add(roomSideKey)
          nextDoors.push({
            id: `door-${nextDoors.length + 1}`,
            x: start.x,
            y: start.y,
            direction: startDirection,
            kind: "door",
          })
        }
      }
    }

    const end = corridor.points[corridor.points.length - 1]
    const beforeEnd = corridor.points[corridor.points.length - 2] ?? end
    const endDirection = directionBetween(end, beforeEnd)
    if (endDirection) {
      const key = `${end.x},${end.y}`
      const roomIndex = helpers.roomIndexForPoint(roomLookup, end)
      if (roomIndex >= 0) {
        const roomSideKey = `${rooms[roomIndex].id}:${endDirection}`
        if (!seenCells.has(key) && !seenRoomSides.has(roomSideKey)) {
          seenCells.add(key)
          seenRoomSides.add(roomSideKey)
          nextDoors.push({
            id: `door-${nextDoors.length + 1}`,
            x: end.x,
            y: end.y,
            direction: endDirection,
            kind: "door",
          })
        }
      }
    }
  }

  doors.length = 0
  doors.push(...nextDoors)
}

export function normalizeCorridorEndpointsToRooms(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  helpers: DoorRebuildHelpers,
) {
  const roomLookup = helpers.buildRoomSpatialLookup(rooms)

  const findRoomContactFromStart = (points: DungeonMapPoint[]) => {
    for (let index = 0; index < points.length; index += 1) {
      if (helpers.roomIndexForPoint(roomLookup, points[index]) >= 0) return index
    }
    return -1
  }

  const findRoomContactFromEnd = (points: DungeonMapPoint[]) => {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      if (helpers.roomIndexForPoint(roomLookup, points[index]) >= 0) return index
    }
    return -1
  }

  for (const corridor of corridors) {
    if (corridor.points.length < 2) continue

    const startIndex = findRoomContactFromStart(corridor.points)
    const endIndex = findRoomContactFromEnd(corridor.points)
    if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) continue

    if (startIndex > 0 || endIndex < corridor.points.length - 1) {
      corridor.points = helpers.compressPolylinePoints(corridor.points.slice(startIndex, endIndex + 1))
    }
  }
}
