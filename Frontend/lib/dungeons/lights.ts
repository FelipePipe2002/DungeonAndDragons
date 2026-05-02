import type {
  DungeonLightKind,
  DungeonLightMode,
  DungeonLightOrientation,
  DungeonLightPlacement,
  DungeonLightSource,
  NormalizedDungeonLightSource,
} from "./types.ts"

export const DEFAULT_DUNGEON_LIGHT_KIND: DungeonLightKind = "torch"
export const DEFAULT_DUNGEON_LIGHT_MODE: DungeonLightMode = "radius"
export const DEFAULT_DUNGEON_LIGHT_ENABLED = true
export const DEFAULT_DUNGEON_LIGHT_BRIGHT_RADIUS_CELLS = 4
export const DEFAULT_DUNGEON_LIGHT_DIM_RADIUS_CELLS = 8
export const DEFAULT_DUNGEON_LIGHT_WALL_MOUNTED = false
export const DEFAULT_DUNGEON_LIGHT_ORIENTATION: DungeonLightOrientation = "south"

export type CreateDungeonLightSourceInput = {
  id?: string
  x: number
  y: number
  kind?: DungeonLightKind
  label?: string | null
  enabled?: boolean
  brightRadiusCells?: number
  dimRadiusCells?: number
  mode?: DungeonLightMode
  placement?: DungeonLightPlacement | null
  wallMounted?: boolean
  orientation?: DungeonLightOrientation
}

export type DungeonTorchPlacementRoom = {
  id?: string
  x: number
  y: number
  width: number
  height: number
}

export type DungeonTorchPlacementCorridor = {
  id?: string
  points: { x: number; y: number }[]
}

export type DungeonTorchPlacementMode = "none" | "rooms" | "corridors" | "rooms-and-corridors"

export type GenerateDungeonTorchLightsOptions = {
  enabled?: boolean
  placement?: DungeonTorchPlacementMode
  idPrefix?: string
  maxLights?: number
  densityPercent?: number
  brightRadiusCells?: number
  dimRadiusCells?: number
  mode?: DungeonLightMode
}

export type GenerateDungeonTorchLightsInput = {
  rooms: DungeonTorchPlacementRoom[]
  corridors?: DungeonTorchPlacementCorridor[]
  existingLights?: Pick<DungeonLightSource, "id" | "x" | "y">[]
  blockedCells?: { x: number; y: number }[]
  options?: GenerateDungeonTorchLightsOptions
}

