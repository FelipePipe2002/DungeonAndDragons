import type { NormalizedDungeonLightSource, NormalizedDungeonMap } from "@/lib/dungeons/types"
import { buildDungeonLightingVisibility, type DungeonVisibilityMap } from "@/lib/dungeons/visibility"

import {
  buildCorridorSegments,
  corridorPathCells,
  directionBetweenCells,
  doorDrawPixelRect,
  oppositeCellDirection,
  roomLabelPixelPosition,
  type CellDirection,
} from "./geometry"
import {
  BASE_CELL_SIZE,
  CORRIDOR_WALL_THICKNESS,
  type CanvasPoint,
  type DungeonCamera,
  type DungeonDisplayStyle,
  type RenderOrigin,
} from "./render-types"

function resolveWallThicknessPx(displayStyle: DungeonDisplayStyle) {
  const wallWidth = Number.isFinite(displayStyle.wallWidth)
    ? Math.min(0.48, Math.max(0.02, displayStyle.wallWidth))
    : CORRIDOR_WALL_THICKNESS
  return Math.max(1, Math.round(wallWidth * BASE_CELL_SIZE))
}

export type DungeonCanvasScene = {
  dungeon: NormalizedDungeonMap
  displayStyle: DungeonDisplayStyle
  camera: DungeonCamera
  viewport: { width: number; height: number }
  renderOrigin: RenderOrigin
  openDoorIds?: Set<string>
  pendingAnchorPoint?: CanvasPoint | null
  pendingPathPoints?: CanvasPoint[]
  pendingWaypointPoints?: CanvasPoint[]
  textures?: {
    room?: CanvasImageSource[]
    corridor?: CanvasImageSource[]
    torch?: CanvasImageSource | null
  }
}

export type DungeonLightingOverlayOptions = {
  showRadiusRings?: boolean
  precomputedVisibility?: DungeonVisibilityMap
}

function buildRoomOccupiedCellSet(rooms: NormalizedDungeonMap["rooms"]) {
  const occupied = new Set<string>()
  for (const room of rooms) {
    for (const cell of room.cells) {
      occupied.add(`${cell.x},${cell.y}`)
    }
  }
  return occupied
}

type CorridorCellRenderData = {
  x: number
  y: number
  left: number
  top: number
  width: number
  height: number
  connections: Set<CellDirection>
}

function addCorridorPathConnections(corridorCells: Map<string, CorridorCellRenderData>, points: CanvasPoint[]) {
  const pathCells = corridorPathCells(points)

  for (let index = 1; index < pathCells.length; index += 1) {
    const previous = pathCells[index - 1]
    const current = pathCells[index]
    const direction = directionBetweenCells(previous, current)
    if (!direction) continue

    corridorCells.get(`${previous.x},${previous.y}`)?.connections.add(direction)
    corridorCells.get(`${current.x},${current.y}`)?.connections.add(oppositeCellDirection(direction))
  }
}

function withCameraTransform(ctx: CanvasRenderingContext2D, camera: DungeonCamera, draw: () => void) {
  ctx.save()
  ctx.translate(camera.offset.x, camera.offset.y)
  ctx.scale(camera.scale, camera.scale)
  draw()
  ctx.restore()
}

export function drawDungeonGrid(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { camera, viewport, displayStyle } = scene
  const gridOffsetX = displayStyle.snapGridToPixel ? Math.round(camera.offset.x) : camera.offset.x
  const gridOffsetY = displayStyle.snapGridToPixel ? Math.round(camera.offset.y) : camera.offset.y

  ctx.save()
  const drawGridPass = (spacingPx: number, color: string, lineWidth: number) => {
    const startX = ((gridOffsetX % spacingPx) + spacingPx) % spacingPx
    const startY = ((gridOffsetY % spacingPx) + spacingPx) % spacingPx
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth

    for (let x = startX; x <= viewport.width; x += spacingPx) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, viewport.height)
    }

    for (let y = startY; y <= viewport.height; y += spacingPx) {
      ctx.moveTo(0, y)
      ctx.lineTo(viewport.width, y)
    }

    ctx.stroke()
  }

  drawGridPass(BASE_CELL_SIZE * camera.scale, "rgba(94, 94, 94, 0.38)", 1)
  ctx.restore()
}

