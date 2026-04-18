import {
  DUNGEON_MAP_DEFAULT_UNITS,
  DUNGEON_MAP_DOCUMENT_TYPE,
  DUNGEON_MAP_DOCUMENT_VERSION,
  type DungeonMapDocument,
} from "./types.ts"

export type DungeonMapContractValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }

type JsonLikeRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonLikeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFinitePositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function validateDungeonMapDocumentContract(value: unknown): DungeonMapContractValidationResult {
  const errors: string[] = []

  if (!isRecord(value)) {
    return { ok: false, errors: ["El documento de mazmorra debe ser un objeto JSON."] }
  }

  if (value.type !== DUNGEON_MAP_DOCUMENT_TYPE) {
    errors.push('El documento debe incluir type="mazmorra".')
  }

  if (value.version !== DUNGEON_MAP_DOCUMENT_VERSION) {
    errors.push("La version del documento de mazmorra debe ser 1.")
  }

  if (!isRecord(value.layout)) {
    errors.push("El documento de mazmorra debe incluir layout.")
    return { ok: false, errors }
  }

  if (!isFinitePositiveNumber(value.layout.width)) {
    errors.push("layout.width debe ser un numero finito mayor a 0.")
  }

  if (!isFinitePositiveNumber(value.layout.height)) {
    errors.push("layout.height debe ser un numero finito mayor a 0.")
  }

  if (!Array.isArray(value.layout.rooms)) {
    errors.push("layout.rooms debe ser un arreglo.")
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

export function isDungeonMapDocument(value: unknown): value is DungeonMapDocument {
  return validateDungeonMapDocumentContract(value).ok
}

export const DUNGEON_MAP_SCHEMA_DEFAULTS = {
  metadata: {
    name: null,
    seed: null,
    generator: null,
    notes: null,
  },
  layout: {
    units: DUNGEON_MAP_DEFAULT_UNITS,
    origin: { x: 0, y: 0 },
    corridors: [],
    doors: [],
    markers: [],
  },
  room: {
    kind: "room",
    label: null,
  },
  door: {
    kind: "door",
    direction: null,
  },
  marker: {
    label: null,
  },
} as const

export const DUNGEON_MAP_SCHEMA_INVARIANTS = {
  required: ["type", "version", "layout", "layout.width", "layout.height", "layout.rooms"],
  optional: [
    "metadata",
    "layout.units",
    "layout.origin",
    "layout.corridors",
    "layout.doors",
    "layout.markers",
    "room.shape",
    "room.parts",
    "room.mask",
    "room.mask.width",
    "room.mask.height",
    "room.mask.cells",
    "room.kind",
    "room.label",
    "corridor.width",
    "door.direction",
    "door.kind",
    "marker.label",
  ],
  rejected: [
    'type distinto de "mazmorra"',
    "version distinta de 1",
    "layout ausente",
    "layout.width no numerico o <= 0",
    "layout.height no numerico o <= 0",
    "layout.rooms no es arreglo",
    "layout.units distinto de tile o cell",
  ],
} as const
