import type { DungeonMapPoint, NormalizedDungeonLightSource } from "./types.ts"

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
