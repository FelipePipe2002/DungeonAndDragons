import test from "node:test"
import assert from "node:assert/strict"

import type { NormalizedDungeonLightSource } from "./types.ts"
import {
  calculateDungeonVisibility,
  dungeonCellKey,
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
