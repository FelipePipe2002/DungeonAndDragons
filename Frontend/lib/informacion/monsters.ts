import type { MonsterBrowserItem } from "@/lib/informacion/types"
import { buildMonsterListItem, normalizeMonsterRecord } from "@/lib/monster/utils"
import monstersDataset from "@/public/dataset/monsters.json"

function formatSource(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "N/A"
}

export function parseMonsterCrValue(rawCr: string): number | null {
  const value = rawCr.trim()
  if (!value) return null

  const fractionMatch = value.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1])
    const denominator = Number(fractionMatch[2])
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator
    }
  }

  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric
  }

  return null
}

function buildMonsterBrowserItem(rawMonster: unknown): MonsterBrowserItem | null {
  const record = normalizeMonsterRecord(rawMonster)
  if (!record) {
    return null
  }

  const summary = buildMonsterListItem(record)
  if (!summary) {
    return null
  }

  return {
    id: summary.nameExact,
    record,
    summary,
    source: formatSource(record.source),
  }
}

export const MONSTER_ITEMS = (Array.isArray(monstersDataset) ? monstersDataset : [])
  .map((monster) => buildMonsterBrowserItem(monster))
  .filter((monster): monster is MonsterBrowserItem => Boolean(monster))
  .sort((a, b) => a.summary.name.localeCompare(b.summary.name, "es"))

export const MONSTER_ITEMS_BY_ID = new Map(MONSTER_ITEMS.map((monster) => [monster.id, monster] as const))
