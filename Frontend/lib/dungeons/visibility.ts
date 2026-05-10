import type {
  DungeonDoorDirection,
  DungeonMapPoint,
  NormalizedDungeonCorridor,
  NormalizedDungeonMap,
  NormalizedDungeonLightSource,
} from "./types.ts"

export type DungeonVisibilityTier = "hidden" | "explored" | "dim" | "bright"
export type DungeonVisibilityDistanceMetric = "euclidean" | "chebyshev" | "manhattan"

export type DungeonVisibilityBounds = {
  width: number
  height: number
}

export type DungeonVisibilityLineOfSight = (source: DungeonMapPoint, target: DungeonMapPoint) => boolean

export type CalculateDungeonVisibilityInput = {
  bounds: DungeonVisibilityBounds
  lights?: NormalizedDungeonLightSource[]
  exploredCellKeys?: Iterable<string>
  distanceMetric?: DungeonVisibilityDistanceMetric
  lineOfSight?: DungeonVisibilityLineOfSight
}

export type DungeonVisibilityMap = {
  bounds: DungeonVisibilityBounds
  tiersByCellKey: Map<string, DungeonVisibilityTier>
  getTier(point: DungeonMapPoint): DungeonVisibilityTier
}

export type BuildDungeonLightingVisibilityInput = {
  dungeon: NormalizedDungeonMap
  tokenLights?: NormalizedDungeonLightSource[]
  exploredCellKeys?: Iterable<string>
  distanceMetric?: DungeonVisibilityDistanceMetric
  openDoorIds?: ReadonlySet<string>
}

export type DungeonVisibilityPlayer = {
  type?: string
  hidden?: boolean
  x: number
  y: number
  vista?: number | null
}

export type GetPlayerVisibleDungeonCellKeysInput = {
  dungeon: NormalizedDungeonMap
  players: Iterable<DungeonVisibilityPlayer>
  verticalMirror?: boolean
  candidateCellKeys?: Iterable<string>
  openDoorIds?: ReadonlySet<string>
}

type ClosedDoorBlockers = {
  edgeKeys: Set<string>
}

export function dungeonCellKey(point: DungeonMapPoint) {
  return `${point.x},${point.y}`
}

export function parseDungeonCellKey(key: string): DungeonMapPoint | null {
  const [rawX, rawY] = key.split(",")
  if (rawX === undefined || rawY === undefined) return null
  const x = Number.parseInt(rawX, 10)
  const y = Number.parseInt(rawY, 10)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

export function isDungeonPointWithinBounds(point: DungeonMapPoint, bounds: DungeonVisibilityBounds) {
  return point.x >= 0 && point.y >= 0 && point.x < bounds.width && point.y < bounds.height
}

function corridorCells(corridor: NormalizedDungeonCorridor) {
  const cells: DungeonMapPoint[] = []
  const width = Math.max(1, Math.round(corridor.width ?? 1))
  const offsetMin = -Math.floor((width - 1) / 2)
  const offsetMax = offsetMin + width - 1

  for (let index = 1; index < corridor.points.length; index += 1) {
    const previous = corridor.points[index - 1]
    const current = corridor.points[index]
    const deltaX = Math.sign(current.x - previous.x)
    const deltaY = Math.sign(current.y - previous.y)
    const steps = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)

    for (let step = 0; step <= steps; step += 1) {
      if (index > 1 && step === 0) continue
      const center = { x: previous.x + deltaX * step, y: previous.y + deltaY * step }

      for (let offsetY = offsetMin; offsetY <= offsetMax; offsetY += 1) {
        for (let offsetX = offsetMin; offsetX <= offsetMax; offsetX += 1) {
          cells.push({ x: center.x + offsetX, y: center.y + offsetY })
        }
      }
    }
  }

  return cells
}

