"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { readDungeonMapDocument } from "@/lib/dungeons/adapter"
import {
  createNextDungeonLightId,
  normalizeDungeonLightSource,
} from "@/lib/dungeons/lights"
import type {
  DungeonCorridor,
  DungeonLightOrientation,
  DungeonMapDocument,
  NormalizedDungeonMap,
} from "@/lib/dungeons/types"
import { fetchJsonAsset } from "@/lib/services/asset-api.service"
import {
  buildEditedDungeonWithCorridors,
  compressPathPreservingPoints,
  createNextCorridorId,
  corridorCells,
  corridorCellKeySet,
  findGridPath,
  movePoint,
  normalizedDungeonToDocument,
  pickRoomSideAnchorFromPoint,
  pointKey,
  rebuildDoorsFromCorridors,
  type Point,
  type RoomSideAnchor,
} from "./dungeon-map-editor"
import {
  DEFAULT_DUNGEON_DISPLAY_STYLE,
  type DungeonDisplayStyle,
} from "./canvas/render-types"
import DungeonCanvas from "./DungeonCanvas"
import styles from "./DungeonMap.module.css"

export { DEFAULT_DUNGEON_DISPLAY_STYLE }
export type { DungeonDisplayStyle }

type MapFocusPoint = {
  x: number
  y: number
  requestId: number
}

type DungeonMapProps = {
  dataUrl: string
  onLoadError?: (message: string | null) => void
  onLoadComplete?: () => void
  onDungeonLoad?: (dungeon: NormalizedDungeonMap) => void
  openDoorIds?: ReadonlySet<string>
  onOpenDoorIdsChange?: (openDoorIds: Set<string>) => void
  doorToggleEnabled?: boolean
  onDocumentChange?: (document: DungeonMapDocument) => Promise<void> | void
  displayStyle?: Partial<DungeonDisplayStyle>
  lightingOverlayEnabled?: boolean
  lightingOverlayShowRadiusRings?: boolean
  mapOverlay?: ReactNode
  toolPanelAddon?: ReactNode
  focusPoint?: MapFocusPoint | null
}

type ActiveTool = "none" | "remove-corridor" | "create-corridor" | "place-light" | "remove-light"

const LIGHT_ORIENTATIONS: DungeonLightOrientation[] = ["north", "east", "south", "west"]

