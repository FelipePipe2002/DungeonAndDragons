"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent as ReactFormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import type { Landmark, LandmarkId, LandmarkType } from "@/lib/types"
import {
  createLandmark,
  fetchLandmarks,
  updateLandmark,
} from "@/lib/services/landmark-api.service"
import {
  LANDMARKS_STORAGE_KEY,
  mapImageStorageKey,
  readJsonFromLocalStorage,
  writeJsonToLocalStorage,
} from "@/lib/services/local-storage.service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import styles from "./StandaloneMapViewer.module.css"

const MAP_WIDTH = 3982
const MAP_HEIGHT = 5232
const MIN_SCALE = 0.2
const MAX_SCALE = 3
const INITIAL_SCALE = 0.45
const DEFAULT_STORAGE_KEY = LANDMARKS_STORAGE_KEY
const CREATE_POPOVER_WIDTH = 304
const CREATE_POPOVER_HEIGHT = 420

const LANDMARK_TYPES: LandmarkType[] = [
  "ciudad",
  "pueblo",
  "aldea",
  "fuerte",
  "puente",
  "bandera",
  "campamento",
  "mazmorra",
]

const LANDMARK_TYPE_FOLDER_ALIASES: Record<LandmarkType, string[]> = {
  ciudad: ["ciudad"],
  pueblo: ["pueblo"],
  aldea: ["aldea"],
  fuerte: ["fuerte", "fortaleza"],
  puente: ["puente"],
  bandera: ["bandera"],
  campamento: ["campamento"],
  mazmorra: ["mazmorra"],
}

const LANDMARK_TYPE_LABELS: Record<LandmarkType, string> = {
  ciudad: "Ciudad",
  pueblo: "Pueblo",
  aldea: "Aldea",
  fuerte: "Fuerte",
  puente: "Puente",
  bandera: "Bandera",
  campamento: "Campamento",
  mazmorra: "Mazmorra",
}

type Point = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  start: Point
  origin: Point
}

type LandmarkPopoverMode = "actions" | "edit"

type LandmarkPopoverState = {
  landmarkId: LandmarkId
  mode: LandmarkPopoverMode
}

type LandmarkFormState = {
  nombre: string
  tipo: LandmarkType
  icono: string
  escalaIcono: number
  escalaTexto: number
  mostrarLeyenda: boolean
}

interface StandaloneMapViewerProps {
  initialLandmarks: Landmark[]
  initialFolderAssets?: Record<string, string[]>
  mapImageUrl?: string
  storageKey?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isLandmarkType(value: unknown): value is LandmarkType {
  return typeof value === "string" && LANDMARK_TYPES.includes(value as LandmarkType)
}

function isImageIcon(value: string | undefined) {
  if (!value) return false
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.includes("/")
  )
}

function fallbackIconForType(tipo: LandmarkType) {
  if (tipo === "ciudad") return "🏰"
  if (tipo === "pueblo") return "🏘️"
  if (tipo === "aldea") return "🏡"
  if (tipo === "fuerte") return "🏯"
  if (tipo === "puente") return "🌉"
  if (tipo === "bandera") return "🚩"
  if (tipo === "campamento") return "⛺"
  if (tipo === "mazmorra") return "🗿"
  return "📍"
}

function normalizeTypeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function typeFolderCandidates(tipo: LandmarkType) {
  const normalized = normalizeTypeKey(tipo)
  const aliases = LANDMARK_TYPE_FOLDER_ALIASES[tipo] ?? [normalized]
  return Array.from(new Set([normalized, ...aliases]))
}

function folderImagesForType(tipo: LandmarkType, folders: Record<string, string[]>) {
  const seen = new Set<string>()

  for (const folder of typeFolderCandidates(tipo)) {
    const images = folders[folder] ?? []
    for (const imagePath of images) {
      seen.add(imagePath)
    }
  }

  return Array.from(seen)
}

function nextLandmarkId(current: Landmark[]) {
  const maxId = current.reduce((acc, landmark) => Math.max(acc, landmark.id), 0)
  return maxId + 1
}

function buildLandmarkInput(
  nombre: string,
  tipo: LandmarkType,
  posicion: [number, number],
  icono: string,
  escalaIcono: number,
  escalaTexto: number,
  mostrarLeyenda: boolean,
): Omit<Landmark, "id"> {
  return {
    icono,
    nombre,
    tipo,
    escalaIcono,
    escalaTexto,
    mostrarLeyenda,
    posicion,
    tags: [],
    descripcionCorta: "",
    eventos: [],
    edificios: [],
    personajes: [],
    organizaciones: [],
  }
}

