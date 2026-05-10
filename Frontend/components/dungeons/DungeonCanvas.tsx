"use client"

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import type { NormalizedDungeonMap } from "@/lib/dungeons/types"
import { buildDungeonLightingVisibility } from "@/lib/dungeons/visibility"

import {
  clamp,
  clampCameraOffset,
  fitToView,
  screenToWorld,
  worldToScreen,
} from "./canvas/camera"
import { drawDungeon, drawDungeonGrid, drawDungeonLightingOverlay } from "./canvas/draw"
import { buildCorridorSegments } from "./canvas/geometry"
import { corridorSegmentAtCell, doorAtLocalPixel, roomSpanAtCell } from "./canvas/hit-test"
import {
  BASE_CELL_SIZE,
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_SENSITIVITY,
  renderOriginFromDungeon,
  type CanvasPoint,
  type CorridorRenderSegment,
  type DungeonDisplayStyle,
} from "./canvas/render-types"
import styles from "./DungeonMap.module.css"

type ActiveTool = "none" | "remove-corridor" | "create-corridor" | "place-light" | "remove-light"

type DungeonCanvasProps = {
  dungeon: NormalizedDungeonMap
  displayStyle: DungeonDisplayStyle
  isEditable?: boolean
  activeTool?: ActiveTool
  lightingPreviewEnabled?: boolean
  lightingRadiusRingsEnabled?: boolean
  pendingCorridorAnchorPoint?: CanvasPoint | null
  pendingCorridorPathPoints?: CanvasPoint[]
  pendingCorridorWaypointPoints?: CanvasPoint[]
  openDoorIds?: Set<string>
  onRoomSpanClick?: (payload: {
    room: NormalizedDungeonMap["rooms"][number]
    span: { x: number; y: number; width: number; height: number }
    point: CanvasPoint
  }) => void
  onCorridorSegmentClick?: (payload: {
    corridorId: string
    point: CanvasPoint
  }) => void
  onDungeonCellClick?: (payload: { point: CanvasPoint }) => void
  onDungeonCellHover?: (payload: { point: CanvasPoint | null }) => void
  onEmptyDungeonCellClick?: (payload: { point: CanvasPoint }) => void
  onUndoPendingCorridorWaypoint?: () => void
  onDoorClick?: (doorId: string) => void
  mapOverlay?: ReactNode
  focusPoint?: {
    x: number
    y: number
    requestId: number
  } | null
  children?: ReactNode
}

type CanvasCameraState = {
  scale: number
  offsetX: number
  offsetY: number
}

type PanDragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startOffsetX: number
  startOffsetY: number
}

function resolveDevicePixelRatio() {
  if (typeof window === "undefined") return 1
  return Math.max(1, window.devicePixelRatio || 1)
}

function pointKey(point: CanvasPoint) {
  return `${point.x},${point.y}`
}

