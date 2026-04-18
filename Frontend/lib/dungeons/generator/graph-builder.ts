import type { DungeonCorridor, DungeonRoom } from "../types.ts"
import type { GenerationContext, PlacedRoom, RoomConnection, RoomGraph } from "./core.ts"
import {
  buildKNearestNeighborEdgeKeys,
  buildRoomEdges,
  buildSpanningEdges,
  edgeKey,
  filterEdgesByMaxDistance,
  kNearestForRole,
  maxEdgeDistanceForRole,
  type RoomEdge,
  type RoomNode,
} from "./edge-selection.ts"

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function resolveAdaptiveLoopTarget(context: GenerationContext, roomCount: number) {
  const baseLoops = context.extraConnectionCount
  if (!context.adaptiveLoops) return baseLoops

  const area = context.width * context.height
  const areaFactor = clampNumber(Math.sqrt(area / (48 * 32)), 0.7, 2.4)
  const roomFactor = clampNumber(roomCount / 8, 0.65, 2.5)
  const densityFactor = context.loopDensity === "low"
    ? 0.7
    : context.loopDensity === "high"
      ? 1.55
      : 1
  const motifFactor = context.topologyMotif === "linear"
    ? 0.65
    : context.topologyMotif === "braided"
      ? 1.45
      : context.topologyMotif === "labyrinth-lite"
        ? 1.3
        : context.topologyMotif === "hub-spoke"
          ? 1.1
          : 1

  const blendedMotifFactor = 1 + (motifFactor - 1) * context.motifStrength
  const adaptiveBase = Math.max(1, Math.round(baseLoops * densityFactor * areaFactor * roomFactor * blendedMotifFactor))
  const capByRoomCount = Math.max(0, Math.floor(roomCount / 2))
  const hardCap = context.maxLoopsAbsolute ?? capByRoomCount

  return Math.min(adaptiveBase, hardCap)
}

function buildMainPathPositionIndex(mainPathRoomIndexes: number[]) {
  const indexByRoom = new Map<number, number>()
  for (let index = 0; index < mainPathRoomIndexes.length; index += 1) {
    indexByRoom.set(mainPathRoomIndexes[index], index)
  }
  return indexByRoom
}

function loopCandidateScore(
  edge: RoomEdge,
  maxDistance: number,
  context: GenerationContext,
  adjacency: Map<number, Set<number>>,
  mainPathPositionByRoom: Map<number, number>,
) {
  const normalizedDistance = maxDistance <= 0 ? 0 : edge.distance / maxDistance
  const loopLengthScore = context.loopLengthTarget === "short"
    ? 1 - normalizedDistance
    : context.loopLengthTarget === "long"
      ? normalizedDistance
      : 1 - Math.abs(normalizedDistance - 0.45)

  const fromDegree = adjacency.get(edge.fromIndex)?.size ?? 0
  const toDegree = adjacency.get(edge.toIndex)?.size ?? 0
  const avgDegree = (fromDegree + toDegree) / 2
  const fromMainPos = mainPathPositionByRoom.get(edge.fromIndex)
  const toMainPos = mainPathPositionByRoom.get(edge.toIndex)
  const touchesMainPath = fromMainPos !== undefined || toMainPos !== undefined
  const bothMainPath = fromMainPos !== undefined && toMainPos !== undefined
  const mainPathGap = bothMainPath && fromMainPos !== undefined && toMainPos !== undefined
    ? Math.abs(fromMainPos - toMainPos)
    : 0

  const motifBonus = context.topologyMotif === "linear"
    ? -0.45 * normalizedDistance - (touchesMainPath ? 0.1 : 0.35)
    : context.topologyMotif === "braided"
      ? (touchesMainPath ? 0.55 : 0.25) + Math.min(mainPathGap / 8, 0.4)
      : context.topologyMotif === "hub-spoke"
        ? Math.max(0, (avgDegree - 1) * 0.25)
        : context.topologyMotif === "labyrinth-lite"
          ? (touchesMainPath ? 0.15 : 0.45) + Math.max(0, (2 - avgDegree) * 0.2)
          : 0.2 + (touchesMainPath ? 0.15 : 0)

  return loopLengthScore + motifBonus
}

