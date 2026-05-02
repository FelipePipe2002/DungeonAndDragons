import {
  type DungeonDoor,
  type DungeonDoorDirection,
  type DungeonCorridor,
  type DungeonMapPoint,
  type DungeonRoom,
} from "../types.ts"
import { buildRoomGraphPlan as buildRoomGraphPlanModule, buildRoomAdjacencyByCorridors as buildRoomAdjacencyByCorridorsModule } from "./graph-builder.ts"
import { buildGeneratedCorridorsAndDoors as buildGeneratedCorridorsAndDoorsModule } from "./route-builder.ts"
import {
  assignFarthestFinalRoom as assignFarthestFinalRoomModule,
  buildFinalLeafCandidates as buildFinalLeafCandidatesModule,
  hasEligibleFinalLeaf as hasEligibleFinalLeafModule,
  pickBestFinalIndex as pickBestFinalIndexModule,
} from "./final-selection.ts"
import {
  normalizeCorridorEndpointsToRooms as normalizeCorridorEndpointsToRoomsModule,
  rebuildDoorsFromCorridors as rebuildDoorsFromCorridorsModule,
} from "./door-rebuild.ts"

export type DungeonGeneratorPreset = "minimal" | "simple" | "rooms-corridors"

export type RoomGenerationOptions = {
  count?: number
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  padding?: number
  dispersion?: number
  width?: number
  height?: number
}

export type CorridorGenerationOptions = {
  enabled?: boolean
  width?: number
  maxSteps?: number
  allowIntersections?: boolean
}

export type LightingGenerationOptions = {
  enabled?: boolean
  placement?: "none" | "rooms" | "corridors" | "rooms-and-corridors"
  densityPercent?: number
  brightRadiusCells?: number
  dimRadiusCells?: number
}

export type TopologyGenerationOptions = {
  extraConnections?: number
  nearestNeighborCount?: number
  mainPathMaxEdgeRatio?: number
  branchMaxEdgeRatio?: number
  serviceMaxEdgeRatio?: number
  optionalLoopMaxEdgeRatio?: number
  motif?: TopologyMotif
  motifStrength?: number
  adaptiveLoops?: boolean
  loopDensity?: LoopDensity
  maxLoopsAbsolute?: number
  loopLengthTarget?: LoopLengthTarget
  mergePolicyByRole?: Partial<Record<ConnectionRole, boolean>>
  maxEdgeDistanceByRole?: Partial<Record<ConnectionRole, number>>
  kNearestByRole?: Partial<Record<ConnectionRole, number>>
}

export type GeneratorDebugOptions = {
  name?: string
  seed?: string | number
}

export type GenerateDungeonMapOptions = {
  preset?: DungeonGeneratorPreset
  roomOptions?: RoomGenerationOptions
  corridorOptions?: CorridorGenerationOptions
  lightingOptions?: LightingGenerationOptions
  topologyOptions?: TopologyGenerationOptions
  debugOptions?: GeneratorDebugOptions

  // Legacy flat options (kept for backwards compatibility)
  width?: number
  height?: number
  roomCount?: number
  minRoomWidth?: number
  maxRoomWidth?: number
  minRoomHeight?: number
  maxRoomHeight?: number
  roomPadding?: number
  roomDispersion?: number
  roomWidth?: number
  roomHeight?: number
  corridorWidth?: number
  includeCorridors?: boolean
  maxCorridorSteps?: number
  allowCorridorIntersections?: boolean
  generateTorches?: boolean
  extraConnectionCount?: number
  name?: string
  seed?: string | number
}

export type PlacedRoom = DungeonRoom

export type CorridorPlan = {
  corridors: DungeonCorridor[]
  doors: DungeonDoor[]
}

export type ConnectionRole = "main-path" | "branch" | "optional-loop" | "service/dead-end"
export type TopologyMotif = "balanced" | "linear" | "braided" | "hub-spoke" | "labyrinth-lite"
export type LoopDensity = "low" | "medium" | "high"
export type LoopLengthTarget = "short" | "mixed" | "long"

export type RoomConnection = {
  fromIndex: number
  toIndex: number
  role: ConnectionRole
}

export type RoomGraph = {
  connections: RoomConnection[]
  mainPathRoomIndexes: number[]
  branchRoomIndexes: number[]
  leafCandidateIndexes: number[]
  finalIndex?: number
  startIndex: number
}

export type SpatialIndex = GenerationSpatialModel

export type GenerationContext = {
  preset: DungeonGeneratorPreset
  width: number
  height: number
  roomCount: number
  minRoomWidth: number
  maxRoomWidth: number
  minRoomHeight: number
  maxRoomHeight: number
  roomPadding: number
  roomDispersion: number
  includeCorridors: boolean
  corridorWidth: number
  maxCorridorSteps: number
  allowCorridorIntersections: boolean
  lightingEnabled: boolean
  lightingPlacement: NonNullable<LightingGenerationOptions["placement"]>
  lightDensityPercent: number
  lightBrightRadiusCells: number
  lightDimRadiusCells: number
  extraConnectionCount: number
  topologyMotif: TopologyMotif
  motifStrength: number
  adaptiveLoops: boolean
  loopDensity: LoopDensity
  maxLoopsAbsolute?: number
  loopLengthTarget: LoopLengthTarget
  mergePolicyByRole: Record<ConnectionRole, boolean>
  maxEdgeDistanceByRole: Record<ConnectionRole, number>
  kNearestByRole: Record<ConnectionRole, number>
  metadataName?: string
  seed?: string | number
}

type RoomArchetype = "main-chamber" | "square-room" | "wide-room" | "tall-room" | "small-room"

type RoomPlan = {
  archetype: RoomArchetype
  width: number
  height: number
}

const DEFAULT_MAX_CORRIDOR_STEPS = 84
const DEFAULT_TOPOLOGY_NEIGHBOR_COUNT = 4
const DEFAULT_MAIN_PATH_MAX_EDGE_RATIO = 0.42
const DEFAULT_BRANCH_MAX_EDGE_RATIO = 0.56
const DEFAULT_SERVICE_MAX_EDGE_RATIO = 0.56
const DEFAULT_OPTIONAL_LOOP_MAX_EDGE_RATIO = 0.8
const DEFAULT_TOPOLOGY_MOTIF: TopologyMotif = "balanced"
const DEFAULT_MOTIF_STRENGTH = 0.7
const DEFAULT_LOOP_DENSITY: LoopDensity = "medium"
const DEFAULT_LOOP_LENGTH_TARGET: LoopLengthTarget = "mixed"
const DEFAULT_LIGHTING_PLACEMENT: NonNullable<LightingGenerationOptions["placement"]> = "rooms-and-corridors"
const DEFAULT_LIGHT_BRIGHT_RADIUS_CELLS = 4
const DEFAULT_LIGHT_DIM_RADIUS_CELLS = 8

const TOPOLOGY_MOTIF_PROFILES: Record<TopologyMotif, {
  kNearestMultiplierByRole: Record<ConnectionRole, number>
  maxEdgeDistanceMultiplierByRole: Record<ConnectionRole, number>
  mergePolicyByRole: Record<ConnectionRole, boolean>
}> = {
  balanced: {
    kNearestMultiplierByRole: {
      "main-path": 1,
      branch: 1,
      "service/dead-end": 1,
      "optional-loop": 1,
    },
    maxEdgeDistanceMultiplierByRole: {
      "main-path": 1,
      branch: 1,
      "service/dead-end": 1,
      "optional-loop": 1,
    },
    mergePolicyByRole: {
      "main-path": false,
      branch: false,
      "service/dead-end": false,
      "optional-loop": true,
    },
  },
  linear: {
    kNearestMultiplierByRole: {
      "main-path": 0.8,
      branch: 0.75,
      "service/dead-end": 0.75,
      "optional-loop": 0.6,
    },
    maxEdgeDistanceMultiplierByRole: {
      "main-path": 0.9,
      branch: 0.85,
      "service/dead-end": 0.85,
      "optional-loop": 0.7,
    },
    mergePolicyByRole: {
      "main-path": false,
      branch: false,
      "service/dead-end": false,
      "optional-loop": false,
    },
  },
  braided: {
    kNearestMultiplierByRole: {
      "main-path": 1.15,
      branch: 1.25,
      "service/dead-end": 1.1,
      "optional-loop": 1.45,
    },
    maxEdgeDistanceMultiplierByRole: {
      "main-path": 1.05,
      branch: 1.08,
      "service/dead-end": 1,
      "optional-loop": 1.2,
    },
    mergePolicyByRole: {
      "main-path": false,
      branch: true,
      "service/dead-end": false,
      "optional-loop": true,
    },
  },
  "hub-spoke": {
    kNearestMultiplierByRole: {
      "main-path": 1,
      branch: 0.95,
      "service/dead-end": 0.9,
      "optional-loop": 0.9,
    },
    maxEdgeDistanceMultiplierByRole: {
      "main-path": 1.05,
      branch: 1.15,
      "service/dead-end": 1.1,
      "optional-loop": 0.95,
    },
    mergePolicyByRole: {
      "main-path": false,
      branch: false,
      "service/dead-end": false,
      "optional-loop": true,
    },
  },
  "labyrinth-lite": {
    kNearestMultiplierByRole: {
      "main-path": 1.1,
      branch: 1.35,
      "service/dead-end": 1.2,
      "optional-loop": 1.3,
    },
    maxEdgeDistanceMultiplierByRole: {
      "main-path": 1,
      branch: 1.1,
      "service/dead-end": 1.05,
      "optional-loop": 1.15,
    },
    mergePolicyByRole: {
      "main-path": false,
      branch: true,
      "service/dead-end": false,
      "optional-loop": true,
    },
  },
}

function defaultMergePolicyByRole(): Record<ConnectionRole, boolean> {
  return {
    "main-path": false,
    branch: false,
    "service/dead-end": false,
    "optional-loop": true,
  }
}

const PRESET_COMPOSITIONS: Record<DungeonGeneratorPreset, {
  width: number
  height: number
  roomCount: number
  includeCorridors: boolean
  extraConnectionCount: number
}> = {
  minimal: {
    width: 24,
    height: 24,
    roomCount: 0,
    includeCorridors: false,
    extraConnectionCount: 0,
  },
  simple: {
    width: 48,
    height: 32,
    roomCount: 6,
    includeCorridors: false,
    extraConnectionCount: 0,
  },
  "rooms-corridors": {
    width: 48,
    height: 32,
    roomCount: 8,
    includeCorridors: true,
    extraConnectionCount: 1,
  },
}

/*
 * Responsibility map (phase 1 stabilization)
 * - placement: room archetypes, candidate scoring, room placement attempts
 * - routing: exit selection, door leads, room-aware pathfinding
 * - topology: room graph edges/components, final-room selection rules
 * - cleanup: duplicate/parallel/loop corridor cleanup + door normalization
 */

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function blendNumeric(base: number, target: number, strength: number) {
  return base + (target - base) * strength
}

function normalizeOptionalString(value: string | undefined) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function buildMetadata(options: GenerateDungeonMapOptions, notes?: string) {
  const name = normalizeOptionalString(options.name)
  const seed = typeof options.seed === "number"
    ? options.seed
    : normalizeOptionalString(typeof options.seed === "string" ? options.seed : undefined)
  const normalizedNotes = normalizeOptionalString(notes)

  if (!name && seed === undefined && !normalizedNotes) {
    return undefined
  }

  return {
    name,
    seed,
    generator: "dungeon-generator-v1",
    notes: normalizedNotes,
  }
}

function hashSeed(value: string | number | undefined) {
  const source = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : normalizeOptionalString(typeof value === "string" ? value : undefined) ?? "default-seed"
  let hash = 2166136261

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seed: string | number | undefined) {
  let state = hashSeed(seed) || 0x6d2b79f5

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomInteger(random: () => number, min: number, max: number) {
  if (max <= min) return min
  return Math.floor(random() * (max - min + 1)) + min
}

function rangesOverlapWithPadding(startA: number, sizeA: number, startB: number, sizeB: number, padding: number) {
  const endA = startA + sizeA
  const endB = startB + sizeB
  return startA < endB + padding && endA + padding > startB
}

function assertRectRoom(room: DungeonRoom): asserts room is Extract<DungeonRoom, { shape: "rect" }> {
  if (room.shape !== "rect") {
    throw new Error(`Generator internals only support rect rooms; received '${room.shape}'.`)
  }
}

function getRoomBounds(room: DungeonRoom) {
  assertRectRoom(room)
  return {
    x: room.x,
    y: room.y,
    width: room.width,
    height: room.height,
  }
}

function roomsOverlapWithPadding(candidate: DungeonRoom, placed: DungeonRoom, padding: number) {
  assertRectRoom(candidate)
  assertRectRoom(placed)
  return (
    rangesOverlapWithPadding(candidate.x, candidate.width, placed.x, placed.width, padding)
    && rangesOverlapWithPadding(candidate.y, candidate.height, placed.y, placed.height, padding)
  )
}

function roomCenter(room: DungeonRoom) {
  const bounds = getRoomBounds(room)
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function roomConnectionPoint(room: DungeonRoom): DungeonMapPoint {
  const bounds = getRoomBounds(room)
  const x = bounds.x + Math.floor((bounds.width - 1) / 2)
  const y = bounds.y + Math.floor((bounds.height - 1) / 2)
  return { x, y }
}

function pointKey(point: DungeonMapPoint) {
  return `${point.x},${point.y}`
}

export type RoomSpatialLookup = {
  roomCellsByRoomId: Map<string, Set<string>>
  roomIndexByCell: Map<string, number>
  roomBoundsByRoomId: Map<string, { x: number; y: number; width: number; height: number }>
}

export function buildRoomSpatialLookup(rooms: DungeonRoom[]): RoomSpatialLookup {
  const roomCellsByRoomId = new Map<string, Set<string>>()
  const roomIndexByCell = new Map<string, number>()
  const roomBoundsByRoomId = new Map<string, { x: number; y: number; width: number; height: number }>()

  rooms.forEach((room, roomIndex) => {
    const cells = roomCells(room)
    const cellKeys = new Set<string>()

    for (const cell of cells) {
      const key = pointKey(cell)
      cellKeys.add(key)
      roomIndexByCell.set(key, roomIndex)
    }

    roomCellsByRoomId.set(room.id, cellKeys)
    roomBoundsByRoomId.set(room.id, getRoomBounds(room))
  })

  return {
    roomCellsByRoomId,
    roomIndexByCell,
    roomBoundsByRoomId,
  }
}

export function roomIndexForPoint(lookup: RoomSpatialLookup, point: DungeonMapPoint) {
  return lookup.roomIndexByCell.get(pointKey(point)) ?? -1
}

export function roomCells(room: DungeonRoom): DungeonMapPoint[] {
  assertRectRoom(room)

  const cells: DungeonMapPoint[] = []
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      cells.push({ x, y })
    }
  }
  return cells
}

