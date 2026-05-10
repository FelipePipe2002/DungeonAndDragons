import type { BattlePropPlacementDefinition } from "@/components/battle/BattleTokenOverlay"

const BATTLE_PROP_LIBRARY_STORAGE_KEY = "dnd-battle-prop-library-v1"

export type BattlePropLibraryItem = BattlePropPlacementDefinition & {
  id: string
}

export function createBattlePropLibraryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `prop-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function readBattlePropLibrary(): BattlePropLibraryItem[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(BATTLE_PROP_LIBRARY_STORAGE_KEY)
    const parsed = rawValue ? JSON.parse(rawValue) : []
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item): BattlePropLibraryItem | null => {
        if (!item || typeof item !== "object") {
          return null
        }

        const raw = item as Record<string, unknown>
        const name = typeof raw.name === "string" ? raw.name.trim() : ""
        const image = typeof raw.image === "string" ? raw.image.trim() : ""
        if (!name || !image) {
          return null
        }

        return {
          id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createBattlePropLibraryId(),
          name,
          image,
          imageAssetId: typeof raw.imageAssetId === "number" && Number.isFinite(raw.imageAssetId) ? raw.imageAssetId : null,
        }
      })
      .filter((item): item is BattlePropLibraryItem => item !== null)
  } catch {
    return []
  }
}

export function writeBattlePropLibrary(items: BattlePropLibraryItem[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(BATTLE_PROP_LIBRARY_STORAGE_KEY, JSON.stringify(items))
}
