"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { ArrowLeft, Building2, LoaderCircle, Monitor, Pencil, RotateCw, Save, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatEsArDateTime } from "@/lib/display"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import {
  formatMapGridNumber,
  normalizeMapGridCellSize,
  normalizeMapGridOffset,
  normalizeMapRotationDegrees,
  parseMapGridNumber,
} from "@/lib/map-grid"
import { openPresentationScreen } from "@/lib/presentation/screen"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { createBattle, fetchActiveBattle, fetchBattleHistory } from "@/lib/services/battle-api.service"
import { fetchBuildings, updateBuilding } from "@/lib/services/building-api.service"
import { fetchLandmarkReferences, type LandmarkReference } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { BattleSummary, Building } from "@/lib/types"
import styles from "./BuildingDetailPage.module.css"

const MIN_SCALE = 0.35
const MAX_SCALE = 3
const INITIAL_SCALE = 1

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

type MapGridDraft = {
  enabled: boolean
  cellSize: string
  offsetX: string
  offsetY: string
}

type OffsetPointerEvent = PointerEvent & {
  offsetX: number
  offsetY: number
}

type GridCellSliderDragState = {
  pointerId: number
  startX: number
  startValue: number
}

interface BuildingBattlePageProps {
  params: Promise<{
    nombreBuilding: string
  }>
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

function mapUrlFromReference(building: Building): string | null {
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

function decodeSlug(raw: string | undefined) {
  if (!raw) return ""

  try {
    return decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}

function formatBattleSummaryTimestamp(rawValue: string | undefined) {
  return formatEsArDateTime(rawValue, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toMapGridDraft(building: Building | null): MapGridDraft {
  return {
    enabled: Boolean(building?.mapGridEnabled),
    cellSize: formatMapGridNumber(normalizeMapGridCellSize(building?.mapGridCellSize)),
    offsetX: formatMapGridNumber(normalizeMapGridOffset(building?.mapGridOffsetX)),
    offsetY: formatMapGridNumber(normalizeMapGridOffset(building?.mapGridOffsetY)),
  }
}

function buildGridBackground(cellSize: number) {
  return [
    `linear-gradient(to right, rgba(0,0,0,0.4) 1px, transparent 1px)`,
    `linear-gradient(to bottom, rgba(0,0,0,0.4) 1px, transparent 1px)`,
  ].join(",")
}

export default function BuildingBattlePage({ params }: BuildingBattlePageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const buildingSlug = useMemo(() => decodeSlug(resolvedParams?.nombreBuilding), [resolvedParams?.nombreBuilding])

  const [building, setBuilding] = useState<Building | null>(null)
  const [parentLandmark, setParentLandmark] = useState<LandmarkReference | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [hasResolvedLoad, setHasResolvedLoad] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isStartingBattle, setIsStartingBattle] = useState(false)
  const [buildingBattleHistory, setBuildingBattleHistory] = useState<BattleSummary[]>([])
  const [isBattleHistoryLoading, setIsBattleHistoryLoading] = useState(false)
  const [battleHistoryError, setBattleHistoryError] = useState<string | null>(null)
  const [isRotatingMap, setIsRotatingMap] = useState(false)
  const [isGridPanelOpen, setIsGridPanelOpen] = useState(false)
  const [isGridAnchorMode, setIsGridAnchorMode] = useState(false)
  const [isGridPrecisionMode, setIsGridPrecisionMode] = useState(false)
  const [isSavingMapGrid, setIsSavingMapGrid] = useState(false)
  const [mapGridDraft, setMapGridDraft] = useState<MapGridDraft>(() => toMapGridDraft(null))
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [mapViewportSize, setMapViewportSize] = useState<Size | null>(null)
  const [mapImageNaturalSize, setMapImageNaturalSize] = useState<Size | null>(null)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const mapCanvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const gridCellSliderDragRef = useRef<GridCellSliderDragState | null>(null)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  const hasViewportInteractionRef = useRef(false)
  const battleHistoryRequestRef = useRef(0)

  const effectiveMapUrl = useMemo(() => (building ? mapUrlFromReference(building) : null), [building])
  const usesUnsupportedMapType =
    building?.mapAssetKind === "json" || isJsonMapReference(effectiveMapUrl)
  const buildingSceneSlug = useMemo(() => (building ? landmarkNameToSlug(building.nombre) : null), [building])
  const parentLandmarkSlug = useMemo(
    () => (parentLandmark ? landmarkNameToSlug(parentLandmark.nombre) : null),
    [parentLandmark],
  )
  const canManageBuildingBattles = Boolean(
    building &&
      parentLandmarkSlug &&
      effectiveMapUrl &&
      !usesUnsupportedMapType,
  )
  const mapRotationDegrees = normalizeMapRotationDegrees(building?.mapRotationDegrees)

  const parentLandmarkHref = parentLandmark ? `/landmarks/${landmarkNameToSlug(parentLandmark.nombre)}` : "/landmarks"

  const applyCanvasTransform = useCallback((nextScale: number, nextOffset: Point) => {
    const canvas = mapCanvasRef.current
    if (!canvas) {
      return
    }

    canvas.style.transform = `matrix(${nextScale}, 0, 0, ${nextScale}, ${nextOffset.x}, ${nextOffset.y})`
  }, [])

  const persistBuilding = useCallback(
    async (partial: Partial<Omit<Building, "id">>) => {
      if (!building) {
        return null
      }

      const nextBuilding = await updateBuilding(building.id, {
        ...building,
        ...partial,
      })
      setBuilding(nextBuilding)
      return nextBuilding
    },
    [building],
  )

  useEffect(() => {
    scaleRef.current = scale
    offsetRef.current = offset
    applyCanvasTransform(scale, offset)
  }, [applyCanvasTransform, offset, scale])

  useEffect(() => {
    let isActive = true
    setBuilding(null)
    setParentLandmark(null)
    setOrganizationName(null)
    setBuildingBattleHistory([])
    setBattleHistoryError(null)
    setIsBattleHistoryLoading(false)
    setLoadError(null)
    setHasResolvedLoad(false)
    hasViewportInteractionRef.current = false

    void Promise.all([fetchBuildings(true), fetchLandmarkReferences(true), fetchOrganizations().catch(() => [])])
      .then(([storedBuildings, storedLandmarks, storedOrganizations]) => {
        if (!isActive) {
          return
        }

        const matches = storedBuildings.filter((candidate) => landmarkNameToSlug(candidate.nombre) === buildingSlug)
        if (matches.length === 0) {
          setLoadError("Building no encontrado.")
          return
        }

        if (matches.length > 1) {
          setLoadError("Hay más de un building con ese slug. Necesitás una ruta más específica.")
          return
        }

        const nextBuilding = matches[0]
        setBuilding(nextBuilding)
        setIsEditing(false)
        setDescriptionDraft(nextBuilding.descripcion ?? "")
        setMapGridDraft(toMapGridDraft(nextBuilding))
        setParentLandmark(
          typeof nextBuilding.landmarkId === "number"
            ? storedLandmarks.find((landmark) => landmark.id === nextBuilding.landmarkId) ?? null
            : null,
        )
        setOrganizationName(
          typeof nextBuilding.organizationId === "number"
            ? storedOrganizations.find((organization) => organization.id === nextBuilding.organizationId)?.nombre ?? null
            : null,
        )
      })
      .catch((error) => {
        if (!isActive) {
          return
        }

        setLoadError(getBackendErrorMessage(error, "No se pudo cargar el building."))
      })
      .finally(() => {
        if (isActive) {
          setHasResolvedLoad(true)
        }
      })

    return () => {
      isActive = false
    }
  }, [buildingSlug])

  useEffect(() => {
    if (!parentLandmarkSlug || !buildingSceneSlug || !canManageBuildingBattles) {
      battleHistoryRequestRef.current += 1
      setBuildingBattleHistory([])
      setBattleHistoryError(null)
      setIsBattleHistoryLoading(false)
      return
    }

    const requestId = ++battleHistoryRequestRef.current
    setIsBattleHistoryLoading(true)
    setBattleHistoryError(null)

    void fetchBattleHistory(parentLandmarkSlug, {
      sceneType: "building",
      sceneSlug: buildingSceneSlug,
    })
      .then((history) => {
        if (requestId !== battleHistoryRequestRef.current) {
          return
        }

        setBuildingBattleHistory(history)
      })
      .catch((error) => {
        if (requestId !== battleHistoryRequestRef.current) {
          return
        }

        setBuildingBattleHistory([])
        setBattleHistoryError(getBackendErrorMessage(error, "No se pudo cargar el historial de batallas."))
      })
      .finally(() => {
        if (requestId === battleHistoryRequestRef.current) {
          setIsBattleHistoryLoading(false)
        }
      })
  }, [buildingSceneSlug, canManageBuildingBattles, parentLandmarkSlug])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const updateViewportSize = () => {
      const rect = viewport.getBoundingClientRect()
      setMapViewportSize({ width: rect.width, height: rect.height })
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(viewport)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!mapViewportSize || !mapImageNaturalSize || !effectiveMapUrl) {
      return
    }

    if (hasViewportInteractionRef.current) {
      return
    }

    const isQuarterTurn = mapRotationDegrees % 180 !== 0
    const fittedWidth = isQuarterTurn ? mapImageNaturalSize.height : mapImageNaturalSize.width
    const fittedHeight = isQuarterTurn ? mapImageNaturalSize.width : mapImageNaturalSize.height

    const fitScale = Math.min(
      mapViewportSize.width / fittedWidth,
      mapViewportSize.height / fittedHeight,
      1,
    )
    const nextScale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1
    scaleRef.current = nextScale
    offsetRef.current = { x: 0, y: 0 }
    setScale(nextScale)
    setOffset({ x: 0, y: 0 })
  }, [effectiveMapUrl, mapImageNaturalSize, mapRotationDegrees, mapViewportSize])

  useEffect(() => {
    if (!isEditing) {
      setIsGridPanelOpen(false)
      setIsGridAnchorMode(false)
      setIsGridPrecisionMode(false)
    }
  }, [isEditing])

  useEffect(() => {
    if (!isGridPanelOpen) {
      setIsGridAnchorMode(false)
      setIsGridPrecisionMode(false)
    }
  }, [isGridPanelOpen])

  useEffect(() => {
    if (!isEditing || !isGridPanelOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsGridPrecisionMode(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setIsGridPrecisionMode(false)
      }
    }

    const handleWindowBlur = () => {
      setIsGridPrecisionMode(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleWindowBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleWindowBlur)
    }
  }, [isEditing, isGridPanelOpen])

  const handleStartEdit = useCallback(() => {
    if (!building) {
      return
    }

    setSaveError(null)
    setDescriptionDraft(building.descripcion ?? "")
    setMapGridDraft(toMapGridDraft(building))
    setIsEditing(true)
  }, [building])

  const handleCancelEdit = useCallback(() => {
    setSaveError(null)
    setDescriptionDraft(building?.descripcion ?? "")
    setMapGridDraft(toMapGridDraft(building))
    setIsGridPanelOpen(false)
    setIsGridAnchorMode(false)
    setIsEditing(false)
  }, [building])

  const handleSaveDescription = useCallback(async () => {
    if (!building || !isEditing) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const savedBuilding = await persistBuilding({ descripcion: descriptionDraft })
      if (savedBuilding) {
        setDescriptionDraft(savedBuilding.descripcion ?? "")
        setIsEditing(false)
      }
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar la descripción del building."))
    } finally {
      setIsSaving(false)
    }
  }, [building, descriptionDraft, isEditing, persistBuilding])

  const handleClearMap = useCallback(async () => {
    if (!building || !isEditing) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const savedBuilding = await persistBuilding({
        mapAssetId: undefined,
        mapa: undefined,
      })
      if (savedBuilding) {
        setMapImageNaturalSize(null)
        hasViewportInteractionRef.current = false
      }
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo limpiar el mapa del building."))
    } finally {
      setIsSaving(false)
    }
  }, [building, isEditing, persistBuilding])

