"use client"

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Accessibility, Bubbles, ChevronDown, Circle, EarOff, Eye, EyeOff, HatGlasses, Heart, Link2, Lock, Redo, Shell, Skull, Snowflake, Trash2, TriangleAlert, type LucideIcon } from "lucide-react"

import type { BattleConditionDefinition } from "@/lib/battle/conditions"
import type { BattleTokenFogVisibility } from "@/lib/battle/fog"
import { resolveBattleTokenImagePresentation, type BattleTokenImageCrop } from "@/lib/battle/token-image"
import type { BattleObstacle, BattleToken, Character } from "@/lib/types"

type TokenPosition = {
  x: number
  y: number
}

type ObstacleSize = {
  width: number
  height: number
}

export type BattlePropPlacementDefinition = {
  name: string
  image: string
  imageAssetId?: number | null
}

type TransformMetrics = {
  rotationDegrees: number
  scale: number
  bounds: DOMRect
  localWidth: number
  localHeight: number
}

type DragState =
  | {
      kind: "token"
      pointerId: number
      pointerTarget: HTMLElement
      tokenNumber: number
      initialPosition: TokenPosition
      lastPosition: TokenPosition
      pointerOffset: TokenPosition
      metrics: TransformMetrics
    }
  | {
      kind: "obstacle"
      pointerId: number
      pointerTarget: HTMLElement
      obstacleId: number
      obstacle: BattleObstacle
      lastPosition: TokenPosition
      pointerOffset: TokenPosition
      metrics: TransformMetrics
    }
  | {
      kind: "obstacle-resize"
      pointerId: number
      pointerTarget: HTMLElement
      obstacleId: number
      obstacle: BattleObstacle
      lastPosition: TokenPosition
      lastSize: ObstacleSize
      resizeHandle: "center" | "nw" | "ne" | "sw" | "se"
      metrics: TransformMetrics
    }

type BattleTokenOverlayProps = {
  tokens: BattleToken[]
  tokenFogVisibilityByNumber?: Map<number, BattleTokenFogVisibility> | Record<number, BattleTokenFogVisibility>
  statusDefinitions?: BattleConditionDefinition[]
  obstacles?: BattleObstacle[]
  characterById?: Map<number, Character>
  currentTurnTokenNumber?: number | null
  verticalMirror?: boolean
  interactive?: boolean
  enableTokenInspector?: boolean
  suppressInspectorOnTokenClick?: boolean
  tokenInspectorEditable?: boolean
  hideHiddenTokens?: boolean
  ghostHiddenTokens?: boolean
  hideHiddenObstacles?: boolean
  showTokenLifeBadge?: boolean
  selectedTokenNumber?: number | null
  selectedObstacleId?: number | null
  pendingPropPlacement?: BattlePropPlacementDefinition | null
  onSelectToken?: (tokenNumber: number) => void
  onTokenClick?: (tokenNumber: number) => void
  onUpdateTokenDetails?: (
    tokenNumber: number,
    nextValues: {
      nombre?: string
      initiative?: number | undefined
      life?: number | undefined
      size?: number
      status?: string
      statusDurationTurns?: number | undefined
      hidden?: boolean
      type?: BattleToken["type"]
    },
  ) => void
  onRequestToggleTokenType?: (tokenNumber: number) => void
  onRequestTokenDuplicate?: (tokenNumber: number) => void
  onRequestTokenQuickDelete?: (tokenNumber: number) => void
  onRequestTokenDelete?: (tokenNumber: number) => void
  onRequestTokenCropEdit?: (tokenNumber: number) => void
  onRequestTokenDetail?: (tokenNumber: number) => void
  isTokenDetailAvailable?: (token: BattleToken) => boolean
  onPreviewTokenMove?: (tokenNumber: number, nextPosition: TokenPosition | null) => void
  onPreviewObstacleMove?: (obstacleId: number, nextPosition: TokenPosition | null) => void
  onMoveToken?: (tokenNumber: number, nextPosition: TokenPosition) => void
  onResizeToken?: (tokenNumber: number, nextSize: number) => void
  onSelectObstacle?: (obstacleId: number) => void
  onMoveObstacle?: (obstacleId: number, nextPosition: TokenPosition) => void
  onResizeObstacle?: (obstacleId: number, nextSize: { width?: number; height?: number; rotation?: number }) => void
  onRemoveObstacle?: (obstacleId: number) => void
  onPlaceProp?: (position: TokenPosition, keepSelected: boolean) => void
  onToggleObstacleHidden?: (obstacleId: number) => void
  neutralPalette?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampTokenSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.round(value * 100) / 100
}

const CLICK_OPEN_DRAG_THRESHOLD_PERCENT = 0.2
const SUPPRESS_CLICK_AFTER_DRAG_MS = 350
const TOKEN_DECORATION_CANVAS_INSET_PERCENT = 24
const CONDITION_ICON_BY_NAME: Record<string, LucideIcon> = {
  cegado: EyeOff,
  encantado: Heart,
  ensordecido: EarOff,
  agotamiento: ChevronDown,
  asustado: TriangleAlert,
  agarrado: Link2,
  incapacitado: Accessibility,
  invisible: HatGlasses,
  paralizado: Accessibility,
  petrificado: Snowflake,
  envenenado: Bubbles,
  derribado: Redo,
  restringido: Lock,
  aturdido: Shell,
  inconsciente: Skull
}

function getConditionIcon(rawConditionName: string): LucideIcon {
  const normalizedName = rawConditionName.trim().toLocaleLowerCase("es")
  return CONDITION_ICON_BY_NAME[normalizedName] ?? Circle
}

function parseNumberInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDecimalInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const parsed = Number.parseFloat(trimmed.replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined
}

function parseInitiativeInput(value: string) {
  return parseDecimalInput(value)
}

function normalizeRotationDegrees(value: number) {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function extractRotationDegrees(transformValue: string) {
  if (!transformValue || transformValue === "none") {
    return 0
  }

  const matrixMatch = transformValue.match(/^matrix\((.+)\)$/)
  if (!matrixMatch) {
    return 0
  }

  const values = matrixMatch[1]
    .split(",")
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part))

  if (values.length < 4) {
    return 0
  }

  return normalizeRotationDegrees(Math.atan2(values[1] ?? 0, values[0] ?? 1) * (180 / Math.PI))
}

function findTransformSource(element: HTMLElement | null) {
  let current = element

  while (current) {
    const transformValue = window.getComputedStyle(current).transform
    if (transformValue && transformValue !== "none") {
      return current
    }
    current = current.parentElement
  }

  return null
}

function buildTransformMetrics(overlayElement: HTMLDivElement): TransformMetrics | null {
  const bounds = overlayElement.getBoundingClientRect()
  const localWidth = overlayElement.offsetWidth
  const localHeight = overlayElement.offsetHeight

  if (bounds.width <= 0 || bounds.height <= 0 || localWidth <= 0 || localHeight <= 0) {
    return null
  }

  const transformSource = findTransformSource(overlayElement)
  const rotationDegrees = extractRotationDegrees(
    transformSource ? window.getComputedStyle(transformSource).transform : "",
  )
  const normalizedRotation = normalizeRotationDegrees(rotationDegrees)
  const isQuarterTurn = normalizedRotation % 180 !== 0
  const rotatedLocalWidth = isQuarterTurn ? localHeight : localWidth
  const rotatedLocalHeight = isQuarterTurn ? localWidth : localHeight
  const scaleX = bounds.width / rotatedLocalWidth
  const scaleY = bounds.height / rotatedLocalHeight
  const scale = Math.max(0.0001, (scaleX + scaleY) / 2)

  return {
    rotationDegrees: normalizedRotation,
    scale,
    bounds,
    localWidth,
    localHeight,
  }
}

