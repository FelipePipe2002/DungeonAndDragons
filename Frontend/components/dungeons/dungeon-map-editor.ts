import { normalizeDungeonMapDocument } from "@/lib/dungeons/adapter"
import type {
  DungeonCorridor,
  DungeonDoorDirection,
  DungeonMapDocument,
  DungeonRoom,
  NormalizedDungeonMap,
} from "@/lib/dungeons/types"

export type Point = {
  x: number
  y: number
}

export type RoomSideAnchor = {
  type: "room-side"
  roomId: string
  point: Point
  direction: DungeonDoorDirection
}

type SearchNode = {
  point: Point
  cost: number
  estimate: number
  previousKey: string | null
  direction?: DungeonDoorDirection
}

export function pointKey(point: Point) {
  return `${point.x},${point.y}`
}

export function movePoint(point: Point, direction: DungeonDoorDirection): Point {
  if (direction === "east") return { x: point.x + 1, y: point.y }
  if (direction === "west") return { x: point.x - 1, y: point.y }
  if (direction === "south") return { x: point.x, y: point.y + 1 }
  return { x: point.x, y: point.y - 1 }
}

export function directionBetween(from: Point, to: Point): DungeonDoorDirection | undefined {
  if (to.x > from.x) return "east"
  if (to.x < from.x) return "west"
  if (to.y > from.y) return "south"
  if (to.y < from.y) return "north"
  return undefined
}

export function compressPath(points: Point[]) {
  if (points.length <= 2) return points
  const compressed = [points[0]]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = compressed[compressed.length - 1]
    const current = points[index]
    const next = points[index + 1]
    const sameColumn = previous.x === current.x && current.x === next.x
    const sameRow = previous.y === current.y && current.y === next.y
    if (sameColumn || sameRow) continue
    compressed.push(current)
  }

  compressed.push(points[points.length - 1])
  return compressed
}

export function compressPathPreservingPoints(points: Point[], preservedPoints: Point[]) {
  if (points.length <= 2) return points

  const preservedKeys = new Set(preservedPoints.map(pointKey))
  const compressed = [points[0]]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = compressed[compressed.length - 1]
    const current = points[index]
    const next = points[index + 1]
    const sameColumn = previous.x === current.x && current.x === next.x
    const sameRow = previous.y === current.y && current.y === next.y

    if ((sameColumn || sameRow) && !preservedKeys.has(pointKey(current))) continue
    compressed.push(current)
  }

  compressed.push(points[points.length - 1])
  return compressed
}

export function createNextCorridorId(corridors: NormalizedDungeonMap["corridors"]) {
  let nextNumericId = 1
  const existingIds = new Set(corridors.map((corridor) => corridor.id))

  for (const corridor of corridors) {
    const match = /^corr-(\d+)$/.exec(corridor.id)
    if (!match) continue
    const value = Number(match[1])
    if (!Number.isFinite(value)) continue
    nextNumericId = Math.max(nextNumericId, value + 1)
  }

  while (existingIds.has(`corr-${nextNumericId}`)) {
    nextNumericId += 1
  }

  return `corr-${nextNumericId}`
}

export function corridorCells(points: Point[]) {
  const cells: Point[] = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous.x === current.x) {
      const step = previous.y <= current.y ? 1 : -1
      for (let y = previous.y; y !== current.y + step; y += step) {
        if (index > 1 && y === previous.y) continue
        cells.push({ x: previous.x, y })
      }
      continue
    }

    if (previous.y === current.y) {
      const step = previous.x <= current.x ? 1 : -1
      for (let x = previous.x; x !== current.x + step; x += step) {
        if (index > 1 && x === previous.x) continue
        cells.push({ x, y: previous.y })
      }
    }
  }

  return cells
}

export function corridorCellKeySet(corridors: NormalizedDungeonMap["corridors"]) {
  const occupied = new Set<string>()
  for (const corridor of corridors) {
    for (const cell of corridorCells(corridor.points)) {
      occupied.add(pointKey(cell))
    }
  }
  return occupied
}

