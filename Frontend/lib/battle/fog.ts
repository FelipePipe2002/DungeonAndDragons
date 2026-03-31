import type { BattleFogReveal, BattleState, BattleToken } from "@/lib/types"

function isPointInsideReveal(x: number, y: number, reveal: BattleFogReveal) {
  const revealRight = reveal.x + reveal.width
  const revealBottom = reveal.y + reveal.height

  return x >= reveal.x && x <= revealRight && y >= reveal.y && y <= revealBottom
}

export function isBattleTokenVisibleThroughFog(
  battle: Pick<BattleState, "fogEnabled" | "fogReveals">,
  token: Pick<BattleToken, "type" | "x" | "y"> | null | undefined,
) {
  if (!token || token.type !== "enemy" || !battle.fogEnabled) {
    return true
  }

  return battle.fogReveals.some((reveal) => isPointInsideReveal(token.x, token.y, reveal))
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
