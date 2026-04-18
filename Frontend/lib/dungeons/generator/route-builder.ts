import type {
  DungeonCorridor,
  DungeonDoor,
  DungeonDoorDirection,
  DungeonMapPoint,
  DungeonRoom,
} from "../types.ts"
import type { ConnectionRole, GenerationContext, RoomConnection } from "./core.ts"
import {
  buildClosestCrossComponentEdges,
  buildKNearestNeighborEdgeKeys,
  buildRoomEdges,
  canMergeForRole,
  edgeKey,
  filterEdgesByMaxDistance,
  kNearestForRole,
  maxEdgeDistanceForRole,
  type PlannedConnectionEdge,
  type RoomNode,
} from "./edge-selection.ts"
import { buildRoomComponents } from "./graph-builder.ts"

type CorridorAxis = "horizontal" | "vertical"
type CorridorCellAxis = "horizontal" | "vertical"

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

type RouteBuilderHelpers = {
  getRoomConnectionPoint: (room: DungeonRoom) => DungeonMapPoint
  buildRoomBlockedCells: (rooms: DungeonRoom[]) => Set<string>
  pointKey: (point: DungeonMapPoint) => string
  preferredDirectionForAxis: (source: DungeonMapPoint, target: DungeonMapPoint, axis: CorridorAxis) => DungeonDoorDirection
  oppositeAxis: (axis: CorridorAxis) => CorridorAxis
  pickRoomExitPoint: (room: DungeonRoom, target: DungeonMapPoint, options: {
    preferredDirection: DungeonDoorDirection
    axis: CorridorAxis
    blockedRooms?: Set<string>
    blockedCorridors?: Set<string>
    mapWidth?: number
    mapHeight?: number
    connectionRole?: ConnectionRole
  }) => RoomExitSelection
  buildDoorLead: (
    start: DungeonMapPoint,
    direction: DungeonDoorDirection,
    blocked: Set<string>,
    mapWidth: number,
    mapHeight: number,
    length: number,
  ) => DungeonMapPoint[]
  findRoomAwareCorridorPath: (
    start: DungeonMapPoint,
    end: DungeonMapPoint,
    blockedRooms: Set<string>,
    mapWidth: number,
    mapHeight: number,
    blockedCorridors?: Set<string>,
    allowedCorridors?: Set<string>,
    blockedRouteCells?: Set<string>,
  ) => DungeonMapPoint[] | null
  findRouteTarget: (
    start: DungeonMapPoint,
    preferredEnd: DungeonMapPoint,
    mergeCandidates: DungeonMapPoint[],
    blockedRooms: Set<string>,
    blockedCorridors: Set<string>,
    allowedCorridorCells: Set<string>,
    mapWidth: number,
    mapHeight: number,
    preferMergeTarget: boolean,
    blockedRouteCells: Set<string>,
    maxCorridorSteps: number,
  ) => { path: DungeonMapPoint[] | null; target: DungeonMapPoint | null }
  corridorPolylineStepCount: (points: DungeonMapPoint[]) => number
  corridorStepBudget: (start: DungeonMapPoint, end: DungeonMapPoint, mapWidth: number, mapHeight: number, maxCorridorSteps: number) => number
  corridorPolylineCells: (points: DungeonMapPoint[], blockedRooms: Set<string>) => DungeonMapPoint[]
  appendUniquePoints: (points: DungeonMapPoint[], extraPoints: DungeonMapPoint[]) => void
  buildCommittedCorridorClusters: (committedCorridors: CommittedCorridor[]) => CorridorCluster[]
  trimDuplicateRoomEntries: (corridors: DungeonCorridor[], doors: DungeonDoor[], rooms: DungeonRoom[], blockedCells: Set<string>) => void
  optimizeParallelAdjacentCorridors: (corridors: DungeonCorridor[], blockedCells: Set<string>, mapWidth: number, mapHeight: number) => boolean
  cleanupDoorsForCorridors: (corridors: DungeonCorridor[], doors: DungeonDoor[]) => void
  pruneClusterLoops: (corridors: DungeonCorridor[], doors: DungeonDoor[], rooms: DungeonRoom[], blockedCells: Set<string>) => void
  removeDuplicateDirectRoomPairs: (corridors: DungeonCorridor[], doors: DungeonDoor[], rooms: DungeonRoom[]) => void
  buildRoomSpatialLookup: (rooms: DungeonRoom[]) => { roomIndexByCell: Map<string, number> }
  roomIndexForPoint: (lookup: { roomIndexByCell: Map<string, number> }, point: DungeonMapPoint) => number
}

