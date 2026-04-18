import type { DungeonMapPoint } from "../types.ts"
import type { ConnectionRole, GenerationContext } from "./core.ts"

export type RoomNode = {
  index: number
  center: DungeonMapPoint
}

export type RoomEdge = {
  fromIndex: number
  toIndex: number
  distance: number
}

export type PlannedConnectionEdge = RoomEdge & {
  role: ConnectionRole
}

function corridorDistance(first: DungeonMapPoint, second: DungeonMapPoint) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y)
}

export function maxEdgeDistanceForRole(context: GenerationContext, role: ConnectionRole) {
  return context.maxEdgeDistanceByRole[role]
}

export function kNearestForRole(context: GenerationContext, role: ConnectionRole) {
  return context.kNearestByRole[role]
}

export function canMergeForRole(context: GenerationContext, role: ConnectionRole) {
  return context.mergePolicyByRole[role]
}

export function edgeKey(firstIndex: number, secondIndex: number) {
  const min = Math.min(firstIndex, secondIndex)
  const max = Math.max(firstIndex, secondIndex)
  return `${min}-${max}`
}

export function compareRoomEdges(first: RoomEdge, second: RoomEdge) {
  if (first.distance !== second.distance) return first.distance - second.distance
  if (first.fromIndex !== second.fromIndex) return first.fromIndex - second.fromIndex
  return first.toIndex - second.toIndex
}

export function buildRoomEdges(nodes: RoomNode[], canUse?: (fromIndex: number, toIndex: number) => boolean) {
  const edges: RoomEdge[] = []
  for (let firstIndex = 0; firstIndex < nodes.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < nodes.length; secondIndex += 1) {
      if (canUse && !canUse(firstIndex, secondIndex)) continue
      edges.push({
        fromIndex: firstIndex,
        toIndex: secondIndex,
        distance: corridorDistance(nodes[firstIndex].center, nodes[secondIndex].center),
      })
    }
  }
  edges.sort(compareRoomEdges)
  return edges
}

export function buildKNearestNeighborEdgeKeys(nodes: RoomNode[], neighborCount: number) {
  const keys = new Set<string>()
  const cappedNeighborCount = Math.max(1, Math.min(neighborCount, Math.max(1, nodes.length - 1)))

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const nearest = nodes
      .map((_, otherIndex) => {
        if (otherIndex === nodeIndex) return null
        return {
          otherIndex,
          distance: corridorDistance(nodes[nodeIndex].center, nodes[otherIndex].center),
        }
      })
      .filter((edge): edge is { otherIndex: number; distance: number } => edge !== null)
      .sort((first, second) => {
        if (first.distance !== second.distance) return first.distance - second.distance
        return first.otherIndex - second.otherIndex
      })

    for (const edge of nearest.slice(0, cappedNeighborCount)) {
      keys.add(edgeKey(nodeIndex, edge.otherIndex))
    }
  }

  return keys
}

export function filterEdgesByMaxDistance(edges: RoomEdge[], maxDistance: number) {
  return edges.filter((edge) => edge.distance <= maxDistance)
}

export function buildClosestCrossComponentEdges(
  components: Map<number, number>,
  candidateEdges: RoomEdge[],
  role: ConnectionRole,
) {
  const closestByComponentPair = new Map<string, PlannedConnectionEdge>()

  for (const edge of candidateEdges) {
    const firstComponent = components.get(edge.fromIndex)
    const secondComponent = components.get(edge.toIndex)
    if (firstComponent === undefined || secondComponent === undefined || firstComponent === secondComponent) continue

    const pairKey = edgeKey(firstComponent, secondComponent)
    const current = closestByComponentPair.get(pairKey)
    if (!current || compareRoomEdges(edge, current) < 0) {
      closestByComponentPair.set(pairKey, { ...edge, role })
    }
  }

  return [...closestByComponentPair.values()].sort(compareRoomEdges)
}

export function buildSpanningEdges(nodes: RoomNode[], candidateEdges = buildRoomEdges(nodes)) {
  if (nodes.length < 2) return []

  const parent = new Array<number>(nodes.length).fill(0).map((_, index) => index)
  const rank = new Array<number>(nodes.length).fill(0)

  const find = (value: number): number => {
    if (parent[value] === value) return value
    parent[value] = find(parent[value])
    return parent[value]
  }

  const union = (first: number, second: number) => {
    const rootFirst = find(first)
    const rootSecond = find(second)
    if (rootFirst === rootSecond) return false

    if (rank[rootFirst] < rank[rootSecond]) {
      parent[rootFirst] = rootSecond
    } else if (rank[rootFirst] > rank[rootSecond]) {
      parent[rootSecond] = rootFirst
    } else {
      parent[rootSecond] = rootFirst
      rank[rootFirst] += 1
    }

    return true
  }

  const spanning: RoomEdge[] = []
  for (const edge of candidateEdges) {
    if (!union(edge.fromIndex, edge.toIndex)) continue
    spanning.push(edge)
    if (spanning.length >= nodes.length - 1) break
  }

  return spanning
}
