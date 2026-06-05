export function toOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function dedupeNumbers(values: number[]) {
  return Array.from(new Set(values))
}

export function dedupeStrings(values: string[]) {
  return Array.from(new Set(values))
}
