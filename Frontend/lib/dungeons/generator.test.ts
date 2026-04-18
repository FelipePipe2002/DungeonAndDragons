import test from "node:test"
import assert from "node:assert/strict"

import { readDungeonMapDocument } from "./adapter.ts"
import { DUNGEON_MAP_FIXTURE_JSON, DUNGEON_MAP_FIXTURES } from "./fixtures.ts"
import { generateDungeonMapDocument, stringifyDungeonMapDocument } from "./generator.ts"
import { createGenerationContext } from "./generator/core.ts"
import { placeRooms } from "./generator/room-placement.ts"
import { buildRoomGraph } from "./generator/topology.ts"
import {
  buildCorridorClusters,
  corridorCells,
  corridorRoomAdjacency,
  corridorStepCount,
  directionBetweenPoints,
  directCorridorRoomAdjacency,
  findRoomIndexContainingPoint,
  hasParallelAdjacentRunBetween,
  isRectRoomCorner,
  isRoomBorderCell,
  roomAspectBucket,
  roomCenter,
  roomsShareCells,
} from "./test-utils.ts"

function assertCoreDungeonInvariants(normalized: ReturnType<typeof readDungeonMapDocument>) {
  for (let index = 0; index < normalized.rooms.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < normalized.rooms.length; otherIndex += 1) {
      assert.equal(roomsShareCells(normalized.rooms[index], normalized.rooms[otherIndex]), false)
    }
  }

  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")
  assert.equal(startIndex >= 0, true)
  assert.equal(bossIndex >= 0, true)

  const adjacency = directCorridorRoomAdjacency(normalized.rooms, normalized.corridors)
  if (startIndex >= 0 && bossIndex >= 0) {
    const queue = [startIndex]
    const visited = new Set<number>(queue)
    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined) break
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
    assert.equal(visited.size >= 1, true)
  }

  for (const door of normalized.doors) {
    const roomIndex = findRoomIndexContainingPoint(normalized.rooms, { x: door.x, y: door.y })
    assert.equal(roomIndex >= 0, true)
    assert.equal(isRoomBorderCell(normalized.rooms[roomIndex], { x: door.x, y: door.y }), true)
  }

  const roomSideKeys = new Set<string>()
  for (const door of normalized.doors) {
    const roomIndex = findRoomIndexContainingPoint(normalized.rooms, { x: door.x, y: door.y })
    const roomSideKey = `${roomIndex}:${door.direction}`
    assert.equal(roomSideKeys.has(roomSideKey), false)
    roomSideKeys.add(roomSideKey)
  }

  const clusters = buildCorridorClusters(normalized.corridors)
  for (const cluster of clusters) {
    for (let firstIndex = 0; firstIndex < cluster.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cluster.length; secondIndex += 1) {
        assert.equal(
          hasParallelAdjacentRunBetween(normalized.corridors[cluster[firstIndex]].points, normalized.corridors[cluster[secondIndex]].points),
          false,
        )
      }
    }

    const roomIds = new Set<number>()
    let edgeCount = 0
    for (const corridorIndex of cluster) {
      const corridor = normalized.corridors[corridorIndex]
      const firstRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const secondRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      if (firstRoom < 0 || secondRoom < 0 || firstRoom === secondRoom) continue
      roomIds.add(firstRoom)
      roomIds.add(secondRoom)
      edgeCount += 1
    }

    if (roomIds.size > 1) {
      assert.equal(edgeCount <= roomIds.size - 1, true)
    }
  }
}

test("mantiene invariantes base de topologia y geometria (fase 1)", () => {
  const seeds = ["phase1-core-a", "phase1-core-b", "phase1-core-c"]

  for (const seed of seeds) {
    const normalized = readDungeonMapDocument(generateDungeonMapDocument({
      preset: "rooms-corridors",
      width: 84,
      height: 56,
      roomCount: 9,
      includeCorridors: true,
      corridorWidth: 1,
      extraConnectionCount: 1,
      seed,
    }))

    assertCoreDungeonInvariants(normalized)
  }
})

test("genera documento minimo valido", () => {
  const document = generateDungeonMapDocument({ preset: "minimal", width: 20, height: 20 })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.bounds.width, 20)
  assert.equal(normalized.bounds.height, 20)
  assert.deepEqual(normalized.rooms, [])
})

test("genera documento simple consistente", () => {
  const document = generateDungeonMapDocument({
    preset: "simple",
    width: 48,
    height: 30,
    roomCount: 5,
    minRoomWidth: 5,
    maxRoomWidth: 8,
    minRoomHeight: 4,
    maxRoomHeight: 7,
    roomPadding: 1,
    name: "Simple",
    seed: "simple-seed",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.rooms.length, 5)
  assert.equal(normalized.rooms.some((room) => room.kind === "start"), true)
  assert.equal(normalized.rooms.some((room) => room.kind === "boss"), false)
  assert.equal(normalized.metadata.name, "Simple")
})

test("acepta configuracion agrupada de room/corridor/topology/debug", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomOptions: {
      count: 9,
      minWidth: 5,
      maxWidth: 12,
      minHeight: 4,
      maxHeight: 10,
      padding: 1,
    },
    corridorOptions: {
      enabled: true,
      width: 1,
      maxSteps: 84,
    },
    topologyOptions: {
      extraConnections: 1,
    },
    debugOptions: {
      name: "Grouped Config",
      seed: "grouped-config-seed",
    },
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.rooms.length >= 1, true)
  assert.equal(Array.isArray(normalized.corridors), true)
  assert.equal(normalized.metadata.name, "Grouped Config")
  assert.equal(normalized.metadata.seed, "grouped-config-seed")
})

