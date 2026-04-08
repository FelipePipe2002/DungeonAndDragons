export type ItemEntryBlock =
  | { kind: "paragraph"; text: string; name?: string }
  | { kind: "list"; items: string[]; name?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; name?: string; caption?: string }

export interface Item {
  name: string
  typeCode: string
  typeLabel: string
  rarityLabel: string
  attunement: string
  weightLabel: string
  valueLabel: string
  tags: string[]
  entries: ItemEntryBlock[]
}

type JsonObject = Record<string, unknown>

const ITEM_TYPE_LABELS: Record<string, string> = {
  AIR: "Airship",
  AFG: "Ammunition",
  AT: "Artisan Tool",
  EM: "Eldritch Machine",
  G: "Gear",
  GS: "Gaming Set",
  HA: "Heavy Armor",
  INS: "Instrument",
  LA: "Light Armor",
  M: "Melee Weapon",
  MA: "Medium Armor",
  MNT: "Mount",
  P: "Potion",
  R: "Ranged Weapon",
  RD: "Rod",
  RG: "Ring",
  S: "Shield",
  SC: "Scroll",
  SD: "Spellcasting Focus",
  T: "Tool",
  TAH: "Tack and Harness",
  TG: "Trade Good",
  VEH: "Vehicle",
  WD: "Wand",
}

export const ITEMS_JSON_URL = "/dataset/items.json"

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

function _toTitleCase(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ")
}

function _extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (_isObject(payload) && Array.isArray(payload.item)) return payload.item
  throw new Error("Formato JSON invalido: se esperaba [] o { item: [] }")
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

function _normalizeTableRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return []

  return value
    .map((row) => {
      if (!Array.isArray(row)) {
        const normalized = _flattenText(row).join(" ").trim()
        return normalized ? [normalized] : []
      }

      return row.map((cell) => _flattenText(cell).join(" ").trim() || "-")
    })
    .filter((row) => row.length > 0)
}

function _withHeading(blocks: ItemEntryBlock[], heading: string): ItemEntryBlock[] {
  const normalizedHeading = _cleanText(heading)
  if (!normalizedHeading || blocks.length === 0) {
    return blocks
  }

  const [first, ...rest] = blocks
  return [{ ...first, name: first.name ?? normalizedHeading }, ...rest]
}

function _collectListItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      const cleaned = _cleanText(item)
      return cleaned ? [cleaned] : []
    }

    if (!_isObject(item)) {
      return []
    }

    const name = typeof item.name === "string" ? _cleanText(item.name) : ""
    const lines = _flattenText(item.entries)
    if (name && lines.length > 0) {
      return [`${name}. ${lines[0]}`, ...lines.slice(1)]
    }

    if (lines.length > 0) {
      return lines
    }

    const fallback = _flattenText(item).join(" ").trim()
    return fallback ? [fallback] : []
  })
}

function _collectEntryBlocks(value: unknown): ItemEntryBlock[] {
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
      ? value.colLabels.map((label) => _cleanText(String(label ?? ""))).filter(Boolean)
      : []
    const rows = _normalizeTableRows(value.rows)
    if (rows.length === 0) {
      return []
    }

    return [{
      kind: "table",
      headers,
      rows,
      name: typeof value.name === "string" ? _cleanText(value.name) : undefined,
      caption: typeof value.caption === "string" ? _cleanText(value.caption) : undefined,
    }]
  }

  if (type === "list" || Array.isArray(value.items)) {
    const items = _collectListItems(value.items)
    if (items.length === 0) {
      return []
    }

    return [{
      kind: "list",
      items,
      name: typeof value.name === "string" ? _cleanText(value.name) : undefined,
    }]
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

function _formatType(typeCode: unknown, row: JsonObject): string {
  const normalizedType = typeof typeCode === "string" ? typeCode.trim().toUpperCase() : ""
  if (normalizedType && ITEM_TYPE_LABELS[normalizedType]) {
    return ITEM_TYPE_LABELS[normalizedType]
  }
  if (row.wondrous === true) {
    return "Wondrous Item"
  }
  return normalizedType || "Item"
}

function _formatRarity(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : ""
  if (!normalized || normalized.toLowerCase() === "none") {
    return "No rarity"
  }
  return _toTitleCase(normalized)
}

function _formatWeight(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value} lb` : ""
}

function _formatValue(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return ""
  }
  if (value % 100 === 0) {
    return `${value / 100} gp`
  }
  if (value % 10 === 0) {
    return `${value / 10} sp`
  }
  return `${value} cp`
}

function _buildTags(row: JsonObject, typeLabel: string, rarityLabel: string, attunement: string): string[] {
  const tags = [typeLabel, rarityLabel]
  if (row.wondrous === true && typeLabel !== "Wondrous Item") {
    tags.push("Wondrous Item")
  }
  if (row.curse === true) {
    tags.push("Cursed")
  }
  if (attunement) {
    tags.push(`Attunement ${attunement}`)
  }
  return tags.filter(Boolean)
}

function _normalizeItem(row: unknown): Item | null {
  if (!_isObject(row)) return null

  const name = typeof row.name === "string" ? row.name.trim() : ""
  if (!name) {
    return null
  }

  const typeCode = typeof row.type === "string" ? row.type.trim().toUpperCase() : ""
  const typeLabel = _formatType(row.type, row)
  const rarityLabel = _formatRarity(row.rarity)
  const attunement = typeof row.reqAttune === "string" ? _cleanText(row.reqAttune) : ""

  return {
    name,
    typeCode,
    typeLabel,
    rarityLabel,
    attunement,
    weightLabel: _formatWeight(row.weight),
    valueLabel: _formatValue(row.value),
    tags: _buildTags(row, typeLabel, rarityLabel, attunement),
    entries: _collectEntryBlocks(row.entries),
  }
}

export async function loadItems(
  url: string = ITEMS_JSON_URL,
  fetcher: typeof fetch = fetch,
): Promise<Item[]> {
  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url} (${response.status})`)
  }

  const payload = await response.json()
  const rows = _extractItems(payload)

  return rows.map((row) => _normalizeItem(row)).filter((item): item is Item => item !== null)
}
