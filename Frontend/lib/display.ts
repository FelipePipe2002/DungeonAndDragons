export const UNKNOWN_LABEL = "Desconocido"
export const NO_DATE_LABEL = "Sin fecha"

export function formatEsArDateTime(
  rawValue: string | null | undefined,
  intlOptions: Intl.DateTimeFormatOptions,
  options?: {
    fallback?: string
    invalidFallback?: string | ((rawValue: string) => string)
  },
) {
  if (!rawValue) {
    return options?.fallback ?? NO_DATE_LABEL
  }

  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) {
    if (typeof options?.invalidFallback === "function") {
      return options.invalidFallback(rawValue)
    }

    return options?.invalidFallback ?? rawValue
  }

  return new Intl.DateTimeFormat("es-AR", intlOptions).format(parsed)
}