export function rebuildDoorsFromCorridors(
  dungeon: NormalizedDungeonMap,
  corridors: NormalizedDungeonMap["corridors"],
): NormalizedDungeonMap["doors"] {
  const roomByCell = new Map<string, NormalizedDungeonMap["rooms"][number]>()
  const nextDoors: NormalizedDungeonMap["doors"] = []
  const seenDoorKeys = new Set<string>()

  const addDoor = (roomId: string, x: number, y: number, direction: DungeonDoorDirection) => {
    const key = `${roomId}:${direction}:${x},${y}`
    if (seenDoorKeys.has(key)) return
    seenDoorKeys.add(key)
    nextDoors.push({
      id: `door-${nextDoors.length + 1}`,
      x,
      y,
      direction,
      kind: "door",
    })
  }

  const addDoorFromOutsideEndpoint = (point: Point) => {
    const westRoom = roomByCell.get(pointKey({ x: point.x - 1, y: point.y }))
    if (westRoom) {
      addDoor(westRoom.id, point.x - 1, point.y, "east")
      return
    }

    const eastRoom = roomByCell.get(pointKey({ x: point.x + 1, y: point.y }))
    if (eastRoom) {
      addDoor(eastRoom.id, point.x + 1, point.y, "west")
      return
    }

    const northRoom = roomByCell.get(pointKey({ x: point.x, y: point.y - 1 }))
    if (northRoom) {
      addDoor(northRoom.id, point.x, point.y - 1, "south")
      return
    }

    const southRoom = roomByCell.get(pointKey({ x: point.x, y: point.y + 1 }))
    if (southRoom) {
      addDoor(southRoom.id, point.x, point.y + 1, "north")
    }
  }

  for (const room of dungeon.rooms) {
    for (const cell of room.cells) {
      roomByCell.set(pointKey(cell), room)
    }
  }

  for (const corridor of corridors) {
    if (corridor.points.length < 2) continue

    const start = corridor.points[0]
    const startRoom = roomByCell.get(pointKey(start))
    if (startRoom) {
      const direction = directionBetween(start, corridor.points[1])
      if (direction) {
        addDoor(startRoom.id, start.x, start.y, direction)
      }
    } else {
      addDoorFromOutsideEndpoint(start)
    }

    const end = corridor.points[corridor.points.length - 1]
    const endRoom = roomByCell.get(pointKey(end))
    if (endRoom) {
      const direction = directionBetween(end, corridor.points[corridor.points.length - 2])
      if (direction) {
        addDoor(endRoom.id, end.x, end.y, direction)
      }
    } else {
      addDoorFromOutsideEndpoint(end)
    }
  }

  return nextDoors
}

export function normalizedDungeonToDocument(dungeon: NormalizedDungeonMap): DungeonMapDocument {
  const rooms: DungeonRoom[] = dungeon.rooms.map((room) => {
    if (
      room.spans.length === 1
      && room.spans[0].x === room.x
      && room.spans[0].y === room.y
      && room.spans[0].width === room.width
      && room.spans[0].height === room.height
    ) {
      return {
        id: room.id,
        kind: room.kind,
        shape: "rect",
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        label: room.label ?? undefined,
      }
    }

    return {
      id: room.id,
      kind: room.kind,
      shape: "composite",
      parts: room.spans,
      label: room.label ?? undefined,
    }
  })

  return {
    type: dungeon.type,
    version: dungeon.version,
    metadata: {
      name: dungeon.metadata.name ?? undefined,
      seed: dungeon.metadata.seed ?? undefined,
      generator: dungeon.metadata.generator ?? undefined,
      notes: dungeon.metadata.notes ?? undefined,
    },
    layout: {
      width: dungeon.bounds.width,
      height: dungeon.bounds.height,
      units: dungeon.bounds.units,
      origin: { x: dungeon.bounds.originX, y: dungeon.bounds.originY },
      rooms,
      corridors: dungeon.corridors.map((corridor) => ({ id: corridor.id, points: corridor.points, width: corridor.width ?? undefined })),
      doors: dungeon.doors.map((door) => ({ id: door.id, x: door.x, y: door.y, direction: door.direction, kind: door.kind })),
      markers: dungeon.markers.map((marker) => ({ id: marker.id, x: marker.x, y: marker.y, kind: marker.kind, label: marker.label ?? undefined })),
      lights: dungeon.lights.map((light) => ({
        id: light.id,
        x: light.x,
        y: light.y,
        kind: light.kind,
        label: light.label ?? undefined,
        enabled: light.enabled,
        brightRadiusCells: light.brightRadiusCells,
        dimRadiusCells: light.dimRadiusCells,
        mode: light.mode,
        placement: light.placement ?? undefined,
        wallMounted: light.wallMounted,
        orientation: light.orientation,
      })),
      props: dungeon.props.map((prop) => ({
        id: prop.id,
        shape: prop.shape,
        x: prop.x,
        y: prop.y,
        width: prop.width,
        height: prop.height,
        rotation: prop.rotation,
        color: prop.color,
        name: prop.name ?? undefined,
        image: prop.image ?? undefined,
        imageAssetId: prop.imageAssetId ?? undefined,
        hidden: prop.hidden,
      })),
    },
  }
}