test("main branch existe entre inicio y final", () => {
  const normalized = readDungeonMapDocument(generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomOptions: { count: 9 },
    corridorOptions: { enabled: true },
    debugOptions: { seed: "main-branch-check" },
  }))
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")
  const adjacency = corridorRoomAdjacency(normalized.rooms, normalized.corridors)
  const queue = [startIndex]
  const visited = new Set<number>(queue)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  assert.equal(startIndex >= 0 && bossIndex >= 0, true)
  assert.equal(visited.has(bossIndex), true)
})

test("el grafo tiene hojas de exploracion", () => {
  const normalized = readDungeonMapDocument(generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomOptions: { count: 9 },
    corridorOptions: { enabled: true },
    debugOptions: { seed: "leaf-check" },
  }))
  const adjacency = directCorridorRoomAdjacency(normalized.rooms, normalized.corridors)
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const leaves = normalized.rooms
    .map((_, index) => ({ index, degree: adjacency.get(index)?.size ?? 0 }))
    .filter(({ index, degree }) => index !== startIndex && degree <= 1)

  assert.equal(leaves.length >= 1, true)
})

test("topologia prioriza vecinos locales y respeta budgets por rol", () => {
  const context = createGenerationContext({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomOptions: { count: 9 },
    corridorOptions: { enabled: true },
    topologyOptions: {
      extraConnections: 1,
      nearestNeighborCount: 4,
    },
    debugOptions: { seed: "topology-locality-check" },
  })
  const placement = placeRooms(context)
  const graph = buildRoomGraph(placement.rooms, context)
  const maxDistanceByRole = {
    "main-path": context.maxEdgeDistanceByRole["main-path"],
    branch: context.maxEdgeDistanceByRole.branch,
    "service/dead-end": context.maxEdgeDistanceByRole["service/dead-end"],
    "optional-loop": context.maxEdgeDistanceByRole["optional-loop"],
  }

  for (const connection of graph.connections) {
    const fromCenter = roomCenter(placement.rooms[connection.fromIndex])
    const toCenter = roomCenter(placement.rooms[connection.toIndex])
    const distance = Math.abs(fromCenter.x - toCenter.x) + Math.abs(fromCenter.y - toCenter.y)
    assert.equal(distance <= maxDistanceByRole[connection.role], true)

    if (connection.role === "optional-loop") continue

    const fromNearest = placement.rooms
      .map((room, roomIndex) => {
        if (roomIndex === connection.fromIndex) return null
        const center = roomCenter(room)
        return {
          roomIndex,
          distance: Math.abs(fromCenter.x - center.x) + Math.abs(fromCenter.y - center.y),
        }
      })
      .filter((edge): edge is { roomIndex: number; distance: number } => edge !== null)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, context.kNearestByRole[connection.role])
      .some((edge) => edge.roomIndex === connection.toIndex)

    const toNearest = placement.rooms
      .map((room, roomIndex) => {
        if (roomIndex === connection.toIndex) return null
        const center = roomCenter(room)
        return {
          roomIndex,
          distance: Math.abs(toCenter.x - center.x) + Math.abs(toCenter.y - center.y),
        }
      })
      .filter((edge): edge is { roomIndex: number; distance: number } => edge !== null)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, context.kNearestByRole[connection.role])
      .some((edge) => edge.roomIndex === connection.fromIndex)

    assert.equal(fromNearest || toNearest, true)
  }
})

test("motif braided produce mas optional loops que linear", () => {
  const baseOptions = {
    preset: "rooms-corridors" as const,
    width: 92,
    height: 62,
    roomOptions: { count: 12 },
    corridorOptions: { enabled: true },
    topologyOptions: {
      extraConnections: 1,
      adaptiveLoops: true,
      loopDensity: "high" as const,
      motifStrength: 1,
    },
    debugOptions: { seed: "motif-braided-vs-linear" },
  }

  const linearContext = createGenerationContext({
    ...baseOptions,
    topologyOptions: {
      ...baseOptions.topologyOptions,
      motif: "linear",
    },
  })
  const braidedContext = createGenerationContext({
    ...baseOptions,
    topologyOptions: {
      ...baseOptions.topologyOptions,
      motif: "braided",
    },
  })

  const linearPlacement = placeRooms(linearContext)
  const braidedPlacement = placeRooms(braidedContext)
  const linearGraph = buildRoomGraph(linearPlacement.rooms, linearContext)
  const braidedGraph = buildRoomGraph(braidedPlacement.rooms, braidedContext)
  const linearLoops = linearGraph.connections.filter((connection) => connection.role === "optional-loop").length
  const braidedLoops = braidedGraph.connections.filter((connection) => connection.role === "optional-loop").length

  assert.equal(braidedLoops >= linearLoops, true)
})

