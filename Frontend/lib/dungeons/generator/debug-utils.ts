import type { DungeonCorridor } from "../types.ts"

export function cloneCorridors(corridors: DungeonCorridor[]) {
  return corridors.map((corridor) => ({
    id: corridor.id,
    points: corridor.points.map((point) => ({ ...point })),
    width: corridor.width,
  }))
}
