"use client"

import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { cn } from "@/lib/utils"
import type { BattleFogReveal } from "@/lib/types"

type FogEditorMode = "idle" | "reveal" | "erase"

type FogRevealDraft = {
  x: number
  y: number
  width: number
  height: number
}

type BattleFogOverlayProps = {
  fogEnabled: boolean
  fogReveals?: BattleFogReveal[]
  verticalMirror?: boolean
  interactive?: boolean
  editorMode?: FogEditorMode
  className?: string
  overlayOpacity?: number
  overlayVisible?: boolean
  interactionPaddingPx?: number
  onCreateReveal?: (reveal: FogRevealDraft) => void
  onCoverArea?: (reveal: FogRevealDraft) => void
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
}

type GridSnapConfig = {
  cellSize: number
  offsetX: number
  offsetY: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toDisplayY(y: number, height: number, verticalMirror: boolean) {
  return verticalMirror ? 100 - y - height : y
}

function readGridSnapConfig(element: HTMLDivElement): GridSnapConfig | null {
  const computedStyle = window.getComputedStyle(element)
  const cellSize = Number.parseFloat(computedStyle.getPropertyValue("--battle-grid-cell-size"))
  const offsetX = Number.parseFloat(computedStyle.getPropertyValue("--battle-grid-offset-x"))
  const offsetY = Number.parseFloat(computedStyle.getPropertyValue("--battle-grid-offset-y"))

  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return null
  }

  return {
    cellSize,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0,
  }
}

function snapToGridCorner(value: number, cellSize: number, offset: number, max: number) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return clamp(value, 0, max)
  }

  const snapped = offset + Math.round((value - offset) / cellSize) * cellSize
  return clamp(snapped, 0, max)
}

function toCanonicalPoint(
  event: ReactPointerEvent<HTMLDivElement>,
  boundsSource: HTMLDivElement | null,
  verticalMirror: boolean,
  snapToGrid: boolean,
): { x: number; y: number } | null {
  const bounds = boundsSource?.getBoundingClientRect() ?? null
  const localWidth = boundsSource?.offsetWidth ?? 0
  const localHeight = boundsSource?.offsetHeight ?? 0

  if (!bounds || bounds.width <= 0 || bounds.height <= 0 || localWidth <= 0 || localHeight <= 0) {
    return null
  }

  const relativeX = (event.clientX - bounds.left) / bounds.width
  const relativeY = (event.clientY - bounds.top) / bounds.height
  const unclampedLocalX = relativeX * localWidth
  const unclampedLocalY = relativeY * localHeight
  const maxLocalX = Math.max(0, localWidth)
  const maxLocalY = Math.max(0, localHeight)
  let localX = clamp(unclampedLocalX, 0, maxLocalX)
  let localY = clamp(unclampedLocalY, 0, maxLocalY)

  if (snapToGrid) {
    const snapConfig = readGridSnapConfig(event.currentTarget)
    if (snapConfig) {
      localX = snapToGridCorner(localX, snapConfig.cellSize, snapConfig.offsetX, maxLocalX)
      localY = snapToGridCorner(localY, snapConfig.cellSize, snapConfig.offsetY, maxLocalY)
    }
  }

  const displayX = clamp((localX / localWidth) * 100, 0, 100)
  const displayY = clamp((localY / localHeight) * 100, 0, 100)

  return {
    x: Math.round(displayX * 100) / 100,
    y: Math.round((verticalMirror ? 100 - displayY : displayY) * 100) / 100,
  }
}

function buildRevealFromPoints(start: { x: number; y: number }, end: { x: number; y: number }): FogRevealDraft {
  const rawX = Math.min(start.x, end.x)
  const rawY = Math.min(start.y, end.y)
  const rawWidth = Math.abs(end.x - start.x)
  const rawHeight = Math.abs(end.y - start.y)
  const width = Math.round(clamp(rawWidth, 0, 100) * 100) / 100
  const height = Math.round(clamp(rawHeight, 0, 100) * 100) / 100

  return {
    x: Math.round(clamp(rawX, 0, 100 - width) * 100) / 100,
    y: Math.round(clamp(rawY, 0, 100 - height) * 100) / 100,
    width,
    height,
  }
}