function roomArea(room: DungeonRoom) {
  assertRectRoom(room)
  return room.width * room.height
}

function roomAspectBucket(room: DungeonRoom) {
  const bounds = getRoomBounds(room)
  const ratio = bounds.width / bounds.height
  if (ratio >= 1.35) return "wide"
  if (ratio <= 0.75) return "tall"
  return "square"
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function corridorDistance(first: DungeonMapPoint, second: DungeonMapPoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}

function directionBetween(from: DungeonMapPoint, to: DungeonMapPoint): DungeonDoorDirection | undefined {
  if (to.x > from.x) return "east"
  if (to.x < from.x) return "west"
  if (to.y > from.y) return "south"
  if (to.y < from.y) return "north"
  return undefined
}

type CorridorAxis = "horizontal" | "vertical"

type RoomBorderCellInfo = {
  point: DungeonMapPoint
  openDirections: DungeonDoorDirection[]
  isRectCorner: boolean
  isFlat: boolean
}

type RoomExitSelection = {
  point: DungeonMapPoint
  direction: DungeonDoorDirection
}

type RoomSideExit = {
  exit: RoomExitSelection
  lead: DungeonMapPoint[]
  hub: DungeonMapPoint
}

type CommittedCorridor = {
  id: string
  points: DungeonMapPoint[]
  roomIds: [string, string]
  roomSideKeys: [string, string]
  cells: DungeonMapPoint[]
}

type CorridorCluster = {
  corridorIds: string[]
  roomIds: Set<string>
  roomSideKeys: Set<string>
  cells: DungeonMapPoint[]
}

type CorridorClusterAnalysis = {
  corridorIndexes: number[]
  roomIndexes: Set<number>
}

type CorridorEndpointRef = {
  corridorIndex: number
  position: "start" | "end"
  point: DungeonMapPoint
}

const CARDINAL_DIRECTIONS: Array<{ direction: DungeonDoorDirection; dx: number; dy: number }> = [
  { direction: "east", dx: 1, dy: 0 },
  { direction: "west", dx: -1, dy: 0 },
  { direction: "south", dx: 0, dy: 1 },
  { direction: "north", dx: 0, dy: -1 },
]

function axisDirections(axis: CorridorAxis) {
  return axis === "horizontal" ? ["east", "west"] as const : ["north", "south"] as const
}

function oppositeAxis(axis: CorridorAxis): CorridorAxis {
  return axis === "horizontal" ? "vertical" : "horizontal"
}

function preferredDirectionForAxis(
  source: DungeonMapPoint,
  target: DungeonMapPoint,
  axis: CorridorAxis,
): DungeonDoorDirection {
  if (axis === "horizontal") {
    return target.x >= source.x ? "east" : "west"
  }

  return target.y >= source.y ? "south" : "north"
}

function buildRoomBorderCellInfos(room: DungeonRoom): RoomBorderCellInfo[] {
  const cells = roomCells(room)
  const occupied = new Set(cells.map(pointKey))
  const infos: RoomBorderCellInfo[] = []

  for (const cell of cells) {
    const openDirections = CARDINAL_DIRECTIONS
      .filter(({ dx, dy }) => !occupied.has(pointKey({ x: cell.x + dx, y: cell.y + dy })))
      .map(({ direction }) => direction)

    if (openDirections.length === 0) continue

    const isRectCorner = room.shape === "rect"
      && (cell.x === room.x || cell.x === room.x + room.width - 1)
      && (cell.y === room.y || cell.y === room.y + room.height - 1)

    infos.push({
      point: cell,
      openDirections,
      isRectCorner,
      isFlat: openDirections.length === 1,
    })
  }

  return infos
}

function movePoint(point: DungeonMapPoint, direction: DungeonDoorDirection): DungeonMapPoint {
  if (direction === "east") return { x: point.x + 1, y: point.y }
  if (direction === "west") return { x: point.x - 1, y: point.y }
  if (direction === "south") return { x: point.x, y: point.y + 1 }
  return { x: point.x, y: point.y - 1 }
}

function buildDoorLead(
  start: DungeonMapPoint,
  direction: DungeonDoorDirection,
  blocked: Set<string>,
  mapWidth: number,
  mapHeight: number,
  length: number,
) {
  const lead: DungeonMapPoint[] = [start]
  let current = start

  for (let step = 0; step < length; step += 1) {
    const next = movePoint(current, direction)
    if (!pointWithinBounds(next, mapWidth, mapHeight) || blocked.has(pointKey(next))) {
      break
    }
    lead.push(next)
    current = next
  }

  return lead
}

function appendUniquePoint(points: DungeonMapPoint[], point: DungeonMapPoint) {
  const previous = points[points.length - 1]
  if (previous && previous.x === point.x && previous.y === point.y) return
  points.push(point)
}

function appendUniquePoints(points: DungeonMapPoint[], extraPoints: DungeonMapPoint[]) {
  for (const point of extraPoints) {
    appendUniquePoint(points, point)
  }
}

function directionAxis(direction: DungeonDoorDirection): CorridorAxis {
  return direction === "east" || direction === "west" ? "horizontal" : "vertical"
}

function pickRoomExitCell(
  room: DungeonRoom,
  side: DungeonDoorDirection,
  target: DungeonMapPoint,
  options: {
    preferredDirection: DungeonDoorDirection
    axis: CorridorAxis
    blockedRooms?: Set<string>
    blockedCorridors?: Set<string>
    blockedDoorCells?: Set<string>
    mapWidth?: number
    mapHeight?: number
    connectionRole?: ConnectionRole
  },
) {
  const borderCells = buildRoomBorderCellInfos(room).filter((cell) => cell.openDirections.includes(side))
  if (borderCells.length === 0) {
    const fallbackPoint = roomConnectionPoint(room)
    return {
      point: fallbackPoint,
      direction: preferredDirectionForAxis(fallbackPoint, target, options.axis),
    }
  }

  const eligibleCells = borderCells.filter((cell) => {
    const exitPoint = movePoint(cell.point, side)
    if (options.mapWidth !== undefined && options.mapHeight !== undefined) {
      if (!pointWithinBounds(exitPoint, options.mapWidth, options.mapHeight)) return false
    }
    if (options.blockedDoorCells?.has(pointKey(cell.point))) return false
    if (options.blockedRooms?.has(pointKey(exitPoint))) return false
    if (options.blockedCorridors?.has(pointKey(exitPoint))) return false
    return true
  })

  const candidateCells = eligibleCells.length > 0 ? eligibleCells : borderCells

  const sideAxis = directionAxis(side)
  const score = (cell: RoomBorderCellInfo) => {
    const exitPoint = movePoint(cell.point, side)
    const outOfBoundsPenalty = (
      options.mapWidth !== undefined
      && options.mapHeight !== undefined
      && !pointWithinBounds(exitPoint, options.mapWidth, options.mapHeight)
    )
      ? 10000
      : 0
    const doorBlockedPenalty = options.blockedDoorCells?.has(pointKey(cell.point)) ? 800 : 0
    const roomBlockedPenalty = options.blockedRooms?.has(pointKey(exitPoint)) ? 600 : 0
    const corridorBlockedPenalty = options.blockedCorridors?.has(pointKey(exitPoint)) ? 220 : 0
    const cornerPenalty = cell.isRectCorner ? 900 : 0
    const sideDistance = corridorDistance(exitPoint, target)
    const alignmentDistance = sideAxis === "horizontal"
      ? Math.abs(cell.point.y - target.y)
      : Math.abs(cell.point.x - target.x)
    const preferredPenalty = side === options.preferredDirection ? 0 : 16
    const axisPenalty = sideAxis === options.axis ? 0 : 26
    const roleVarianceBoost = options.connectionRole === "optional-loop"
      ? -8
      : options.connectionRole === "branch"
        ? -4
        : 0

    return (
      outOfBoundsPenalty
      + doorBlockedPenalty
      + roomBlockedPenalty
      + corridorBlockedPenalty
      + cornerPenalty
      + preferredPenalty
      + axisPenalty
      + roleVarianceBoost
      + sideDistance * 12
      + alignmentDistance * 18
    )
  }

  candidateCells.sort((first, second) => {
    const firstScore = score(first)
    const secondScore = score(second)
    if (firstScore !== secondScore) return firstScore - secondScore
    if (first.point.y !== second.point.y) return first.point.y - second.point.y
    return first.point.x - second.point.x
  })

  return {
    point: candidateCells[0].point,
    direction: side,
  }
}

function pickRoomExitSide(
  room: DungeonRoom,
  target: DungeonMapPoint,
  options: {
    preferredDirection: DungeonDoorDirection
    axis: CorridorAxis
    blockedRooms?: Set<string>
    blockedCorridors?: Set<string>
    blockedDoorCells?: Set<string>
    mapWidth?: number
    mapHeight?: number
    connectionRole?: ConnectionRole
  },
) {
  const borderCells = buildRoomBorderCellInfos(room)
  const availableSides = [...new Set(borderCells.flatMap((cell) => cell.openDirections))] as DungeonDoorDirection[]
  if (availableSides.length === 0) {
    return preferredDirectionForAxis(roomConnectionPoint(room), target, options.axis)
  }

  const center = roomConnectionPoint(room)
  const dominantAxis: CorridorAxis = Math.abs(target.x - center.x) >= Math.abs(target.y - center.y)
    ? "horizontal"
    : "vertical"
  const dominantDirection = preferredDirectionForAxis(center, target, dominantAxis)

  const perSide = availableSides.map((side) => {
    const sideCells = borderCells.filter((cell) => cell.openDirections.includes(side))
    const sideAxis = directionAxis(side)
    const sideCellScores = sideCells.map((cell) => {
      const exitPoint = movePoint(cell.point, side)
      const blockedPenalty = (options.blockedDoorCells?.has(pointKey(cell.point)) ? 700 : 0)
        + (options.blockedRooms?.has(pointKey(exitPoint)) ? 400 : 0)
        + (options.blockedCorridors?.has(pointKey(exitPoint)) ? 140 : 0)
      const boundsPenalty = (
        options.mapWidth !== undefined
        && options.mapHeight !== undefined
        && !pointWithinBounds(exitPoint, options.mapWidth, options.mapHeight)
      )
        ? 10000
        : 0
      const exitDistance = corridorDistance(exitPoint, target)
      const alignmentDistance = sideAxis === "horizontal"
        ? Math.abs(cell.point.y - target.y)
        : Math.abs(cell.point.x - target.x)
      return blockedPenalty + boundsPenalty + exitDistance * 8 + alignmentDistance * 16
    })

    const bestCellScore = Math.min(...sideCellScores)
    const blockedRate = sideCellScores.filter((score) => score >= 400).length / Math.max(1, sideCellScores.length)
    const axisPenalty = sideAxis === options.axis ? 0 : 30
    const preferredPenalty = side === options.preferredDirection ? 0 : 18
    const dominantPenalty = side === dominantDirection ? 0 : 14
    const roleVarianceBoost = options.connectionRole === "optional-loop"
      ? -10
      : options.connectionRole === "branch"
        ? -5
        : 0

    return {
      side,
      score: bestCellScore + axisPenalty + preferredPenalty + dominantPenalty + blockedRate * 70 + roleVarianceBoost,
      bestCellScore,
    }
  })

  const globalBestCellScore = Math.min(...perSide.map((entry) => entry.bestCellScore))
  perSide.forEach((entry) => {
    const detourPenalty = Math.max(0, entry.bestCellScore - globalBestCellScore)
    entry.score += detourPenalty * 0.9
  })

  perSide.sort((first, second) => {
    if (first.score !== second.score) return first.score - second.score
    if (first.side === options.preferredDirection && second.side !== options.preferredDirection) return -1
    if (second.side === options.preferredDirection && first.side !== options.preferredDirection) return 1
    return first.side.localeCompare(second.side)
  })

  return perSide[0].side
}

function pickRoomExitPoint(
  room: DungeonRoom,
  target: DungeonMapPoint,
  options: {
    preferredDirection: DungeonDoorDirection
    axis: CorridorAxis
    blockedRooms?: Set<string>
    blockedCorridors?: Set<string>
    blockedDoorCells?: Set<string>
    mapWidth?: number
    mapHeight?: number
    connectionRole?: ConnectionRole
  },
): RoomExitSelection {
  const side = pickRoomExitSide(room, target, options)
  return pickRoomExitCell(room, side, target, options)
}

function buildCorridorPolyline(from: DungeonMapPoint, to: DungeonMapPoint, axis: CorridorAxis): DungeonMapPoint[] {
  if (from.x === to.x || from.y === to.y) {
    return [from, to]
  }

  const bend = axis === "horizontal"
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y }

  return [from, bend, to]
}

