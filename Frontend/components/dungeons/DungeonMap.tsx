"use client"

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"

import { readDungeonMapDocument } from "@/lib/dungeons/adapter"
import type {
  DungeonCorridor,
  DungeonMapDocument,
  NormalizedDungeonMap,
} from "@/lib/dungeons/types"
import { fetchJsonAsset } from "@/lib/services/asset-api.service"
import {
  buildEditedDungeonWithCorridors,
  createNextCorridorId,
  corridorCellKeySet,
  findGridPath,
  movePoint,
  normalizedDungeonToDocument,
  pickRoomSideAnchor,
  pointKey,
  rebuildDoorsFromCorridors,
  compressPath,
  type Point,
  type RoomSideAnchor,
} from "./dungeon-map-editor"
import styles from "./DungeonMap.module.css"

type DungeonMapProps = {
  dataUrl: string
  onLoadError?: (message: string | null) => void
  onLoadComplete?: () => void
  onDocumentChange?: (document: DungeonMapDocument) => Promise<void> | void
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  origin: Point
}

type CorridorRenderSegment = {
  key: string
  corridorId: string
  point: Point
  left: number
  top: number
  width: number
  height: number
  color?: string
}

type ActiveTool = "none" | "remove-corridor" | "create-corridor"

const BASE_CELL_SIZE = 32
const ROOM_SPAN_OVERLAP_PX = 1
const DOOR_VISUAL_THICKNESS = 0.22
const HOME_PADDING_PX = 40
const MIN_SCALE = 0.2
const MAX_SCALE = 4
const ZOOM_SENSITIVITY = 0.0015

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function corridorDebugColor(index: number) {
  const hue = (index * 67) % 360
  return `hsl(${hue} 72% 58%)`
}

function findNearestRoomForPoint(dungeon: NormalizedDungeonMap, point: Point) {
  let bestRoom: NormalizedDungeonMap["rooms"][number] | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const room of dungeon.rooms) {
    for (const cell of room.cells) {
      const distance = Math.abs(cell.x - point.x) + Math.abs(cell.y - point.y)
      if (distance >= bestDistance) continue
      bestDistance = distance
      bestRoom = room
      if (distance === 0) return room
    }
  }

  return bestRoom
}

function roomClassName(kind: NormalizedDungeonMap["rooms"][number]["kind"]) {
  if (kind === "start") return `${styles.room} ${styles.roomStart}`
  if (kind === "boss") return `${styles.room} ${styles.roomBoss}`
  if (kind === "treasure") return `${styles.room} ${styles.roomTreasure}`
  return styles.room
}

function doorClassName(kind: NormalizedDungeonMap["doors"][number]["kind"]) {
  if (kind === "locked") return `${styles.door} ${styles.doorLocked}`
  if (kind === "secret") return `${styles.door} ${styles.doorSecret}`
  return styles.door
}

function roomLabelStyle(room: NormalizedDungeonMap["rooms"][number], renderOrigin: { x: number; y: number }) {
  return {
    left: `${(room.labelAnchor.x - renderOrigin.x) * BASE_CELL_SIZE}px`,
    top: `${(room.labelAnchor.y - renderOrigin.y) * BASE_CELL_SIZE}px`,
  }
}

function roomSpanStyle(span: { x: number; y: number; width: number; height: number }, renderOrigin: { x: number; y: number }) {
  const left = (span.x - renderOrigin.x) * BASE_CELL_SIZE
  const top = (span.y - renderOrigin.y) * BASE_CELL_SIZE
  const width = span.width * BASE_CELL_SIZE
  const height = span.height * BASE_CELL_SIZE

  return {
    left: `${left - ROOM_SPAN_OVERLAP_PX / 2}px`,
    top: `${top - ROOM_SPAN_OVERLAP_PX / 2}px`,
    width: `${width + ROOM_SPAN_OVERLAP_PX}px`,
    height: `${height + ROOM_SPAN_OVERLAP_PX}px`,
  }
}

