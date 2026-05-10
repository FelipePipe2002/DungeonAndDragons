import {
  type DungeonCorridor,
  DUNGEON_MAP_DOCUMENT_TYPE,
  DUNGEON_MAP_DOCUMENT_VERSION,
  type DungeonRoomMask,
  type DungeonRoomCellRect,
  type DungeonDoor,
  type DungeonMapDocument,
  type DungeonMapLayout,
  type DungeonMapMetadata,
  type DungeonMapPoint,
  type DungeonProp,
  type DungeonLightSource,
  type DungeonMarker,
  type DungeonRoom,
  type NormalizedDungeonCorridor,
  type NormalizedDungeonDoor,
  type NormalizedDungeonLightSource,
  type NormalizedDungeonMap,
  type NormalizedDungeonMarker,
  type NormalizedDungeonProp,
  type NormalizedDungeonRoom,
} from "./types.ts"
import { DUNGEON_MAP_SCHEMA_DEFAULTS, validateDungeonMapDocumentContract } from "./schema.ts"

type JsonLikeRecord = Record<string, unknown>

export type DungeonMapValidationResult =
  | { ok: true; value: DungeonMapDocument }
  | { ok: false; errors: string[] }

export class DungeonMapParseError extends Error {
  readonly code: "invalid_json" | "invalid_contract" | "invalid_shape"
  readonly details: string[]

  constructor(code: "invalid_json" | "invalid_contract" | "invalid_shape", message: string, details: string[] = []) {
    super(message)
    this.name = "DungeonMapParseError"
    this.code = code
    this.details = details
  }
}

function isRecord(value: unknown): value is JsonLikeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isFinitePositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizePoint(value: unknown, path: string, errors: string[]): DungeonMapPoint | null {
  if (!isRecord(value)) {
    errors.push(`${path} debe ser un objeto { x, y }.`)
    return null
  }

  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    errors.push(`${path}.x y ${path}.y deben ser numeros finitos.`)
    return null
  }

  return { x: value.x, y: value.y }
}

function normalizeMetadata(metadata: DungeonMapMetadata | undefined): NormalizedDungeonMap["metadata"] {
  return {
    name: normalizeNullableString(metadata?.name),
    seed:
      typeof metadata?.seed === "string"
        ? normalizeNullableString(metadata.seed)
        : typeof metadata?.seed === "number" && Number.isFinite(metadata.seed)
          ? metadata.seed
          : null,
    generator: normalizeNullableString(metadata?.generator),
    notes: normalizeNullableString(metadata?.notes),
  }
}

function getRectCells(rect: DungeonRoomCellRect) {
  const cells: DungeonMapPoint[] = []

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      cells.push({ x, y })
    }
  }

  return cells
}

function getMaskOccupiedCells(room: { x: number; y: number; mask: DungeonRoomMask }) {
  const cells: DungeonMapPoint[] = []

  for (let localY = 0; localY < room.mask.height; localY += 1) {
    for (let localX = 0; localX < room.mask.width; localX += 1) {
      if (room.mask.cells[localY]?.[localX] !== 1) continue
      cells.push({ x: room.x + localX, y: room.y + localY })
    }
  }

  return cells
}

function getRoomParts(room: DungeonRoom): DungeonRoomCellRect[] {
  if (room.shape === "rect") {
    return [{ x: room.x, y: room.y, width: room.width, height: room.height }]
  }

  if (room.shape === "mask") {
    return getMaskOccupiedCells(room).map((cell) => ({ x: cell.x, y: cell.y, width: 1, height: 1 }))
  }

  return room.parts
}

function getRoomOccupiedCells(room: DungeonRoom) {
  if (room.shape === "rect") {
    return getRectCells({ x: room.x, y: room.y, width: room.width, height: room.height })
  }

  if (room.shape === "mask") {
    return getMaskOccupiedCells(room)
  }

  return room.parts.flatMap((part) => getRectCells(part))
}

function partsOverlap(first: DungeonRoomCellRect, second: DungeonRoomCellRect) {
  return (
    first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  )
}

function partsTouch(first: DungeonRoomCellRect, second: DungeonRoomCellRect) {
  const horizontalContact =
    (first.x + first.width === second.x || second.x + second.width === first.x)
    && first.y < second.y + second.height
    && first.y + first.height > second.y
  const verticalContact =
    (first.y + first.height === second.y || second.y + second.height === first.y)
    && first.x < second.x + second.width
    && first.x + first.width > second.x

  return horizontalContact || verticalContact || partsOverlap(first, second)
}