type GraphBuilderHelpers = {
  getRoomConnectionPoint: (room: DungeonRoom) => { x: number; y: number }
  buildRoomSpatialLookup: (rooms: DungeonRoom[]) => { roomIndexByCell: Map<string, number> }
  roomIndexForPoint: (lookup: { roomIndexByCell: Map<string, number> }, point: { x: number; y: number }) => number
}

export function buildRoomAdjacencyByCorridors(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  helpers: GraphBuilderHelpers,
) {
  const adjacency = new Map<number, Set<number>>()
  const roomLookup = helpers.buildRoomSpatialLookup(rooms)

  for (const corridor of corridors) {
    const startRoom = helpers.roomIndexForPoint(roomLookup, corridor.points[0])
    const endRoom = helpers.roomIndexForPoint(roomLookup, corridor.points[corridor.points.length - 1])
    if (startRoom < 0 || endRoom < 0 || startRoom === endRoom) continue

    const startNeighbors = adjacency.get(startRoom) ?? new Set<number>()
    const endNeighbors = adjacency.get(endRoom) ?? new Set<number>()
    startNeighbors.add(endRoom)
    endNeighbors.add(startRoom)
    adjacency.set(startRoom, startNeighbors)
    adjacency.set(endRoom, endNeighbors)
  }

  return adjacency
}

export function buildRoomComponents(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  helpers: GraphBuilderHelpers,
) {
  const adjacency = buildRoomAdjacencyByCorridors(rooms, corridors, helpers)
  const componentByRoom = new Map<number, number>()
  let nextComponentId = 0

  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    if (componentByRoom.has(roomIndex)) continue

    const queue = [roomIndex]
    componentByRoom.set(roomIndex, nextComponentId)

    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined) break

      for (const neighbor of adjacency.get(current) ?? []) {
        if (componentByRoom.has(neighbor)) continue
        componentByRoom.set(neighbor, nextComponentId)
        queue.push(neighbor)
      }
    }

    nextComponentId += 1
  }

  return componentByRoom
}

export function edgeListToAdjacency(roomCount: number, edges: Array<{ fromIndex: number; toIndex: number }>) {
  const adjacency = new Map<number, Set<number>>()
  for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
    adjacency.set(roomIndex, new Set<number>())
  }

  for (const edge of edges) {
    adjacency.get(edge.fromIndex)?.add(edge.toIndex)
    adjacency.get(edge.toIndex)?.add(edge.fromIndex)
  }

  return adjacency
}

export function roomPathInTree(startIndex: number, targetIndex: number, adjacency: Map<number, Set<number>>) {
  const queue = [startIndex]
  const visited = new Set<number>(queue)
  const previous = new Map<number, number | null>()
  previous.set(startIndex, null)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (current === targetIndex) break

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      previous.set(neighbor, current)
      queue.push(neighbor)
    }
  }

  if (!previous.has(targetIndex)) return []

  const path: number[] = []
  let current: number | null = targetIndex
  while (current !== null) {
    path.push(current)
    current = previous.get(current) ?? null
  }
  path.reverse()
  return path
}

