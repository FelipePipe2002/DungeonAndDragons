import { generateDungeonMapDocument, stringifyDungeonMapDocument } from "./generator.ts"

export const minimalDungeonFixture = generateDungeonMapDocument({
  preset: "minimal",
  name: "Mazmorra minima",
  width: 24,
  height: 24,
})

export const simpleDungeonFixture = generateDungeonMapDocument({
  preset: "simple",
  name: "Mazmorra simple",
  width: 40,
  height: 28,
})

export const roomsAndCorridorsDungeonFixture = generateDungeonMapDocument({
  preset: "rooms-corridors",
  name: "Mazmorra con salas y corredores",
  width: 72,
  height: 32,
  roomCount: 5,
  roomWidth: 8,
  roomHeight: 6,
  corridorWidth: 2,
  includeCorridors: true,
})

export const DUNGEON_MAP_FIXTURES = {
  minimal: minimalDungeonFixture,
  simple: simpleDungeonFixture,
  roomsAndCorridors: roomsAndCorridorsDungeonFixture,
} as const

export const DUNGEON_MAP_FIXTURE_JSON = {
  minimal: stringifyDungeonMapDocument(minimalDungeonFixture),
  simple: stringifyDungeonMapDocument(simpleDungeonFixture),
  roomsAndCorridors: stringifyDungeonMapDocument(roomsAndCorridorsDungeonFixture),
} as const
