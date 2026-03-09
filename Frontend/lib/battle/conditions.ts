import conditionsDataset from "@/public/dataset/conditions.json"

const CONDITION_TEXT_TAG_REGEX = /\{@[^}]+\s([^}]+)\}/g
const CONDITION_HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i
const DEFAULT_CONDITION_COLOR = "#6b7280"

export type BattleConditionDefinition = {
  name: string
  color: string
  entriesText: string
}

function normalizeConditionText(raw: string) {
  return raw.replace(CONDITION_TEXT_TAG_REGEX, "$1").replace(/\s+/g, " ").trim()
}

function flattenConditionEntry(entry: unknown): string[] {
  if (typeof entry === "string") {
    const normalized = normalizeConditionText(entry)
    return normalized ? [normalized] : []
  }

  if (!entry || typeof entry !== "object") {
    return []
  }

  const parsed = entry as {
    type?: unknown
    items?: unknown
    rows?: unknown
    entries?: unknown
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items.flatMap((item) => flattenConditionEntry(item))
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows.flatMap((row) => {
      if (!Array.isArray(row)) {
        return flattenConditionEntry(row)
      }

      const normalizedRow = row
        .flatMap((cell) => flattenConditionEntry(cell))
        .join(" | ")
        .trim()

      return normalizedRow ? [normalizedRow] : []
    })
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries.flatMap((nested) => flattenConditionEntry(nested))
  }

  return []
}

function normalizeConditionColor(color: unknown) {
  const normalized = typeof color === "string" ? color.trim() : ""
  return CONDITION_HEX_COLOR_REGEX.test(normalized) ? normalized : DEFAULT_CONDITION_COLOR
}

function normalizeConditionName(name: unknown) {
  return typeof name === "string" ? name.trim() : ""
}

function normalizeConditionEntries(entries: unknown) {
  if (!Array.isArray(entries)) {
    return ""
  }

  return entries
    .flatMap((entry) => flattenConditionEntry(entry))
    .filter((text, index, all) => text.length > 0 && all.indexOf(text) === index)
    .join("\n")
    .trim()
}

const normalizedConditions = (Array.isArray(conditionsDataset) ? conditionsDataset : [])
  .map((raw) => {
    const parsed = raw as {
      name?: unknown
      color?: unknown
      entries?: unknown
    }

    const name = normalizeConditionName(parsed.name)
    if (!name) {
      return null
    }

    return {
      name,
      color: normalizeConditionColor(parsed.color),
      entriesText: normalizeConditionEntries(parsed.entries),
    } satisfies BattleConditionDefinition
  })
  .filter((condition): condition is BattleConditionDefinition => Boolean(condition))

export const BATTLE_CONDITIONS: BattleConditionDefinition[] = normalizedConditions

const battleConditionByName = new Map(
  BATTLE_CONDITIONS.map((condition) => [condition.name.toLocaleLowerCase("es"), condition] as const),
)

export function findBattleConditionByName(rawName: string | null | undefined) {
  if (typeof rawName !== "string") {
    return null
  }

  const normalizedName = rawName.trim().toLocaleLowerCase("es")
  if (!normalizedName) {
    return null
  }

  return battleConditionByName.get(normalizedName) ?? null
}

export function normalizeBattleConditionStatus(rawName: string | null | undefined) {
  return findBattleConditionByName(rawName)?.name ?? ""
}