function worldPixelPoint(point: CanvasPoint, renderOrigin: RenderOrigin) {
  return {
    x: (point.x - renderOrigin.x) * BASE_CELL_SIZE,
    y: (point.y - renderOrigin.y) * BASE_CELL_SIZE,
  }
}

function cellHash(x: number, y: number, salt: number) {
  const value = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(salt, 83492791)
  return value >>> 0
}

function avalanche32(value: number) {
  let hash = value >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  hash ^= hash >>> 16
  return hash >>> 0
}

function seededCellHash(x: number, y: number, salt: number, seedValue: number) {
  const mixedX = Math.imul((x + 0x9e3779b9) >>> 0, 0x85ebca6b)
  const mixedY = Math.imul((y + 0xc2b2ae35) >>> 0, 0x27d4eb2d)
  const mixedSeed = Math.imul((seedValue ^ salt) >>> 0, 0x165667b1)
  const cross = Math.imul((x ^ (y << 16)) >>> 0, 0xd3a2646c)
  return avalanche32(mixedX ^ mixedY ^ mixedSeed ^ cross)
}

function seedHash(seed: string | number | null | undefined) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0
  }

  if (typeof seed !== "string" || seed.length === 0) {
    return 0x9e3779b9
  }

  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomQuarterTurns(x: number, y: number, salt: number) {
  return cellHash(x, y, salt) & 3
}

function textureIndexForCell(x: number, y: number, salt: number, textureCount: number, seedValue: number) {
  if (textureCount <= 1) return 0

  const hash = seededCellHash(x, y, salt, seedValue)
  return Math.floor((hash / 0x100000000) * textureCount)
}

function drawTextureCell(
  ctx: CanvasRenderingContext2D,
  texture: CanvasImageSource,
  left: number,
  top: number,
  randomRotationTurns: number,
) {
  if (randomRotationTurns === 0) {
    ctx.drawImage(texture, left, top, BASE_CELL_SIZE, BASE_CELL_SIZE)
    return
  }

  ctx.save()
  ctx.translate(left + BASE_CELL_SIZE / 2, top + BASE_CELL_SIZE / 2)
  ctx.rotate((Math.PI / 2) * randomRotationTurns)
  ctx.drawImage(texture, -BASE_CELL_SIZE / 2, -BASE_CELL_SIZE / 2, BASE_CELL_SIZE, BASE_CELL_SIZE)
  ctx.restore()
}

function drawRooms(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, displayStyle, renderOrigin, textures } = scene
  ctx.fillStyle = displayStyle.roomColor
  const dungeonSeed = seedHash(dungeon.metadata.seed)

  for (const room of dungeon.rooms) {
    for (const cell of room.cells) {
      const left = (cell.x - renderOrigin.x) * BASE_CELL_SIZE
      const top = (cell.y - renderOrigin.y) * BASE_CELL_SIZE
      const roomTextureCount = textures?.room?.length ?? 0
      if (roomTextureCount > 0) {
        const roomTexture = textures?.room?.[
          textureIndexForCell(cell.x, cell.y, 0x45d9f3, roomTextureCount, dungeonSeed)
        ]
        if (!roomTexture) {
          ctx.fillRect(left, top, BASE_CELL_SIZE, BASE_CELL_SIZE)
          continue
        }
        const turns = displayStyle.roomTextureRandomRotation
          ? randomQuarterTurns(cell.x, cell.y, 0x9e3779b9)
          : 0
        drawTextureCell(ctx, roomTexture, left, top, turns)
      } else {
        ctx.fillRect(left, top, BASE_CELL_SIZE, BASE_CELL_SIZE)
      }
    }
  }
}