function pathCrossesBlockedRooms(points: DungeonMapPoint[], blockedRooms: Set<string>) {
  const allowedEndpoints = new Set<string>([pointKey(points[0]), pointKey(points[points.length - 1])])
  return corridorPolylineCells(points, new Set<string>()).some((cell) => {
    const key = pointKey(cell)
    return blockedRooms.has(key) && !allowedEndpoints.has(key)
  })
}

function buildRoomBlockedCells(rooms: DungeonRoom[]) {
  const blocked = new Set<string>()
  for (const room of rooms) {
    for (const cell of roomCells(room)) {
      blocked.add(pointKey(cell))
    }
  }
  return blocked
}

function pointWithinBounds(point: DungeonMapPoint, width: number, height: number) {
  return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height
}

function orderedNeighbors(point: DungeonMapPoint) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ]
}

type PathDirection = DungeonDoorDirection
type PathStateDirection = PathDirection | "none"

function stateKey(point: DungeonMapPoint, direction: PathStateDirection) {
  return `${point.x},${point.y},${direction}`
}

function parseStateKey(value: string): { point: DungeonMapPoint; direction: PathStateDirection } {
  const [x, y, direction] = value.split(",")
  return {
    point: { x: Number(x), y: Number(y) },
    direction: direction as PathStateDirection,
  }
}

function compressPolylinePoints(points: DungeonMapPoint[]) {
  if (points.length <= 2) return points

  const compressed: DungeonMapPoint[] = [points[0]]
  let previousDirection = directionBetween(points[0], points[1])

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDirection = directionBetween(points[index], points[index + 1])
    if (currentDirection !== previousDirection) {
      compressed.push(points[index])
      previousDirection = currentDirection
    }
  }

  compressed.push(points[points.length - 1])
  return compressed
}

function findRoomAwareCorridorPath(
  start: DungeonMapPoint,
  end: DungeonMapPoint,
  blockedRooms: Set<string>,
  mapWidth: number,
  mapHeight: number,
  blockedCorridors: Set<string> = new Set<string>(),
  allowedCorridorCells: Set<string> = new Set<string>(),
  blockedRouteCells: Set<string> = new Set<string>(),
): DungeonMapPoint[] | null {
  if (!pointWithinBounds(start, mapWidth, mapHeight) || !pointWithinBounds(end, mapWidth, mapHeight)) {
    return null
  }

  if (start.x === end.x && start.y === end.y) {
    return [start, end]
  }

  const startCellKey = pointKey(start)
  const endCellKey = pointKey(end)
  const distances = new Map<string, number>()
  const queue: DungeonMapPoint[] = [start]
  let cursor = 0
  distances.set(startCellKey, 0)

  while (cursor < queue.length) {
    const current = queue[cursor]
    cursor += 1
    const currentDistance = distances.get(pointKey(current))
    if (currentDistance === undefined) continue
    if (current.x === end.x && current.y === end.y) break

    for (const neighbor of orderedNeighbors(current)) {
      if (!pointWithinBounds(neighbor, mapWidth, mapHeight)) continue
      const neighborCellKey = pointKey(neighbor)
      if (distances.has(neighborCellKey)) continue
      const roomAllowed = neighborCellKey === startCellKey || neighborCellKey === endCellKey || !blockedRooms.has(neighborCellKey)
      const corridorAllowed = !blockedCorridors.has(neighborCellKey) || allowedCorridorCells.has(neighborCellKey)
      const routeAllowed = neighborCellKey === startCellKey || neighborCellKey === endCellKey || !blockedRouteCells.has(neighborCellKey)
      const allowed = roomAllowed && corridorAllowed && routeAllowed
      if (!allowed) continue
      distances.set(neighborCellKey, currentDistance + 1)
      queue.push(neighbor)
    }
  }

  const shortestDistance = distances.get(endCellKey)
  if (shortestDistance === undefined) {
    return null
  }

  const turnsByState = new Map<string, number>()
  const previousStateByState = new Map<string, string | null>()
  let frontier = [stateKey(start, "none")]
  turnsByState.set(frontier[0], 0)
  previousStateByState.set(frontier[0], null)

  for (let step = 0; step < shortestDistance; step += 1) {
    const nextFrontier: string[] = []
    const seenAtNextStep = new Set<string>()

    for (const currentStateKey of frontier) {
      const currentState = parseStateKey(currentStateKey)
      const currentTurns = turnsByState.get(currentStateKey)
      if (currentTurns === undefined) continue

      for (const neighbor of orderedNeighbors(currentState.point)) {
        const neighborCellKey = pointKey(neighbor)
        if (distances.get(neighborCellKey) !== step + 1) continue

        const movementDirection = directionBetween(currentState.point, neighbor)
        if (!movementDirection) continue
        const nextStateKey = stateKey(neighbor, movementDirection)
        const nextTurns = currentTurns
          + (currentState.direction !== "none" && currentState.direction !== movementDirection ? 1 : 0)
        const previousBest = turnsByState.get(nextStateKey)

        if (previousBest === undefined || nextTurns < previousBest) {
          turnsByState.set(nextStateKey, nextTurns)
          previousStateByState.set(nextStateKey, currentStateKey)

          if (!seenAtNextStep.has(nextStateKey)) {
            seenAtNextStep.add(nextStateKey)
            nextFrontier.push(nextStateKey)
          }
        }
      }
    }

    frontier = nextFrontier
  }

  const directions: PathDirection[] = ["east", "west", "south", "north"]
  const endCandidates = directions
    .map((direction) => stateKey(end, direction))
    .filter((candidate) => turnsByState.has(candidate))

  if (endCandidates.length === 0) {
    return null
  }

  endCandidates.sort((first, second) => {
    const firstTurns = turnsByState.get(first) ?? Number.POSITIVE_INFINITY
    const secondTurns = turnsByState.get(second) ?? Number.POSITIVE_INFINITY
    return firstTurns - secondTurns
  })

  const pathCells: DungeonMapPoint[] = []
  let currentStateKey: string | null = endCandidates[0]

  while (currentStateKey) {
    const { point } = parseStateKey(currentStateKey)
    pathCells.push(point)
    currentStateKey = previousStateByState.get(currentStateKey) ?? null
  }

  pathCells.reverse()
  return compressPolylinePoints(pathCells)
}

function corridorPolylineCells(points: DungeonMapPoint[], blockedRooms: Set<string>) {
  const cells: DungeonMapPoint[] = []

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]

    if (previous.x === current.x) {
      const step = previous.y <= current.y ? 1 : -1
      for (let y = previous.y; y !== current.y + step; y += step) {
        if (index > 1 && y === previous.y) continue
        const point = { x: previous.x, y }
        if (blockedRooms.has(pointKey(point))) continue
        cells.push(point)
      }
      continue
    }

    if (previous.y === current.y) {
      const step = previous.x <= current.x ? 1 : -1
      for (let x = previous.x; x !== current.x + step; x += step) {
        if (index > 1 && x === previous.x) continue
        const point = { x, y: previous.y }
        if (blockedRooms.has(pointKey(point))) continue
        cells.push(point)
      }
    }
  }

  return cells
}

function corridorPolylineStepCount(points: DungeonMapPoint[]) {
  return Math.max(0, corridorPolylineCells(points, new Set<string>()).length - 1)
}

function corridorStepBudget(
  start: DungeonMapPoint,
  end: DungeonMapPoint,
  mapWidth: number,
  mapHeight: number,
  configuredMaxSteps: number,
) {
  const directDistance = corridorDistance(start, end)
  const relativeLimit = Math.max(12, directDistance * 2 + 6)
  const mapLimit = Math.max(24, Math.min(configuredMaxSteps, Math.floor((mapWidth + mapHeight) * 0.6)))
  return Math.min(configuredMaxSteps, mapLimit, relativeLimit)
}

function findRouteTarget(
  start: DungeonMapPoint,
  preferredEnd: DungeonMapPoint,
  mergeCandidates: DungeonMapPoint[],
  blockedRooms: Set<string>,
  blockedCorridors: Set<string>,
  allowedCorridorCells: Set<string>,
  mapWidth: number,
  mapHeight: number,
  preferMerge = false,
  blockedRouteCells: Set<string> = new Set<string>(),
  maxCorridorSteps = DEFAULT_MAX_CORRIDOR_STEPS,
) {
  const orderedCandidates = preferMerge
    ? [
      ...mergeCandidates.map((point) => ({ point, isMerge: true })),
      { point: preferredEnd, isMerge: false },
    ]
    : [
      { point: preferredEnd, isMerge: false },
      ...mergeCandidates.map((point) => ({ point, isMerge: true })),
    ]
  const uniqueCandidates = orderedCandidates.filter(({ point }, index) =>
    orderedCandidates.findIndex((other) => other.point.x === point.x && other.point.y === point.y) === index,
  )

  let bestPath: DungeonMapPoint[] | null = null
  let bestTarget: DungeonMapPoint | null = null
  let bestIsMerge = false
  let bestPathSteps = Number.POSITIVE_INFINITY

  const chooseBestCandidate = (candidates: typeof uniqueCandidates) => {
    bestPath = null
    bestTarget = null
    bestIsMerge = false
    bestPathSteps = Number.POSITIVE_INFINITY

    for (const candidate of candidates) {
      const allowedSteps = corridorStepBudget(start, candidate.point, mapWidth, mapHeight, maxCorridorSteps)
      const path = findRoomAwareCorridorPath(
        start,
        candidate.point,
        blockedRooms,
        mapWidth,
        mapHeight,
        blockedCorridors,
        allowedCorridorCells,
        blockedRouteCells,
      )
      if (!path) continue

      const pathSteps = corridorPolylineStepCount(path)
      if (pathSteps > allowedSteps) continue

      if (!bestPath || pathSteps < bestPathSteps) {
        bestPath = path
        bestTarget = candidate.point
        bestIsMerge = candidate.isMerge
        bestPathSteps = pathSteps
        continue
      }

      if (pathSteps === bestPathSteps && bestTarget) {
        const candidateDistance = corridorDistance(candidate.point, preferredEnd)
        const bestDistance = corridorDistance(bestTarget, preferredEnd)
        if (candidateDistance < bestDistance) {
          bestPath = path
          bestTarget = candidate.point
          bestIsMerge = candidate.isMerge
          bestPathSteps = pathSteps
        }
      }
    }
  }

  if (preferMerge) {
    const mergeOnlyCandidates = uniqueCandidates.filter((candidate) => candidate.isMerge)
    chooseBestCandidate(mergeOnlyCandidates)
    if (bestPath) {
      return {
        path: bestPath,
        target: bestTarget,
      }
    }
  }

  chooseBestCandidate(uniqueCandidates)

  return {
    path: bestPath,
    target: bestTarget,
  }
}

function corridorEndpointRoomId(rooms: DungeonRoom[], lookup: RoomSpatialLookup, point: DungeonMapPoint) {
  const roomIndex = roomIndexForPoint(lookup, point)
  return roomIndex >= 0 ? rooms[roomIndex]?.id : undefined
}

