function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeMapRotationDegrees(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = Math.round(value)
  const snappedQuarterTurns = Math.round(normalized / 90)
  return (((snappedQuarterTurns % 4) + 4) % 4) * 90
}

export function normalizeMapGridCellSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 48
  return Math.round(clamp(value, 8, 512) * 100) / 100
}

export function normalizeMapGridOffset(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function formatMapGridNumber(value: number | null | undefined) {
  const normalized = typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
  const asText = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/\.?0+$/, "")
  return asText.replace(".", ",")
}

export function parseMapGridNumber(value: string) {
  const normalized = value.trim().replace(",", ".")
  if (!normalized || normalized === "-" || normalized === "+" || normalized === "." || normalized === "-.") {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