function normalizeNullableString(value: string | null | undefined) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeRadius(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

export function createNextDungeonLightId(
  lights: Pick<DungeonLightSource | NormalizedDungeonLightSource, "id">[],
  prefix = "light",
) {
  let nextId = 1
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`)

  for (const light of lights) {
    const match = pattern.exec(light.id.trim())
    if (!match) continue
    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value)) {
      nextId = Math.max(nextId, value + 1)
    }
  }

  return `${prefix}-${nextId}`
}

export function normalizeDungeonLightSource(light: DungeonLightSource): NormalizedDungeonLightSource {
  const brightRadiusCells = normalizeRadius(light.brightRadiusCells, DEFAULT_DUNGEON_LIGHT_BRIGHT_RADIUS_CELLS)
  const dimRadiusCells = Math.max(
    brightRadiusCells,
    normalizeRadius(light.dimRadiusCells, DEFAULT_DUNGEON_LIGHT_DIM_RADIUS_CELLS),
  )

  return {
    id: light.id.trim(),
    x: light.x,
    y: light.y,
    kind: light.kind,
    label: normalizeNullableString(light.label),
    enabled: light.enabled ?? DEFAULT_DUNGEON_LIGHT_ENABLED,
    brightRadiusCells,
    dimRadiusCells,
    mode: light.mode,
    placement: light.placement ?? null,
    wallMounted: light.wallMounted ?? DEFAULT_DUNGEON_LIGHT_WALL_MOUNTED,
    orientation: light.orientation ?? DEFAULT_DUNGEON_LIGHT_ORIENTATION,
  }
}

export function createDungeonLightSource(
  input: CreateDungeonLightSourceInput,
  existingLights: Pick<DungeonLightSource | NormalizedDungeonLightSource, "id">[] = [],
): DungeonLightSource {
  const brightRadiusCells = normalizeRadius(input.brightRadiusCells, DEFAULT_DUNGEON_LIGHT_BRIGHT_RADIUS_CELLS)
  const dimRadiusCells = Math.max(
    brightRadiusCells,
    normalizeRadius(input.dimRadiusCells, DEFAULT_DUNGEON_LIGHT_DIM_RADIUS_CELLS),
  )
  const label = normalizeNullableString(input.label)

  const light: DungeonLightSource = {
    id: input.id?.trim() || createNextDungeonLightId(existingLights),
    x: input.x,
    y: input.y,
    kind: input.kind ?? DEFAULT_DUNGEON_LIGHT_KIND,
    enabled: input.enabled ?? DEFAULT_DUNGEON_LIGHT_ENABLED,
    brightRadiusCells,
    dimRadiusCells,
    mode: input.mode ?? DEFAULT_DUNGEON_LIGHT_MODE,
    wallMounted: input.wallMounted ?? DEFAULT_DUNGEON_LIGHT_WALL_MOUNTED,
    orientation: input.orientation ?? DEFAULT_DUNGEON_LIGHT_ORIENTATION,
  }

  if (label) {
    light.label = label
  }
  if (input.placement) {
    light.placement = input.placement
  }

  return light
}

function normalizeDensityPercent(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 100
  return Math.min(300, Math.max(0, Math.round(value)))
}

function distributeWallOffsets(span: number) {
  const count = Math.max(1, Math.floor(span / 5))
  const offsets: number[] = []
  for (let index = 0; index < count; index += 1) {
    offsets.push(Math.min(span - 1, Math.max(0, Math.floor(((index + 1) * span) / (count + 1)))))
  }
  return [...new Set(offsets)]
}

function roomWallTorchPoints(room: DungeonTorchPlacementRoom) {
  const left = Math.floor(room.x)
  const top = Math.floor(room.y)
  const right = Math.floor(room.x + room.width - 1)
  const bottom = Math.floor(room.y + room.height - 1)
  const horizontalOffsets = distributeWallOffsets(Math.max(1, Math.floor(room.width)))
  const verticalOffsets = distributeWallOffsets(Math.max(1, Math.floor(room.height)))

  const sides = [
    horizontalOffsets.map((offset) => ({ x: left + offset, y: top, orientation: "north" as const })),
    horizontalOffsets.map((offset) => ({ x: left + offset, y: bottom, orientation: "south" as const })),
    verticalOffsets.map((offset) => ({ x: left, y: top + offset, orientation: "west" as const })),
    verticalOffsets.map((offset) => ({ x: right, y: top + offset, orientation: "east" as const })),
  ]

  const candidates: Array<{ x: number; y: number; orientation: DungeonLightOrientation }> = []
  const maxSideLength = Math.max(...sides.map((side) => side.length))
  for (let index = 0; index < maxSideLength; index += 1) {
    for (const side of sides) {
      const candidate = side[index]
      if (candidate) candidates.push(candidate)
    }
  }

  const unique = new Map<string, { x: number; y: number; orientation: DungeonLightOrientation }>()
  for (const candidate of candidates) {
    unique.set(`${candidate.x},${candidate.y}`, candidate)
  }
  return [...unique.values()]
}

function roomTorchTargetCount(room: DungeonTorchPlacementRoom, densityPercent: number, availableCandidateCount: number) {
  if (densityPercent <= 0 || availableCandidateCount <= 0) return 0
  const area = Math.max(1, Math.floor(room.width) * Math.floor(room.height))
  const baseCount = Math.max(2, Math.ceil(area / 32))
  return Math.min(availableCandidateCount, Math.max(1, Math.ceil((baseCount * densityPercent) / 100)))
}

function corridorJunctionTorchPoints(corridors: DungeonTorchPlacementCorridor[]) {
  const points: { id?: string; x: number; y: number; orientation?: DungeonLightOrientation }[] = []
  const pointCounts = new Map<string, { x: number; y: number; count: number }>()
  const distributed = new Map<string, { id?: string; x: number; y: number; orientation: DungeonLightOrientation }>()

  for (const corridor of corridors) {
    for (const point of corridor.points) {
      const x = Math.floor(point.x)
      const y = Math.floor(point.y)
      const key = `${x},${y}`
      const current = pointCounts.get(key)
      if (current) {
        current.count += 1
      } else {
        pointCounts.set(key, { x, y, count: 1 })
      }
    }

    for (let index = 1; index < corridor.points.length - 1; index += 1) {
      const previous = corridor.points[index - 1]
      const current = corridor.points[index]
      const next = corridor.points[index + 1]
      const entersHorizontally = previous.y === current.y
      const exitsHorizontally = next.y === current.y
      if (entersHorizontally === exitsHorizontally) continue
      points.push({ id: corridor.id, x: Math.floor(current.x), y: Math.floor(current.y), orientation: "south" })
    }

    for (let index = 1; index < corridor.points.length; index += 1) {
      const start = corridor.points[index - 1]
      const end = corridor.points[index]
      const deltaX = Math.sign(end.x - start.x)
      const deltaY = Math.sign(end.y - start.y)
      const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
      if (length < 8) continue

      const count = Math.max(1, Math.floor(length / 8))
      for (let offsetIndex = 1; offsetIndex <= count; offsetIndex += 1) {
        const offset = Math.round((offsetIndex * length) / (count + 1))
        if (offset <= 0 || offset >= length) continue
        const x = Math.floor(start.x + deltaX * offset)
        const y = Math.floor(start.y + deltaY * offset)
        const orientation: DungeonLightOrientation = deltaX !== 0 ? "north" : "west"
        distributed.set(`${x},${y}`, { id: corridor.id, x, y, orientation })
      }
    }
  }

  for (const point of pointCounts.values()) {
    if (point.count < 3) continue
    points.push({ x: point.x, y: point.y, orientation: "south" })
  }

  points.push(...distributed.values())

  return points
}

export function generateDungeonTorchLights({
  rooms,
  corridors = [],
  existingLights = [],
  blockedCells = [],
  options = {},
}: GenerateDungeonTorchLightsInput): DungeonLightSource[] {
  if (options.enabled === false || options.placement === "none") return []

  const placement = options.placement ?? "rooms"
  const densityPercent = normalizeDensityPercent(options.densityPercent)
  const includeRooms = placement === "rooms" || placement === "rooms-and-corridors"
  const includeCorridors = placement === "corridors" || placement === "rooms-and-corridors"
  const corridorPoints = includeCorridors ? corridorJunctionTorchPoints(corridors) : []
  const maxLights = Math.max(0, Math.floor(options.maxLights ?? Number.MAX_SAFE_INTEGER))
  const lights: DungeonLightSource[] = []
  const occupied = new Set(existingLights.map((light) => `${light.x},${light.y}`))
  const blocked = new Set(blockedCells.map((cell) => `${Math.floor(cell.x)},${Math.floor(cell.y)}`))

  for (const room of includeRooms ? rooms : []) {
    if (lights.length >= maxLights) break
    if (room.width <= 0 || room.height <= 0) continue

    let roomLightIndex = 0
    const roomCandidates = roomWallTorchPoints(room)
    const availableRoomCandidates = roomCandidates.filter((point) => {
      const key = `${point.x},${point.y}`
      return !occupied.has(key) && !blocked.has(key)
    })
    const targetCount = roomTorchTargetCount(room, densityPercent, availableRoomCandidates.length)

    for (const point of availableRoomCandidates) {
      if (lights.length >= maxLights || roomLightIndex >= targetCount) break

      const key = `${point.x},${point.y}`
      const nextExistingLights = [...existingLights, ...lights]
      roomLightIndex += 1
      lights.push(createDungeonLightSource({
        id: createNextDungeonLightId(nextExistingLights, options.idPrefix ?? "light"),
        x: point.x,
        y: point.y,
        kind: "torch",
        label: room.id ? `Torch ${room.id} ${roomLightIndex}` : undefined,
        brightRadiusCells: options.brightRadiusCells,
        dimRadiusCells: options.dimRadiusCells,
        mode: options.mode ?? DEFAULT_DUNGEON_LIGHT_MODE,
        placement: "generated",
        wallMounted: true,
        orientation: point.orientation,
      }, nextExistingLights))
      occupied.add(key)
    }
  }

  for (const point of corridorPoints) {
    if (lights.length >= maxLights) break

    const key = `${point.x},${point.y}`
    if (occupied.has(key) || blocked.has(key)) continue

    const nextExistingLights = [...existingLights, ...lights]
    lights.push(createDungeonLightSource({
      id: createNextDungeonLightId(nextExistingLights, options.idPrefix ?? "light"),
      x: point.x,
      y: point.y,
      kind: "torch",
      label: point.id ? `Torch ${point.id}` : undefined,
      brightRadiusCells: options.brightRadiusCells,
      dimRadiusCells: options.dimRadiusCells,
      mode: options.mode ?? DEFAULT_DUNGEON_LIGHT_MODE,
      placement: "generated",
      wallMounted: true,
      orientation: point.orientation ?? "south",
    }, nextExistingLights))
    occupied.add(key)
  }

  return lights
}