export function chooseFarthestLeafFromStart(startIndex: number, adjacency: Map<number, Set<number>>) {
  const queue = [startIndex]
  const visited = new Set<number>(queue)
  const distanceByRoom = new Map<number, number>([[startIndex, 0]])

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      distanceByRoom.set(neighbor, (distanceByRoom.get(current) ?? 0) + 1)
      queue.push(neighbor)
    }
  }

  const leaves = [...adjacency.entries()]
    .filter(([roomIndex, neighbors]) => roomIndex !== startIndex && neighbors.size <= 1)
    .map(([roomIndex]) => roomIndex)

  const rankedLeaves = (leaves.length > 0 ? leaves : [...adjacency.keys()].filter((roomIndex) => roomIndex !== startIndex))
    .filter((roomIndex) => Number.isFinite(distanceByRoom.get(roomIndex)))
    .sort((first, second) => {
      const firstDistance = distanceByRoom.get(first) ?? Number.NEGATIVE_INFINITY
      const secondDistance = distanceByRoom.get(second) ?? Number.NEGATIVE_INFINITY
      if (firstDistance !== secondDistance) return secondDistance - firstDistance
      return second - first
    })

  return {
    finalIndex: rankedLeaves[0],
    leafIndexes: rankedLeaves,
  }
}

