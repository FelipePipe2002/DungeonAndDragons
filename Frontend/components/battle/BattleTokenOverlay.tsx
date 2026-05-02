"use client"

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Accessibility, Bubbles, ChevronDown, Circle, EarOff, Eye, EyeOff, HatGlasses, Heart, Link2, Lock, Redo, Shell, Skull, Snowflake, Trash2, TriangleAlert, type LucideIcon } from "lucide-react"

import type { BattleConditionDefinition } from "@/lib/battle/conditions"
import type { BattleTokenFogVisibility } from "@/lib/battle/fog"
import { resolveBattleTokenImagePresentation } from "@/lib/battle/token-image"
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
  selectedTokenNumber?: number | null
  selectedObstacleId?: number | null
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
  onResizeObstacle?: (obstacleId: number, nextSize: { width: number; height: number }) => void
  onRemoveObstacle?: (obstacleId: number) => void
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
const CURRENT_TURN_TRAIL_STYLE = {
  inset: "-16%",
  boxShadow: "0 0 0 2px rgba(74, 222, 128, 0.8), 0 0 20px rgba(16, 185, 129, 0.55)",
}
const CURRENT_TURN_RIPPLE_STYLE = {
  inset: "-22%",
  boxShadow: "0 0 0 1px rgba(134, 239, 172, 0.65), 0 0 16px rgba(52, 211, 153, 0.4)",
}
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

function transformOverlayPosition(position: TokenPosition, verticalMirror: boolean): TokenPosition {
  return verticalMirror
    ? {
        x: 100 - position.x,
        y: 100 - position.y,
      }
    : position
}