export function BattleFogOverlay({
  fogEnabled,
  fogReveals = [],
  verticalMirror = false,
  interactive = false,
  editorMode = "idle",
  className,
  overlayOpacity = 1,
  overlayVisible = true,
  interactionPaddingPx = 56,
  onCreateReveal,
  onCoverArea,
}: BattleFogOverlayProps) {
  const reactMaskId = useId()
  const maskId = useMemo(() => `battle-fog-${reactMaskId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactMaskId])
  const rootRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [draftReveal, setDraftReveal] = useState<FogRevealDraft | null>(null)

  const visibleReveals = useMemo(
    () =>
      fogReveals.map((reveal) => ({
        ...reveal,
        displayY: toDisplayY(reveal.y, reveal.height, verticalMirror),
      })),
    [fogReveals, verticalMirror],
  )

  if (!fogEnabled && !interactive) {
    return null
  }

  return (
    <div ref={rootRef} className={cn("pointer-events-none absolute inset-0 z-[35]", className)}>
      {overlayVisible && fogEnabled ? (
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100" height="100" fill="#fff" />
              {visibleReveals.map((reveal) => (
                <rect
                  key={`fog-mask-${reveal.id}`}
                  x={reveal.x}
                  y={reveal.displayY}
                  width={reveal.width}
                  height={reveal.height}
                  fill="#000"
                />
              ))}
              {draftReveal && editorMode === "reveal" ? (
                <rect
                  x={draftReveal.x}
                  y={toDisplayY(draftReveal.y, draftReveal.height, verticalMirror)}
                  width={draftReveal.width}
                  height={draftReveal.height}
                  fill="#000"
                />
              ) : null}
            </mask>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill={`rgba(5,5,5,${overlayOpacity})`} mask={`url(#${maskId})`} />
        </svg>
      ) : null}

      {overlayVisible && draftReveal && editorMode === "erase" ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute border border-white/20"
            style={{
              left: `${draftReveal.x}%`,
              top: `${toDisplayY(draftReveal.y, draftReveal.height, verticalMirror)}%`,
              width: `${draftReveal.width}%`,
              height: `${draftReveal.height}%`,
              backgroundColor: `rgba(5,5,5,${overlayOpacity})`,
            }}
          />
        </div>
      ) : null}

      {!overlayVisible && draftReveal && editorMode !== "idle" ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute border border-amber-300/80 bg-amber-200/10 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
            style={{
              left: `${draftReveal.x}%`,
              top: `${toDisplayY(draftReveal.y, draftReveal.height, verticalMirror)}%`,
              width: `${draftReveal.width}%`,
              height: `${draftReveal.height}%`,
            }}
          />
        </div>
      ) : null}

      {interactive ? (
        <div
          className={cn(
            "pointer-events-auto absolute inset-0",
            editorMode === "idle" ? "cursor-default" : "cursor-crosshair",
          )}
          style={{
            inset: `${-interactionPaddingPx}px`,
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return
            }

            if (editorMode === "idle") {
              event.preventDefault()
              event.stopPropagation()
              return
            }

            const point = toCanonicalPoint(event, rootRef.current, verticalMirror, event.altKey)
            if (!point) {
              return
            }

            dragStateRef.current = {
              pointerId: event.pointerId,
              startX: point.x,
              startY: point.y,
            }
            setDraftReveal({
              x: point.x,
              y: point.y,
              width: 0,
              height: 0,
            })
            event.currentTarget.setPointerCapture(event.pointerId)
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerMove={(event) => {
            const dragState = dragStateRef.current
            if (!dragState || dragState.pointerId !== event.pointerId) {
              return
            }

            const point = toCanonicalPoint(event, rootRef.current, verticalMirror, event.altKey)
            if (!point) {
              return
            }

            setDraftReveal(buildRevealFromPoints({ x: dragState.startX, y: dragState.startY }, point))
            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerUp={(event) => {
            const dragState = dragStateRef.current
            if (!dragState || dragState.pointerId !== event.pointerId) {
              return
            }

            const point = toCanonicalPoint(event, rootRef.current, verticalMirror, event.altKey)
            const nextDraft = point ? buildRevealFromPoints({ x: dragState.startX, y: dragState.startY }, point) : null

            dragStateRef.current = null
            setDraftReveal(null)
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }

            if (nextDraft && nextDraft.width >= 1 && nextDraft.height >= 1) {
              if (editorMode === "reveal") {
                onCreateReveal?.(nextDraft)
              } else if (editorMode === "erase") {
                onCoverArea?.(nextDraft)
              }
            }

            event.preventDefault()
            event.stopPropagation()
          }}
          onPointerCancel={(event) => {
            const dragState = dragStateRef.current
            if (!dragState || dragState.pointerId !== event.pointerId) {
              return
            }

            dragStateRef.current = null
            setDraftReveal(null)
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
            event.preventDefault()
            event.stopPropagation()
          }}
        />
      ) : null}
    </div>
  )
}
