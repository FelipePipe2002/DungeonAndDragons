export type SearchValue =
  | string
  | number
  | null
  | undefined
  | SearchValue[]

function flattenSearchValues(values: SearchValue[]): Array<string | number> {
  const flattened: Array<string | number> = []

  for (const value of values) {
    if (Array.isArray(value)) {
      flattened.push(...flattenSearchValues(value))
      continue
    }

    if (value === null || value === undefined) continue
    if (typeof value === "string" || typeof value === "number") {
      flattened.push(value)
    }
  }

  return flattened
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function matchesSearchQuery(query: string, ...values: SearchValue[]) {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length === 0) return true

  const normalizedHaystack = normalizeSearchText(
    flattenSearchValues(values)
      .map((value) => String(value))
      .join(" "),
  )

  return normalizedHaystack.includes(normalizedQuery)
}