function appendEntranceDoorForStartRoom(
  rooms: DungeonRoom[],
  doors: DungeonDoor[],
  mapWidth: number,
  mapHeight: number,
) {
  const startIndex = rooms.findIndex((room) => room.kind === "start")
  if (startIndex < 0) return

  const startRoom = rooms[startIndex]
  const bounds = getRoomBounds(startRoom)
  const center = roomConnectionPoint(startRoom)
  const roomLookup = buildRoomSpatialLookup(rooms)
  const usedDirections = new Set<DungeonDoorDirection>()
  const usedCells = new Set<string>(doors.map((door) => `${door.x},${door.y}`))

  for (const door of doors) {
    if (!door.direction) continue
    const owner = roomIndexForPoint(roomLookup, { x: door.x, y: door.y })
    if (owner === startIndex) {
      usedDirections.add(door.direction)
    }
  }

  const candidates: Array<{ direction: DungeonDoorDirection; distance: number }> = [
    { direction: "west", distance: bounds.x },
    { direction: "east", distance: mapWidth - (bounds.x + bounds.width) },
    { direction: "north", distance: bounds.y },
    { direction: "south", distance: mapHeight - (bounds.y + bounds.height) },
  ]
    .sort((first, second) => {
      if (first.distance !== second.distance) return first.distance - second.distance
      return first.direction.localeCompare(second.direction)
    })

  const direction = candidates.find((candidate) => !usedDirections.has(candidate.direction))?.direction
  if (!direction) return

  const borderCells = buildRoomBorderCellInfos(startRoom)
    .filter((info) => info.openDirections.includes(direction))
    .filter((info) => !usedCells.has(`${info.point.x},${info.point.y}`))

  if (borderCells.length === 0) return

  const isRectCorner = (point: DungeonMapPoint) => (
    (point.x === bounds.x || point.x === bounds.x + bounds.width - 1)
    && (point.y === bounds.y || point.y === bounds.y + bounds.height - 1)
  )

  const score = (point: DungeonMapPoint) => {
    const exitPoint = movePoint(point, direction)
    const outOfBoundsBonus = pointWithinBounds(exitPoint, mapWidth, mapHeight) ? 0 : -40
    const cornerPenalty = isRectCorner(point) ? 1200 : 0
    const centerOffset = (direction === "north" || direction === "south")
      ? Math.abs(point.x - center.x)
      : Math.abs(point.y - center.y)
    return cornerPenalty + centerOffset * 12 + outOfBoundsBonus
  }

  borderCells.sort((first, second) => {
    const firstScore = score(first.point)
    const secondScore = score(second.point)
    if (firstScore !== secondScore) return firstScore - secondScore
    if (first.point.y !== second.point.y) return first.point.y - second.point.y
    return first.point.x - second.point.x
  })

  const entrancePoint = borderCells[0].point

  doors.push({
    id: `door-${doors.length + 1}`,
    x: entrancePoint.x,
    y: entrancePoint.y,
    direction,
    kind: "door",
  })
}

function findExteriorContactExitForImmediateTrim(
  room: DungeonRoom,
  exteriorPoint: DungeonMapPoint,
  direction: DungeonDoorDirection,
): RoomExitSelection | null {
  const borderCell = buildRoomBorderCellInfos(room)
    .filter((cell) => cell.openDirections.includes(direction))
    .find((cell) => {
      const outside = movePoint(cell.point, direction)
      return outside.x === exteriorPoint.x && outside.y === exteriorPoint.y
    })

  if (!borderCell) return null

  return {
    point: borderCell.point,
    direction,
  }
}

function trimImmediateWallSlides(rooms: DungeonRoom[], corridors: DungeonCorridor[]) {
  const roomLookup = buildRoomSpatialLookup(rooms)
  const roomSideUsage = new Map<string, number>()

  for (const corridor of corridors) {
    if (corridor.points.length < 2) continue

    const startRoomIndex = roomIndexForPoint(roomLookup, corridor.points[0])
    const startDirection = directionBetween(corridor.points[0], corridor.points[1])
    if (startRoomIndex >= 0 && startDirection) {
      const key = `${rooms[startRoomIndex].id}:${startDirection}`
      roomSideUsage.set(key, (roomSideUsage.get(key) ?? 0) + 1)
    }

    const end = corridor.points[corridor.points.length - 1]
    const beforeEnd = corridor.points[corridor.points.length - 2]
    const endRoomIndex = roomIndexForPoint(roomLookup, end)
    const endDirection = directionBetween(end, beforeEnd)
    if (endRoomIndex >= 0 && endDirection) {
      const key = `${rooms[endRoomIndex].id}:${endDirection}`
      roomSideUsage.set(key, (roomSideUsage.get(key) ?? 0) + 1)
    }
  }

  for (const corridor of corridors) {
    if (corridor.points.length < 3) continue

    const trimStart = () => {
      const [start, next, third] = corridor.points
      const roomIndex = roomIndexForPoint(roomLookup, start)
      if (roomIndex < 0) return
      if (roomIndexForPoint(roomLookup, third) >= 0) return

      const outwardDirection = directionBetween(start, next)
      if (!outwardDirection) return
      const roomSideKey = `${rooms[roomIndex].id}:${outwardDirection}`
      if ((roomSideUsage.get(roomSideKey) ?? 0) !== 1) return

      const nextDirection = directionBetween(next, third)
      if (!nextDirection) return

      const outwardAxis = outwardDirection === "east" || outwardDirection === "west" ? "horizontal" : "vertical"
      const nextAxis = nextDirection === "east" || nextDirection === "west" ? "horizontal" : "vertical"
      if (outwardAxis === nextAxis) return

      const replacement = findExteriorContactExitForImmediateTrim(rooms[roomIndex], third, outwardDirection)
      if (!replacement) return
      if (replacement.point.x === start.x && replacement.point.y === start.y) return

      corridor.points = [replacement.point, third, ...corridor.points.slice(3)]
    }

    const trimEnd = () => {
      const pointCount = corridor.points.length
      const end = corridor.points[pointCount - 1]
      const beforeEnd = corridor.points[pointCount - 2]
      const beforeBeforeEnd = corridor.points[pointCount - 3]
      const roomIndex = roomIndexForPoint(roomLookup, end)
      if (roomIndex < 0) return
      if (roomIndexForPoint(roomLookup, beforeBeforeEnd) >= 0) return

      const outwardDirection = directionBetween(end, beforeEnd)
      if (!outwardDirection) return
      const roomSideKey = `${rooms[roomIndex].id}:${outwardDirection}`
      if ((roomSideUsage.get(roomSideKey) ?? 0) !== 1) return

      const previousDirection = directionBetween(beforeBeforeEnd, beforeEnd)
      if (!previousDirection) return

      const outwardAxis = outwardDirection === "east" || outwardDirection === "west" ? "horizontal" : "vertical"
      const previousAxis = previousDirection === "east" || previousDirection === "west" ? "horizontal" : "vertical"
      if (outwardAxis === previousAxis) return

      const replacement = findExteriorContactExitForImmediateTrim(rooms[roomIndex], beforeBeforeEnd, outwardDirection)
      if (!replacement) return
      if (replacement.point.x === end.x && replacement.point.y === end.y) return

      corridor.points = [...corridor.points.slice(0, pointCount - 3), beforeBeforeEnd, replacement.point]
    }

    trimStart()
    if (corridor.points.length >= 3) {
      trimEnd()
    }
  }
}

function cleanupDoorsForCorridors(corridors: DungeonCorridor[], doors: DungeonDoor[]) {
  const usedDoorCells = new Set<string>()
  corridors.forEach((corridor) => {
    if (corridor.points.length < 2) return
    usedDoorCells.add(pointKey(corridor.points[0]))
    usedDoorCells.add(pointKey(corridor.points[corridor.points.length - 1]))
  })

  const remainingDoors = doors.filter((door) => usedDoorCells.has(pointKey(door)))
  doors.length = 0
  doors.push(...remainingDoors)
}

function removeDuplicateDirectRoomPairs(corridors: DungeonCorridor[], doors: DungeonDoor[], rooms: DungeonRoom[]) {
  const seenPairs = new Set<string>()
  const keptCorridors: DungeonCorridor[] = []
  const roomLookup = buildRoomSpatialLookup(rooms)

  for (const corridor of corridors) {
    if (corridor.points.length < 2) continue
    const startRoomId = corridorEndpointRoomId(rooms, roomLookup, corridor.points[0])
    const endRoomId = corridorEndpointRoomId(rooms, roomLookup, corridor.points[corridor.points.length - 1])

    if (!startRoomId || !endRoomId || startRoomId === endRoomId) {
      keptCorridors.push(corridor)
      continue
    }

    const pairKey = [startRoomId, endRoomId].sort().join(":")
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)
    keptCorridors.push(corridor)
  }

  corridors.length = 0
  corridors.push(...keptCorridors)
  cleanupDoorsForCorridors(corridors, doors)
}

function buildCommittedCorridorClusters(committedCorridors: CommittedCorridor[]): CorridorCluster[] {
  if (committedCorridors.length === 0) return []

  const corridorIndexesByCell = new Map<string, number[]>()

  committedCorridors.forEach((corridor, corridorIndex) => {
    corridor.cells.forEach((cell) => {
      const key = pointKey(cell)
      const indexes = corridorIndexesByCell.get(key)
      if (indexes) {
        indexes.push(corridorIndex)
      } else {
        corridorIndexesByCell.set(key, [corridorIndex])
      }
    })
  })

  const adjacency = new Map<number, Set<number>>()

  for (const indexes of corridorIndexesByCell.values()) {
    for (const corridorIndex of indexes) {
      const neighbors = adjacency.get(corridorIndex) ?? new Set<number>()
      for (const otherIndex of indexes) {
        if (otherIndex === corridorIndex) continue
        neighbors.add(otherIndex)
      }
      adjacency.set(corridorIndex, neighbors)
    }
  }

  const visited = new Set<number>()
  const clusters: CorridorCluster[] = []

  for (let corridorIndex = 0; corridorIndex < committedCorridors.length; corridorIndex += 1) {
    if (visited.has(corridorIndex)) continue

    const queue = [corridorIndex]
    visited.add(corridorIndex)
    const clusterCorridorIds: string[] = []
    const roomIds = new Set<string>()
    const roomSideKeys = new Set<string>()
    const cells = new Map<string, DungeonMapPoint>()

    while (queue.length > 0) {
      const currentIndex = queue.shift()
      if (currentIndex === undefined) break

      const corridor = committedCorridors[currentIndex]
      clusterCorridorIds.push(corridor.id)
      corridor.roomIds.forEach((roomId) => roomIds.add(roomId))
      corridor.roomSideKeys.forEach((roomSideKey) => roomSideKeys.add(roomSideKey))
      corridor.cells.forEach((cell) => cells.set(pointKey(cell), cell))

      for (const neighborIndex of adjacency.get(currentIndex) ?? []) {
        if (visited.has(neighborIndex)) continue
        visited.add(neighborIndex)
        queue.push(neighborIndex)
      }
    }

    clusters.push({
      corridorIds: clusterCorridorIds,
      roomIds,
      roomSideKeys,
      cells: [...cells.values()],
    })
  }

  return clusters
}

function buildCorridorClusterAnalyses(rooms: DungeonRoom[], corridors: DungeonCorridor[], blockedRooms: Set<string>): CorridorClusterAnalysis[] {
  const roomLookup = buildRoomSpatialLookup(rooms)
  const committedCorridors: CommittedCorridor[] = corridors.map((corridor) => {
    const startRoomIndex = roomIndexForPoint(roomLookup, corridor.points[0])
    const endRoomIndex = roomIndexForPoint(roomLookup, corridor.points[corridor.points.length - 1])

    return {
      id: corridor.id,
      points: corridor.points,
      roomIds: [startRoomIndex >= 0 ? rooms[startRoomIndex].id : "", endRoomIndex >= 0 ? rooms[endRoomIndex].id : ""],
      roomSideKeys: ["", ""],
      cells: corridorPolylineCells(corridor.points, blockedRooms),
    }
  })

  const clusters = buildCommittedCorridorClusters(committedCorridors)

  return clusters.map((cluster) => {
    const corridorIndexes = cluster.corridorIds
      .map((corridorId) => corridors.findIndex((corridor) => corridor.id === corridorId))
      .filter((index) => index >= 0)
    const roomIndexes = new Set<number>()

    for (const corridorIndex of corridorIndexes) {
      const corridor = corridors[corridorIndex]
      const startRoomIndex = roomIndexForPoint(roomLookup, corridor.points[0])
      const endRoomIndex = roomIndexForPoint(roomLookup, corridor.points[corridor.points.length - 1])
      if (startRoomIndex >= 0) roomIndexes.add(startRoomIndex)
      if (endRoomIndex >= 0) roomIndexes.add(endRoomIndex)
    }

    return { corridorIndexes, roomIndexes }
  })
}

type GenerationSpatialModel = RoomSpatialLookup & {
  corridorCellsByCorridorId: Map<string, DungeonMapPoint[]>
  corridorClusterAnalysis: CorridorClusterAnalysis[]
}

function buildGenerationSpatialModel(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  blockedRooms: Set<string>,
): GenerationSpatialModel {
  const roomLookup = buildRoomSpatialLookup(rooms)
  const corridorCellsByCorridorId = new Map<string, DungeonMapPoint[]>()

  for (const corridor of corridors) {
    corridorCellsByCorridorId.set(corridor.id, corridorPolylineCells(corridor.points, blockedRooms))
  }

  return {
    ...roomLookup,
    corridorCellsByCorridorId,
    corridorClusterAnalysis: buildCorridorClusterAnalyses(rooms, corridors, blockedRooms),
  }
}

function corridorEndpointRoomIndexes(spatial: GenerationSpatialModel, corridor: DungeonCorridor) {
  return {
    startRoomIndex: roomIndexForPoint(spatial, corridor.points[0]),
    endRoomIndex: roomIndexForPoint(spatial, corridor.points[corridor.points.length - 1]),
  }
}