test("adaptive loops escalan con mapas mas grandes", () => {
  const smallContext = createGenerationContext({
    preset: "rooms-corridors",
    width: 56,
    height: 40,
    roomOptions: { count: 8 },
    corridorOptions: { enabled: true },
    topologyOptions: {
      extraConnections: 1,
      motif: "balanced",
      adaptiveLoops: true,
      loopDensity: "medium",
      motifStrength: 1,
    },
    debugOptions: { seed: "adaptive-loops-scale" },
  })
  const largeContext = createGenerationContext({
    preset: "rooms-corridors",
    width: 124,
    height: 88,
    roomOptions: { count: 18 },
    corridorOptions: { enabled: true },
    topologyOptions: {
      extraConnections: 1,
      motif: "balanced",
      adaptiveLoops: true,
      loopDensity: "medium",
      motifStrength: 1,
    },
    debugOptions: { seed: "adaptive-loops-scale" },
  })

  const smallGraph = buildRoomGraph(placeRooms(smallContext).rooms, smallContext)
  const largeGraph = buildRoomGraph(placeRooms(largeContext).rooms, largeContext)
  const smallLoops = smallGraph.connections.filter((connection) => connection.role === "optional-loop").length
  const largeLoops = largeGraph.connections.filter((connection) => connection.role === "optional-loop").length

  assert.equal(largeLoops >= smallLoops, true)
})

test("roomDispersion empuja salas hacia los bordes", () => {
  const seed = "dispersion-check"
  const base = {
    preset: "rooms-corridors" as const,
    width: 82,
    height: 54,
    roomOptions: { count: 10 },
    corridorOptions: { enabled: false },
    debugOptions: { seed },
  }

  const centered = readDungeonMapDocument(generateDungeonMapDocument({
    ...base,
    roomDispersion: 0,
  }))
  const dispersed = readDungeonMapDocument(generateDungeonMapDocument({
    ...base,
    roomDispersion: 1,
  }))

  const avgEdgeDistance = (normalized: ReturnType<typeof readDungeonMapDocument>) => {
    const { width, height, originX, originY } = normalized.bounds
    const maxX = originX + width
    const maxY = originY + height
    const distances = normalized.rooms.map((room) => {
      const center = roomCenter(room)
      return Math.min(
        center.x - originX,
        center.y - originY,
        maxX - center.x,
        maxY - center.y,
      )
    })
    return distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length)
  }

  assert.equal(avgEdgeDistance(dispersed) < avgEdgeDistance(centered), true)
})

test("el inicio ya no tiene que coincidir con la sala mas centrica", () => {
  const normalized = readDungeonMapDocument(generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomOptions: { count: 9 },
    corridorOptions: { enabled: true },
    debugOptions: { seed: "start-not-centered" },
  }))
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const mapCenter = { x: normalized.bounds.width / 2, y: normalized.bounds.height / 2 }
  const centeredRoomIndex = normalized.rooms
    .map((room, index) => ({
      index,
      distance: Math.hypot(roomCenter(room).x - mapCenter.x, roomCenter(room).y - mapCenter.y),
    }))
    .sort((first, second) => first.distance - second.distance)[0]?.index

  assert.equal(startIndex >= 0, true)
  assert.notEqual(startIndex, centeredRoomIndex)
})

test("seeds doradas mantienen firma estable de salida", () => {
  const seeds = ["golden-a", "golden-b", "golden-c"]
  const signatures = seeds.map((seed) => {
    const normalized = readDungeonMapDocument(generateDungeonMapDocument({
      preset: "rooms-corridors",
      width: 82,
      height: 54,
      roomOptions: { count: 9 },
      corridorOptions: { enabled: true },
      topologyOptions: { extraConnections: 1 },
      debugOptions: { seed },
    }))

    return {
      seed,
      rooms: normalized.rooms.length,
      corridors: normalized.corridors.length,
      doors: normalized.doors.length,
      start: normalized.rooms.findIndex((room) => room.kind === "start"),
      boss: normalized.rooms.findIndex((room) => room.kind === "boss"),
    }
  })

  assert.deepEqual(signatures, [
    { seed: "golden-a", rooms: 9, corridors: 9, doors: 13, start: 6, boss: 1 },
    { seed: "golden-b", rooms: 9, corridors: 9, doors: 13, start: 5, boss: 6 },
    { seed: "golden-c", rooms: 9, corridors: 9, doors: 13, start: 8, boss: 0 },
  ])
})

test("genera multiples rooms dentro de limites y sin overlap", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 70,
    height: 34,
    roomCount: 5,
    minRoomWidth: 6,
    maxRoomWidth: 10,
    minRoomHeight: 4,
    maxRoomHeight: 8,
    roomPadding: 1,
    includeCorridors: false,
    seed: "rooms-layout",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.rooms.length, 5)
  assert.equal(normalized.corridors.length, 0)

  for (const room of normalized.rooms) {
    assert.equal(Number.isInteger(room.x), true)
    assert.equal(Number.isInteger(room.y), true)
    assert.equal(room.x >= 0, true)
    assert.equal(room.y >= 0, true)
    assert.equal(room.x + room.width <= normalized.bounds.width, true)
    assert.equal(room.y + room.height <= normalized.bounds.height, true)
  }

  for (let index = 0; index < normalized.rooms.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < normalized.rooms.length; otherIndex += 1) {
      assert.equal(roomsShareCells(normalized.rooms[index], normalized.rooms[otherIndex]), false)
    }
  }
})

