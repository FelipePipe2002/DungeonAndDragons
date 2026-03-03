import type { BattleToken } from "@/lib/types"

function compareInitiative(left: BattleToken, right: BattleToken) {
  const leftInitiative = typeof left.initiative === "number" ? left.initiative : Number.NEGATIVE_INFINITY
  const rightInitiative = typeof right.initiative === "number" ? right.initiative : Number.NEGATIVE_INFINITY

  if (leftInitiative !== rightInitiative) {
    return rightInitiative - leftInitiative
  }

  return left.number - right.number
}

export function isTokenEligibleForInitiative(token: BattleToken) {
  if (token.hidden) {
    return false
  }

  if (token.type === "enemy" && (typeof token.life !== "number" || token.life <= 0)) {
    return false
  }

  return true
}

export function getOrderedInitiativeTokens(tokens: BattleToken[]) {
  return tokens.filter(isTokenEligibleForInitiative).sort(compareInitiative)
}

export function normalizeCurrentTurnTokenNumber(
  tokens: BattleToken[],
  currentTurnTokenNumber?: number | null,
) {
  const orderedTokens = getOrderedInitiativeTokens(tokens)
  if (orderedTokens.length === 0) {
    return null
  }

  if (
    typeof currentTurnTokenNumber === "number" &&
    orderedTokens.some((token) => token.number === currentTurnTokenNumber)
  ) {
    return currentTurnTokenNumber
  }

  return orderedTokens[0]?.number ?? null
}

export function getNextTurnTokenNumber(tokens: BattleToken[], currentTurnTokenNumber?: number | null) {
  const orderedTokens = getOrderedInitiativeTokens(tokens)
  if (orderedTokens.length === 0) {
    return null
  }

  const normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(tokens, currentTurnTokenNumber)
  const currentIndex = orderedTokens.findIndex((token) => token.number === normalizedCurrentTurnTokenNumber)
  if (currentIndex < 0) {
    return orderedTokens[0]?.number ?? null
  }

  return orderedTokens[(currentIndex + 1) % orderedTokens.length]?.number ?? null
}

export function buildInitiativeWindow(
  tokens: BattleToken[],
  currentTurnTokenNumber: number | null,
  visibleSlots: number,
) {
  const orderedTokens = getOrderedInitiativeTokens(tokens)
  if (orderedTokens.length <= visibleSlots) {
    return orderedTokens
  }

  const normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(orderedTokens, currentTurnTokenNumber)
  const currentIndex = orderedTokens.findIndex((token) => token.number === normalizedCurrentTurnTokenNumber)
  const centerOffset = Math.floor(visibleSlots / 2)

  return Array.from({ length: visibleSlots }, (_, index) => {
    const wrappedIndex = (currentIndex - centerOffset + index + orderedTokens.length) % orderedTokens.length
    return orderedTokens[wrappedIndex]
  })
}