function screenPointToLocalPosition(
  clientX: number,
  clientY: number,
  metrics: TransformMetrics,
): TokenPosition {
  const centerX = metrics.bounds.left + metrics.bounds.width / 2
  const centerY = metrics.bounds.top + metrics.bounds.height / 2

  const screenDeltaX = (clientX - centerX) / metrics.scale
  const screenDeltaY = (clientY - centerY) / metrics.scale
  const radians = (-metrics.rotationDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  const localDeltaX = screenDeltaX * cos - screenDeltaY * sin
  const localDeltaY = screenDeltaX * sin + screenDeltaY * cos

  return {
    x: clamp(((localDeltaX + metrics.localWidth / 2) / metrics.localWidth) * 100, 0, 100),
    y: clamp(((localDeltaY + metrics.localHeight / 2) / metrics.localHeight) * 100, 0, 100),
  }
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.trim().toLowerCase()
  const match = normalized.match(/^#([0-9a-f]{6})$/)
  if (!match) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  const raw = match[1]
  const red = Number.parseInt(raw.slice(0, 2), 16)
  const green = Number.parseInt(raw.slice(2, 4), 16)
  const blue = Number.parseInt(raw.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getCanvasResolution(canvas: HTMLCanvasElement) {
  const cssWidth = canvas.offsetWidth || 1
  const cssHeight = canvas.offsetHeight || 1
  const rect = canvas.getBoundingClientRect()
  const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const scale = Math.max(rect.width / cssWidth, rect.height / cssHeight) * pixelRatio

  return {
    cssWidth,
    cssHeight,
    nextWidth: Math.max(1, Math.ceil(cssWidth * scale)),
    nextHeight: Math.max(1, Math.ceil(cssHeight * scale)),
    scale,
  }
}

function readGridMetrics(overlayElement: HTMLDivElement) {
  const styles = window.getComputedStyle(overlayElement)
  const cellSize = Number.parseFloat(styles.getPropertyValue("--battle-grid-cell-size"))
  const offsetX = Number.parseFloat(styles.getPropertyValue("--battle-grid-offset-x"))
  const offsetY = Number.parseFloat(styles.getPropertyValue("--battle-grid-offset-y"))

  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return null
  }

  return {
    cellSize,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0,
  }
}

function snapPositionToGrid(
  position: TokenPosition,
  metrics: TransformMetrics,
  overlayElement: HTMLDivElement,
  alignment: "center" | "edge" = "center",
): TokenPosition {
  const grid = readGridMetrics(overlayElement)
  if (!grid) {
    return position
  }

  const snapAxis = (percentValue: number, total: number, offset: number) => {
    const pixelValue = (percentValue / 100) * total
    const alignmentOffset = alignment === "center" ? grid.cellSize / 2 : 0
    const snappedPixel =
      offset + alignmentOffset + Math.round((pixelValue - offset - alignmentOffset) / grid.cellSize) * grid.cellSize

    return clamp((snappedPixel / total) * 100, 0, 100)
  }

  return {
    x: snapAxis(position.x, metrics.localWidth, grid.offsetX),
    y: snapAxis(position.y, metrics.localHeight, grid.offsetY),
  }
}

function snapObstaclePositionToGridEdges(
  position: TokenPosition,
  obstacle: BattleObstacle,
  metrics: TransformMetrics,
  overlayElement: HTMLDivElement,
): TokenPosition {
  const obstacleHeight = obstacle.shape === "circle" ? obstacle.width : obstacle.height
  const topLeft = {
    x: clamp(position.x - obstacle.width / 2, 0, 100),
    y: clamp(position.y - obstacleHeight / 2, 0, 100),
  }
  const snappedTopLeft = snapPositionToGrid(topLeft, metrics, overlayElement, "edge")

  return {
    x: clamp(snappedTopLeft.x + obstacle.width / 2, 0, 100),
    y: clamp(snappedTopLeft.y + obstacleHeight / 2, 0, 100),
  }
}

function releaseDragPointerCapture(dragState: DragState | null) {
  if (!dragState) {
    return
  }

  if (dragState.pointerTarget.hasPointerCapture(dragState.pointerId)) {
    dragState.pointerTarget.releasePointerCapture(dragState.pointerId)
  }
}

function transformOverlayPosition(position: TokenPosition, verticalMirror: boolean): TokenPosition {
  return verticalMirror
    ? {
        x: 100 - position.x,
        y: 100 - position.y,
      }
    : position
}

function updatePreviewMap<T>(
  current: Record<number, T>,
  id: number,
  nextValue: T | null,
) {
  const next = { ...current }

  if (nextValue) {
    next[id] = nextValue
  } else {
    delete next[id]
  }

  return next
}

function resolveTokenStatusDefinition(
  rawStatus: string,
  statusDefinitionByName: Map<string, BattleConditionDefinition>,
) {
  const normalizedStatus = rawStatus.trim().toLocaleLowerCase("es")
  if (!normalizedStatus) {
    return null
  }

  return statusDefinitionByName.get(normalizedStatus) ?? null
}

function resolveTokenFogVisibility(
  source: BattleTokenOverlayProps["tokenFogVisibilityByNumber"],
  tokenNumber: number,
): BattleTokenFogVisibility {
  if (!source) return "visible"
  if (source instanceof Map) return source.get(tokenNumber) ?? "visible"
  return source[tokenNumber] ?? "visible"
}

function drawTokenImageToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: BattleTokenImageCrop,
  isDefeated: boolean,
) {
  const { cssWidth, cssHeight, nextWidth, nextHeight } = getCanvasResolution(canvas)

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, nextWidth, nextHeight)
  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.filter = isDefeated ? "grayscale(1) brightness(0.75) saturate(0)" : "none"

  const imageWidth = image.naturalWidth || image.width
  const imageHeight = image.naturalHeight || image.height
  const coverScale = Math.max(nextWidth / imageWidth, nextHeight / imageHeight)
  const drawnWidth = imageWidth * coverScale
  const drawnHeight = imageHeight * coverScale
  const focusX = crop.focusX / 100
  const focusY = crop.focusY / 100
  const originX = nextWidth * focusX
  const originY = nextHeight * focusY
  const drawX = (nextWidth - drawnWidth) * focusX
  const drawY = (nextHeight - drawnHeight) * focusY

  context.translate(originX, originY)
  context.scale(crop.zoom, crop.zoom)
  context.translate(-originX, -originY)
  context.drawImage(image, drawX, drawY, drawnWidth, drawnHeight)
  context.restore()
}

function TokenImageCanvas({
  alt,
  crop,
  isDefeated,
  src,
}: {
  alt: string
  crop: BattleTokenImageCrop
  isDefeated: boolean
  src: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let animationFrame = 0
    let lastWidth = 0
    let lastHeight = 0
    let loopStarted = false
    const image = new Image()

    const drawIfNeeded = (force = false) => {
      if (cancelled || !image.complete || image.naturalWidth <= 0) return

      const { nextWidth, nextHeight } = getCanvasResolution(canvas)

      if (!force && nextWidth === lastWidth && nextHeight === lastHeight) return
      lastWidth = nextWidth
      lastHeight = nextHeight
      drawTokenImageToCanvas(canvas, image, crop, isDefeated)
    }

    const tick = () => {
      drawIfNeeded()
      animationFrame = window.requestAnimationFrame(tick)
    }

    const startDrawing = () => {
      if (loopStarted) return
      loopStarted = true
      drawIfNeeded(true)
      animationFrame = window.requestAnimationFrame(tick)
    }

    image.onload = startDrawing
    image.src = src
    if (image.complete && image.naturalWidth > 0) {
      startDrawing()
    }

    return () => {
      cancelled = true
      image.onload = null
      window.cancelAnimationFrame(animationFrame)
    }
  }, [crop.focusX, crop.focusY, crop.zoom, isDefeated, src])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label={alt} role="img" />
}

function drawTokenDecorationCanvas(
  canvas: HTMLCanvasElement,
  options: {
    isCurrentTurn: boolean
    statusColor: string | null
  },
) {
  const { nextWidth, nextHeight } = getCanvasResolution(canvas)
  const pixelRatio = window.devicePixelRatio || 1

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, nextWidth, nextHeight)
  const centerX = nextWidth / 2
  const centerY = nextHeight / 2
  const canvasScale = 1 + (TOKEN_DECORATION_CANVAS_INSET_PERCENT * 2) / 100
  const tokenRadius = Math.min(nextWidth, nextHeight) / (2 * canvasScale)

  const strokeCircle = (radius: number, color: string, width: number, shadowColor: string, shadowBlur: number) => {
    const lineWidth = Math.max(1, width * pixelRatio)

    context.save()
    context.beginPath()
    context.arc(centerX, centerY, radius, 0, Math.PI * 2)
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.shadowColor = shadowColor
    context.shadowBlur = shadowBlur * pixelRatio
    context.stroke()
    context.restore()
  }

  if (options.isCurrentTurn) {
    strokeCircle(tokenRadius + 7 * pixelRatio, "rgba(74, 222, 128, 0.9)", 6, "rgba(16, 185, 129, 0.62)", 22)
  }

  if (options.statusColor) {
    strokeCircle(tokenRadius + 3 * pixelRatio, options.statusColor, 3, withAlpha(options.statusColor, 0.68), 12)
  }
}

function TokenDecorationCanvas({
  isCurrentTurn,
  statusColor,
}: {
  isCurrentTurn: boolean
  statusColor: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationFrame = 0
    let lastWidth = 0
    let lastHeight = 0

    const drawIfNeeded = (force = false) => {
      const { nextWidth, nextHeight } = getCanvasResolution(canvas)

      if (!force && nextWidth === lastWidth && nextHeight === lastHeight) return
      lastWidth = nextWidth
      lastHeight = nextHeight
      drawTokenDecorationCanvas(canvas, { isCurrentTurn, statusColor })
    }

    const tick = () => {
      drawIfNeeded()
      animationFrame = window.requestAnimationFrame(tick)
    }

    drawIfNeeded(true)
    animationFrame = window.requestAnimationFrame(tick)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [isCurrentTurn, statusColor])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute"
      style={{
        left: `-${TOKEN_DECORATION_CANVAS_INSET_PERCENT}%`,
        top: `-${TOKEN_DECORATION_CANVAS_INSET_PERCENT}%`,
        width: `${100 + TOKEN_DECORATION_CANVAS_INSET_PERCENT * 2}%`,
        height: `${100 + TOKEN_DECORATION_CANVAS_INSET_PERCENT * 2}%`,
      }}
      aria-hidden="true"
    />
  )
}

function parseStatusDurationTurnsInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function getTokenVisualMirrorTransform(verticalMirror: boolean) {
  return verticalMirror ? " scale(-1)" : ""
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  )
}

