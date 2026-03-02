import type { BattleState } from "@/lib/types"

export const BATTLE_SCREEN_STORAGE_KEY = "battle-screen-state"

type BattleScreenPayload = {
  revision: number
  state: BattleState
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parsePayload(raw: string | null): BattleScreenPayload | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isObjectRecord(parsed)) {
      return null
    }

    const revision = parsed.revision
    const state = parsed.state

    if (!isFiniteNumber(revision) || !isObjectRecord(state)) {
      return null
    }

    return {
      revision,
      state: state as BattleState,
    }
  } catch {
    return null
  }
}

export function readBattleScreenPayload() {
  if (typeof window === "undefined") {
    return null
  }

  return parsePayload(window.localStorage.getItem(BATTLE_SCREEN_STORAGE_KEY))
}

export function readBattleScreenState() {
  return readBattleScreenPayload()?.state ?? null
}

export function setBattleScreenState(state: BattleState) {
  if (typeof window === "undefined") {
    return
  }

  const payload: BattleScreenPayload = {
    revision: Date.now(),
    state,
  }

  window.localStorage.setItem(BATTLE_SCREEN_STORAGE_KEY, JSON.stringify(payload))
}
