export type FeatEntryBlock =
  | { kind: "paragraph"; text: string; name?: string }
  | { kind: "list"; items: string[]; name?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; name?: string; caption?: string }

export interface Feat {
  name: string
  categoryCode: string
  categoryLabel: string
  repeatable: boolean
  prerequisites: string[]
  abilityBonuses: string[]
  entries: FeatEntryBlock[]
}

type JsonObject = Record<string, unknown>

const FEAT_CATEGORY_LABELS: Record<string, string> = {
  G: "General",
  O: "Origin",
  EB: "Epic Boon",
  FS: "Fighting Style",
  "FS:P": "Fighting Style (Paladin)",
  "FS:R": "Fighting Style (Ranger)",
}

const ABILITY_LABELS: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
}

export const FEATS_JSON_URL = "/dataset/feats.json"

function _isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function _formatInlineTag(rawTag: string): string {
  const spaceIdx = rawTag.indexOf(" ")
  if (spaceIdx < 0) return rawTag

  const body = rawTag.slice(spaceIdx + 1).trim()
  if (!body) return ""

  const parts = body.split("|").map((item) => item.trim())
  return parts[2] || parts[0] || ""
}

function _cleanText(value: string): string {
  return value
    .replace(/\{@([^}]+)\}/g, (_m, tagBody: string) => _formatInlineTag(tagBody))
    .replace(/\s+/g, " ")
    .trim()
}

function _extractFeats(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (_isObject(payload) && Array.isArray(payload.feat)) return payload.feat
  throw new Error("Formato JSON invalido: se esperaba [] o { feat: [] }")
}

function _toTitleCase(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ")
}