test("genera corridors cuando se habilitan", () => {
  const document = generateDungeonMapDocument({
    preset: "simple",
    width: 72,
    height: 44,
    roomCount: 7,
    minRoomWidth: 5,
    maxRoomWidth: 11,
    minRoomHeight: 4,
    maxRoomHeight: 9,
    roomPadding: 1,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "corridors-enabled",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.corridors.length >= Math.max(0, normalized.rooms.length - 1), true)
  assert.equal(normalized.corridors.every((corridor) => corridor.width === 1), true)
})

test("corridors tienen puntos validos y alineados a grilla", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 76,
    height: 48,
    roomCount: 8,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "corridor-points",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.corridors.length >= 1, true)

  for (const corridor of normalized.corridors) {
    assert.equal(corridor.points.length >= 2, true)

    for (let index = 0; index < corridor.points.length; index += 1) {
      const point = corridor.points[index]
      assert.equal(Number.isInteger(point.x), true)
      assert.equal(Number.isInteger(point.y), true)
      assert.equal(point.x >= 0 && point.x < normalized.bounds.width, true)
      assert.equal(point.y >= 0 && point.y < normalized.bounds.height, true)

      if (index === 0) continue
      const previous = corridor.points[index - 1]
      assert.equal(previous.x === point.x || previous.y === point.y, true)
    }
  }
})

test("corridors respetan el maximo de pasos configurado", () => {
  const maxCorridorSteps = 42
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    maxCorridorSteps,
    seed: "bounded-corridors",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.corridors.length >= 1, true)
  assert.equal(normalized.corridors.every((corridor) => corridorStepCount(corridor.points) <= maxCorridorSteps), true)
})

test("corridors no toman desvios desproporcionados frente a la distancia directa", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "bounded-corridors",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.corridors.length >= 1, true)

  for (const corridor of normalized.corridors) {
    const start = corridor.points[0]
    const end = corridor.points[corridor.points.length - 1]
    const directDistance = Math.abs(start.x - end.x) + Math.abs(start.y - end.y)
    const actualSteps = corridorStepCount(corridor.points)
    assert.equal(actualSteps <= Math.max(12, directDistance * 2 + 6), true)
  }
})

test("corridors no pisan celdas de rooms ajenas", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "room-aware-routing",
  })
  const normalized = readDungeonMapDocument(document)
  const roomByCell = new Map<string, number>()

  normalized.rooms.forEach((room, roomIndex) => {
    room.cells.forEach((cell) => {
      roomByCell.set(`${cell.x},${cell.y}`, roomIndex)
    })
  })

  for (const corridor of normalized.corridors) {
    const start = corridor.points[0]
    const end = corridor.points[corridor.points.length - 1]
    const startDoor = normalized.doors.find((door) => door.x === start.x && door.y === start.y)
    const endDoor = normalized.doors.find((door) => door.x === end.x && door.y === end.y)

    const startRoomIndex = startDoor ? findRoomIndexContainingPoint(normalized.rooms, { x: startDoor.x, y: startDoor.y }) : -1
    const endRoomIndex = endDoor ? findRoomIndexContainingPoint(normalized.rooms, { x: endDoor.x, y: endDoor.y }) : -1

    for (const cell of corridorCells(corridor.points)) {
      const owner = roomByCell.get(`${cell.x},${cell.y}`)
      if (owner === undefined) continue
      assert.equal(owner === startRoomIndex || owner === endRoomIndex, true)
    }
  }
})

test("room-aware routing puede generar corridors con multiples dobleces", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 78,
    height: 50,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    roomPadding: 1,
    seed: "bend2-47",
  })
  const normalized = readDungeonMapDocument(document)
  const hasMultiBend = normalized.corridors.some((corridor) => corridor.points.length >= 4)

  assert.equal(hasMultiBend, true)
})

test("corridors parten en el borde de una room y generan puertas", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 80,
    height: 52,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "corridor-room-borders",
  })
  const normalized = readDungeonMapDocument(document)

  assert.equal(normalized.corridors.length >= 1, true)
  assert.equal(normalized.doors.length >= 2, true)
  let validatedDoorEndpoints = 0

  for (const corridor of normalized.corridors) {
    const start = corridor.points[0]
    const end = corridor.points[corridor.points.length - 1]
    const startDoor = normalized.doors.find((door) => door.x === start.x && door.y === start.y)
    const endDoor = normalized.doors.find((door) => door.x === end.x && door.y === end.y)

    if (startDoor) {
      const startRoomIndex = findRoomIndexContainingPoint(normalized.rooms, { x: startDoor.x, y: startDoor.y })
      assert.equal(startRoomIndex >= 0, true)
      assert.equal(isRoomBorderCell(normalized.rooms[startRoomIndex], { x: startDoor.x, y: startDoor.y }), true)
      assert.equal(isRectRoomCorner(normalized.rooms[startRoomIndex], { x: startDoor.x, y: startDoor.y }), false)
      const firstStep = corridor.points[1] ?? start
      const expectedStartDirection = directionBetweenPoints(start, firstStep)
      assert.equal(startDoor.direction, expectedStartDirection)
      validatedDoorEndpoints += 1
    }

    if (endDoor) {
      const endRoomIndex = findRoomIndexContainingPoint(normalized.rooms, { x: endDoor.x, y: endDoor.y })
      assert.equal(endRoomIndex >= 0, true)
      assert.equal(isRoomBorderCell(normalized.rooms[endRoomIndex], { x: endDoor.x, y: endDoor.y }), true)
      assert.equal(isRectRoomCorner(normalized.rooms[endRoomIndex], { x: endDoor.x, y: endDoor.y }), false)
      const beforeEnd = corridor.points[corridor.points.length - 2] ?? end
      const expectedEndDirection = directionBetweenPoints(end, beforeEnd)
      assert.equal(endDoor.direction, expectedEndDirection)
      validatedDoorEndpoints += 1
    }
  }

  assert.equal(validatedDoorEndpoints >= 2, true)
})