function drawBattleObstacleCanvas(
  canvas: HTMLCanvasElement,
  obstacle: BattleObstacle,
  isSelected: boolean,
  image: HTMLImageElement | null = null,
) {
  const { cssWidth, cssHeight, nextWidth, nextHeight, scale } = getCanvasResolution(canvas)

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  const context = canvas.getContext("2d")
  if (!context) return

  context.clearRect(0, 0, nextWidth, nextHeight)
  context.save()
  context.scale(scale, scale)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"

  const strokeWidth = 2
  const inset = strokeWidth / 2 + 1
  const width = Math.max(1, cssWidth - inset * 2)
  const height = Math.max(1, cssHeight - inset * 2)

  context.shadowBlur = isSelected ? 14 : 8
  context.shadowColor = isSelected ? withAlpha("#fcd34d", 0.7) : withAlpha(obstacle.color, 0.24)
  context.fillStyle = withAlpha(obstacle.color, 0.32)
  context.strokeStyle = obstacle.color
  context.lineWidth = strokeWidth

  const drawObstacleImage = () => {
    if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return false
    }

    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
    const drawnWidth = image.naturalWidth * scale
    const drawnHeight = image.naturalHeight * scale
    const drawX = inset + (width - drawnWidth) / 2
    const drawY = inset + (height - drawnHeight) / 2

    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, drawX, drawY, drawnWidth, drawnHeight)
    return true
  }

  if (obstacle.shape === "circle") {
    const radius = Math.max(1, Math.min(width, height) / 2)
    context.beginPath()
    context.arc(cssWidth / 2, cssHeight / 2, radius, 0, Math.PI * 2)
    context.save()
    context.clip()
    const hasImage = drawObstacleImage()
    if (!hasImage) {
      context.fill()
    }
    context.restore()
    if (!hasImage) {
      context.stroke()
    }

    if (isSelected) {
      context.shadowBlur = 0
      context.strokeStyle = withAlpha("#fcd34d", 0.72)
      context.lineWidth = 4
      context.beginPath()
      context.arc(cssWidth / 2, cssHeight / 2, Math.max(1, radius - 3), 0, Math.PI * 2)
      context.stroke()
    }
  } else {
    context.beginPath()
    context.rect(inset, inset, width, height)
    context.save()
    context.clip()
    const hasImage = drawObstacleImage()
    if (!hasImage) {
      context.fill()
    }
    context.restore()
    if (!hasImage) {
      context.stroke()
    }

    if (isSelected) {
      context.shadowBlur = 0
      context.strokeStyle = withAlpha("#fcd34d", 0.72)
      context.lineWidth = 4
      context.strokeRect(inset + 2, inset + 2, Math.max(1, width - 4), Math.max(1, height - 4))
    }
  }

  context.restore()
}

function BattleObstacleCanvas({
  obstacle,
  isSelected,
  image,
}: {
  obstacle: BattleObstacle
  isSelected: boolean
  image: HTMLImageElement | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationFrameId: number | null = null
    let lastWidth = 0
    let lastHeight = 0

    const draw = () => {
      const { nextWidth, nextHeight } = getCanvasResolution(canvas)
      if (nextWidth !== lastWidth || nextHeight !== lastHeight) {
        lastWidth = nextWidth
        lastHeight = nextHeight
        drawBattleObstacleCanvas(canvas, obstacle, isSelected, image)
      }

      animationFrameId = window.requestAnimationFrame(draw)
    }

    const { nextWidth, nextHeight } = getCanvasResolution(canvas)
    lastWidth = nextWidth
    lastHeight = nextHeight
    drawBattleObstacleCanvas(canvas, obstacle, isSelected, image)
    animationFrameId = window.requestAnimationFrame(draw)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [image, isSelected, obstacle])

  return <canvas ref={canvasRef} className="pointer-events-none block size-full" aria-hidden="true" />
}

type BattleObstacleItemProps = {
  obstacle: BattleObstacle
  renderedPosition: TokenPosition
  isSelected: boolean
  interactive: boolean
  onRemoveObstacle?: (obstacleId: number) => void
  onResizeObstacle?: (obstacleId: number, nextSize: { width?: number; height?: number; rotation?: number }) => void
  onSelectObstacle?: (obstacleId: number) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onResizePointerDown: (handle: "center" | "nw" | "ne" | "sw" | "se") => (event: ReactPointerEvent<HTMLElement>) => void
}

function BattleObstacleItem({
  obstacle,
  renderedPosition,
  isSelected,
  interactive,
  onRemoveObstacle,
  onResizeObstacle,
  onSelectObstacle,
  onPointerDown,
  onResizePointerDown,
}: BattleObstacleItemProps) {
  const isCircle = obstacle.shape === "circle"
  const obstacleWidth = obstacle.width

  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!obstacle.image) {
      setImage(null)
      return
    }

    let cancelled = false
    const nextImage = new Image()
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage)
      }
    }
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(null)
      }
    }
    nextImage.src = obstacle.image

    return () => {
      cancelled = true
    }
  }, [obstacle.image])

  const hasLoadedImage = obstacle.image && image && image.naturalWidth > 0 && image.naturalHeight > 0
  const obstacleHeight = hasLoadedImage ? "auto" : (isCircle ? undefined : `${obstacle.height}%`)
  const aspectRatio = hasLoadedImage
    ? `${image.naturalWidth} / ${image.naturalHeight}`
    : isCircle
      ? "1 / 1"
      : undefined

  return (
    <button
      type="button"
      className="pointer-events-auto absolute bg-transparent p-0"
      data-battle-wheel-stop="true"
      title={obstacle.name || `Obstáculo ${obstacle.id}`}
      style={{
        left: `${renderedPosition.x}%`,
        top: `${renderedPosition.y}%`,
        width: `${obstacleWidth}%`,
        height: obstacleHeight,
        aspectRatio: aspectRatio,
        transform: `translate(-50%, -50%) rotate(${(obstacle as any).rotation ?? 0}deg)`,
        zIndex: obstacle.image ? (isSelected ? 20 : 10) : (isSelected ? 2 : 1),
        touchAction: "none",
        opacity: obstacle.hidden ? 0.45 : 1,
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (event.shiftKey) {
          onSelectObstacle?.(obstacle.id)
        }
      }}
      onDoubleClick={(event) => {
        if (!interactive || !onRemoveObstacle || !event.shiftKey) {
          return
        }

        if (event.target !== event.currentTarget) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        onRemoveObstacle(obstacle.id)
      }}
      onContextMenu={(event) => {
        if (!interactive || !onRemoveObstacle || !event.shiftKey) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        onRemoveObstacle(obstacle.id)
      }}
      onPointerDown={onPointerDown}
      onWheel={(event) => {
        if (!interactive || !onResizeObstacle) {
          return
        }

        if (!event.shiftKey) {
          return
        }

        event.stopPropagation()

        const scaleDelta = event.deltaY < 0 ? 1.05 : 0.95
        const nextWidth = clamp(obstacle.width * scaleDelta, 0.5, 100)
        const nextHeight = clamp(obstacle.height * scaleDelta, 0.5, 100)

        onResizeObstacle(obstacle.id, {
          width: Math.round(nextWidth * 100) / 100,
          height: (obstacle.shape === "circle" || obstacle.image) ? Math.round(nextWidth * 100) / 100 : Math.round(nextHeight * 100) / 100,
        })
      }}
    >
      <BattleObstacleCanvas obstacle={obstacle} isSelected={isSelected} image={image} />
      {obstacle.hidden ? (
        <span className="pointer-events-none absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-stone-950/75 text-white shadow">
          <EyeOff className="size-3" />
        </span>
      ) : null}
      {interactive && onResizeObstacle && isSelected
        ? (isCircle || obstacle.image) ? (
            <span
              className="pointer-events-auto absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
              onPointerDown={onResizePointerDown("center")}
              onWheel={(event) => {
                if (!interactive || !onResizeObstacle) {
                  return
                }

                if (!event.shiftKey) {
                  return
                }

                event.stopPropagation()

                const scaleDelta = event.deltaY < 0 ? 1.05 : 0.95
                const nextSize = clamp(obstacle.width * scaleDelta, 0.5, 100)
                const roundedSize = Math.round(nextSize * 100) / 100
                onResizeObstacle(obstacle.id, { width: roundedSize, height: roundedSize })
              }}
            />
          ) : (
            <>
              <span
                className="pointer-events-auto absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                onPointerDown={onResizePointerDown("nw")}
              />
              <span
                className="pointer-events-auto absolute right-0 top-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                onPointerDown={onResizePointerDown("ne")}
              />
              <span
                className="pointer-events-auto absolute left-0 bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                onPointerDown={onResizePointerDown("sw")}
              />
              <span
                className="pointer-events-auto absolute right-0 bottom-0 size-2.5 translate-x-1/2 translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                onPointerDown={onResizePointerDown("se")}
              />
            </>
          )
        : null}
    </button>
  )
}

type SelectedObstacleToolbarProps = {
  obstacle: BattleObstacle
  renderedPosition: TokenPosition
  onRemoveObstacle?: (obstacleId: number) => void
}

