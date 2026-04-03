import { normalizeConditionColor, normalizeConditionText } from "@/lib/informacion/normalize"
import type { ConditionBrowserItem, ConditionEntryBlock } from "@/lib/informacion/types"
import conditionsDataset from "@/public/dataset/conditions.json"

function flattenConditionEntryText(entry: unknown): string[] {
  if (typeof entry === "string") {
    const normalized = normalizeConditionText(entry)
    return normalized ? [normalized] : []
  }

  if (!entry || typeof entry !== "object") {
    return []
  }

  const parsed = entry as {
    items?: unknown
    rows?: unknown
    entries?: unknown
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items.flatMap((item) => flattenConditionEntryText(item))
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows.flatMap((row) => {
      if (!Array.isArray(row)) {
        return flattenConditionEntryText(row)
      }

      const normalizedRow = row
        .flatMap((cell) => flattenConditionEntryText(cell))
        .join(" | ")
        .trim()

      return normalizedRow ? [normalizedRow] : []
    })
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries.flatMap((nested) => flattenConditionEntryText(nested))
  }

  return []
}

export function parseConditionEntryBlocks(entry: unknown): ConditionEntryBlock[] {
  if (typeof entry === "string") {
    const text = normalizeConditionText(entry)
    return text ? [{ kind: "paragraph", text }] : []
  }

  if (!entry || typeof entry !== "object") {
    return []
  }

  const parsed = entry as {
    type?: unknown
    items?: unknown
    entries?: unknown
    colLabels?: unknown
    rows?: unknown
  }

  const type = typeof parsed.type === "string" ? parsed.type.trim().toLowerCase() : ""

  if (type === "table" && Array.isArray(parsed.rows)) {
    const headers = Array.isArray(parsed.colLabels)
      ? parsed.colLabels
          .map((label) => normalizeConditionText(String(label ?? "")))
          .filter((label) => label.length > 0)
      : []

    const rows = parsed.rows
      .map((row) => {
        if (!Array.isArray(row)) {
          const asText = flattenConditionEntryText(row)
          return asText.length > 0 ? [asText.join(" ")] : []
        }

        return row
          .map((cell) => flattenConditionEntryText(cell).join(" ").trim())
          .map((cell) => (cell.length > 0 ? cell : "-"))
      })
      .filter((row) => row.length > 0)

    return rows.length > 0 ? [{ kind: "table", headers, rows }] : []
  }

  if (type === "list" && Array.isArray(parsed.items)) {
    const items = parsed.items.flatMap((item) => flattenConditionEntryText(item))
    return items.length > 0 ? [{ kind: "list", items }] : []
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries.flatMap((nestedEntry) => parseConditionEntryBlocks(nestedEntry))
  }

  return []
}

export function buildConditionSearchText(name: string, blocks: ConditionEntryBlock[]) {
  const chunks = [name]

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      chunks.push(block.text)
      continue
    }

    if (block.kind === "list") {
      chunks.push(...block.items)
      continue
    }

    chunks.push(...block.headers)
    for (const row of block.rows) {
      chunks.push(...row)
    }
  }

  return chunks.join(" ").toLocaleLowerCase("es")
}

export const CONDITION_ITEMS: ConditionBrowserItem[] = (Array.isArray(conditionsDataset) ? conditionsDataset : [])
  .map((rawCondition) => {
    const parsed = rawCondition as {
      name?: unknown
      color?: unknown
      entries?: unknown
    }

    const name = typeof parsed.name === "string" ? parsed.name.trim() : ""
    if (!name) {
      return null
    }

    const blocks = Array.isArray(parsed.entries)
      ? parsed.entries.flatMap((entry) => parseConditionEntryBlocks(entry))
      : []
    const normalizedBlocks =
      blocks.length > 0 ? blocks : [{ kind: "paragraph" as const, text: "Sin descripcion cargada." }]

    return {
      id: name,
      name,
      color: normalizeConditionColor(parsed.color),
      blocks: normalizedBlocks,
      searchText: buildConditionSearchText(name, normalizedBlocks),
    } satisfies ConditionBrowserItem
  })
  .filter((condition): condition is ConditionBrowserItem => Boolean(condition))
  .sort((a, b) => a.name.localeCompare(b.name, "es"))