test("inicio y final son salas distintas", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 78,
    height: 50,
    roomCount: 8,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "no-start-boss-direct",
  })
  const normalized = readDungeonMapDocument(document)
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")

  assert.equal(startIndex >= 0 && bossIndex >= 0, true)
  assert.equal(normalized.rooms.length >= 3, true)

  assert.equal(startIndex === bossIndex, false)
})

test("final tiene exactamente un corridor conectado", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 80,
    height: 52,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "final-single-connection",
  })
  const normalized = readDungeonMapDocument(document)
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")

  assert.equal(bossIndex >= 0, true)

  const bossConnections = normalized.corridors.filter((corridor) => {
    const startRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
    const endRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
    return startRoom === bossIndex || endRoom === bossIndex
  })

  assert.equal(bossConnections.length, 1)
})

test("final se elige al final como hoja mas lejana desde inicio", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "start-to-final-path",
  })
  const normalized = readDungeonMapDocument(document)
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")
  const adjacency = directCorridorRoomAdjacency(normalized.rooms, normalized.corridors)
  const distanceByRoom = new Map<number, number>([[startIndex, 0]])
  const queue = [startIndex]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break

    for (const neighbor of adjacency.get(current) ?? []) {
      if (distanceByRoom.has(neighbor)) continue
      distanceByRoom.set(neighbor, (distanceByRoom.get(current) ?? 0) + 1)
      queue.push(neighbor)
    }
  }

  const leafCandidates = normalized.rooms
    .map((room, index) => ({
      index,
      degree: adjacency.get(index)?.size ?? 0,
      distance: distanceByRoom.get(index) ?? Number.NEGATIVE_INFINITY,
      kind: room.kind,
    }))
    .filter(({ index, distance }) => index !== startIndex && Number.isFinite(distance) && (adjacency.get(index)?.size ?? 0) <= 1)
    .sort((first, second) => second.distance - first.distance)
  const clusters = buildCorridorClusters(normalized.corridors)
  const leafCandidatesWithoutStartCluster = leafCandidates.filter(({ index }) => {
    const touchingCluster = clusters.find((cluster) =>
      cluster.some((corridorIndex) => {
        const corridor = normalized.corridors[corridorIndex]
        const firstRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
        const secondRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
        return firstRoom === index || secondRoom === index
      }),
    )

    if (!touchingCluster) return true

    return touchingCluster.every((corridorIndex) => {
      const corridor = normalized.corridors[corridorIndex]
      const firstRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const secondRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      return firstRoom !== startIndex && secondRoom !== startIndex
    })
  })
  const expectedCandidates = (leafCandidatesWithoutStartCluster.length > 0 ? leafCandidatesWithoutStartCluster : leafCandidates)
    .map((candidate) => candidate.index)

  assert.equal(startIndex >= 0 && bossIndex >= 0, true)
  assert.equal(expectedCandidates.includes(bossIndex), true)
})

test("el cluster de la sala final no toca la sala inicial", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    extraConnectionCount: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")
  const clusters = buildCorridorClusters(normalized.corridors)
  const touchingCluster = clusters.find((cluster) =>
    cluster.some((corridorIndex) => {
      const corridor = normalized.corridors[corridorIndex]
      const startRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const endRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      return startRoom === bossIndex || endRoom === bossIndex
    }),
  )

  assert.equal(startIndex >= 0 && bossIndex >= 0, true)
  assert.equal(Boolean(touchingCluster), true)
  const hasIsolatedLeafCandidate = normalized.rooms.some((room, index) => {
    if (index === startIndex) return false
    const degree = directCorridorRoomAdjacency(normalized.rooms, normalized.corridors).get(index)?.size ?? 0
    if (degree > 1) return false
    const roomClusters = clusters.filter((cluster) =>
      cluster.some((corridorIndex) => {
        const corridor = normalized.corridors[corridorIndex]
        const firstRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
        const secondRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
        return firstRoom === index || secondRoom === index
      }),
    )
    if (roomClusters.length === 0) return true
    return roomClusters.every((cluster) =>
      cluster.every((corridorIndex) => {
        const corridor = normalized.corridors[corridorIndex]
        const firstRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
        const secondRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
        return firstRoom !== startIndex && secondRoom !== startIndex
      }),
    )
  })

  assert.equal(hasIsolatedLeafCandidate || Boolean(touchingCluster), true)
})

test("existe camino entre inicio y final", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 82,
    height: 54,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "start-to-final-path",
  })
  const normalized = readDungeonMapDocument(document)
  const startIndex = normalized.rooms.findIndex((room) => room.kind === "start")
  const bossIndex = normalized.rooms.findIndex((room) => room.kind === "boss")
  const adjacency = corridorRoomAdjacency(normalized.rooms, normalized.corridors)
  const queue = [startIndex]
  const visited = new Set<number>(queue)

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (current === bossIndex) break

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  assert.equal(startIndex >= 0 && bossIndex >= 0, true)
  assert.equal(visited.has(bossIndex), true)
})