function drawRoomWalls(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, displayStyle, renderOrigin } = scene
  if (!displayStyle.showCorridorWalls) return

  const roomCells = buildRoomOccupiedCellSet(dungeon.rooms)
  const wallThicknessPx = resolveWallThicknessPx(displayStyle)
  const wallSuppressedByDoor = new Set<string>()

  for (const door of dungeon.doors) {
    if (!roomCells.has(`${door.x},${door.y}`)) continue
    wallSuppressedByDoor.add(`${door.x},${door.y}:${door.direction}`)
  }

  ctx.fillStyle = displayStyle.roomWallColor

  for (const key of roomCells) {
    const [cellX, cellY] = key.split(",").map(Number)
    const left = (cellX - renderOrigin.x) * BASE_CELL_SIZE
    const top = (cellY - renderOrigin.y) * BASE_CELL_SIZE

    const northExposed = !roomCells.has(`${cellX},${cellY - 1}`) && !wallSuppressedByDoor.has(`${cellX},${cellY}:north`)
    const southExposed = !roomCells.has(`${cellX},${cellY + 1}`) && !wallSuppressedByDoor.has(`${cellX},${cellY}:south`)
    const westExposed = !roomCells.has(`${cellX - 1},${cellY}`) && !wallSuppressedByDoor.has(`${cellX},${cellY}:west`)
    const eastExposed = !roomCells.has(`${cellX + 1},${cellY}`) && !wallSuppressedByDoor.has(`${cellX},${cellY}:east`)

    if (northExposed) {
      ctx.fillRect(left, top - wallThicknessPx, BASE_CELL_SIZE, wallThicknessPx)
    }
    if (southExposed) {
      ctx.fillRect(left, top + BASE_CELL_SIZE, BASE_CELL_SIZE, wallThicknessPx)
    }
    if (westExposed) {
      ctx.fillRect(left - wallThicknessPx, top, wallThicknessPx, BASE_CELL_SIZE)
    }
    if (eastExposed) {
      ctx.fillRect(left + BASE_CELL_SIZE, top, wallThicknessPx, BASE_CELL_SIZE)
    }

    if (northExposed && westExposed) {
      ctx.fillRect(left - wallThicknessPx, top - wallThicknessPx, wallThicknessPx, wallThicknessPx)
    }
    if (northExposed && eastExposed) {
      ctx.fillRect(left + BASE_CELL_SIZE, top - wallThicknessPx, wallThicknessPx, wallThicknessPx)
    }
    if (southExposed && westExposed) {
      ctx.fillRect(left - wallThicknessPx, top + BASE_CELL_SIZE, wallThicknessPx, wallThicknessPx)
    }
    if (southExposed && eastExposed) {
      ctx.fillRect(left + BASE_CELL_SIZE, top + BASE_CELL_SIZE, wallThicknessPx, wallThicknessPx)
    }
  }
}

