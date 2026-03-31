"use client"

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react"

import { Maximize2, RotateCw } from "lucide-react"

import BuildingsMap from "@/components/buildings/BuildingsMap"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { buildBackendApiUrl } from "@/lib/services/backend-api.service"
import { fetchBuildings, updateBuilding } from "@/lib/services/building-api.service"
import { fetchLandmarkBySlug, updateLandmark } from "@/lib/services/landmark-api.service"
import type { BattleSceneType, Building, Landmark, LandmarkType } from "@/lib/types"
import { PresentationCover } from "./PresentationCover"
import styles from "./LandmarkMapOnlyPage.module.css"

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const INITIAL_SCALE = 1
const BATTLE_GRID_SUPPORTED_TYPES = new Set<LandmarkType>(["puente", "bandera", "campamento", "mazmorra"])
const PRESENTATION_LABEL_TYPES = new Set<LandmarkType>(["ciudad", "pueblo", "aldea"])

type Point = {
  x: number
  y: number
}

type Size = {
  width: number
  height: number
}

type DragState = {
  pointerId: number
  start: Point
  origin: Point
}

export type PresentationSceneLoadEvent = {
  sceneType: BattleSceneType
  sceneSlug: string
  sceneLabel: string
  message?: string
}

interface LandmarkMapOnlyClientProps {
  nombreLandmark?: string
  sceneType?: BattleSceneType
  sceneSlug?: string
  showControls?: boolean
  showPresentationLabel?: boolean
  emptyFallbackImageSrc?: string
  onSceneReady?: (payload: PresentationSceneLoadEvent) => void
  onSceneLoadError?: (payload: PresentationSceneLoadEvent) => void
  flipVertical?: boolean
  showBattleGrid?: boolean
  onMapBackgroundPointerDown?: () => void
  leftControls?: ReactNode
  middleLeftControls?: ReactNode
  bottomRightControls?: ReactNode
  topLeftControls?: ReactNode
  topRightControls?: ReactNode
  topOverlay?: ReactNode
  overlay?: ReactNode
  fitParentHeight?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function assetFileToPublicUrl(filename: string) {
  if (
    filename.startsWith("/") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://") ||
    filename.startsWith("data:")
  ) {
    return filename
  }

  return `/maps/${filename}`
}

function mapUrlFromReference(landmark: Landmark): string | null {
  if (typeof landmark.mapAssetId === "number" && landmark.mapAssetId > 0) {
    return buildAssetUrl(landmark.mapAssetId)
  }

  const ref = landmark.mapa
  if (!ref) return null

  if (ref.kind === "embedded") return ref.dataUrl
  if (ref.kind === "external") return ref.url
  if (ref.kind === "asset") return assetFileToPublicUrl(ref.filename)

  if (ref.kind === "stored") {
    const assetId = Number.parseInt(ref.key, 10)
    if (Number.isFinite(assetId) && assetId > 0) {
      return buildAssetUrl(assetId)
    }
    return null
  }

  if (ref.kind === "buildings") {
    if (ref.source === "external") return ref.url
    return assetFileToPublicUrl(ref.filename)
  }

  return null
}

function mapUrlFromBuilding(building: Building): string | null {
  if (typeof building.mapAssetId === "number" && building.mapAssetId > 0) {
    return buildAssetUrl(building.mapAssetId)
  }

  const ref = building.mapa
  if (!ref) return null

  if (ref.kind === "embedded") return ref.dataUrl
  if (ref.kind === "external") return ref.url
  if (ref.kind === "asset") return assetFileToPublicUrl(ref.filename)

  if (ref.kind === "stored") {
    const assetId = Number.parseInt(ref.key, 10)
    if (Number.isFinite(assetId) && assetId > 0) {
      return buildAssetUrl(assetId)
    }
  }

  return null
}

function isJsonMapReference(value: string | null | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()

  return (
    normalized.startsWith("data:application/json") ||
    normalized.startsWith("data:text/json") ||
    normalized.endsWith(".json") ||
    normalized.includes(".json?")
  )
}

function isBackendAssetUrl(url: string) {
  const normalized = url.trim()
  if (!normalized) return false

  if (normalized.startsWith("/api/v1/assets/")) {
    return true
  }

  return normalized.startsWith(buildBackendApiUrl("/v1/assets/"))
}

function normalizeMapRotationDegrees(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = Math.round(value)
  const snappedQuarterTurns = Math.round(normalized / 90)
  return ((snappedQuarterTurns % 4) + 4) % 4 * 90
}

function normalizeMapGridCellSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 48
  return Math.round(clamp(value, 8, 512) * 100) / 100
}