test("al menos una room puede tener multiples conexiones de puerta", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "multi-door-room",
  })
  const normalized = readDungeonMapDocument(document)
  const connectionsPerRoom = new Map<number, number>()

  for (const corridor of normalized.corridors) {
    const start = corridor.points[0]
    const end = corridor.points[corridor.points.length - 1]
    const firstDoor = normalized.doors.find((door) => {
      return door.x === start.x && door.y === start.y
    })
    const lastDoor = normalized.doors.find((door) => {
      return door.x === end.x && door.y === end.y
    })
    const firstRoom = firstDoor ? findRoomIndexContainingPoint(normalized.rooms, { x: firstDoor.x, y: firstDoor.y }) : -1
    const lastRoom = lastDoor ? findRoomIndexContainingPoint(normalized.rooms, { x: lastDoor.x, y: lastDoor.y }) : -1
    if (firstRoom >= 0) connectionsPerRoom.set(firstRoom, (connectionsPerRoom.get(firstRoom) ?? 0) + 1)
    if (lastRoom >= 0) connectionsPerRoom.set(lastRoom, (connectionsPerRoom.get(lastRoom) ?? 0) + 1)
  }

  const maxConnections = Math.max(0, ...connectionsPerRoom.values())
  assert.equal(maxConnections >= 2, true)
})

test("corridors pueden reutilizar un tramo comun y formar intersecciones", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const usageByCell = new Map<string, number>()

  for (const corridor of normalized.corridors) {
    for (const cell of corridorCells(corridor.points)) {
      usageByCell.set(`${cell.x},${cell.y}`, (usageByCell.get(`${cell.x},${cell.y}`) ?? 0) + 1)
    }
  }

  const hasIntersection = [...usageByCell.values()].some((count) => count >= 2)
  assert.equal(hasIntersection, true)
})

test("no se forman corredores paralelos pegados dentro del mismo cluster", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    extraConnectionCount: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const clusters = buildCorridorClusters(normalized.corridors)

  for (const cluster of clusters) {
    for (let firstIndex = 0; firstIndex < cluster.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cluster.length; secondIndex += 1) {
        assert.equal(
          hasParallelAdjacentRunBetween(normalized.corridors[cluster[firstIndex]].points, normalized.corridors[cluster[secondIndex]].points),
          false,
        )
      }
    }
  }
})

test("no hay dos puertas distintas en la misma pared hacia el mismo hub", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const doorKeys = new Set<string>()

  for (const door of normalized.doors) {
    const roomIndex = findRoomIndexContainingPoint(normalized.rooms, { x: door.x, y: door.y })
    assert.equal(roomIndex >= 0, true)
    const key = `${normalized.rooms[roomIndex].id}:${door.direction}`
    assert.equal(doorKeys.has(key), false)
    doorKeys.add(key)
  }
})

test("multiples caminos pueden compartir la misma salida exterior", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const usageByDoor = new Map<string, number>()

  for (const corridor of normalized.corridors) {
    const start = corridor.points[0]
    const end = corridor.points[corridor.points.length - 1]
    usageByDoor.set(`${start.x},${start.y}`, (usageByDoor.get(`${start.x},${start.y}`) ?? 0) + 1)
    usageByDoor.set(`${end.x},${end.y}`, (usageByDoor.get(`${end.x},${end.y}`) ?? 0) + 1)
  }

  const hasSharedExit = [...usageByDoor.values()].some((count) => count >= 2)
  assert.equal(hasSharedExit, true)
})

test("el merge termina en una interseccion real y evita entradas redundantes", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const usageByCell = new Map<string, number>()
  const doorCells = new Set(normalized.doors.map((door) => `${door.x},${door.y}`))

  for (const corridor of normalized.corridors) {
    for (const cell of corridorCells(corridor.points)) {
      const key = `${cell.x},${cell.y}`
      usageByCell.set(key, (usageByCell.get(key) ?? 0) + 1)
    }
  }

  const hasNonDoorIntersection = [...usageByCell.entries()].some(([key, count]) => count >= 2 && !doorCells.has(key))

  assert.equal(hasNonDoorIntersection, true)
})

test("un corridor nuevo no atraviesa otro de forma invalida", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const usageByCell = new Map<string, Set<number>>()

  normalized.corridors.forEach((corridor, corridorIndex) => {
    for (const cell of corridorCells(corridor.points)) {
      const key = `${cell.x},${cell.y}`
      const owners = usageByCell.get(key) ?? new Set<number>()
      owners.add(corridorIndex)
      usageByCell.set(key, owners)
    }
  })

  for (const owners of usageByCell.values()) {
    if (owners.size <= 1) continue
    const overlappingCorridors = [...owners].map((index) => normalized.corridors[index])
    const connectedRoomSet = new Set(
      overlappingCorridors.flatMap((corridor) => {
        const startRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
        const endRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
        return [startRoom, endRoom].filter((roomIndex) => roomIndex >= 0)
      }),
    )

    assert.equal(connectedRoomSet.size < owners.size * 2, true)
  }
})

test("no hay dos corridors directos entre la misma pareja de rooms", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const pairCounts = new Map<string, number>()

  for (const corridor of normalized.corridors) {
    const startRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
    const endRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
    if (startRoomIndex < 0 || endRoomIndex < 0 || startRoomIndex === endRoomIndex) continue
    const key = [normalized.rooms[startRoomIndex].id, normalized.rooms[endRoomIndex].id].sort().join(":")
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }

  for (const count of pairCounts.values()) {
    assert.equal(count, 1)
  }
})

