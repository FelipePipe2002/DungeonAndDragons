export function roomsShareCells(
  first: { cells: Array<{ x: number; y: number }> },
  second: { cells: Array<{ x: number; y: number }> },
) {
  const secondKeys = new Set(second.cells.map((cell) => `${cell.x},${cell.y}`))
  return first.cells.some((cell) => secondKeys.has(`${cell.x},${cell.y}`))
}

export function roomCenter(room: { x: number; y: number; width: number; height: number }) {
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  }
}

export function roomAspectBucket(room: { width: number; height: number }) {
  const ratio = room.width / room.height
  if (ratio >= 1.35) return "wide"
  if (ratio <= 0.75) return "tall"
  return "square"
}

export function findRoomIndexContainingPoint(
  rooms: Array<{ cells: Array<{ x: number; y: number }> }>,
  point: { x: number; y: number },
) {
  return rooms.findIndex((room) => room.cells.some((cell) => cell.x === point.x && cell.y === point.y))
}

export function isRoomBorderCell(room: { cells: Array<{ x: number; y: number }> }, point: { x: number; y: number }) {
  const occupied = new Set(room.cells.map((cell) => `${cell.x},${cell.y}`))
  if (!occupied.has(`${point.x},${point.y}`)) return false
  const neighbors = [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ]
  return neighbors.some((neighbor) => !occupied.has(`${neighbor.x},${neighbor.y}`))
}

export function isRectRoomCorner(
  room: { shape: string; x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
) {
  if (room.shape !== "rect") return false
  const maxX = room.x + room.width - 1
  const maxY = room.y + room.height - 1
  const onXEdge = point.x === room.x || point.x === maxX
  const onYEdge = point.y === room.y || point.y === maxY
  return onXEdge && onYEdge
}

export function directionBetweenPoints(from: { x: number; y: number }, to: { x: number; y: number }) {
  if (to.x > from.x) return "east"
  if (to.x < from.x) return "west"
  if (to.y > from.y) return "south"
  if (to.y < from.y) return "north"
  return undefined
}

export function corridorCells(points: Array<{ x: number; y: number }>) {
  const cells: Array<{ x: number; y: number }> = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]

    if (start.x === end.x) {
      const step = start.y <= end.y ? 1 : -1
      for (let y = start.y; y !== end.y + step; y += step) {
        if (index > 0 && y === start.y) continue
        cells.push({ x: start.x, y })
      }
      continue
    }

    const step = start.x <= end.x ? 1 : -1
    for (let x = start.x; x !== end.x + step; x += step) {
      if (index > 0 && x === start.x) continue
      cells.push({ x, y: start.y })
    }
  }

  return cells
}

export function corridorStepCount(points: Array<{ x: number; y: number }>) {
  return Math.max(0, corridorCells(points).length - 1)
}

