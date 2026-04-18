import type { PlacedRoom, GenerationContext } from "./core.ts"
import { runPlacementStage } from "./core.ts"

export type PlacementResult = {
  rooms: PlacedRoom[]
  warning?: string
}

export function placeRooms(context: GenerationContext): PlacementResult {
  return runPlacementStage(context)
}
