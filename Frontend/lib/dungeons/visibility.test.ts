import test from "node:test"
import assert from "node:assert/strict"

import type { NormalizedDungeonLightSource, NormalizedDungeonMap } from "./types.ts"
import {
  buildDungeonLightingVisibility,
  calculateDungeonVisibility,
  dungeonCellKey,
  getPlayerVisibleDungeonCellKeys,
  getVista,
  hasDungeonLineOfSight,
  parseDungeonCellKey,
} from "./visibility.ts"

function light(overrides: Partial<NormalizedDungeonLightSource> = {}): NormalizedDungeonLightSource {
  const base: NormalizedDungeonLightSource = {
    id: "light-1",
    x: 5,
    y: 5,
    kind: "torch",
    label: null,
    enabled: true,
    brightRadiusCells: 2,
    dimRadiusCells: 4,
    mode: "radius",
    placement: null,
    wallMounted: false,
    orientation: "south",
  }

  return {
    ...base,
    ...overrides,
    wallMounted: overrides.wallMounted ?? base.wallMounted,
    orientation: overrides.orientation ?? base.orientation,
  }
}

function dungeonFixture(): NormalizedDungeonMap {
  return {
    type: "mazmorra",
    version: 1,
    metadata: {
      name: null,
      seed: null,
      generator: null,
      notes: null,
    },
    bounds: {
      width: 8,
      height: 5,
      originX: 0,
      originY: 0,
      units: "tile",
    },
    rooms: [
      {
        id: "room-left",
        kind: "room",
        shape: "rect",
        x: 0,
        y: 1,
        width: 2,
        height: 2,
        cells: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
        spans: [{ x: 0, y: 1, width: 2, height: 2 }],
        labelAnchor: { x: 0, y: 1 },
        label: null,
      },
      {
        id: "room-right",
        kind: "room",
        shape: "rect",
        x: 5,
        y: 1,
        width: 2,
        height: 2,
        cells: [
          { x: 5, y: 1 },
          { x: 6, y: 1 },
          { x: 5, y: 2 },
          { x: 6, y: 2 },
        ],
        spans: [{ x: 5, y: 1, width: 2, height: 2 }],
        labelAnchor: { x: 5, y: 1 },
        label: null,
      },
    ],
    corridors: [
      {
        id: "corridor-1",
        points: [
          { x: 1, y: 1 },
          { x: 5, y: 1 },
        ],
        width: 1,
      },
    ],
    doors: [],
    markers: [],
    lights: [],
    props: [],
  }
}

function dungeonWithDoorFixture(): NormalizedDungeonMap {
  return {
    ...dungeonFixture(),
    doors: [
      {
        id: "door-left-corridor",
        x: 1,
        y: 1,
        direction: "east",
        kind: "door",
      },
    ],
  }
}

function bentVisibilityLeakFixture(): NormalizedDungeonMap {
  return {
    ...dungeonFixture(),
    bounds: {
      width: 5,
      height: 2,
      originX: 0,
      originY: 0,
      units: "tile",
    },
    rooms: [
      {
        id: "bent-space",
        kind: "room",
        shape: "mask",
        x: 0,
        y: 0,
        width: 5,
        height: 2,
        cells: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
        spans: [
          { x: 0, y: 0, width: 3, height: 1 },
          { x: 3, y: 1, width: 2, height: 1 },
        ],
        labelAnchor: { x: 0, y: 0 },
        label: null,
      },
    ],
    corridors: [],
    doors: [],
    lights: [],
  }
}

test("calculateDungeonVisibility devuelve tiers bright dim explored hidden", () => {
  const visibility = calculateDungeonVisibility({
    bounds: { width: 12, height: 12 },
    lights: [light()],
    exploredCellKeys: ["0,0", "5,9"],
  })

  assert.equal(visibility.getTier({ x: 5, y: 5 }), "bright")
  assert.equal(visibility.getTier({ x: 7, y: 5 }), "bright")
  assert.equal(visibility.getTier({ x: 9, y: 5 }), "dim")
  assert.equal(visibility.getTier({ x: 5, y: 9 }), "dim")
  assert.equal(visibility.getTier({ x: 0, y: 0 }), "explored")
  assert.equal(visibility.getTier({ x: 11, y: 11 }), "hidden")
})

