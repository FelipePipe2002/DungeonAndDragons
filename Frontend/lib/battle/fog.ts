import type { BattleFogReveal, BattleState, BattleToken } from "@/lib/types"
import {
  calculateDungeonVisibility,
  type DungeonVisibilityBounds,
  type DungeonVisibilityMap,
} from "@/lib/dungeons/visibility"
import type { DungeonMapPoint, NormalizedDungeonLightSource } from "@/lib/dungeons/types"

export type BattleTokenFogVisibility = "hidden" | "dim" | "visible"

type BattleDungeonFogVisibilityInput = {
  dungeonFog: Pick<BattleState["dungeonFog"], "enabled" | "exploredCellKeys" | "playerVisionBrightRadiusCells" | "playerVisionDimRadiusCells">
  bounds: DungeonVisibilityBounds
  dungeonLights?: NormalizedDungeonLightSource[]
  playerTokenCells?: DungeonMapPoint[]
}

type BattleTokenFogVisibilityInput = {
  battle: Pick<BattleState, "fogEnabled" | "fogReveals">
  token: Pick<BattleToken, "type" | "x" | "y"> | null | undefined
  dungeonVisibility?: DungeonVisibilityMap | null
  tokenCell?: DungeonMapPoint | null
}

function isPointInsideReveal(x: number, y: number, reveal: BattleFogReveal) {
  const revealRight = reveal.x + reveal.width
  const revealBottom = reveal.y + reveal.height

  return x >= reveal.x && x <= revealRight && y >= reveal.y && y <= revealBottom
}

export function isBattleTokenVisibleThroughFog(
  battle: Pick<BattleState, "fogEnabled" | "fogReveals">,
  token: Pick<BattleToken, "type" | "x" | "y"> | null | undefined,
) {
  return getBattleTokenFogVisibility({ battle, token }) !== "hidden"
}

export function isBattleTokenNumberVisibleThroughFog(
  battle: Pick<BattleState, "fogEnabled" | "fogReveals" | "tokens">,
  tokenNumber: number | null | undefined,
) {
  if (typeof tokenNumber !== "number" || !Number.isFinite(tokenNumber)) {
    return true
  }

  return isBattleTokenVisibleThroughFog(
    battle,
    battle.tokens.find((candidate) => candidate.number === tokenNumber),
  )
}

export function getBattleTokenFogVisibility({
  battle,
  token,
  dungeonVisibility,
  tokenCell,
}: BattleTokenFogVisibilityInput): BattleTokenFogVisibility {
  if (!token || token.type !== "enemy") {
    return "visible"
  }

  if (dungeonVisibility && tokenCell) {
    const dungeonTier = dungeonVisibility.getTier(tokenCell)
    if (dungeonTier === "bright") return "visible"
    if (dungeonTier === "dim") return "dim"
    return "hidden"
  }

  if (!battle.fogEnabled) {
    return "visible"
  }

  return battle.fogReveals.some((reveal) => isPointInsideReveal(token.x, token.y, reveal)) ? "visible" : "hidden"
}

export function getBattleTokenNumberFogVisibility(
  battle: Pick<BattleState, "fogEnabled" | "fogReveals" | "tokens">,
  tokenNumber: number | null | undefined,
  options: Pick<BattleTokenFogVisibilityInput, "dungeonVisibility" | "tokenCell"> = {},
): BattleTokenFogVisibility {
  if (typeof tokenNumber !== "number" || !Number.isFinite(tokenNumber)) {
    return "visible"
  }

  return getBattleTokenFogVisibility({
    battle,
    token: battle.tokens.find((candidate) => candidate.number === tokenNumber),
    ...options,
  })
}

export function calculateBattleDungeonFogVisibility({
  dungeonFog,
  bounds,
  dungeonLights = [],
  playerTokenCells = [],
}: BattleDungeonFogVisibilityInput): DungeonVisibilityMap {
  if (!dungeonFog.enabled) {
    return calculateDungeonVisibility({ bounds })
  }

  const playerVisionBrightRadiusCells = dungeonFog.playerVisionBrightRadiusCells ?? 4
  const playerVisionDimRadiusCells = Math.max(dungeonFog.playerVisionDimRadiusCells ?? 8, playerVisionBrightRadiusCells)
  const playerVisionLights: NormalizedDungeonLightSource[] = playerTokenCells.map((point, index) => ({
    id: `player-vision-${index + 1}`,
    x: point.x,
    y: point.y,
    kind: "ambient",
    label: null,
    enabled: true,
    brightRadiusCells: playerVisionBrightRadiusCells,
    dimRadiusCells: playerVisionDimRadiusCells,
    mode: "radius",
    placement: null,
    wallMounted: false,
    orientation: "south",
  }))

  return calculateDungeonVisibility({
    bounds,
    lights: [...dungeonLights, ...playerVisionLights],
    exploredCellKeys: dungeonFog.exploredCellKeys,
  })
}