function SelectedObstacleToolbar({ obstacle, renderedPosition, onRemoveObstacle }: SelectedObstacleToolbarProps) {
  return (
    <div
      className="pointer-events-auto absolute z-[30] flex items-center gap-1 rounded-full border border-stone-900/15 bg-white/95 px-1.5 py-1 shadow-xl backdrop-blur"
      style={{
        left: `${clamp(renderedPosition.x, 10, 90)}%`,
        top: `${clamp(renderedPosition.y + (renderedPosition.y < 18 ? 10 : -10), 10, 90)}%`,
        transform: "translate(-50%, -50%) rotate(calc(var(--map-rotation-deg, 0deg) * -1))",
        transformOrigin: "center",
      }}
      data-battle-wheel-stop="true"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-full bg-stone-900/5 text-stone-700 transition hover:bg-stone-900/10"
        onClick={() => onRemoveObstacle?.(obstacle.id)}
        aria-label={`Eliminar obstáculo ${obstacle.id}`}
        title="Eliminar obstáculo"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

type BattleTokenItemProps = {
  token: BattleToken
  linkedCharacter: Character | null
  tokenStatusDefinition: BattleConditionDefinition | null
  renderedPosition: TokenPosition
  selectedTokenNumber: number | null
  currentTurnTokenNumber: number | null
  ghostHiddenTokens: boolean
  showTokenLifeBadge: boolean
  verticalMirror: boolean
  neutralPalette: boolean
  pointerEventsEnabled: boolean
  onClick: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void
  onWheel: (event: React.WheelEvent<HTMLButtonElement>) => void
}

function BattleTokenItem({
  token,
  linkedCharacter,
  tokenStatusDefinition,
  renderedPosition,
  selectedTokenNumber,
  currentTurnTokenNumber,
  ghostHiddenTokens,
  showTokenLifeBadge,
  verticalMirror,
  neutralPalette,
  pointerEventsEnabled,
  onClick,
  onPointerDown,
  onMouseEnter,
  onMouseLeave,
  onContextMenu,
  onWheel,
}: BattleTokenItemProps) {
  const isSelected = token.number === selectedTokenNumber
  const isEnemy = token.type === "enemy"
  const isDeadEnemy = isEnemy && (token.life ?? 1) <= 0
  const isDefeated = typeof token.life === "number" && token.life <= 0
  const isHidden = Boolean(token.hidden)
  const isCurrentTurn = !neutralPalette && !isHidden && currentTurnTokenNumber !== null && token.number === currentTurnTokenNumber
  const isGhosted = isHidden && ghostHiddenTokens
  const tokenImagePresentation = resolveBattleTokenImagePresentation({
    token,
    linkedCharacter,
    kind: "token",
  })
  const tokenImage = tokenImagePresentation.image
  const shouldShowTokenNumberBadge = !neutralPalette && (token.sourceType === "monster" || Boolean(tokenImage))
  const shouldShowLifeBadge = showTokenLifeBadge && typeof token.life === "number" && Number.isFinite(token.life)
  const tokenImageCrop = tokenImagePresentation.crop
  const renderedSize = clampTokenSize(token.size)
  const tokenDiameter = Math.round(44 * renderedSize)
  const tokenDiameterCss = `calc(${tokenDiameter}px * var(--map-image-scale, 1))`

  return (
    <button
      type="button"
      className={`${pointerEventsEnabled ? "pointer-events-auto" : "pointer-events-none"} absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent p-0 text-left ${isGhosted ? "opacity-25" : ""}`}
      data-battle-wheel-stop="true"
      style={{
        left: `${renderedPosition.x}%`,
        top: `${renderedPosition.y}%`,
        width: tokenDiameterCss,
        height: tokenDiameterCss,
        zIndex: isSelected ? 4 : 3,
        touchAction: "none",
      }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      <div
        className="relative flex size-full items-center justify-center"
        style={{
          transform: `rotate(calc(var(--map-rotation-deg, 0deg) * -1))${getTokenVisualMirrorTransform(verticalMirror)}`,
          transformOrigin: "center",
        }}
      >
        {isCurrentTurn || tokenStatusDefinition ? (
          <TokenDecorationCanvas
            isCurrentTurn={isCurrentTurn}
            statusColor={tokenStatusDefinition?.color ?? null}
          />
        ) : null}
        {tokenStatusDefinition ? (
          (() => {
            const TokenStatusIcon = getConditionIcon(tokenStatusDefinition.name)
            return (
              <span
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
                title={
                  tokenStatusDefinition.entriesText
                    ? `${tokenStatusDefinition.name}\n${tokenStatusDefinition.entriesText}`
                    : tokenStatusDefinition.name
                }
              >
                <TokenStatusIcon
                  className="size-[0.9rem]"
                  style={{ color: tokenStatusDefinition.color }}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </span>
            )
          })()
        ) : null}
        {isHidden ? (
          <>
            <span
              className="pointer-events-none absolute rounded-full"
              style={{
                inset: "-10%",
                boxShadow: "0 0 0 2px rgba(34, 211, 238, 0.9), 0 0 18px rgba(34, 211, 238, 0.45)",
              }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute top-[-0.35rem] right-[-0.35rem] z-30 inline-flex size-5 items-center justify-center rounded-full border border-cyan-100/80 bg-cyan-500 text-cyan-950 shadow-[0_0_10px_rgba(34,211,238,0.45)]"
              aria-hidden="true"
            >
              <EyeOff className="size-3.5" />
            </span>
          </>
        ) : null}
        <span
          className={`relative flex size-full items-center justify-center overflow-hidden rounded-full text-sm font-bold ${
            neutralPalette
              ? tokenImage
                ? ""
                : "bg-stone-500 text-stone-50 shadow-lg"
              : isDeadEnemy
                ? "border-2 border-black/80 bg-black text-stone-100 shadow-lg"
                : isEnemy
                  ? "border-2 border-red-900/70 bg-red-700 text-red-50 shadow-lg"
                  : "border-2 border-sky-900/70 bg-sky-700 text-sky-50 shadow-lg"
          }`}
        >
          {tokenImage ? (
            <>
              <TokenImageCanvas
                src={tokenImage}
                alt={linkedCharacter?.nombre ?? token.nombre}
                crop={tokenImageCrop ?? { focusX: 50, focusY: 50, zoom: 1 }}
                isDefeated={isDefeated}
              />
              <span className={`absolute inset-0 ${isDefeated ? "bg-stone-900/30" : "bg-black/10"}`} aria-hidden="true" />
            </>
          ) : (
            token.sourceType === "monster" ? "X" : token.number
          )}
        </span>
        {shouldShowTokenNumberBadge ? (
          <span
            className="pointer-events-none absolute bottom-[-0.42rem] left-1/2 z-20 inline-flex min-w-4 items-center justify-center rounded-full border border-black/70 bg-black/75 px-1 text-[0.62rem] font-bold leading-none text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
            style={{
              transform: "translateX(-50%) scale(clamp(0.62, calc(1 / var(--map-canvas-scale, 1)), 1))",
              transformOrigin: "center top",
            }}
          >
            {token.number}
          </span>
        ) : null}
        {shouldShowLifeBadge ? (
          <span
            className="pointer-events-none absolute right-[-0.45rem] top-[-0.45rem] z-30 inline-flex min-w-5 items-center justify-center rounded-full border border-red-950/75 bg-red-600 px-1 text-[0.62rem] font-bold leading-none text-white shadow-[0_1px_5px_rgba(0,0,0,0.5)]"
            style={{
              transform: "scale(clamp(0.62, calc(1 / var(--map-canvas-scale, 1)), 1))",
              transformOrigin: "center",
            }}
            title="Vida"
          >
            {token.life}
          </span>
        ) : null}
      </div>
    </button>
  )
}

type BattleTokenInspectorProps = {
  inspectedToken: BattleToken
  inspectedTokenStatusDefinition: BattleConditionDefinition | null
  inspectorPlacement: {
    left: string
    top: string
    transform: string
    transformOrigin: string
  } | null
  statusDefinitions: BattleConditionDefinition[]
  tokenInspectorEditable: boolean
  isTokenDetailAvailable?: (token: BattleToken) => boolean
  onOpenInspector: (tokenNumber: number) => void
  onCloseInspector: () => void
  onUpdateTokenDetails?: BattleTokenOverlayProps["onUpdateTokenDetails"]
  onRequestTokenDelete?: (tokenNumber: number) => void
  onRequestTokenCropEdit?: (tokenNumber: number) => void
  onRequestTokenDetail?: (tokenNumber: number) => void
}

function BattleTokenInspector({
  inspectedToken,
  inspectedTokenStatusDefinition,
  inspectorPlacement,
  statusDefinitions,
  tokenInspectorEditable,
  isTokenDetailAvailable,
  onOpenInspector,
  onCloseInspector,
  onUpdateTokenDetails,
  onRequestTokenDelete,
  onRequestTokenCropEdit,
  onRequestTokenDetail,
}: BattleTokenInspectorProps) {
  return (
    <div
      className="pointer-events-auto absolute z-[40] w-[min(23rem,calc(100vw-1rem))] max-w-[calc(100%-1rem)] max-h-[min(78dvh,34rem)] overflow-y-auto rounded-2xl border border-stone-200/90 bg-white/96 p-3 text-stone-900 shadow-2xl backdrop-blur relative"
      style={{
        left: inspectorPlacement?.left ?? "50%",
        top: inspectorPlacement?.top ?? "50%",
        transform:
          inspectorPlacement?.transform ??
          "translate(-50%, -50%) rotate(calc(var(--map-rotation-deg, 0deg) * -1)) scale(calc(1 / var(--map-canvas-scale, 1)))",
        transformOrigin: inspectorPlacement?.transformOrigin ?? "center",
      }}
      data-battle-wheel-stop="true"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">#{inspectedToken.number}</p>
          <span className="rounded-md bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">
            {inspectedToken.type === "enemy" ? "Enemigo" : "Jugador"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-xl bg-stone-900/5 text-stone-700 transition hover:bg-stone-900/10"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={() => {
              onOpenInspector(inspectedToken.number)
              onUpdateTokenDetails?.(inspectedToken.number, { hidden: !inspectedToken.hidden })
            }}
            aria-label={`${inspectedToken.hidden ? "Mostrar" : "Ocultar"} ficha ${inspectedToken.number}`}
            title={inspectedToken.hidden ? "Mostrar ficha" : "Ocultar ficha"}
          >
            {inspectedToken.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={() => {
              onCloseInspector()
              onRequestTokenDelete?.(inspectedToken.number)
            }}
            aria-label={`Eliminar ficha ${inspectedToken.number}`}
            title="Eliminar ficha"
          >
            <Trash2 className="size-4" />
          </button>
          {isTokenDetailAvailable?.(inspectedToken) ? (
            <button
              type="button"
              className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                onCloseInspector()
                onRequestTokenDetail?.(inspectedToken.number)
              }}
            >
              Detalle
            </button>
          ) : null}
          {tokenInspectorEditable && onRequestTokenCropEdit ? (
            <button
              type="button"
              className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                onCloseInspector()
                onRequestTokenCropEdit(inspectedToken.number)
              }}
            >
              Encuadre
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={() => {
              onCloseInspector()
            }}
          >
            Cerrar
          </button>
        </div>
      </div>

      {tokenInspectorEditable ? (
        <input
          value={inspectedToken.nombre}
          aria-label={`Nombre de la ficha ${inspectedToken.number}`}
          className="mt-2 block h-8 w-full rounded-xl border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
          placeholder="Nombre"
          disabled={!tokenInspectorEditable}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onFocus={() => {
            onOpenInspector(inspectedToken.number)
          }}
          onChange={(event) => {
            onUpdateTokenDetails?.(inspectedToken.number, { nombre: event.target.value })
          }}
        />
      ) : (
        <p className="mt-2 truncate text-[12px] font-semibold text-stone-900">
          {inspectedToken.nombre || `Ficha ${inspectedToken.number}`}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          inputMode="decimal"
          aria-label={`Iniciativa de la ficha ${inspectedToken.number}`}
          value={typeof inspectedToken.initiative === "number" ? String(inspectedToken.initiative) : ""}
          className="h-8 w-full rounded-xl border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
          placeholder="Ini"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onFocus={(event) => {
            onOpenInspector(inspectedToken.number)
            event.currentTarget.select()
          }}
          onChange={(event) => {
            onUpdateTokenDetails?.(inspectedToken.number, {
              initiative: parseInitiativeInput(event.target.value),
            })
          }}
          disabled={!tokenInspectorEditable}
        />
        <input
          inputMode="numeric"
          aria-label={`Vida de la ficha ${inspectedToken.number}`}
          value={typeof inspectedToken.life === "number" ? String(inspectedToken.life) : ""}
          className={`h-8 w-full rounded-xl px-2.5 text-[12px] font-medium outline-none transition ${
            inspectedToken.type === "enemy"
              ? "border border-red-100 bg-red-50 text-red-700 focus:border-red-300"
              : "border border-sky-100 bg-sky-50 text-sky-700 focus:border-sky-300"
          }`}
          placeholder="Vida"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onFocus={(event) => {
            onOpenInspector(inspectedToken.number)
            event.currentTarget.select()
          }}
          onChange={(event) => {
            onUpdateTokenDetails?.(inspectedToken.number, {
              life: parseNumberInput(event.target.value),
            })
          }}
          disabled={!tokenInspectorEditable}
        />
        <label className="col-span-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">
          Estado
          <select
            aria-label={`Estado de la ficha ${inspectedToken.number}`}
            value={inspectedTokenStatusDefinition?.name ?? ""}
            title={inspectedTokenStatusDefinition?.entriesText || undefined}
            className="mt-1 h-8 w-full rounded-xl border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onFocus={() => {
              onOpenInspector(inspectedToken.number)
            }}
            onChange={(event) => {
              const nextStatus = event.target.value
              onUpdateTokenDetails?.(inspectedToken.number, {
                status: nextStatus,
                statusDurationTurns: nextStatus ? 1 : undefined,
              })
            }}
            disabled={!tokenInspectorEditable}
          >
            <option value="">Sin estado</option>
            {statusDefinitions.map((statusDefinition) => (
              <option key={`status-option-${statusDefinition.name}`} value={statusDefinition.name}>
                {statusDefinition.name}
              </option>
            ))}
          </select>
        </label>
        {inspectedTokenStatusDefinition ? (
          <>
            <label className="col-span-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">
              Duración (turnos, 0 = infinito)
              <input
                inputMode="numeric"
                aria-label={`Duración del estado de la ficha ${inspectedToken.number}`}
                value={typeof inspectedToken.statusDurationTurns === "number" ? String(inspectedToken.statusDurationTurns) : ""}
                className="mt-1 h-8 w-full rounded-xl border border-stone-200 bg-white px-2.5 text-[12px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
                placeholder="1 o 0"
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
                onFocus={() => {
                  onOpenInspector(inspectedToken.number)
                }}
                onChange={(event) => {
                  onUpdateTokenDetails?.(inspectedToken.number, {
                    statusDurationTurns: parseStatusDurationTurnsInput(event.target.value),
                  })
                }}
                disabled={!tokenInspectorEditable}
              />
            </label>
            <p className="col-span-2 text-[11px] text-stone-700">
              <span
                className="inline-flex items-center rounded-full border px-2 py-0.5 font-semibold"
                style={{
                  borderColor: withAlpha(inspectedTokenStatusDefinition.color, 0.62),
                  backgroundColor: withAlpha(inspectedTokenStatusDefinition.color, 0.18),
                }}
                title={inspectedTokenStatusDefinition.entriesText || undefined}
              >
                {inspectedTokenStatusDefinition.name}
                {typeof inspectedToken.statusDurationTurns === "number" && inspectedToken.statusDurationTurns >= 0
                  ? inspectedToken.statusDurationTurns === 0
                    ? " · infinito"
                    : ` · ${inspectedToken.statusDurationTurns} turnos`
                  : ""}
              </span>
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function BattleTokenOverlay({
  tokens,
  tokenFogVisibilityByNumber,
  statusDefinitions = [],
  obstacles = [],
  characterById,
  currentTurnTokenNumber = null,
  verticalMirror = false,
  interactive = false,
  enableTokenInspector = false,
  suppressInspectorOnTokenClick = false,
  tokenInspectorEditable = false,
  hideHiddenTokens = false,
  ghostHiddenTokens = false,
  hideHiddenObstacles = false,
  showTokenLifeBadge = false,
  selectedTokenNumber = null,
  selectedObstacleId = null,
  pendingPropPlacement = null,
  onSelectToken,
  onTokenClick,
  onUpdateTokenDetails,
  onRequestTokenDuplicate,
  onRequestToggleTokenType,
  onRequestTokenQuickDelete,
  onRequestTokenDelete,
  onRequestTokenCropEdit,
  onRequestTokenDetail,
  isTokenDetailAvailable,
  onPreviewTokenMove,
  onPreviewObstacleMove,
  onMoveToken,
  onResizeToken,
  onSelectObstacle,
  onMoveObstacle,
  onResizeObstacle,
  onRemoveObstacle,
  onPlaceProp,
  onToggleObstacleHidden,
  neutralPalette = false,
}: BattleTokenOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const onPreviewTokenMoveRef = useRef(onPreviewTokenMove)
  const onPreviewObstacleMoveRef = useRef(onPreviewObstacleMove)
  const frameRef = useRef<number | null>(null)
  const previewBroadcastFrameRef = useRef<number | null>(null)
  const obstaclePreviewBroadcastFrameRef = useRef<number | null>(null)
  const hoveredTokenNumberRef = useRef<number | null>(null)
  const pendingTokenPreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const pendingObstaclePreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const pendingObstacleSizePreviewRef = useRef<Record<number, ObstacleSize> | null>(null)
  const pendingPreviewBroadcastRef = useRef<{
    tokenNumber: number
    position: TokenPosition | null
  } | null>(null)
  const pendingObstaclePreviewBroadcastRef = useRef<{
    obstacleId: number
    position: TokenPosition | null
  } | null>(null)
  const suppressInspectorClickRef = useRef<{
    tokenNumber: number
    expiresAt: number
  } | null>(null)
  const [tokenPreviewPositions, setTokenPreviewPositions] = useState<Record<number, TokenPosition>>({})
  const [obstaclePreviewPositions, setObstaclePreviewPositions] = useState<Record<number, TokenPosition>>({})
  const [obstaclePreviewSizes, setObstaclePreviewSizes] = useState<Record<number, ObstacleSize>>({})
  const [inspectedTokenNumber, setInspectedTokenNumber] = useState<number | null>(null)

  const tokenByNumber = useMemo(() => {
    return new Map(tokens.map((token) => [token.number, token]))
  }, [tokens])
  const transformPosition = useCallback(
    (position: TokenPosition): TokenPosition => transformOverlayPosition(position, verticalMirror),
    [verticalMirror],
  )
  const statusDefinitionByName = useMemo(
    () =>
      new Map(
        statusDefinitions.map((condition) => [condition.name.trim().toLocaleLowerCase("es"), condition] as const),
      ),
    [statusDefinitions],
  )

  const orderedTokens = useMemo(
    () =>
      (hideHiddenTokens ? tokens.filter((token) => !token.hidden) : [...tokens])
        .filter((token) => resolveTokenFogVisibility(tokenFogVisibilityByNumber, token.number) !== "hidden")
        .sort((left, right) => {
        if (left.number === selectedTokenNumber) return 1
        if (right.number === selectedTokenNumber) return -1
        return left.number - right.number
      }),
    [hideHiddenTokens, selectedTokenNumber, tokenFogVisibilityByNumber, tokens],
  )

  const orderedObstacles = useMemo(
    () =>
      (hideHiddenObstacles ? obstacles.filter((obstacle) => !obstacle.hidden) : [...obstacles]).sort((left, right) => {
        if (left.id === selectedObstacleId) return 1
        if (right.id === selectedObstacleId) return -1
        return left.id - right.id
      }),
    [hideHiddenObstacles, obstacles, selectedObstacleId],
  )
  const tokenPointerEventsEnabled = true

  useEffect(() => {
    onPreviewTokenMoveRef.current = onPreviewTokenMove
  }, [onPreviewTokenMove])

  useEffect(() => {
    onPreviewObstacleMoveRef.current = onPreviewObstacleMove
  }, [onPreviewObstacleMove])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      if (previewBroadcastFrameRef.current !== null) {
        window.cancelAnimationFrame(previewBroadcastFrameRef.current)
        previewBroadcastFrameRef.current = null
      }
      if (obstaclePreviewBroadcastFrameRef.current !== null) {
        window.cancelAnimationFrame(obstaclePreviewBroadcastFrameRef.current)
        obstaclePreviewBroadcastFrameRef.current = null
      }
      if (dragRef.current?.kind === "token") {
        onPreviewTokenMoveRef.current?.(dragRef.current.tokenNumber, null)
      }
      if (dragRef.current?.kind === "obstacle") {
        onPreviewObstacleMoveRef.current?.(dragRef.current.obstacleId, null)
      }
      if (dragRef.current?.kind === "obstacle-resize") {
        onPreviewObstacleMoveRef.current?.(dragRef.current.obstacleId, null)
      }
      pendingTokenPreviewRef.current = null
      pendingObstaclePreviewRef.current = null
      pendingObstacleSizePreviewRef.current = null
      pendingPreviewBroadcastRef.current = null
      pendingObstaclePreviewBroadcastRef.current = null
      releaseDragPointerCapture(dragRef.current)
    }
  }, [])
  const handleShortcutKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!interactive || shouldIgnoreShortcutTarget(event.target)) {
      return
    }

    const normalizedKey = event.key.toLowerCase()
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return
    }

    const activeTokenNumber = hoveredTokenNumberRef.current ?? selectedTokenNumber
    const token = activeTokenNumber ? tokenByNumber.get(activeTokenNumber) : null

    if (!event.shiftKey && normalizedKey === "s") {
      if (!token) {
        return
      }
      event.preventDefault()
      onRequestToggleTokenType?.(token.number)
      return
    }

    if (!event.shiftKey) {
      return
    }

    if (normalizedKey === "h") {
      event.preventDefault()
      if (token) {
        onUpdateTokenDetails?.(token.number, { hidden: !token.hidden })
        return
      }
      if (selectedObstacleId !== null) {
        onToggleObstacleHidden?.(selectedObstacleId)
      }
      return
    }

    if (normalizedKey === "d") {
      if (!token) {
        return
      }
      event.preventDefault()
      onRequestTokenDuplicate?.(token.number)
    }

    if (normalizedKey === "r") {
      if (selectedObstacleId !== null) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const obstacle = obstacles.find((o) => o.id === selectedObstacleId)
        if (obstacle && onResizeObstacle) {
          const currentRotation = (obstacle as any).rotation ?? 0
          onResizeObstacle(obstacle.id, { rotation: normalizeRotationDegrees(currentRotation + 45) })
        }
      }
      return
    }
  })

  useEffect(() => {
    window.addEventListener("keydown", handleShortcutKeyDown)
    return () => window.removeEventListener("keydown", handleShortcutKeyDown)
  }, [handleShortcutKeyDown])

  const inspectedToken = useMemo(
    () => tokens.find((token) => token.number === inspectedTokenNumber) ?? null,
    [inspectedTokenNumber, tokens],
  )
  const selectedObstacle = useMemo(
    () => obstacles.find((obstacle) => obstacle.id === selectedObstacleId) ?? null,
    [obstacles, selectedObstacleId],
  )
  const inspectedTokenRenderedPosition = useMemo(() => {
    if (!inspectedToken) {
      return null
    }

    return tokenPreviewPositions[inspectedToken.number] ?? transformPosition({ x: inspectedToken.x, y: inspectedToken.y })
  }, [inspectedToken, transformPosition, tokenPreviewPositions])

  const inspectorPlacement = useMemo(() => {
    if (!inspectedTokenRenderedPosition) {
      return null
    }

    const tokenX = inspectedTokenRenderedPosition.x
    const tokenY = inspectedTokenRenderedPosition.y
    const placeLeft = tokenX > 30
    const placeTop = tokenY > 30
    const anchorX = clamp(tokenX + (placeLeft ? -3 : 3), 6, 94)
    const anchorY = clamp(tokenY + (placeTop ? -3 : 3), 6, 94)
    const translateX = placeLeft ? "-100%" : "0%"
    const translateY = placeTop ? "-100%" : "0%"
    const originX = placeLeft ? "right" : "left"
    const originY = placeTop ? "bottom" : "top"

    return {
      left: `${anchorX}%`,
      top: `${anchorY}%`,
      transform: `translate(${translateX}, ${translateY}) rotate(calc(var(--map-rotation-deg, 0deg) * -1)) scale(calc(1 / var(--map-canvas-scale, 1)))`,
      transformOrigin: `${originX} ${originY}`,
    }
  }, [inspectedTokenRenderedPosition])
  const inspectedTokenStatusDefinition = useMemo(() => {
    if (!inspectedToken) {
      return null
    }

    return resolveTokenStatusDefinition(inspectedToken.status, statusDefinitionByName)
  }, [inspectedToken, statusDefinitionByName])
  const selectedObstacleRenderedPosition = useMemo(() => {
    if (!selectedObstacle) {
      return null
    }

    return transformPosition({ x: selectedObstacle.x, y: selectedObstacle.y })
  }, [selectedObstacle, transformPosition])

  useEffect(() => {
    if (!inspectedTokenNumber) {
      return
    }

    if (!tokens.some((token) => token.number === inspectedTokenNumber)) {
      setInspectedTokenNumber(null)
    }
  }, [inspectedTokenNumber, tokens])

  useEffect(() => {
    if (selectedTokenNumber !== null || selectedObstacleId !== null) {
      return
    }

    hoveredTokenNumberRef.current = null
    setInspectedTokenNumber(null)
  }, [selectedObstacleId, selectedTokenNumber])

  const openInspector = (tokenNumber: number) => {
    if (!enableTokenInspector) {
      return
    }

    hoveredTokenNumberRef.current = tokenNumber
    setInspectedTokenNumber(tokenNumber)
  }

  const closeInspector = () => {
    hoveredTokenNumberRef.current = null
    setInspectedTokenNumber(null)
  }


  const schedulePreviewFrame = () => {
    if (frameRef.current !== null) {
      return
    }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        setTokenPreviewPositions(pendingTokenPreviewRef.current ?? {})
        setObstaclePreviewPositions(pendingObstaclePreviewRef.current ?? {})
        setObstaclePreviewSizes(pendingObstacleSizePreviewRef.current ?? {})
        pendingTokenPreviewRef.current = null
        pendingObstaclePreviewRef.current = null
        pendingObstacleSizePreviewRef.current = null
      })
  }

  const schedulePreviewUpdate = (
    kind: "token" | "obstacle",
    id: number,
    nextPosition: TokenPosition | null,
  ) => {
    if (kind === "token") {
      pendingTokenPreviewRef.current = updatePreviewMap(
        pendingTokenPreviewRef.current ?? tokenPreviewPositions,
        id,
        nextPosition,
      )
    } else {
      pendingObstaclePreviewRef.current = updatePreviewMap(
        pendingObstaclePreviewRef.current ?? obstaclePreviewPositions,
        id,
        nextPosition,
      )
    }

    schedulePreviewFrame()
  }

  const scheduleObstacleSizePreviewUpdate = (id: number, nextSize: ObstacleSize | null) => {
    pendingObstacleSizePreviewRef.current = updatePreviewMap(
      pendingObstacleSizePreviewRef.current ?? obstaclePreviewSizes,
      id,
      nextSize,
    )

    schedulePreviewFrame()
  }

  const schedulePreviewBroadcast = (kind: "token" | "obstacle", id: number, nextPosition: TokenPosition | null) => {
    if (kind === "obstacle") {
      if (!onPreviewObstacleMove) {
        return
      }

      pendingObstaclePreviewBroadcastRef.current = {
        obstacleId: id,
        position: nextPosition,
      }

      if (obstaclePreviewBroadcastFrameRef.current !== null) {
        return
      }

      obstaclePreviewBroadcastFrameRef.current = window.requestAnimationFrame(() => {
        obstaclePreviewBroadcastFrameRef.current = null

        const pendingPreview = pendingObstaclePreviewBroadcastRef.current
        pendingObstaclePreviewBroadcastRef.current = null
        if (!pendingPreview) {
          return
        }

        onPreviewObstacleMove(pendingPreview.obstacleId, pendingPreview.position)
      })
      return
    }

    if (!onPreviewTokenMove) {
      return
    }

    pendingPreviewBroadcastRef.current = {
      tokenNumber: id,
      position: nextPosition,
    }

    if (previewBroadcastFrameRef.current !== null) {
      return
    }

    previewBroadcastFrameRef.current = window.requestAnimationFrame(() => {
      previewBroadcastFrameRef.current = null

      const pendingPreview = pendingPreviewBroadcastRef.current
      pendingPreviewBroadcastRef.current = null
      if (!pendingPreview) {
        return
      }

      onPreviewTokenMove(pendingPreview.tokenNumber, pendingPreview.position)
    })
  }

  const handleAltSnapKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!interactive || event.key !== "Alt") {
      return
    }

    const dragState = dragRef.current
    const overlayElement = overlayRef.current
    if (!dragState || dragState.kind !== "token" || !overlayElement) {
      return
    }

    const snappedPosition = snapPositionToGrid(dragState.lastPosition, dragState.metrics, overlayElement)
    dragRef.current = {
      ...dragState,
      lastPosition: snappedPosition,
    }
    schedulePreviewUpdate("token", dragState.tokenNumber, snappedPosition)
    schedulePreviewBroadcast("token", dragState.tokenNumber, transformPosition(snappedPosition))
  })

  useEffect(() => {
    window.addEventListener("keydown", handleAltSnapKeyDown)
    return () => {
      window.removeEventListener("keydown", handleAltSnapKeyDown)
    }
  }, [handleAltSnapKeyDown])

  const updateDragPosition = useEffectEvent((clientX: number, clientY: number, snapToGrid = false) => {
    const dragState = dragRef.current
    if (!dragState) {
      return
    }

    const pointerPosition = screenPointToLocalPosition(clientX, clientY, dragState.metrics)
    const resizePointerPosition =
      dragState.kind === "obstacle-resize" && snapToGrid && overlayRef.current
        ? snapPositionToGrid(pointerPosition, dragState.metrics, overlayRef.current, "edge")
        : pointerPosition
    const logicalPointerPosition = transformPosition(resizePointerPosition)

    if (dragState.kind === "token") {
      let nextPosition = {
        x: clamp(pointerPosition.x + dragState.pointerOffset.x, 0, 100),
        y: clamp(pointerPosition.y + dragState.pointerOffset.y, 0, 100),
      }

      if (snapToGrid && overlayRef.current) nextPosition = snapPositionToGrid(nextPosition, dragState.metrics, overlayRef.current)

      dragRef.current = {
        ...dragState,
        lastPosition: nextPosition,
      }
      schedulePreviewUpdate("token", dragState.tokenNumber, nextPosition)
      schedulePreviewBroadcast("token", dragState.tokenNumber, transformPosition(nextPosition))
      return
    }

    if (dragState.kind === "obstacle-resize") {
      if (!onResizeObstacle) {
        return
      }

      const clampSize = (value: number) => clamp(value, 0, 100)

      if (dragState.resizeHandle === "center" || dragState.obstacle.shape === "circle" || dragState.obstacle.image) {
        const nextWidth = clampSize(Math.abs(logicalPointerPosition.x - dragState.obstacle.x) * 2)
        const nextHeight =
          (dragState.obstacle.shape === "circle" || dragState.obstacle.image)
            ? nextWidth
            : clampSize(Math.abs(logicalPointerPosition.y - dragState.obstacle.y) * 2)

        const nextSize = {
          width: nextWidth,
          height: nextHeight,
        }
        dragRef.current = {
          ...dragState,
          lastSize: nextSize,
        }
        scheduleObstacleSizePreviewUpdate(dragState.obstacleId, nextSize)
        return
      }

      const halfWidth = dragState.obstacle.width / 2
      const halfHeight = dragState.obstacle.height / 2
      const left = dragState.obstacle.x - halfWidth
      const right = dragState.obstacle.x + halfWidth
      const top = dragState.obstacle.y - halfHeight
      const bottom = dragState.obstacle.y + halfHeight

      let nextLeft = left
      let nextRight = right
      let nextTop = top
      let nextBottom = bottom

      switch (dragState.resizeHandle) {
        case "nw":
          nextLeft = clamp(logicalPointerPosition.x, 0, right)
          nextTop = clamp(logicalPointerPosition.y, 0, bottom)
          break
        case "ne":
          nextRight = clamp(logicalPointerPosition.x, left, 100)
          nextTop = clamp(logicalPointerPosition.y, 0, bottom)
          break
        case "sw":
          nextLeft = clamp(logicalPointerPosition.x, 0, right)
          nextBottom = clamp(logicalPointerPosition.y, top, 100)
          break
        case "se":
          nextRight = clamp(logicalPointerPosition.x, left, 100)
          nextBottom = clamp(logicalPointerPosition.y, top, 100)
          break
        default:
          break
      }

      const nextWidth = clampSize(nextRight - nextLeft)
      const nextHeight = clampSize(nextBottom - nextTop)
      const nextCenterX = (nextLeft + nextRight) / 2
      const nextCenterY = (nextTop + nextBottom) / 2

      const nextSize = {
        width: nextWidth,
        height: nextHeight,
      }
      const nextPosition = {
        x: clamp(nextCenterX, 0, 100),
        y: clamp(nextCenterY, 0, 100),
      }
      const nextRenderedPosition = transformPosition(nextPosition)
      dragRef.current = {
        ...dragState,
        lastPosition: nextRenderedPosition,
        lastSize: nextSize,
      }
      schedulePreviewUpdate("obstacle", dragState.obstacleId, nextRenderedPosition)
      scheduleObstacleSizePreviewUpdate(dragState.obstacleId, nextSize)
      return
    }

    let nextPosition = {
      x: clamp(pointerPosition.x + dragState.pointerOffset.x, 0, 100),
      y: clamp(pointerPosition.y + dragState.pointerOffset.y, 0, 100),
    }
    if (snapToGrid && overlayRef.current) {
      nextPosition = snapObstaclePositionToGridEdges(
        nextPosition,
        dragState.obstacle,
        dragState.metrics,
        overlayRef.current,
      )
    }
    dragRef.current = {
      ...dragState,
      lastPosition: nextPosition,
    }
    schedulePreviewUpdate("obstacle", dragState.obstacleId, nextPosition)
    schedulePreviewBroadcast("obstacle", dragState.obstacleId, transformPosition(nextPosition))
  })

  const finishDrag = useEffectEvent(() => {
    const dragState = dragRef.current
    if (!dragState) {
      return
    }

    if (dragState.kind === "token") {
      const movedDistance = Math.hypot(
        dragState.lastPosition.x - dragState.initialPosition.x,
        dragState.lastPosition.y - dragState.initialPosition.y,
      )
      const now = window.performance.now()
      if (movedDistance >= CLICK_OPEN_DRAG_THRESHOLD_PERCENT) {
        suppressInspectorClickRef.current = {
          tokenNumber: dragState.tokenNumber,
          expiresAt: now + SUPPRESS_CLICK_AFTER_DRAG_MS,
        }
      } else if (
        suppressInspectorClickRef.current &&
        suppressInspectorClickRef.current.tokenNumber === dragState.tokenNumber &&
        suppressInspectorClickRef.current.expiresAt <= now
      ) {
        suppressInspectorClickRef.current = null
      }

      onMoveToken?.(dragState.tokenNumber, transformPosition(dragState.lastPosition))
      schedulePreviewUpdate("token", dragState.tokenNumber, null)
      schedulePreviewBroadcast("token", dragState.tokenNumber, null)
    } else if (dragState.kind === "obstacle") {
      onMoveObstacle?.(dragState.obstacleId, transformPosition(dragState.lastPosition))
      schedulePreviewUpdate("obstacle", dragState.obstacleId, null)
      schedulePreviewBroadcast("obstacle", dragState.obstacleId, null)
    } else if (dragState.kind === "obstacle-resize") {
      onResizeObstacle?.(dragState.obstacleId, dragState.lastSize)
      onMoveObstacle?.(dragState.obstacleId, transformPosition(dragState.lastPosition))
      schedulePreviewUpdate("obstacle", dragState.obstacleId, null)
      scheduleObstacleSizePreviewUpdate(dragState.obstacleId, null)
      schedulePreviewBroadcast("obstacle", dragState.obstacleId, null)
    }

    releaseDragPointerCapture(dragState)
    dragRef.current = null
  })

  const handleWindowPointerMove = useEffectEvent((event: PointerEvent) => {
    if (!interactive) {
      return
    }

    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    updateDragPosition(event.clientX, event.clientY, event.altKey)
  })

  const handleWindowPointerEnd = useEffectEvent((event: PointerEvent) => {
    if (!interactive) {
      return
    }

    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    finishDrag()
  })

  useEffect(() => {
    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false })
    window.addEventListener("pointerup", handleWindowPointerEnd, { passive: false })
    window.addEventListener("pointercancel", handleWindowPointerEnd, { passive: false })

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove)
      window.removeEventListener("pointerup", handleWindowPointerEnd)
      window.removeEventListener("pointercancel", handleWindowPointerEnd)
    }
  }, [handleWindowPointerEnd, handleWindowPointerMove])

  const handleTokenPointerDown = (token: BattleToken) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (event.button !== 0) {
      return
    }

    if (!event.shiftKey) {
      return
    }

    event.preventDefault()
    onSelectToken?.(token.number)

    if (enableTokenInspector) {
      closeInspector()
    }

    if (!interactive || !onMoveToken) {
      return
    }

    const overlayElement = overlayRef.current
    if (!overlayElement) {
      return
    }

    const metrics = buildTransformMetrics(overlayElement)
    if (!metrics) {
      return
    }

    const pointerPosition = screenPointToLocalPosition(event.clientX, event.clientY, metrics)
    const renderedPosition = tokenPreviewPositions[token.number] ?? transformPosition({ x: token.x, y: token.y })

    dragRef.current = {
      kind: "token",
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      tokenNumber: token.number,
      initialPosition: renderedPosition,
      lastPosition: renderedPosition,
      pointerOffset: {
        x: renderedPosition.x - pointerPosition.x,
        y: renderedPosition.y - pointerPosition.y,
      },
      metrics,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleObstaclePointerDown = (obstacle: BattleObstacle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.button !== 0) {
      return
    }

    if (!event.shiftKey) {
      return
    }

    onSelectObstacle?.(obstacle.id)

    if (!interactive || !onMoveObstacle) {
      return
    }

    const overlayElement = overlayRef.current
    if (!overlayElement) {
      return
    }

    const metrics = buildTransformMetrics(overlayElement)
    if (!metrics) {
      return
    }

    const pointerPosition = screenPointToLocalPosition(event.clientX, event.clientY, metrics)
    const renderedPosition = obstaclePreviewPositions[obstacle.id] ?? transformPosition({ x: obstacle.x, y: obstacle.y })

    dragRef.current = {
      kind: "obstacle",
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      obstacleId: obstacle.id,
      obstacle,
      lastPosition: renderedPosition,
      pointerOffset: {
        x: renderedPosition.x - pointerPosition.x,
        y: renderedPosition.y - pointerPosition.y,
      },
      metrics,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleObstacleResizePointerDown =
    (obstacle: BattleObstacle, handle: "center" | "nw" | "ne" | "sw" | "se") =>
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.button !== 0) {
        return
      }

      if (!event.shiftKey) {
        return
      }

      onSelectObstacle?.(obstacle.id)

      if (!interactive || !onResizeObstacle) {
        return
      }

      const overlayElement = overlayRef.current
      if (!overlayElement) {
        return
      }

      const metrics = buildTransformMetrics(overlayElement)
      if (!metrics) {
        return
      }

      dragRef.current = {
        kind: "obstacle-resize",
        pointerId: event.pointerId,
        pointerTarget: event.currentTarget,
      obstacleId: obstacle.id,
      obstacle,
      lastPosition: transformPosition({ x: obstacle.x, y: obstacle.y }),
      lastSize: {
        width: obstacle.width,
        height: obstacle.shape === "circle" ? obstacle.width : obstacle.height,
      },
      resizeHandle: handle,
        metrics,
      }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePropPlacementPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !pendingPropPlacement || !onPlaceProp || event.button !== 0) {
      return
    }

    const overlayElement = overlayRef.current
    if (!overlayElement) {
      return
    }

    const metrics = buildTransformMetrics(overlayElement)
    if (!metrics) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const pointerPosition = screenPointToLocalPosition(event.clientX, event.clientY, metrics)
    onPlaceProp(transformPosition(pointerPosition), event.shiftKey)
  }

  return (
    <div ref={overlayRef} className="pointer-events-none relative size-full">
      {interactive && pendingPropPlacement ? (
        <div
          className="pointer-events-auto absolute inset-0 z-[50] cursor-copy"
          title={`Colocar ${pendingPropPlacement.name}`}
          onPointerDown={handlePropPlacementPointerDown}
        />
      ) : null}
      {orderedTokens.map((token) => {
        const linkedCharacter =
          typeof token.characterId === "number" ? (characterById?.get(token.characterId) ?? null) : null
        const tokenStatusDefinition = resolveTokenStatusDefinition(token.status, statusDefinitionByName)
        const renderedPosition = tokenPreviewPositions[token.number] ?? transformPosition({ x: token.x, y: token.y })
        return (
          <BattleTokenItem
            key={`token-${token.number}`}
            token={token}
            linkedCharacter={linkedCharacter}
            tokenStatusDefinition={tokenStatusDefinition}
            renderedPosition={renderedPosition}
            selectedTokenNumber={selectedTokenNumber}
            currentTurnTokenNumber={currentTurnTokenNumber}
            ghostHiddenTokens={ghostHiddenTokens}
            showTokenLifeBadge={showTokenLifeBadge}
            verticalMirror={verticalMirror}
            neutralPalette={neutralPalette}
            pointerEventsEnabled={tokenPointerEventsEnabled}
            onClick={(event) => {
              event.stopPropagation()

              if (event.shiftKey) {
                return
              }

              onSelectToken?.(token.number)

              if (suppressInspectorOnTokenClick) {
                onTokenClick?.(token.number)
                return
              }

              if (!enableTokenInspector) {
                return
              }

              const now = window.performance.now()
              const pendingSuppressedClick = suppressInspectorClickRef.current
              if (pendingSuppressedClick && pendingSuppressedClick.expiresAt <= now) {
                suppressInspectorClickRef.current = null
              }

              if (
                pendingSuppressedClick &&
                pendingSuppressedClick.tokenNumber === token.number &&
                pendingSuppressedClick.expiresAt > now
              ) {
                suppressInspectorClickRef.current = null
                return
              }

              openInspector(token.number)
            }}
            onPointerDown={handleTokenPointerDown(token)}
            onMouseEnter={() => {
              hoveredTokenNumberRef.current = token.number
            }}
            onMouseLeave={() => {
              if (hoveredTokenNumberRef.current === token.number) {
                hoveredTokenNumberRef.current = null
              }
            }}
            onContextMenu={(event) => {
              if (!interactive) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              if (!event.shiftKey) {
                return
              }

              onSelectToken?.(token.number)
              closeInspector()
              onRequestTokenQuickDelete?.(token.number)
            }}
            onWheel={(event) => {
              if (!interactive || !onResizeToken) {
                return
              }

              if (!event.shiftKey) {
                return
              }

              event.stopPropagation()
              const delta = event.deltaY < 0 ? 0.1 : -0.1
              onResizeToken(token.number, clampTokenSize(token.size + delta))
            }}
          />
        )
      })}

      {orderedObstacles.map((obstacle) => {
        const previewSize = obstaclePreviewSizes[obstacle.id]
        const renderedObstacle = previewSize
          ? {
              ...obstacle,
              ...previewSize,
            }
          : obstacle

        return (
          <BattleObstacleItem
            key={`obstacle-${obstacle.id}`}
            obstacle={renderedObstacle}
            renderedPosition={obstaclePreviewPositions[obstacle.id] ?? transformPosition({ x: obstacle.x, y: obstacle.y })}
            isSelected={obstacle.id === selectedObstacleId}
            interactive={interactive}
            onRemoveObstacle={onRemoveObstacle}
            onResizeObstacle={onResizeObstacle}
            onSelectObstacle={onSelectObstacle}
            onPointerDown={handleObstaclePointerDown(obstacle)}
            onResizePointerDown={(handle) => handleObstacleResizePointerDown(obstacle, handle)}
          />
        )
      })}

      {interactive && selectedObstacle && selectedObstacleRenderedPosition ? (
        <SelectedObstacleToolbar
          obstacle={selectedObstacle}
          renderedPosition={selectedObstacleRenderedPosition}
          onRemoveObstacle={onRemoveObstacle}
        />
      ) : null}

      {enableTokenInspector && inspectedToken ? (
        <BattleTokenInspector
          inspectedToken={inspectedToken}
          inspectedTokenStatusDefinition={inspectedTokenStatusDefinition}
          inspectorPlacement={inspectorPlacement}
          statusDefinitions={statusDefinitions}
          tokenInspectorEditable={tokenInspectorEditable}
          isTokenDetailAvailable={isTokenDetailAvailable}
          onOpenInspector={openInspector}
          onCloseInspector={closeInspector}
          onUpdateTokenDetails={onUpdateTokenDetails}
          onRequestTokenDelete={onRequestTokenDelete}
          onRequestTokenCropEdit={onRequestTokenCropEdit}
          onRequestTokenDetail={onRequestTokenDetail}
        />
      ) : null}
    </div>
  )
}