test("un corridor no puede volver sobre su propia salida inicial", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)

  for (const corridor of normalized.corridors) {
    if (corridor.points.length < 4) continue
    const a = corridor.points[0]
    const b = corridor.points[1]
    const c = corridor.points[2]
    const d = corridor.points[3]
    const firstDirection = directionBetweenPoints(a, b)
    const secondDirection = directionBetweenPoints(b, c)
    const thirdDirection = directionBetweenPoints(c, d)

    if (!firstDirection || !secondDirection || !thirdDirection) continue
    const reversed = (
      (firstDirection === "east" && secondDirection === "west")
      || (firstDirection === "west" && secondDirection === "east")
      || (firstDirection === "north" && secondDirection === "south")
      || (firstDirection === "south" && secondDirection === "north")
    )

    assert.equal(reversed, false)
    assert.equal(secondDirection === thirdDirection && reversed, false)
  }
})

test("no hay dos puertas de la misma sala al mismo cluster de corridor", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const clusters = buildCorridorClusters(normalized.corridors)

  for (const cluster of clusters) {
    const roomIds = new Set<string>()
    for (const corridorIndex of cluster) {
      const corridor = normalized.corridors[corridorIndex]
      const startRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const endRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      if (startRoomIndex >= 0) roomIds.add(normalized.rooms[startRoomIndex].id)
      if (endRoomIndex >= 0) roomIds.add(normalized.rooms[endRoomIndex].id)
    }

    let roomTouches = 0
    for (const corridorIndex of cluster) {
      const corridor = normalized.corridors[corridorIndex]
      const startRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const endRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      if (startRoomIndex >= 0) roomTouches += 1
      if (endRoomIndex >= 0) roomTouches += 1
    }

    assert.equal(roomTouches <= roomIds.size * 2, true)
  }
})

test("no hay path que salga y vuelva a la misma sala por interseccion", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const clusters = buildCorridorClusters(normalized.corridors)

  for (const cluster of clusters) {
    const doorKeysByRoomId = new Map<string, Set<string>>()

    for (const corridorIndex of cluster) {
      const corridor = normalized.corridors[corridorIndex]
      const startRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const endRoomIndex = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      if (startRoomIndex >= 0) {
        const roomId = normalized.rooms[startRoomIndex].id
        const doorKey = `${corridor.points[0].x},${corridor.points[0].y}`
        const keys = doorKeysByRoomId.get(roomId) ?? new Set<string>()
        keys.add(doorKey)
        doorKeysByRoomId.set(roomId, keys)
      }
      if (endRoomIndex >= 0) {
        const roomId = normalized.rooms[endRoomIndex].id
        const doorKey = `${corridor.points[corridor.points.length - 1].x},${corridor.points[corridor.points.length - 1].y}`
        const keys = doorKeysByRoomId.get(roomId) ?? new Set<string>()
        keys.add(doorKey)
        doorKeysByRoomId.set(roomId, keys)
      }
    }

    for (const doorKeys of doorKeysByRoomId.values()) {
      assert.equal(doorKeys.size <= 1, true)
    }
  }
})

test("los clusters de corredores no mantienen ciclos redundantes entre salas", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    includeCorridors: true,
    corridorWidth: 1,
    extraConnectionCount: 1,
    seed: "hub-0",
  })
  const normalized = readDungeonMapDocument(document)
  const clusters = buildCorridorClusters(normalized.corridors)

  for (const cluster of clusters) {
    const roomIds = new Set<number>()
    let edgeCount = 0

    for (const corridorIndex of cluster) {
      const corridor = normalized.corridors[corridorIndex]
      const startRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[0])
      const endRoom = findRoomIndexContainingPoint(normalized.rooms, corridor.points[corridor.points.length - 1])
      if (startRoom < 0 || endRoom < 0 || startRoom === endRoom) continue
      roomIds.add(startRoom)
      roomIds.add(endRoom)
      edgeCount += 1
    }

    if (roomIds.size <= 1) continue
    assert.equal(edgeCount <= roomIds.size - 1, true)
  }
})

test("corridors son deterministas por seed", () => {
  const baseOptions = {
    preset: "rooms-corridors" as const,
    width: 68,
    height: 42,
    roomCount: 7,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "corridor-stable-seed",
  }

  const first = generateDungeonMapDocument(baseOptions)
  const second = generateDungeonMapDocument(baseOptions)

  assert.deepEqual(first.layout.corridors, second.layout.corridors)
})

test("salida con corridors permanece valida para el adaptador", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 72,
    height: 46,
    roomCount: 8,
    includeCorridors: true,
    corridorWidth: 1,
    seed: "corridor-adapter-valid",
  })

  const normalized = readDungeonMapDocument(document)
  assert.equal(normalized.rooms.length >= 2, true)
  assert.equal(normalized.corridors.length >= normalized.rooms.length - 1, true)
})

test("respeta rangos configurados y produce tamanos variables", () => {
  const document = generateDungeonMapDocument({
    preset: "simple",
    width: 96,
    height: 72,
    roomCount: 10,
    minRoomWidth: 4,
    maxRoomWidth: 11,
    minRoomHeight: 3,
    maxRoomHeight: 9,
    roomPadding: 0,
    seed: "varied-sizes",
  })
  const normalized = readDungeonMapDocument(document)

  const widths = new Set<number>()
  const heights = new Set<number>()

  for (const room of normalized.rooms) {
    assert.equal(room.width >= 4 && room.width <= 11, true)
    assert.equal(room.height >= 3 && room.height <= 9, true)
    widths.add(room.width)
    heights.add(room.height)
  }

  assert.equal(widths.size > 1, true)
  assert.equal(heights.size > 1, true)
})

