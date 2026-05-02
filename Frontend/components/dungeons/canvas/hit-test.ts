import type { NormalizedDungeonMap } from "@/lib/dungeons/types"

import { screenToWorld, worldToScreen } from "./camera"
import { doorDrawPixelRect } from "./geometry"
import { BASE_CELL_SIZE, CORRIDOR_WALL_THICKNESS, type CanvasPoint, type CorridorRenderSegment, type DungeonCamera, type RenderOrigin } from "./render-types"

export { screenToWorld, worldToScreen }

export function screenToCell(
  screen: CanvasPoint,
  renderOrigin: RenderOrigin,
  camera: DungeonCamera,
  cellSize = BASE_CELL_SIZE,
): CanvasPoint {
  const world = screenToWorld(screen, renderOrigin, camera, cellSize)
  return {
    x: Math.floor(world.x),
    y: Math.floor(world.y),
  }
}

export function roomAtCell(rooms: NormalizedDungeonMap["rooms"], cell: CanvasPoint) {
  for (const room of rooms) {
    for (const occupied of room.cells) {
      if (occupied.x === cell.x && occupied.y === cell.y) {
        return room
      }
    }
  }
  return null
}

export function roomSpanAtCell(rooms: NormalizedDungeonMap["rooms"], cell: CanvasPoint) {
  const room = roomAtCell(rooms, cell)
  if (!room) return null

  const span = room.spans.find((candidate) => (
    cell.x >= candidate.x
    && cell.x < candidate.x + candidate.width
    && cell.y >= candidate.y
    && cell.y < candidate.y + candidate.height
  )) ?? room.spans[0]

  return { room, span }
}

export function corridorSegmentAtCell<T extends CorridorRenderSegment>(segments: T[], cell: CanvasPoint) {
  return segments.find((segment) => (
    cell.x >= segment.left
    && cell.x < segment.left + segment.width
    && cell.y >= segment.top
    && cell.y < segment.top + segment.height
  )) ?? null
}

export function doorAtLocalPixel(
  doors: NormalizedDungeonMap["doors"],
  renderOrigin: RenderOrigin,
  localPixel: CanvasPoint,
  cellSize = BASE_CELL_SIZE,
  wallThickness = CORRIDOR_WALL_THICKNESS,
) {
  const normalizedWallThickness = Number.isFinite(wallThickness)
    ? Math.min(0.48, Math.max(0.02, wallThickness))
    : CORRIDOR_WALL_THICKNESS
  const wallThicknessPx = Math.max(1, Math.round(normalizedWallThickness * cellSize))

  return doors.find((door) => {
    const rect = doorDrawPixelRect(door, renderOrigin, cellSize, normalizedWallThickness)
    const hitRect = { ...rect }

    if (door.direction === "east" || door.direction === "west") {
      hitRect.top -= wallThicknessPx
      hitRect.height += wallThicknessPx * 2
    } else {
      hitRect.left -= wallThicknessPx
      hitRect.width += wallThicknessPx * 2
    }

    return (
      localPixel.x >= hitRect.left
      && localPixel.x <= hitRect.left + hitRect.width
      && localPixel.y >= hitRect.top
      && localPixel.y <= hitRect.top + hitRect.height
    )
  }) ?? null
}