export function buildEditedDungeonWithCorridors(
  dungeon: NormalizedDungeonMap,
  nextCorridors: Array<DungeonCorridor | NormalizedDungeonMap["corridors"][number]>,
) {
  const nextNormalizedCorridors: NormalizedDungeonMap["corridors"] = nextCorridors.map((corridor) => ({
    ...corridor,
    width: corridor.width ?? null,
  }))
  const nextDoors = rebuildDoorsFromCorridors(dungeon, nextNormalizedCorridors)
  const baseDocument = normalizedDungeonToDocument(dungeon)

  return normalizeDungeonMapDocument({
    ...baseDocument,
    layout: {
      ...baseDocument.layout,
      corridors: nextNormalizedCorridors.map((corridor) => ({
        id: corridor.id,
        points: corridor.points,
        width: corridor.width ?? undefined,
      })),
      doors: nextDoors,
    },
  })
}


export function pickRoomSideAnchor(
  room: NormalizedDungeonMap["rooms"][number],
  span: { x: number; y: number; width: number; height: number },
  pointer: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): RoomSideAnchor {
  const relativeX = Math.min(0.999999, Math.max(0, (pointer.clientX - rect.left) / Math.max(rect.width, 1)))
  const relativeY = Math.min(0.999999, Math.max(0, (pointer.clientY - rect.top) / Math.max(rect.height, 1)))
  const clickedPoint = {
    x: span.x + Math.floor(relativeX * span.width),
    y: span.y + Math.floor(relativeY * span.height),
  }

  return pickRoomSideAnchorFromPoint(room, clickedPoint)
}

export function pickRoomSideAnchorFromPoint(
  room: NormalizedDungeonMap["rooms"][number],
  clickedPoint: Point,
): RoomSideAnchor {

  const roomCellKeys = new Set(room.cells.map(pointKey))
  let bestAnchor: RoomSideAnchor | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const cell of room.cells) {
    const candidates: Array<{ direction: DungeonDoorDirection; outside: Point }> = [
      { direction: "west", outside: { x: cell.x - 1, y: cell.y } },
      { direction: "east", outside: { x: cell.x + 1, y: cell.y } },
      { direction: "north", outside: { x: cell.x, y: cell.y - 1 } },
      { direction: "south", outside: { x: cell.x, y: cell.y + 1 } },
    ]

    for (const candidate of candidates) {
      if (roomCellKeys.has(pointKey(candidate.outside))) continue
      const distance = Math.abs(cell.x - clickedPoint.x) + Math.abs(cell.y - clickedPoint.y)
      if (distance > bestDistance) continue

      if (distance === bestDistance && bestAnchor) {
        const currentOutsideDistance = Math.abs(candidate.outside.x - clickedPoint.x) + Math.abs(candidate.outside.y - clickedPoint.y)
        const bestOutside = movePoint(bestAnchor.point, bestAnchor.direction)
        const bestOutsideDistance = Math.abs(bestOutside.x - clickedPoint.x) + Math.abs(bestOutside.y - clickedPoint.y)
        if (currentOutsideDistance >= bestOutsideDistance) continue
      }

      bestDistance = distance
      bestAnchor = {
        type: "room-side",
        roomId: room.id,
        direction: candidate.direction,
        point: { x: cell.x, y: cell.y },
      }
    }
  }

  if (bestAnchor) return bestAnchor

  return {
    type: "room-side",
    roomId: room.id,
    direction: "east",
    point: clickedPoint,
  }
}

