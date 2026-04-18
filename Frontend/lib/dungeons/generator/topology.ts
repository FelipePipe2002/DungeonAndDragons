import type { GenerationContext, PlacedRoom, RoomGraph } from "./core.ts"
import { runTopologyStage } from "./core.ts"

export function buildRoomGraph(rooms: PlacedRoom[], context: GenerationContext): RoomGraph {
  return runTopologyStage(rooms, context)
}