export function buildCorridorClusters(corridors: Array<{ points: Array<{ x: number; y: number }> }>) {
  const corridorIndexesByCell = new Map<string, number[]>()

  corridors.forEach((corridor, corridorIndex) => {
    corridorCells(corridor.points).forEach((cell) => {
      const key = `${cell.x},${cell.y}`
      const indexes = corridorIndexesByCell.get(key)
      if (indexes) indexes.push(corridorIndex)
      else corridorIndexesByCell.set(key, [corridorIndex])
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
  const clusters: number[][] = []

  for (let corridorIndex = 0; corridorIndex < corridors.length; corridorIndex += 1) {
    if (visited.has(corridorIndex)) continue
    const queue = [corridorIndex]
    const cluster: number[] = []
    visited.add(corridorIndex)

    while (queue.length > 0) {
      const current = queue.shift()
      if (current === undefined) break
      cluster.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }

    clusters.push(cluster)
  }

  return clusters
}

function buildCorridorAxisMap(points: Array<{ x: number; y: number }>) {
  const map = new Map<string, Set<"horizontal" | "vertical">>()

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]

    if (previous.x === current.x) {
      const step = previous.y <= current.y ? 1 : -1
      for (let y = previous.y; y !== current.y + step; y += step) {
        if (index > 1 && y === previous.y) continue
        const key = `${previous.x},${y}`
        const axes = map.get(key) ?? new Set<"horizontal" | "vertical">()
        axes.add("vertical")
        map.set(key, axes)
      }
      continue
    }

    if (previous.y === current.y) {
      const step = previous.x <= current.x ? 1 : -1
      for (let x = previous.x; x !== current.x + step; x += step) {
        if (index > 1 && x === previous.x) continue
        const key = `${x},${previous.y}`
        const axes = map.get(key) ?? new Set<"horizontal" | "vertical">()
        axes.add("horizontal")
        map.set(key, axes)
      }
    }
  }

  return map
}

export function hasParallelAdjacentRunBetween(
  firstPoints: Array<{ x: number; y: number }>,
  secondPoints: Array<{ x: number; y: number }>,
) {
  const firstAxes = buildCorridorAxisMap(firstPoints)
  const secondAxes = buildCorridorAxisMap(secondPoints)
  let horizontalRun = 0
  let verticalRun = 0

  for (const [key, axes] of firstAxes.entries()) {
    const [xText, yText] = key.split(",")
    const x = Number(xText)
    const y = Number(yText)

    if (axes.has("horizontal")) {
      const hasNeighbor = secondAxes.get(`${x},${y - 1}`)?.has("horizontal") || secondAxes.get(`${x},${y + 1}`)?.has("horizontal")
      horizontalRun = hasNeighbor ? horizontalRun + 1 : 0
      if (horizontalRun >= 2) return true
    }

    if (axes.has("vertical")) {
      const hasNeighbor = secondAxes.get(`${x - 1},${y}`)?.has("vertical") || secondAxes.get(`${x + 1},${y}`)?.has("vertical")
      verticalRun = hasNeighbor ? verticalRun + 1 : 0
      if (verticalRun >= 2) return true
    }
  }

  return false
}

export function directCorridorRoomAdjacency(
  rooms: Array<{ cells: Array<{ x: number; y: number }> }>,
  corridors: Array<{ points: Array<{ x: number; y: number }> }>,
) {
  const adjacency = new Map<number, Set<number>>()

  for (const corridor of corridors) {
    const startRoom = findRoomIndexContainingPoint(rooms, corridor.points[0])
    const endRoom = findRoomIndexContainingPoint(rooms, corridor.points[corridor.points.length - 1])
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

export function corridorRoomAdjacency(
  rooms: Array<{ kind: string; cells: Array<{ x: number; y: number }> }>,
  corridors: Array<{ points: Array<{ x: number; y: number }> }>,
) {
  const adjacency = new Map<number, Set<number>>()

  for (const cluster of buildCorridorClusters(corridors)) {
    const roomsInCluster = new Set<number>()

    for (const corridorIndex of cluster) {
      const corridor = corridors[corridorIndex]
      const startRoom = findRoomIndexContainingPoint(rooms, corridor.points[0])
      const endRoom = findRoomIndexContainingPoint(rooms, corridor.points[corridor.points.length - 1])

      if (startRoom >= 0) roomsInCluster.add(startRoom)
      if (endRoom >= 0) roomsInCluster.add(endRoom)
    }

    const roomIndexes = [...roomsInCluster]
    for (let firstIndex = 0; firstIndex < roomIndexes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < roomIndexes.length; secondIndex += 1) {
        const firstRoom = roomIndexes[firstIndex]
        const secondRoom = roomIndexes[secondIndex]
        const firstNeighbors = adjacency.get(firstRoom) ?? new Set<number>()
        const secondNeighbors = adjacency.get(secondRoom) ?? new Set<number>()
        firstNeighbors.add(secondRoom)
        secondNeighbors.add(firstRoom)
        adjacency.set(firstRoom, firstNeighbors)
        adjacency.set(secondRoom, secondNeighbors)
      }
    }
  }

  return adjacency
}