  const handleRotateMap = useCallback(async () => {
    if (!building || !isEditing || !effectiveMapUrl || usesUnsupportedMapType || isRotatingMap) {
      return
    }

    setIsRotatingMap(true)
    setSaveError(null)

    try {
      await persistBuilding({
        mapRotationDegrees: normalizeMapRotationDegrees((building.mapRotationDegrees ?? 0) + 90),
      })
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo rotar el mapa del building."))
    } finally {
      setIsRotatingMap(false)
    }
  }, [building, effectiveMapUrl, isEditing, isRotatingMap, persistBuilding, usesUnsupportedMapType])

  const handleSaveMapGrid = useCallback(async () => {
    if (!building || !isEditing) {
      return
    }

    setIsSavingMapGrid(true)
    setSaveError(null)

    try {
      await persistBuilding({
        mapGridEnabled: mapGridDraft.enabled,
        mapGridCellSize: normalizeMapGridCellSize(parseMapGridNumber(mapGridDraft.cellSize)),
        mapGridOffsetX: normalizeMapGridOffset(parseMapGridNumber(mapGridDraft.offsetX)),
        mapGridOffsetY: normalizeMapGridOffset(parseMapGridNumber(mapGridDraft.offsetY)),
      })
      setIsGridPanelOpen(false)
      setIsGridAnchorMode(false)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo guardar la grilla del building."))
    } finally {
      setIsSavingMapGrid(false)
    }
  }, [building, isEditing, mapGridDraft, persistBuilding])

