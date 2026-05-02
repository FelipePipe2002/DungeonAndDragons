import test from "node:test"
import assert from "node:assert/strict"

import {
  DungeonMapParseError,
  normalizeDungeonMapDocument,
  parseDungeonMapDocument,
  readDungeonMapDocument,
  validateDungeonMapDocument,
} from "./adapter.ts"
import { DUNGEON_MAP_DOCUMENT_TYPE, DUNGEON_MAP_DOCUMENT_VERSION, type DungeonMapDocument } from "./types.ts"

function buildMinimalDocument(): DungeonMapDocument {
  return {
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    layout: {
      width: 50,
      height: 30,
      rooms: [
        {
          id: "room-1",
          shape: "rect",
          x: 1,
          y: 2,
          width: 10,
          height: 8,
        },
      ],
    },
  }
}

test("parsea documento desde string JSON", () => {
  const parsed = parseDungeonMapDocument(JSON.stringify(buildMinimalDocument()))

  assert.equal(typeof parsed, "object")
  assert.equal((parsed as DungeonMapDocument).type, DUNGEON_MAP_DOCUMENT_TYPE)
})

test("rechaza string JSON invalido con error claro", () => {
  assert.throws(
    () => parseDungeonMapDocument("{ nope"),
    (error: unknown) => {
      assert.ok(error instanceof DungeonMapParseError)
      assert.equal(error.code, "invalid_json")
      assert.equal(error.message, "El documento de mazmorra no es un JSON valido.")
      return true
    },
  )
})

test("valida documento completo con rooms corridors doors markers y lights", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    metadata: {
      name: "  Catacumbas  ",
      seed: "seed-1",
    },
    layout: {
      ...buildMinimalDocument().layout,
      units: "cell",
      origin: { x: 5, y: 6 },
      corridors: [{ id: "corr-1", points: [{ x: 1, y: 1 }, { x: 3, y: 1 }] }],
      doors: [{ id: "door-1", x: 3, y: 1, direction: "east", kind: "locked" }],
      markers: [{ id: "marker-1", x: 2, y: 2, kind: "trap", label: "  Peligro  " }],
      lights: [{ id: "light-1", x: 4, y: 5, kind: "torch", label: "  Antorcha  ", brightRadiusCells: 4, dimRadiusCells: 8, mode: "radius", placement: "manual" }],
    },
  })

  assert.equal(result.ok, true)
})

test("rechaza contrato invalido con type incorrecto", () => {
  assert.throws(
    () => readDungeonMapDocument({ ...buildMinimalDocument(), type: "ciudad" }),
    (error: unknown) => {
      assert.ok(error instanceof DungeonMapParseError)
      assert.equal(error.code, "invalid_contract")
      assert.equal(error.details.includes('El documento debe incluir type="mazmorra".'), true)
      return true
    },
  )
})

test("rechaza room invalida con error de shape", () => {
  assert.throws(
    () =>
      readDungeonMapDocument({
        ...buildMinimalDocument(),
        layout: {
          ...buildMinimalDocument().layout,
          rooms: [{ id: "room-1", shape: "rect", x: 1, y: 2, width: 0, height: 8 }],
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof DungeonMapParseError)
      assert.equal(error.code, "invalid_shape")
      assert.equal(
        error.details.includes("layout.rooms[0].width y layout.rooms[0].height deben ser numeros finitos mayores a 0."),
        true,
      )
      return true
    },
  )
})

test("rechaza corridor invalido", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      corridors: [{ id: "corr-1", points: [{ x: 1, y: 1 }] }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.corridors[0].points debe ser un arreglo con al menos 2 puntos."), true)
})

test("rechaza corridor con segmentos diagonales", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      corridors: [{ id: "corr-1", points: [{ x: 1, y: 1 }, { x: 3, y: 2 }] }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.corridors[0].points debe contener solo segmentos ortogonales."), true)
})

test("rechaza corridor fuera de limites", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      width: 5,
      height: 5,
      corridors: [{ id: "corr-1", points: [{ x: 4, y: 4 }, { x: 5, y: 4 }] }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.corridors[0] debe permanecer dentro de layout.width y layout.height."), true)
})

test("acepta rooms mask conectadas y las normaliza", () => {
  const normalized = readDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      rooms: [
        {
          id: "room-l",
          shape: "mask",
          x: 2,
          y: 3,
          mask: {
            width: 4,
            height: 4,
            cells: [
              [1, 0, 0, 0],
              [1, 0, 0, 0],
              [1, 1, 1, 1],
              [0, 0, 0, 0],
            ],
          },
          label: "L",
        },
      ],
    },
  })

  assert.equal(normalized.rooms[0]?.shape, "mask")
  assert.equal(normalized.rooms[0]?.x, 2)
  assert.equal(normalized.rooms[0]?.y, 3)
  assert.equal(normalized.rooms[0]?.width, 4)
  assert.equal(normalized.rooms[0]?.height, 3)
  assert.equal(normalized.rooms[0]?.cells.length, 6)
})

