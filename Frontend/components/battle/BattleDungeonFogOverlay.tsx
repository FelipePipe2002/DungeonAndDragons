"use client"

import type { DungeonVisibilityMap } from "@/lib/dungeons/visibility"

type BattleDungeonFogOverlayProps = {
  fogEnabled: boolean
  visibilityMap: DungeonVisibilityMap | null | undefined
  overlayOpacity?: number
  blocksPointerEvents?: boolean
}

export function BattleDungeonFogOverlay({
  fogEnabled,
  visibilityMap,
  overlayOpacity = 0.68,
  blocksPointerEvents = false,
}: BattleDungeonFogOverlayProps) {
  if (!fogEnabled || !visibilityMap) {
    return null
  }

  const { bounds } = visibilityMap
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null
  }

  const cellWidth = 100 / bounds.width
  const cellHeight = 100 / bounds.height
  const hiddenFill = `rgba(5, 5, 8, ${overlayOpacity})`
  const exploredFill = `rgba(5, 7, 12, ${Math.min(overlayOpacity, 0.5)})`
  const dimFill = `rgba(8, 10, 18, ${Math.min(overlayOpacity, 0.38)})`
  const hasVisibleCells = Array.from({ length: bounds.height }, (_, y) =>
    Array.from({ length: bounds.width }, (_, x) => visibilityMap.getTier({ x, y }))
      .some((tier) => tier === "bright" || tier === "dim" || tier === "explored"),
  ).some(Boolean)

  return (
    <div className={blocksPointerEvents ? "absolute inset-0 z-[35]" : "pointer-events-none absolute inset-0 z-[35]"} aria-hidden="true">
      <svg className="size-full" viewBox="0 0 100 100" preserveAspectRatio="none" shapeRendering="crispEdges">
        {!hasVisibleCells ? <rect x="0" y="0" width="100" height="100" fill={hiddenFill} /> : null}
        {Array.from({ length: bounds.height }, (_, y) =>
          Array.from({ length: bounds.width }, (_, x) => {
            if (!hasVisibleCells) {
              return null
            }

            const tier = visibilityMap.getTier({ x, y })
            if (tier === "bright") {
              return null
            }

            return (
              <rect
                key={`${x},${y}`}
                x={x * cellWidth}
                y={y * cellHeight}
                width={cellWidth + 0.04}
                height={cellHeight + 0.04}
                fill={tier === "dim" ? dimFill : tier === "explored" ? exploredFill : hiddenFill}
              />
            )
          }),
        )}
      </svg>
    </div>
  )
}