function trimDuplicateRoomEntries(
  corridors: DungeonCorridor[],
  doors: DungeonDoor[],
  rooms: DungeonRoom[],
  blockedRooms: Set<string>,
) {
  let changed = false
  const roomLookup = buildRoomSpatialLookup(rooms)

  while (true) {
    const committedCorridors: CommittedCorridor[] = corridors.map((corridor, corridorIndex) => {
      return {
        id: corridor.id,
        points: corridor.points,
        roomIds: ["", ""],
        roomSideKeys: ["", ""],
        cells: corridorPolylineCells(corridor.points, blockedRooms),
      }
    })

    const clusters = buildCommittedCorridorClusters(committedCorridors)
    let trimmed = false
    const corridorsToDelete = new Set<number>()

    for (const cluster of clusters) {
      const cellUsage = new Map<string, number>()

      const endpointsByRoomId = new Map<string, CorridorEndpointRef[]>()

      cluster.corridorIds.forEach((corridorId) => {
        const corridorIndex = corridors.findIndex((corridor) => corridor.id === corridorId)
        if (corridorIndex < 0) return
        const corridor = corridors[corridorIndex]
        corridorPolylineCells(corridor.points, blockedRooms).forEach((cell) => {
          const key = pointKey(cell)
          cellUsage.set(key, (cellUsage.get(key) ?? 0) + 1)
        })
        const endpoints: CorridorEndpointRef[] = [
          { corridorIndex, position: "start", point: corridor.points[0] },
          { corridorIndex, position: "end", point: corridor.points[corridor.points.length - 1] },
        ]

        for (const endpoint of endpoints) {
          const roomIndex = roomIndexForPoint(roomLookup, endpoint.point)
          if (roomIndex < 0) continue
          const roomId = rooms[roomIndex].id
          const refs = endpointsByRoomId.get(roomId) ?? []
          refs.push(endpoint)
          endpointsByRoomId.set(roomId, refs)
        }
      })

      for (const refs of endpointsByRoomId.values()) {
        const uniqueDoorKeys = [...new Set(refs.map((ref) => pointKey(ref.point)))].sort()
        if (uniqueDoorKeys.length <= 1) continue

        const keepKey = uniqueDoorKeys[0]
        const refsToTrim = refs.filter((ref) => pointKey(ref.point) !== keepKey)

        for (const ref of refsToTrim) {
          const corridor = corridors[ref.corridorIndex]
          const expanded = corridorPolylineCells(corridor.points, new Set<string>())
          const orderedCells = ref.position === "end" ? [...expanded].reverse() : expanded
          const mergeCell = orderedCells.find((cell) => (cellUsage.get(pointKey(cell)) ?? 0) >= 2 && !blockedRooms.has(pointKey(cell)))
          if (!mergeCell) continue

          const mergeIndex = expanded.findIndex((cell) => cell.x === mergeCell.x && cell.y === mergeCell.y)
          if (mergeIndex < 0) continue

          const trimmedCells = ref.position === "end"
            ? expanded.slice(0, mergeIndex + 1)
            : expanded.slice(mergeIndex)

          if (trimmedCells.length < 2) {
            corridorsToDelete.add(ref.corridorIndex)
            trimmed = true
            changed = true
            continue
          }

          corridor.points = compressPolylinePoints(trimmedCells)
          trimmed = true
          changed = true
        }
      }
    }

    if (corridorsToDelete.size > 0) {
      const keptCorridors = corridors.filter((_, corridorIndex) => !corridorsToDelete.has(corridorIndex))
      corridors.length = 0
      corridors.push(...keptCorridors)
    }

    if (!trimmed) break
  }

  if (changed) {
    cleanupDoorsForCorridors(corridors, doors)
  }
}

function optimizeParallelAdjacentCorridors(
  corridors: DungeonCorridor[],
  blockedRooms: Set<string>,
  mapWidth: number,
  mapHeight: number,
) {
  let changed = false

  while (true) {
    let optimized = false

    for (let corridorIndex = 0; corridorIndex < corridors.length; corridorIndex += 1) {
      const current = corridors[corridorIndex]
      const otherCorridors = corridors.filter((_, index) => index !== corridorIndex)
      const orientationMap = buildCorridorOrientationMap(otherCorridors, blockedRooms)

      if (!hasParallelAdjacentRun(current.points, orientationMap, blockedRooms)) {
        continue
      }

      const blockedCorridors = new Set<string>()
      const allowedCorridorCells = new Set<string>()

      for (const corridor of otherCorridors) {
        for (const cell of corridorPolylineCells(corridor.points, blockedRooms)) {
          const key = pointKey(cell)
          blockedCorridors.add(key)
          allowedCorridorCells.add(key)
        }
      }

      const start = current.points[0]
      const end = current.points[current.points.length - 1]
      const currentFirstAxis: CorridorAxis | null = start.x === (current.points[1]?.x ?? start.x)
        ? start.y === (current.points[1]?.y ?? start.y)
          ? null
          : "vertical"
        : "horizontal"
      const alternateAxis = currentFirstAxis ? oppositeAxis(currentFirstAxis) : null

      if (alternateAxis) {
        const alternatePath = buildCorridorPolyline(start, end, alternateAxis)
        if (
          !pathCrossesBlockedRooms(alternatePath, blockedRooms)
          && corridorPolylineStepCount(alternatePath) <= corridorPolylineStepCount(current.points)
          && !hasParallelAdjacentRun(alternatePath, orientationMap, blockedRooms)
        ) {
          current.points = alternatePath
          optimized = true
          changed = true
          break
        }
      }

      const blockedRouteCells = buildParallelConflictCellKeys(current.points, orientationMap, blockedRooms)

      const rerouted = findRoomAwareCorridorPath(
        start,
        end,
        blockedRooms,
        mapWidth,
        mapHeight,
        blockedCorridors,
        allowedCorridorCells,
        blockedRouteCells,
      )

      if (!rerouted) {
        continue
      }

      if (corridorPolylineStepCount(rerouted) > corridorPolylineStepCount(current.points)) {
        continue
      }

      if (hasParallelAdjacentRun(rerouted, orientationMap, blockedRooms)) {
        continue
      }

      current.points = rerouted
      optimized = true
      changed = true
      break
    }

    if (!optimized) break
  }

  return changed
}

function clusterHasAlternateRoomPath(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  sourceRoomIndex: number,
  targetRoomIndex: number,
  excludedCorridorIndex: number,
) {
  const adjacency = new Map<number, Set<number>>()
  const roomLookup = buildRoomSpatialLookup(rooms)

  corridors.forEach((corridor, corridorIndex) => {
    if (corridorIndex === excludedCorridorIndex) return

    const startRoomIndex = roomIndexForPoint(roomLookup, corridor.points[0])
    const endRoomIndex = roomIndexForPoint(roomLookup, corridor.points[corridor.points.length - 1])
    if (startRoomIndex < 0 || endRoomIndex < 0 || startRoomIndex === endRoomIndex) return

    const startNeighbors = adjacency.get(startRoomIndex) ?? new Set<number>()
    const endNeighbors = adjacency.get(endRoomIndex) ?? new Set<number>()
    startNeighbors.add(endRoomIndex)
    endNeighbors.add(startRoomIndex)
    adjacency.set(startRoomIndex, startNeighbors)
    adjacency.set(endRoomIndex, endNeighbors)
  })

  const queue = [sourceRoomIndex]
  const visited = new Set<number>(queue)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (current === targetRoomIndex) return true

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  return false
}

function pruneClusterLoops(corridors: DungeonCorridor[], doors: DungeonDoor[], rooms: DungeonRoom[], blockedRooms: Set<string>) {
  let changed = false

  while (true) {
    const spatial = buildGenerationSpatialModel(rooms, corridors, blockedRooms)
    const analyses = spatial.corridorClusterAnalysis
    let removed = false

    for (const analysis of analyses) {
      const redundantCandidates = analysis.corridorIndexes
        .map((corridorIndex) => {
          const corridor = corridors[corridorIndex]
          const { startRoomIndex, endRoomIndex } = corridorEndpointRoomIndexes(spatial, corridor)

          if (startRoomIndex < 0 || endRoomIndex < 0 || startRoomIndex === endRoomIndex) {
            return null
          }

          const redundant = clusterHasAlternateRoomPath(
            rooms,
            corridors,
            startRoomIndex,
            endRoomIndex,
            corridorIndex,
          )

          if (!redundant) return null

          const corridorCells = spatial.corridorCellsByCorridorId.get(corridor.id)

          return {
            corridorIndex,
            stepCount: Math.max(0, (corridorCells?.length ?? 0) - 1),
          }
        })
        .filter((candidate): candidate is { corridorIndex: number; stepCount: number } => candidate !== null)
        .sort((first, second) => second.stepCount - first.stepCount)

      const candidate = redundantCandidates[0]
      if (!candidate) continue

      corridors.splice(candidate.corridorIndex, 1)
      cleanupDoorsForCorridors(corridors, doors)
      changed = true
      removed = true
      break
    }

    if (!removed) break
  }

  return changed
}

type CorridorCellAxis = "horizontal" | "vertical"

function buildCorridorOrientationMap(corridors: DungeonCorridor[], blockedRooms: Set<string>) {
  const orientations = new Map<string, Set<CorridorCellAxis>>()

  for (const corridor of corridors) {
    for (let index = 1; index < corridor.points.length; index += 1) {
      const previous = corridor.points[index - 1]
      const current = corridor.points[index]

      if (previous.x === current.x) {
        const step = previous.y <= current.y ? 1 : -1
        for (let y = previous.y; y !== current.y + step; y += step) {
          if (index > 1 && y === previous.y) continue
          const key = pointKey({ x: previous.x, y })
          if (blockedRooms.has(key)) continue
          const entry = orientations.get(key) ?? new Set<CorridorCellAxis>()
          entry.add("vertical")
          orientations.set(key, entry)
        }
        continue
      }

      if (previous.y === current.y) {
        const step = previous.x <= current.x ? 1 : -1
        for (let x = previous.x; x !== current.x + step; x += step) {
          if (index > 1 && x === previous.x) continue
          const key = pointKey({ x, y: previous.y })
          if (blockedRooms.has(key)) continue
          const entry = orientations.get(key) ?? new Set<CorridorCellAxis>()
          entry.add("horizontal")
          orientations.set(key, entry)
        }
      }
    }
  }

  return orientations
}

function hasParallelAdjacentRun(
  path: DungeonMapPoint[],
  orientationMap: Map<string, Set<CorridorCellAxis>>,
  blockedRooms: Set<string>,
) {
  const expanded = corridorPolylineCells(path, blockedRooms)
  let horizontalRun = 0
  let verticalRun = 0

  for (let index = 1; index < expanded.length; index += 1) {
    const previous = expanded[index - 1]
    const current = expanded[index]
    const axis: CorridorCellAxis | null = previous.x === current.x ? "vertical" : previous.y === current.y ? "horizontal" : null

    if (!axis) {
      horizontalRun = 0
      verticalRun = 0
      continue
    }

    const parallelNeighbors = axis === "horizontal"
      ? [
          orientationMap.get(pointKey({ x: current.x, y: current.y - 1 })),
          orientationMap.get(pointKey({ x: current.x, y: current.y + 1 })),
        ]
      : [
          orientationMap.get(pointKey({ x: current.x - 1, y: current.y })),
          orientationMap.get(pointKey({ x: current.x + 1, y: current.y })),
        ]

    const hasParallelNeighbor = parallelNeighbors.some((entry) => entry?.has(axis))

    if (axis === "horizontal") {
      horizontalRun = hasParallelNeighbor ? horizontalRun + 1 : 0
      verticalRun = 0
      if (horizontalRun >= 2) return true
      continue
    }

    verticalRun = hasParallelNeighbor ? verticalRun + 1 : 0
    horizontalRun = 0
    if (verticalRun >= 2) return true
  }

  return false
}

function buildParallelConflictCellKeys(
  path: DungeonMapPoint[],
  orientationMap: Map<string, Set<CorridorCellAxis>>,
  blockedRooms: Set<string>,
) {
  const expanded = corridorPolylineCells(path, blockedRooms)
  const keys = new Set<string>()

  for (let index = 1; index < expanded.length; index += 1) {
    const previous = expanded[index - 1]
    const current = expanded[index]
    const axis: CorridorCellAxis | null = previous.x === current.x ? "vertical" : previous.y === current.y ? "horizontal" : null

    if (!axis) continue

    const parallelNeighbors = axis === "horizontal"
      ? [
          orientationMap.get(pointKey({ x: current.x, y: current.y - 1 })),
          orientationMap.get(pointKey({ x: current.x, y: current.y + 1 })),
        ]
      : [
          orientationMap.get(pointKey({ x: current.x - 1, y: current.y })),
          orientationMap.get(pointKey({ x: current.x + 1, y: current.y })),
        ]

    if (parallelNeighbors.some((entry) => entry?.has(axis))) {
      keys.add(pointKey(current))
    }
  }

  return keys
}