test("rechaza rooms mask desconectadas", () => {
  assert.throws(
    () =>
      readDungeonMapDocument({
        ...buildMinimalDocument(),
        layout: {
          ...buildMinimalDocument().layout,
          rooms: [
            {
              id: "room-bad",
              shape: "mask",
              x: 1,
              y: 1,
              mask: {
                width: 3,
                height: 3,
                cells: [
                  [1, 0, 0],
                  [0, 0, 0],
                  [0, 0, 1],
                ],
              },
            },
          ],
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof DungeonMapParseError)
      assert.equal(error.code, "invalid_shape")
      assert.equal(error.details.includes("layout.rooms[0].mask debe formar una figura conectada."), true)
      return true
    },
  )
})

test("rechaza masks vacias o con celdas invalidas", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      rooms: [
        {
          id: "room-bad",
          shape: "mask",
          x: 1,
          y: 1,
          mask: {
            width: 2,
            height: 2,
            cells: [
              [0, 0],
              [1, 2],
            ],
          },
        },
      ],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.rooms[0].mask.cells[1][1] debe ser 0 o 1."), true)
})

test("mantiene compatibilidad de lectura con rooms compuestas", () => {
  const normalized = readDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      rooms: [
        {
          id: "legacy-room",
          shape: "composite",
          parts: [
            { x: 2, y: 2, width: 2, height: 3 },
            { x: 4, y: 4, width: 3, height: 1 },
          ],
        },
      ],
    },
  })

  assert.equal(normalized.rooms[0]?.shape, "composite")
  assert.equal(normalized.rooms[0]?.cells.length, 9)
})

test("rechaza masks vacias y fuera de limites", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      width: 4,
      height: 4,
      rooms: [
        {
          id: "room-empty",
          shape: "mask",
          x: 3,
          y: 3,
          mask: {
            width: 2,
            height: 2,
            cells: [
              [0, 0],
              [0, 0],
            ],
          },
        },
      ],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.rooms[0].mask debe contener al menos una celda ocupada."), true)
})

test("rechaza solapamiento entre rooms", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      rooms: [
        { id: "room-1", shape: "rect", x: 1, y: 1, width: 5, height: 5 },
        {
          id: "room-2",
          shape: "mask",
          x: 4,
          y: 2,
          mask: {
            width: 4,
            height: 4,
            cells: [
              [1, 1, 1, 1],
              [1, 1, 1, 1],
              [1, 1, 1, 1],
              [1, 1, 1, 1],
            ],
          },
        },
      ],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.rooms[0] no puede superponerse con layout.rooms[1]."), true)
})

