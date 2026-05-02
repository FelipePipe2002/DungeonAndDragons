import test from "node:test"
import assert from "node:assert/strict"

import {
  createDungeonLightSource,
  createNextDungeonLightId,
  generateDungeonTorchLights,
  normalizeDungeonLightSource,
} from "./lights.ts"

test("createNextDungeonLightId ignora ids no numericos y continua la secuencia", () => {
  assert.equal(
    createNextDungeonLightId([{ id: "light-1" }, { id: "torch" }, { id: "light-4" }]),
    "light-5",
  )
})

test("createDungeonLightSource aplica defaults seguros", () => {
  const light = createDungeonLightSource({ x: 3, y: 4 }, [{ id: "light-1" }])

  assert.deepEqual(light, {
    id: "light-2",
    x: 3,
    y: 4,
    kind: "torch",
    enabled: true,
    brightRadiusCells: 4,
    dimRadiusCells: 8,
    mode: "radius",
    wallMounted: false,
    orientation: "south",
  })
})

test("normalizeDungeonLightSource recorta label y fuerza dim >= bright", () => {
  const normalized = normalizeDungeonLightSource({
    id: " light-1 ",
    x: 5,
    y: 6,
    kind: "magic",
    label: "  Luz azul  ",
    enabled: false,
    brightRadiusCells: 6,
    dimRadiusCells: 3,
    mode: "line-of-sight",
    placement: "manual",
  })

  assert.deepEqual(normalized, {
    id: "light-1",
    x: 5,
    y: 6,
    kind: "magic",
    label: "Luz azul",
    enabled: false,
    brightRadiusCells: 6,
    dimRadiusCells: 6,
    mode: "line-of-sight",
    placement: "manual",
    wallMounted: false,
    orientation: "south",
  })
})

test("generateDungeonTorchLights ubica antorchas generadas de forma determinista", () => {
  const lights = generateDungeonTorchLights({
    rooms: [
      { id: "room-1", x: 2, y: 3, width: 6, height: 4 },
      { id: "room-2", x: 12, y: 8, width: 5, height: 5 },
    ],
    existingLights: [{ id: "light-3", x: 99, y: 99 }],
    options: { maxLights: 2, brightRadiusCells: 5, dimRadiusCells: 9 },
  })

  assert.deepEqual(lights.map((light) => ({
    id: light.id,
    x: light.x,
    y: light.y,
    label: light.label,
    placement: light.placement,
    wallMounted: light.wallMounted,
    orientation: light.orientation,
    brightRadiusCells: light.brightRadiusCells,
    dimRadiusCells: light.dimRadiusCells,
  })), [
    { id: "light-4", x: 5, y: 3, label: "Torch room-1 1", placement: "generated", wallMounted: true, orientation: "north", brightRadiusCells: 5, dimRadiusCells: 9 },
    { id: "light-5", x: 5, y: 6, label: "Torch room-1 2", placement: "generated", wallMounted: true, orientation: "south", brightRadiusCells: 5, dimRadiusCells: 9 },
  ])
})

test("generateDungeonTorchLights respeta enabled false y saltea posiciones ocupadas", () => {
  assert.deepEqual(generateDungeonTorchLights({ rooms: [{ x: 0, y: 0, width: 3, height: 3 }], options: { enabled: false } }), [])

  const lights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 2, y: 3, width: 6, height: 4 }],
    existingLights: [{ id: "light-1", x: 5, y: 3 }],
  })

  assert.deepEqual(lights.map((light) => ({ x: light.x, y: light.y, orientation: light.orientation })), [
    { x: 5, y: 6, orientation: "south" },
    { x: 2, y: 5, orientation: "west" },
  ])
})

test("generateDungeonTorchLights evita puertas y usa otra pared disponible", () => {
  const lights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 2, y: 3, width: 6, height: 4 }],
    blockedCells: [{ x: 5, y: 3 }],
  })

  assert.deepEqual(lights.map((light) => ({ x: light.x, y: light.y, orientation: light.orientation })), [
    { x: 5, y: 6, orientation: "south" },
    { x: 2, y: 5, orientation: "west" },
  ])
})

test("generateDungeonTorchLights escala cantidad por tamano de sala y densidad", () => {
  assert.deepEqual(generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 0, y: 0, width: 12, height: 10 }],
    options: { densityPercent: 0 },
  }), [])

  const lowDensityLights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 0, y: 0, width: 6, height: 4 }],
    options: { densityPercent: 50 },
  })
  const defaultDensityLights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 0, y: 0, width: 6, height: 4 }],
  })
  const largeRoomLights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 20, y: 20, width: 12, height: 10 }],
  })
  const highDensityLargeRoomLights = generateDungeonTorchLights({
    rooms: [{ id: "room-1", x: 40, y: 40, width: 12, height: 10 }],
    options: { densityPercent: 200 },
  })

  assert.equal(lowDensityLights.length, 1)
  assert.equal(defaultDensityLights.length, 2)
  assert.equal(largeRoomLights.length > defaultDensityLights.length, true)
  assert.equal(highDensityLargeRoomLights.length > largeRoomLights.length, true)
  assert.equal(highDensityLargeRoomLights.length <= 8, true)
})

test("generateDungeonTorchLights puede ubicar antorchas en giros e intersecciones de corridors", () => {
  const lights = generateDungeonTorchLights({
    rooms: [],
    corridors: [
      { id: "corridor-1", points: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 6 }] },
      { id: "corridor-2", points: [{ x: 5, y: 1 }, { x: 8, y: 1 }] },
      { id: "corridor-3", points: [{ x: 5, y: 1 }, { x: 5, y: 0 }] },
    ],
    options: { placement: "corridors" },
  })

  assert.deepEqual(lights.map((light) => ({ x: light.x, y: light.y, placement: light.placement, wallMounted: light.wallMounted, orientation: light.orientation })), [
    { x: 5, y: 1, placement: "generated", wallMounted: true, orientation: "south" },
  ])
})

test("generateDungeonTorchLights tambien distribuye antorchas en corridors largos", () => {
  const lights = generateDungeonTorchLights({
    rooms: [],
    corridors: [
      { id: "corridor-1", points: [{ x: 1, y: 1 }, { x: 21, y: 1 }] },
    ],
    options: { placement: "corridors" },
  })

  assert.deepEqual(lights.map((light) => ({ x: light.x, y: light.y, label: light.label, placement: light.placement, wallMounted: light.wallMounted, orientation: light.orientation })), [
    { x: 8, y: 1, label: "Torch corridor-1", placement: "generated", wallMounted: true, orientation: "north" },
    { x: 14, y: 1, label: "Torch corridor-1", placement: "generated", wallMounted: true, orientation: "north" },
  ])
})