function buildRoomBoundsFromCells(cells: DungeonMapPoint[]) {
  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const maxX = Math.max(...cells.map((cell) => cell.x + 1))
  const maxY = Math.max(...cells.map((cell) => cell.y + 1))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function buildRoomSpansFromCells(cells: DungeonMapPoint[]) {
  const rows = new Map<number, number[]>()

  for (const cell of cells) {
    const row = rows.get(cell.y)
    if (row) {
      row.push(cell.x)
    } else {
      rows.set(cell.y, [cell.x])
    }
  }

  const spans: DungeonRoomCellRect[] = []
  const sortedRows = [...rows.entries()].sort((first, second) => first[0] - second[0])

  for (const [y, xs] of sortedRows) {
    xs.sort((first, second) => first - second)
    let startX = xs[0]
    let previousX = xs[0]

    for (let index = 1; index < xs.length; index += 1) {
      const currentX = xs[index]
      if (currentX === previousX + 1) {
        previousX = currentX
        continue
      }

      spans.push({ x: startX, y, width: previousX - startX + 1, height: 1 })
      startX = currentX
      previousX = currentX
    }

    spans.push({ x: startX, y, width: previousX - startX + 1, height: 1 })
  }

  return spans
}

function buildRoomLabelAnchorFromCells(cells: DungeonMapPoint[]) {
  const total = cells.reduce(
    (accumulator, cell) => ({ x: accumulator.x + cell.x + 0.5, y: accumulator.y + cell.y + 0.5 }),
    { x: 0, y: 0 },
  )

  return {
    x: total.x / cells.length,
    y: total.y / cells.length,
  }
}

function validateRoomPart(part: unknown, path: string, errors: string[]): part is DungeonRoomCellRect {
  if (!isRecord(part)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isFiniteNumber(part.x) || !isFiniteNumber(part.y)) {
    errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
  } else if (!Number.isInteger(part.x) || !Number.isInteger(part.y)) {
    errors.push(`${path}.x e ${path}.y deben estar alineados a la grilla.`)
  }

  if (!isFinitePositiveNumber(part.width) || !isFinitePositiveNumber(part.height)) {
    errors.push(`${path}.width y ${path}.height deben ser numeros finitos mayores a 0.`)
  } else if (!Number.isInteger(part.width) || !Number.isInteger(part.height)) {
    errors.push(`${path}.width y ${path}.height deben estar alineados a la grilla.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateRoomMask(mask: unknown, path: string, errors: string[]): mask is DungeonRoomMask {
  if (!isRecord(mask)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isFinitePositiveNumber(mask.width) || !Number.isInteger(mask.width)) {
    errors.push(`${path}.width debe ser un entero mayor a 0.`)
  }

  if (!isFinitePositiveNumber(mask.height) || !Number.isInteger(mask.height)) {
    errors.push(`${path}.height debe ser un entero mayor a 0.`)
  }

  if (!Array.isArray(mask.cells)) {
    errors.push(`${path}.cells debe ser una matriz.`)
    return false
  }

  if (Number.isInteger(mask.height) && mask.cells.length !== mask.height) {
    errors.push(`${path}.cells debe tener exactamente ${mask.height} filas.`)
  }

  mask.cells.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) {
      errors.push(`${path}.cells[${rowIndex}] debe ser un arreglo.`)
      return
    }

    if (Number.isInteger(mask.width) && row.length !== mask.width) {
      errors.push(`${path}.cells[${rowIndex}] debe tener exactamente ${mask.width} columnas.`)
    }

    row.forEach((value, columnIndex) => {
      if (value !== 0 && value !== 1) {
        errors.push(`${path}.cells[${rowIndex}][${columnIndex}] debe ser 0 o 1.`)
      }
    })
  })

  return errors.every((error) => !error.startsWith(path))
}

function validateCompositeConnectivity(parts: DungeonRoomCellRect[], path: string, errors: string[]) {
  for (let firstIndex = 0; firstIndex < parts.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < parts.length; secondIndex += 1) {
      if (partsOverlap(parts[firstIndex], parts[secondIndex])) {
        errors.push(`${path}.parts no pueden superponerse entre si.`)
        return
      }
    }
  }

  if (parts.length === 0) return

  const visited = new Set<number>([0])
  const queue = [0]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue

    for (let index = 0; index < parts.length; index += 1) {
      if (visited.has(index)) continue
      if (!partsTouch(parts[current], parts[index])) continue
      visited.add(index)
      queue.push(index)
    }
  }

  if (visited.size !== parts.length) {
    errors.push(`${path}.parts deben formar una figura conectada.`)
  }
}

function areOccupiedCellsConnected(cells: DungeonMapPoint[]) {
  if (cells.length === 0) return false

  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const visited = new Set<string>()
  const queue = [cells[0]]
  visited.add(`${cells[0].x},${cells[0].y}`)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`
      if (!keys.has(key) || visited.has(key)) continue
      visited.add(key)
      queue.push(neighbor)
    }
  }

  return visited.size === keys.size
}

function validateRoom(room: unknown, index: number, errors: string[]): room is DungeonRoom {
  const path = `layout.rooms[${index}]`
  if (!isRecord(room)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isNonEmptyString(room.id)) {
    errors.push(`${path}.id debe ser un string no vacio.`)
  }

  if (room.shape !== "rect" && room.shape !== "composite" && room.shape !== "mask") {
    errors.push(`${path}.shape debe ser "rect", "composite" o "mask".`)
  }

  if (room.shape === "rect") {
    if (!isFiniteNumber(room.x) || !isFiniteNumber(room.y)) {
      errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
    }

    if (!isFinitePositiveNumber(room.width) || !isFinitePositiveNumber(room.height)) {
      errors.push(`${path}.width y ${path}.height deben ser numeros finitos mayores a 0.`)
    }
  }

  if (room.shape === "composite") {
    if (!Array.isArray(room.parts) || room.parts.length === 0) {
      errors.push(`${path}.parts debe ser un arreglo no vacio.`)
    } else {
      room.parts.forEach((part, partIndex) => {
        validateRoomPart(part, `${path}.parts[${partIndex}]`, errors)
      })

      if (errors.every((error) => !error.startsWith(`${path}.parts`))) {
        validateCompositeConnectivity(room.parts, path, errors)
      }
    }
  }

  if (room.shape === "mask") {
    if (!isFiniteNumber(room.x) || !isFiniteNumber(room.y)) {
      errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
    } else if (!Number.isInteger(room.x) || !Number.isInteger(room.y)) {
      errors.push(`${path}.x e ${path}.y deben estar alineados a la grilla.`)
    }

    if (!validateRoomMask(room.mask, `${path}.mask`, errors)) {
      return errors.every((error) => !error.startsWith(path))
    }

    const occupiedCells = getMaskOccupiedCells(room as Extract<DungeonRoom, { shape: "mask" }>)
    if (occupiedCells.length === 0) {
      errors.push(`${path}.mask debe contener al menos una celda ocupada.`)
    } else if (!areOccupiedCellsConnected(occupiedCells)) {
      errors.push(`${path}.mask debe formar una figura conectada.`)
    }
  }

  if (room.kind !== undefined && !["room", "start", "boss", "treasure", "hall", "custom"].includes(String(room.kind))) {
    errors.push(`${path}.kind es invalido.`)
  }

  if (room.label !== undefined && typeof room.label !== "string") {
    errors.push(`${path}.label debe ser string si esta presente.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateCorridor(corridor: unknown, index: number, errors: string[]): corridor is DungeonCorridor {
  const path = `layout.corridors[${index}]`
  if (!isRecord(corridor)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isNonEmptyString(corridor.id)) {
    errors.push(`${path}.id debe ser un string no vacio.`)
  }

  if (!Array.isArray(corridor.points) || corridor.points.length < 2) {
    errors.push(`${path}.points debe ser un arreglo con al menos 2 puntos.`)
  } else {
    corridor.points.forEach((point, pointIndex) => {
      normalizePoint(point, `${path}.points[${pointIndex}]`, errors)
    })

    const pointPath = `${path}.points`
    if (errors.every((error) => !error.startsWith(pointPath))) {
      for (let pointIndex = 1; pointIndex < corridor.points.length; pointIndex += 1) {
        const previous = corridor.points[pointIndex - 1]
        const current = corridor.points[pointIndex]
        const isAxisAligned = previous.x === current.x || previous.y === current.y

        if (!isAxisAligned) {
          errors.push(`${path}.points debe contener solo segmentos ortogonales.`)
          break
        }
      }
    }
  }

  if (corridor.width !== undefined && !isFinitePositiveNumber(corridor.width)) {
    errors.push(`${path}.width debe ser un numero finito mayor a 0 si esta presente.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateDoor(door: unknown, index: number, errors: string[]): door is DungeonDoor {
  const path = `layout.doors[${index}]`
  if (!isRecord(door)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isNonEmptyString(door.id)) {
    errors.push(`${path}.id debe ser un string no vacio.`)
  }

  if (!isFiniteNumber(door.x) || !isFiniteNumber(door.y)) {
    errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
  }

  if (door.direction === undefined) {
    errors.push(`${path}.direction es obligatoria.`)
  } else if (!["north", "south", "east", "west"].includes(String(door.direction))) {
    errors.push(`${path}.direction es invalida.`)
  }

  if (door.kind !== undefined && !["door", "locked", "secret"].includes(String(door.kind))) {
    errors.push(`${path}.kind es invalido.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateMarker(marker: unknown, index: number, errors: string[]): marker is DungeonMarker {
  const path = `layout.markers[${index}]`
  if (!isRecord(marker)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isNonEmptyString(marker.id)) {
    errors.push(`${path}.id debe ser un string no vacio.`)
  }

  if (!isFiniteNumber(marker.x) || !isFiniteNumber(marker.y)) {
    errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
  }

  if (!isNonEmptyString(marker.kind)) {
    errors.push(`${path}.kind debe ser un string no vacio.`)
  }

  if (marker.label !== undefined && typeof marker.label !== "string") {
    errors.push(`${path}.label debe ser string si esta presente.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateLightSource(light: unknown, index: number, errors: string[]): light is DungeonLightSource {
  const path = `layout.lights[${index}]`
  if (!isRecord(light)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isNonEmptyString(light.id)) {
    errors.push(`${path}.id debe ser un string no vacio.`)
  }

  if (!isFiniteNumber(light.x) || !isFiniteNumber(light.y)) {
    errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
  }

  if (!["torch", "magic", "ambient"].includes(String(light.kind))) {
    errors.push(`${path}.kind debe ser uno de: torch, magic, ambient.`)
  }

  if (light.label !== undefined && typeof light.label !== "string") {
    errors.push(`${path}.label debe ser string si esta presente.`)
  }

  if (light.enabled !== undefined && typeof light.enabled !== "boolean") {
    errors.push(`${path}.enabled debe ser boolean si esta presente.`)
  }

  if (!isFiniteNumber(light.brightRadiusCells) || light.brightRadiusCells < 0) {
    errors.push(`${path}.brightRadiusCells debe ser un numero finito mayor o igual a 0.`)
  }

  if (!isFiniteNumber(light.dimRadiusCells) || light.dimRadiusCells < 0) {
    errors.push(`${path}.dimRadiusCells debe ser un numero finito mayor o igual a 0.`)
  }

  if (
    isFiniteNumber(light.brightRadiusCells)
    && isFiniteNumber(light.dimRadiusCells)
    && light.dimRadiusCells < light.brightRadiusCells
  ) {
    errors.push(`${path}.dimRadiusCells debe ser mayor o igual a ${path}.brightRadiusCells.`)
  }

  if (!["radius", "line-of-sight"].includes(String(light.mode))) {
    errors.push(`${path}.mode debe ser uno de: radius, line-of-sight.`)
  }

  if (light.placement !== undefined && !["generated", "manual"].includes(String(light.placement))) {
    errors.push(`${path}.placement debe ser uno de: generated, manual.`)
  }

  if (light.wallMounted !== undefined && typeof light.wallMounted !== "boolean") {
    errors.push(`${path}.wallMounted debe ser boolean si esta presente.`)
  }

  if (light.orientation !== undefined && !["north", "east", "south", "west"].includes(String(light.orientation))) {
    errors.push(`${path}.orientation debe ser uno de: north, east, south, west.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

function validateProp(prop: unknown, index: number, errors: string[]): prop is DungeonProp {
  const path = `layout.props[${index}]`
  if (!isRecord(prop)) {
    errors.push(`${path} debe ser un objeto.`)
    return false
  }

  if (!isFinitePositiveNumber(prop.id) || !Number.isInteger(prop.id)) {
    errors.push(`${path}.id debe ser un entero mayor a 0.`)
  }

  if (prop.shape !== "circle" && prop.shape !== "rectangle") {
    errors.push(`${path}.shape debe ser "circle" o "rectangle".`)
  }

  if (!isFiniteNumber(prop.x) || !isFiniteNumber(prop.y)) {
    errors.push(`${path}.x e ${path}.y deben ser numeros finitos.`)
  }

  if (!isFinitePositiveNumber(prop.width) || !isFinitePositiveNumber(prop.height)) {
    errors.push(`${path}.width y ${path}.height deben ser numeros finitos mayores a 0.`)
  }

  if (prop.rotation !== undefined && !isFiniteNumber(prop.rotation)) {
    errors.push(`${path}.rotation debe ser numero si esta presente.`)
  }

  if (typeof prop.color !== "string") {
    errors.push(`${path}.color debe ser string.`)
  }

  if (prop.name !== undefined && prop.name !== null && typeof prop.name !== "string") {
    errors.push(`${path}.name debe ser string si esta presente.`)
  }

  if (prop.image !== undefined && prop.image !== null && typeof prop.image !== "string") {
    errors.push(`${path}.image debe ser string si esta presente.`)
  }

  if (
    prop.imageAssetId !== undefined &&
    prop.imageAssetId !== null &&
    (!isFinitePositiveNumber(prop.imageAssetId) || !Number.isInteger(prop.imageAssetId))
  ) {
    errors.push(`${path}.imageAssetId debe ser un entero mayor a 0 si esta presente.`)
  }

  if (prop.hidden !== undefined && typeof prop.hidden !== "boolean") {
    errors.push(`${path}.hidden debe ser boolean si esta presente.`)
  }

  return errors.every((error) => !error.startsWith(path))
}

export function parseDungeonMapDocument(raw: string | unknown): unknown {
  if (typeof raw !== "string") {
    return raw
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new DungeonMapParseError("invalid_json", "El documento de mazmorra no es un JSON valido.")
  }
}

export function validateDungeonMapDocument(value: unknown): DungeonMapValidationResult {
  const contract = validateDungeonMapDocumentContract(value)
  if (!contract.ok) {
    return { ok: false, errors: contract.errors }
  }

  const errors: string[] = []
  const document = value as DungeonMapDocument
  const layout = document.layout as DungeonMapLayout

  if (document.metadata !== undefined && !isRecord(document.metadata)) {
    errors.push("metadata debe ser un objeto si esta presente.")
  }

  if (layout.units !== undefined && !["tile", "cell"].includes(layout.units)) {
    errors.push("layout.units debe ser uno de: tile, cell.")
  }

  if (layout.origin !== undefined) {
    normalizePoint(layout.origin, "layout.origin", errors)
  }

  layout.rooms.forEach((room, index) => {
    validateRoom(room, index, errors)
  })

  if (errors.every((error) => !error.startsWith("layout.rooms["))) {
    layout.rooms.forEach((room, index) => {
      for (const cell of getRoomOccupiedCells(room)) {
        if (cell.x < 0 || cell.y < 0 || cell.x + 1 > layout.width || cell.y + 1 > layout.height) {
          errors.push(`layout.rooms[${index}] debe permanecer dentro de layout.width y layout.height.`)
          break
        }
      }
    })

    for (let firstIndex = 0; firstIndex < layout.rooms.length; firstIndex += 1) {
      const firstCells = getRoomOccupiedCells(layout.rooms[firstIndex])
      for (let secondIndex = firstIndex + 1; secondIndex < layout.rooms.length; secondIndex += 1) {
        const secondCells = getRoomOccupiedCells(layout.rooms[secondIndex])
        const secondCellKeys = new Set(secondCells.map((cell) => `${cell.x},${cell.y}`))
        const overlaps = firstCells.some((cell) => secondCellKeys.has(`${cell.x},${cell.y}`))
        if (overlaps) {
          errors.push(`layout.rooms[${firstIndex}] no puede superponerse con layout.rooms[${secondIndex}].`)
        }
      }
    }
  }

  if (layout.corridors !== undefined) {
    if (!Array.isArray(layout.corridors)) {
      errors.push("layout.corridors debe ser un arreglo si esta presente.")
    } else {
      layout.corridors.forEach((corridor, index) => {
        validateCorridor(corridor, index, errors)
      })

      if (errors.every((error) => !error.startsWith("layout.corridors["))) {
        layout.corridors.forEach((corridor, index) => {
          const width = Math.max(1, Math.round(corridor.width ?? 1))
          const offsetMin = -Math.floor((width - 1) / 2)
          const offsetMax = offsetMin + width - 1

          for (const point of corridor.points) {
            for (let offsetY = offsetMin; offsetY <= offsetMax; offsetY += 1) {
              for (let offsetX = offsetMin; offsetX <= offsetMax; offsetX += 1) {
                const x = point.x + offsetX
                const y = point.y + offsetY

                if (x < 0 || y < 0 || x + 1 > layout.width || y + 1 > layout.height) {
                  errors.push(`layout.corridors[${index}] debe permanecer dentro de layout.width y layout.height.`)
                  return
                }
              }
            }
          }
        })
      }
    }
  }

  if (layout.doors !== undefined) {
    if (!Array.isArray(layout.doors)) {
      errors.push("layout.doors debe ser un arreglo si esta presente.")
    } else {
      layout.doors.forEach((door, index) => {
        validateDoor(door, index, errors)
      })

      if (errors.every((error) => !error.startsWith("layout.doors["))) {
        layout.doors.forEach((door, index) => {
          if (door.x < 0 || door.y < 0 || door.x + 1 > layout.width || door.y + 1 > layout.height) {
            errors.push(`layout.doors[${index}] debe permanecer dentro de layout.width y layout.height.`)
          }
        })
      }
    }
  }

  if (layout.markers !== undefined) {
    if (!Array.isArray(layout.markers)) {
      errors.push("layout.markers debe ser un arreglo si esta presente.")
    } else {
      layout.markers.forEach((marker, index) => {
        validateMarker(marker, index, errors)
      })

      if (errors.every((error) => !error.startsWith("layout.markers["))) {
        layout.markers.forEach((marker, index) => {
          if (marker.x < 0 || marker.y < 0 || marker.x > layout.width || marker.y > layout.height) {
            errors.push(`layout.markers[${index}] debe permanecer dentro de layout.width y layout.height.`)
          }
        })
      }
    }
  }

  if (layout.lights !== undefined) {
    if (!Array.isArray(layout.lights)) {
      errors.push("layout.lights debe ser un arreglo si esta presente.")
    } else {
      layout.lights.forEach((light, index) => {
        validateLightSource(light, index, errors)
      })

      if (errors.every((error) => !error.startsWith("layout.lights["))) {
        layout.lights.forEach((light, index) => {
          if (light.x < 0 || light.y < 0 || light.x + 1 > layout.width || light.y + 1 > layout.height) {
            errors.push(`layout.lights[${index}] debe permanecer dentro de layout.width y layout.height.`)
          }
        })
      }
    }
  }

  if (layout.props !== undefined) {
    if (!Array.isArray(layout.props)) {
      errors.push("layout.props debe ser un arreglo si esta presente.")
    } else {
      layout.props.forEach((prop, index) => {
        validateProp(prop, index, errors)
      })

      if (errors.every((error) => !error.startsWith("layout.props["))) {
        layout.props.forEach((prop, index) => {
          if (prop.x < 0 || prop.y < 0 || prop.x > 100 || prop.y > 100) {
            errors.push(`layout.props[${index}] debe usar coordenadas porcentuales entre 0 y 100.`)
          }
        })
      }
    }
  }

  return errors.length === 0 ? { ok: true, value: document } : { ok: false, errors }
}

export function normalizeDungeonMapDocument(document: DungeonMapDocument): NormalizedDungeonMap {
  const origin = document.layout.origin ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.origin
  const rooms: NormalizedDungeonRoom[] = document.layout.rooms.map((room) => ({
    ...(() => {
      const cells = getRoomOccupiedCells(room)
      const bounds = buildRoomBoundsFromCells(cells)
      const spans = buildRoomSpansFromCells(cells)
      return {
        id: room.id.trim(),
        kind: room.kind ?? DUNGEON_MAP_SCHEMA_DEFAULTS.room.kind,
        shape: room.shape,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        cells: cells.map((cell) => ({ ...cell })),
        spans,
        labelAnchor: buildRoomLabelAnchorFromCells(cells),
        label: normalizeNullableString(room.label),
      }
    })(),
  }))
  const corridors: NormalizedDungeonCorridor[] = (document.layout.corridors ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.corridors).map(
    (corridor) => ({
      id: corridor.id.trim(),
      points: corridor.points.map((point) => ({ x: point.x, y: point.y })),
      width: corridor.width ?? null,
    }),
  )
  const doors: NormalizedDungeonDoor[] = (document.layout.doors ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.doors).map((door) => ({
    id: door.id.trim(),
    x: door.x,
    y: door.y,
    direction: door.direction as NormalizedDungeonDoor["direction"],
    kind: door.kind ?? DUNGEON_MAP_SCHEMA_DEFAULTS.door.kind,
  }))
  const markers: NormalizedDungeonMarker[] = (document.layout.markers ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.markers).map(
    (marker) => ({
      id: marker.id.trim(),
      x: marker.x,
      y: marker.y,
      kind: marker.kind.trim(),
      label: normalizeNullableString(marker.label),
    }),
  )
  const lights: NormalizedDungeonLightSource[] = (document.layout.lights ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.lights).map(
    (light) => ({
      id: light.id.trim(),
      x: light.x,
      y: light.y,
      kind: light.kind,
      label: normalizeNullableString(light.label),
      enabled: light.enabled ?? DUNGEON_MAP_SCHEMA_DEFAULTS.light.enabled,
      brightRadiusCells: light.brightRadiusCells,
      dimRadiusCells: light.dimRadiusCells,
      mode: light.mode,
      placement: light.placement ?? DUNGEON_MAP_SCHEMA_DEFAULTS.light.placement,
      wallMounted: light.wallMounted ?? DUNGEON_MAP_SCHEMA_DEFAULTS.light.wallMounted,
      orientation: light.orientation ?? DUNGEON_MAP_SCHEMA_DEFAULTS.light.orientation,
    }),
  )
  const props: NormalizedDungeonProp[] = (document.layout.props ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.props).map((prop) => {
    const shape = prop.shape === "circle" ? "circle" : "rectangle"
    const width = clamp(prop.width, 0.5, 100)
    const height = shape === "circle" ? width : clamp(prop.height, 0.5, 100)
    const imageAssetId =
      typeof prop.imageAssetId === "number" && Number.isFinite(prop.imageAssetId) && prop.imageAssetId > 0
        ? Math.trunc(prop.imageAssetId)
        : null

    return {
      id: Math.max(1, Math.trunc(prop.id)),
      shape,
      x: clamp(prop.x, 0, 100),
      y: clamp(prop.y, 0, 100),
      width,
      height,
      rotation: typeof prop.rotation === "number" && Number.isFinite(prop.rotation) ? Math.trunc(prop.rotation) : 0,
      color: normalizeHexColor(prop.color, shape === "circle" ? "#f59e0b" : "#64748b"),
      name: normalizeNullableString(prop.name),
      image: imageAssetId === null ? normalizeNullableString(prop.image) : null,
      imageAssetId,
      hidden: prop.hidden ?? false,
    }
  })

  return {
    type: DUNGEON_MAP_DOCUMENT_TYPE,
    version: DUNGEON_MAP_DOCUMENT_VERSION,
    metadata: normalizeMetadata(document.metadata),
    bounds: {
      width: document.layout.width,
      height: document.layout.height,
      originX: origin.x,
      originY: origin.y,
      units: document.layout.units ?? DUNGEON_MAP_SCHEMA_DEFAULTS.layout.units,
    },
    rooms,
    corridors,
    doors,
    markers,
    lights,
    props,
  }
}

export function readDungeonMapDocument(raw: string | unknown): NormalizedDungeonMap {
  const parsed = parseDungeonMapDocument(raw)
  const contract = validateDungeonMapDocumentContract(parsed)
  if (!contract.ok) {
    throw new DungeonMapParseError("invalid_contract", "El documento de mazmorra no cumple el contrato esperado.", contract.errors)
  }

  const validated = validateDungeonMapDocument(parsed)

  if (!validated.ok) {
    throw new DungeonMapParseError("invalid_shape", "El documento de mazmorra tiene una estructura invalida.", validated.errors)
  }

  return normalizeDungeonMapDocument(validated.value)
}