function normalizeMapGridOffset(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function decodeSlug(raw: string | undefined) {
  if (!raw) return ""

  try {
    return decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}

function findBuildingBySlug(buildings: Building[], slug: string) {
  const normalizedSlug = slug.trim().toLowerCase()
  return buildings.find((candidate) => landmarkNameToSlug(candidate.nombre) === normalizedSlug) ?? null
}

export const LandmarkMapOnlyClient = memo(function LandmarkMapOnlyClient({
  nombreLandmark,
  sceneType,
  sceneSlug,
  showControls = true,
  showPresentationLabel = false,
  emptyFallbackImageSrc,
  onSceneReady,
  onSceneLoadError,
  flipVertical = false,
  showBattleGrid = true,
  onMapBackgroundPointerDown,
  leftControls,
  middleLeftControls,
  bottomRightControls,
  topLeftControls,
  topRightControls,
  topOverlay,
  overlay,
  fitParentHeight = false,
}: LandmarkMapOnlyClientProps) {
  const slugSource = sceneSlug ?? nombreLandmark ?? ""
  const slug = useMemo(() => decodeSlug(slugSource), [slugSource])

  const [landmark, setLandmark] = useState<Landmark | null>(null)
  const [building, setBuilding] = useState<Building | null>(null)
  const [hasResolvedLoad, setHasResolvedLoad] = useState(false)
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [mapViewportSize, setMapViewportSize] = useState<Size | null>(null)
  const [mapImageNaturalSize, setMapImageNaturalSize] = useState<Size | null>(null)
  const [buildingsMapError, setBuildingsMapError] = useState<string | null>(null)
  const [resolvedImageMapUrl, setResolvedImageMapUrl] = useState<string | null>(null)
  const [isResolvingImageFallback, setIsResolvingImageFallback] = useState(false)
  const [isRotatingMap, setIsRotatingMap] = useState(false)
  const [isSceneReady, setIsSceneReady] = useState(false)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const mapCanvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  const fallbackObjectUrlRef = useRef<string | null>(null)
  const panAnimationFrameRef = useRef<number | null>(null)
  const lastReadyNotificationKeyRef = useRef<string | null>(null)
  const lastErrorNotificationKeyRef = useRef<string | null>(null)

  const renderState = useCallback(
    (_message: string) => {
      if (!emptyFallbackImageSrc) {
        return <div className={styles.state}>{_message}</div>
      }

      return (
        <section className={fitParentHeight ? `${styles.root} ${styles.rootFitParent}` : styles.root}>
          <div className={styles.fallbackImageState}>
            <PresentationCover className="h-full w-full px-[5vw]" />
          </div>
        </section>
      )
    },
    [emptyFallbackImageSrc, fitParentHeight],
  )

  useEffect(() => {
    let isActive = true
    setLandmark(null)
    setBuilding(null)
    setHasResolvedLoad(false)

    if (!slug) {
      setHasResolvedLoad(true)
      return () => {
        isActive = false
      }
    }

    const resolveScene = async () => {
      if (sceneType === "landmark") {
        const nextLandmark = await fetchLandmarkBySlug(slug)
        if (!isActive) return
        setLandmark(nextLandmark)
        setBuilding(null)
        return
      }

      if (sceneType === "building") {
        const storedBuildings = await fetchBuildings(true)
        if (!isActive) return
        const nextBuilding = findBuildingBySlug(storedBuildings, slug)
        if (!nextBuilding) {
          console.error("[LandmarkMapOnlyClient] Building scene not found", {
            sceneType,
            sceneSlug: slug,
            availableBuildingSlugs: storedBuildings.map((candidate) => landmarkNameToSlug(candidate.nombre)),
          })
        }
        setLandmark(null)
        setBuilding(nextBuilding)
        return
      }

      const [nextLandmark, storedBuildings] = await Promise.all([fetchLandmarkBySlug(slug), fetchBuildings(true)])
      if (!isActive) return

      if (nextLandmark) {
        setLandmark(nextLandmark)
        setBuilding(null)
        return
      }

      const nextBuilding = findBuildingBySlug(storedBuildings, slug)
      if (!nextLandmark && !nextBuilding) {
        console.error("[LandmarkMapOnlyClient] Scene not found", {
          sceneType: sceneType ?? "auto",
          sceneSlug: slug,
          availableBuildingSlugs: storedBuildings.map((candidate) => landmarkNameToSlug(candidate.nombre)),
        })
      }
      setLandmark(null)
      setBuilding(nextBuilding)
    }

    void resolveScene()
      .catch(() => {
        if (!isActive) return
        console.error("[LandmarkMapOnlyClient] Failed to resolve scene", {
          sceneType: sceneType ?? "auto",
          sceneSlug: slug,
        })
        setLandmark(null)
        setBuilding(null)
      })
      .finally(() => {
        if (!isActive) return
        setHasResolvedLoad(true)
      })

    return () => {
      isActive = false
    }
  }, [sceneType, slug])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  const applyCanvasTransform = useCallback((nextScale: number, nextOffset: Point) => {
    const mapCanvas = mapCanvasRef.current
    if (!mapCanvas) {
      return
    }

    mapCanvas.style.transform = `matrix(${nextScale}, 0, 0, ${nextScale}, ${nextOffset.x}, ${nextOffset.y})`
  }, [])

  useEffect(() => {
    applyCanvasTransform(scale, offset)
  }, [applyCanvasTransform, offset, scale])

  useEffect(() => {
    return () => {
      if (panAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(panAnimationFrameRef.current)
        panAnimationFrameRef.current = null
      }
    }
  }, [])

  const effectiveMapUrl = useMemo(() => {
    if (landmark) return mapUrlFromReference(landmark)
    if (building) return mapUrlFromBuilding(building)
    return null
  }, [building, landmark])
  const shouldUseBuildingsMap =
    Boolean(landmark) &&
    (landmark?.mapAssetKind === "json" || landmark?.mapa?.kind === "buildings" || isJsonMapReference(effectiveMapUrl))
  const isBackendImageAsset =
    typeof effectiveMapUrl === "string" && !shouldUseBuildingsMap && isBackendAssetUrl(effectiveMapUrl)
  const renderedImageMapUrl = shouldUseBuildingsMap ? null : resolvedImageMapUrl ?? effectiveMapUrl
  const imageMapEffectKey = shouldUseBuildingsMap ? "__buildings__" : effectiveMapUrl ?? "__no-map__"
  const resolvedSceneType = landmark
    ? "landmark"
    : building
      ? "building"
      : sceneType === "building"
        ? "building"
        : "landmark"
  const sceneLabel = (landmark?.nombre ?? building?.nombre ?? slugSource.trim()) || "escena"
  const sceneNotificationPayload = useMemo<PresentationSceneLoadEvent>(
    () => ({
      sceneType: resolvedSceneType,
      sceneSlug: slug,
      sceneLabel,
    }),
    [resolvedSceneType, sceneLabel, slug],
  )
  const sceneNotificationKey = useMemo(
    () => `${resolvedSceneType}:${slug}:${imageMapEffectKey}`,
    [imageMapEffectKey, resolvedSceneType, slug],
  )
  const isLoadingImageMap =
    Boolean(effectiveMapUrl) &&
    !shouldUseBuildingsMap &&
    (!mapImageNaturalSize || !mapViewportSize) &&
    !buildingsMapError
  const mapRotationDegrees = normalizeMapRotationDegrees(landmark?.mapRotationDegrees ?? building?.mapRotationDegrees)
  const canUseBattleGrid = landmark
    ? Boolean(effectiveMapUrl) && !shouldUseBuildingsMap && BATTLE_GRID_SUPPORTED_TYPES.has(landmark.tipo)
    : Boolean(building && effectiveMapUrl && !shouldUseBuildingsMap)
  const shouldRenderPresentationLabel =
    Boolean(showPresentationLabel && landmark && PRESENTATION_LABEL_TYPES.has(landmark.tipo))
  const presentationLabel = shouldRenderPresentationLabel && landmark
    ? <div className={styles.presentationLabel}>{landmark.nombre}</div>
    : null

  const rotatedMapRenderSize = useMemo(() => {
    if (!mapViewportSize || !mapImageNaturalSize) return null

    const viewportWidth = mapViewportSize.width
    const viewportHeight = mapViewportSize.height
    const naturalWidth = mapImageNaturalSize.width
    const naturalHeight = mapImageNaturalSize.height

    if (viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return null
    }

    const isQuarterTurn = mapRotationDegrees % 180 !== 0
    const rotatedWidth = isQuarterTurn ? naturalHeight : naturalWidth
    const rotatedHeight = isQuarterTurn ? naturalWidth : naturalHeight
    const scaleToFit = Math.min(viewportWidth / rotatedWidth, viewportHeight / rotatedHeight)

    if (!Number.isFinite(scaleToFit) || scaleToFit <= 0) {
      return null
    }

    return {
      imageWidth: naturalWidth * scaleToFit,
      imageHeight: naturalHeight * scaleToFit,
      boundsWidth: rotatedWidth * scaleToFit,
      boundsHeight: rotatedHeight * scaleToFit,
    }
  }, [mapImageNaturalSize, mapRotationDegrees, mapViewportSize])

  const mapGridRenderScale =
    rotatedMapRenderSize && mapImageNaturalSize && mapImageNaturalSize.width > 0
      ? rotatedMapRenderSize.imageWidth / mapImageNaturalSize.width
      : 1
  const mapGridCellSize =
    showBattleGrid && canUseBattleGrid && (landmark?.mapGridEnabled ?? building?.mapGridEnabled)
      ? normalizeMapGridCellSize(landmark?.mapGridCellSize ?? building?.mapGridCellSize) * mapGridRenderScale
      : 0
  const mapGridOffsetX =
    showBattleGrid && canUseBattleGrid && (landmark?.mapGridEnabled ?? building?.mapGridEnabled)
      ? normalizeMapGridOffset(landmark?.mapGridOffsetX ?? building?.mapGridOffsetX) * mapGridRenderScale
      : 0
  const mapGridOffsetY =
    showBattleGrid && canUseBattleGrid && (landmark?.mapGridEnabled ?? building?.mapGridEnabled)
      ? normalizeMapGridOffset(landmark?.mapGridOffsetY ?? building?.mapGridOffsetY) * mapGridRenderScale
      : 0

  const mapImageLayerStyle = useMemo<CSSProperties>(
    () =>
      rotatedMapRenderSize
        ? {
            width: `${rotatedMapRenderSize.imageWidth}px`,
            height: `${rotatedMapRenderSize.imageHeight}px`,
            transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
            ["--map-rotation-deg" as "--map-rotation-deg"]: `${mapRotationDegrees}deg`,
            ["--map-image-scale" as "--map-image-scale"]: String(mapGridRenderScale),
            ["--map-canvas-scale" as "--map-canvas-scale"]: String(scale),
            ["--battle-grid-cell-size" as "--battle-grid-cell-size"]: `${mapGridCellSize}px`,
            ["--battle-grid-offset-x" as "--battle-grid-offset-x"]: `${mapGridOffsetX}px`,
            ["--battle-grid-offset-y" as "--battle-grid-offset-y"]: `${mapGridOffsetY}px`,
          }
        : {
            width: "100%",
            height: "100%",
            transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
            ["--map-rotation-deg" as "--map-rotation-deg"]: `${mapRotationDegrees}deg`,
            ["--map-image-scale" as "--map-image-scale"]: String(mapGridRenderScale),
            ["--map-canvas-scale" as "--map-canvas-scale"]: String(scale),
            ["--battle-grid-cell-size" as "--battle-grid-cell-size"]: `${mapGridCellSize}px`,
            ["--battle-grid-offset-x" as "--battle-grid-offset-x"]: `${mapGridOffsetX}px`,
            ["--battle-grid-offset-y" as "--battle-grid-offset-y"]: `${mapGridOffsetY}px`,
          },
    [
      mapGridCellSize,
      mapGridOffsetX,
      mapGridOffsetY,
      mapGridRenderScale,
      mapRotationDegrees,
      rotatedMapRenderSize,
      scale,
    ],
  )

  const mapGridOverlayStyle = useMemo(() => {
    if (mapGridCellSize <= 0) return undefined

    return {
      backgroundImage:
        "linear-gradient(to right, rgba(248, 234, 199, 0.58) 1px, transparent 1px), linear-gradient(to bottom, rgba(248, 234, 199, 0.58) 1px, transparent 1px)",
      backgroundSize: `${mapGridCellSize}px ${mapGridCellSize}px`,
      backgroundPosition: `${mapGridOffsetX}px ${mapGridOffsetY}px, ${mapGridOffsetX}px ${mapGridOffsetY}px`,
    }
  }, [mapGridCellSize, mapGridOffsetX, mapGridOffsetY])
  const mapVerticalFlipStyle = useMemo<CSSProperties | undefined>(
    () => (flipVertical ? { transform: "scale(-1)", transformOrigin: "center" } : undefined),
    [flipVertical],
  )
  const mapMainOverlayClassName = flipVertical ? styles.mapBottomOverlay : styles.mapTopOverlay
  const shouldShowSilentFallbackCover = Boolean(emptyFallbackImageSrc) && !isSceneReady

  const notifySceneReady = useCallback(() => {
    setIsSceneReady(true)

    if (!onSceneReady || !slug || lastReadyNotificationKeyRef.current === sceneNotificationKey) {
      return
    }

    lastReadyNotificationKeyRef.current = sceneNotificationKey
    lastErrorNotificationKeyRef.current = null
    setIsSceneReady(true)
    onSceneReady(sceneNotificationPayload)
  }, [onSceneReady, sceneNotificationKey, sceneNotificationPayload, slug])

  const notifySceneError = useCallback(
    (message: string) => {
      if (!onSceneLoadError || !slug) {
        return
      }

      const errorKey = `${sceneNotificationKey}:${message}`
      if (lastErrorNotificationKeyRef.current === errorKey) {
        return
      }

      lastErrorNotificationKeyRef.current = errorKey
      onSceneLoadError({
        ...sceneNotificationPayload,
        message,
      })
    },
    [onSceneLoadError, sceneNotificationKey, sceneNotificationPayload, slug],
  )

  const handleMapImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = event.currentTarget
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        setMapImageNaturalSize(null)
        setBuildingsMapError("No se pudo cargar el mapa.")
        return
      }

      setBuildingsMapError(null)
      setMapImageNaturalSize({
        width: naturalWidth,
        height: naturalHeight,
      })
      notifySceneReady()
    },
    [notifySceneReady],
  )

  useEffect(() => {
    const nextOffset = { x: 0, y: 0 }
    scaleRef.current = INITIAL_SCALE
    offsetRef.current = nextOffset
    setScale(INITIAL_SCALE)
    setOffset(nextOffset)
  }, [building?.id, imageMapEffectKey, landmark?.id])

  useEffect(() => {
    if (shouldUseBuildingsMap) {
      setMapViewportSize(null)
      return
    }

    const viewport = viewportRef.current
    if (!viewport) {
      setMapViewportSize(null)
      return
    }

    const syncViewportSize = () => {
      setMapViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      })
    }

    syncViewportSize()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      syncViewportSize()
    })
    resizeObserver.observe(viewport)

    return () => {
      resizeObserver.disconnect()
    }
  }, [imageMapEffectKey])

  useEffect(() => {
    setMapImageNaturalSize(null)
    setBuildingsMapError(null)
    setIsSceneReady(false)
    setIsResolvingImageFallback(false)
    lastReadyNotificationKeyRef.current = null
    lastErrorNotificationKeyRef.current = null
    if (fallbackObjectUrlRef.current) {
      URL.revokeObjectURL(fallbackObjectUrlRef.current)
      fallbackObjectUrlRef.current = null
    }
    setResolvedImageMapUrl(null)
  }, [imageMapEffectKey])

  useEffect(() => {
    return () => {
      if (fallbackObjectUrlRef.current) {
        URL.revokeObjectURL(fallbackObjectUrlRef.current)
        fallbackObjectUrlRef.current = null
      }
    }
  }, [])

  const resolveImageFallback = useCallback(async () => {
    if (!effectiveMapUrl || !isBackendImageAsset || isResolvingImageFallback || resolvedImageMapUrl) {
      return
    }

    setIsResolvingImageFallback(true)
    setBuildingsMapError(null)

    try {
      const response = await fetch(effectiveMapUrl, {
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`No se pudo cargar el mapa (${response.status}).`)
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      if (fallbackObjectUrlRef.current) {
        URL.revokeObjectURL(fallbackObjectUrlRef.current)
      }
      fallbackObjectUrlRef.current = objectUrl
      setResolvedImageMapUrl(objectUrl)
    } catch (error) {
      setBuildingsMapError(error instanceof Error ? error.message : "No se pudo cargar el mapa.")
    } finally {
      setIsResolvingImageFallback(false)
    }
  }, [effectiveMapUrl, isBackendImageAsset, isResolvingImageFallback, resolvedImageMapUrl])

  const handleMapImageError = useCallback(() => {
    setMapImageNaturalSize(null)

    if (isBackendImageAsset && !resolvedImageMapUrl) {
      void resolveImageFallback()
      return
    }

    setBuildingsMapError("No se pudo cargar el mapa.")
  }, [isBackendImageAsset, resolveImageFallback, resolvedImageMapUrl])

  const handleBuildingsMapLoadError = useCallback(
    (message: string | null) => {
      setBuildingsMapError(message)
      if (message) {
        notifySceneError(message)
      }
    },
    [notifySceneError],
  )

  useEffect(() => {
    if (buildingsMapError && !shouldUseBuildingsMap) {
      notifySceneError(buildingsMapError)
    }
  }, [buildingsMapError, notifySceneError, shouldUseBuildingsMap])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !effectiveMapUrl || shouldUseBuildingsMap) return

    const onWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-battle-wheel-stop='true']")) {
        return
      }

      event.preventDefault()

      const rect = viewport.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      const zoomFactor = Math.exp(-event.deltaY * 0.0012)
      const currentScale = scaleRef.current
      const currentOffset = offsetRef.current
      const nextScale = clamp(currentScale * zoomFactor, MIN_SCALE, MAX_SCALE)
      if (nextScale === currentScale) return

      const worldX = (pointer.x - currentOffset.x) / currentScale
      const worldY = (pointer.y - currentOffset.y) / currentScale

      scaleRef.current = nextScale
      const nextOffset = {
        x: pointer.x - worldX * nextScale,
        y: pointer.y - worldY * nextScale,
      }
      offsetRef.current = nextOffset
      applyCanvasTransform(nextScale, nextOffset)
      setScale(nextScale)
      setOffset(nextOffset)
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [applyCanvasTransform, imageMapEffectKey])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!effectiveMapUrl || shouldUseBuildingsMap) return
    if (event.button !== 0 && event.button !== 1) return

    if (event.target instanceof Element && event.target.closest("[data-battle-wheel-stop='true']")) {
      return
    }

    onMapBackgroundPointerDown?.()
    event.preventDefault()

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offsetRef.current,
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.start.x
    const deltaY = event.clientY - dragState.start.y

    const nextOffset = {
      x: dragState.origin.x + deltaX,
      y: dragState.origin.y + deltaY,
    }

    offsetRef.current = nextOffset
    if (panAnimationFrameRef.current !== null) {
      return
    }

    panAnimationFrameRef.current = window.requestAnimationFrame(() => {
      panAnimationFrameRef.current = null
      applyCanvasTransform(scaleRef.current, offsetRef.current)
    })
  }

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    dragRef.current = null
    setIsDragging(false)
    setOffset(offsetRef.current)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleResetView = useCallback(() => {
    const nextOffset = { x: 0, y: 0 }
    scaleRef.current = INITIAL_SCALE
    offsetRef.current = nextOffset
    applyCanvasTransform(INITIAL_SCALE, nextOffset)
    setScale(INITIAL_SCALE)
    setOffset(nextOffset)
  }, [applyCanvasTransform])

  const handleRotateMap = useCallback(async () => {
    if ((!landmark && !building) || !effectiveMapUrl || shouldUseBuildingsMap || isRotatingMap) {
      return
    }

    setIsRotatingMap(true)
    setBuildingsMapError(null)

    try {
      if (landmark) {
        const { id: landmarkId, ...payload } = landmark
        const savedLandmark = await updateLandmark(landmarkId, {
          ...payload,
          mapRotationDegrees: normalizeMapRotationDegrees(mapRotationDegrees + 90),
        })
        setLandmark(savedLandmark)
      } else if (building) {
        const savedBuilding = await updateBuilding(building.id, {
          ...building,
          mapRotationDegrees: normalizeMapRotationDegrees(mapRotationDegrees + 90),
        })
        setBuilding(savedBuilding)
      }
    } catch (error) {
      setBuildingsMapError(error instanceof Error ? error.message : "No se pudo rotar el mapa.")
    } finally {
      setIsRotatingMap(false)
    }
  }, [building, effectiveMapUrl, isRotatingMap, landmark, mapRotationDegrees, shouldUseBuildingsMap])

  useEffect(() => {
    if (!hasResolvedLoad) {
      return
    }

    if (!landmark && !building) {
      notifySceneError("Mapa no encontrado.")
      return
    }

    if (!effectiveMapUrl) {
      notifySceneError("Esta escena no tiene mapa.")
    }
  }, [building, effectiveMapUrl, hasResolvedLoad, landmark, notifySceneError])

  if (!hasResolvedLoad) {
    return renderState("Cargando mapa...")
  }

  if (!landmark && !building) {
    console.error("[LandmarkMapOnlyClient] Render aborted: scene entity not resolved", {
      sceneType: sceneType ?? "auto",
      sceneSlug: slugSource,
    })
    return renderState("Mapa no encontrado.")
  }

  if (!effectiveMapUrl) {
    console.warn("[LandmarkMapOnlyClient] Scene resolved without map", {
      sceneType: sceneType ?? (building ? "building" : "landmark"),
      sceneSlug: slugSource,
      buildingId: building?.id,
      landmarkId: landmark?.id,
    })
    return renderState("Esta escena no tiene mapa.")
  }

  if (shouldUseBuildingsMap) {
    return (
      <section className={fitParentHeight ? `${styles.root} ${styles.rootFitParent}` : styles.root}>
        <div className={styles.mapViewport}>
          {topLeftControls ? (
            <div className={styles.mapTopLeftControls} onPointerDown={(event) => event.stopPropagation()}>
              {topLeftControls}
            </div>
          ) : null}
          {topRightControls ? (
            <div className={styles.mapTopRightControls} onPointerDown={(event) => event.stopPropagation()}>
              {topRightControls}
            </div>
          ) : null}
          {bottomRightControls ? (
            <div className={styles.mapBottomRightControls} onPointerDown={(event) => event.stopPropagation()}>
              {bottomRightControls}
            </div>
          ) : null}
          {middleLeftControls ? (
            <div className={styles.mapMiddleLeftControls} onPointerDown={(event) => event.stopPropagation()}>
              {middleLeftControls}
            </div>
          ) : null}
          {topOverlay ? (
            <div className={mapMainOverlayClassName}>
              <div className={styles.mapTopOverlayContent} onPointerDown={(event) => event.stopPropagation()}>
                {topOverlay}
              </div>
            </div>
          ) : null}
          {presentationLabel}
          <BuildingsMap
            dataUrl={effectiveMapUrl}
            onLoadError={handleBuildingsMapLoadError}
            onLoadComplete={notifySceneReady}
            showGrid={showBattleGrid}
          />
          {shouldShowSilentFallbackCover ? (
            <div className={styles.fallbackImageOverlay}>
              <PresentationCover className="absolute inset-0" />
            </div>
          ) : null}
          {buildingsMapError && !emptyFallbackImageSrc ? <div className={styles.stateOverlay}>{buildingsMapError}</div> : null}
        </div>
      </section>
    )
  }

  return (
    <section className={fitParentHeight ? `${styles.root} ${styles.rootFitParent}` : styles.root}>
      <div
        ref={viewportRef}
        className={isDragging ? `${styles.mapViewport} ${styles.mapViewportDragging}` : styles.mapViewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDragStart={(event) => event.preventDefault()}
      >
        {(showControls || bottomRightControls) && (
          <div className={styles.mapBottomRightControls} onPointerDown={(event) => event.stopPropagation()}>
            {bottomRightControls}
            {showControls ? (
              <div className={styles.mapControls}>
                <Tooltip delayDuration={1000}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        className={styles.mapControlButton}
                        onClick={handleResetView}
                        aria-label="Ajustar vista"
                      >
                        <Maximize2 className={styles.mapControlIcon} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Ajustar vista
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={1000}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        className={styles.mapControlButton}
                        onClick={handleRotateMap}
                        disabled={isRotatingMap}
                        aria-label="Rotar 90 grados"
                      >
                        <RotateCw className={styles.mapControlIcon} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    Rotar 90 grados
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </div>
        )}
        {leftControls ? (
          <div className={styles.mapLeftControls} onPointerDown={(event) => event.stopPropagation()}>
            {leftControls}
          </div>
        ) : null}
        {middleLeftControls ? (
          <div className={styles.mapMiddleLeftControls} onPointerDown={(event) => event.stopPropagation()}>
            {middleLeftControls}
          </div>
        ) : null}
        {topLeftControls ? (
          <div className={styles.mapTopLeftControls} onPointerDown={(event) => event.stopPropagation()}>
            {topLeftControls}
          </div>
        ) : null}
        {topRightControls ? (
          <div className={styles.mapTopRightControls} onPointerDown={(event) => event.stopPropagation()}>
            {topRightControls}
          </div>
        ) : null}
        {topOverlay ? (
          <div className={mapMainOverlayClassName}>
            <div className={styles.mapTopOverlayContent} onPointerDown={(event) => event.stopPropagation()}>
              {topOverlay}
            </div>
          </div>
        ) : null}
        {presentationLabel}
        <div
          ref={mapCanvasRef}
          className={styles.mapCanvas}
        >
          <div className={styles.mapImageFrame}>
            <div
              className={styles.mapImageBounds}
              style={{
                width: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsWidth}px` : "100%",
                height: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsHeight}px` : "100%",
              }}
            >
              <div
                className={styles.mapImageLayer}
                style={mapImageLayerStyle}
              >
                {renderedImageMapUrl && (
                  <>
                    <img
                      key={renderedImageMapUrl}
                      src={renderedImageMapUrl}
                      alt={`Mapa de ${landmark?.nombre ?? building?.nombre ?? "escena"}`}
                      className={styles.mapImageAsset}
                      draggable={false}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      onLoad={handleMapImageLoad}
                      onError={handleMapImageError}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        ...(mapVerticalFlipStyle ?? {}),
                      }}
                    />
                    <div className={styles.mapImageOverlay} style={mapVerticalFlipStyle} />
                    {rotatedMapRenderSize && mapGridOverlayStyle && (
                      <div className={styles.mapGridOverlay} style={{ ...mapGridOverlayStyle, ...(mapVerticalFlipStyle ?? {}) }} />
                    )}
                    {overlay ? <div className={styles.mapOverlayLayer}>{overlay}</div> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {shouldShowSilentFallbackCover ? (
          <div className={styles.fallbackImageOverlay}>
            <PresentationCover className="absolute inset-0" />
          </div>
        ) : null}
        {isLoadingImageMap && !emptyFallbackImageSrc ? <div className={styles.stateOverlay}>Cargando mapa...</div> : null}
        {buildingsMapError && !emptyFallbackImageSrc ? <div className={styles.stateOverlay}>{buildingsMapError}</div> : null}
      </div>
    </section>
  )
})

LandmarkMapOnlyClient.displayName = "LandmarkMapOnlyClient"