test("calculateDungeonVisibility puede usar distancia chebyshev", () => {
  const visibility = calculateDungeonVisibility({
    bounds: { width: 12, height: 12 },
    lights: [light()],
    distanceMetric: "chebyshev",
  })

  assert.equal(visibility.getTier({ x: 7, y: 7 }), "bright")
  assert.equal(visibility.getTier({ x: 9, y: 9 }), "dim")
})

test("calculateDungeonVisibility respeta disabled lights y lineOfSight", () => {
  const disabled = calculateDungeonVisibility({
    bounds: { width: 12, height: 12 },
    lights: [light({ enabled: false })],
  })
  assert.equal(disabled.getTier({ x: 5, y: 5 }), "hidden")

  const withLos = calculateDungeonVisibility({
    bounds: { width: 12, height: 12 },
    lights: [light()],
    lineOfSight: (_source, target) => target.x <= 5,
  })
  assert.equal(withLos.getTier({ x: 4, y: 5 }), "bright")
  assert.equal(withLos.getTier({ x: 6, y: 5 }), "hidden")
})

test("calculateDungeonVisibility usa el tier mas fuerte entre luces y memoria", () => {
  const visibility = calculateDungeonVisibility({
    bounds: { width: 12, height: 12 },
    lights: [light({ id: "light-1", x: 2, y: 2 }), light({ id: "light-2", x: 6, y: 2 })],
    exploredCellKeys: ["4,2"],
  })

  assert.equal(visibility.getTier({ x: 4, y: 2 }), "bright")
})

test("dungeon cell key helpers son reversibles para coordenadas enteras", () => {
  assert.equal(dungeonCellKey({ x: 3, y: 8 }), "3,8")
  assert.deepEqual(parseDungeonCellKey("3,8"), { x: 3, y: 8 })
  assert.equal(parseDungeonCellKey("bad"), null)
})

test("hasDungeonLineOfSight permite ver por rooms y corridors conectados", () => {
  const dungeon = dungeonFixture()

  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 1 }, { x: 6, y: 1 }), true)
})

test("hasDungeonLineOfSight bloquea si la linea cruza pared o vacio", () => {
  const dungeon = dungeonFixture()

  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 2 }, { x: 6, y: 2 }), false)
  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 1 }, { x: 7, y: 1 }), false)
})

test("hasDungeonLineOfSight no permite ver por una esquina diagonal", () => {
  const dungeon = dungeonFixture()

  assert.equal(hasDungeonLineOfSight(dungeon, { x: 1, y: 2 }, { x: 2, y: 1 }), false)
})

test("hasDungeonLineOfSight no salta paredes en pendientes suaves", () => {
  const dungeon = bentVisibilityLeakFixture()

  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 0 }, { x: 4, y: 1 }), false)
})

test("hasDungeonLineOfSight bloquea puertas cerradas y permite puertas abiertas", () => {
  const dungeon = dungeonWithDoorFixture()

  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 1 }, { x: 3, y: 1 }), false)
  assert.equal(hasDungeonLineOfSight(dungeon, { x: 0, y: 1 }, { x: 3, y: 1 }, new Set(["door-left-corridor"])), true)
})

test("buildDungeonLightingVisibility no ilumina despues de una puerta cerrada", () => {
  const dungeon = {
    ...dungeonWithDoorFixture(),
    lights: [light({ id: "torch-left", x: 0, y: 1, brightRadiusCells: 8, dimRadiusCells: 8 })],
  }
  const closedVisibility = buildDungeonLightingVisibility({ dungeon })
  const openVisibility = buildDungeonLightingVisibility({ dungeon, openDoorIds: new Set(["door-left-corridor"]) })

  assert.equal(closedVisibility.getTier({ x: 0, y: 1 }), "bright")
  assert.equal(closedVisibility.getTier({ x: 3, y: 1 }), "hidden")
  assert.equal(openVisibility.getTier({ x: 3, y: 1 }), "bright")
})

