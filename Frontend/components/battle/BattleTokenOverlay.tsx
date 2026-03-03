"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import type { BattleObstacle, BattleToken, Character } from "@/lib/types"

type TokenPosition = {
  x: number
  y: number
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
      lastPosition: TokenPosition
      pointerOffset: TokenPosition
      metrics: TransformMetrics
    }
  | {
      kind: "obstacle"
      pointerId: number
      pointerTarget: HTMLElement
      obstacleId: number
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
      resizeHandle: "center" | "nw" | "ne" | "sw" | "se"
      metrics: TransformMetrics
    }

type BattleTokenOverlayProps = {
  tokens: BattleToken[]
  obstacles?: BattleObstacle[]
  characterById?: Map<number, Character>
  interactive?: boolean
  enableTokenInspector?: boolean
  tokenInspectorEditable?: boolean
  hideHiddenTokens?: boolean
  ghostHiddenTokens?: boolean
  selectedTokenNumber?: number | null
  selectedObstacleId?: number | null
  onSelectToken?: (tokenNumber: number) => void
  onUpdateTokenDetails?: (
    tokenNumber: number,
    nextValues: {
      nombre?: string
      initiative?: number | undefined
      life?: number | undefined
      size?: number
      status?: string
      hidden?: boolean
    },
  ) => void
  onRequestTokenDelete?: (tokenNumber: number) => void
  onPreviewTokenMove?: (tokenNumber: number, nextPosition: TokenPosition | null) => void
  onPreviewObstacleMove?: (obstacleId: number, nextPosition: TokenPosition | null) => void
  onMoveToken?: (tokenNumber: number, nextPosition: TokenPosition) => void
  onResizeToken?: (tokenNumber: number, nextSize: number) => void
  onSelectObstacle?: (obstacleId: number) => void
  onMoveObstacle?: (obstacleId: number, nextPosition: TokenPosition) => void
  onResizeObstacle?: (obstacleId: number, nextSize: { width: number; height: number }) => void
  onRemoveObstacle?: (obstacleId: number) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampTokenSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.round(clamp(value, 0.4, 2) * 100) / 100
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
): TokenPosition {
  const grid = readGridMetrics(overlayElement)
  if (!grid) {
    return position
  }

  const snapAxis = (percentValue: number, total: number, offset: number) => {
    const pixelValue = (percentValue / 100) * total
    const snappedPixel =
      offset + grid.cellSize / 2 + Math.round((pixelValue - offset - grid.cellSize / 2) / grid.cellSize) * grid.cellSize

    return clamp((snappedPixel / total) * 100, 0, 100)
  }

  return {
    x: snapAxis(position.x, metrics.localWidth, grid.offsetX),
    y: snapAxis(position.y, metrics.localHeight, grid.offsetY),
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

export function BattleTokenOverlay({
  tokens,
  obstacles = [],
  characterById,
  interactive = false,
  enableTokenInspector = false,
  tokenInspectorEditable = false,
  hideHiddenTokens = false,
  ghostHiddenTokens = false,
  selectedTokenNumber = null,
  selectedObstacleId = null,
  onSelectToken,
  onUpdateTokenDetails,
  onRequestTokenDelete,
  onPreviewTokenMove,
  onPreviewObstacleMove,
  onMoveToken,
  onResizeToken,
  onSelectObstacle,
  onMoveObstacle,
  onResizeObstacle,
  onRemoveObstacle,
}: BattleTokenOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const onPreviewTokenMoveRef = useRef(onPreviewTokenMove)
  const onPreviewObstacleMoveRef = useRef(onPreviewObstacleMove)
  const frameRef = useRef<number | null>(null)
  const inspectorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspectorCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspectorProgressFrameRef = useRef<number | null>(null)
  const previewBroadcastFrameRef = useRef<number | null>(null)
  const obstaclePreviewBroadcastFrameRef = useRef<number | null>(null)
  const hoveredTokenNumberRef = useRef<number | null>(null)
  const dismissedTokenNumberRef = useRef<number | null>(null)
  const pendingTokenPreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const pendingObstaclePreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const pendingPreviewBroadcastRef = useRef<{
    tokenNumber: number
    position: TokenPosition | null
  } | null>(null)
  const pendingObstaclePreviewBroadcastRef = useRef<{
    obstacleId: number
    position: TokenPosition | null
  } | null>(null)
  const [tokenPreviewPositions, setTokenPreviewPositions] = useState<Record<number, TokenPosition>>({})
  const [obstaclePreviewPositions, setObstaclePreviewPositions] = useState<Record<number, TokenPosition>>({})
  const [inspectedTokenNumber, setInspectedTokenNumber] = useState<number | null>(null)
  const [isInspectorPinned, setIsInspectorPinned] = useState(false)
  const [inspectorPinProgress, setInspectorPinProgress] = useState(0)

  const tokenByNumber = useMemo(() => {
    return new Map(tokens.map((token) => [token.number, token]))
  }, [tokens])

  const orderedTokens = useMemo(
    () =>
      (hideHiddenTokens ? tokens.filter((token) => !token.hidden) : [...tokens]).sort((left, right) => {
        if (left.number === selectedTokenNumber) return 1
        if (right.number === selectedTokenNumber) return -1
        return left.number - right.number
      }),
    [hideHiddenTokens, selectedTokenNumber, tokens],
  )

  const orderedObstacles = useMemo(
    () =>
      [...obstacles].sort((left, right) => {
        if (left.id === selectedObstacleId) return 1
        if (right.id === selectedObstacleId) return -1
        return left.id - right.id
      }),
    [obstacles, selectedObstacleId],
  )

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
      if (inspectorTimeoutRef.current) {
        clearTimeout(inspectorTimeoutRef.current)
      }
      if (inspectorCloseTimeoutRef.current) {
        clearTimeout(inspectorCloseTimeoutRef.current)
      }
      if (inspectorProgressFrameRef.current !== null) {
        window.cancelAnimationFrame(inspectorProgressFrameRef.current)
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
      pendingTokenPreviewRef.current = null
      pendingObstaclePreviewRef.current = null
      pendingPreviewBroadcastRef.current = null
      pendingObstaclePreviewBroadcastRef.current = null
      releaseDragPointerCapture(dragRef.current)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return
      }

      if (event.key.toLowerCase() !== "h") {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return
      }

      const hoveredTokenNumber = hoveredTokenNumberRef.current
      if (!hoveredTokenNumber) {
        return
      }

      const token = tokenByNumber.get(hoveredTokenNumber)
      if (!token) {
        return
      }

      event.preventDefault()
      onUpdateTokenDetails?.(token.number, { hidden: !token.hidden })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onUpdateTokenDetails, tokenByNumber])

  const inspectedToken = useMemo(
    () => tokens.find((token) => token.number === inspectedTokenNumber) ?? null,
    [inspectedTokenNumber, tokens],
  )

  useEffect(() => {
    if (!inspectedTokenNumber) {
      return
    }

    if (!tokens.some((token) => token.number === inspectedTokenNumber)) {
      setInspectedTokenNumber(null)
      setIsInspectorPinned(false)
    }
  }, [inspectedTokenNumber, tokens])


  const clearInspectorTimeout = () => {
    if (!inspectorTimeoutRef.current) {
      return
    }

    clearTimeout(inspectorTimeoutRef.current)
    inspectorTimeoutRef.current = null
  }

  const clearInspectorCloseTimeout = () => {
    if (!inspectorCloseTimeoutRef.current) {
      return
    }

    clearTimeout(inspectorCloseTimeoutRef.current)
    inspectorCloseTimeoutRef.current = null
  }

  const stopInspectorProgress = () => {
    if (inspectorProgressFrameRef.current === null) {
      return
    }

    window.cancelAnimationFrame(inspectorProgressFrameRef.current)
    inspectorProgressFrameRef.current = null
  }

  const startInspectorProgress = () => {
    if (isInspectorPinned) {
      setInspectorPinProgress(1)
      return
    }

    stopInspectorProgress()
    const startedAt = window.performance.now()
    setInspectorPinProgress(0)

    const tick = (now: number) => {
      const nextProgress = clamp((now - startedAt) / 1000, 0, 1)
      setInspectorPinProgress(nextProgress)

      if (nextProgress >= 1 || isInspectorPinned) {
        inspectorProgressFrameRef.current = null
        return
      }

      inspectorProgressFrameRef.current = window.requestAnimationFrame(tick)
    }

    inspectorProgressFrameRef.current = window.requestAnimationFrame(tick)
  }

  const openInspector = (tokenNumber: number, pinned: boolean) => {
    if (!enableTokenInspector) {
      return
    }

    clearInspectorTimeout()
    clearInspectorCloseTimeout()
    stopInspectorProgress()
    hoveredTokenNumberRef.current = tokenNumber
    dismissedTokenNumberRef.current = null
    setInspectedTokenNumber(tokenNumber)
    setIsInspectorPinned(pinned)
    setInspectorPinProgress(pinned ? 1 : 0)
  }

  const closeInspector = (manualDismiss = false) => {
    clearInspectorTimeout()
    clearInspectorCloseTimeout()
    stopInspectorProgress()
    if (manualDismiss) {
      dismissedTokenNumberRef.current = inspectedTokenNumber
    }
    hoveredTokenNumberRef.current = null
    setInspectedTokenNumber(null)
    setIsInspectorPinned(false)
    setInspectorPinProgress(0)
  }

  const scheduleInspectorOpen = (tokenNumber: number) => {
    if (!enableTokenInspector || isInspectorPinned) {
      return
    }

    if (dismissedTokenNumberRef.current === tokenNumber) {
      return
    }

    clearInspectorCloseTimeout()
    clearInspectorTimeout()
    stopInspectorProgress()
    hoveredTokenNumberRef.current = tokenNumber

    inspectorTimeoutRef.current = setTimeout(() => {
      if (hoveredTokenNumberRef.current !== tokenNumber) {
        inspectorTimeoutRef.current = null
        return
      }

      setInspectedTokenNumber(tokenNumber)
      setIsInspectorPinned(false)
      startInspectorProgress()

      inspectorTimeoutRef.current = setTimeout(() => {
        if (hoveredTokenNumberRef.current !== tokenNumber) {
          inspectorTimeoutRef.current = null
          return
        }

        stopInspectorProgress()
        setInspectedTokenNumber(tokenNumber)
        setIsInspectorPinned(true)
        setInspectorPinProgress(1)
        inspectorTimeoutRef.current = null
      }, 1000)
    }, 1000)
  }

  const scheduleInspectorClose = (tokenNumber: number) => {
    if (isInspectorPinned) {
      return
    }

    hoveredTokenNumberRef.current = null
    clearInspectorTimeout()
    clearInspectorCloseTimeout()
    stopInspectorProgress()

    inspectorCloseTimeoutRef.current = setTimeout(() => {
      setInspectedTokenNumber((current) => (current === tokenNumber ? null : current))
      setIsInspectorPinned(false)
      setInspectorPinProgress(0)
      inspectorCloseTimeoutRef.current = null
    }, 220)
  }


  const schedulePreviewFrame = () => {
    if (frameRef.current !== null) {
      return
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      setTokenPreviewPositions(pendingTokenPreviewRef.current ?? {})
      setObstaclePreviewPositions(pendingObstaclePreviewRef.current ?? {})
      pendingTokenPreviewRef.current = null
      pendingObstaclePreviewRef.current = null
    })
  }

  const scheduleTokenPreviewUpdate = (tokenNumber: number, nextPosition: TokenPosition | null) => {
    pendingTokenPreviewRef.current = (() => {
      const current = pendingTokenPreviewRef.current ?? tokenPreviewPositions
      const next = { ...current }

      if (nextPosition) {
        next[tokenNumber] = nextPosition
      } else {
        delete next[tokenNumber]
      }

      return next
    })()

    schedulePreviewFrame()
  }

  const scheduleObstaclePreviewUpdate = (obstacleId: number, nextPosition: TokenPosition | null) => {
    pendingObstaclePreviewRef.current = (() => {
      const current = pendingObstaclePreviewRef.current ?? obstaclePreviewPositions
      const next = { ...current }

      if (nextPosition) {
        next[obstacleId] = nextPosition
      } else {
        delete next[obstacleId]
      }

      return next
    })()

    schedulePreviewFrame()
  }

  const schedulePreviewBroadcast = (tokenNumber: number, nextPosition: TokenPosition | null) => {
    if (!onPreviewTokenMove) {
      return
    }

    pendingPreviewBroadcastRef.current = {
      tokenNumber,
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

  const scheduleObstaclePreviewBroadcast = (obstacleId: number, nextPosition: TokenPosition | null) => {
    if (!onPreviewObstacleMove) {
      return
    }

    pendingObstaclePreviewBroadcastRef.current = {
      obstacleId,
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
  }

  useEffect(() => {
    if (!interactive) {
      return
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift") {
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
      scheduleTokenPreviewUpdate(dragState.tokenNumber, snappedPosition)
      schedulePreviewBroadcast(dragState.tokenNumber, snappedPosition)
    }

    window.addEventListener("keydown", handleWindowKeyDown)
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown)
    }
  }, [interactive, onPreviewTokenMove, scheduleTokenPreviewUpdate])

  const updateDragPosition = (clientX: number, clientY: number, snapToGrid = false) => {
    const dragState = dragRef.current
    if (!dragState) {
      return
    }

    const pointerPosition = screenPointToLocalPosition(clientX, clientY, dragState.metrics)

    if (dragState.kind === "token") {
      let nextPosition = {
        x: clamp(pointerPosition.x + dragState.pointerOffset.x, 0, 100),
        y: clamp(pointerPosition.y + dragState.pointerOffset.y, 0, 100),
      }

      if (snapToGrid && overlayRef.current) {
        nextPosition = snapPositionToGrid(nextPosition, dragState.metrics, overlayRef.current)
      }

      dragRef.current = {
        ...dragState,
        lastPosition: nextPosition,
      }
      scheduleTokenPreviewUpdate(dragState.tokenNumber, nextPosition)
      schedulePreviewBroadcast(dragState.tokenNumber, nextPosition)
      return
    }

    if (dragState.kind === "obstacle-resize") {
      if (!onResizeObstacle) {
        return
      }

      const clampSize = (value: number) => clamp(value, 0, 100)

      if (dragState.resizeHandle === "center" || dragState.obstacle.shape === "circle") {
        const nextWidth = clampSize(Math.abs(pointerPosition.x - dragState.obstacle.x) * 2)
        const nextHeight =
          dragState.obstacle.shape === "circle"
            ? nextWidth
            : clampSize(Math.abs(pointerPosition.y - dragState.obstacle.y) * 2)

        onResizeObstacle(dragState.obstacleId, {
          width: nextWidth,
          height: nextHeight,
        })
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
          nextLeft = clamp(pointerPosition.x, 0, right)
          nextTop = clamp(pointerPosition.y, 0, bottom)
          break
        case "ne":
          nextRight = clamp(pointerPosition.x, left, 100)
          nextTop = clamp(pointerPosition.y, 0, bottom)
          break
        case "sw":
          nextLeft = clamp(pointerPosition.x, 0, right)
          nextBottom = clamp(pointerPosition.y, top, 100)
          break
        case "se":
          nextRight = clamp(pointerPosition.x, left, 100)
          nextBottom = clamp(pointerPosition.y, top, 100)
          break
        default:
          break
      }

      const nextWidth = clampSize(nextRight - nextLeft)
      const nextHeight = clampSize(nextBottom - nextTop)
      const nextCenterX = (nextLeft + nextRight) / 2
      const nextCenterY = (nextTop + nextBottom) / 2

      onResizeObstacle(dragState.obstacleId, {
        width: nextWidth,
        height: nextHeight,
      })
      onMoveObstacle?.(dragState.obstacleId, {
        x: clamp(nextCenterX, 0, 100),
        y: clamp(nextCenterY, 0, 100),
      })
      return
    }

    const nextPosition = {
      x: clamp(pointerPosition.x + dragState.pointerOffset.x, 0, 100),
      y: clamp(pointerPosition.y + dragState.pointerOffset.y, 0, 100),
    }
    dragRef.current = {
      ...dragState,
      lastPosition: nextPosition,
    }
    scheduleObstaclePreviewUpdate(dragState.obstacleId, nextPosition)
    scheduleObstaclePreviewBroadcast(dragState.obstacleId, nextPosition)
  }

  const finishDrag = () => {
    const dragState = dragRef.current
    if (!dragState) {
      return
    }

    if (dragState.kind === "token") {
      onMoveToken?.(dragState.tokenNumber, dragState.lastPosition)
      scheduleTokenPreviewUpdate(dragState.tokenNumber, null)
      schedulePreviewBroadcast(dragState.tokenNumber, null)
    } else {
      if (dragState.kind === "obstacle") {
        onMoveObstacle?.(dragState.obstacleId, dragState.lastPosition)
        scheduleObstaclePreviewUpdate(dragState.obstacleId, null)
        scheduleObstaclePreviewBroadcast(dragState.obstacleId, null)
      }
    }

    releaseDragPointerCapture(dragState)
    dragRef.current = null
  }

  useEffect(() => {
    if (!interactive) {
      return
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      const dragState = dragRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }

      updateDragPosition(event.clientX, event.clientY, event.shiftKey)
    }

    const handleWindowPointerEnd = (event: PointerEvent) => {
      const dragState = dragRef.current
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }

      finishDrag()
    }

    window.addEventListener("pointermove", handleWindowPointerMove, { passive: false })
    window.addEventListener("pointerup", handleWindowPointerEnd, { passive: false })
    window.addEventListener("pointercancel", handleWindowPointerEnd, { passive: false })

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove)
      window.removeEventListener("pointerup", handleWindowPointerEnd)
      window.removeEventListener("pointercancel", handleWindowPointerEnd)
    }
  }, [interactive, onMoveObstacle, onMoveToken])

  const handleTokenPointerDown = (token: BattleToken) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectToken?.(token.number)

    if (event.button !== 0) {
      return
    }

    if (!interactive || !onMoveToken) {
      return
    }

    if (enableTokenInspector && inspectedTokenNumber !== null) {
      closeInspector()
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
    const renderedPosition = tokenPreviewPositions[token.number] ?? { x: token.x, y: token.y }

    dragRef.current = {
      kind: "token",
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      tokenNumber: token.number,
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
    onSelectObstacle?.(obstacle.id)

    if (event.button !== 0) {
      return
    }

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
    const renderedPosition = obstaclePreviewPositions[obstacle.id] ?? { x: obstacle.x, y: obstacle.y }

    dragRef.current = {
      kind: "obstacle",
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      obstacleId: obstacle.id,
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
      onSelectObstacle?.(obstacle.id)

      if (event.button !== 0) {
        return
      }

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
        resizeHandle: handle,
        metrics,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    }

  return (
    <div ref={overlayRef} className="pointer-events-none relative size-full">
      {orderedObstacles.map((obstacle) => {
        const renderedPosition = obstaclePreviewPositions[obstacle.id] ?? { x: obstacle.x, y: obstacle.y }
        const isSelected = obstacle.id === selectedObstacleId
        const isCircle = obstacle.shape === "circle"
        const obstacleWidth = obstacle.width
        const obstacleHeight = isCircle ? obstacle.width : obstacle.height

        return (
          <button
            key={`obstacle-${obstacle.id}`}
            type="button"
            className="pointer-events-auto absolute bg-transparent p-0"
            data-battle-wheel-stop="true"
            style={{
              left: `${renderedPosition.x}%`,
              top: `${renderedPosition.y}%`,
              width: `${obstacleWidth}%`,
              height: isCircle ? undefined : `${obstacleHeight}%`,
              aspectRatio: isCircle ? "1 / 1" : undefined,
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 2 : 1,
              touchAction: "none",
              clipPath: isCircle ? "circle(50%)" : undefined,
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectObstacle?.(obstacle.id)
            }}
            onDoubleClick={(event) => {
              if (!interactive || !onRemoveObstacle) {
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
              if (!interactive || !onRemoveObstacle) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onRemoveObstacle(obstacle.id)
            }}
            onPointerDown={handleObstaclePointerDown(obstacle)}
              onWheel={(event) => {
                if (!interactive || !onResizeObstacle) {
                  return
                }

                event.preventDefault()
                event.stopPropagation()

                const delta = event.deltaY < 0 ? 1 : -1
                const nextWidth = clamp(obstacle.width + delta, 0, 100)
                const nextHeight = clamp(obstacle.height + delta, 0, 100)

                onResizeObstacle(obstacle.id, {
                  width: nextWidth,
                  height: obstacle.shape === "circle" ? nextWidth : nextHeight,
                })
            }}
          >
            <span
              className="block size-full border-2 shadow-lg"
              style={{
                borderRadius: isCircle ? "50%" : "0",
                borderColor: obstacle.color,
                backgroundColor: withAlpha(obstacle.color, 0.32),
                boxShadow: isSelected
                  ? `0 0 0 4px ${withAlpha("#fcd34d", 0.7)}`
                  : `0 0 0 1px ${withAlpha(obstacle.color, 0.15)}`,
              }}
            />
            {interactive && onResizeObstacle
              ? isCircle ? (
                  <span
                    className="pointer-events-auto absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                    onPointerDown={handleObstacleResizePointerDown(obstacle, "center")}
                    onWheel={(event) => {
                      if (!interactive || !onResizeObstacle) {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()

                      const delta = event.deltaY < 0 ? 1 : -1
                      const nextSize = clamp(obstacle.width + delta, 0, 100)
                      onResizeObstacle(obstacle.id, { width: nextSize, height: nextSize })
                    }}
                  />
                ) : (
                  <>
                    <span
                      className="pointer-events-auto absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                      onPointerDown={handleObstacleResizePointerDown(obstacle, "nw")}
                    />
                    <span
                      className="pointer-events-auto absolute right-0 top-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                      onPointerDown={handleObstacleResizePointerDown(obstacle, "ne")}
                    />
                    <span
                      className="pointer-events-auto absolute left-0 bottom-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                      onPointerDown={handleObstacleResizePointerDown(obstacle, "sw")}
                    />
                    <span
                      className="pointer-events-auto absolute right-0 bottom-0 size-2.5 translate-x-1/2 translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
                      onPointerDown={handleObstacleResizePointerDown(obstacle, "se")}
                    />
                  </>
                )
              : null}
          </button>
        )
      })}

      {orderedTokens.map((token) => {
        const isSelected = token.number === selectedTokenNumber
        const isEnemy = token.type === "enemy"
        const isDeadEnemy = isEnemy && (token.life ?? 1) <= 0
        const isHidden = Boolean(token.hidden)
        const isGhosted = isHidden && ghostHiddenTokens
        const linkedCharacter =
          typeof token.characterId === "number" ? (characterById?.get(token.characterId) ?? null) : null
        const tokenImage = linkedCharacter?.imagen?.trim() || null
        const renderedPosition = tokenPreviewPositions[token.number] ?? { x: token.x, y: token.y }
        const renderedSize = clampTokenSize(token.size)
        const tokenDiameter = Math.round(44 * renderedSize)
        const tokenDiameterCss = `calc(${tokenDiameter}px * var(--map-image-scale, 1))`

        return (
          <button
            key={`token-${token.number}`}
            type="button"
            className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent p-0 text-left ${isGhosted ? "opacity-25" : ""}`}
            data-battle-wheel-stop="true"
            style={{
              left: `${renderedPosition.x}%`,
              top: `${renderedPosition.y}%`,
              width: tokenDiameterCss,
              height: tokenDiameterCss,
              zIndex: isSelected ? 4 : 3,
              touchAction: "none",
              clipPath: "circle(50%)",
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectToken?.(token.number)

              if (enableTokenInspector && isInspectorPinned && inspectedTokenNumber !== token.number) {
                setInspectedTokenNumber(null)
                setIsInspectorPinned(false)
              }
            }}
            onDoubleClick={(event) => {
              if (!enableTokenInspector) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onSelectToken?.(token.number)
              openInspector(token.number, true)
            }}
            onPointerDown={handleTokenPointerDown(token)}
            onMouseEnter={() => {
              hoveredTokenNumberRef.current = token.number
              scheduleInspectorOpen(token.number)
            }}
            onMouseLeave={() => {
              if (hoveredTokenNumberRef.current === token.number) {
                hoveredTokenNumberRef.current = null
              }

              if (!enableTokenInspector) {
                return
              }

              if (dismissedTokenNumberRef.current === token.number) {
                dismissedTokenNumberRef.current = null
              }
              scheduleInspectorClose(token.number)
            }}
            onContextMenu={(event) => {
              if (!onRequestTokenDelete) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onSelectToken?.(token.number)
              closeInspector(true)
              onRequestTokenDelete(token.number)
            }}
            onWheel={(event) => {
              if (!interactive || !onResizeToken) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              const delta = event.deltaY < 0 ? 0.1 : -0.1
              onResizeToken(token.number, clampTokenSize(token.size + delta))
            }}
          >
            <div
              className="flex size-full items-center justify-center"
              style={{
                transform: "rotate(calc(var(--map-rotation-deg, 0deg) * -1))",
                transformOrigin: "center",
              }}
            >
              <span
                className={`relative flex size-full items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold shadow-lg ${
                  isDeadEnemy
                    ? "border-black/80 bg-black text-stone-100"
                    : isEnemy
                      ? "border-red-900/70 bg-red-700 text-red-50"
                      : "border-sky-900/70 bg-sky-700 text-sky-50"
                } ${isSelected ? "ring-4 ring-amber-200/90" : ""}`}
              >
                {tokenImage ? (
                  <>
                    <img
                      src={tokenImage}
                      alt={linkedCharacter?.nombre ?? token.nombre}
                      className="absolute inset-0 size-full object-cover"
                      draggable={false}
                    />
                    <span className="absolute inset-0 bg-black/10" aria-hidden="true" />
                    <span className="absolute bottom-0 right-0 z-10 flex min-w-5 items-center justify-center rounded-tl-md bg-black/70 px-1 text-[0.65rem] font-black leading-none text-white">
                      {token.number}
                    </span>
                  </>
                ) : (
                  token.number
                )}
              </span>
            </div>
          </button>
        )
      })}

      {enableTokenInspector && inspectedToken ? (
        <div
          className="pointer-events-auto absolute z-10 w-52 max-w-[calc(100%-1rem)] rounded-xl border border-stone-200/90 bg-white/95 p-2 pb-6 text-stone-900 shadow-2xl backdrop-blur relative"
          style={{
            left: `${clamp(
              (tokenPreviewPositions[inspectedToken.number]?.x ?? inspectedToken.x) +
                ((tokenPreviewPositions[inspectedToken.number]?.x ?? inspectedToken.x) > 72 ? -12 : 12),
              14,
              86,
            )}%`,
            top: `${clamp(
              (tokenPreviewPositions[inspectedToken.number]?.y ?? inspectedToken.y) +
                ((tokenPreviewPositions[inspectedToken.number]?.y ?? inspectedToken.y) < 20 ? 12 : -12),
              14,
              86,
            )}%`,
            transform: "translate(-50%, -50%) rotate(calc(var(--map-rotation-deg, 0deg) * -1))",
            transformOrigin: "center",
          }}
          data-battle-wheel-stop="true"
          onMouseEnter={() => {
            if (isInspectorPinned) {
              clearInspectorCloseTimeout()
            }
          }}
          onMouseLeave={() => {
            if (!isInspectorPinned) {
              scheduleInspectorClose(inspectedToken.number)
            }
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                #{inspectedToken.number}
              </p>
              {tokenInspectorEditable ? (
                <input
                  value={inspectedToken.nombre}
                  aria-label={`Nombre de la ficha ${inspectedToken.number}`}
                  className="mt-1 block h-7 w-full rounded-lg border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
                  placeholder="Nombre"
                  disabled={!tokenInspectorEditable}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onFocus={() => {
                    openInspector(inspectedToken.number, true)
                  }}
                  onChange={(event) => {
                    onUpdateTokenDetails?.(inspectedToken.number, { nombre: event.target.value })
                  }}
                />
              ) : (
                <p className="truncate text-[11px] font-semibold text-stone-900">
                  {inspectedToken.nombre || `Ficha ${inspectedToken.number}`}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="rounded-md bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">
                {inspectedToken.type === "enemy" ? "Enemigo" : "Jugador"}
              </span>
              <button
                type="button"
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                onPointerDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={() => {
                  closeInspector(true)
                }}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              inputMode="decimal"
              aria-label={`Iniciativa de la ficha ${inspectedToken.number}`}
              value={typeof inspectedToken.initiative === "number" ? String(inspectedToken.initiative) : ""}
              className="h-7 w-full rounded-lg border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
              placeholder="Ini"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onFocus={(event) => {
                openInspector(inspectedToken.number, true)
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
              className={`h-7 w-full rounded-lg px-2 text-[11px] font-medium outline-none transition ${
                inspectedToken.type === "enemy"
                  ? "border border-red-100 bg-red-50 text-red-700 focus:border-red-300"
                  : "border border-sky-100 bg-sky-50 text-sky-700 focus:border-sky-300"
              }`}
              placeholder="Vida"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onFocus={(event) => {
                openInspector(inspectedToken.number, true)
                event.currentTarget.select()
              }}
              onChange={(event) => {
                onUpdateTokenDetails?.(inspectedToken.number, {
                  life: parseNumberInput(event.target.value),
                })
              }}
              disabled={!tokenInspectorEditable}
            />
            <input
              aria-label={`Estado de la ficha ${inspectedToken.number}`}
              value={inspectedToken.status}
              className="col-span-2 h-7 w-full rounded-lg border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-900 outline-none transition focus:border-amber-500"
              placeholder="Estado"
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onFocus={() => {
                openInspector(inspectedToken.number, true)
              }}
              onChange={(event) => {
                onUpdateTokenDetails?.(inspectedToken.number, { status: event.target.value })
              }}
              disabled={!tokenInspectorEditable}
            />
          </div>

          <div className="absolute bottom-2 left-2 flex items-center justify-start">
            <span
              aria-hidden="true"
              className={`relative block size-3 rounded-full ${isInspectorPinned ? "border-2 border-black" : "border border-stone-300"}`}
              style={{
                background: isInspectorPinned
                  ? "conic-gradient(#111827 360deg, #111827 360deg)"
                  : `conic-gradient(#78716c ${Math.round(inspectorPinProgress * 360)}deg, #e7e5e4 0deg)`,
              }}
            >
              <span className="absolute inset-[2px] rounded-full bg-white/95" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