test("normaliza defaults no ambiguos", () => {
  const normalized = normalizeDungeonMapDocument(buildMinimalDocument())

  assert.deepEqual(normalized.metadata, {
    name: null,
    seed: null,
    generator: null,
    notes: null,
  })
  assert.deepEqual(normalized.bounds, {
    width: 50,
    height: 30,
    originX: 0,
    originY: 0,
    units: "tile",
  })
  assert.equal(normalized.rooms[0]?.kind, "room")
  assert.equal(normalized.rooms[0]?.label, null)
  assert.deepEqual(normalized.corridors, [])
  assert.deepEqual(normalized.doors, [])
  assert.deepEqual(normalized.markers, [])
  assert.deepEqual(normalized.lights, [])
})

test("read devuelve estructura normalizada sin JSON crudo ambiguo", () => {
  const normalized = readDungeonMapDocument(
    JSON.stringify({
      ...buildMinimalDocument(),
      metadata: { name: "  Dungeon Uno  ", generator: "  gen-v1  " },
      layout: {
        ...buildMinimalDocument().layout,
        doors: [{ id: "door-1", x: 4, y: 5, direction: "north" }],
        markers: [{ id: "marker-1", x: 2, y: 3, kind: " loot ", label: "  Cofre  " }],
        lights: [{ id: " light-1 ", x: 6, y: 7, kind: "torch", label: "  Antorcha  ", brightRadiusCells: 4, dimRadiusCells: 8, mode: "radius" }],
      },
    }),
  )

  assert.equal(normalized.type, DUNGEON_MAP_DOCUMENT_TYPE)
  assert.equal(normalized.version, DUNGEON_MAP_DOCUMENT_VERSION)
  assert.equal(normalized.metadata.name, "Dungeon Uno")
  assert.equal(normalized.metadata.generator, "gen-v1")
  assert.equal(normalized.doors[0]?.kind, "door")
  assert.equal(normalized.doors[0]?.direction, "north")
  assert.equal(normalized.markers[0]?.kind, "loot")
  assert.equal(normalized.markers[0]?.label, "Cofre")
  assert.deepEqual(normalized.lights[0], {
    id: "light-1",
    x: 6,
    y: 7,
    kind: "torch",
    label: "Antorcha",
    enabled: true,
    brightRadiusCells: 4,
    dimRadiusCells: 8,
    mode: "radius",
    placement: null,
    wallMounted: false,
    orientation: "south",
  })
})

test("rechaza lights con radios invalidos", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      lights: [{ id: "light-1", x: 2, y: 2, kind: "torch", brightRadiusCells: 6, dimRadiusCells: 4, mode: "radius" }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.lights[0].dimRadiusCells debe ser mayor o igual a layout.lights[0].brightRadiusCells."), true)
})

test("rechaza lights con modo invalido", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      lights: [{ id: "light-1", x: 2, y: 2, kind: "torch", brightRadiusCells: 4, dimRadiusCells: 8, mode: "cone" }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.lights[0].mode debe ser uno de: radius, line-of-sight."), true)
})

test("rechaza doors sin direccion", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      doors: [{ id: "door-1", x: 4, y: 5 }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.doors[0].direction es obligatoria."), true)
})

test("rechaza doors fuera de limites", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      width: 5,
      height: 5,
      doors: [{ id: "door-1", x: 5, y: 1, direction: "east" }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.doors[0] debe permanecer dentro de layout.width y layout.height."), true)
})

test("rechaza markers fuera de limites", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      width: 5,
      height: 5,
      markers: [{ id: "marker-1", x: 6, y: 2, kind: "trap" }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.markers[0] debe permanecer dentro de layout.width y layout.height."), true)
})

test("rechaza lights fuera de limites", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      width: 5,
      height: 5,
      lights: [{ id: "light-1", x: 5, y: 2, kind: "torch", brightRadiusCells: 4, dimRadiusCells: 8, mode: "radius" }],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.lights[0] debe permanecer dentro de layout.width y layout.height."), true)
})

test("rechaza units pixel porque el renderer solo soporta tile o cell", () => {
  const result = validateDungeonMapDocument({
    ...buildMinimalDocument(),
    layout: {
      ...buildMinimalDocument().layout,
      units: "pixel",
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("layout.units debe ser uno de: tile, cell."), true)
})
