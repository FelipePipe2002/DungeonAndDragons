"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import type { BattleObstacle, BattleToken } from "@/lib/types"

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
      tokenNumber: number
      lastPosition: TokenPosition
      pointerOffset: TokenPosition
      metrics: TransformMetrics
    }
  | {
      kind: "obstacle"
      pointerId: number
      obstacleId: number
      lastPosition: TokenPosition
      pointerOffset: TokenPosition
      metrics: TransformMetrics
    }

type BattleTokenOverlayProps = {
  tokens: BattleToken[]
  obstacles?: BattleObstacle[]
  interactive?: boolean
  selectedTokenNumber?: number | null
  selectedObstacleId?: number | null
  onSelectToken?: (tokenNumber: number) => void
  onMoveToken?: (tokenNumber: number, nextPosition: TokenPosition) => void
  onResizeToken?: (tokenNumber: number, nextSize: number) => void
  onSelectObstacle?: (obstacleId: number) => void
  onMoveObstacle?: (obstacleId: number, nextPosition: TokenPosition) => void
  onResizeObstacle?: (obstacleId: number, nextSize: { width: number; height: number }) => void
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

export function BattleTokenOverlay({
  tokens,
  obstacles = [],
  interactive = false,
  selectedTokenNumber = null,
  selectedObstacleId = null,
  onSelectToken,
  onMoveToken,
  onResizeToken,
  onSelectObstacle,
  onMoveObstacle,
  onResizeObstacle,
}: BattleTokenOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)
  const pendingTokenPreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const pendingObstaclePreviewRef = useRef<Record<number, TokenPosition> | null>(null)
  const [tokenPreviewPositions, setTokenPreviewPositions] = useState<Record<number, TokenPosition>>({})
  const [obstaclePreviewPositions, setObstaclePreviewPositions] = useState<Record<number, TokenPosition>>({})

  const orderedTokens = useMemo(
    () =>
      [...tokens].sort((left, right) => {
        if (left.number === selectedTokenNumber) return 1
        if (right.number === selectedTokenNumber) return -1
        return left.number - right.number
      }),
    [selectedTokenNumber, tokens],
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
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

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

  const handleTokenPointerDown = (token: BattleToken) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectToken?.(token.number)

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
    const renderedPosition = tokenPreviewPositions[token.number] ?? { x: token.x, y: token.y }

    dragRef.current = {
      kind: "token",
      pointerId: event.pointerId,
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

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const pointerPosition = screenPointToLocalPosition(event.clientX, event.clientY, dragState.metrics)
    const nextPosition = {
      x: clamp(pointerPosition.x + dragState.pointerOffset.x, 0, 100),
      y: clamp(pointerPosition.y + dragState.pointerOffset.y, 0, 100),
    }

    if (dragState.kind === "token") {
      dragRef.current = {
        ...dragState,
        lastPosition: nextPosition,
      }
      scheduleTokenPreviewUpdate(dragState.tokenNumber, nextPosition)
      return
    }

    dragRef.current = {
      ...dragState,
      lastPosition: nextPosition,
    }
    scheduleObstaclePreviewUpdate(dragState.obstacleId, nextPosition)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (dragState.kind === "token") {
      onMoveToken?.(dragState.tokenNumber, dragState.lastPosition)
      scheduleTokenPreviewUpdate(dragState.tokenNumber, null)
    } else {
      onMoveObstacle?.(dragState.obstacleId, dragState.lastPosition)
      scheduleObstaclePreviewUpdate(dragState.obstacleId, null)
    }

    dragRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div ref={overlayRef} className="pointer-events-none relative size-full">
      {orderedObstacles.map((obstacle) => {
        const renderedPosition = obstaclePreviewPositions[obstacle.id] ?? { x: obstacle.x, y: obstacle.y }
        const isSelected = obstacle.id === selectedObstacleId

        return (
          <button
            key={`obstacle-${obstacle.id}`}
            type="button"
            className="pointer-events-auto absolute bg-transparent p-0"
            data-battle-wheel-stop="true"
            style={{
              left: `${renderedPosition.x}%`,
              top: `${renderedPosition.y}%`,
              width: `${obstacle.width}%`,
              height: `${obstacle.height}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 2 : 1,
              touchAction: "none",
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectObstacle?.(obstacle.id)
            }}
            onPointerDown={handleObstaclePointerDown(obstacle)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={(event) => {
              if (!interactive || !onResizeObstacle) {
                return
              }

              event.preventDefault()
              event.stopPropagation()

              const delta = event.deltaY < 0 ? 1 : -1
              const nextWidth = clamp(obstacle.width + delta, 1, 100)
              const nextHeight = clamp(obstacle.height + delta, 1, 100)

              onResizeObstacle(obstacle.id, {
                width: nextWidth,
                height: obstacle.shape === "circle" ? nextWidth : nextHeight,
              })
            }}
          >
            <span
              className="block size-full border-2 shadow-lg"
              style={{
                borderRadius: obstacle.shape === "circle" ? "9999px" : "0",
                borderColor: obstacle.color,
                backgroundColor: withAlpha(obstacle.color, 0.32),
                boxShadow: isSelected
                  ? `0 0 0 4px ${withAlpha("#fcd34d", 0.7)}`
                  : `0 0 0 1px ${withAlpha(obstacle.color, 0.15)}`,
              }}
            />
          </button>
        )
      })}

      {orderedTokens.map((token) => {
        const isSelected = token.number === selectedTokenNumber
        const isEnemy = token.type === "enemy"
        const isDeadEnemy = isEnemy && (token.life ?? 1) <= 0
        const renderedPosition = tokenPreviewPositions[token.number] ?? { x: token.x, y: token.y }
        const renderedSize = clampTokenSize(token.size)

        return (
          <button
            key={`token-${token.number}`}
            type="button"
            className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 bg-transparent p-0 text-left"
            data-battle-wheel-stop="true"
            style={{
              left: `${renderedPosition.x}%`,
              top: `${renderedPosition.y}%`,
              zIndex: isSelected ? 4 : 3,
              touchAction: "none",
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectToken?.(token.number)
            }}
            onPointerDown={handleTokenPointerDown(token)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
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
              className="flex flex-col items-center gap-1"
              style={{
                transform: `rotate(calc(var(--map-rotation-deg, 0deg) * -1)) scale(${renderedSize})`,
                transformOrigin: "center",
              }}
            >
              <span
                className={`flex size-11 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg transition-transform ${
                  isDeadEnemy
                    ? "border-black/80 bg-black text-stone-100"
                    : isEnemy
                      ? "border-red-900/70 bg-red-700 text-red-50"
                      : "border-sky-900/70 bg-sky-700 text-sky-50"
                } ${isSelected ? "scale-110 ring-4 ring-amber-200/90" : ""}`}
              >
                {token.number}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
