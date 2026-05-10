import type { NormalizedDungeonMap } from "@/lib/dungeons/types"

import {
  BASE_CELL_SIZE,
  CORRIDOR_WALL_THICKNESS,
  DOOR_VISUAL_THICKNESS,
  ROOM_SPAN_OVERLAP_PX,
  type CanvasPoint,
  type CorridorRenderSegment,
  type RenderOrigin,
} from "./render-types"

type CellRect = { x: number; y: number; width: number; height: number }

export type CellDirection = "north" | "south" | "west" | "east"

export function roomLabelPixelPosition(
  room: NormalizedDungeonMap["rooms"][number],
  renderOrigin: RenderOrigin,
  cellSize = BASE_CELL_SIZE,
) {
  return {
    x: (room.labelAnchor.x - renderOrigin.x) * cellSize,
    y: (room.labelAnchor.y - renderOrigin.y) * cellSize,
  }
}

export function roomSpanPixelRect(
  span: CellRect,
  renderOrigin: RenderOrigin,
  cellSize = BASE_CELL_SIZE,
  overlapPx = ROOM_SPAN_OVERLAP_PX,
) {
  const left = (span.x - renderOrigin.x) * cellSize
  const top = (span.y - renderOrigin.y) * cellSize
  const width = span.width * cellSize
  const height = span.height * cellSize

  return {
    left: left - overlapPx / 2,
    top: top - overlapPx / 2,
    width: width + overlapPx,
    height: height + overlapPx,
  }
}

export function doorPixelRect(
  door: NormalizedDungeonMap["doors"][number],
  renderOrigin: RenderOrigin,
  cellSize = BASE_CELL_SIZE,
  thickness = DOOR_VISUAL_THICKNESS,
  wallThickness = CORRIDOR_WALL_THICKNESS,
) {
  const normalizedWallThickness = Number.isFinite(wallThickness)
    ? Math.min(0.48, Math.max(0.02, wallThickness))
    : CORRIDOR_WALL_THICKNESS
  const length = Math.max(0.12, 1 - normalizedWallThickness * 2)
  const cellX = door.x - renderOrigin.x
  const cellY = door.y - renderOrigin.y

  if (door.direction === "east") {
    return {
      left: (cellX + 1 - thickness / 2) * cellSize,
      top: (cellY + 0.5 - length / 2) * cellSize,
      width: thickness * cellSize,
      height: length * cellSize,
    }
  }

  if (door.direction === "west") {
    return {
      left: (cellX - thickness / 2) * cellSize,
      top: (cellY + 0.5 - length / 2) * cellSize,
      width: thickness * cellSize,
      height: length * cellSize,
    }
  }

  if (door.direction === "south") {
    return {
      left: (cellX + 0.5 - length / 2) * cellSize,
      top: (cellY + 1 - thickness / 2) * cellSize,
      width: length * cellSize,
      height: thickness * cellSize,
    }
  }

  return {
    left: (cellX + 0.5 - length / 2) * cellSize,
    top: (cellY - thickness / 2) * cellSize,
    width: length * cellSize,
    height: thickness * cellSize,
  }
}

export function doorDrawPixelRect(
  door: NormalizedDungeonMap["doors"][number],
  renderOrigin: RenderOrigin,
  cellSize = BASE_CELL_SIZE,
  wallThickness = CORRIDOR_WALL_THICKNESS,
) {
  const rect = doorPixelRect(door, renderOrigin, cellSize, DOOR_VISUAL_THICKNESS, wallThickness)
  const normalizedWallThickness = Number.isFinite(wallThickness)
    ? Math.min(0.48, Math.max(0.02, wallThickness))
    : CORRIDOR_WALL_THICKNESS
  const wallThicknessPx = Math.max(1, Math.round(normalizedWallThickness * cellSize))

  if (door.direction === "east") {
    rect.left += wallThicknessPx / 2
  } else if (door.direction === "west") {
    rect.left -= wallThicknessPx / 2
  } else if (door.direction === "south") {
    rect.top += wallThicknessPx / 2
  } else {
    rect.top -= wallThicknessPx / 2
  }

  return rect
}

export function buildCorridorSegments(
  points: Array<{ x: number; y: number }>,
  width: number,
  roomOccupiedCells: Set<string>,
): CorridorRenderSegment[] {
  const occupiedCells = new Map<string, { x: number; y: number }>()
  const safeWidth = Math.max(1, Math.round(width))
  const offsetMin = -Math.floor((safeWidth - 1) / 2)
  const offsetMax = offsetMin + safeWidth - 1

  const occupy = (x: number, y: number) => {
    if (roomOccupiedCells.has(`${x},${y}`)) return
    for (let offsetY = offsetMin; offsetY <= offsetMax; offsetY += 1) {
      for (let offsetX = offsetMin; offsetX <= offsetMax; offsetX += 1) {
        occupiedCells.set(`${x + offsetX},${y + offsetY}`, { x: x + offsetX, y: y + offsetY })
      }
    }
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]

    if (previous.x === current.x) {
      const start = Math.min(previous.y, current.y)
      const end = Math.max(previous.y, current.y)
      for (let y = start; y <= end; y += 1) {
        if (index > 1 && y === previous.y) continue
        occupy(previous.x, y)
      }
      continue
    }

    if (previous.y === current.y) {
      const start = Math.min(previous.x, current.x)
      const end = Math.max(previous.x, current.x)
      for (let x = start; x <= end; x += 1) {
        if (index > 1 && x === previous.x) continue
        occupy(x, previous.y)
      }
    }
  }

  const segments: CorridorRenderSegment[] = []
  for (const [, point] of occupiedCells) {
    segments.push({
      point,
      left: point.x,
      top: point.y,
      width: 1,
      height: 1,
    })
  }

  return segments
}

export function oppositeCellDirection(direction: CellDirection): CellDirection {
  if (direction === "north") return "south"
  if (direction === "south") return "north"
  if (direction === "west") return "east"
  return "west"
}

export function directionBetweenCells(from: CanvasPoint, to: CanvasPoint): CellDirection | null {
  if (to.x === from.x && to.y === from.y - 1) return "north"
  if (to.x === from.x && to.y === from.y + 1) return "south"
  if (to.x === from.x - 1 && to.y === from.y) return "west"
  if (to.x === from.x + 1 && to.y === from.y) return "east"
  return null
}

export function corridorPathCells(points: CanvasPoint[]) {
  const cells: CanvasPoint[] = []

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