function drawCorridors(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, displayStyle, renderOrigin, textures } = scene
  const occupied = buildRoomOccupiedCellSet(dungeon.rooms)
  const dungeonSeed = seedHash(dungeon.metadata.seed)
  const wallThicknessPx = resolveWallThicknessPx(displayStyle)
  const corridorCells = new Map<string, CorridorCellRenderData>()
  const wallSuppressedByDoor = new Set<string>()

  for (const corridor of dungeon.corridors) {
    const segments = buildCorridorSegments(corridor.points, corridor.width ?? 1, occupied)
    for (const segment of segments) {
      const key = `${segment.left},${segment.top}`
      const existing = corridorCells.get(key)
      corridorCells.set(key, {
        x: segment.left,
        y: segment.top,
        left: (segment.left - renderOrigin.x) * BASE_CELL_SIZE,
        top: (segment.top - renderOrigin.y) * BASE_CELL_SIZE,
        width: segment.width * BASE_CELL_SIZE,
        height: segment.height * BASE_CELL_SIZE,
        connections: existing?.connections ?? new Set(),
      })
    }
    addCorridorPathConnections(corridorCells, corridor.points)
  }

  ctx.fillStyle = displayStyle.corridorColor
  for (const cell of corridorCells.values()) {
    const corridorTextureCount = textures?.corridor?.length ?? 0
    if (corridorTextureCount > 0) {
      const corridorTexture = textures?.corridor?.[
        textureIndexForCell(cell.x, cell.y, 0xa2f953, corridorTextureCount, dungeonSeed)
      ]
      if (!corridorTexture) {
        ctx.fillRect(cell.left, cell.top, cell.width, cell.height)
        continue
      }
      const turns = displayStyle.corridorTextureRandomRotation
        ? randomQuarterTurns(cell.x, cell.y, 0x7f4a7c15)
        : 0
      drawTextureCell(ctx, corridorTexture, cell.left, cell.top, turns)
    } else {
      ctx.fillRect(cell.left, cell.top, cell.width, cell.height)
    }
  }

  if (!displayStyle.showCorridorWalls) return

  for (const door of dungeon.doors) {
    let corridorCellX = door.x
    let corridorCellY = door.y
    let side: "north" | "south" | "west" | "east"

    if (door.direction === "east") {
      corridorCellX = door.x + 1
      side = "west"
    } else if (door.direction === "west") {
      corridorCellX = door.x - 1
      side = "east"
    } else if (door.direction === "south") {
      corridorCellY = door.y + 1
      side = "north"
    } else {
      corridorCellY = door.y - 1
      side = "south"
    }

    if (corridorCells.has(`${corridorCellX},${corridorCellY}`)) {
      wallSuppressedByDoor.add(`${corridorCellX},${corridorCellY}:${side}`)
    }
  }

  ctx.fillStyle = displayStyle.corridorWallColor
  const wallOpenByCell = new Map<string, { north: boolean; south: boolean; west: boolean; east: boolean }>()

  for (const key of corridorCells.keys()) {
    const [leftCell, topCell] = key.split(",").map(Number)
    const cell = corridorCells.get(key)
    wallOpenByCell.set(key, {
      north: !cell?.connections.has("north"),
      south: !cell?.connections.has("south"),
      west: !cell?.connections.has("west"),
      east: !cell?.connections.has("east"),
    })
  }

  for (const [key, cell] of corridorCells.entries()) {
    const [leftCell, topCell] = key.split(",").map(Number)
    const walls = wallOpenByCell.get(key)
    if (!walls) continue

    const northOpen = walls.north && !wallSuppressedByDoor.has(`${leftCell},${topCell}:north`)
    const southOpen = walls.south && !wallSuppressedByDoor.has(`${leftCell},${topCell}:south`)
    const westOpen = walls.west && !wallSuppressedByDoor.has(`${leftCell},${topCell}:west`)
    const eastOpen = walls.east && !wallSuppressedByDoor.has(`${leftCell},${topCell}:east`)

    if (northOpen) {
      ctx.fillRect(cell.left, cell.top, cell.width, wallThicknessPx)
    }
    if (southOpen) {
      ctx.fillRect(cell.left, cell.top + cell.height - wallThicknessPx, cell.width, wallThicknessPx)
    }
    if (westOpen) {
      ctx.fillRect(cell.left, cell.top, wallThicknessPx, cell.height)
    }
    if (eastOpen) {
      ctx.fillRect(cell.left + cell.width - wallThicknessPx, cell.top, wallThicknessPx, cell.height)
    }

    const westWalls = wallOpenByCell.get(`${leftCell - 1},${topCell}`)
    const eastWalls = wallOpenByCell.get(`${leftCell + 1},${topCell}`)
    const northWalls = wallOpenByCell.get(`${leftCell},${topCell - 1}`)
    const southWalls = wallOpenByCell.get(`${leftCell},${topCell + 1}`)

    const topLeftHorizontal = northOpen || (westWalls?.north ?? false)
    const topLeftVertical = westOpen || (northWalls?.west ?? false)
    if (topLeftHorizontal && topLeftVertical) {
      ctx.fillRect(cell.left, cell.top, wallThicknessPx, wallThicknessPx)
    }

    const topRightHorizontal = northOpen || (eastWalls?.north ?? false)
    const topRightVertical = eastOpen || (northWalls?.east ?? false)
    if (topRightHorizontal && topRightVertical) {
      ctx.fillRect(cell.left + cell.width - wallThicknessPx, cell.top, wallThicknessPx, wallThicknessPx)
    }

    const bottomLeftHorizontal = southOpen || (westWalls?.south ?? false)
    const bottomLeftVertical = westOpen || (southWalls?.west ?? false)
    if (bottomLeftHorizontal && bottomLeftVertical) {
      ctx.fillRect(cell.left, cell.top + cell.height - wallThicknessPx, wallThicknessPx, wallThicknessPx)
    }

    const bottomRightHorizontal = southOpen || (eastWalls?.south ?? false)
    const bottomRightVertical = eastOpen || (southWalls?.east ?? false)
    if (bottomRightHorizontal && bottomRightVertical) {
      ctx.fillRect(
        cell.left + cell.width - wallThicknessPx,
        cell.top + cell.height - wallThicknessPx,
        wallThicknessPx,
        wallThicknessPx,
      )
    }
  }
}

