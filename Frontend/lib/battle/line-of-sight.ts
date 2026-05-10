import type { DungeonMapPoint, NormalizedDungeonMap } from "@/lib/dungeons/types"
import { hasDungeonLineOfSight } from "@/lib/dungeons/visibility"

type HasBattleMapLineOfSightInput = {
  dungeon?: NormalizedDungeonMap | null
  source: DungeonMapPoint
  target: DungeonMapPoint
}

export function hasBattleMapLineOfSight({ dungeon = null, source, target }: HasBattleMapLineOfSightInput) {
  if (!dungeon) {
    return true
  }

  return hasDungeonLineOfSight(dungeon, source, target)
}