function corridorDistance(first: DungeonMapPoint, second: DungeonMapPoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}

function buildCorridorOrientationMap(
  corridors: DungeonCorridor[],
  blockedRooms: Set<string>,
  helpers: Pick<RouteBuilderHelpers, "pointKey">,
) {
  const orientations = new Map<string, Set<CorridorCellAxis>>()

  for (const corridor of corridors) {
    for (let index = 1; index < corridor.points.length; index += 1) {
      const previous = corridor.points[index - 1]
      const current = corridor.points[index]

      if (previous.x === current.x) {
        const step = previous.y <= current.y ? 1 : -1
        for (let y = previous.y; y !== current.y + step; y += step) {
          if (index > 1 && y === previous.y) continue
          const key = helpers.pointKey({ x: previous.x, y })
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
          const key = helpers.pointKey({ x, y: previous.y })
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
  helpers: Pick<RouteBuilderHelpers, "corridorPolylineCells" | "pointKey">,
) {
  const expanded = helpers.corridorPolylineCells(path, blockedRooms)
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
          orientationMap.get(helpers.pointKey({ x: current.x, y: current.y - 1 })),
          orientationMap.get(helpers.pointKey({ x: current.x, y: current.y + 1 })),
        ]
      : [
          orientationMap.get(helpers.pointKey({ x: current.x - 1, y: current.y })),
          orientationMap.get(helpers.pointKey({ x: current.x + 1, y: current.y })),
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

export function buildGeneratedCorridorsAndDoors(
  rooms: DungeonRoom[],
  roomConnections: RoomConnection[],
  context: GenerationContext,
  helpers: RouteBuilderHelpers,
): { corridors: DungeonCorridor[]; doors: DungeonDoor[] } {
  if (rooms.length < 2) return { corridors: [], doors: [] }

  const corridorWidth = context.corridorWidth
  const mapWidth = context.width
  const mapHeight = context.height
  const maxCorridorSteps = context.maxCorridorSteps
  const nodes: Array<RoomNode & { room: DungeonRoom }> = rooms.map((room, index) => ({ index, room, center: helpers.getRoomConnectionPoint(room) }))
  const blockedCells = helpers.buildRoomBlockedCells(rooms)
  const rolePriority: Record<ConnectionRole, number> = {
    "main-path": 0,
    branch: 1,
    "service/dead-end": 2,
    "optional-loop": 3,
  }
  const edges: PlannedConnectionEdge[] = roomConnections
    .map((connection) => {
      const fromNode = nodes[connection.fromIndex]
      const toNode = nodes[connection.toIndex]
      return {
        fromIndex: connection.fromIndex,
        toIndex: connection.toIndex,
        distance: corridorDistance(fromNode.center, toNode.center),
        role: connection.role,
      }
    })
    .sort((first, second) => {
      const roleDiff = rolePriority[first.role] - rolePriority[second.role]
      if (roleDiff !== 0) return roleDiff
      if (first.distance !== second.distance) return first.distance - second.distance
      return edgeKey(first.fromIndex, first.toIndex).localeCompare(edgeKey(second.fromIndex, second.toIndex))
    })

  const corridors: DungeonCorridor[] = []
  const doors: DungeonDoor[] = []
  const roomSideExitByKey = new Map<string, RoomSideExit>()
  const doorIdByRoomSide = new Map<string, string>()
  const committedCorridors: CommittedCorridor[] = []
  const committedCorridorCells = new Set<string>()

  const attemptEdge = (edge: PlannedConnectionEdge) => {
    const orientationMap = buildCorridorOrientationMap(corridors, blockedCells, helpers)
    const committedClusters = helpers.buildCommittedCorridorClusters(committedCorridors)
    const fromNode = nodes[edge.fromIndex]
    const toNode = nodes[edge.toIndex]
    const centerDeltaX = Math.abs(fromNode.center.x - toNode.center.x)
    const centerDeltaY = Math.abs(fromNode.center.y - toNode.center.y)
    const primaryAxis: CorridorAxis = centerDeltaX >= centerDeltaY ? "horizontal" : "vertical"
    const fromDirection = helpers.preferredDirectionForAxis(fromNode.center, toNode.center, primaryAxis)
    const fromWallKey = `${fromNode.room.id}:${fromDirection}`
    const sourceCluster = committedClusters.find((cluster) => cluster.roomSideKeys.has(fromWallKey))
    const reusableDestinationCluster = committedClusters.find((cluster) => (
      cluster.roomIds.has(toNode.room.id)
      && !cluster.roomIds.has(fromNode.room.id)
      && !cluster.roomSideKeys.has(fromWallKey)
    ))

    const centersAligned = fromNode.center.x === toNode.center.x || fromNode.center.y === toNode.center.y
    const endAxis: CorridorAxis = centersAligned ? primaryAxis : helpers.oppositeAxis(primaryAxis)
    const toDirection = helpers.preferredDirectionForAxis(toNode.center, fromNode.center, endAxis)
    const reusedToWallKey = reusableDestinationCluster
      ? [...reusableDestinationCluster.roomSideKeys].find((roomSideKey) => roomSideKey.startsWith(`${toNode.room.id}:`))
      : undefined
    const toWallKey = reusedToWallKey ?? `${toNode.room.id}:${toDirection}`

    let fromSideExit = roomSideExitByKey.get(fromWallKey)
    if (!fromSideExit) {
      const fromExit = helpers.pickRoomExitPoint(fromNode.room, toNode.center, {
        preferredDirection: fromDirection,
        axis: primaryAxis,
        blockedRooms: blockedCells,
        blockedCorridors: committedCorridorCells,
        mapWidth,
        mapHeight,
        connectionRole: edge.role,
      })
      const fromLead = helpers.buildDoorLead(fromExit.point, fromExit.direction, blockedCells, mapWidth, mapHeight, 1)
      fromSideExit = { exit: fromExit, lead: fromLead, hub: fromLead[fromLead.length - 1] }
      roomSideExitByKey.set(fromWallKey, fromSideExit)
    }

    let toSideExit = roomSideExitByKey.get(toWallKey)
    if (!toSideExit) {
      const toExit = helpers.pickRoomExitPoint(toNode.room, fromNode.center, {
        preferredDirection: toDirection,
        axis: endAxis,
        blockedRooms: blockedCells,
        blockedCorridors: committedCorridorCells,
        mapWidth,
        mapHeight,
        connectionRole: edge.role,
      })
      const toLead = helpers.buildDoorLead(toExit.point, toExit.direction, blockedCells, mapWidth, mapHeight, 1)
      toSideExit = { exit: toExit, lead: toLead, hub: toLead[toLead.length - 1] }
      roomSideExitByKey.set(toWallKey, toSideExit)
    }

    const fromLead = fromSideExit.lead
    const toLead = toSideExit.lead
    const fromLeadEnd = fromLead[fromLead.length - 1]
    const toLeadEnd = toLead[toLead.length - 1]
    const fromHub = fromSideExit.hub
    const toHub = toSideExit.hub

    const fromJoin = fromHub.x === fromLeadEnd.x && fromHub.y === fromLeadEnd.y
      ? [fromLeadEnd]
      : helpers.findRoomAwareCorridorPath(fromLeadEnd, fromHub, blockedCells, mapWidth, mapHeight)
    const toJoin = toHub.x === toLeadEnd.x && toHub.y === toLeadEnd.y
      ? [toLeadEnd]
      : helpers.findRoomAwareCorridorPath(toLeadEnd, toHub, blockedCells, mapWidth, mapHeight)
    if (!fromJoin || !toJoin) return false

    const routeStart = fromHub
    const routeEnd = toHub
    const canMergeIntoCluster = canMergeForRole(context, edge.role)
    const destinationClusters = canMergeIntoCluster
      ? committedClusters.filter((cluster) => (
        cluster.roomIds.has(toNode.room.id)
        && !cluster.roomIds.has(fromNode.room.id)
        && !cluster.roomSideKeys.has(fromWallKey)
        && !(sourceCluster && [...sourceCluster.roomIds].some((roomId) => cluster.roomIds.has(roomId)))
      ))
      : []
    const targetWallClusters = destinationClusters.filter((cluster) => cluster.roomSideKeys.has(toWallKey))
    const mergeCandidates = (targetWallClusters.length > 0 ? targetWallClusters : destinationClusters).flatMap((cluster) => cluster.cells)
    const allowedCorridorCells = new Set<string>([
      helpers.pointKey(routeStart),
      helpers.pointKey(routeEnd),
      ...mergeCandidates.map(helpers.pointKey),
    ])
    const blockedRouteCells = new Set<string>([
      ...fromLead.slice(0, -1).map(helpers.pointKey),
      ...toLead.slice(0, -1).map(helpers.pointKey),
    ])
    const resolvedRoute = helpers.findRouteTarget(
      routeStart,
      routeEnd,
      mergeCandidates,
      blockedCells,
      committedCorridorCells,
      allowedCorridorCells,
      mapWidth,
      mapHeight,
      targetWallClusters.length > 0,
      blockedRouteCells,
      maxCorridorSteps,
    )
    if (!resolvedRoute.path) return false

    const points: DungeonMapPoint[] = [...fromLead]
    helpers.appendUniquePoints(points, fromJoin)
    helpers.appendUniquePoints(points, resolvedRoute.path)
    const resolvedTarget = resolvedRoute.target as DungeonMapPoint | null
    if (!resolvedTarget || (resolvedTarget.x === routeEnd.x && resolvedTarget.y === routeEnd.y)) {
      helpers.appendUniquePoints(points, [...toJoin].reverse())
      helpers.appendUniquePoints(points, [...toLead].reverse().slice(1))
    }

    const finalPathSteps = helpers.corridorPolylineStepCount(points)
    const allowedFinalSteps = helpers.corridorStepBudget(fromNode.center, toNode.center, mapWidth, mapHeight, maxCorridorSteps)
    if (finalPathSteps > allowedFinalSteps) return false

    if (hasParallelAdjacentRun(points, orientationMap, blockedCells, helpers)) return false

    const corridorId = `corr-${corridors.length + 1}`
    corridors.push({ id: corridorId, points, width: corridorWidth })
    const corridorCells = helpers.corridorPolylineCells(points, blockedCells)
    committedCorridors.push({
      id: corridorId,
      points,
      roomIds: [fromNode.room.id, toNode.room.id],
      roomSideKeys: [fromWallKey, toWallKey],
      cells: corridorCells,
    })
    for (const cell of corridorCells) {
      committedCorridorCells.add(helpers.pointKey(cell))
    }

    if (!doorIdByRoomSide.has(fromWallKey)) {
      const doorId = `door-${doors.length + 1}`
      doors.push({
        id: doorId,
        x: fromSideExit.exit.point.x,
        y: fromSideExit.exit.point.y,
        direction: fromSideExit.exit.direction,
        kind: "door",
      })
      doorIdByRoomSide.set(fromWallKey, doorId)
    }

    if (!doorIdByRoomSide.has(toWallKey)) {
      const doorId = `door-${doors.length + 1}`
      doors.push({
        id: doorId,
        x: toSideExit.exit.point.x,
        y: toSideExit.exit.point.y,
        direction: toSideExit.exit.direction,
        kind: "door",
      })
      doorIdByRoomSide.set(toWallKey, doorId)
    }

    return true
  }

  for (const edge of edges) {
    attemptEdge(edge)
  }

  const localReconnectionEdgeKeys = buildKNearestNeighborEdgeKeys(nodes, kNearestForRole(context, "service/dead-end"))
  const localReconnectionEdges = buildRoomEdges(nodes, (fromIndex, toIndex) => localReconnectionEdgeKeys.has(edgeKey(fromIndex, toIndex)))
  const boundedLocalReconnectionEdges = filterEdgesByMaxDistance(
    localReconnectionEdges,
    maxEdgeDistanceForRole(context, "service/dead-end"),
  )
  const fallbackReconnectionCandidates: PlannedConnectionEdge[] = buildRoomEdges(nodes).map((edge) => ({ ...edge, role: "service/dead-end" }))

  while (true) {
    const components = buildRoomComponents(rooms, corridors, helpers)
    const uniqueComponents = new Set(components.values())
    if (uniqueComponents.size <= 1) break

    let connected = false
    const reconnectionCandidates = buildClosestCrossComponentEdges(
      components,
      boundedLocalReconnectionEdges,
      "service/dead-end",
    )

    for (const edge of reconnectionCandidates) {
      if (components.get(edge.fromIndex) === components.get(edge.toIndex)) continue
      if (attemptEdge(edge)) {
        connected = true
        break
      }
    }

    if (!connected) {
      for (const edge of fallbackReconnectionCandidates) {
        if (components.get(edge.fromIndex) === components.get(edge.toIndex)) continue
        if (attemptEdge(edge)) {
          connected = true
          break
        }
      }
    }

    if (!connected) break
  }

  helpers.trimDuplicateRoomEntries(corridors, doors, rooms, blockedCells)
  const optimizedParallelRuns = helpers.optimizeParallelAdjacentCorridors(corridors, blockedCells, mapWidth, mapHeight)
  if (optimizedParallelRuns) {
    helpers.cleanupDoorsForCorridors(corridors, doors)
  }
  helpers.pruneClusterLoops(corridors, doors, rooms, blockedCells)
  helpers.removeDuplicateDirectRoomPairs(corridors, doors, rooms)

  return { corridors, doors }
}