function isolateLeafCorridorCluster(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  blockedRooms: Set<string>,
  mapWidth: number,
  mapHeight: number,
  targetRoomIndex: number,
  blockDoorReuse = false,
) {
  const startIndex = rooms.findIndex((room) => room.kind === "start")
  if (startIndex < 0 || targetRoomIndex < 0) return false
  const roomLookup = buildRoomSpatialLookup(rooms)

  const analyses = buildCorridorClusterAnalyses(rooms, corridors, blockedRooms)
  const targetCluster = analyses.find((analysis) => analysis.roomIndexes.has(targetRoomIndex) && analysis.roomIndexes.has(startIndex))
  if (!targetCluster) return false

  const targetCorridorIndexes = corridors
    .map((corridor, corridorIndex) => {
      const startRoomIndex = roomIndexForPoint(roomLookup, corridor.points[0])
      const endRoomIndex = roomIndexForPoint(roomLookup, corridor.points[corridor.points.length - 1])
      return startRoomIndex === targetRoomIndex || endRoomIndex === targetRoomIndex ? corridorIndex : -1
    })
    .filter((index) => index >= 0)

  if (targetCorridorIndexes.length !== 1) return false

  const corridorIndex = targetCorridorIndexes[0]
  const corridor = corridors[corridorIndex]
  const directAdjacency = buildRoomAdjacencyByCorridorsModule(rooms, corridors, {
    getRoomConnectionPoint: roomConnectionPoint,
    buildRoomSpatialLookup,
    roomIndexForPoint,
  })
  const neighborRoomIndex = [...(directAdjacency.get(targetRoomIndex) ?? [])][0]
  if (neighborRoomIndex === undefined) return false

  const targetRoom = rooms[targetRoomIndex]
  const neighborRoom = rooms[neighborRoomIndex]
  const targetCenter = roomConnectionPoint(targetRoom)
  const neighborCenter = roomConnectionPoint(neighborRoom)
  const blockedCorridors = new Set<string>()
  const blockedDoorCells = new Set<string>()
  const otherCorridors = corridors.filter((_, candidateIndex) => candidateIndex !== corridorIndex)
  const orientationMap = buildCorridorOrientationMap(otherCorridors, blockedRooms)

  for (const candidate of otherCorridors) {
    if (candidate.points.length >= 2) {
      blockedDoorCells.add(pointKey(candidate.points[0]))
      blockedDoorCells.add(pointKey(candidate.points[candidate.points.length - 1]))
    }
    corridorPolylineCells(candidate.points, blockedRooms).forEach((cell) => {
      blockedCorridors.add(pointKey(cell))
    })
  }

  const axisOptions: CorridorAxis[] = ["horizontal", "vertical"]
  let replacement: DungeonMapPoint[] | null = null

  for (const targetAxis of axisOptions) {
    for (const neighborAxis of axisOptions) {
      const targetDirection = preferredDirectionForAxis(targetCenter, neighborCenter, targetAxis)
      const neighborDirection = preferredDirectionForAxis(neighborCenter, targetCenter, neighborAxis)
      const targetExit = pickRoomExitPoint(targetRoom, neighborCenter, {
        preferredDirection: targetDirection,
        axis: targetAxis,
        blockedRooms,
        blockedCorridors,
        blockedDoorCells: blockDoorReuse ? blockedDoorCells : undefined,
        mapWidth,
        mapHeight,
      })
      const neighborExit = pickRoomExitPoint(neighborRoom, targetCenter, {
        preferredDirection: neighborDirection,
        axis: neighborAxis,
        blockedRooms,
        blockedCorridors,
        blockedDoorCells: blockDoorReuse ? blockedDoorCells : undefined,
        mapWidth,
        mapHeight,
      })
      if (blockDoorReuse) {
        const targetDoorKey = pointKey(targetExit.point)
        const neighborDoorKey = pointKey(neighborExit.point)
        if (blockedDoorCells.has(targetDoorKey) || blockedDoorCells.has(neighborDoorKey)) continue
      }
      const targetLead = buildDoorLead(targetExit.point, targetExit.direction, blockedRooms, mapWidth, mapHeight, 1)
      const neighborLead = buildDoorLead(neighborExit.point, neighborExit.direction, blockedRooms, mapWidth, mapHeight, 1)
      const routeStart = targetLead[targetLead.length - 1]
      const routeEnd = neighborLead[neighborLead.length - 1]
      const blockedRouteCells = new Set<string>([
        ...targetLead.slice(0, -1).map(pointKey),
        ...neighborLead.slice(0, -1).map(pointKey),
        ...(blockDoorReuse ? [...blockedDoorCells] : []),
      ])
      const corePath = findRoomAwareCorridorPath(
        routeStart,
        routeEnd,
        blockedRooms,
        mapWidth,
        mapHeight,
        blockedCorridors,
        new Set<string>([pointKey(routeStart), pointKey(routeEnd)]),
        blockedRouteCells,
      )

      if (!corePath) continue

      const candidatePoints: DungeonMapPoint[] = [...targetLead]
      appendUniquePoints(candidatePoints, corePath)
      appendUniquePoints(candidatePoints, [...neighborLead].reverse().slice(1))

      if (hasParallelAdjacentRun(candidatePoints, orientationMap, blockedRooms)) continue
      replacement = candidatePoints
      break
    }
    if (replacement) break
  }

  if (!replacement) return false

  corridor.points = replacement

  const nextAnalyses = buildCorridorClusterAnalyses(rooms, corridors, blockedRooms)
  const nextTargetCluster = nextAnalyses.find((analysis) => analysis.roomIndexes.has(targetRoomIndex))
  return Boolean(nextTargetCluster && !nextTargetCluster.roomIndexes.has(startIndex))
}


function pickWeightedArchetype(random: () => number, options: Array<{ archetype: RoomArchetype; weight: number }>) {
  const total = options.reduce((sum, option) => sum + option.weight, 0)
  let cursor = random() * total

  for (const option of options) {
    cursor -= option.weight
    if (cursor <= 0) {
      return option.archetype
    }
  }

  return options[options.length - 1]?.archetype ?? "square-room"
}

function clampRoomPlan(plan: RoomPlan, mapWidth: number, mapHeight: number): RoomPlan {
  return {
    archetype: plan.archetype,
    width: Math.min(plan.width, mapWidth),
    height: Math.min(plan.height, mapHeight),
  }
}

function randomIntegerInRange(random: () => number, min: number, max: number) {
  return randomInteger(random, Math.min(min, max), Math.max(min, max))
}

function buildRoomPlanForArchetype(
  archetype: RoomArchetype,
  random: () => number,
  minRoomWidth: number,
  maxRoomWidth: number,
  minRoomHeight: number,
  maxRoomHeight: number,
  mapWidth: number,
  mapHeight: number,
) {
  const maxBase = Math.max(minRoomWidth, maxRoomWidth)
  const maxTallBase = Math.max(minRoomHeight, maxRoomHeight)

  if (archetype === "main-chamber") {
    return clampRoomPlan({
      archetype,
      width: randomIntegerInRange(random, Math.max(minRoomWidth, Math.floor(maxRoomWidth * 0.72)), maxRoomWidth),
      height: randomIntegerInRange(random, Math.max(minRoomHeight, Math.floor(maxRoomHeight * 0.68)), maxRoomHeight),
    }, mapWidth, mapHeight)
  }

  if (archetype === "small-room") {
    return clampRoomPlan({
      archetype,
      width: randomIntegerInRange(random, minRoomWidth, Math.max(minRoomWidth, Math.floor(maxBase * 0.55))),
      height: randomIntegerInRange(random, minRoomHeight, Math.max(minRoomHeight, Math.floor(maxTallBase * 0.55))),
    }, mapWidth, mapHeight)
  }

  if (archetype === "wide-room") {
    const width = randomIntegerInRange(random, Math.max(minRoomWidth, Math.floor(maxRoomWidth * 0.6)), maxRoomWidth)
    const heightMax = Math.min(maxRoomHeight, Math.max(minRoomHeight, Math.floor(width / 1.35)))
    return clampRoomPlan({
      archetype,
      width,
      height: randomIntegerInRange(random, minRoomHeight, heightMax),
    }, mapWidth, mapHeight)
  }

  if (archetype === "tall-room") {
    const height = randomIntegerInRange(random, Math.max(minRoomHeight, Math.floor(maxRoomHeight * 0.6)), maxRoomHeight)
    const widthMax = Math.min(maxRoomWidth, Math.max(minRoomWidth, Math.floor(height / 1.35)))
    return clampRoomPlan({
      archetype,
      width: randomIntegerInRange(random, minRoomWidth, widthMax),
      height,
    }, mapWidth, mapHeight)
  }

  const size = randomIntegerInRange(
    random,
    Math.max(minRoomWidth, minRoomHeight),
    Math.min(maxRoomWidth, maxRoomHeight),
  )

  return clampRoomPlan({
    archetype,
    width: size,
    height: randomIntegerInRange(random, Math.max(minRoomHeight, size - 1), Math.min(maxRoomHeight, size + 1)),
  }, mapWidth, mapHeight)
}

function buildRoomPlanSequence(
  roomCount: number,
  random: () => number,
  minRoomWidth: number,
  maxRoomWidth: number,
  minRoomHeight: number,
  maxRoomHeight: number,
  mapWidth: number,
  mapHeight: number,
) {
  const plans: RoomPlan[] = []
  if (roomCount <= 0) return plans

  plans.push(buildRoomPlanForArchetype("main-chamber", random, minRoomWidth, maxRoomWidth, minRoomHeight, maxRoomHeight, mapWidth, mapHeight))

  const targetSmallRooms = roomCount >= 6 ? Math.max(2, Math.floor(roomCount * 0.35)) : roomCount >= 4 ? 1 : 0
  const guaranteed = roomCount >= 3
    ? ["wide-room", "tall-room", roomCount >= 5 ? "small-room" : "square-room"] as RoomArchetype[]
    : roomCount === 2
      ? ["square-room"] as RoomArchetype[]
      : []

  for (const archetype of guaranteed) {
    if (plans.length >= roomCount) break
    plans.push(buildRoomPlanForArchetype(archetype, random, minRoomWidth, maxRoomWidth, minRoomHeight, maxRoomHeight, mapWidth, mapHeight))
  }

  while (plans.length < roomCount) {
    const currentSmallRooms = plans.filter((plan) => plan.archetype === "small-room").length
    const archetype = pickWeightedArchetype(random, [
      { archetype: "square-room", weight: 3 },
      { archetype: "wide-room", weight: 2.6 },
      { archetype: "tall-room", weight: 2.6 },
      { archetype: "small-room", weight: currentSmallRooms < targetSmallRooms ? 2.4 : 0.8 },
    ])
    plans.push(buildRoomPlanForArchetype(archetype, random, minRoomWidth, maxRoomWidth, minRoomHeight, maxRoomHeight, mapWidth, mapHeight))
  }

  return plans
}

function pickStartRoomIndex(rooms: DungeonRoom[], mapWidth: number, mapHeight: number) {
  if (rooms.length === 0) return -1

  let bestIndex = 0
  let bestScore = Number.NEGATIVE_INFINITY

  for (let index = 0; index < rooms.length; index += 1) {
    const center = roomCenter(rooms[index])
    const area = roomArea(rooms[index])
    const edgeDistance = Math.min(
      center.x,
      center.y,
      mapWidth - center.x,
      mapHeight - center.y,
    )
    const cornerDistance = Math.min(
      Math.hypot(center.x, center.y),
      Math.hypot(mapWidth - center.x, center.y),
      Math.hypot(center.x, mapHeight - center.y),
      Math.hypot(mapWidth - center.x, mapHeight - center.y),
    )
    const score = -edgeDistance * 2.4 + Math.min(area, 80) * 0.14 + Math.min(cornerDistance, 10) * 0.8

    if (score > bestScore) {
      bestIndex = index
      bestScore = score
    }
  }

  return bestIndex
}