function updatePreviewPositionMap(
  current: Record<number, TokenPosition>,
  id: number,
  nextPosition: TokenPosition | null,
) {
  const next = { ...current }

  if (nextPosition) {
    next[id] = nextPosition
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

type BattleObstacleItemProps = {
  obstacle: BattleObstacle
  renderedPosition: TokenPosition
  isSelected: boolean
  interactive: boolean
  onRemoveObstacle?: (obstacleId: number) => void
  onResizeObstacle?: (obstacleId: number, nextSize: { width: number; height: number }) => void
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
  const obstacleHeight = isCircle ? obstacle.width : obstacle.height

  return (
    <button
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
      onPointerDown={onPointerDown}
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
      {interactive && onResizeObstacle && isSelected
        ? isCircle ? (
            <span
              className="pointer-events-auto absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-800/70 bg-white/90 shadow"
              onPointerDown={onResizePointerDown("center")}
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
      className="pointer-events-auto absolute z-[5] flex items-center gap-1 rounded-full border border-stone-900/15 bg-white/95 px-1.5 py-1 shadow-xl backdrop-blur"
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
  fogVisibility: BattleTokenFogVisibility
  linkedCharacter: Character | null
  tokenStatusDefinition: BattleConditionDefinition | null
  renderedPosition: TokenPosition
  selectedTokenNumber: number | null
  currentTurnTokenNumber: number | null
  ghostHiddenTokens: boolean
  verticalMirror: boolean
  neutralPalette: boolean
  onClick: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void
  onWheel: (event: React.WheelEvent<HTMLButtonElement>) => void
}

function BattleTokenItem({
  token,
  fogVisibility,
  linkedCharacter,
  tokenStatusDefinition,
  renderedPosition,
  selectedTokenNumber,
  currentTurnTokenNumber,
  ghostHiddenTokens,
  verticalMirror,
  neutralPalette,
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
  const isFogDimmed = fogVisibility === "dim"
  const isCurrentTurn = !neutralPalette && !isHidden && currentTurnTokenNumber !== null && token.number === currentTurnTokenNumber
  const isGhosted = isHidden && ghostHiddenTokens
  const tokenImagePresentation = resolveBattleTokenImagePresentation({
    token,
    linkedCharacter,
    kind: "token",
  })
  const tokenImage = tokenImagePresentation.image
  const shouldShowTokenNumberBadge = !neutralPalette && (token.sourceType === "monster" || Boolean(tokenImage))
  const tokenImagePresentationStyle = tokenImagePresentation.style
  const renderedSize = clampTokenSize(token.size)
  const tokenDiameter = Math.round(44 * renderedSize)
  const tokenDiameterCss = `calc(${tokenDiameter}px * var(--map-image-scale, 1))`

  return (
    <button
      type="button"
      className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-transparent p-0 text-left ${isGhosted ? "opacity-25" : isFogDimmed ? "opacity-70" : ""}`}
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
        {isCurrentTurn ? (
          <>
            <span
              className="pointer-events-none absolute rounded-full"
              style={CURRENT_TURN_TRAIL_STYLE}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute rounded-full"
              style={CURRENT_TURN_RIPPLE_STYLE}
              aria-hidden="true"
            />
          </>
        ) : null}
        {tokenStatusDefinition ? (
          <span
            className="pointer-events-none absolute rounded-full"
            style={{
              inset: "0",
              boxShadow: `0 0 0 2px ${tokenStatusDefinition.color}, 0 0 12px ${withAlpha(tokenStatusDefinition.color, 0.65)}`,
            }}
            aria-hidden="true"
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
                  className="size-[0.9rem] drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
                  style={{ color: tokenStatusDefinition.color }}
                  aria-hidden="true"
                />
              </span>
            )
          })()
        ) : null}
        {tokenStatusDefinition && typeof token.statusDurationTurns === "number" && token.statusDurationTurns >= 0 ? (
          <span className="pointer-events-none absolute -bottom-1.5 right-0 z-30 rounded-full bg-stone-950/85 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
            {token.statusDurationTurns === 0 ? "INF" : `${token.statusDurationTurns}T`}
          </span>
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
          className={`relative flex size-full items-center justify-center overflow-hidden rounded-full text-sm font-bold ${isFogDimmed ? "brightness-75 saturate-50" : ""} ${
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
              <img
                src={tokenImage}
                alt={linkedCharacter?.nombre ?? token.nombre}
                className={`absolute inset-0 size-full object-cover ${isDefeated ? "grayscale brightness-75 saturate-0" : ""}`}
                style={tokenImagePresentationStyle}
                draggable={false}
              />
              <span className={`absolute inset-0 ${isDefeated ? "bg-stone-900/30" : "bg-black/10"}`} aria-hidden="true" />
            </>
          ) : (
            token.sourceType === "monster" ? "X" : token.number
          )}
          {isFogDimmed ? <span className="pointer-events-none absolute inset-0 bg-slate-950/35" aria-hidden="true" /> : null}
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
      className="pointer-events-auto absolute z-10 w-[min(23rem,calc(100vw-1rem))] max-w-[calc(100%-1rem)] max-h-[min(78dvh,34rem)] overflow-y-auto rounded-2xl border border-stone-200/90 bg-white/96 p-3 text-stone-900 shadow-2xl backdrop-blur relative"
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
  selectedTokenNumber = null,
  selectedObstacleId = null,
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
  const handleShortcutKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!interactive || shouldIgnoreShortcutTarget(event.target)) {
      return
    }

    const activeTokenNumber = hoveredTokenNumberRef.current ?? selectedTokenNumber
    if (!activeTokenNumber) {
      return
    }

    const token = tokenByNumber.get(activeTokenNumber)
    if (!token) {
      return
    }

    const normalizedKey = event.key.toLowerCase()
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
      return
    }

    if (!event.shiftKey && normalizedKey === "s") {
      event.preventDefault()
      onRequestToggleTokenType?.(token.number)
      return
    }

    if (!event.shiftKey) {
      return
    }

    if (normalizedKey === "h") {
      event.preventDefault()
      onUpdateTokenDetails?.(token.number, { hidden: !token.hidden })
      return
    }

    if (normalizedKey === "d") {
      event.preventDefault()
      onRequestTokenDuplicate?.(token.number)
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
      pendingTokenPreviewRef.current = null
      pendingObstaclePreviewRef.current = null
    })
  }

  const schedulePreviewUpdate = (
    kind: "token" | "obstacle",
    id: number,
    nextPosition: TokenPosition | null,
  ) => {
    if (kind === "token") {
      pendingTokenPreviewRef.current = updatePreviewPositionMap(
        pendingTokenPreviewRef.current ?? tokenPreviewPositions,
        id,
        nextPosition,
      )
    } else {
      pendingObstaclePreviewRef.current = updatePreviewPositionMap(
        pendingObstaclePreviewRef.current ?? obstaclePreviewPositions,
        id,
        nextPosition,
      )
    }

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
    const logicalPointerPosition = transformPosition(pointerPosition)

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
      schedulePreviewUpdate("token", dragState.tokenNumber, nextPosition)
      schedulePreviewBroadcast("token", dragState.tokenNumber, transformPosition(nextPosition))
      return
    }

    if (dragState.kind === "obstacle-resize") {
      if (!onResizeObstacle) {
        return
      }

      const clampSize = (value: number) => clamp(value, 0, 100)

      if (dragState.resizeHandle === "center" || dragState.obstacle.shape === "circle") {
        const nextWidth = clampSize(Math.abs(logicalPointerPosition.x - dragState.obstacle.x) * 2)
        const nextHeight =
          dragState.obstacle.shape === "circle"
            ? nextWidth
            : clampSize(Math.abs(logicalPointerPosition.y - dragState.obstacle.y) * 2)

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
    const renderedPosition = obstaclePreviewPositions[obstacle.id] ?? transformPosition({ x: obstacle.x, y: obstacle.y })

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
      {orderedTokens.map((token) => {
        const linkedCharacter =
          typeof token.characterId === "number" ? (characterById?.get(token.characterId) ?? null) : null
        const tokenStatusDefinition = resolveTokenStatusDefinition(token.status, statusDefinitionByName)
        const renderedPosition = tokenPreviewPositions[token.number] ?? transformPosition({ x: token.x, y: token.y })
        const fogVisibility = resolveTokenFogVisibility(tokenFogVisibilityByNumber, token.number)

        return (
          <BattleTokenItem
            key={`token-${token.number}`}
            token={token}
            fogVisibility={fogVisibility}
            linkedCharacter={linkedCharacter}
            tokenStatusDefinition={tokenStatusDefinition}
            renderedPosition={renderedPosition}
            selectedTokenNumber={selectedTokenNumber}
            currentTurnTokenNumber={currentTurnTokenNumber}
            ghostHiddenTokens={ghostHiddenTokens}
            verticalMirror={verticalMirror}
            neutralPalette={neutralPalette}
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

              event.preventDefault()
              event.stopPropagation()
              const delta = event.deltaY < 0 ? 0.1 : -0.1
              onResizeToken(token.number, clampTokenSize(token.size + delta))
            }}
          />
        )
      })}

      {orderedObstacles.map((obstacle) => (
        <BattleObstacleItem
          key={`obstacle-${obstacle.id}`}
          obstacle={obstacle}
          renderedPosition={obstaclePreviewPositions[obstacle.id] ?? transformPosition({ x: obstacle.x, y: obstacle.y })}
          isSelected={obstacle.id === selectedObstacleId}
          interactive={interactive}
          onRemoveObstacle={onRemoveObstacle}
          onResizeObstacle={onResizeObstacle}
          onSelectObstacle={onSelectObstacle}
          onPointerDown={handleObstaclePointerDown(obstacle)}
          onResizePointerDown={(handle) => handleObstacleResizePointerDown(obstacle, handle)}
        />
      ))}

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
