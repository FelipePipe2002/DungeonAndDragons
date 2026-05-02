import { readDungeonMapDocument } from "./adapter.ts"
import {
  createGenerationContext,
  buildGenerationMetadata,
  type GenerateDungeonMapOptions,
} from "./generator/core.ts"
import { placeRooms } from "./generator/room-placement.ts"
import { routeCorridors } from "./generator/corridor-routing.ts"
import { buildRoomGraph } from "./generator/topology.ts"
import { cleanupCorridors } from "./generator/corridor-cleanup.ts"
import { generateDungeonTorchLights } from "./lights.ts"
import { DUNGEON_MAP_DOCUMENT_TYPE, DUNGEON_MAP_DOCUMENT_VERSION, type DungeonMapDocument } from "./types.ts"

export type {
  CorridorGenerationOptions,
  DungeonGeneratorPreset,
  GenerateDungeonMapOptions,
  GeneratorDebugOptions,
  LightingGenerationOptions,
  RoomGenerationOptions,
  TopologyGenerationOptions,
} from "./generator/core.ts"
export type {
  CorridorPlan,
  GenerationContext,
  PlacedRoom,
  RoomGraph,
  SpatialIndex,
} from "./generator/core.ts"

export function generateDungeonMapDocument(options: GenerateDungeonMapOptions = {}): DungeonMapDocument {
  const context = createGenerationContext(options)

  if (context.preset === "minimal") {
    const minimal: DungeonMapDocument = {
      type: DUNGEON_MAP_DOCUMENT_TYPE,
      version: DUNGEON_MAP_DOCUMENT_VERSION,
      metadata: buildGenerationMetadata(context),
      layout: {
        width: context.width,
        height: context.height,
        rooms: [],
      },
    }

    readDungeonMapDocument(minimal)
    return minimal
  }

  const placement = placeRooms(context)
  const topology = buildRoomGraph(placement.rooms, context)
  const routing = routeCorridors(context, placement.rooms, topology)
  const finalized = cleanupCorridors(context, placement.rooms, routing, topology)
  const finalizedRooms = finalized.rooms as DungeonMapDocument["layout"]["rooms"]
  const lights = generateDungeonTorchLights({
    rooms: finalizedRooms.filter((room) => room.shape === "rect"),
    corridors: finalized.corridors,
    blockedCells: finalized.doors,
    options: {
      enabled: context.lightingEnabled,
      placement: context.lightingPlacement,
      densityPercent: context.lightDensityPercent,
      brightRadiusCells: context.lightBrightRadiusCells,
      dimRadiusCells: context.lightDimRadiusCells,
    },
  })

  const layout: DungeonMapDocument["layout"] = {
    width: context.width,
    height: context.height,
    rooms: finalizedRooms,
    corridors: finalized.corridors,
    doors: finalized.doors,
  }

  if (lights.length > 0) {
    layout.lights = lights
  }

  const document: DungeonMapDocument = {
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    metadata: buildGenerationMetadata(context, placement.warning),
    layout,
  }

  readDungeonMapDocument(document)
  return document
}

export function stringifyDungeonMapDocument(document: DungeonMapDocument) {
  return `${JSON.stringify(document, null, 2)}\n`
}