export default function DungeonCanvas({
  dungeon,
  displayStyle,
  isEditable = false,
  activeTool = "none",
  lightingPreviewEnabled = false,
  lightingRadiusRingsEnabled = true,
  pendingCorridorAnchorPoint = null,
  pendingCorridorPathPoints = [],
  pendingCorridorWaypointPoints = [],
  openDoorIds,
  onRoomSpanClick,
  onCorridorSegmentClick,
  onDungeonCellClick,
  onDungeonCellHover,
  onEmptyDungeonCellClick,
  onUndoPendingCorridorWaypoint,
  onDoorClick,
  mapOverlay,
  focusPoint,
  children,
}: DungeonCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dragRef = useRef<PanDragState | null>(null)
  const didPanRef = useRef(false)
  const lastFittedBoundsRef = useRef<string | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [cameraState, setCameraState] = useState<CanvasCameraState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const [textures, setTextures] = useState<{ room: HTMLImageElement[]; corridor: HTMLImageElement[]; torch: HTMLImageElement | null }>({
    room: [],
    corridor: [],
    torch: null,
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    let isActive = true

    const normalizeTextureSources = (sources: string[] | undefined, fallback: string | undefined) => {
      const normalized = new Set<string>()
      for (const source of sources ?? []) {
        const trimmed = source.trim()
        if (!trimmed) continue
        normalized.add(trimmed)
      }
      const fallbackTrimmed = fallback?.trim() ?? ""
      if (fallbackTrimmed) {
        normalized.add(fallbackTrimmed)
      }
      return [...normalized]
    }

    const loadTexture = (source: string) => new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image()
      image.decoding = "async"
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = source
    })

    const loadTextureSet = async (sources: string[]) => {
      if (sources.length === 0) return [] as HTMLImageElement[]
      const images = await Promise.all(sources.map((source) => loadTexture(source)))
      return images.filter((image): image is HTMLImageElement => image !== null)
    }

    const roomSources = normalizeTextureSources(displayStyle.roomTextureUrls, displayStyle.roomTextureUrl)
    const corridorSources = normalizeTextureSources(displayStyle.corridorTextureUrls, displayStyle.corridorTextureUrl)

    void loadTextureSet(roomSources).then((images) => {
      if (!isActive) return
      setTextures((current) => ({ ...current, room: images }))
    })

    void loadTextureSet(corridorSources).then((images) => {
      if (!isActive) return
      setTextures((current) => ({ ...current, corridor: images }))
    })

    void loadTexture("/torch.png").then((image) => {
      if (!isActive) return
      setTextures((current) => ({ ...current, torch: image }))
    })

    return () => {
      isActive = false
    }
  }, [displayStyle.corridorTextureUrl, displayStyle.corridorTextureUrls, displayStyle.roomTextureUrl, displayStyle.roomTextureUrls])

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

    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(syncViewportSize)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const renderOrigin = useMemo(() => renderOriginFromDungeon(dungeon), [dungeon])
  const roomOccupiedCells = useMemo(() => {
    const occupied = new Set<string>()
    for (const room of dungeon.rooms) {
      for (const cell of room.cells) {
        occupied.add(pointKey(cell))
      }
    }
    return occupied
  }, [dungeon.rooms])

  const corridorSegments = useMemo(() => {
    const segments: Array<CorridorRenderSegment & { corridorId: string }> = []
    for (const corridor of dungeon.corridors) {
      const baseSegments = buildCorridorSegments(corridor.points, corridor.width ?? 1, roomOccupiedCells)
      for (const segment of baseSegments) {
        segments.push({ ...segment, corridorId: corridor.id })
      }
    }
    return segments
  }, [dungeon.corridors, roomOccupiedCells])

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return

    const boundsSignature = [
      dungeon.bounds.originX,
      dungeon.bounds.originY,
      dungeon.bounds.width,
      dungeon.bounds.height,
      viewportSize.width,
      viewportSize.height,
    ].join(":")

    if (lastFittedBoundsRef.current === boundsSignature) {
      return
    }

    const fitted = fitToView(dungeon, viewportSize)
    lastFittedBoundsRef.current = boundsSignature
    setCameraState({
      scale: fitted.scale,
      offsetX: fitted.offset.x,
      offsetY: fitted.offset.y,
    })
  }, [
    dungeon.bounds.height,
    dungeon.bounds.originX,
    dungeon.bounds.originY,
    dungeon.bounds.width,
    viewportSize.height,
    viewportSize.width,
  ])

  const camera = useMemo(() => ({
    scale: cameraState.scale,
    offset: {
      x: cameraState.offsetX,
      y: cameraState.offsetY,
    },
  }), [cameraState.offsetX, cameraState.offsetY, cameraState.scale])

  const mapOverlayStyle = useMemo<CSSProperties>(() => ({
    width: `${Math.max(1, dungeon.bounds.width) * BASE_CELL_SIZE}px`,
    height: `${Math.max(1, dungeon.bounds.height) * BASE_CELL_SIZE}px`,
    transform: `translate3d(${camera.offset.x}px, ${camera.offset.y}px, 0) scale(${camera.scale})`,
    transformOrigin: "0 0",
    "--map-canvas-scale": camera.scale,
    "--battle-grid-cell-size": `${BASE_CELL_SIZE}px`,
    "--battle-grid-offset-x": "0px",
    "--battle-grid-offset-y": "0px",
  } as CSSProperties), [camera.offset.x, camera.offset.y, camera.scale, dungeon.bounds.height, dungeon.bounds.width])

  useEffect(() => {
    if (!focusPoint || viewportSize.width <= 0 || viewportSize.height <= 0) return

    setCameraState((current) => {
      const scale = current.scale
      const target = {
        x: (focusPoint.x / 100) * Math.max(1, dungeon.bounds.width),
        y: (focusPoint.y / 100) * Math.max(1, dungeon.bounds.height),
      }
      const nextCamera = {
        scale,
        offset: {
          x: viewportSize.width / 2 - target.x * BASE_CELL_SIZE * scale,
          y: viewportSize.height / 2 - target.y * BASE_CELL_SIZE * scale,
        },
      }
      const clamped = clampCameraOffset(nextCamera, dungeon, viewportSize)
      return {
        scale: clamped.scale,
        offsetX: clamped.offset.x,
        offsetY: clamped.offset.y,
      }
    })
  }, [dungeon, focusPoint, viewportSize.height, viewportSize.width])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const handleWheel = (event: WheelEvent) => {
      if (viewportSize.width <= 0 || viewportSize.height <= 0) return

      if (event.shiftKey) {
        event.preventDefault()
        return
      }

      event.preventDefault()
      const rect = root.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      setCameraState((current) => {
        const currentCamera = {
          scale: current.scale,
          offset: { x: current.offsetX, y: current.offsetY },
        }

        const worldBeforeZoom = screenToWorld(pointer, renderOrigin, currentCamera)
        const nextScale = clamp(current.scale * Math.exp(-event.deltaY * ZOOM_SENSITIVITY), MIN_SCALE, MAX_SCALE)
        const nextCamera = {
          scale: nextScale,
          offset: { x: 0, y: 0 },
        }
        const screenAtZeroOffset = worldToScreen(worldBeforeZoom, renderOrigin, nextCamera)
        nextCamera.offset.x = pointer.x - screenAtZeroOffset.x
        nextCamera.offset.y = pointer.y - screenAtZeroOffset.y

        const clamped = clampCameraOffset(nextCamera, dungeon, viewportSize)
        return {
          scale: clamped.scale,
          offsetX: clamped.offset.x,
          offsetY: clamped.offset.y,
        }
      })
    }

    root.addEventListener("wheel", handleWheel, { passive: false })
    return () => root.removeEventListener("wheel", handleWheel)
  }, [dungeon, renderOrigin, viewportSize])

  const lightingVisibility = useMemo(() => {
    if (!lightingPreviewEnabled) return undefined
    if (dungeon.lights.length === 0) return undefined

    return buildDungeonLightingVisibility({
      dungeon,
      openDoorIds,
    })
  }, [dungeon, lightingPreviewEnabled, openDoorIds])

  const finishPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const isPrimaryButton = event.button === 0
    const isMiddleButton = event.button === 1
    if (!isPrimaryButton && !isMiddleButton) return
    if (isPrimaryButton && isEditable && activeTool !== "none") return

    event.preventDefault()
    didPanRef.current = false
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: cameraState.offsetX,
      startOffsetY: cameraState.offsetY,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleAuxClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (event.button === 1) {
      event.preventDefault()
    }
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!isEditable || activeTool !== "create-corridor") return
    event.preventDefault()
    onUndoPendingCorridorWaypoint?.()
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      const worldPoint = screenToWorld(pointer, renderOrigin, camera)
      onDungeonCellHover?.({
        point: {
          x: Math.floor(worldPoint.x),
          y: Math.floor(worldPoint.y),
        },
      })
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startClientX
    const deltaY = event.clientY - drag.startClientY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      didPanRef.current = true
    }
    setCameraState((current) => {
      const unclamped = {
        scale: current.scale,
        offset: {
          x: drag.startOffsetX + deltaX,
          y: drag.startOffsetY + deltaY,
        },
      }
      const clamped = clampCameraOffset(unclamped, dungeon, viewportSize)
      return {
        scale: clamped.scale,
        offsetX: clamped.offset.x,
        offsetY: clamped.offset.y,
      }
    })
  }

  const handleCanvasClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (didPanRef.current) {
      didPanRef.current = false
      return
    }

    if (!rootRef.current) return

    const rect = rootRef.current.getBoundingClientRect()
    const pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const worldPoint = screenToWorld(pointer, renderOrigin, camera)
    const worldCell = {
      x: Math.floor(worldPoint.x),
      y: Math.floor(worldPoint.y),
    }

    if (isEditable && (activeTool === "place-light" || activeTool === "remove-light")) {
      onDungeonCellClick?.({ point: worldCell })
      return
    }

    const localPixel = {
      x: (worldPoint.x - renderOrigin.x) * BASE_CELL_SIZE,
      y: (worldPoint.y - renderOrigin.y) * BASE_CELL_SIZE,
    }

    const doorHit = doorAtLocalPixel(dungeon.doors, renderOrigin, localPixel, BASE_CELL_SIZE, displayStyle.wallWidth)
    if (doorHit) {
      onDoorClick?.(doorHit.id)
      return
    }

    if (!isEditable || activeTool === "none") {
      return
    }

    if (activeTool === "create-corridor") {
      const roomHit = roomSpanAtCell(dungeon.rooms, worldCell)
      if (roomHit) {
        onRoomSpanClick?.({
          room: roomHit.room,
          span: roomHit.span,
          point: worldCell,
        })
        return
      }

      const corridorHit = corridorSegmentAtCell(corridorSegments, worldCell)
      if (corridorHit) {
        onCorridorSegmentClick?.({
          corridorId: corridorHit.corridorId,
          point: corridorHit.point,
        })
        return
      }
      onEmptyDungeonCellClick?.({ point: worldCell })
      return
    }

    if (activeTool === "remove-corridor") {
      const corridorHit = corridorSegmentAtCell(corridorSegments, worldCell)
      if (corridorHit) {
        onCorridorSegmentClick?.({
          corridorId: corridorHit.corridorId,
          point: corridorHit.point,
        })
      }
    }
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewportSize.width <= 0 || viewportSize.height <= 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const cssWidth = Math.max(1, Math.floor(viewportSize.width))
    const cssHeight = Math.max(1, Math.floor(viewportSize.height))
    const dpr = resolveDevicePixelRatio()
    const displayWidth = Math.max(1, Math.floor(cssWidth * dpr))
    const displayHeight = Math.max(1, Math.floor(cssHeight * dpr))

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth
      canvas.height = displayHeight
    }

    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const scene = {
      dungeon,
      displayStyle,
      camera,
      viewport: {
        width: cssWidth,
        height: cssHeight,
      },
      renderOrigin,
      openDoorIds,
      pendingAnchorPoint: pendingCorridorAnchorPoint,
      pendingPathPoints: pendingCorridorPathPoints,
      pendingWaypointPoints: pendingCorridorWaypointPoints,
      textures,
    }

    ctx.imageSmoothingEnabled = displayStyle.imageSmoothingEnabled
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)
    drawDungeon(ctx, scene)
    if (lightingPreviewEnabled) {
      drawDungeonLightingOverlay(ctx, scene, {
        showRadiusRings: lightingRadiusRingsEnabled,
        precomputedVisibility: lightingVisibility,
      })
      drawDungeonGrid(ctx, scene)
    }
  }, [camera, displayStyle, dungeon, lightingPreviewEnabled, lightingRadiusRingsEnabled, lightingVisibility, openDoorIds, pendingCorridorAnchorPoint, pendingCorridorPathPoints, pendingCorridorWaypointPoints, renderOrigin, textures, viewportSize.height, viewportSize.width])

  return (
    <div ref={rootRef} className={isDragging ? `${styles.root} ${styles.rootDragging}` : styles.root}>
      <canvas
        ref={canvasRef}
        className={styles.canvasSurface}
        aria-label="Mapa de mazmorra en canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPan}
        onPointerCancel={finishPan}
        onPointerLeave={() => onDungeonCellHover?.({ point: null })}
        onClick={handleCanvasClick}
        onAuxClick={handleAuxClick}
        onContextMenu={handleContextMenu}
      />
      {mapOverlay ? (
        <div className={styles.mapOverlay} style={mapOverlayStyle}>
          {mapOverlay}
        </div>
      ) : null}
      {children}
    </div>
  )
}