function doorStyle(
  door: NormalizedDungeonMap["doors"][number],
  renderOrigin: { x: number; y: number },
): CSSProperties | null {
  if (!door.direction) return null

  const length = 1
  const thickness = DOOR_VISUAL_THICKNESS
  const cellX = door.x - renderOrigin.x
  const cellY = door.y - renderOrigin.y

  if (door.direction === "east") {
    return {
      left: `${(cellX + 1 - thickness / 2) * BASE_CELL_SIZE}px`,
      top: `${(cellY + 0.5 - length / 2) * BASE_CELL_SIZE}px`,
      width: `${thickness * BASE_CELL_SIZE}px`,
      height: `${length * BASE_CELL_SIZE}px`,
    }
  }

  if (door.direction === "west") {
    return {
      left: `${(cellX - thickness / 2) * BASE_CELL_SIZE}px`,
      top: `${(cellY + 0.5 - length / 2) * BASE_CELL_SIZE}px`,
      width: `${thickness * BASE_CELL_SIZE}px`,
      height: `${length * BASE_CELL_SIZE}px`,
    }
  }

  if (door.direction === "south") {
    return {
      left: `${(cellX + 0.5 - length / 2) * BASE_CELL_SIZE}px`,
      top: `${(cellY + 1 - thickness / 2) * BASE_CELL_SIZE}px`,
      width: `${length * BASE_CELL_SIZE}px`,
      height: `${thickness * BASE_CELL_SIZE}px`,
    }
  }

  return {
    left: `${(cellX + 0.5 - length / 2) * BASE_CELL_SIZE}px`,
    top: `${(cellY - thickness / 2) * BASE_CELL_SIZE}px`,
    width: `${length * BASE_CELL_SIZE}px`,
    height: `${thickness * BASE_CELL_SIZE}px`,
  }
}

function createInitialCamera(dungeon: NormalizedDungeonMap, viewport: { width: number; height: number }) {
  const worldWidth = Math.max(BASE_CELL_SIZE, dungeon.bounds.width * BASE_CELL_SIZE)
  const worldHeight = Math.max(BASE_CELL_SIZE, dungeon.bounds.height * BASE_CELL_SIZE)

  if (viewport.width <= 0 || viewport.height <= 0) {
    return {
      scale: 1,
      offset: {
        x: HOME_PADDING_PX,
        y: HOME_PADDING_PX,
      },
    }
  }

  const usableWidth = Math.max(1, viewport.width - HOME_PADDING_PX * 2)
  const usableHeight = Math.max(1, viewport.height - HOME_PADDING_PX * 2)
  const scale = clamp(Math.min(usableWidth / worldWidth, usableHeight / worldHeight), MIN_SCALE, MAX_SCALE)
  const offsetX = (viewport.width - worldWidth * scale) / 2
  const offsetY = (viewport.height - worldHeight * scale) / 2

  return {
    scale,
    offset: { x: offsetX, y: offsetY },
  }
}

function buildCorridorSegments(points: Array<{ x: number; y: number }>, width: number, roomOccupiedCells: Set<string>) {
  const occupiedCells = new Map<string, Point>()
  const safeWidth = Math.max(1, Math.round(width))
  const offsetMin = -Math.floor((safeWidth - 1) / 2)
  const offsetMax = offsetMin + safeWidth - 1

  const occupy = (x: number, y: number) => {
    if (roomOccupiedCells.has(`${x},${y}`)) return
    for (let offsetY = offsetMin; offsetY <= offsetMax; offsetY += 1) {
      for (let offsetX = offsetMin; offsetX <= offsetMax; offsetX += 1) {
        occupiedCells.set(`${x + offsetX},${y + offsetY}`, { x: x + offsetX, y: y + offsetY })
      }
    }
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]

    if (previous.x === current.x) {
      const start = Math.min(previous.y, current.y)
      const end = Math.max(previous.y, current.y)
      for (let y = start; y <= end; y += 1) {
        if (index > 1 && y === previous.y) continue
        occupy(previous.x, y)
      }
      continue
    }

    if (previous.y === current.y) {
      const start = Math.min(previous.x, current.x)
      const end = Math.max(previous.x, current.x)
      for (let x = start; x <= end; x += 1) {
        if (index > 1 && x === previous.x) continue
        occupy(x, previous.y)
      }
    }
  }

  const segments: Array<{ point: Point; left: number; top: number; width: number; height: number }> = []

  for (const [, point] of occupiedCells) {
    segments.push({
      point,
      left: point.x,
      top: point.y,
      width: 1,
      height: 1,
    })
  }

  return segments
}

