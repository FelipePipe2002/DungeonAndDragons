"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { Maximize2, RotateCw } from "lucide-react"

import BuildingsMap from "@/components/buildings/BuildingsMap"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { buildBackendApiUrl } from "@/lib/services/backend-api.service"
import { fetchLandmarks, updateLandmark } from "@/lib/services/landmark-api.service"
import type { Landmark, LandmarkType } from "@/lib/types"
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

interface LandmarkMapOnlyClientProps {
  nombreLandmark: string
  showControls?: boolean
  showPresentationLabel?: boolean
  leftControls?: ReactNode
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

function findLandmarkBySlug(landmarks: Landmark[], slug: string) {
  return landmarks.find((item) => landmarkNameToSlug(item.nombre) === slug) ?? null
}

export function LandmarkMapOnlyClient({
  nombreLandmark,
  showControls = true,
  showPresentationLabel = false,
  leftControls,
  topOverlay,
  overlay,
  fitParentHeight = false,
}: LandmarkMapOnlyClientProps) {
  const slug = useMemo(() => decodeSlug(nombreLandmark), [nombreLandmark])

  const [landmark, setLandmark] = useState<Landmark | null>(null)
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

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  const fallbackObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isActive = true
    setLandmark(null)
    setHasResolvedLoad(false)

    void fetchLandmarks()
      .then((landmarks) => {
        if (!isActive) return
        setLandmark(findLandmarkBySlug(landmarks, slug))
        setHasResolvedLoad(true)
      })
      .catch(() => {
        if (!isActive) return
        setLandmark(null)
        setHasResolvedLoad(true)
      })

    return () => {
      isActive = false
    }
  }, [slug])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  const effectiveMapUrl = useMemo(() => {
    if (!landmark) return null
    return mapUrlFromReference(landmark)
  }, [landmark])

  const shouldUseBuildingsMap =
    landmark?.mapAssetKind === "json" || landmark?.mapa?.kind === "buildings" || isJsonMapReference(effectiveMapUrl)
  const isBackendImageAsset =
    typeof effectiveMapUrl === "string" && !shouldUseBuildingsMap && isBackendAssetUrl(effectiveMapUrl)
  const renderedImageMapUrl = shouldUseBuildingsMap ? null : resolvedImageMapUrl ?? effectiveMapUrl
  const imageMapEffectKey = shouldUseBuildingsMap ? "__buildings__" : effectiveMapUrl ?? "__no-map__"
  const isLoadingImageMap =
    Boolean(effectiveMapUrl) &&
    !shouldUseBuildingsMap &&
    (!mapImageNaturalSize || !mapViewportSize) &&
    !buildingsMapError
  const mapRotationDegrees = normalizeMapRotationDegrees(landmark?.mapRotationDegrees)
  const canUseBattleGrid = landmark
    ? Boolean(effectiveMapUrl) && !shouldUseBuildingsMap && BATTLE_GRID_SUPPORTED_TYPES.has(landmark.tipo)
    : false
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
    canUseBattleGrid && landmark?.mapGridEnabled
      ? normalizeMapGridCellSize(landmark.mapGridCellSize) * mapGridRenderScale
      : 0
  const mapGridOffsetX =
    canUseBattleGrid && landmark?.mapGridEnabled
      ? normalizeMapGridOffset(landmark.mapGridOffsetX) * mapGridRenderScale
      : 0
  const mapGridOffsetY =
    canUseBattleGrid && landmark?.mapGridEnabled
      ? normalizeMapGridOffset(landmark.mapGridOffsetY) * mapGridRenderScale
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
            ["--battle-grid-cell-size" as "--battle-grid-cell-size"]: `${mapGridCellSize}px`,
            ["--battle-grid-offset-x" as "--battle-grid-offset-x"]: `${mapGridOffsetX}px`,
            ["--battle-grid-offset-y" as "--battle-grid-offset-y"]: `${mapGridOffsetY}px`,
          }
        : {
            transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
            ["--map-rotation-deg" as "--map-rotation-deg"]: `${mapRotationDegrees}deg`,
            ["--map-image-scale" as "--map-image-scale"]: String(mapGridRenderScale),
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

  useEffect(() => {
    const nextOffset = { x: 0, y: 0 }
    scaleRef.current = INITIAL_SCALE
    offsetRef.current = nextOffset
    setScale(INITIAL_SCALE)
    setOffset(nextOffset)
  }, [imageMapEffectKey, landmark?.id])

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
    setIsResolvingImageFallback(false)
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

  useEffect(() => {
    if (!renderedImageMapUrl || shouldUseBuildingsMap) {
      return
    }

    let isActive = true
    const probe = new Image()

    probe.onload = () => {
      if (!isActive) return

      const { naturalWidth, naturalHeight } = probe
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        setMapImageNaturalSize(null)

        if (isBackendImageAsset && !resolvedImageMapUrl) {
          void resolveImageFallback()
          return
        }

        setBuildingsMapError("No se pudo cargar el mapa.")
        return
      }

      setBuildingsMapError(null)
      setMapImageNaturalSize({
        width: naturalWidth,
        height: naturalHeight,
      })
    }

    probe.onerror = () => {
      if (!isActive) return

      setMapImageNaturalSize(null)
      if (isBackendImageAsset && !resolvedImageMapUrl) {
        void resolveImageFallback()
        return
      }

      setBuildingsMapError("No se pudo cargar el mapa.")
    }

    probe.src = renderedImageMapUrl

    return () => {
      isActive = false
      probe.onload = null
      probe.onerror = null
    }
  }, [renderedImageMapUrl, shouldUseBuildingsMap, isBackendImageAsset, resolvedImageMapUrl, resolveImageFallback])

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
      setScale(nextScale)
      const nextOffset = {
        x: pointer.x - worldX * nextScale,
        y: pointer.y - worldY * nextScale,
      }
      offsetRef.current = nextOffset
      setOffset(nextOffset)
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [imageMapEffectKey])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!effectiveMapUrl || shouldUseBuildingsMap) return
    if (event.button !== 0 && event.button !== 1) return
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
    setOffset(nextOffset)
  }

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    dragRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleResetView = useCallback(() => {
    const nextOffset = { x: 0, y: 0 }
    scaleRef.current = INITIAL_SCALE
    offsetRef.current = nextOffset
    setScale(INITIAL_SCALE)
    setOffset(nextOffset)
  }, [])

  const handleRotateMap = useCallback(async () => {
    if (!landmark || !effectiveMapUrl || shouldUseBuildingsMap || isRotatingMap) {
      return
    }

    setIsRotatingMap(true)
    setBuildingsMapError(null)

    try {
      const { id: landmarkId, ...payload } = landmark
      const savedLandmark = await updateLandmark(landmarkId, {
        ...payload,
        mapRotationDegrees: normalizeMapRotationDegrees(mapRotationDegrees + 90),
      })
      setLandmark(savedLandmark)
    } catch (error) {
      setBuildingsMapError(error instanceof Error ? error.message : "No se pudo rotar el mapa.")
    } finally {
      setIsRotatingMap(false)
    }
  }, [effectiveMapUrl, isRotatingMap, landmark, mapRotationDegrees, shouldUseBuildingsMap])

  if (!hasResolvedLoad) {
    return <div className={styles.state}>Cargando mapa...</div>
  }

  if (!landmark) {
    return <div className={styles.state}>Landmark no encontrado.</div>
  }

  if (!effectiveMapUrl) {
    return <div className={styles.state}>Este landmark no tiene mapa.</div>
  }

  if (shouldUseBuildingsMap) {
    return (
      <section className={fitParentHeight ? `${styles.root} ${styles.rootFitParent}` : styles.root}>
        <div className={styles.mapViewport}>
          {presentationLabel}
          <BuildingsMap dataUrl={effectiveMapUrl} onLoadError={setBuildingsMapError} />
          {buildingsMapError && <div className={styles.stateOverlay}>{buildingsMapError}</div>}
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
        {showControls && (
          <div
            className={styles.mapControls}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.mapControlButton}
              onClick={handleResetView}
              aria-label="Ajustar vista"
              title="Ajustar vista"
            >
              <Maximize2 className={styles.mapControlIcon} />
            </button>
            <button
              type="button"
              className={styles.mapControlButton}
              onClick={handleRotateMap}
              disabled={isRotatingMap}
              aria-label="Rotar 90 grados"
              title="Rotar 90 grados"
            >
              <RotateCw className={styles.mapControlIcon} />
            </button>
          </div>
        )}
        {leftControls ? (
          <div className={styles.mapLeftControls} onPointerDown={(event) => event.stopPropagation()}>
            {leftControls}
          </div>
        ) : null}
        {topOverlay ? (
          <div className={styles.mapTopOverlay}>
            <div className={styles.mapTopOverlayContent} onPointerDown={(event) => event.stopPropagation()}>
              {topOverlay}
            </div>
          </div>
        ) : null}
        {presentationLabel}
        <div
          className={styles.mapCanvas}
          style={{
            transform: `matrix(${scale}, 0, 0, ${scale}, ${offset.x}, ${offset.y})`,
          }}
        >
          <div className={styles.mapImageFrame}>
            <div
              className={styles.mapImageBounds}
              style={{
                width: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsWidth}px` : undefined,
                height: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsHeight}px` : undefined,
              }}
            >
              <div
                className={styles.mapImageLayer}
                style={mapImageLayerStyle}
              >
                {renderedImageMapUrl && rotatedMapRenderSize && (
                  <>
                    <img
                      key={renderedImageMapUrl}
                      src={renderedImageMapUrl}
                      alt={`Mapa de ${landmark.nombre}`}
                      className={styles.mapImageAsset}
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                    />
                    <div className={styles.mapImageOverlay} />
                    {mapGridOverlayStyle && <div className={styles.mapGridOverlay} style={mapGridOverlayStyle} />}
                    {overlay ? <div className={styles.mapOverlayLayer}>{overlay}</div> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {isLoadingImageMap && <div className={styles.stateOverlay}>Cargando mapa...</div>}
        {buildingsMapError && <div className={styles.stateOverlay}>{buildingsMapError}</div>}
      </div>
    </section>
  )
}