export function getDungeonRevealableCellKeys(dungeon: NormalizedDungeonMap) {
  const keys = new Set<string>()
  const toLocalCell = (cell: DungeonMapPoint) => ({
    x: cell.x - dungeon.bounds.originX,
    y: cell.y - dungeon.bounds.originY,
  })

  for (const room of dungeon.rooms) {
    for (const cell of room.cells) {
      const localCell = toLocalCell(cell)
      if (!isDungeonPointWithinBounds(localCell, dungeon.bounds)) continue
      keys.add(dungeonCellKey(localCell))
    }
  }

  for (const corridor of dungeon.corridors) {
    for (const cell of corridorCells(corridor)) {
      const localCell = toLocalCell(cell)
      if (!isDungeonPointWithinBounds(localCell, dungeon.bounds)) continue
      keys.add(dungeonCellKey(localCell))
    }
  }

  return keys
}

export function isDungeonCellRevealable(dungeon: NormalizedDungeonMap, localCell: DungeonMapPoint) {
  return getDungeonRevealableCellKeys(dungeon).has(dungeonCellKey(localCell))
}

export function getVista(player: Pick<DungeonVisibilityPlayer, "vista"> | null | undefined) {
  const vista = player?.vista
  return typeof vista === "number" && Number.isFinite(vista) && vista > 0 ? vista : 24
}

function directionDelta(direction: DungeonDoorDirection) {
  if (direction === "east") return { x: 1, y: 0 }
  if (direction === "west") return { x: -1, y: 0 }
  if (direction === "south") return { x: 0, y: 1 }
  return { x: 0, y: -1 }
}