function resolveMarkerIcon(landmark: Landmark) {
  if (isImageIcon(landmark.icono)) {
    return { image: landmark.icono, text: "" }
  }

  return {
    image: "",
    text: fallbackIconForType(landmark.tipo),
  }
}

function labelOffsetPx(iconScale: number) {
  return 18 * clamp(iconScale, 0.6, 2.4) + 12
}

function toLandmarkFormState(landmark: Landmark): LandmarkFormState {
  return {
    nombre: landmark.nombre,
    tipo: landmark.tipo,
    icono: landmark.icono,
    escalaIcono: landmark.escalaIcono || 1,
    escalaTexto: landmark.escalaTexto || 1,
    mostrarLeyenda: landmark.mostrarLeyenda,
  }
}

function toLandmarkUpdateInput(landmark: Landmark): Omit<Landmark, "id"> {
  const { id: _ignoredLandmarkId, ...payload } = landmark
  return payload
}

export function StandaloneMapViewer({
  initialLandmarks,
  initialFolderAssets,
  mapImageUrl,
  storageKey = DEFAULT_STORAGE_KEY,
}: StandaloneMapViewerProps) {
  const [landmarks, setLandmarks] = useState<Landmark[]>(initialLandmarks)
  const [selectedId, setSelectedId] = useState<LandmarkId | null>(initialLandmarks[0]?.id ?? null)
  const folderAssets = initialFolderAssets ?? {}
  const [uploadedMapUrl, setUploadedMapUrl] = useState<string | null>(null)
  const [isMapDragOver, setIsMapDragOver] = useState(false)
  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createDialogAnchor, setCreateDialogAnchor] = useState<Point>({ x: 0, y: 0 })
  const [createPosition, setCreatePosition] = useState<[number, number] | null>(null)
  const [createName, setCreateName] = useState("")
  const [createType, setCreateType] = useState<LandmarkType>("ciudad")
  const [createIcon, setCreateIcon] = useState(fallbackIconForType("ciudad"))
  const [createIconScale, setCreateIconScale] = useState(1)
  const [createTextScale, setCreateTextScale] = useState(1)
  const [createShowLabel, setCreateShowLabel] = useState(true)
  const [landmarkPopover, setLandmarkPopover] = useState<LandmarkPopoverState | null>(null)
  const [editLandmarkForm, setEditLandmarkForm] = useState<LandmarkFormState | null>(null)
  const [movingLandmarkId, setMovingLandmarkId] = useState<LandmarkId | null>(null)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const mapFileInputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const panFrameRef = useRef<number | null>(null)
  const pendingOffsetRef = useRef<Point | null>(null)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  const createDialogOpenRef = useRef(isCreateDialogOpen)

  const mapImageKey = mapImageStorageKey(storageKey)
  const effectiveMapImageUrl = uploadedMapUrl ?? mapImageUrl

  const flushPendingPanUpdate = () => {
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current)
      panFrameRef.current = null
    }
    if (pendingOffsetRef.current) {
      const nextOffset = pendingOffsetRef.current
      pendingOffsetRef.current = null
      offsetRef.current = nextOffset
      setOffset(nextOffset)
    }
  }

  const pickFolderImageForType = (tipo: LandmarkType): string | null => {
    const images = folderImagesForType(tipo, folderAssets)
    return images.length > 0
      ? images[Math.floor(Math.random() * images.length)]
      : null
  }

  const createTypeImages = folderImagesForType(createType, folderAssets)
  const createFallbackIcon = fallbackIconForType(createType)
  const createPreviewName = createName.trim().length > 0 ? createName.trim() : "Nuevo Landmark"
  const createPreviewIcon = isImageIcon(createIcon)
    ? { image: createIcon, text: "" }
    : { image: "", text: createIcon || createFallbackIcon }
  const popoverLandmark = landmarkPopover
    ? (landmarks.find((landmark) => landmark.id === landmarkPopover.landmarkId) ?? null)
    : null
  const movingLandmark = movingLandmarkId
    ? (landmarks.find((landmark) => landmark.id === movingLandmarkId) ?? null)
    : null
  const editType = editLandmarkForm?.tipo ?? "ciudad"
  const editTypeImages = editLandmarkForm ? folderImagesForType(editType, folderAssets) : []
  const editFallbackIcon = fallbackIconForType(editType)

  const clampOffset = (rawOffset: Point, nextScale: number): Point => {
    const viewport = viewportRef.current
    if (!viewport) return rawOffset

    const viewportWidth = viewport.clientWidth
    const viewportHeight = viewport.clientHeight
    const scaledWidth = MAP_WIDTH * nextScale
    const scaledHeight = MAP_HEIGHT * nextScale

    const centerX = (viewportWidth - scaledWidth) / 2
    const centerY = (viewportHeight - scaledHeight) / 2

    const minX = scaledWidth <= viewportWidth ? centerX : viewportWidth - scaledWidth
    const maxX = scaledWidth <= viewportWidth ? centerX : 0
    const minY = scaledHeight <= viewportHeight ? centerY : viewportHeight - scaledHeight
    const maxY = scaledHeight <= viewportHeight ? centerY : 0

    return {
      x: clamp(rawOffset.x, minX, maxX),
      y: clamp(rawOffset.y, minY, maxY),
    }
  }

  const centerMap = (nextScale = scale) => {
    const viewport = viewportRef.current
    if (!viewport) return

    const centered = {
      x: (viewport.clientWidth - MAP_WIDTH * nextScale) / 2,
      y: (viewport.clientHeight - MAP_HEIGHT * nextScale) / 2,
    }
    const clampedCentered = clampOffset(centered, nextScale)

    scaleRef.current = nextScale
    offsetRef.current = clampedCentered
    setScale(nextScale)
    setOffset(clampedCentered)
  }

  const toMapPercent = (clientX: number, clientY: number): [number, number] | null => {
    const viewport = viewportRef.current
    if (!viewport) return null

    const rect = viewport.getBoundingClientRect()
    const localX = clientX - rect.left
    const localY = clientY - rect.top
    const currentOffset = offsetRef.current
    const currentScale = scaleRef.current

    const worldX = (localX - currentOffset.x) / currentScale
    const worldY = (localY - currentOffset.y) / currentScale

    return [
      clamp(worldX / MAP_WIDTH, 0, 1),
      clamp(worldY / MAP_HEIGHT, 0, 1),
    ]
  }

  useEffect(() => {
    let isActive = true

    void fetchLandmarks()
      .then((hydrated) => {
        if (!isActive) return

        setLandmarks(hydrated)
        setSelectedId((currentSelected) => {
          if (
            typeof currentSelected === "number" &&
            hydrated.some((item) => item.id === currentSelected)
          ) {
            return currentSelected
          }
          return hydrated[0]?.id ?? null
        })
      })
      .catch(() => {
        if (!isActive) return
        setSelectedId((currentSelected) => {
          if (
            typeof currentSelected === "number" &&
            initialLandmarks.some((item) => item.id === currentSelected)
          ) {
            return currentSelected
          }
          return initialLandmarks[0]?.id ?? null
        })
      })

    return () => {
      isActive = false
    }
  }, [initialLandmarks])

  useEffect(() => {
    const storedMapImage = readJsonFromLocalStorage<string>(mapImageKey)
    if (
      typeof storedMapImage === "string" &&
      storedMapImage.length > 0 &&
      storedMapImage.startsWith("data:image/")
    ) {
      setUploadedMapUrl(storedMapImage)
      return
    }
    setUploadedMapUrl(null)
  }, [mapImageKey])

  useEffect(() => {
    if (Object.keys(folderAssets).length === 0) return

    setLandmarks((current) =>
      current.map((landmark) => {
        if (isImageIcon(landmark.icono)) {
          return landmark
        }

        const nextImage = pickFolderImageForType(landmark.tipo)
        if (!nextImage) {
          return { ...landmark, icono: fallbackIconForType(landmark.tipo) }
        }

        return { ...landmark, icono: nextImage }
      }),
    )
  }, [folderAssets])

  useEffect(() => {
    centerMap(INITIAL_SCALE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    createDialogOpenRef.current = isCreateDialogOpen
  }, [isCreateDialogOpen])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      const clampedOffset = clampOffset(offsetRef.current, scaleRef.current)
      offsetRef.current = clampedOffset
      setOffset(clampedOffset)
    })

    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (createDialogOpenRef.current) {
        setIsCreateDialogOpen(false)
        setCreatePosition(null)
      }

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
      const nextOffset = {
        x: pointer.x - worldX * nextScale,
        y: pointer.y - worldY * nextScale,
      }
      const clampedOffset = clampOffset(nextOffset, nextScale)

      scaleRef.current = nextScale
      offsetRef.current = clampedOffset
      setScale(nextScale)
      setOffset(clampedOffset)
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
        panFrameRef.current = null
      }
      pendingOffsetRef.current = null
    }
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) {
      return
    }
    event.preventDefault()

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offsetRef.current,
    }
    suppressClickRef.current = false
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragState.start.x
    const deltaY = event.clientY - dragState.start.y

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      suppressClickRef.current = true
    }

    const rawOffset = {
      x: dragState.origin.x + deltaX,
      y: dragState.origin.y + deltaY,
    }

    pendingOffsetRef.current = clampOffset(rawOffset, scaleRef.current)
    if (panFrameRef.current === null) {
      panFrameRef.current = window.requestAnimationFrame(() => {
        panFrameRef.current = null
        if (!pendingOffsetRef.current) return
        const nextOffset = pendingOffsetRef.current
        pendingOffsetRef.current = null
        offsetRef.current = nextOffset
        setOffset(nextOffset)
      })
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    flushPendingPanUpdate()
    dragRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setCreatePosition(null)
  }

  const closeLandmarkPopover = () => {
    setLandmarkPopover(null)
    setEditLandmarkForm(null)
  }

  const openLandmarkActions = (landmarkId: LandmarkId) => {
    closeCreateDialog()
    setSelectedId(landmarkId)
    setMovingLandmarkId(null)
    setEditLandmarkForm(null)
    setLandmarkPopover({ landmarkId, mode: "actions" })
  }

  const openLandmarkEditor = (landmark: Landmark) => {
    closeCreateDialog()
    setSelectedId(landmark.id)
    setMovingLandmarkId(null)
    setEditLandmarkForm(toLandmarkFormState(landmark))
    setLandmarkPopover({ landmarkId: landmark.id, mode: "edit" })
  }

  const startMovingLandmark = (landmarkId: LandmarkId) => {
    closeCreateDialog()
    closeLandmarkPopover()
    setSelectedId(landmarkId)
    setMovingLandmarkId(landmarkId)
  }

  const moveLandmarkTo = async (
    landmarkId: LandmarkId,
    posicion: [number, number],
  ) => {
    const currentLandmark = landmarks.find((landmark) => landmark.id === landmarkId)
    if (!currentLandmark) {
      setMovingLandmarkId(null)
      return
    }

    setMovingLandmarkId(null)

    try {
      const savedLandmark = await updateLandmark(
        landmarkId,
        toLandmarkUpdateInput({ ...currentLandmark, posicion }),
      )
      setLandmarks((current) =>
        current.map((landmark) => (landmark.id === savedLandmark.id ? savedLandmark : landmark)),
      )
      setSelectedId(savedLandmark.id)
    } catch {
      // Keep existing position when the backend update fails.
    }
  }

  const handleViewportClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (movingLandmarkId !== null) {
      const posicion = toMapPercent(event.clientX, event.clientY)
      if (!posicion) return
      void moveLandmarkTo(movingLandmarkId, posicion)
      return
    }

    closeLandmarkPopover()
  }

  const openCreateDialogAt = (
    clientX: number,
    clientY: number,
    posicion: [number, number],
  ) => {
    const defaultType: LandmarkType = "ciudad"
    const nextId = nextLandmarkId(landmarks)
    const defaultIcon = pickFolderImageForType(defaultType) ?? fallbackIconForType(defaultType)
    const anchorX = clamp(clientX + 12, 12, window.innerWidth - CREATE_POPOVER_WIDTH - 12)
    const anchorY = clamp(clientY + 12, 12, window.innerHeight - CREATE_POPOVER_HEIGHT - 12)

    setCreateDialogAnchor({ x: anchorX, y: anchorY })
    setCreatePosition(posicion)
    setCreateName(`Nuevo Landmark ${nextId}`)
    setCreateType(defaultType)
    setCreateIcon(defaultIcon)
    setCreateIconScale(1)
    setCreateTextScale(1)
    setCreateShowLabel(true)
    setIsCreateDialogOpen(true)
  }

  const handleViewportContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()

    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (movingLandmarkId !== null) {
      setMovingLandmarkId(null)
      return
    }

    const posicion = toMapPercent(event.clientX, event.clientY)
    if (!posicion) return

    closeLandmarkPopover()
    openCreateDialogAt(event.clientX, event.clientY, posicion)
  }

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === "string" && result.startsWith("data:image/")) {
          resolve(result)
          return
        }
        reject(new Error("Formato de imagen invalido"))
      }
      reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"))
      reader.readAsDataURL(file)
    })

  const applyDroppedMapFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      return
    }

    try {
      const encodedMap = await readFileAsDataUrl(file)
      setUploadedMapUrl(encodedMap)
      writeJsonToLocalStorage(mapImageKey, encodedMap)
    } catch {
      // Ignore malformed file payloads
    }
  }

  const handleMapFileChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    void applyDroppedMapFile(file)
  }

  const handleMapDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    if (!isMapDragOver) {
      setIsMapDragOver(true)
    }
  }

  const handleMapDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    setIsMapDragOver(false)
  }

  const handleMapDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsMapDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    void applyDroppedMapFile(file)
  }

  const handleCreateTypeChange = (value: string) => {
    if (!isLandmarkType(value)) return

    setCreateType(value)
    setCreateIcon(pickFolderImageForType(value) ?? fallbackIconForType(value))
  }

  const handleEditTypeChange = (value: string) => {
    if (!isLandmarkType(value)) return

    setEditLandmarkForm((current) => {
      if (!current) return current
      return {
        ...current,
        tipo: value,
        icono: pickFolderImageForType(value) ?? fallbackIconForType(value),
      }
    })
  }

  const handleUpdateLandmark = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!landmarkPopover || landmarkPopover.mode !== "edit" || !editLandmarkForm) {
      return
    }

    const currentLandmark = landmarks.find((landmark) => landmark.id === landmarkPopover.landmarkId)
    if (!currentLandmark) return

    const nextName = editLandmarkForm.nombre.trim().length > 0
      ? editLandmarkForm.nombre.trim()
      : currentLandmark.nombre
    const nextIcon = editLandmarkForm.icono.trim().length > 0
      ? editLandmarkForm.icono.trim()
      : pickFolderImageForType(editLandmarkForm.tipo) ?? fallbackIconForType(editLandmarkForm.tipo)

    try {
      const savedLandmark = await updateLandmark(
        currentLandmark.id,
        toLandmarkUpdateInput({
          ...currentLandmark,
          nombre: nextName,
          tipo: editLandmarkForm.tipo,
          icono: nextIcon,
          escalaIcono: clamp(editLandmarkForm.escalaIcono, 0.6, 2.4),
          escalaTexto: clamp(editLandmarkForm.escalaTexto, 0.6, 2.4),
          mostrarLeyenda: editLandmarkForm.mostrarLeyenda,
        }),
      )
      setLandmarks((current) =>
        current.map((landmark) => (landmark.id === savedLandmark.id ? savedLandmark : landmark)),
      )
      setSelectedId(savedLandmark.id)
      closeLandmarkPopover()
    } catch {
      // Keep the editor open on backend errors.
    }
  }

  const handleCreateLandmark = async (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createPosition) return

    const landmarkId = nextLandmarkId(landmarks)
    const nextName = createName.trim().length > 0 ? createName.trim() : `Nuevo Landmark ${landmarkId}`
    const nextIcon = createIcon.trim().length > 0
      ? createIcon.trim()
      : pickFolderImageForType(createType) ?? fallbackIconForType(createType)
    const landmarkInput = buildLandmarkInput(
      nextName,
      createType,
      createPosition,
      nextIcon,
      clamp(createIconScale, 0.6, 2.4),
      clamp(createTextScale, 0.6, 2.4),
      createShowLabel,
    )

    try {
      const landmark = await createLandmark(landmarkInput)
      setLandmarks((current) => [...current, landmark])
      setSelectedId(landmark.id)
      closeCreateDialog()
    } catch {
      // Keep the creation popover open on backend errors.
    }
  }

  return (
    <>
      <section className={styles.root}>
        <input
          ref={mapFileInputRef}
          className={styles.hiddenInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          onChange={handleMapFileChange}
        />

        <div className={styles.viewportShell}>
          <div
            ref={viewportRef}
            className={[
              styles.viewport,
              isDragging ? styles.viewportDragging : "",
              isMapDragOver ? styles.viewportDragOver : "",
            ].filter(Boolean).join(" ")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onDragStart={(event) => event.preventDefault()}
            onClick={handleViewportClick}
            onContextMenu={handleViewportContextMenu}
            onDragOver={handleMapDragOver}
            onDragEnter={handleMapDragOver}
            onDragLeave={handleMapDragLeave}
            onDrop={handleMapDrop}
            onDoubleClick={() => mapFileInputRef.current?.click()}
          >
            <div
              className={styles.stage}
              style={{
                width: `${MAP_WIDTH}px`,
                height: `${MAP_HEIGHT}px`,
                transform: `matrix(${scale}, 0, 0, ${scale}, ${offset.x}, ${offset.y})`,
              }}
            >
              <div
                className={styles.mapLayer}
                style={
                  effectiveMapImageUrl
                    ? {
                        backgroundImage: `linear-gradient(rgba(34, 23, 9, 0.12), rgba(34, 23, 9, 0.12)), url(${effectiveMapImageUrl})`,
                        backgroundSize: "100% 100%, 100% 100%",
                        backgroundRepeat: "no-repeat, no-repeat",
                        backgroundPosition: "center, center",
                      }
                    : undefined
                }
              />

              {landmarks.map((landmark) => {
                const icon = resolveMarkerIcon(landmark)
                const isActive = selectedId === landmark.id
                return (
                  <div key={landmark.id}>
                    <button
                      type="button"
                      className={isActive ? `${styles.marker} ${styles.markerActive}` : styles.marker}
                      style={{
                        left: `${landmark.posicion[0] * 100}%`,
                        top: `${landmark.posicion[1] * 100}%`,
                        transform: `translate(-50%, -50%) scale(${landmark.escalaIcono || 1})`,
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        openLandmarkActions(landmark.id)
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (selectedId !== landmark.id) {
                          closeCreateDialog()
                          closeLandmarkPopover()
                          setMovingLandmarkId(null)
                          setSelectedId(landmark.id)
                          return
                        }

                        if (landmarkPopover?.landmarkId === landmark.id && landmarkPopover.mode === "actions") {
                          closeLandmarkPopover()
                          return
                        }

                        openLandmarkActions(landmark.id)
                      }}
                      title={landmark.nombre}
                    >
                      {icon.image ? (
                        <img src={icon.image} alt={landmark.nombre} draggable={false} />
                      ) : (
                        <span>{icon.text}</span>
                      )}
                    </button>

                    {landmark.mostrarLeyenda && (
                      <span
                        className={styles.markerLabel}
                        style={{
                          left: `${landmark.posicion[0] * 100}%`,
                          top: `${landmark.posicion[1] * 100}%`,
                          transform: `translate(-50%, ${labelOffsetPx(landmark.escalaIcono || 1)}px)`,
                          fontSize: `${clamp(0.68 * (landmark.escalaTexto || 1), 0.56, 1.2)}rem`,
                        }}
                      >
                        {landmark.nombre}
                      </span>
                    )}
                  </div>
                )
              })}

              {isCreateDialogOpen && createPosition && (
                <div>
                  <span
                    className={styles.marker}
                    style={{
                      left: `${createPosition[0] * 100}%`,
                      top: `${createPosition[1] * 100}%`,
                      transform: `translate(-50%, -50%) scale(${clamp(createIconScale, 0.6, 2.4)})`,
                      opacity: 0.95,
                      filter: "drop-shadow(0 0 0.3rem oklch(0.42 0.1 45 / 0.5))",
                    }}
                  >
                    {createPreviewIcon.image ? (
                      <img src={createPreviewIcon.image} alt={createPreviewName} draggable={false} />
                    ) : (
                      <span>{createPreviewIcon.text}</span>
                    )}
                  </span>

                  {createShowLabel && (
                  <span
                    className={styles.markerLabel}
                    style={{
                      left: `${createPosition[0] * 100}%`,
                      top: `${createPosition[1] * 100}%`,
                      transform: `translate(-50%, ${labelOffsetPx(createIconScale)}px)`,
                      fontSize: `${clamp(0.68 * clamp(createTextScale, 0.6, 2.4), 0.56, 1.2)}rem`,
                    }}
                  >
                      {createPreviewName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isMapDragOver && (
              <div className={styles.mapDropHint}>
                Suelta la imagen para cargar el mapa
              </div>
            )}

            {movingLandmark && (
              <div className={styles.moveHint}>
                Reubicando {movingLandmark.nombre}. Haz clic en el mapa para confirmar.
              </div>
            )}
          </div>

          <Popover
            open={Boolean(landmarkPopover && popoverLandmark)}
            onOpenChange={(open) => {
              if (!open) {
                closeLandmarkPopover()
              }
            }}
          >
            {popoverLandmark && (
              <>
                <PopoverAnchor asChild>
                  <span
                    aria-hidden
                    className={styles.landmarkPopoverAnchor}
                    style={{
                      left: `${popoverLandmark.posicion[0] * MAP_WIDTH * scale + offset.x}px`,
                      top: `${popoverLandmark.posicion[1] * MAP_HEIGHT * scale + offset.y}px`,
                    }}
                  />
                </PopoverAnchor>
                <PopoverContent
                  className="parchment w-[19rem] p-3"
                  side="right"
                  align="center"
                  sideOffset={10}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  {landmarkPopover?.mode === "actions" ? (
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-serif text-sm text-primary">{popoverLandmark.nombre}</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Segundo clic: abre estas acciones.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openLandmarkEditor(popoverLandmark)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startMovingLandmark(popoverLandmark.id)}
                        >
                          Mover
                        </Button>
                      </div>
                    </div>
                  ) : editLandmarkForm ? (
                    <form className="space-y-2.5" onSubmit={handleUpdateLandmark}>
                      <div>
                        <h3 className="font-serif text-sm text-primary">Editar Landmark</h3>
                        <p className="text-[11px] text-muted-foreground">
                          Ajusta los datos basicos visibles en el mapa.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="edit-landmark-name" className="text-xs font-medium">
                          Nombre
                        </label>
                        <Input
                          id="edit-landmark-name"
                          value={editLandmarkForm.nombre}
                          onChange={(event) =>
                            setEditLandmarkForm((current) =>
                              current ? { ...current, nombre: event.target.value } : current,
                            )
                          }
                          placeholder="Nombre del landmark"
                          autoFocus
                          required
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label htmlFor="edit-landmark-type" className="text-xs font-medium">
                          Tipo
                        </label>
                        <Select value={editLandmarkForm.tipo} onValueChange={handleEditTypeChange}>
                          <SelectTrigger id="edit-landmark-type" className="h-8 w-full text-xs">
                            <SelectValue placeholder="Selecciona tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {LANDMARK_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {LANDMARK_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium">
                          Icono
                        </label>
                        <div className="grid max-h-24 grid-cols-6 gap-1 overflow-auto rounded-md border border-border/70 bg-background/60 p-1">
                          <button
                            type="button"
                            className={`flex h-9 w-9 items-center justify-center rounded-sm border text-base ${
                              editLandmarkForm.icono === editFallbackIcon
                                ? "border-primary bg-primary/10"
                                : "border-border/70 bg-background/80 hover:bg-accent/70"
                            }`}
                            onClick={() =>
                              setEditLandmarkForm((current) =>
                                current ? { ...current, icono: editFallbackIcon } : current,
                              )
                            }
                            title="Icono fallback"
                          >
                            <span>{editFallbackIcon}</span>
                          </button>
                          {editTypeImages.map((iconPath) => (
                            <button
                              key={iconPath}
                              type="button"
                              className={`flex h-9 w-9 items-center justify-center rounded-sm border ${
                                editLandmarkForm.icono === iconPath
                                  ? "border-primary bg-primary/10"
                                  : "border-border/70 bg-background/80 hover:bg-accent/70"
                              }`}
                              onClick={() =>
                                setEditLandmarkForm((current) =>
                                  current ? { ...current, icono: iconPath } : current,
                                )
                              }
                              title={iconPath.split("/").pop() ?? iconPath}
                            >
                              <img src={iconPath} alt="" className="h-7 w-7 object-contain" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label htmlFor="edit-landmark-icon-scale" className="text-xs font-medium">
                            Escala icono
                          </label>
                          <Input
                            id="edit-landmark-icon-scale"
                            type="number"
                            min={0.6}
                            max={2.4}
                            step={0.1}
                            value={editLandmarkForm.escalaIcono}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value)
                              setEditLandmarkForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      escalaIcono: Number.isFinite(nextValue) ? nextValue : 1,
                                    }
                                  : current,
                              )
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="edit-landmark-text-scale" className="text-xs font-medium">
                            Escala texto
                          </label>
                          <Input
                            id="edit-landmark-text-scale"
                            type="number"
                            min={0.6}
                            max={2.4}
                            step={0.1}
                            value={editLandmarkForm.escalaTexto}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value)
                              setEditLandmarkForm((current) =>
                                current
                                  ? {
                                      ...current,
                                      escalaTexto: Number.isFinite(nextValue) ? nextValue : 1,
                                    }
                                  : current,
                              )
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={editLandmarkForm.mostrarLeyenda}
                          onChange={(event) =>
                            setEditLandmarkForm((current) =>
                              current
                                ? { ...current, mostrarLeyenda: event.target.checked }
                                : current,
                            )
                          }
                        />
                        Mostrar leyenda
                      </label>

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={closeLandmarkPopover}>
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm">Guardar</Button>
                      </div>
                    </form>
                  ) : null}
                </PopoverContent>
              </>
            )}
          </Popover>
        </div>
      </section>

      <Popover
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateDialog()
            return
          }
          setIsCreateDialogOpen(true)
        }}
      >
        <PopoverAnchor asChild>
          <span
            aria-hidden
            className={styles.createPopoverAnchor}
            style={{
              left: `${createDialogAnchor.x}px`,
              top: `${createDialogAnchor.y}px`,
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          className="parchment w-[19rem] p-3"
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <form className="space-y-2.5" onSubmit={handleCreateLandmark}>
            <div>
              <h3 className="font-serif text-sm text-primary">Nuevo Landmark</h3>
              <p className="text-[11px] text-muted-foreground">
                Clic derecho: crea en esa posición.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="new-landmark-name" className="text-xs font-medium">
                Nombre
              </label>
              <Input
                id="new-landmark-name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Nombre del landmark"
                autoFocus
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="new-landmark-type" className="text-xs font-medium">
                Tipo
              </label>
              <Select value={createType} onValueChange={handleCreateTypeChange}>
                <SelectTrigger id="new-landmark-type" className="h-8 w-full text-xs">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {LANDMARK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LANDMARK_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">
                Icono
              </label>
              <div className="grid max-h-24 grid-cols-6 gap-1 overflow-auto rounded-md border border-border/70 bg-background/60 p-1">
                <button
                  type="button"
                  className={`flex h-9 w-9 items-center justify-center rounded-sm border text-base ${
                    createIcon === createFallbackIcon
                      ? "border-primary bg-primary/10"
                      : "border-border/70 bg-background/80 hover:bg-accent/70"
                  }`}
                  onClick={() => setCreateIcon(createFallbackIcon)}
                  title="Icono fallback"
                >
                  <span>{createFallbackIcon}</span>
                </button>
                {createTypeImages.map((iconPath) => (
                  <button
                    key={iconPath}
                    type="button"
                    className={`flex h-9 w-9 items-center justify-center rounded-sm border ${
                      createIcon === iconPath
                        ? "border-primary bg-primary/10"
                        : "border-border/70 bg-background/80 hover:bg-accent/70"
                    }`}
                    onClick={() => setCreateIcon(iconPath)}
                    title={iconPath.split("/").pop() ?? iconPath}
                  >
                    <img src={iconPath} alt="" className="h-7 w-7 object-contain" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="new-landmark-icon-scale" className="text-xs font-medium">
                  Escala icono
                </label>
                <Input
                  id="new-landmark-icon-scale"
                  type="number"
                  min={0.6}
                  max={2.4}
                  step={0.1}
                  value={createIconScale}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    setCreateIconScale(Number.isFinite(nextValue) ? nextValue : 1)
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-landmark-text-scale" className="text-xs font-medium">
                  Escala texto
                </label>
                <Input
                  id="new-landmark-text-scale"
                  type="number"
                  min={0.6}
                  max={2.4}
                  step={0.1}
                  value={createTextScale}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    setCreateTextScale(Number.isFinite(nextValue) ? nextValue : 1)
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={createShowLabel}
                onChange={(event) => setCreateShowLabel(event.target.checked)}
              />
              Mostrar leyenda
            </label>

            {createPosition && (
              <p className="text-[11px] text-muted-foreground">
                Posición: X {(createPosition[0] * 100).toFixed(1)}%, Y {(createPosition[1] * 100).toFixed(1)}%
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeCreateDialog}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">Crear</Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </>
  )
}