test("getPlayerVisibleDungeonCellKeys respeta puertas abiertas y cerradas", () => {
  const dungeon = dungeonWithDoorFixture()
  const input = {
    dungeon,
    players: [{ type: "player", hidden: false, x: 6, y: 30 }],
    candidateCellKeys: ["3,1"],
  }

  assert.equal(getPlayerVisibleDungeonCellKeys(input).has("3,1"), false)
  assert.equal(
    getPlayerVisibleDungeonCellKeys({ ...input, openDoorIds: new Set(["door-left-corridor"]) }).has("3,1"),
    true,
  )
})

test("buildDungeonLightingVisibility combina luces y no ilumina a traves de paredes", () => {
  const dungeon = {
    ...dungeonFixture(),
    lights: [light({ id: "torch-left", x: 0, y: 2, brightRadiusCells: 8, dimRadiusCells: 8 })],
  }
  const visibility = buildDungeonLightingVisibility({
    dungeon,
    tokenLights: [light({ id: "token-right", x: 6, y: 1, brightRadiusCells: 1, dimRadiusCells: 1 })],
  })

  assert.equal(visibility.getTier({ x: 1, y: 2 }), "bright")
  assert.equal(visibility.getTier({ x: 4, y: 2 }), "hidden")
  assert.equal(visibility.getTier({ x: 6, y: 1 }), "bright")
})

test("buildDungeonLightingVisibility no pierde celdas bright dentro de la misma sala", () => {
  const dungeon = {
    ...dungeonFixture(),
    lights: [light({ id: "torch-left", x: 0, y: 2, brightRadiusCells: 2, dimRadiusCells: 2 })],
  }
  const visibility = buildDungeonLightingVisibility({ dungeon })

  assert.equal(visibility.getTier({ x: 0, y: 2 }), "bright")
  assert.equal(visibility.getTier({ x: 1, y: 1 }), "bright")
  assert.equal(visibility.getTier({ x: 1, y: 2 }), "bright")
})

test("getVista usa 24 celdas por defecto y respeta override positivo", () => {
  assert.equal(getVista(null), 24)
  assert.equal(getVista({ vista: undefined }), 24)
  assert.equal(getVista({ vista: 0 }), 24)
  assert.equal(getVista({ vista: 12 }), 12)
})

test("getPlayerVisibleDungeonCellKeys usa solo players visibles y celdas revealable", () => {
  const dungeon = dungeonFixture()
  const visibleCells = getPlayerVisibleDungeonCellKeys({
    dungeon,
    players: [
      { type: "enemy", hidden: false, x: 81, y: 30 },
      { type: "player", hidden: true, x: 81, y: 30 },
      { type: "player", hidden: false, x: 6, y: 30 },
    ],
  })

  assert.equal(visibleCells.has("0,1"), true)
  assert.equal(visibleCells.has("1,2"), true)
  assert.equal(visibleCells.has("4,2"), false)
  assert.equal(visibleCells.has("7,1"), false)
})

test("getPlayerVisibleDungeonCellKeys puede convertir la posicion con mirror vertical", () => {
  const dungeon = dungeonFixture()
  const visibleCells = getPlayerVisibleDungeonCellKeys({
    dungeon,
    players: [{ type: "player", hidden: false, x: 6, y: 70 }],
    verticalMirror: true,
  })

  assert.equal(visibleCells.has("0,1"), true)
  assert.equal(visibleCells.has("4,2"), false)
})

test("getPlayerVisibleDungeonCellKeys respeta vista y paredes para celdas candidatas", () => {
  const dungeon = dungeonFixture()
  const visibleCells = getPlayerVisibleDungeonCellKeys({
    dungeon,
    players: [{ type: "player", hidden: false, x: 6, y: 30, vista: 2 }],
    candidateCellKeys: ["1,1", "3,1", "6,1", "6,2"],
  })

  assert.equal(visibleCells.has("1,1"), true)
  assert.equal(visibleCells.has("3,1"), false)
  assert.equal(visibleCells.has("6,1"), false)
  assert.equal(visibleCells.has("6,2"), false)
})

test("getPlayerVisibleDungeonCellKeys no ve luz detras de una pared aunque este en rango", () => {
  const dungeon = dungeonFixture()
  const visibleCells = getPlayerVisibleDungeonCellKeys({
    dungeon,
    players: [{ type: "player", hidden: false, x: 6, y: 50 }],
    candidateCellKeys: ["6,2"],
  })

  assert.equal(visibleCells.has("6,2"), false)
})