function heuristicDistance(from: Point, to: Point) {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y)
}

function reconstructPath(goalKey: string, bestByKey: Map<string, SearchNode>) {
  const path: Point[] = []
  let currentKey: string | null = goalKey

  while (currentKey) {
    const node = bestByKey.get(currentKey)
    if (!node) break
    path.push(node.point)
    currentKey = node.previousKey
  }

  path.reverse()
  return path
}

function getNeighborPoints(point: Point) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ]
}

function isPointWithinBounds(point: Point, bounds: NormalizedDungeonMap["bounds"]) {
  return !(
    point.x < bounds.originX
    || point.y < bounds.originY
    || point.x >= bounds.originX + bounds.width
    || point.y >= bounds.originY + bounds.height
  )
}

function neighborStepScore(
  current: SearchNode,
  neighbor: Point,
  preferredCorridorCells?: Set<string>,
) {
  const direction = directionBetween(current.point, neighbor)
  const turnPenalty = current.direction && direction && current.direction !== direction ? 0.35 : 0
  const corridorBonus = preferredCorridorCells?.has(pointKey(neighbor)) ? -0.2 : 0
  return {
    direction,
    costDelta: 1 + turnPenalty + corridorBonus,
  }
}

function findGridPathWeighted(
  start: Point,
  end: Point,
  bounds: NormalizedDungeonMap["bounds"],
  blockedRoomCells: Set<string>,
  preferredCorridorCells: Set<string> | undefined,
) {
  const frontier: SearchNode[] = [{
    point: start,
    cost: 0,
    estimate: heuristicDistance(start, end),
    previousKey: null,
  }]
  const bestByKey = new Map<string, SearchNode>([[pointKey(start), frontier[0]]])

  while (frontier.length > 0) {
    frontier.sort((first, second) => first.estimate - second.estimate || first.cost - second.cost)
    const current = frontier.shift()
    if (!current) break
    if (current.point.x === end.x && current.point.y === end.y) {
      return reconstructPath(pointKey(current.point), bestByKey)
    }

    for (const neighbor of getNeighborPoints(current.point)) {
      if (!isPointWithinBounds(neighbor, bounds)) continue

      const neighborKey = pointKey(neighbor)
      if (neighborKey !== pointKey(end) && blockedRoomCells.has(neighborKey)) continue

      const { direction, costDelta } = neighborStepScore(current, neighbor, preferredCorridorCells)
      const nextCost = current.cost + costDelta
      const previousBest = bestByKey.get(neighborKey)
      if (previousBest && previousBest.cost <= nextCost) continue

      const heuristic = heuristicDistance(neighbor, end)
      const estimate = nextCost + heuristic
      const node: SearchNode = {
        point: neighbor,
        cost: nextCost,
        estimate,
        previousKey: pointKey(current.point),
        direction,
      }
      bestByKey.set(neighborKey, node)
      frontier.push(node)
    }
  }

  return null
}

export function findGridPath(
  start: Point,
  end: Point,
  bounds: NormalizedDungeonMap["bounds"],
  blockedRoomCells: Set<string>,
  preferredCorridorCells?: Set<string>,
) {
  return findGridPathWeighted(start, end, bounds, blockedRoomCells, preferredCorridorCells)
}