export function buildRoomGraphPlan(
  rooms: PlacedRoom[],
  context: GenerationContext,
  helpers: GraphBuilderHelpers,
): RoomGraph {
  const nodes: RoomNode[] = rooms.map((room, index) => ({ index, center: helpers.getRoomConnectionPoint(room) }))
  const startIndex = Math.max(0, rooms.findIndex((room) => room.kind === "start"))

  if (nodes.length <= 1) {
    return {
      startIndex,
      connections: [],
      mainPathRoomIndexes: [startIndex],
      branchRoomIndexes: [],
      leafCandidateIndexes: [],
      finalIndex: undefined,
    }
  }

  const edgeByKey = new Map<string, RoomEdge>()
  for (const edge of buildRoomEdges(nodes)) {
    edgeByKey.set(edgeKey(edge.fromIndex, edge.toIndex), edge)
  }

  const mainPathLocalKeys = buildKNearestNeighborEdgeKeys(nodes, kNearestForRole(context, "main-path"))
  const branchLocalKeys = buildKNearestNeighborEdgeKeys(nodes, kNearestForRole(context, "branch"))
  const serviceLocalKeys = buildKNearestNeighborEdgeKeys(nodes, kNearestForRole(context, "service/dead-end"))
  const normalLocalKeys = new Set<string>([...branchLocalKeys, ...serviceLocalKeys])
  const strictLocalEdges = filterEdgesByMaxDistance(
    buildRoomEdges(nodes, (fromIndex, toIndex) => mainPathLocalKeys.has(edgeKey(fromIndex, toIndex))),
    maxEdgeDistanceForRole(context, "main-path"),
  )
  const normalLocalEdges = filterEdgesByMaxDistance(
    buildRoomEdges(nodes, (fromIndex, toIndex) => normalLocalKeys.has(edgeKey(fromIndex, toIndex))),
    Math.max(maxEdgeDistanceForRole(context, "branch"), maxEdgeDistanceForRole(context, "service/dead-end")),
  )
  const globalFallbackEdges = buildRoomEdges(nodes, (fromIndex, toIndex) => !normalLocalKeys.has(edgeKey(fromIndex, toIndex)))

  const strictForestEdges = buildSpanningEdges(nodes, strictLocalEdges)
  const strictAdjacency = edgeListToAdjacency(nodes.length, strictForestEdges)
  const farthestMainLeaf = chooseFarthestLeafFromStart(startIndex, strictAdjacency)
  const mainPathRoomIndexes = farthestMainLeaf.finalIndex === undefined
    ? [startIndex]
    : roomPathInTree(startIndex, farthestMainLeaf.finalIndex, strictAdjacency)

  const mainPathEdges = new Set<string>()
  const treeEdges: RoomEdge[] = []
  for (let index = 1; index < mainPathRoomIndexes.length; index += 1) {
    const key = edgeKey(mainPathRoomIndexes[index - 1], mainPathRoomIndexes[index])
    mainPathEdges.add(key)
    const edge = edgeByKey.get(key)
    if (edge) treeEdges.push(edge)
  }

  const connectedRooms = new Set<number>(mainPathRoomIndexes)
  if (connectedRooms.size === 0) connectedRooms.add(startIndex)

  const connectRemainingRooms = (candidateEdges: RoomEdge[]) => {
    let madeProgress = false

    while (connectedRooms.size < nodes.length) {
      const nextEdge = candidateEdges.find((edge) => connectedRooms.has(edge.fromIndex) !== connectedRooms.has(edge.toIndex))
      if (!nextEdge) break

      const key = edgeKey(nextEdge.fromIndex, nextEdge.toIndex)
      if (!mainPathEdges.has(key) && !treeEdges.some((edge) => edgeKey(edge.fromIndex, edge.toIndex) === key)) {
        treeEdges.push(nextEdge)
      }
      connectedRooms.add(nextEdge.fromIndex)
      connectedRooms.add(nextEdge.toIndex)
      madeProgress = true
    }

    return madeProgress
  }

  connectRemainingRooms(normalLocalEdges)
  while (connectedRooms.size < nodes.length && connectRemainingRooms(globalFallbackEdges)) {
    // Keep global edges strictly as a last-resort reconnect for isolated rooms.
  }

  const adjacency = edgeListToAdjacency(nodes.length, treeEdges)
  const farthestLeaf = chooseFarthestLeafFromStart(startIndex, adjacency)

  const branchRoomIndexes = new Set<number>()
  const connections: RoomConnection[] = treeEdges.map((edge) => {
    const role = mainPathEdges.has(edgeKey(edge.fromIndex, edge.toIndex))
      ? "main-path"
      : (adjacency.get(edge.toIndex)?.size ?? 0) <= 1 || (adjacency.get(edge.fromIndex)?.size ?? 0) <= 1
        ? "service/dead-end"
        : "branch"

    if (role === "branch" || role === "service/dead-end") {
      branchRoomIndexes.add(edge.fromIndex)
      branchRoomIndexes.add(edge.toIndex)
    }

    return {
      fromIndex: edge.fromIndex,
      toIndex: edge.toIndex,
      role,
    }
  })

  const targetLoopCount = resolveAdaptiveLoopTarget(context, nodes.length)
  if (targetLoopCount > 0) {
    const existing = new Set(connections.map((connection) => edgeKey(connection.fromIndex, connection.toIndex)))
    const loopLocalKeys = buildKNearestNeighborEdgeKeys(nodes, kNearestForRole(context, "optional-loop"))
    const optionalLoopMaxDistance = maxEdgeDistanceForRole(context, "optional-loop")
    const mainPathPositionByRoom = buildMainPathPositionIndex(mainPathRoomIndexes)
    const loopCandidates = filterEdgesByMaxDistance(
      buildRoomEdges(nodes, (fromIndex, toIndex) => loopLocalKeys.has(edgeKey(fromIndex, toIndex))),
      optionalLoopMaxDistance,
    )
      .filter((edge) => !existing.has(edgeKey(edge.fromIndex, edge.toIndex)))
      .map((edge) => ({
        edge,
        score: loopCandidateScore(edge, optionalLoopMaxDistance, context, adjacency, mainPathPositionByRoom),
      }))
      .sort((first, second) => {
        if (first.score !== second.score) return second.score - first.score
        return first.edge.distance - second.edge.distance
      })

    for (const candidate of loopCandidates) {
      if (connections.filter((connection) => connection.role === "optional-loop").length >= targetLoopCount) break
      connections.push({
        fromIndex: candidate.edge.fromIndex,
        toIndex: candidate.edge.toIndex,
        role: "optional-loop",
      })
    }
  }

  return {
    startIndex,
    connections,
    mainPathRoomIndexes,
    branchRoomIndexes: [...branchRoomIndexes],
    leafCandidateIndexes: farthestLeaf.leafIndexes,
    finalIndex: farthestLeaf.finalIndex,
  }
}