  const handleSelectGridAnchor = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isGridAnchorMode) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const nativeEvent = event.nativeEvent as OffsetPointerEvent
    const nextOffsetX = normalizeMapGridOffset(nativeEvent.offsetX)
    const nextOffsetY = normalizeMapGridOffset(nativeEvent.offsetY)

    setMapGridDraft((current) => ({
      ...current,
      offsetX: formatMapGridNumber(nextOffsetX),
      offsetY: formatMapGridNumber(nextOffsetY),
    }))
    setIsGridAnchorMode(false)
  }, [isGridAnchorMode])

  const updateMapGridCellSizeDraft = useCallback((rawValue: number, precise: boolean) => {
    const clampedValue = clamp(rawValue, 8, 128)
    const snappedValue = precise
      ? Math.round(clampedValue * 10) / 10
      : Math.round(clampedValue)

    setMapGridDraft((current) => ({
      ...current,
      cellSize: formatMapGridNumber(snappedValue),
    }))
  }, [])

  const handleGridCellSliderPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const currentValue = parseMapGridNumber(mapGridDraft.cellSize) ?? 48
    gridCellSliderDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: currentValue,
    }
    setIsGridPrecisionMode(event.shiftKey)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [mapGridDraft.cellSize])

  const handleGridCellSliderPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = gridCellSliderDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const trackWidth = Math.max(event.currentTarget.clientWidth, 1)
    const normalizedDelta = (event.clientX - dragState.startX) / trackWidth
    const sensitivity = event.shiftKey ? 0.2 : 1
    const nextValue = dragState.startValue + normalizedDelta * (128 - 8) * sensitivity

    setIsGridPrecisionMode(event.shiftKey)
    updateMapGridCellSizeDraft(nextValue, event.shiftKey)
  }, [updateMapGridCellSizeDraft])

  const handleGridCellSliderPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = gridCellSliderDragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    gridCellSliderDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsGridPrecisionMode(false)
  }, [])

  const handleStartBattle = useCallback(async () => {
    if (!building) {
      return
    }

    if (!parentLandmarkSlug || !buildingSceneSlug) {
      setSaveError("El building necesita un landmark asociado para abrirse en /batalla.")
      return
    }

    setIsStartingBattle(true)
    setSaveError(null)

    try {
      const currentBattle = await fetchActiveBattle("building", buildingSceneSlug)
      if (currentBattle?.status === "active") {
        const params = new URLSearchParams({
          landmark: parentLandmarkSlug,
          battleId: String(currentBattle.id),
        })
        router.push(`/batalla?${params.toString()}`)
        return
      }

      const createdBattle = await createBattle({
        sceneType: "building",
        sceneSlug: buildingSceneSlug,
        parentLandmarkSlug,
      })
      const params = new URLSearchParams({
        landmark: parentLandmarkSlug,
        battleId: String(createdBattle.id),
      })
      router.push(`/batalla?${params.toString()}`)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo iniciar la batalla para este building."))
    } finally {
      setIsStartingBattle(false)
    }
  }, [building, buildingSceneSlug, parentLandmarkSlug, router])

  const handleOpenBuildingInPresentation = useCallback(() => {
    if (!buildingSceneSlug) {
      return
    }

    openPresentationScreen({
      sceneType: "building",
      sceneSlug: buildingSceneSlug,
    })
  }, [buildingSceneSlug])

  const handleViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("button, input, textarea, a")) {
      return
    }

    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    viewport.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offsetRef.current,
    }
    setIsDragging(true)
    hasViewportInteractionRef.current = true
  }, [])

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const nextOffset = {
      x: dragState.origin.x + (event.clientX - dragState.start.x),
      y: dragState.origin.y + (event.clientY - dragState.start.y),
    }
    setOffset(nextOffset)
  }, [])

  const finishDrag = useCallback((pointerId?: number) => {
    if (pointerId !== undefined && dragRef.current?.pointerId !== pointerId) {
      return
    }

    dragRef.current = null
    setIsDragging(false)
  }, [])

  const handleViewportWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!effectiveMapUrl || usesUnsupportedMapType) {
      return
    }

    event.preventDefault()
    hasViewportInteractionRef.current = true
    setScale((current) => clamp(current * (event.deltaY > 0 ? 0.92 : 1.08), MIN_SCALE, MAX_SCALE))
  }, [effectiveMapUrl, usesUnsupportedMapType])

  if (!hasResolvedLoad) {
    return (
      <main className="flex min-h-[calc(100dvh-var(--app-nav-height))] items-center justify-center bg-stone-950 text-stone-100">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando building...
        </span>
      </main>
    )
  }

  if (!building) {
    return (
      <main className="flex min-h-[calc(100dvh-var(--app-nav-height))] items-center justify-center bg-stone-950 px-6 text-stone-100">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-serif text-xl text-primary">Building no encontrado</h1>
          <p className="text-sm text-stone-300">{loadError ?? "No existe un building con ese slug."}</p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/entidades?section=edificios">Volver a edificios</Link>
            </Button>
            <Button asChild>
              <Link href="/batalla">Ir a batalla</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const mapGridCellSize = normalizeMapGridCellSize(building.mapGridCellSize)
  const mapGridOffsetX = normalizeMapGridOffset(building.mapGridOffsetX)
  const mapGridOffsetY = normalizeMapGridOffset(building.mapGridOffsetY)
  const previewMapGridEnabled = isEditing ? mapGridDraft.enabled : Boolean(building.mapGridEnabled)
  const previewMapGridCellSize = isEditing
    ? normalizeMapGridCellSize(parseMapGridNumber(mapGridDraft.cellSize))
    : mapGridCellSize
  const previewMapGridOffsetX = isEditing
    ? normalizeMapGridOffset(parseMapGridNumber(mapGridDraft.offsetX))
    : mapGridOffsetX
  const previewMapGridOffsetY = isEditing
    ? normalizeMapGridOffset(parseMapGridNumber(mapGridDraft.offsetY))
    : mapGridOffsetY
  const mapGridCellSizeDraftValue = parseMapGridNumber(mapGridDraft.cellSize) ?? 48
  const mapGridCellSizeSliderProgress = ((clamp(mapGridCellSizeDraftValue, 8, 128) - 8) / (128 - 8)) * 100

  return (
      <div className={styles.root}>
        <section className={styles.mapPane}>
          {effectiveMapUrl && !usesUnsupportedMapType && isEditing ? (
            <>
              <button
                type="button"
                className={styles.mapGridToggleButton}
                onClick={() => {
                  setIsGridPanelOpen((current) => {
                    if (current) {
                      setIsGridAnchorMode(false)
                    }

                    return !current
                  })
                }}
              >
                Grilla
              </button>
              <button
                type="button"
                className={styles.mapRotateButton}
                onClick={() => void handleRotateMap()}
                disabled={isRotatingMap || !isEditing}
              >
                <RotateCw className={styles.mapRotateIcon} />
                {isRotatingMap ? "Rotando..." : "Rotar 90°"}
              </button>
            </>
          ) : null}

          {isGridPanelOpen && effectiveMapUrl && !usesUnsupportedMapType ? (
            <div className={styles.mapGridPanel}>
              <div className={styles.mapGridPanelTitle}>Grilla de batalla</div>
              <p className={styles.mapGridHint}>Ajustá tamaño de celda y offsets sólo para este building.</p>

              <div className={styles.mapGridField}>
                <label className={styles.mapGridLabel}>
                  <input
                    type="checkbox"
                    checked={mapGridDraft.enabled}
                    onChange={(event) =>
                      setMapGridDraft((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />{" "}
                  Habilitar grilla
                </label>
              </div>

              <div className={styles.mapGridField}>
                <label className={styles.mapGridLabel}>
                  Tamaño de celda {isGridPrecisionMode ? "(precision)" : ""}
                </label>
                <div className={styles.mapGridRangeRow}>
                  <div
                    role="slider"
                    aria-label="Tamaño de celda"
                    aria-valuemin={8}
                    aria-valuemax={128}
                    aria-valuenow={clamp(mapGridCellSizeDraftValue, 8, 128)}
                    tabIndex={0}
                    className={styles.mapGridRangeInput}
                    onPointerDown={handleGridCellSliderPointerDown}
                    onPointerMove={handleGridCellSliderPointerMove}
                    onPointerUp={handleGridCellSliderPointerEnd}
                    onPointerCancel={handleGridCellSliderPointerEnd}
                    onKeyDown={(event) => {
                      const precise = event.shiftKey
                      const delta =
                        event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? precise ? 0.1 : 1
                          : event.key === "ArrowLeft" || event.key === "ArrowDown"
                            ? precise ? -0.1 : -1
                            : 0

                      if (delta === 0) {
                        return
                      }

                      event.preventDefault()
                      setIsGridPrecisionMode(precise)
                      updateMapGridCellSizeDraft(mapGridCellSizeDraftValue + delta, precise)
                    }}
                    onKeyUp={(event) => {
                      if (event.key === "Shift") {
                        setIsGridPrecisionMode(false)
                      }
                    }}
                  >
                    <div className={styles.mapGridRangeTrack} />
                    <div
                      className={styles.mapGridRangeFill}
                      style={{ width: `${mapGridCellSizeSliderProgress}%` }}
                    />
                    <div
                      className={styles.mapGridRangeThumb}
                      style={{ left: `${mapGridCellSizeSliderProgress}%` }}
                    />
                  </div>
                  <input
                    type="text"
                    value={mapGridDraft.cellSize}
                    className={styles.mapGridNumberInput}
                    onChange={(event) =>
                      setMapGridDraft((current) => ({ ...current, cellSize: event.target.value }))
                    }
                  />
                </div>
                <p className={styles.mapGridHint}>
                  Mantené `Shift` mientras ajustás para activar modo precisión.
                </p>
              </div>

              <div className={styles.mapGridField}>
                <label className={styles.mapGridLabel}>Offsets</label>
                <div className={styles.mapGridOffsetsRow}>
                  <input
                    type="text"
                    value={mapGridDraft.offsetX}
                    className={styles.mapGridNumberInput}
                    onChange={(event) =>
                      setMapGridDraft((current) => ({ ...current, offsetX: event.target.value }))
                    }
                    placeholder="Offset X"
                  />
                  <input
                    type="text"
                    value={mapGridDraft.offsetY}
                    className={styles.mapGridNumberInput}
                    onChange={(event) =>
                      setMapGridDraft((current) => ({ ...current, offsetY: event.target.value }))
                    }
                    placeholder="Offset Y"
                  />
                </div>
              </div>

              <div className={styles.mapGridActions}>
                <button
                  type="button"
                  className={styles.mapGridActionButton}
                  onClick={() => {
                    setIsGridAnchorMode((current) => !current)
                  }}
                >
                  {isGridAnchorMode ? "Cancelar esquina" : "Fijar esquina"}
                </button>
                <button
                  type="button"
                  className={styles.mapGridActionButton}
                  onClick={() => {
                    setMapGridDraft(toMapGridDraft(building))
                    setIsGridAnchorMode(false)
                    setIsGridPanelOpen(false)
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.mapGridPrimaryButton}
                  onClick={() => void handleSaveMapGrid()}
                  disabled={isSavingMapGrid}
                >
                  {isSavingMapGrid ? "Guardando..." : "Guardar grilla"}
                </button>
              </div>
              {isGridAnchorMode ? (
                <p className={styles.mapGridHint}>Hacé click sobre el mapa para fijar la esquina base de la grilla.</p>
              ) : null}
            </div>
          ) : null}

          <div
            ref={viewportRef}
            className={`${styles.mapViewport} ${isDragging ? styles.mapViewportDragging : ""}`}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={(event) => finishDrag(event.pointerId)}
            onPointerCancel={(event) => finishDrag(event.pointerId)}
            onWheel={handleViewportWheel}
          >
            {effectiveMapUrl && !usesUnsupportedMapType ? (
              <div ref={mapCanvasRef} className={styles.mapCanvas}>
                <div className={styles.mapImageFrame}>
                  <div className={styles.mapImageBounds}>
                    <div
                      className={styles.mapImageLayer}
                      style={{
                        transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: mapImageNaturalSize?.width,
                          height: mapImageNaturalSize?.height,
                          pointerEvents: isGridAnchorMode ? "auto" : "none",
                        }}
                        onPointerDown={handleSelectGridAnchor}
                      >
                        <img
                          src={effectiveMapUrl}
                          alt={`Mapa de ${building.nombre}`}
                          className={styles.mapImageAsset}
                          draggable={false}
                          onLoad={(event) => {
                            const target = event.currentTarget
                            setMapImageNaturalSize({
                              width: target.naturalWidth,
                              height: target.naturalHeight,
                            })
                          }}
                        />
                        {previewMapGridEnabled ? (
                          <div
                            className={styles.mapGridOverlay}
                            style={{
                              backgroundImage: buildGridBackground(previewMapGridCellSize),
                              backgroundSize: `${previewMapGridCellSize}px ${previewMapGridCellSize}px`,
                              backgroundPosition: `${previewMapGridOffsetX}px ${previewMapGridOffsetY}px`,
                            }}
                          />
                        ) : null}
                        {isEditing ? (
                          <div
                            className={styles.mapGridAnchorMarker}
                            style={{
                              left: `${previewMapGridOffsetX}px`,
                              top: `${previewMapGridOffsetY}px`,
                            }}
                          />
                        ) : null}
                        <div className={styles.mapImageOverlay} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!effectiveMapUrl ? (
              <div className={styles.noMapPrompt}>
                <div className={styles.noMapMainButton}>
                  <span className={styles.noMapTitle}>No hay mapa cargado</span>
                  <span className={styles.noMapText}>Este building no tiene una imagen de mapa disponible.</span>
                </div>
              </div>
            ) : null}

            {usesUnsupportedMapType ? (
              <div className={styles.mapErrorPrompt}>
                <div className={styles.mapErrorTitle}>Este building tiene un mapa no soportado en esta vista</div>
                <div className={styles.mapErrorText}>
                  Esta página de building sólo trabaja con mapas de imagen. `BuildingsMap` y mapas JSON quedan reservados para landmarks.
                </div>
                <div className={styles.mapErrorActions}>
                  <button
                    type="button"
                    className={styles.mapErrorDangerButton}
                    onClick={() => void handleClearMap()}
                    disabled={!isEditing || isSaving}
                  >
                    Limpiar mapa
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.infoPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderIcon}>
              <Building2 className="size-5" />
            </div>
            <div className={styles.panelHeaderBody}>
              <div className={styles.panelHeaderRow}>
                <h1 className={styles.panelTitle}>{building.nombre}</h1>
                <Button asChild variant="outline" size="sm">
                  <Link href="/entidades?section=edificios">
                    <ArrowLeft className="mr-2 size-4" />
                    Edificios
                  </Link>
                </Button>
              </div>
              <div className={styles.panelMetaRow}>
                <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                  Building
                </Badge>
                {parentLandmark ? (
                  <Link href={parentLandmarkHref} className={styles.panelMetaLink}>
                    {parentLandmark.nombre}
                  </Link>
                ) : (
                  <span className={styles.panelMetaText}>Sin landmark asociado</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex gap-2">
                {!isEditing ? (
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleStartEdit}>
                    <Pencil className="mr-1.5 size-3.5" />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button size="sm" className="text-xs" onClick={() => void handleSaveDescription()} disabled={isSaving}>
                      {isSaving ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
                      Guardar
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={handleCancelEdit} disabled={isSaving}>
                      <X className="mr-1.5 size-3.5" />
                      Cancelar
                    </Button>
                  </>
                )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Dueño</h3>
              <p className="text-xs leading-relaxed text-foreground/85">{building.duenoNombre ?? "Sin dueño"}</p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Organización</h3>
              <p className="text-xs leading-relaxed text-foreground/85">{organizationName ?? "Sin organización"}</p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Descripción</h3>
              {isEditing ? (
                <Textarea
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  className="min-h-[8rem] text-xs md:text-xs"
                  placeholder="Descripción del building..."
                />
              ) : (
                <p className="text-xs leading-relaxed text-foreground/85">
                  {building.descripcion?.trim() ? building.descripcion : "Sin descripción"}
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Etiquetas</h3>
              {building.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {building.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin tags</p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Mapa</h3>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => void handleClearMap()}
                    disabled={!effectiveMapUrl || isSaving}
                  >
                    Borrar mapa
                  </Button>
                </div>
              ) : null}
              {!effectiveMapUrl ? <p className="mt-2 text-xs text-muted-foreground">Sin imagen de mapa</p> : null}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Combate</h3>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => void handleStartBattle()}
                  disabled={isStartingBattle || !effectiveMapUrl || usesUnsupportedMapType}
                >
                  {isStartingBattle ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
                  {isStartingBattle ? "Iniciando batalla..." : "Iniciar batalla"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="px-3"
                  onClick={handleOpenBuildingInPresentation}
                  disabled={!buildingSceneSlug}
                  aria-label="Mostrar building en presentacion"
                >
                  <Monitor className="size-4" />
                </Button>
              </div>
              {!effectiveMapUrl ? (
                <p className="mt-2 text-xs text-muted-foreground">Cargá un mapa de imagen antes de abrir la batalla.</p>
              ) : null}
              {usesUnsupportedMapType ? (
                <p className="mt-2 text-xs text-muted-foreground">Este building sólo puede iniciar batalla con un mapa de imagen.</p>
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Historial de batallas</h3>
              {battleHistoryError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                  {battleHistoryError}
                </p>
              ) : isBattleHistoryLoading ? (
                <p className="text-xs text-muted-foreground">Cargando historial...</p>
              ) : !canManageBuildingBattles ? (
                <p className="text-xs text-muted-foreground">
                  Este building necesita un mapa de imagen para gestionar batallas guardadas.
                </p>
              ) : buildingBattleHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Todavía no hay batallas guardadas para este building.</p>
              ) : (
                <div className="space-y-2">
                  {buildingBattleHistory.map((battle) => (
                    <div
                      key={battle.id}
                      className={`rounded-xl border px-3 py-2 ${
                        battle.status === "active"
                          ? "border-amber-300 bg-amber-50"
                          : "border-border/70 bg-background/80"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-foreground">
                          #{battle.id} · {battle.status === "active" ? "Activa" : "Terminada"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBattleSummaryTimestamp(battle.updatedAt ?? battle.endedAt ?? battle.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {battle.tokenCount} fichas / {battle.obstacleCount} obstáculos
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => {
                            const params = new URLSearchParams({
                              landmark: parentLandmarkSlug ?? "",
                              battleId: String(battle.id),
                            })
                            router.push(`/batalla?${params.toString()}`)
                          }}
                        >
                          Abrir en /batalla
                        </Button>
                        {battle.status === "finished" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => {
                              const params = new URLSearchParams({
                                landmark: parentLandmarkSlug ?? "",
                                reopenBattleId: String(battle.id),
                              })
                              router.push(`/batalla?${params.toString()}`)
                            }}
                          >
                            Reabrir en /batalla
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saveError || loadError ? (
              <div className={styles.errorBox}>{saveError ?? loadError}</div>
            ) : null}
          </div>
        </aside>
      </div>
  )
}
