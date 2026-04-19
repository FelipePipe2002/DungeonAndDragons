import type { DmEvent } from "@/lib/types"

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatMissing(label: string) {
  return `${label}: No tiene esta informacion`
}

// Formats a DmEvent into a lore-focused text block for AI consumption.
export function dmEventToText(event: DmEvent): string {
  const lines: string[] = []

  lines.push(`Evento DM: ${event.titulo?.trim() || "Sin titulo"} (id: ${event.id})`)

  const titulo = toOptionalTrimmedText(event.titulo)
  lines.push(titulo ? `Titulo: ${titulo}` : formatMissing("Titulo"))

  const descripcion = toOptionalTrimmedText(event.descripcion)
  lines.push(descripcion ? `Descripcion: ${descripcion}` : formatMissing("Descripcion"))

  const createdAt = toOptionalTrimmedText(event.createdAt)
  if (createdAt) {
    lines.push(`Creado: ${createdAt}`)
  }

  const updatedAt = toOptionalTrimmedText(event.updatedAt)
  if (updatedAt) {
    lines.push(`Actualizado: ${updatedAt}`)
  }

  return lines.join("\n")
}