export default function DungeonMap({
  dataUrl,
  onLoadError,
  onLoadComplete,
  onDocumentChange,
}: DungeonMapProps) {
  const isEditable = typeof onDocumentChange === "function"
  const [dungeon, setDungeon] = useState<NormalizedDungeonMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [showCorridorDebug, setShowCorridorDebug] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>("none")
  const [pendingCorridorAnchor, setPendingCorridorAnchor] = useState<RoomSideAnchor | null>(null)
  const [isPersistingEdit, setIsPersistingEdit] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastAutoFitDataUrlRef = useRef<string | null>(null)
  const onLoadErrorRef = useRef(onLoadError)
  const onLoadCompleteRef = useRef(onLoadComplete)

  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  }, [onLoadError])

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete
  }, [onLoadComplete])

  const renderOrigin = useMemo(
    () => ({ x: dungeon?.bounds.originX ?? 0, y: dungeon?.bounds.originY ?? 0 }),
    [dungeon?.bounds.originX, dungeon?.bounds.originY],
  )

  const roomOccupiedCells = useMemo(() => {
    const occupied = new Set<string>()
    if (!dungeon) return occupied
    for (const room of dungeon.rooms) {
      for (const cell of room.cells) {
        occupied.add(`${cell.x},${cell.y}`)
      }
    }
    return occupied
  }, [dungeon])

  const roomByCell = useMemo(() => {
    const roomLookup = new Map<string, NormalizedDungeonMap["rooms"][number]>()
    if (!dungeon) return roomLookup

    for (const room of dungeon.rooms) {
      for (const cell of room.cells) {
        roomLookup.set(pointKey(cell), room)
      }
    }

    return roomLookup
  }, [dungeon])

  const roomIndexById = useMemo(() => {
    const indexById = new Map<string, number>()
    if (!dungeon) return indexById

    dungeon.rooms.forEach((room, index) => {
      indexById.set(room.id, index + 1)
    })

    return indexById
  }, [dungeon])

  const corridorCellKeys = useMemo(
    () => dungeon ? corridorCellKeySet(dungeon.corridors) : new Set<string>(),
    [dungeon],
  )

  useEffect(() => {
    let isActive = true
    setDungeon(null)
    setError(null)
    setIsDragging(false)
    setActiveTool("none")
    setPendingCorridorAnchor(null)
    dragRef.current = null
    lastAutoFitDataUrlRef.current = null
    onLoadErrorRef.current?.(null)

    void fetchJsonAsset<unknown>(dataUrl)
      .then((raw) => {
        if (!isActive) return
        const normalized = readDungeonMapDocument(raw)
        setDungeon(normalized)
        onLoadCompleteRef.current?.()
      })
      .catch((cause) => {
        if (!isActive) return
        const message = cause instanceof Error ? cause.message : "No se pudo cargar el mapa de mazmorra."
        setError(message)
        onLoadErrorRef.current?.(message)
      })

    return () => {
      isActive = false
    }
  }, [dataUrl])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const syncViewportSize = () => {
      setViewportSize({
        width: root.clientWidth,
        height: root.clientHeight,
      })
    }

    syncViewportSize()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      syncViewportSize()
    })

    resizeObserver.observe(root)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!dungeon || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return
    }

    if (lastAutoFitDataUrlRef.current === dataUrl) {
      return
    }

    const camera = createInitialCamera(dungeon, viewportSize)
    setScale(camera.scale)
    setOffset(camera.offset)
    setIsDragging(false)
    dragRef.current = null
    lastAutoFitDataUrlRef.current = dataUrl
  }, [dataUrl, dungeon, viewportSize.height, viewportSize.width])

  const worldSize = useMemo(() => {
    if (!dungeon) {
      return { width: 0, height: 0 }
    }

    return {
      width: dungeon.bounds.width * BASE_CELL_SIZE,
      height: dungeon.bounds.height * BASE_CELL_SIZE,
    }
  }, [dungeon])

  const corridorSegmentsById = useMemo(() => {
    const segmentsById = new Map<string, CorridorRenderSegment[]>()
    if (!dungeon) return segmentsById

    dungeon.corridors.forEach((corridor, corridorIndex) => {
      segmentsById.set(
        corridor.id,
        buildCorridorSegments(corridor.points, corridor.width ?? 1, roomOccupiedCells).map((segment, index) => ({
          key: `${corridor.id}-${segment.point.x}-${segment.point.y}-${corridorIndex}-${index}`,
          corridorId: corridor.id,
          ...segment,
        })),
      )
    })

    return segmentsById
  }, [dungeon, roomOccupiedCells])

  const corridorSegments = useMemo(
    () => [...corridorSegmentsById.values()].flat(),
    [corridorSegmentsById],
  )

  const debugCorridors = useMemo(() => {
    if (!dungeon) {
      return [] as Array<{
        id: string
        color: string
        segments: Array<{ key: string; left: number; top: number; width: number; height: number }>
        label: { key: string; text: string; x: number; y: number }
      }>
    }
    return dungeon.corridors.map((corridor, index) => {
      const color = corridorDebugColor(index)
      const start = corridor.points[0]
      const end = corridor.points[corridor.points.length - 1]
      const startRoom = roomByCell.get(pointKey(start)) ?? findNearestRoomForPoint(dungeon, start)
      const endRoom = roomByCell.get(pointKey(end)) ?? findNearestRoomForPoint(dungeon, end)
      const startRoomIndex = startRoom ? String(roomIndexById.get(startRoom.id) ?? startRoom.id) : "?"
      const endRoomIndex = endRoom ? String(roomIndexById.get(endRoom.id) ?? endRoom.id) : "?"

        return {
          id: corridor.id,
          color,
          segments: corridorSegmentsById.get(corridor.id) ?? [],
        label: {
          key: `${corridor.id}-${index}-start`,
          text: `${startRoomIndex} -> ${endRoomIndex} : ${index + 1}`,
          x: start.x,
          y: start.y,
        },
      }
    })
  }, [corridorSegmentsById, dungeon, roomByCell, roomIndexById])

  const contentStyle = useMemo<CSSProperties>(() => ({
    width: `${worldSize.width}px`,
    height: `${worldSize.height}px`,
    transform: `matrix(${scale}, 0, 0, ${scale}, ${offset.x}, ${offset.y})`,
    transformOrigin: "top left",
  }), [offset.x, offset.y, scale, worldSize.height, worldSize.width])

  const gridStyle = useMemo<CSSProperties>(() => {
    const minor = Math.max(BASE_CELL_SIZE * scale, 1)
    const major = Math.max(BASE_CELL_SIZE * 5 * scale, 5)

    return {
      backgroundSize: `${minor}px ${minor}px, ${minor}px ${minor}px, ${major}px ${major}px, ${major}px ${major}px`,
      backgroundPosition: `${offset.x}px ${offset.y}px, ${offset.x}px ${offset.y}px, ${offset.x}px ${offset.y}px, ${offset.x}px ${offset.y}px`,
    }
  }, [offset.x, offset.y, scale])

  const isEditToolActive = isEditable && activeTool !== "none"

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!rootRef.current) return
    event.preventDefault()

    const rect = rootRef.current.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top
    const nextScale = clamp(scale * Math.exp(-event.deltaY * ZOOM_SENSITIVITY), MIN_SCALE, MAX_SCALE)
    const scaleRatio = nextScale / scale

    setOffset((current) => ({
      x: pointerX - (pointerX - current.x) * scaleRatio,
      y: pointerY - (pointerY - current.y) * scaleRatio,
    }))
    setScale(nextScale)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isEditable && activeTool !== "none") {
      return
    }
    event.preventDefault()
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origin: offset,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setOffset({
      x: drag.origin.x + (event.clientX - drag.startClientX),
      y: drag.origin.y + (event.clientY - drag.startClientY),
    })
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const persistDungeonChange = async (
    nextDungeon: NormalizedDungeonMap,
    previousDungeon: NormalizedDungeonMap,
  ) => {
    if (!isEditable || !onDocumentChange) {
      setDungeon(nextDungeon)
      return
    }

    setDungeon(nextDungeon)
    setIsPersistingEdit(true)
    setError(null)

    try {
      await onDocumentChange(normalizedDungeonToDocument(nextDungeon))
    } catch (cause) {
      setDungeon(previousDungeon)
      const message = cause instanceof Error ? cause.message : "No se pudo guardar la mazmorra editada."
      setError(message)
      onLoadErrorRef.current?.(message)
    } finally {
      setIsPersistingEdit(false)
    }
  }

  const handleCorridorRemove = (corridorId: string) => {
    if (!dungeon || isPersistingEdit) return

    const nextCorridors = dungeon.corridors.filter((corridor) => corridor.id !== corridorId)
    if (nextCorridors.length === dungeon.corridors.length) return

    const nextDungeon = {
      ...dungeon,
      corridors: nextCorridors,
      doors: rebuildDoorsFromCorridors(dungeon, nextCorridors),
    }

    void persistDungeonChange(nextDungeon, dungeon)
  }

  const handleCreateCorridorFromRoom = (
    room: NormalizedDungeonMap["rooms"][number],
    span: { x: number; y: number; width: number; height: number },
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isEditable || !dungeon || activeTool !== "create-corridor" || isPersistingEdit) return

    const anchor = pickRoomSideAnchor(room, span, event, event.currentTarget.getBoundingClientRect())
    if (!pendingCorridorAnchor) {
      setPendingCorridorAnchor(anchor)
      return
    }

    if (pendingCorridorAnchor.roomId === anchor.roomId && pendingCorridorAnchor.point.x === anchor.point.x && pendingCorridorAnchor.point.y === anchor.point.y) {
      setPendingCorridorAnchor(anchor)
      return
    }

    const startHub = movePoint(pendingCorridorAnchor.point, pendingCorridorAnchor.direction)
    const endHub = movePoint(anchor.point, anchor.direction)
    const blockedRoomCells = new Set<string>(roomOccupiedCells)
    blockedRoomCells.delete(pointKey(pendingCorridorAnchor.point))
    blockedRoomCells.delete(pointKey(anchor.point))
    const route = findGridPath(startHub, endHub, dungeon.bounds, blockedRoomCells, corridorCellKeys)
    if (!route) return

    const nextCorridor: DungeonCorridor = {
      id: createNextCorridorId(dungeon.corridors),
      points: compressPath([pendingCorridorAnchor.point, ...route, anchor.point]),
      width: 1,
    }
    const nextDungeon = buildEditedDungeonWithCorridors(dungeon, [...dungeon.corridors, nextCorridor])

    setPendingCorridorAnchor(null)
    void persistDungeonChange(nextDungeon, dungeon)
  }

  const handleCreateCorridorToIntersection = (_corridorId: string, point: Point) => {
    if (!isEditable || !dungeon || activeTool !== "create-corridor" || !pendingCorridorAnchor || isPersistingEdit) return

    const startHub = movePoint(pendingCorridorAnchor.point, pendingCorridorAnchor.direction)
    const blockedRoomCells = new Set<string>(roomOccupiedCells)
    blockedRoomCells.delete(pointKey(pendingCorridorAnchor.point))
    const route = findGridPath(startHub, point, dungeon.bounds, blockedRoomCells, corridorCellKeys)
    if (!route) return

    const nextCorridor: DungeonCorridor = {
      id: createNextCorridorId(dungeon.corridors),
      points: compressPath([pendingCorridorAnchor.point, ...route]),
      width: 1,
    }
    const nextDungeon = buildEditedDungeonWithCorridors(dungeon, [...dungeon.corridors, nextCorridor])

    setPendingCorridorAnchor(null)
    void persistDungeonChange(nextDungeon, dungeon)
  }

  if (error) {
    return <div className={styles.state}>{error}</div>
  }

  if (!dungeon) {
    return <div className={styles.state}>Cargando mazmorra...</div>
  }

  return (
    <div
      ref={rootRef}
      className={isDragging ? `${styles.root} ${styles.rootDragging}` : styles.root}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDragStart={(event) => event.preventDefault()}
    >
      {isEditable ? (
        <div
          className={styles.toolPanel}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className={styles.toolStack}>
            <button
              type="button"
              className={activeTool === "remove-corridor" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "remove-corridor"}
              title="Eliminar corredor"
              onClick={() => {
                setPendingCorridorAnchor(null)
                setActiveTool((current) => current === "remove-corridor" ? "none" : "remove-corridor")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M9 4 4 9l3 3-3 3 5 5 3-3 3 3 5-5-3-3 3-3-5-5-3 3-3-3Z" fill="currentColor" />
              </svg>
            </button>

            <button
              type="button"
              className={activeTool === "create-corridor" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "create-corridor"}
              title="Crear corredor"
              onClick={() => {
                setPendingCorridorAnchor(null)
                setActiveTool((current) => current === "create-corridor" ? "none" : "create-corridor")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M4 11h6V5h4v6h6v4h-6v6h-4v-6H4z" fill="currentColor" />
              </svg>
            </button>

          </div>
        </div>
      ) : null}

      <div
        className={styles.debugPanel}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <label className={styles.debugCheckboxLabel}>
          <input
            type="checkbox"
            checked={showCorridorDebug}
            onChange={(event) => setShowCorridorDebug(event.target.checked)}
          />
          Debug corredores
        </label>
      </div>

      <div className={styles.gridBackdrop} style={gridStyle} aria-hidden="true" />

      <div className={styles.content} style={contentStyle}>
        <div className={styles.frame} />

        {(showCorridorDebug ? debugCorridors.flatMap((corridor) => corridor.segments.map((segment) => ({ ...segment, color: corridor.color }))) : corridorSegments).map((segment) => (
          <div
            key={segment.key}
            className={styles.corridor}
            role={isEditToolActive ? "button" : undefined}
            tabIndex={isEditToolActive ? 0 : undefined}
            style={{
              left: `${(segment.left - renderOrigin.x) * BASE_CELL_SIZE}px`,
              top: `${(segment.top - renderOrigin.y) * BASE_CELL_SIZE}px`,
              width: `${segment.width * BASE_CELL_SIZE}px`,
              height: `${segment.height * BASE_CELL_SIZE}px`,
              background: "color" in segment ? segment.color : undefined,
              cursor: isEditToolActive ? "pointer" : undefined,
            }}
            onPointerDown={isEditToolActive ? (event) => {
              event.stopPropagation()
              event.preventDefault()
            } : undefined}
            onClick={isEditToolActive ? (event) => {
              event.stopPropagation()
              if (activeTool === "remove-corridor") {
                handleCorridorRemove(segment.corridorId)
                return
              }
              handleCreateCorridorToIntersection(segment.corridorId, segment.point)
            } : undefined}
            onKeyDown={isEditToolActive ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              event.stopPropagation()
              if (activeTool === "remove-corridor") {
                handleCorridorRemove(segment.corridorId)
                return
              }
              handleCreateCorridorToIntersection(segment.corridorId, segment.point)
            } : undefined}
          />
        ))}

        {showCorridorDebug
          ? debugCorridors.map((corridor) => (
              <div
                key={corridor.label.key}
                className={styles.corridorDebugLabel}
                style={{
                  left: `${(corridor.label.x - renderOrigin.x + 0.5) * BASE_CELL_SIZE}px`,
                  top: `${(corridor.label.y - renderOrigin.y + 0.5) * BASE_CELL_SIZE}px`,
                  borderColor: corridor.color,
                }}
              >
                {corridor.label.text}
              </div>
            ))
          : null}

        {dungeon.rooms.map((room) => (
          <Fragment key={room.id}>
            {room.spans.map((span, index) => (
              <div
                key={`${room.id}-span-${index}`}
                className={roomClassName(room.kind)}
                style={roomSpanStyle(span, renderOrigin)}
                role={isEditable && activeTool === "create-corridor" ? "button" : undefined}
                tabIndex={isEditable && activeTool === "create-corridor" ? 0 : undefined}
                onPointerDown={isEditable && activeTool === "create-corridor" ? (event) => {
                  event.stopPropagation()
                } : undefined}
                onClick={isEditable && activeTool === "create-corridor" ? (event) => {
                  event.stopPropagation()
                  handleCreateCorridorFromRoom(room, span, event)
                } : undefined}
              />
            ))}

            {room.label ? (
              <div className={styles.roomLabelWrap} style={roomLabelStyle(room, renderOrigin)}>
                <div className={styles.label}>{room.label}</div>
              </div>
            ) : null}
          </Fragment>
        ))}

        {dungeon.doors.map((door) => {
          const style = doorStyle(door, renderOrigin)
          if (!style) return null
          return (
            <Fragment key={door.id}>
              <div className={doorClassName(door.kind)} style={style} />
            </Fragment>
          )
        })}

        {isEditable && pendingCorridorAnchor ? (
          <div
            className={styles.pendingAnchor}
            style={{
              left: `${(pendingCorridorAnchor.point.x - renderOrigin.x + 0.5) * BASE_CELL_SIZE}px`,
              top: `${(pendingCorridorAnchor.point.y - renderOrigin.y + 0.5) * BASE_CELL_SIZE}px`,
            }}
          />
        ) : null}

        {dungeon.markers.map((marker) => (
          <div
            key={marker.id}
            className={styles.markerWrap}
            style={{
              left: `${(marker.x - renderOrigin.x) * BASE_CELL_SIZE}px`,
              top: `${(marker.y - renderOrigin.y) * BASE_CELL_SIZE}px`,
            }}
          >
            <div className={styles.marker} />
            {marker.label ? <div className={styles.markerLabel}>{marker.label}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