function drawDoors(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, displayStyle, renderOrigin, openDoorIds } = scene
  const wallThicknessPx = resolveWallThicknessPx(displayStyle)

  for (const door of dungeon.doors) {
    const rect = doorDrawPixelRect(door, renderOrigin, BASE_CELL_SIZE, displayStyle.wallWidth)

    ctx.globalAlpha = 1
    ctx.fillStyle = displayStyle.corridorWallColor
    if (door.direction === "east" || door.direction === "west") {
      const centerX = rect.left + rect.width / 2
      const capLeft = centerX - wallThicknessPx / 2
      ctx.fillRect(capLeft, rect.top - wallThicknessPx, wallThicknessPx, wallThicknessPx)
      ctx.fillRect(capLeft, rect.top + rect.height, wallThicknessPx, wallThicknessPx)
    } else {
      const centerY = rect.top + rect.height / 2
      const capTop = centerY - wallThicknessPx / 2
      ctx.fillRect(rect.left - wallThicknessPx, capTop, wallThicknessPx, wallThicknessPx)
      ctx.fillRect(rect.left + rect.width, capTop, wallThicknessPx, wallThicknessPx)
    }

    const isOpen = openDoorIds?.has(door.id)
    ctx.globalAlpha = isOpen ? 0.28 : 1
    ctx.fillStyle = displayStyle.doorColor
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height)
  }

  ctx.globalAlpha = 1
}

function drawMarkers(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, renderOrigin } = scene
  const radius = BASE_CELL_SIZE * 0.18

  for (const marker of dungeon.markers) {
    const pixel = worldPixelPoint(marker, renderOrigin)
    const centerX = pixel.x
    const centerY = pixel.y

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fillStyle = "#f43f5e"
    ctx.fill()
  }
}

