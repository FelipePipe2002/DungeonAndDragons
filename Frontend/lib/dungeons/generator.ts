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
import { DUNGEON_MAP_DOCUMENT_TYPE, DUNGEON_MAP_DOCUMENT_VERSION, type DungeonMapDocument } from "./types.ts"

export type {
  CorridorGenerationOptions,
  DungeonGeneratorPreset,
  GenerateDungeonMapOptions,
  GeneratorDebugOptions,
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

  const document: DungeonMapDocument = {
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    metadata: buildGenerationMetadata(context, placement.warning),
    layout: {
      width: context.width,
      height: context.height,
      rooms: finalized.rooms,
      corridors: finalized.corridors,
      doors: finalized.doors,
    },
  }

  readDungeonMapDocument(document)
  return document
}

export function stringifyDungeonMapDocument(document: DungeonMapDocument) {
  return `${JSON.stringify(document, null, 2)}\n`
}
