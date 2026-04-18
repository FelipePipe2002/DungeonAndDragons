import type { CorridorPlan, GenerationContext, PlacedRoom, RoomGraph } from "./core.ts"
import { runRoutingStage } from "./core.ts"

export function routeCorridors(context: GenerationContext, rooms: PlacedRoom[], graph: RoomGraph): CorridorPlan {
  return runRoutingStage(context, rooms, graph)
}