function drawLightIcons(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene, options: DungeonLightingOverlayOptions = {}) {
  const { dungeon, renderOrigin, textures } = scene
  const radius = BASE_CELL_SIZE * 0.22
  const torchTexture = textures?.torch ?? null
  const showRadiusRings = options.showRadiusRings ?? true

  const rotationForOrientation = (orientation: NormalizedDungeonMap["lights"][number]["orientation"]) => {
    if (orientation === "north") return 0
    if (orientation === "east") return Math.PI / 2
    if (orientation === "west") return -Math.PI / 2
    return Math.PI
  }

  const wallMountedCenter = (
    light: NormalizedDungeonMap["lights"][number],
    pixel: { x: number; y: number },
    imageSize: number,
  ) => {
    const cellCenterX = pixel.x + BASE_CELL_SIZE * 0.5
    const cellCenterY = pixel.y + BASE_CELL_SIZE * 0.5
    if (!light.wallMounted) return { x: cellCenterX, y: cellCenterY }
    if (light.orientation === "north") return { x: cellCenterX, y: pixel.y + imageSize / 2 }
    if (light.orientation === "south") return { x: cellCenterX, y: pixel.y + BASE_CELL_SIZE - imageSize / 2 }
    if (light.orientation === "west") return { x: pixel.x + imageSize / 2, y: cellCenterY }
    return { x: pixel.x + BASE_CELL_SIZE - imageSize / 2, y: cellCenterY }
  }

  for (const light of dungeon.lights) {
    if (!light.enabled) continue

    const pixel = worldPixelPoint(light, renderOrigin)
    const imageSize = BASE_CELL_SIZE * 0.9
    const center = wallMountedCenter(light, pixel, imageSize)
    const centerX = center.x
    const centerY = center.y

    if (torchTexture) {
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(rotationForOrientation(light.orientation))
      ctx.drawImage(torchTexture, -imageSize / 2, -imageSize / 2, imageSize, imageSize)
      ctx.restore()
    } else {
      const gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, BASE_CELL_SIZE * 0.55)
      gradient.addColorStop(0, "rgba(255, 244, 178, 0.95)")
      gradient.addColorStop(0.45, "rgba(249, 115, 22, 0.82)")
      gradient.addColorStop(1, "rgba(124, 45, 18, 0.18)")

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = "rgba(255, 237, 213, 0.95)"
      ctx.stroke()
    }

    if (showRadiusRings) {
      ctx.setLineDash([BASE_CELL_SIZE * 0.18, BASE_CELL_SIZE * 0.12])
      ctx.lineWidth = 1
      ctx.strokeStyle = "rgba(253, 186, 116, 0.45)"
      ctx.beginPath()
      ctx.arc(centerX, centerY, light.brightRadiusCells * BASE_CELL_SIZE, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = "rgba(251, 146, 60, 0.28)"
      ctx.beginPath()
      ctx.arc(centerX, centerY, light.dimRadiusCells * BASE_CELL_SIZE, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

export function drawDungeonLightingOverlay(
  ctx: CanvasRenderingContext2D,
  scene: DungeonCanvasScene,
  options: DungeonLightingOverlayOptions = {},
) {
  if (!options.precomputedVisibility && scene.dungeon.lights.length === 0) return

  withCameraTransform(ctx, scene.camera, () => {
    const { dungeon, renderOrigin } = scene
    const visibility = options.precomputedVisibility ?? buildDungeonLightingVisibility({
      dungeon,
      openDoorIds: scene.openDoorIds,
    })

    for (let y = dungeon.bounds.originY; y < dungeon.bounds.originY + dungeon.bounds.height; y += 1) {
      for (let x = dungeon.bounds.originX; x < dungeon.bounds.originX + dungeon.bounds.width; x += 1) {
        const localCell = { x: x - dungeon.bounds.originX, y: y - dungeon.bounds.originY }
        const tier = visibility.getTier(localCell)
        if (tier === "bright") continue

        ctx.fillStyle = tier === "dim"
          ? "rgba(6, 8, 14, 0.3)"
          : "rgba(3, 5, 10, 0.68)"
        ctx.fillRect(
          (x - renderOrigin.x) * BASE_CELL_SIZE,
          (y - renderOrigin.y) * BASE_CELL_SIZE,
          BASE_CELL_SIZE,
          BASE_CELL_SIZE,
        )
      }
    }

    drawLightIcons(ctx, scene, options)
  })
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const { dungeon, renderOrigin } = scene

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  for (const room of dungeon.rooms) {
    if (!room.label) continue
    if (room.kind !== "start" && room.kind !== "boss") continue
    const point = roomLabelPixelPosition(room, renderOrigin, BASE_CELL_SIZE)
    ctx.font = "700 14px Georgia, serif"
    const textWidth = ctx.measureText(room.label).width
    const platePaddingX = 8
    const plateHeight = 20

    ctx.fillStyle = "rgba(15, 23, 42, 0.5)"
    ctx.fillRect(
      point.x - textWidth / 2 - platePaddingX,
      point.y - plateHeight / 2,
      textWidth + platePaddingX * 2,
      plateHeight,
    )

    ctx.strokeStyle = "rgba(15, 23, 42, 0.9)"
    ctx.lineWidth = 3
    ctx.strokeText(room.label, point.x, point.y)
    ctx.fillStyle = "rgba(248, 250, 252, 0.98)"
    ctx.fillText(room.label, point.x, point.y)
  }

  for (const marker of dungeon.markers) {
    if (!marker.label) continue
    const pixel = worldPixelPoint(marker, renderOrigin)
    ctx.strokeStyle = "rgba(15, 23, 42, 0.85)"
    ctx.lineWidth = 2
    ctx.font = "500 12px Georgia, serif"
    ctx.strokeText(marker.label, pixel.x, pixel.y - BASE_CELL_SIZE * 0.35)
    ctx.fillStyle = "rgba(226, 232, 240, 0.98)"
    ctx.fillText(marker.label, pixel.x, pixel.y - BASE_CELL_SIZE * 0.35)
  }
}

function drawPendingAnchor(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  const pendingPoints = scene.pendingPathPoints?.length
    ? scene.pendingPathPoints
    : scene.pendingAnchorPoint
      ? [scene.pendingAnchorPoint]
      : []
  if (pendingPoints.length === 0) return

  if (pendingPoints.length > 1) {
    ctx.beginPath()
    for (let index = 0; index < pendingPoints.length; index += 1) {
      const pixel = worldPixelPoint(pendingPoints[index], scene.renderOrigin)
      const centerX = pixel.x + BASE_CELL_SIZE * 0.5
      const centerY = pixel.y + BASE_CELL_SIZE * 0.5
      if (index === 0) {
        ctx.moveTo(centerX, centerY)
      } else {
        ctx.lineTo(centerX, centerY)
      }
    }
    ctx.lineWidth = BASE_CELL_SIZE * 0.42
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "rgba(255, 233, 226, 0.26)"
    ctx.stroke()

    ctx.lineWidth = 3
    ctx.setLineDash([BASE_CELL_SIZE * 0.3, BASE_CELL_SIZE * 0.18])
    ctx.strokeStyle = "rgba(217, 106, 86, 0.94)"
    ctx.stroke()
    ctx.setLineDash([])
  }

  const waypointKeys = new Set((scene.pendingWaypointPoints ?? []).map((point) => `${point.x},${point.y}`))
  const markerPoints = [
    scene.pendingAnchorPoint,
    ...(scene.pendingWaypointPoints ?? []),
  ].filter((point): point is CanvasPoint => Boolean(point))

  for (const point of markerPoints) {
    const pixel = worldPixelPoint(point, scene.renderOrigin)
    const centerX = pixel.x + BASE_CELL_SIZE * 0.5
    const centerY = pixel.y + BASE_CELL_SIZE * 0.5
    const radius = BASE_CELL_SIZE * 0.22
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 233, 226, 0.9)"
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(217, 106, 86, 0.98)"
    ctx.stroke()

    if (!waypointKeys.has(`${point.x},${point.y}`)) continue

    ctx.beginPath()
    ctx.moveTo(centerX - radius * 0.55, centerY)
    ctx.lineTo(centerX + radius * 0.55, centerY)
    ctx.moveTo(centerX, centerY - radius * 0.55)
    ctx.lineTo(centerX, centerY + radius * 0.55)
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(12, 74, 110, 0.95)"
    ctx.stroke()
  }
}

export function drawDungeon(ctx: CanvasRenderingContext2D, scene: DungeonCanvasScene) {
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, scene.viewport.width, scene.viewport.height)

  withCameraTransform(ctx, scene.camera, () => {
    drawRooms(ctx, scene)
    drawRoomWalls(ctx, scene)
    drawCorridors(ctx, scene)
    drawDoors(ctx, scene)
    drawMarkers(ctx, scene)
    drawLabels(ctx, scene)
    drawPendingAnchor(ctx, scene)
  })

  drawDungeonGrid(ctx, scene)
}