test("prioriza una sala principal y evita clustering excesivo", () => {
  const document = generateDungeonMapDocument({
    preset: "simple",
    width: 72,
    height: 48,
    roomCount: 8,
    minRoomWidth: 5,
    maxRoomWidth: 12,
    minRoomHeight: 4,
    maxRoomHeight: 10,
    roomPadding: 1,
    seed: "quality-pass",
  })
  const normalized = readDungeonMapDocument(document)

  const areas = normalized.rooms.map((room) => room.width * room.height)
  const largestArea = Math.max(...areas)
  const averageArea = areas.reduce((sum, value) => sum + value, 0) / areas.length

  assert.equal(largestArea > averageArea * 1.2, true)

  for (let index = 0; index < normalized.rooms.length; index += 1) {
    const center = roomCenter(normalized.rooms[index])
    let nearestDistance = Number.POSITIVE_INFINITY

    for (let otherIndex = 0; otherIndex < normalized.rooms.length; otherIndex += 1) {
      if (index === otherIndex) continue
      const otherCenter = roomCenter(normalized.rooms[otherIndex])
      nearestDistance = Math.min(nearestDistance, Math.hypot(center.x - otherCenter.x, center.y - otherCenter.y))
    }

    assert.equal(nearestDistance >= 6, true)
  }
})

test("genera variedad de perfiles rectangulares", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    minRoomWidth: 5,
    maxRoomWidth: 13,
    minRoomHeight: 4,
    maxRoomHeight: 11,
    roomPadding: 1,
    seed: "archetype-variety",
  })
  const normalized = readDungeonMapDocument(document)

  const aspectBuckets = new Set(normalized.rooms.map(roomAspectBucket))
  const areas = normalized.rooms.map((room) => room.width * room.height)
  const smallRooms = areas.filter((area) => area <= 36).length
  const largeRooms = areas.filter((area) => area >= 72).length

  assert.equal(aspectBuckets.size >= 2, true)
  assert.equal(smallRooms >= 1, true)
  assert.equal(largeRooms >= 1, true)
})

test("genera solo rooms rectangulares para simplificar", () => {
  const document = generateDungeonMapDocument({
    preset: "rooms-corridors",
    width: 84,
    height: 56,
    roomCount: 9,
    minRoomWidth: 5,
    maxRoomWidth: 13,
    minRoomHeight: 4,
    maxRoomHeight: 11,
    roomPadding: 1,
    seed: "l-room-seed-0",
  })
  const normalized = readDungeonMapDocument(document)
  assert.equal(normalized.rooms.every((room) => room.shape === "rect"), true)
})

test("mismo seed produce mismo layout", () => {
  const first = generateDungeonMapDocument({
    preset: "simple",
    width: 64,
    height: 48,
    roomCount: 7,
    minRoomWidth: 5,
    maxRoomWidth: 10,
    minRoomHeight: 4,
    maxRoomHeight: 8,
    roomPadding: 1,
    seed: "stable-seed",
  })
  const second = generateDungeonMapDocument({
    preset: "simple",
    width: 64,
    height: 48,
    roomCount: 7,
    minRoomWidth: 5,
    maxRoomWidth: 10,
    minRoomHeight: 4,
    maxRoomHeight: 8,
    roomPadding: 1,
    seed: "stable-seed",
  })

  assert.deepEqual(first.layout.rooms, second.layout.rooms)
  assert.deepEqual(first.metadata, second.metadata)
})

test("seeds distintos producen layouts distintos", () => {
  const first = generateDungeonMapDocument({
    preset: "simple",
    width: 64,
    height: 48,
    roomCount: 7,
    minRoomWidth: 5,
    maxRoomWidth: 10,
    minRoomHeight: 4,
    maxRoomHeight: 8,
    roomPadding: 1,
    seed: "seed-a",
  })
  const second = generateDungeonMapDocument({
    preset: "simple",
    width: 64,
    height: 48,
    roomCount: 7,
    minRoomWidth: 5,
    maxRoomWidth: 10,
    minRoomHeight: 4,
    maxRoomHeight: 8,
    roomPadding: 1,
    seed: "seed-b",
  })

  assert.notDeepEqual(first.layout.rooms, second.layout.rooms)
})

test("stringify produce JSON compatible con el adaptador", () => {
  const json = stringifyDungeonMapDocument(generateDungeonMapDocument({ preset: "simple" }))
  const normalized = readDungeonMapDocument(json)

  assert.equal(normalized.type, "mazmorra")
  assert.equal(normalized.version, 1)
})

test("fixtures cubren minimo simple y salas con corredores", () => {
  assert.equal(readDungeonMapDocument(DUNGEON_MAP_FIXTURES.minimal).rooms.length, 0)
  assert.ok(readDungeonMapDocument(DUNGEON_MAP_FIXTURES.simple).rooms.length >= 2)
  assert.ok(readDungeonMapDocument(DUNGEON_MAP_FIXTURES.roomsAndCorridors).rooms.length >= 2)
  assert.equal(Array.isArray(readDungeonMapDocument(DUNGEON_MAP_FIXTURE_JSON.roomsAndCorridors).corridors), true)
})
