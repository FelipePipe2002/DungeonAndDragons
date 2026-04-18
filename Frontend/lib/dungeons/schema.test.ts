import test from "node:test"
import assert from "node:assert/strict"

import { isDungeonMapDocument, validateDungeonMapDocumentContract } from "./schema.ts"
import { DUNGEON_MAP_DOCUMENT_TYPE, DUNGEON_MAP_DOCUMENT_VERSION } from "./types.ts"

test("acepta el documento minimo valido", () => {
  const document = {
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    layout: {
      width: 100,
      height: 100,
      rooms: [],
    },
  }

  assert.deepEqual(validateDungeonMapDocumentContract(document), { ok: true })
  assert.equal(isDungeonMapDocument(document), true)
})

test("rechaza faltantes obligatorios", () => {
  const result = validateDungeonMapDocumentContract({
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("El documento de mazmorra debe incluir layout."), true)
})

test("rechaza type incorrecto", () => {
  const result = validateDungeonMapDocumentContract({
    type: "ciudad",
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    layout: {
      width: 100,
      height: 100,
      rooms: [],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes('El documento debe incluir type="mazmorra".'), true)
})

test("rechaza version incorrecta", () => {
  const result = validateDungeonMapDocumentContract({
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: 2,
    layout: {
      width: 100,
      height: 100,
      rooms: [],
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.errors.includes("La version del documento de mazmorra debe ser 1."), true)
})