function stepEdgeKey(left: DungeonMapPoint, right: DungeonMapPoint) {
  const leftKey = dungeonCellKey(left)
  const rightKey = dungeonCellKey(right)
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`
}

function buildClosedDoorBlockers(dungeon: NormalizedDungeonMap, openDoorIds?: ReadonlySet<string>): ClosedDoorBlockers {
  const edgeKeys = new Set<string>()

  for (const door of dungeon.doors) {
    if (openDoorIds?.has(door.id)) continue
    const doorCell = {
      x: door.x - dungeon.bounds.originX,
      y: door.y - dungeon.bounds.originY,
    }
    const delta = directionDelta(door.direction)
    edgeKeys.add(stepEdgeKey(doorCell, { x: doorCell.x + delta.x, y: doorCell.y + delta.y }))
  }

  return { edgeKeys }
}

function closedDoorBlocksStep(closedDoorEdgeKeys: Set<string>, from: DungeonMapPoint, to: DungeonMapPoint) {
  if (closedDoorEdgeKeys.size === 0) return false
  if (from.x === to.x && from.y === to.y) return false

  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  if (Math.abs(deltaX) + Math.abs(deltaY) === 1) {
    return closedDoorEdgeKeys.has(stepEdgeKey(from, to))
  }

  if (deltaX !== 0 && deltaY !== 0) {
    const horizontal = { x: to.x, y: from.y }
    const vertical = { x: from.x, y: to.y }
    return (
      closedDoorEdgeKeys.has(stepEdgeKey(from, horizontal)) ||
      closedDoorEdgeKeys.has(stepEdgeKey(horizontal, to)) ||
      closedDoorEdgeKeys.has(stepEdgeKey(from, vertical)) ||
      closedDoorEdgeKeys.has(stepEdgeKey(vertical, to))
    )
  }

  return closedDoorEdgeKeys.has(stepEdgeKey(from, to))
}

function dungeonLineCells(source: DungeonMapPoint, target: DungeonMapPoint) {
  const start = { x: Math.floor(source.x), y: Math.floor(source.y) }
  const end = { x: Math.floor(target.x), y: Math.floor(target.y) }
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const cells: DungeonMapPoint[] = []
  const seen = new Set<string>()
  const addCell = (cell: DungeonMapPoint) => {
    const key = dungeonCellKey(cell)
    if (seen.has(key)) return
    seen.add(key)
    cells.push(cell)
  }

  addCell(start)
  if (deltaX === 0 && deltaY === 0) {
    return cells
  }

  const stepX = Math.sign(deltaX)
  const stepY = Math.sign(deltaY)
  const distanceX = Math.abs(deltaX)
  const distanceY = Math.abs(deltaY)
  const tDeltaX = distanceX === 0 ? Number.POSITIVE_INFINITY : 1 / distanceX
  const tDeltaY = distanceY === 0 ? Number.POSITIVE_INFINITY : 1 / distanceY
  let tMaxX = distanceX === 0 ? Number.POSITIVE_INFINITY : 0.5 / distanceX
  let tMaxY = distanceY === 0 ? Number.POSITIVE_INFINITY : 0.5 / distanceY
  let x = start.x
  let y = start.y

  while (x !== end.x || y !== end.y) {
    if (tMaxX < tMaxY) {
      x += stepX
      tMaxX += tDeltaX
    } else if (tMaxY < tMaxX) {
      y += stepY
      tMaxY += tDeltaY
    } else {
      addCell({ x: x + stepX, y })
      addCell({ x, y: y + stepY })
      x += stepX
      y += stepY
      tMaxX += tDeltaX
      tMaxY += tDeltaY
    }

    addCell({ x, y })
  }

  return cells
}

export function hasDungeonLineOfSight(
  dungeon: NormalizedDungeonMap,
  sourceCell: DungeonMapPoint,
  targetCell: DungeonMapPoint,
  openDoorIds?: ReadonlySet<string>,
) {
  const revealableCellKeys = getDungeonRevealableCellKeys(dungeon)
  const closedDoorBlockers = buildClosedDoorBlockers(dungeon, openDoorIds)

  return hasDungeonLineOfSightWithRevealableCells(dungeon, revealableCellKeys, closedDoorBlockers, sourceCell, targetCell)
}

function hasDungeonLineOfSightWithRevealableCells(
  dungeon: NormalizedDungeonMap,
  revealableCellKeys: Set<string>,
  closedDoorBlockers: ClosedDoorBlockers,
  sourceCell: DungeonMapPoint,
  targetCell: DungeonMapPoint,
) {
  let previousCell: DungeonMapPoint | null = null
  for (const cell of dungeonLineCells(sourceCell, targetCell)) {
    if (!isDungeonPointWithinBounds(cell, dungeon.bounds)) return false
    if (!revealableCellKeys.has(dungeonCellKey(cell))) return false
    if (previousCell && closedDoorBlocksStep(closedDoorBlockers.edgeKeys, previousCell, cell)) return false
    previousCell = cell
  }

  return true
}

export function buildDungeonLightingVisibility({
  dungeon,
  tokenLights = [],
  exploredCellKeys = [],
  distanceMetric,
  openDoorIds,
}: BuildDungeonLightingVisibilityInput) {
  const revealableCellKeys = getDungeonRevealableCellKeys(dungeon)
  const closedDoorBlockers = buildClosedDoorBlockers(dungeon, openDoorIds)
  const dungeonLights = dungeon.lights.map((light) => ({
    ...light,
    x: light.x - dungeon.bounds.originX,
    y: light.y - dungeon.bounds.originY,
  }))

  return calculateDungeonVisibility({
    bounds: { width: dungeon.bounds.width, height: dungeon.bounds.height },
    lights: [...dungeonLights, ...tokenLights],
    exploredCellKeys,
    distanceMetric,
    lineOfSight: (source, target) =>
      hasDungeonLineOfSightWithRevealableCells(dungeon, revealableCellKeys, closedDoorBlockers, source, target),
  })
}

function percentPointToDungeonCell(
  point: { x: number; y: number },
  dungeon: NormalizedDungeonMap,
  verticalMirror = false,
) {
  const width = Math.max(1, dungeon.bounds.width)
  const height = Math.max(1, dungeon.bounds.height)
  const x = Math.min(width - 1, Math.max(0, Math.floor((point.x / 100) * width)))
  const rawY = Math.min(height - 1, Math.max(0, Math.floor((point.y / 100) * height)))

  return {
    x,
    y: verticalMirror ? height - 1 - rawY : rawY,
  }
}

export function getPlayerVisibleDungeonCellKeys({
  dungeon,
  players,
  verticalMirror = false,
  candidateCellKeys,
  openDoorIds,
}: GetPlayerVisibleDungeonCellKeysInput) {
  const keys = new Set<string>()
  const revealableCellKeys = getDungeonRevealableCellKeys(dungeon)
  const closedDoorBlockers = buildClosedDoorBlockers(dungeon, openDoorIds)
  const playerCells = [...players]
    .filter((player) => player.type === "player" && !player.hidden)
    .map((player) => ({
      cell: percentPointToDungeonCell(player, dungeon, verticalMirror),
      vista: getVista(player),
    }))

  if (playerCells.length === 0) {
    return keys
  }

  for (const key of candidateCellKeys ?? revealableCellKeys) {
    if (!revealableCellKeys.has(key)) continue
    const cell = parseDungeonCellKey(key)
    if (!cell) continue
    if (playerCells.some((player) => {
      if (distanceBetweenCells(player.cell, cell, "euclidean") > player.vista) return false
      return hasDungeonLineOfSightWithRevealableCells(dungeon, revealableCellKeys, closedDoorBlockers, player.cell, cell)
    })) {
      keys.add(key)
    }
  }

  return keys
}

function distanceBetweenCells(
  source: DungeonMapPoint,
  target: DungeonMapPoint,
  metric: DungeonVisibilityDistanceMetric,
) {
  const deltaX = Math.abs(source.x - target.x)
  const deltaY = Math.abs(source.y - target.y)

  if (metric === "chebyshev") return Math.max(deltaX, deltaY)
  if (metric === "manhattan") return deltaX + deltaY
  return Math.hypot(deltaX, deltaY)
}

function strongestTier(left: DungeonVisibilityTier, right: DungeonVisibilityTier): DungeonVisibilityTier {
  const rank: Record<DungeonVisibilityTier, number> = {
    hidden: 0,
    explored: 1,
    dim: 2,
    bright: 3,
  }

  return rank[right] > rank[left] ? right : left
}

export function calculateDungeonVisibility({
  bounds,
  lights = [],
  exploredCellKeys = [],
  distanceMetric = "euclidean",
  lineOfSight,
}: CalculateDungeonVisibilityInput): DungeonVisibilityMap {
  const tiersByCellKey = new Map<string, DungeonVisibilityTier>()

  for (const key of exploredCellKeys) {
    const point = parseDungeonCellKey(key)
    if (!point || !isDungeonPointWithinBounds(point, bounds)) continue
    tiersByCellKey.set(dungeonCellKey(point), "explored")
  }

  for (const light of lights) {
    if (!light.enabled) continue
    const source = { x: Math.floor(light.x), y: Math.floor(light.y) }
    if (!isDungeonPointWithinBounds(source, bounds)) continue

    const radius = Math.max(light.brightRadiusCells, light.dimRadiusCells)
    const minX = Math.max(0, source.x - radius)
    const maxX = Math.min(bounds.width - 1, source.x + radius)
    const minY = Math.max(0, source.y - radius)
    const maxY = Math.min(bounds.height - 1, source.y + radius)

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const target = { x, y }
        if (lineOfSight && !lineOfSight(source, target)) continue

        const distance = distanceBetweenCells(source, target, distanceMetric)
        const nextTier = distance <= light.brightRadiusCells
          ? "bright"
          : distance <= light.dimRadiusCells
            ? "dim"
            : null
        if (!nextTier) continue

        const key = dungeonCellKey(target)
        tiersByCellKey.set(key, strongestTier(tiersByCellKey.get(key) ?? "hidden", nextTier))
      }
    }
  }

  return {
    bounds,
    tiersByCellKey,
    getTier(point) {
      if (!isDungeonPointWithinBounds(point, bounds)) return "hidden"
      return tiersByCellKey.get(dungeonCellKey(point)) ?? "hidden"
    },
  }
}
