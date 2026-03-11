export type RuleListItem = {
  name?: string
  text: string
}

export type RuleEntryBlock =
  | { kind: "paragraph"; text: string; name?: string }
  | { kind: "list"; items: RuleListItem[]; name?: string }
  | { kind: "table"; headers: string[]; rows: string[][]; name?: string; caption?: string }

export interface Rule {
  name: string
  entries: RuleEntryBlock[]
}

type JsonObject = Record<string, unknown>

export const RULES_JSON_URL = "/dataset/rules.json"

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

function _extractRules(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (_isObject(payload) && Array.isArray(payload.rule)) return payload.rule
  if (_isObject(payload) && Array.isArray(payload.rules)) return payload.rules
  throw new Error("Formato JSON invalido: se esperaba [] o { rule: [] }")
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

      return row
        .map((cell) => _flattenText(cell).join(" ").trim())
        .map((cell) => (cell ? cell : "-"))
    })
    .filter((row) => row.length > 0)
}

function _withHeading(blocks: RuleEntryBlock[], heading: string): RuleEntryBlock[] {
  const normalizedHeading = _cleanText(heading)
  if (!normalizedHeading || blocks.length === 0) {
    return blocks
  }

  const [first, ...rest] = blocks
  return [{ ...first, name: first.name ?? normalizedHeading }, ...rest]
}

function _collectListItems(value: unknown): RuleListItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: RuleListItem[] = []

  for (const item of value) {
    if (typeof item === "string") {
      const text = _cleanText(item)
      if (text) {
        items.push({ text })
      }
      continue
    }

    if (!_isObject(item)) {
      continue
    }

    const name = typeof item.name === "string" ? _cleanText(item.name) : ""
    const lines = _flattenText(item.entries)

    if (name && lines.length > 0) {
      items.push({ name, text: lines[0] })
      for (const line of lines.slice(1)) {
        items.push({ text: line })
      }
      continue
    }

    if (lines.length > 0) {
      for (const line of lines) {
        items.push({ text: line })
      }
      continue
    }

    const fallback = _flattenText(item).join(" ").trim()
    if (fallback) {
      items.push({ text: fallback })
    }
  }

  return items
}

function _collectEntryBlocks(value: unknown): RuleEntryBlock[] {
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
    const items = _collectListItems(value.items)
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

function _normalizeRule(row: unknown): Rule | null {
  if (!_isObject(row)) return null

  const name = typeof row.name === "string" ? row.name.trim() : ""
  if (!name) {
    return null
  }

  return {
    name,
    entries: _collectEntryBlocks(row.entries),
  }
}

export async function loadRules(
  url: string = RULES_JSON_URL,
  fetcher: typeof fetch = fetch,
): Promise<Rule[]> {
  const response = await fetcher(url)
  if (!response.ok) {
    throw new Error(`No se pudo leer ${url} (${response.status})`)
  }

  const payload = await response.json()
  const rows = _extractRules(payload)

  return rows
    .map((row) => _normalizeRule(row))
    .filter((rule): rule is Rule => rule !== null)
}