function normalizeLightRadius(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export default function DungeonMap({
  dataUrl,
  onLoadError,
  onLoadComplete,
  onDungeonLoad,
  openDoorIds: controlledOpenDoorIds,
  onOpenDoorIdsChange,
  doorToggleEnabled = true,
  onDocumentChange,
  displayStyle,
  lightingOverlayEnabled = false,
  lightingOverlayShowRadiusRings = false,
  mapOverlay,
  toolPanelAddon,
  focusPoint,
}: DungeonMapProps) {
  const isEditable = typeof onDocumentChange === "function"
  const [dungeon, setDungeon] = useState<NormalizedDungeonMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uncontrolledOpenDoorIds, setUncontrolledOpenDoorIds] = useState<Set<string>>(() => new Set())
  const [activeTool, setActiveTool] = useState<ActiveTool>("none")
  const [lightingPreviewEnabled, setLightingPreviewEnabled] = useState(false)
  const [newLightBrightRadiusCells, setNewLightBrightRadiusCells] = useState(4)
  const [newLightDimRadiusCells, setNewLightDimRadiusCells] = useState(8)
  const [newLightWallMounted, setNewLightWallMounted] = useState(false)
  const [newLightOrientation, setNewLightOrientation] = useState<DungeonLightOrientation>("south")
  const [newLightManualOrientation, setNewLightManualOrientation] = useState(false)
  const [hoveredDungeonCell, setHoveredDungeonCell] = useState<Point | null>(null)
  const [pendingCorridorAnchor, setPendingCorridorAnchor] = useState<RoomSideAnchor | null>(null)
  const [pendingCorridorPoint, setPendingCorridorPoint] = useState<Point | null>(null)
  const [pendingCorridorWaypoints, setPendingCorridorWaypoints] = useState<Point[]>([])
  const [isPersistingEdit, setIsPersistingEdit] = useState(false)
  const onLoadErrorRef = useRef(onLoadError)
  const onLoadCompleteRef = useRef(onLoadComplete)
  const onDungeonLoadRef = useRef(onDungeonLoad)

  useEffect(() => {
    onLoadErrorRef.current = onLoadError
  }, [onLoadError])

  useEffect(() => {
    onLoadCompleteRef.current = onLoadComplete
  }, [onLoadComplete])

  useEffect(() => {
    onDungeonLoadRef.current = onDungeonLoad
  }, [onDungeonLoad])

  useEffect(() => {
    if (!controlledOpenDoorIds) {
      onOpenDoorIdsChange?.(new Set(uncontrolledOpenDoorIds))
    }
  }, [controlledOpenDoorIds, onOpenDoorIdsChange, uncontrolledOpenDoorIds])

  const openDoorIds = useMemo(() => new Set(controlledOpenDoorIds ?? uncontrolledOpenDoorIds), [
    controlledOpenDoorIds,
    uncontrolledOpenDoorIds,
  ])

  const effectiveDisplayStyle = useMemo<DungeonDisplayStyle>(() => ({
    ...DEFAULT_DUNGEON_DISPLAY_STYLE,
    ...displayStyle,
  }), [displayStyle])

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

  const corridorCellKeys = useMemo(
    () => dungeon ? corridorCellKeySet(dungeon.corridors) : new Set<string>(),
    [dungeon],
  )

  const floorCellKeys = useMemo(() => {
    const occupied = new Set(roomOccupiedCells)
    for (const key of corridorCellKeys) {
      occupied.add(key)
    }
    return occupied
  }, [corridorCellKeys, roomOccupiedCells])

  useEffect(() => {
    if (!isEditable || activeTool !== "place-light") return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return

      event.preventDefault()
      if (dungeon && hoveredDungeonCell) {
        const hoveredLight = dungeon.lights.find((light) => light.x === hoveredDungeonCell.x && light.y === hoveredDungeonCell.y)
        if (hoveredLight) {
          const currentIndex = LIGHT_ORIENTATIONS.indexOf(hoveredLight.orientation)
          const nextOrientation = LIGHT_ORIENTATIONS[(currentIndex + 1) % LIGHT_ORIENTATIONS.length]
          const nextLights = dungeon.lights.map((light) => light.id === hoveredLight.id
            ? { ...light, orientation: nextOrientation, wallMounted: true }
            : light)
          void persistDungeonChange({ ...dungeon, lights: nextLights }, dungeon)
          return
        }
      }

      setNewLightManualOrientation(true)
      setNewLightOrientation((current) => {
        const currentIndex = LIGHT_ORIENTATIONS.indexOf(current)
        return LIGHT_ORIENTATIONS[(currentIndex + 1) % LIGHT_ORIENTATIONS.length]
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeTool, dungeon, hoveredDungeonCell, isEditable])

  useEffect(() => {
    let isActive = true
    setError(null)
    setUncontrolledOpenDoorIds(new Set())
    setPendingCorridorAnchor(null)
    setPendingCorridorPoint(null)
    setPendingCorridorWaypoints([])
    onLoadErrorRef.current?.(null)

    void fetchJsonAsset<unknown>(dataUrl)
      .then((raw) => {
        if (!isActive) return
        const normalized = readDungeonMapDocument(raw)
        setDungeon(normalized)
        onDungeonLoadRef.current?.(normalized)
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

  const handleDoorToggle = (doorId: string) => {
    const next = new Set(openDoorIds)
    if (next.has(doorId)) {
      next.delete(doorId)
    } else {
      next.add(doorId)
    }

    if (controlledOpenDoorIds) {
      onOpenDoorIdsChange?.(next)
      return
    }

    setUncontrolledOpenDoorIds(next)
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

    const removedCorridor = dungeon.corridors.find((corridor) => corridor.id === corridorId)
    if (!removedCorridor) return

    const nextCorridors = dungeon.corridors.filter((corridor) => corridor.id !== corridorId)
    const remainingCorridorCells = corridorCellKeySet(nextCorridors)
    const removedOnlyCells = new Set(
      corridorCells(removedCorridor.points)
        .map(pointKey)
        .filter((key) => !remainingCorridorCells.has(key)),
    )
    const nextLights = dungeon.lights.filter((light) => !removedOnlyCells.has(pointKey(light)))

    const nextDungeon = {
      ...dungeon,
      corridors: nextCorridors,
      doors: rebuildDoorsFromCorridors(dungeon, nextCorridors),
      lights: nextLights,
    }

    void persistDungeonChange(nextDungeon, dungeon)
  }

  const isPointWithinDungeonBounds = (point: Point) => {
    if (!dungeon) return false
    return point.x >= dungeon.bounds.originX
      && point.y >= dungeon.bounds.originY
      && point.x < dungeon.bounds.originX + dungeon.bounds.width
      && point.y < dungeon.bounds.originY + dungeon.bounds.height
  }

  const isFloorCell = (point: Point) => floorCellKeys.has(pointKey(point))
  const isDoorCell = (point: Point) => dungeon?.doors.some((door) => door.x === point.x && door.y === point.y) ?? false

  const isSamePoint = (first: Point | null | undefined, second: Point | null | undefined) => (
    Boolean(first && second && first.x === second.x && first.y === second.y)
  )

  const clearPendingCorridor = () => {
    setPendingCorridorAnchor(null)
    setPendingCorridorPoint(null)
    setPendingCorridorWaypoints([])
  }

  const routeCorridorThroughTargets = (
    start: Point,
    targets: Point[],
    blockedRoomCells: Set<string>,
  ) => {
    if (!dungeon) return null

    const route: Point[] = []
    const usedRouteCells = new Set<string>()
    let current = start

    for (const target of targets) {
      const blockedCells = new Set([...blockedRoomCells, ...usedRouteCells])
      blockedCells.delete(pointKey(current))
      blockedCells.delete(pointKey(target))

      const segment = findGridPath(current, target, dungeon.bounds, blockedCells, corridorCellKeys)
      if (!segment) return null
      route.push(...(route.length === 0 ? segment : segment.slice(1)))

      for (const point of segment) {
        usedRouteCells.add(pointKey(point))
      }

      current = target
    }

    return route
  }

  const finishPendingCorridor = (target: Point, endRoomPoint?: Point) => {
    if (!dungeon) return

    const startHub = pendingCorridorAnchor
      ? movePoint(pendingCorridorAnchor.point, pendingCorridorAnchor.direction)
      : pendingCorridorPoint
    if (!startHub) return

    const blockedRoomCells = new Set<string>(roomOccupiedCells)
    if (pendingCorridorAnchor) {
      blockedRoomCells.delete(pointKey(pendingCorridorAnchor.point))
    }
    if (endRoomPoint) {
      blockedRoomCells.delete(pointKey(endRoomPoint))
    }

    const route = routeCorridorThroughTargets(startHub, [...pendingCorridorWaypoints, target], blockedRoomCells)
    if (!route) return

    const nextCorridor: DungeonCorridor = {
      id: createNextCorridorId(dungeon.corridors),
      points: compressPathPreservingPoints(
        [
          ...(pendingCorridorAnchor ? [pendingCorridorAnchor.point] : []),
          ...route,
          ...(endRoomPoint ? [endRoomPoint] : []),
        ],
        pendingCorridorWaypoints,
      ),
      width: 1,
    }
    const nextDungeon = buildEditedDungeonWithCorridors(dungeon, [...dungeon.corridors, nextCorridor])

    clearPendingCorridor()
    void persistDungeonChange(nextDungeon, dungeon)
  }

  const adjacentWallDirections = (point: Point): DungeonLightOrientation[] => {
    if (!isFloorCell(point)) return []
    const candidates: Array<{ direction: DungeonLightOrientation; point: Point }> = [
      { direction: "north", point: { x: point.x, y: point.y - 1 } },
      { direction: "east", point: { x: point.x + 1, y: point.y } },
      { direction: "south", point: { x: point.x, y: point.y + 1 } },
      { direction: "west", point: { x: point.x - 1, y: point.y } },
    ]

    return candidates
      .filter((candidate) => !isPointWithinDungeonBounds(candidate.point) || !isFloorCell(candidate.point))
      .map((candidate) => candidate.direction)
  }

  const handleLightCellClick = (point: Point) => {
    if (!isEditable || !dungeon || isPersistingEdit) return
    if (!isPointWithinDungeonBounds(point)) return

    if (activeTool === "place-light") {
      const brightRadiusCells = normalizeLightRadius(newLightBrightRadiusCells, 4, 0, 64)
      const dimRadiusCells = normalizeLightRadius(newLightDimRadiusCells, 8, brightRadiusCells, 128)
      const existingLight = dungeon.lights.find((light) => light.x === point.x && light.y === point.y)
      if (existingLight) return
      if (isDoorCell(point)) return

      const wallDirections = adjacentWallDirections(point)
      if (newLightWallMounted && wallDirections.length === 0) return

      const orientation = newLightWallMounted && !newLightManualOrientation
        ? wallDirections[0]
        : newLightOrientation

      const nextLight = normalizeDungeonLightSource({
        id: createNextDungeonLightId(dungeon.lights),
        x: point.x,
        y: point.y,
        kind: "torch",
        enabled: true,
        brightRadiusCells,
        dimRadiusCells,
        mode: "radius",
        placement: "manual",
        wallMounted: newLightWallMounted,
        orientation,
      })
      void persistDungeonChange({ ...dungeon, lights: [...dungeon.lights, nextLight] }, dungeon)
      return
    }

    if (activeTool === "remove-light") {
      const nextLights = dungeon.lights.filter((light) => light.x !== point.x || light.y !== point.y)
      if (nextLights.length === dungeon.lights.length) return
      void persistDungeonChange({ ...dungeon, lights: nextLights }, dungeon)
    }
  }

  const handleCreateCorridorFromRoom = (
    anchor: RoomSideAnchor,
  ) => {
    if (!isEditable || !dungeon || activeTool !== "create-corridor" || isPersistingEdit) return

    if (!pendingCorridorAnchor && !pendingCorridorPoint) {
      setPendingCorridorPoint(null)
      setPendingCorridorWaypoints([])
      setPendingCorridorAnchor(anchor)
      return
    }

    if (pendingCorridorAnchor && pendingCorridorAnchor.roomId === anchor.roomId && pendingCorridorAnchor.point.x === anchor.point.x && pendingCorridorAnchor.point.y === anchor.point.y) {
      setPendingCorridorAnchor(anchor)
      return
    }

    const endHub = movePoint(anchor.point, anchor.direction)
    finishPendingCorridor(endHub, anchor.point)
  }

  const handleCreateCorridorFromCanvas = (
    room: NormalizedDungeonMap["rooms"][number],
    point: Point,
  ) => {
    const anchor = pickRoomSideAnchorFromPoint(room, point)
    handleCreateCorridorFromRoom(anchor)
  }

  const renderEditToolPanel = () => {
    if (!isEditable) return null

    return (
      <div
        className={styles.toolPanel}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div className={styles.toolPanelTitle}>Editar dungeon</div>
        <div className={styles.toolStack}>
          <div className={styles.toolGroup}>
            <button
              type="button"
              className={activeTool === "create-corridor" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "create-corridor"}
              title="Crear corredor"
              onClick={() => {
                clearPendingCorridor()
                setActiveTool((current) => current === "create-corridor" ? "none" : "create-corridor")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M4 11h6V5h4v6h6v4h-6v6h-4v-6H4z" fill="currentColor" />
              </svg>
            </button>

            <button
              type="button"
              className={activeTool === "remove-corridor" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "remove-corridor"}
              title="Eliminar corredor"
              onClick={() => {
                clearPendingCorridor()
                setActiveTool((current) => current === "remove-corridor" ? "none" : "remove-corridor")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M9 4 4 9l3 3-3 3 5 5 3-3 3 3 5-5-3-3 3-3-5-5-3 3-3-3Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          <div className={styles.toolDivider} />

          <div className={styles.toolGroup}>
            <button
              type="button"
              className={lightingPreviewEnabled ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={lightingPreviewEnabled}
              title="Vista previa de iluminación"
              onClick={() => setLightingPreviewEnabled((current) => !current)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M12 2 9.6 8.2 3 9l5 4.2L6.6 20 12 16.4 17.4 20 16 13.2 21 9l-6.6-.8L12 2Z" fill="currentColor" />
              </svg>
            </button>

            <button
              type="button"
              className={activeTool === "place-light" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "place-light"}
              title="Colocar antorcha"
              onClick={() => {
                clearPendingCorridor()
                setActiveTool((current) => current === "place-light" ? "none" : "place-light")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M9 2h6l-2 6h3l-4 6-4-6h3L9 2Zm1 13h4v7h-4v-7Z" fill="currentColor" />
              </svg>
            </button>

            <button
              type="button"
              className={activeTool === "remove-light" ? `${styles.toolButton} ${styles.toolButtonActive}` : styles.toolButton}
              aria-pressed={activeTool === "remove-light"}
              title="Eliminar antorcha"
              onClick={() => {
                clearPendingCorridor()
                setActiveTool((current) => current === "remove-light" ? "none" : "remove-light")
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.toolIcon}>
                <path d="M7 4h10v2H7V4Zm2 4h6l-1 12h-4L9 8Zm-5 3 2-2 14 14-2 2L4 11Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          {toolPanelAddon ? <div className={styles.toolPanelAddon}>{toolPanelAddon}</div> : null}

          <div className={styles.lightConfig}>
            <label className={styles.lightConfigLabel}>
              Bright
              <input
                className={styles.lightConfigInput}
                type="number"
                min={0}
                max={64}
                value={newLightBrightRadiusCells}
                onChange={(event) => setNewLightBrightRadiusCells(Number(event.target.value))}
              />
            </label>
            <label className={styles.lightConfigLabel}>
              Dim
              <input
                className={styles.lightConfigInput}
                type="number"
                min={0}
                max={128}
                value={newLightDimRadiusCells}
                onChange={(event) => setNewLightDimRadiusCells(Number(event.target.value))}
              />
            </label>
            <label className={`${styles.lightConfigLabel} ${styles.lightConfigCheckboxLabel}`}>
              On Wall
              <input
                className={styles.lightConfigCheckbox}
                type="checkbox"
                checked={newLightWallMounted}
                onChange={(event) => {
                  setNewLightWallMounted(event.target.checked)
                  setNewLightManualOrientation(false)
                }}
              />
            </label>
            <div className={styles.lightConfigHint}>
              Rotation: {newLightManualOrientation ? newLightOrientation : newLightWallMounted ? "wall" : newLightOrientation}. Press R to rotate.
            </div>
          </div>

        </div>
      </div>
    )
  }

  const handleCreateCorridorToIntersection = (_corridorId: string, point: Point) => {
    if (!isEditable || !dungeon || activeTool !== "create-corridor" || isPersistingEdit) return

    if (!pendingCorridorAnchor && !pendingCorridorPoint) {
      setPendingCorridorWaypoints([])
      setPendingCorridorPoint(point)
      return
    }

    if (pendingCorridorPoint && pendingCorridorPoint.x === point.x && pendingCorridorPoint.y === point.y) {
      setPendingCorridorPoint(point)
      return
    }

    finishPendingCorridor(point)
  }

  const handleCreateCorridorWaypoint = (point: Point) => {
    if (!isEditable || !dungeon || activeTool !== "create-corridor" || isPersistingEdit) return
    if (!pendingCorridorAnchor && !pendingCorridorPoint) return
    if (!isPointWithinDungeonBounds(point)) return
    if (roomOccupiedCells.has(pointKey(point)) || corridorCellKeys.has(pointKey(point))) return

    setPendingCorridorWaypoints((current) => {
      const previous = current[current.length - 1] ?? pendingCorridorAnchor?.point ?? pendingCorridorPoint
      if (previous && previous.x === point.x && previous.y === point.y) return current
      return [...current, point]
    })
  }

  const handleUndoPendingCorridorWaypoint = () => {
    if (!isEditable || activeTool !== "create-corridor" || isPersistingEdit) return
    setPendingCorridorWaypoints((current) => current.slice(0, -1))
  }

  const pendingCorridorPreviewPoints = useMemo(() => {
    const controlPoints = [
      pendingCorridorAnchor?.point ?? pendingCorridorPoint,
      ...pendingCorridorWaypoints,
    ].filter((point): point is Point => Boolean(point))
    if (!dungeon || activeTool !== "create-corridor") return controlPoints

    const startHub = pendingCorridorAnchor
      ? movePoint(pendingCorridorAnchor.point, pendingCorridorAnchor.direction)
      : pendingCorridorPoint
    if (!startHub) return controlPoints

    const blockedRoomCells = new Set<string>(roomOccupiedCells)
    if (pendingCorridorAnchor) {
      blockedRoomCells.delete(pointKey(pendingCorridorAnchor.point))
    }

    let endRoomPoint: Point | null = null
    const targets = [...pendingCorridorWaypoints]

    if (hoveredDungeonCell && isPointWithinDungeonBounds(hoveredDungeonCell)) {
      const hoveredRoom = dungeon.rooms.find((room) => room.cells.some((cell) => isSamePoint(cell, hoveredDungeonCell)))
      const hoveredKey = pointKey(hoveredDungeonCell)
      const lastTarget = targets[targets.length - 1] ?? startHub

      if (hoveredRoom) {
        const anchor = pickRoomSideAnchorFromPoint(hoveredRoom, hoveredDungeonCell)
        if (!pendingCorridorAnchor || !isSamePoint(anchor.point, pendingCorridorAnchor.point) || pendingCorridorWaypoints.length > 0) {
          blockedRoomCells.delete(pointKey(anchor.point))
          const endHub = movePoint(anchor.point, anchor.direction)
          if (!isSamePoint(lastTarget, endHub)) {
            targets.push(endHub)
          }
          endRoomPoint = anchor.point
        }
      } else if (!isSamePoint(lastTarget, hoveredDungeonCell) && (!roomOccupiedCells.has(hoveredKey) || corridorCellKeys.has(hoveredKey))) {
        targets.push(hoveredDungeonCell)
      }
    }

    const route = routeCorridorThroughTargets(startHub, targets, blockedRoomCells)
    if (!route) return controlPoints

    return compressPathPreservingPoints(
      [
        ...(pendingCorridorAnchor ? [pendingCorridorAnchor.point] : []),
        ...route,
        ...(endRoomPoint ? [endRoomPoint] : []),
      ],
      pendingCorridorWaypoints,
    )
  }, [
    activeTool,
    corridorCellKeys,
    dungeon,
    hoveredDungeonCell,
    pendingCorridorAnchor,
    pendingCorridorPoint,
    pendingCorridorWaypoints,
    roomOccupiedCells,
  ])

  if (error) {
    return <div className={styles.state}>{error}</div>
  }

  if (!dungeon) {
    return <div className={styles.state}>Cargando mazmorra...</div>
  }

  return (
    <DungeonCanvas
      dungeon={dungeon}
      displayStyle={effectiveDisplayStyle}
      isEditable={isEditable}
      activeTool={activeTool}
      lightingPreviewEnabled={lightingPreviewEnabled || lightingOverlayEnabled}
      lightingRadiusRingsEnabled={lightingPreviewEnabled || lightingOverlayShowRadiusRings}
      pendingCorridorAnchorPoint={pendingCorridorAnchor?.point ?? pendingCorridorPoint}
      pendingCorridorPathPoints={pendingCorridorPreviewPoints}
      pendingCorridorWaypointPoints={pendingCorridorWaypoints}
      openDoorIds={openDoorIds}
      mapOverlay={mapOverlay}
      focusPoint={focusPoint}
      onDoorClick={doorToggleEnabled ? handleDoorToggle : undefined}
      onRoomSpanClick={({ room, point }) => {
        handleCreateCorridorFromCanvas(room, point)
      }}
      onCorridorSegmentClick={({ corridorId, point }) => {
        if (activeTool === "remove-corridor") {
          handleCorridorRemove(corridorId)
          return
        }
        handleCreateCorridorToIntersection(corridorId, point)
      }}
      onDungeonCellClick={({ point }) => handleLightCellClick(point)}
      onDungeonCellHover={({ point }) => setHoveredDungeonCell(point)}
      onEmptyDungeonCellClick={({ point }) => handleCreateCorridorWaypoint(point)}
      onUndoPendingCorridorWaypoint={handleUndoPendingCorridorWaypoint}
    >
      {renderEditToolPanel()}
    </DungeonCanvas>
  )
}
