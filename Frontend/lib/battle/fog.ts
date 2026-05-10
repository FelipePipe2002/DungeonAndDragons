import type { BattleFogReveal, BattleState, BattleToken } from "@/lib/types"

export type BattleTokenFogVisibility = "hidden" | "visible"

type BattleTokenFogVisibilityInput = {
  battle: Pick<BattleState, "fogEnabled" | "fogReveals">
  token: Pick<BattleToken, "type" | "x" | "y"> | null | undefined
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
}: BattleTokenFogVisibilityInput): BattleTokenFogVisibility {
  if (!token || token.type !== "enemy") {
    return "visible"
  }

  if (!battle.fogEnabled) {
    return "visible"
  }

  return battle.fogReveals.some((reveal) => isPointInsideReveal(token.x, token.y, reveal)) ? "visible" : "hidden"
}

export function getBattleTokenNumberFogVisibility(
  battle: Pick<BattleState, "fogEnabled" | "fogReveals" | "tokens">,
  tokenNumber: number | null | undefined,
): BattleTokenFogVisibility {
  if (typeof tokenNumber !== "number" || !Number.isFinite(tokenNumber)) {
    return "visible"
  }

  return getBattleTokenFogVisibility({
    battle,
    token: battle.tokens.find((candidate) => candidate.number === tokenNumber),
  })
}
