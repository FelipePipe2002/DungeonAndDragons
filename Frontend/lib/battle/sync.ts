import type { BattleState } from "@/lib/types"

export const BATTLE_SCREEN_STORAGE_KEY = "battle-screen-state"
const BATTLE_SCREEN_CHANNEL_NAME = "battle-screen-sync"

type BattleScreenPayload = {
  revision: number
  battle: BattleState | null
}

export type BattleTokenPreview = {
  battleId: number
  landmarkSlug: string
  tokenNumber: number
  position: {
    x: number
    y: number
  } | null
}

export type BattleObstaclePreview = {
  battleId: number
  landmarkSlug: string
  obstacleId: number
  position: {
    x: number
    y: number
  } | null
}

export type BattleTurnUpdate = {
  battleId: number
  landmarkSlug: string
  currentTurnTokenNumber: number | null
}

export type BattleScreenEvent =
  | {
      type: "battle-state"
      payload: BattleScreenPayload
    }
  | {
      type: "battle-turn"
      update: BattleTurnUpdate
    }
  | {
      type: "token-preview"
      preview: BattleTokenPreview
    }
  | {
      type: "obstacle-preview"
      preview: BattleObstaclePreview
    }

let battleScreenChannel: BroadcastChannel | null = null

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isTokenPosition(value: unknown): value is { x: number; y: number } {
  if (!isObjectRecord(value)) {
    return false
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isBattleTokenPreview(value: unknown): value is BattleTokenPreview {
  if (!isObjectRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.battleId) &&
    typeof value.landmarkSlug === "string" &&
    isFiniteNumber(value.tokenNumber) &&
    (value.position === null || isTokenPosition(value.position))
  )
}

function isBattleObstaclePreview(value: unknown): value is BattleObstaclePreview {
  if (!isObjectRecord(value)) {
    return false
  }

  return (
    isFiniteNumber(value.battleId) &&
    typeof value.landmarkSlug === "string" &&
    isFiniteNumber(value.obstacleId) &&
    (value.position === null || isTokenPosition(value.position))
  )
}

function getBattleScreenChannel() {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined") {
    return null
  }

  if (!battleScreenChannel) {
    battleScreenChannel = new window.BroadcastChannel(BATTLE_SCREEN_CHANNEL_NAME)
  }

  return battleScreenChannel
}

function postBattleScreenEvent(event: BattleScreenEvent) {
  const channel = getBattleScreenChannel()
  if (!channel) {
    return false
  }

  channel.postMessage(event)
  return true
}

function parseBattleScreenEvent(raw: unknown): BattleScreenEvent | null {
  if (!isObjectRecord(raw) || typeof raw.type !== "string") {
    return null
  }

  if (raw.type === "battle-state") {
    if (!("payload" in raw) || !isObjectRecord(raw.payload)) {
      return null
    }

    const payload = raw.payload as Record<string, unknown>
    if (!isFiniteNumber(payload.revision)) {
      return null
    }

    return {
      type: "battle-state",
      payload: {
        revision: payload.revision,
        battle: payload.battle && isObjectRecord(payload.battle) ? (payload.battle as BattleState) : null,
      },
    }
  }

  if (raw.type === "battle-turn" && "update" in raw && isObjectRecord(raw.update)) {
    const update = raw.update as Record<string, unknown>
    if (
      isFiniteNumber(update.battleId) &&
      typeof update.landmarkSlug === "string" &&
      (update.currentTurnTokenNumber === null || isFiniteNumber(update.currentTurnTokenNumber))
    ) {
      return {
        type: "battle-turn",
        update: {
          battleId: update.battleId,
          landmarkSlug: update.landmarkSlug,
          currentTurnTokenNumber: update.currentTurnTokenNumber ?? null,
        },
      }
    }

    return null
  }

  if (raw.type === "token-preview" && "preview" in raw && isBattleTokenPreview(raw.preview)) {
    return {
      type: "token-preview",
      preview: raw.preview,
    }
  }

  if (raw.type === "obstacle-preview" && "preview" in raw && isBattleObstaclePreview(raw.preview)) {
    return {
      type: "obstacle-preview",
      preview: raw.preview,
    }
  }

  return null
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
    const battle =
      "battle" in parsed
        ? (parsed.battle as BattleState | null)
        : "state" in parsed
          ? ((parsed.state as BattleState | null) ?? null)
          : null

    if (!isFiniteNumber(revision)) {
      return null
    }

    return {
      revision,
      battle: battle && isObjectRecord(battle) ? (battle as BattleState) : null,
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
  return readBattleScreenPayload()?.battle ?? null
}

export function subscribeToBattleScreenEvents(onEvent: (event: BattleScreenEvent) => void) {
  const channel = getBattleScreenChannel()
  if (!channel) {
    return () => {}
  }

  const handleMessage = (event: MessageEvent) => {
    const parsed = parseBattleScreenEvent(event.data)
    if (!parsed) {
      return
    }

    onEvent(parsed)
  }

  channel.addEventListener("message", handleMessage)
  return () => {
    channel.removeEventListener("message", handleMessage)
  }
}

export function broadcastBattleTokenPreview(preview: BattleTokenPreview) {
  postBattleScreenEvent({
    type: "token-preview",
    preview,
  })
}

export function broadcastBattleObstaclePreview(preview: BattleObstaclePreview) {
  postBattleScreenEvent({
    type: "obstacle-preview",
    preview,
  })
}

export function broadcastBattleTurn(update: BattleTurnUpdate) {
  return postBattleScreenEvent({
    type: "battle-turn",
    update,
  })
}

export function setBattleScreenState(battle: BattleState | null) {
  if (typeof window === "undefined") {
    return
  }

  const payload: BattleScreenPayload = {
    revision: Date.now(),
    battle,
  }

  window.localStorage.setItem(BATTLE_SCREEN_STORAGE_KEY, JSON.stringify(payload))
  postBattleScreenEvent({
    type: "battle-state",
    payload,
  })
}