function scoreRoomCandidate(
  candidate: DungeonRoom,
  placedRooms: DungeonRoom[],
  mapWidth: number,
  mapHeight: number,
  archetype: RoomArchetype,
  roomDispersion: number,
) {
  const dispersion = clampNumber(roomDispersion, 0, 0, 1)
  const centerPullScale = 1 - dispersion * 0.9
  const edgePushScale = dispersion

  if (placedRooms.length === 0) {
    const center = roomCenter(candidate)
    const mapCenterX = mapWidth / 2
    const mapCenterY = mapHeight / 2
    const centerDistance = Math.hypot(center.x - mapCenterX, center.y - mapCenterY)
    const edgeDistance = Math.min(center.x, center.y, mapWidth - center.x, mapHeight - center.y)
    return roomArea(candidate) * 3
      - centerDistance * (archetype === "main-chamber" ? 0.28 : 0.4) * centerPullScale
      - edgeDistance * 0.42 * edgePushScale
  }

  const candidateCenter = roomCenter(candidate)
  const candidateArea = roomArea(candidate)
  const distances = placedRooms.map((room) => {
    const placedCenter = roomCenter(room)
    return Math.hypot(candidateCenter.x - placedCenter.x, candidateCenter.y - placedCenter.y)
  })
  const nearestDistance = Math.min(...distances)
  const averageDistance = average(distances)
  const softenedNearestDistance = Math.min(nearestDistance, 12)
  const softenedAverageDistance = Math.min(averageDistance, 18)
  const localDensityPenalty = distances.filter((distance) => distance < 8).length * 10
  const largeRoomPenalty = placedRooms.reduce((penalty, room, index) => {
    const placedArea = roomArea(room)
    if (candidateArea < 48 || placedArea < 48) {
      return penalty
    }

    const requiredDistance = Math.sqrt(candidateArea) * 0.45 + Math.sqrt(placedArea) * 0.45
    return penalty + Math.max(0, requiredDistance - distances[index]) * 3
  }, 0)
  const mapCenterX = mapWidth / 2
  const mapCenterY = mapHeight / 2
  const centerDistance = Math.hypot(candidateCenter.x - mapCenterX, candidateCenter.y - mapCenterY)
  const cornerDistance = Math.min(
    Math.hypot(candidateCenter.x, candidateCenter.y),
    Math.hypot(mapWidth - candidateCenter.x, candidateCenter.y),
    Math.hypot(candidateCenter.x, mapHeight - candidateCenter.y),
    Math.hypot(mapWidth - candidateCenter.x, mapHeight - candidateCenter.y),
  )
  const cornerPenalty = Math.max(0, 5 - cornerDistance) * 6
  const edgeDistance = Math.min(
    candidateCenter.x,
    candidateCenter.y,
    mapWidth - candidateCenter.x,
    mapHeight - candidateCenter.y,
  )
  const matchingAspectRooms = placedRooms.filter((room) => roomAspectBucket(room) === roomAspectBucket(candidate)).length
  const sameAreaBandRooms = placedRooms.filter((room) => {
    const placedArea = roomArea(room)
    return Math.abs(placedArea - candidateArea) <= Math.max(8, candidateArea * 0.18)
  }).length
  const archetypeBias = archetype === "main-chamber"
    ? edgeDistance * (0.06 - 0.66 * edgePushScale) - centerDistance * 0.22 * centerPullScale
    : archetype === "small-room"
      ? edgeDistance * (0.6 - 0.95 * edgePushScale) - centerDistance * 0.12 * centerPullScale
      : archetype === "wide-room" || archetype === "tall-room"
        ? edgeDistance * (0.5 - 0.8 * edgePushScale) - centerDistance * 0.14 * centerPullScale
        : edgeDistance * (0.45 - 0.73 * edgePushScale) - centerDistance * 0.16 * centerPullScale

  return (
    softenedNearestDistance * 4.4
    + softenedAverageDistance * 0.62
    + archetypeBias
    - localDensityPenalty
    - largeRoomPenalty
    - matchingAspectRooms * 6
    - sameAreaBandRooms * 4
    - cornerPenalty
  )
}

function buildRoomCandidate(
  index: number,
  random: () => number,
  mapWidth: number,
  mapHeight: number,
  plan: RoomPlan,
  minRoomWidth: number,
  maxRoomWidth: number,
  minRoomHeight: number,
  maxRoomHeight: number,
) {
  const jitterX = plan.archetype === "main-chamber" ? 2 : 1
  const jitterY = plan.archetype === "main-chamber" ? 2 : 1
  const roomWidth = Math.min(maxRoomWidth, Math.max(minRoomWidth, plan.width + randomInteger(random, -jitterX, jitterX)))
  const roomHeight = Math.min(maxRoomHeight, Math.max(minRoomHeight, plan.height + randomInteger(random, -jitterY, jitterY)))
  const maxX = mapWidth - roomWidth
  const maxY = mapHeight - roomHeight

  if (maxX < 0 || maxY < 0) {
    return null
  }

  const x = randomInteger(random, 0, maxX)
  const y = randomInteger(random, 0, maxY)

  return {
    id: `room-${index + 1}`,
    kind: "room",
    shape: "rect",
    x,
    y,
    width: roomWidth,
    height: roomHeight,
    label: `Sala ${index + 1}`,
  } satisfies DungeonRoom
}

function normalizeRoomRange(
  minValue: number | undefined,
  maxValue: number | undefined,
  legacyValue: number | undefined,
  fallbackMin: number,
  fallbackMax: number,
  boundMax: number,
) {
  const safeBoundMax = Math.max(3, boundMax)
  const legacy = typeof legacyValue === "number" && Number.isFinite(legacyValue)
    ? clampInteger(legacyValue, fallbackMin, 3, safeBoundMax)
    : undefined
  const normalizedMin = clampInteger(minValue ?? legacy, fallbackMin, 3, safeBoundMax)
  const normalizedMax = clampInteger(maxValue ?? legacy, fallbackMax, normalizedMin, safeBoundMax)

  return {
    min: Math.min(normalizedMin, normalizedMax),
    max: Math.max(normalizedMin, normalizedMax),
  }
}

export function createGenerationContext(options: GenerateDungeonMapOptions = {}): GenerationContext {
  const preset = options.preset ?? "simple"
  const presetConfig = PRESET_COMPOSITIONS[preset]
  const roomOptions = options.roomOptions ?? {}
  const corridorOptions = options.corridorOptions ?? {}
  const lightingOptions = options.lightingOptions ?? {}
  const topologyOptions = options.topologyOptions ?? {}
  const debugOptions = options.debugOptions ?? {}

  const width = clampInteger(options.width, presetConfig.width, 8, 512)
  const height = clampInteger(options.height, presetConfig.height, 8, 512)
  const maxCorridorSteps = clampInteger(corridorOptions.maxSteps ?? options.maxCorridorSteps, DEFAULT_MAX_CORRIDOR_STEPS, 8, 512)
  const extraConnectionCount = clampInteger(
    topologyOptions.extraConnections ?? options.extraConnectionCount,
    presetConfig.extraConnectionCount,
    0,
    16,
  )
  const topologyMotif = topologyOptions.motif ?? DEFAULT_TOPOLOGY_MOTIF
  const motifStrength = clampNumber(topologyOptions.motifStrength, DEFAULT_MOTIF_STRENGTH, 0, 1)
  const adaptiveLoops = topologyOptions.adaptiveLoops ?? false
  const loopDensity: LoopDensity = topologyOptions.loopDensity ?? DEFAULT_LOOP_DENSITY
  const maxLoopsAbsolute = topologyOptions.maxLoopsAbsolute !== undefined
    ? clampInteger(topologyOptions.maxLoopsAbsolute, 8, 0, 128)
    : undefined
  const loopLengthTarget: LoopLengthTarget = topologyOptions.loopLengthTarget ?? DEFAULT_LOOP_LENGTH_TARGET
  const motifProfile = TOPOLOGY_MOTIF_PROFILES[topologyMotif]
  const topologyNeighborCount = clampInteger(
    topologyOptions.nearestNeighborCount,
    DEFAULT_TOPOLOGY_NEIGHBOR_COUNT,
    2,
    8,
  )
  const mainPathMaxEdgeRatio = clampNumber(
    topologyOptions.mainPathMaxEdgeRatio,
    DEFAULT_MAIN_PATH_MAX_EDGE_RATIO,
    0.1,
    2,
  )
  const branchMaxEdgeRatio = clampNumber(
    topologyOptions.branchMaxEdgeRatio,
    DEFAULT_BRANCH_MAX_EDGE_RATIO,
    0.1,
    2,
  )
  const serviceMaxEdgeRatio = clampNumber(
    topologyOptions.serviceMaxEdgeRatio,
    DEFAULT_SERVICE_MAX_EDGE_RATIO,
    0.1,
    2,
  )
  const optionalLoopMaxEdgeRatio = clampNumber(
    topologyOptions.optionalLoopMaxEdgeRatio,
    DEFAULT_OPTIONAL_LOOP_MAX_EDGE_RATIO,
    0.1,
    3,
  )
  const mapDiagonal = Math.hypot(width, height)
  const baseMaxEdgeDistanceByRole: Record<ConnectionRole, number> = {
    "main-path": Math.max(8, Math.round(mapDiagonal * mainPathMaxEdgeRatio)),
    branch: Math.max(8, Math.round(mapDiagonal * branchMaxEdgeRatio)),
    "service/dead-end": Math.max(8, Math.round(mapDiagonal * serviceMaxEdgeRatio)),
    "optional-loop": Math.max(8, Math.round(mapDiagonal * optionalLoopMaxEdgeRatio)),
  }
  const fallbackMaxEdgeDistanceByRole: Record<ConnectionRole, number> = {
    "main-path": Math.max(8, Math.round(blendNumeric(
      baseMaxEdgeDistanceByRole["main-path"],
      baseMaxEdgeDistanceByRole["main-path"] * motifProfile.maxEdgeDistanceMultiplierByRole["main-path"],
      motifStrength,
    ))),
    branch: Math.max(8, Math.round(blendNumeric(
      baseMaxEdgeDistanceByRole.branch,
      baseMaxEdgeDistanceByRole.branch * motifProfile.maxEdgeDistanceMultiplierByRole.branch,
      motifStrength,
    ))),
    "service/dead-end": Math.max(8, Math.round(blendNumeric(
      baseMaxEdgeDistanceByRole["service/dead-end"],
      baseMaxEdgeDistanceByRole["service/dead-end"] * motifProfile.maxEdgeDistanceMultiplierByRole["service/dead-end"],
      motifStrength,
    ))),
    "optional-loop": Math.max(8, Math.round(blendNumeric(
      baseMaxEdgeDistanceByRole["optional-loop"],
      baseMaxEdgeDistanceByRole["optional-loop"] * motifProfile.maxEdgeDistanceMultiplierByRole["optional-loop"],
      motifStrength,
    ))),
  }
  const baseKNearestByRole: Record<ConnectionRole, number> = {
    "main-path": topologyNeighborCount,
    branch: topologyNeighborCount,
    "service/dead-end": topologyNeighborCount,
    "optional-loop": Math.max(topologyNeighborCount, 6),
  }
  const motifKNearestByRole: Record<ConnectionRole, number> = {
    "main-path": clampInteger(
      Math.round(blendNumeric(
        baseKNearestByRole["main-path"],
        baseKNearestByRole["main-path"] * motifProfile.kNearestMultiplierByRole["main-path"],
        motifStrength,
      )),
      baseKNearestByRole["main-path"],
      1,
      32,
    ),
    branch: clampInteger(
      Math.round(blendNumeric(
        baseKNearestByRole.branch,
        baseKNearestByRole.branch * motifProfile.kNearestMultiplierByRole.branch,
        motifStrength,
      )),
      baseKNearestByRole.branch,
      1,
      32,
    ),
    "service/dead-end": clampInteger(
      Math.round(blendNumeric(
        baseKNearestByRole["service/dead-end"],
        baseKNearestByRole["service/dead-end"] * motifProfile.kNearestMultiplierByRole["service/dead-end"],
        motifStrength,
      )),
      baseKNearestByRole["service/dead-end"],
      1,
      32,
    ),
    "optional-loop": clampInteger(
      Math.round(blendNumeric(
        baseKNearestByRole["optional-loop"],
        baseKNearestByRole["optional-loop"] * motifProfile.kNearestMultiplierByRole["optional-loop"],
        motifStrength,
      )),
      baseKNearestByRole["optional-loop"],
      1,
      48,
    ),
  }
  const maxEdgeDistanceByRole: Record<ConnectionRole, number> = {
    "main-path": clampInteger(topologyOptions.maxEdgeDistanceByRole?.["main-path"], fallbackMaxEdgeDistanceByRole["main-path"], 4, 4096),
    branch: clampInteger(topologyOptions.maxEdgeDistanceByRole?.branch, fallbackMaxEdgeDistanceByRole.branch, 4, 4096),
    "service/dead-end": clampInteger(topologyOptions.maxEdgeDistanceByRole?.["service/dead-end"], fallbackMaxEdgeDistanceByRole["service/dead-end"], 4, 4096),
    "optional-loop": clampInteger(topologyOptions.maxEdgeDistanceByRole?.["optional-loop"], fallbackMaxEdgeDistanceByRole["optional-loop"], 4, 4096),
  }
  const kNearestByRole: Record<ConnectionRole, number> = {
    "main-path": clampInteger(topologyOptions.kNearestByRole?.["main-path"], motifKNearestByRole["main-path"], 1, 16),
    branch: clampInteger(topologyOptions.kNearestByRole?.branch, motifKNearestByRole.branch, 1, 16),
    "service/dead-end": clampInteger(topologyOptions.kNearestByRole?.["service/dead-end"], motifKNearestByRole["service/dead-end"], 1, 16),
    "optional-loop": clampInteger(topologyOptions.kNearestByRole?.["optional-loop"], motifKNearestByRole["optional-loop"], 1, 32),
  }
  const defaultMergePolicy = defaultMergePolicyByRole()
  const motifDefaultMergePolicy: Record<ConnectionRole, boolean> = motifStrength >= 0.5
    ? motifProfile.mergePolicyByRole
    : defaultMergePolicy
  const mergePolicyByRole: Record<ConnectionRole, boolean> = {
    "main-path": topologyOptions.mergePolicyByRole?.["main-path"] ?? motifDefaultMergePolicy["main-path"],
    branch: topologyOptions.mergePolicyByRole?.branch ?? motifDefaultMergePolicy.branch,
    "service/dead-end": topologyOptions.mergePolicyByRole?.["service/dead-end"] ?? motifDefaultMergePolicy["service/dead-end"],
    "optional-loop": topologyOptions.mergePolicyByRole?.["optional-loop"] ?? motifDefaultMergePolicy["optional-loop"],
  }
  const roomWidthRange = normalizeRoomRange(
    roomOptions.minWidth ?? options.minRoomWidth,
    roomOptions.maxWidth ?? options.maxRoomWidth,
    roomOptions.width ?? options.roomWidth,
    5,
    Math.max(6, Math.floor(width * 0.22)),
    Math.min(48, width),
  )
  const roomHeightRange = normalizeRoomRange(
    roomOptions.minHeight ?? options.minRoomHeight,
    roomOptions.maxHeight ?? options.maxRoomHeight,
    roomOptions.height ?? options.roomHeight,
    4,
    Math.max(5, Math.floor(height * 0.2)),
    Math.min(48, height),
  )
  const roomDispersion = clampNumber(roomOptions.dispersion ?? options.roomDispersion, 0, 0, 1)
  const lightBrightRadiusCells = clampInteger(
    lightingOptions.brightRadiusCells,
    DEFAULT_LIGHT_BRIGHT_RADIUS_CELLS,
    0,
    64,
  )
  const lightDimRadiusCells = clampInteger(
    lightingOptions.dimRadiusCells,
    DEFAULT_LIGHT_DIM_RADIUS_CELLS,
    lightBrightRadiusCells,
    128,
  )
  const lightDensityPercent = clampInteger(
    lightingOptions.densityPercent,
    100,
    0,
    300,
  )

  return {
    preset,
    width,
    height,
    roomCount: roomOptions.count ?? options.roomCount ?? presetConfig.roomCount,
    minRoomWidth: roomWidthRange.min,
    maxRoomWidth: roomWidthRange.max,
    minRoomHeight: roomHeightRange.min,
    maxRoomHeight: roomHeightRange.max,
    roomPadding: roomOptions.padding ?? options.roomPadding ?? 1,
    roomDispersion,
    includeCorridors: corridorOptions.enabled ?? options.includeCorridors ?? presetConfig.includeCorridors,
    corridorWidth: clampInteger(corridorOptions.width ?? options.corridorWidth, 1, 1, 4),
    maxCorridorSteps,
    allowCorridorIntersections: corridorOptions.allowIntersections ?? options.allowCorridorIntersections ?? true,
    lightingEnabled: lightingOptions.enabled ?? options.generateTorches ?? false,
    lightingPlacement: lightingOptions.placement ?? DEFAULT_LIGHTING_PLACEMENT,
    lightDensityPercent,
    lightBrightRadiusCells,
    lightDimRadiusCells,
    extraConnectionCount,
    topologyMotif,
    motifStrength,
    adaptiveLoops,
    loopDensity,
    maxLoopsAbsolute,
    loopLengthTarget,
    mergePolicyByRole,
    maxEdgeDistanceByRole,
    kNearestByRole,
    metadataName: debugOptions.name ?? options.name,
    seed: debugOptions.seed ?? options.seed,
  }
}

