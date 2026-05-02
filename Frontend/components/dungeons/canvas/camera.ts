import type { NormalizedDungeonMap } from "@/lib/dungeons/types"

import {
  BASE_CELL_SIZE,
  HOME_PADDING_PX,
  MAX_SCALE,
  MIN_SCALE,
  type CanvasPoint,
  type DungeonCamera,
  type DungeonViewport,
  type RenderOrigin,
} from "./render-types"

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function worldPixelSize(dungeon: NormalizedDungeonMap, cellSize = BASE_CELL_SIZE) {
  return {
    width: dungeon.bounds.width * cellSize,
    height: dungeon.bounds.height * cellSize,
  }
}

export function fitToView(
  dungeon: NormalizedDungeonMap,
  viewport: DungeonViewport,
): DungeonCamera {
  const worldWidth = Math.max(BASE_CELL_SIZE, dungeon.bounds.width * BASE_CELL_SIZE)
  const worldHeight = Math.max(BASE_CELL_SIZE, dungeon.bounds.height * BASE_CELL_SIZE)

  if (viewport.width <= 0 || viewport.height <= 0) {
    return {
      scale: 1,
      offset: {
        x: HOME_PADDING_PX,
        y: HOME_PADDING_PX,
      },
    }
  }

  const usableWidth = Math.max(1, viewport.width - HOME_PADDING_PX * 2)
  const usableHeight = Math.max(1, viewport.height - HOME_PADDING_PX * 2)
  const scale = clamp(Math.min(usableWidth / worldWidth, usableHeight / worldHeight), MIN_SCALE, MAX_SCALE)
  const offsetX = (viewport.width - worldWidth * scale) / 2
  const offsetY = (viewport.height - worldHeight * scale) / 2

  return {
    scale,
    offset: { x: offsetX, y: offsetY },
  }
}

export function worldToScreen(
  world: CanvasPoint,
  renderOrigin: RenderOrigin,
  camera: DungeonCamera,
  cellSize = BASE_CELL_SIZE,
): CanvasPoint {
  const localX = (world.x - renderOrigin.x) * cellSize
  const localY = (world.y - renderOrigin.y) * cellSize
  return {
    x: localX * camera.scale + camera.offset.x,
    y: localY * camera.scale + camera.offset.y,
  }
}

export function screenToWorld(
  screen: CanvasPoint,
  renderOrigin: RenderOrigin,
  camera: DungeonCamera,
  cellSize = BASE_CELL_SIZE,
): CanvasPoint {
  const localX = (screen.x - camera.offset.x) / Math.max(camera.scale, Number.EPSILON)
  const localY = (screen.y - camera.offset.y) / Math.max(camera.scale, Number.EPSILON)
  return {
    x: localX / cellSize + renderOrigin.x,
    y: localY / cellSize + renderOrigin.y,
  }
}

export function clampCameraOffset(
  camera: DungeonCamera,
  dungeon: NormalizedDungeonMap,
  viewport: DungeonViewport,
  edgePaddingPx = HOME_PADDING_PX * 0.5,
): DungeonCamera {
  const world = worldPixelSize(dungeon, BASE_CELL_SIZE)
  const scaledWidth = world.width * camera.scale
  const scaledHeight = world.height * camera.scale

  if (viewport.width <= 0 || viewport.height <= 0) return camera

  const minOffsetX = viewport.width - scaledWidth - edgePaddingPx
  const maxOffsetX = edgePaddingPx
  const minOffsetY = viewport.height - scaledHeight - edgePaddingPx
  const maxOffsetY = edgePaddingPx

  const centeredOffsetX = (viewport.width - scaledWidth) / 2
  const centeredOffsetY = (viewport.height - scaledHeight) / 2

  return {
    scale: camera.scale,
    offset: {
      x: scaledWidth <= viewport.width
        ? centeredOffsetX
        : clamp(camera.offset.x, minOffsetX, maxOffsetX),
      y: scaledHeight <= viewport.height
        ? centeredOffsetY
        : clamp(camera.offset.y, minOffsetY, maxOffsetY),
    },
  }
}