function _joinWithOr(values: string[]): string {
  if (values.length === 0) return ""
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} or ${values[1]}`
  return `${values.slice(0, -1).join(", ")}, or ${values[values.length - 1]}`
}

function _formatAbilityCode(code: string): string {
  const normalized = code.trim().toLowerCase()
  return ABILITY_LABELS[normalized] ?? _toTitleCase(normalized)
}

function _formatAbilityRequirement(value: unknown): string {
  if (!Array.isArray(value)) return ""

  const chunks = value
    .flatMap((entry) => {
      if (!_isObject(entry)) {
        return []
      }

      return Object.entries(entry).flatMap(([ability, minimum]) => {
        if (typeof minimum !== "number") {
          return []
        }

        return `${_formatAbilityCode(ability)} ${minimum}`
      })
    })
    .filter(Boolean)

  if (chunks.length === 0) {
    return ""
  }

  return `Ability ${chunks.join(" / ")}`
}

function _formatFeatureRequirement(value: unknown): string {
  if (!Array.isArray(value)) return ""

  const features = value
    .map((item) => (typeof item === "string" ? _cleanText(item) : ""))
    .map((feature) => (feature ? `${feature} Feature` : ""))
    .filter(Boolean)

  if (features.length === 0) {
    return ""
  }

  return features.join(" / ")
}

function _formatProficiencyRequirement(value: unknown): string {
  if (!Array.isArray(value)) return ""

  const proficiencies = value
    .flatMap((entry) => {
      if (!_isObject(entry)) return []

      return Object.entries(entry).flatMap(([kind, level]) => {
        if (typeof level !== "string") return []
        const normalizedKind = _toTitleCase(kind)
        const normalizedLevel = _cleanText(level)
        return `${_toTitleCase(normalizedLevel)} ${normalizedKind} Proficiency`
      })
    })
    .filter(Boolean)

  if (proficiencies.length === 0) {
    return ""
  }

  return proficiencies.join(" / ")
}

function _formatOtherSummary(value: unknown): string {
  if (!_isObject(value)) return ""

  const entrySummary = typeof value.entrySummary === "string" ? _cleanText(value.entrySummary) : ""
  const entry = typeof value.entry === "string" ? _cleanText(value.entry) : ""

  if (entrySummary && entry) {
    return `${entrySummary}: ${entry}`
  }

  return entrySummary || entry
}

function _formatPrerequisiteClause(value: unknown): string {
  if (!_isObject(value)) {
    return ""
  }

  const chunks: string[] = []

  if (typeof value.level === "number") {
    chunks.push(`Level ${value.level}+`)
  }

  const abilityRequirement = _formatAbilityRequirement(value.ability)
  if (abilityRequirement) {
    chunks.push(abilityRequirement)
  }

  const featureRequirement = _formatFeatureRequirement(value.feature)
  if (featureRequirement) {
    chunks.push(featureRequirement)
  }

  const proficiencyRequirement = _formatProficiencyRequirement(value.proficiency)
  if (proficiencyRequirement) {
    chunks.push(proficiencyRequirement)
  }

  if (value.spellcasting2020 === true) {
    chunks.push("Spellcasting or Pact Magic Feature")
  }

  const otherSummary = _formatOtherSummary(value.otherSummary)
  if (otherSummary) {
    chunks.push(otherSummary)
  }

  return chunks.join("; ")
}

function _formatPrerequisites(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => _formatPrerequisiteClause(entry))
    .filter(Boolean)
}

function _formatAbilityBonusEntry(value: unknown): string[] {
  if (!_isObject(value)) {
    return []
  }

  if (value.hidden === true) {
    return []
  }

  const explicitMax = typeof value.max === "number" ? value.max : 20
  const directBonusLines = Object.entries(ABILITY_LABELS).flatMap(([code, label]) => {
    const amount = value[code]
    if (typeof amount !== "number") {
      return []
    }

    const amountLabel = amount >= 0 ? `by ${amount}` : `by ${amount}`
    return [`Increase your ${label} ${amountLabel}, to a maximum of ${explicitMax}.`]
  })

  if (directBonusLines.length > 0) {
    return directBonusLines
  }

  if (!_isObject(value.choose)) {
    return []
  }

  const from = Array.isArray(value.choose.from)
    ? value.choose.from
        .map((item) => (typeof item === "string" ? _formatAbilityCode(item) : ""))
        .filter(Boolean)
    : []

  const fromLabel = from.length > 0 ? _joinWithOr(from) : "an ability score"
  const amount = typeof value.choose.amount === "number" ? value.choose.amount : null
  const count = typeof value.choose.count === "number" ? value.choose.count : null
  const max = typeof value.max === "number" ? value.max : 20
  let sentence = ""

  if (count != null) {
    sentence = `Increase ${count} ability scores of your choice (${fromLabel}) by 1, to a maximum of ${max}.`
  } else if (amount != null) {
    sentence = `Increase your ${fromLabel} by ${amount}, to a maximum of ${max}.`
  } else {
    sentence = `Increase your ${fromLabel} by 1, to a maximum of ${max}.`
  }

  return [sentence]
}

function _formatAbilityBonuses(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .flatMap((entry) => _formatAbilityBonusEntry(entry))
    .filter(Boolean)
}

function _normalizeTableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return []

  return value
    .map((row) => {
      if (!Array.isArray(row)) {
        const normalized = _flattenText(row).join(" ").trim()
        return normalized ? [normalized] : []
      }

      return row
        .map((cell) => _flattenText(cell).join(" ").trim())
        .map((cell) => (cell ? cell : "-"))
    })
    .filter((row) => row.length > 0)
}

function _flattenText(value: unknown): string[] {
  if (typeof value === "string") {
    const cleaned = _cleanText(value)
    return cleaned ? [cleaned] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => _flattenText(item))
  }

  if (_isObject(value)) {
    if (Array.isArray(value.entries)) {
      return value.entries.flatMap((entry) => _flattenText(entry))
    }

    if (Array.isArray(value.items)) {
      return value.items.flatMap((entry) => _flattenText(entry))
    }

    if (Array.isArray(value.rows)) {
      return value.rows.flatMap((entry) => _flattenText(entry))
    }
  }

  return []
}

function _withHeading(blocks: FeatEntryBlock[], heading: string): FeatEntryBlock[] {
  const normalizedHeading = _cleanText(heading)
  if (!normalizedHeading || blocks.length === 0) {
    return blocks
  }

  const [first, ...rest] = blocks
  return [{ ...first, name: first.name ?? normalizedHeading }, ...rest]
}

function _collectEntryBlocks(value: unknown): FeatEntryBlock[] {
  if (typeof value === "string") {
    const cleaned = _cleanText(value)
    return cleaned ? [{ kind: "paragraph", text: cleaned }] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => _collectEntryBlocks(item))
  }

  if (!_isObject(value)) {
    return []
  }

  const type = typeof value.type === "string" ? value.type.trim().toLowerCase() : ""

  if (type === "table" || Array.isArray(value.rows)) {
    const headers = Array.isArray(value.colLabels)
      ? value.colLabels
          .map((label) => _cleanText(String(label ?? "")))
          .filter((label) => label.length > 0)
      : []

    const rows = _normalizeTableRows(value.rows)
    if (rows.length === 0) {
      return []
    }

    return [
      {
        kind: "table",
        headers,
        rows,
        name: typeof value.name === "string" ? _cleanText(value.name) : undefined,
        caption: typeof value.caption === "string" ? _cleanText(value.caption) : undefined,
      },
    ]
  }

  if (type === "list" || Array.isArray(value.items)) {
    const items = Array.isArray(value.items)
      ? value.items.flatMap((item) => _flattenText(item))
      : []

    if (items.length === 0) {
      return []
    }

    return [
      {
        kind: "list",
        items,
        name: typeof value.name === "string" ? _cleanText(value.name) : undefined,
      },
    ]
  }

  if (Array.isArray(value.entries)) {
    const blocks = value.entries.flatMap((entry) => _collectEntryBlocks(entry))
    if (typeof value.name === "string" && value.name.trim()) {
      return _withHeading(blocks, value.name)
    }

    return blocks
  }

  return []
}

function _formatCategory(code: unknown): { code: string; label: string } {
  if (typeof code !== "string" || !code.trim()) {
    return { code: "", label: "Unknown" }
  }

  const normalizedCode = code.trim().toUpperCase()
  return {
    code: normalizedCode,
    label: FEAT_CATEGORY_LABELS[normalizedCode] ?? normalizedCode,
  }
}

function _normalizeFeat(row: unknown): Feat | null {
  if (!_isObject(row)) return null

  const name = typeof row.name === "string" ? row.name.trim() : ""
  if (!name) return null

  const category = _formatCategory(row.category)

  return {
    name,
    categoryCode: category.code,
    categoryLabel: category.label,
    repeatable: row.repeatable === true,
    prerequisites: _formatPrerequisites(row.prerequisite),
    abilityBonuses: _formatAbilityBonuses(row.ability),
    entries: _collectEntryBlocks(row.entries),
  }
}

export async function loadFeats(
  url: string = FEATS_JSON_URL,
  fetcher: typeof fetch = fetch,
): Promise<Feat[]> {
  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url} (${response.status})`)
  }

  const payload = await response.json()
  const rows = _extractFeats(payload)

  return rows
    .map((row) => _normalizeFeat(row))
    .filter((feat): feat is Feat => feat !== null)
}
