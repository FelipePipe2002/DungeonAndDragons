import type { DungeonCorridor, DungeonRoom } from "../types.ts"
import { buildRoomAdjacencyByCorridors } from "./graph-builder.ts"

type FinalSelectionHelpers = {
  buildRoomSpatialLookup: (rooms: DungeonRoom[]) => { roomIndexByCell: Map<string, number> }
  roomIndexForPoint: (lookup: { roomIndexByCell: Map<string, number> }, point: { x: number; y: number }) => number
  buildCorridorClusterAnalyses: (
    rooms: DungeonRoom[],
    corridors: DungeonCorridor[],
    blockedRooms: Set<string>,
  ) => Array<{ roomIndexes: Set<number> }>
  buildRoomBlockedCells: (rooms: DungeonRoom[]) => Set<string>
}

type FinalLeafCandidate = {
  index: number
  distance: number
  degree: number
  touchesStartCluster: boolean
}

export function buildFinalLeafCandidates(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  helpers: FinalSelectionHelpers,
) {
  const startIndex = rooms.findIndex((room) => room.kind === "start")
  if (startIndex < 0) {
    return { startIndex, candidates: [] as FinalLeafCandidate[] }
  }

  const directAdjacency = buildRoomAdjacencyByCorridors(rooms, corridors, helpers)
  const blockedRooms = helpers.buildRoomBlockedCells(rooms)
  const clusterAnalyses = helpers.buildCorridorClusterAnalyses(rooms, corridors, blockedRooms)
  const startClusterRoomIndexes = new Set<number>()
  for (const analysis of clusterAnalyses) {
    if (!analysis.roomIndexes.has(startIndex)) continue
    for (const roomIndex of analysis.roomIndexes) {
      startClusterRoomIndexes.add(roomIndex)
    }
  }

  const distanceByRoom = new Map<number, number>([[startIndex, 0]])
  const queue = [startIndex]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    const nextDistance = (distanceByRoom.get(current) ?? 0) + 1

    for (const neighbor of directAdjacency.get(current) ?? []) {
      if (distanceByRoom.has(neighbor)) continue
      distanceByRoom.set(neighbor, nextDistance)
      queue.push(neighbor)
    }
  }

  const leafCandidates = rooms
    .map((room, index) => ({
      index,
      room,
      distance: distanceByRoom.get(index) ?? Number.NEGATIVE_INFINITY,
      degree: directAdjacency.get(index)?.size ?? 0,
    }))
    .filter(({ index, distance }) => index !== startIndex && Number.isFinite(distance))

  const preferredLeaves = leafCandidates.filter(({ degree }) => degree <= 1)
  const rankedCandidates = (preferredLeaves.length > 0 ? preferredLeaves : leafCandidates)
    .sort((first, second) => {
      if (first.distance !== second.distance) return second.distance - first.distance
      if (first.degree !== second.degree) return first.degree - second.degree
      return second.index - first.index
    })

  return {
    startIndex,
    candidates: rankedCandidates.map((candidate) => {
      return {
        index: candidate.index,
        distance: candidate.distance,
        degree: candidate.degree,
        touchesStartCluster: startClusterRoomIndexes.has(candidate.index),
      }
    }),
  }
}

export function pickBestFinalIndex(candidates: Array<{ index: number; distance: number; touchesStartCluster: boolean }>) {
  const prioritized =
    candidates.find((candidate) => !candidate.touchesStartCluster && candidate.distance > 1)
    ?? candidates.find((candidate) => !candidate.touchesStartCluster)
    ?? candidates.find((candidate) => candidate.distance > 1)
    ?? candidates[0]

  return prioritized?.index
}

export function assignFarthestFinalRoom(rooms: DungeonRoom[], finalIndex: number | undefined) {
  if (rooms.length <= 1 || finalIndex === undefined) return rooms

  const startIndex = rooms.findIndex((room) => room.kind === "start")
  if (startIndex < 0) return rooms

  return rooms.map((room, index) => {
    if (index === startIndex) {
      return {
        ...room,
        kind: "start",
        label: "Inicio",
      }
    }

    if (index === finalIndex) {
      return {
        ...room,
        kind: "boss",
        label: "Final",
      }
    }

    return {
      ...room,
      kind: "room",
      label: room.label?.trim() ? room.label : `Sala ${index + 1}`,
    }
  })
}

export function hasEligibleFinalLeaf(
  rooms: DungeonRoom[],
  corridors: DungeonCorridor[],
  helpers: FinalSelectionHelpers,
) {
  return buildFinalLeafCandidates(rooms, corridors, helpers).candidates.some((candidate) => !candidate.touchesStartCluster)
}
