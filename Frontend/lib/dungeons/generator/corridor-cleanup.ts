import type { CorridorPlan, GenerationContext, PlacedRoom, RoomGraph } from "./core.ts"
import { runCleanupStage } from "./core.ts"

export function cleanupCorridors(
  context: GenerationContext,
  rooms: PlacedRoom[],
  plan: CorridorPlan,
  graph: RoomGraph,
) {
  return runCleanupStage(context, rooms, plan, graph)
}