export function buildGenerationMetadata(context: GenerationContext, notes?: string) {
  return buildMetadata({ name: context.metadataName, seed: context.seed }, notes)
}

export function runPlacementStage(context: GenerationContext): { rooms: PlacedRoom[]; warning?: string } {
  const layout = buildGeneratedRoomsLayout({
    width: context.width,
    height: context.height,
    roomCount: context.roomCount,
    minRoomWidth: context.minRoomWidth,
    maxRoomWidth: context.maxRoomWidth,
    minRoomHeight: context.minRoomHeight,
    maxRoomHeight: context.maxRoomHeight,
    roomPadding: context.roomPadding,
    roomDispersion: context.roomDispersion,
    corridorWidth: context.corridorWidth,
    includeCorridors: false,
    maxCorridorSteps: context.maxCorridorSteps,
    extraConnectionCount: 0,
    seed: context.seed,
  })

  return {
    rooms: layout.rooms,
    warning: layout.warning,
  }
}

export function runRoutingStage(context: GenerationContext, rooms: PlacedRoom[], graph: RoomGraph): CorridorPlan {
  if (!context.includeCorridors) {
    return { corridors: [], doors: [] }
  }

  const routeHelpers = {
    getRoomConnectionPoint: roomConnectionPoint,
    buildRoomBlockedCells,
    pointKey,
    preferredDirectionForAxis,
    oppositeAxis,
    pickRoomExitPoint,
    buildDoorLead,
    findRoomAwareCorridorPath,
    findRouteTarget,
    corridorPolylineStepCount,
    corridorStepBudget,
    corridorPolylineCells,
    appendUniquePoints,
    buildCommittedCorridorClusters,
    trimDuplicateRoomEntries,
    optimizeParallelAdjacentCorridors,
    cleanupDoorsForCorridors,
    pruneClusterLoops,
    removeDuplicateDirectRoomPairs,
    buildRoomSpatialLookup,
    roomIndexForPoint,
  }

  let plan = buildGeneratedCorridorsAndDoorsModule(
    rooms,
    graph.connections,
    context,
    routeHelpers,
  )

  const finalHelpers = {
    buildRoomSpatialLookup,
    roomIndexForPoint,
    buildCorridorClusterAnalyses,
    buildRoomBlockedCells,
  }

  const hasOptionalLoops = graph.connections.some((connection) => connection.role === "optional-loop")
  if (hasOptionalLoops && !hasEligibleFinalLeafModule(rooms, plan.corridors, finalHelpers)) {
    plan = buildGeneratedCorridorsAndDoorsModule(
      rooms,
      graph.connections.filter((connection) => connection.role !== "optional-loop"),
      context,
      routeHelpers,
    )
  }

  return plan
}

export function runTopologyStage(rooms: PlacedRoom[], context: GenerationContext): RoomGraph {
  if (!context.includeCorridors) {
    return {
      startIndex: Math.max(0, rooms.findIndex((room) => room.kind === "start")),
      connections: [],
      mainPathRoomIndexes: [],
      branchRoomIndexes: [],
      leafCandidateIndexes: [],
      finalIndex: undefined,
    }
  }

  return buildRoomGraphPlanModule(rooms, context, {
    getRoomConnectionPoint: roomConnectionPoint,
    buildRoomSpatialLookup,
    roomIndexForPoint,
  })
}

export function runCleanupStage(
  context: GenerationContext,
  rooms: PlacedRoom[],
  plan: CorridorPlan,
  graph: RoomGraph,
) {
  const { corridors, doors } = plan
  if (!context.includeCorridors) {
    appendEntranceDoorForStartRoom(rooms, doors, context.width, context.height)
    return {
      rooms,
      corridors,
      doors,
    }
  }

  const graphHelpers = {
    getRoomConnectionPoint: roomConnectionPoint,
    buildRoomSpatialLookup,
    roomIndexForPoint,
  }
  const finalHelpers = {
    buildRoomSpatialLookup,
    roomIndexForPoint,
    buildCorridorClusterAnalyses,
    buildRoomBlockedCells,
  }
  const doorHelpers = {
    buildRoomSpatialLookup,
    roomIndexForPoint,
    compressPolylinePoints,
  }

  normalizeCorridorEndpointsToRoomsModule(rooms, corridors, doorHelpers)
  trimImmediateWallSlides(rooms, corridors)

  const realizedLeafCandidates = buildFinalLeafCandidatesModule(rooms, corridors, finalHelpers).candidates

  let finalIndex = pickBestFinalIndexModule(realizedLeafCandidates) ?? graph.finalIndex

  if (context.includeCorridors && finalIndex !== undefined) {
    const chosenCandidate = realizedLeafCandidates.find((candidate) => candidate.index === finalIndex)
    if (chosenCandidate?.touchesStartCluster) {
      const blockedRooms = buildRoomBlockedCells(rooms)
      if (finalIndex !== undefined) {
        const clonedCorridors = cloneCorridors(corridors)

        const isolatedChosen = isolateLeafCorridorCluster(
          rooms,
          clonedCorridors,
          blockedRooms,
          context.width,
          context.height,
          finalIndex,
          !context.allowCorridorIntersections,
        )
        if (isolatedChosen) {
          corridors.length = 0
          corridors.push(...clonedCorridors)
        }
      }

      const stillTouchingChosen = buildFinalLeafCandidatesModule(rooms, corridors, finalHelpers).candidates
        .find((candidate) => candidate.index === finalIndex)
        ?.touchesStartCluster

      if (!stillTouchingChosen) {
        // Keep farthest choice when we can isolate it.
      } else {
        for (const candidate of realizedLeafCandidates) {
          if (candidate.touchesStartCluster) continue
          const clonedCorridors = cloneCorridors(corridors)

          const isolated = isolateLeafCorridorCluster(
            rooms,
            clonedCorridors,
            blockedRooms,
            context.width,
            context.height,
            candidate.index,
            !context.allowCorridorIntersections,
          )
          if (!isolated) continue

          corridors.length = 0
          corridors.push(...clonedCorridors)
          finalIndex = candidate.index
          break
        }

        const refreshedCandidates = buildFinalLeafCandidatesModule(rooms, corridors, finalHelpers).candidates
        if (refreshedCandidates.find((candidate) => candidate.index === finalIndex)?.touchesStartCluster) {
          finalIndex = pickBestFinalIndexModule(refreshedCandidates) ?? finalIndex
        }
      }
    }
  }

  if (finalIndex !== undefined) {
    const startIndex = rooms.findIndex((room) => room.kind === "start")
    const directAdjacency = buildRoomAdjacencyByCorridorsModule(rooms, corridors, graphHelpers)
    const isDirectStartFinal = startIndex >= 0 && (directAdjacency.get(startIndex)?.has(finalIndex) ?? false)

    if (isDirectStartFinal) {
      const refreshedCandidates = buildFinalLeafCandidatesModule(rooms, corridors, finalHelpers).candidates
      const alternative = refreshedCandidates.find((candidate) => (
        candidate.index !== finalIndex
        && candidate.distance > 1
        && !(directAdjacency.get(startIndex)?.has(candidate.index) ?? false)
      ))

      if (alternative) {
        finalIndex = alternative.index
      }
    }
  }

  const finalizedRooms = assignFarthestFinalRoomModule(rooms, finalIndex)
  rebuildDoorsFromCorridorsModule(finalizedRooms, corridors, doors, doorHelpers)
  appendEntranceDoorForStartRoom(finalizedRooms, doors, context.width, context.height)

  return {
    rooms: finalizedRooms,
    corridors,
    doors,
  }
}

type GeneratedRoomsLayoutOptions = {
  width: number
  height: number
  roomCount: number
  roomPadding: number
  roomDispersion: number
  minRoomWidth: number
  maxRoomWidth: number
  minRoomHeight: number
  maxRoomHeight: number
  seed?: string | number
}

function buildGeneratedRoomsLayout(options: GeneratedRoomsLayoutOptions) {
  const rooms: DungeonRoom[] = []
  const roomCount = clampInteger(options.roomCount, 4, 0, 64)
  const roomPadding = clampInteger(options.roomPadding, 1, 0, 8)
  const random = createSeededRandom(options.seed)
  const attemptLimit = Math.max(24, roomCount * 18)
  const candidatesPerAttempt = 6
  const roomPlans = buildRoomPlanSequence(
    roomCount,
    random,
    options.minRoomWidth,
    options.maxRoomWidth,
    options.minRoomHeight,
    options.maxRoomHeight,
    options.width,
    options.height,
  )

  for (let roomIndex = 0; roomIndex < roomPlans.length; roomIndex += 1) {
    const plan = roomPlans[roomIndex]
    let bestCandidate: DungeonRoom | null = null
    let bestScore = Number.NEGATIVE_INFINITY

    for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
      for (let candidateIndex = 0; candidateIndex < candidatesPerAttempt; candidateIndex += 1) {
        const candidate = buildRoomCandidate(
          roomIndex,
          random,
          options.width,
          options.height,
          plan,
          options.minRoomWidth,
          options.maxRoomWidth,
          options.minRoomHeight,
          options.maxRoomHeight,
        )

        if (!candidate) {
          break
        }

        if (rooms.some((placed) => roomsOverlapWithPadding(candidate, placed, roomPadding))) {
          continue
        }

        const score = scoreRoomCandidate(candidate, rooms, options.width, options.height, plan.archetype, options.roomDispersion)
        if (score > bestScore) {
          bestCandidate = candidate
          bestScore = score
        }
      }
    }

    if (!bestCandidate) {
      break
    }

    rooms.push(bestCandidate)
  }

  const startRoomIndex = pickStartRoomIndex(rooms, options.width, options.height)

  if (startRoomIndex >= 0) {
    rooms[startRoomIndex] = {
      ...rooms[startRoomIndex],
      kind: "start",
      label: "Inicio",
    }
  }

  if (rooms.length >= 1) {
    for (let index = 0; index < rooms.length; index += 1) {
      if (index === startRoomIndex) continue
      rooms[index] = {
        ...rooms[index],
        kind: "room",
        label: `Sala ${index + 1}`,
      }
    }
  }

  const warning = rooms.length < roomCount
    ? `Solo se pudieron ubicar ${rooms.length} de ${roomCount} salas con el padding solicitado.`
    : undefined

  return {
    rooms,
    corridors: [],
    doors: [],
    warning,
  }
}

function cloneCorridors(corridors: DungeonCorridor[]): DungeonCorridor[] {
  return corridors.map((corridor) => ({
    id: corridor.id,
    points: corridor.points.map((point) => ({ ...point })),
    width: corridor.width,
  }))
}
