import { UNKNOWN_LABEL } from "@/lib/display"
import type { Organization, OrganizationMember } from "@/lib/types"
import { fetchBuildings, getCachedBuildingName } from "@/lib/services/building-api.service"
import { fetchLandmarkReferences, getCachedLandmarkName } from "@/lib/services/landmark-api.service"

const DEFAULT_LIST_LIMIT = 25

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatMissing(label: string) {
  return `${label}: No tiene esta informacion`
}

function formatCappedSection(
  header: string,
  lines: string[],
  totalCount: number,
  limit = DEFAULT_LIST_LIMIT,
) {
  if (totalCount <= 0) {
    return [formatMissing(header)]
  }

  const result: string[] = [header + ":", ...lines.slice(0, limit)]
  const remaining = totalCount - Math.min(totalCount, limit)
  if (remaining > 0) {
    result.push(`... y ${remaining} mas`)
  }
  return result
}

function memberToLine(member: OrganizationMember, landmarkNameById: Map<number, string>) {
  const name = toOptionalTrimmedText(member.nombre) ?? UNKNOWN_LABEL
  const parts: string[] = [`- ${name} (id: ${member.personajeId})`]

  const categoria = toOptionalTrimmedText(member.categoria)
  if (categoria) parts.push(`Categoria: ${categoria}`)

  const profesion = toOptionalTrimmedText(member.profesion)
  if (profesion) parts.push(`Profesion: ${profesion}`)

  const raza = toOptionalTrimmedText(member.raza)
  if (raza) parts.push(`Raza: ${raza}`)

  if (typeof member.landmarkId === "number" && member.landmarkId > 0) {
    const landmarkName = landmarkNameById.get(member.landmarkId) ?? getCachedLandmarkName(member.landmarkId)
    parts.push(`Lugar: ${landmarkName} (id: ${member.landmarkId})`)
  }

  return parts.join(" | ")
}

// Formats an Organization into a lore-focused text block for AI consumption.
// Notes:
// - Includes entity references as "Nombre (id: X)" so the AI can request details later.
// - Excludes image fields.
// - Caps long lists to avoid overwhelming the prompt.
export async function organizationToText(organization: Organization): Promise<string> {
  const lines: string[] = []

  lines.push(`Organizacion: ${organization.nombre} (id: ${organization.id})`)

  const descripcion = toOptionalTrimmedText(organization.descripcion)
  lines.push(descripcion ? `Descripcion: ${descripcion}` : formatMissing("Descripcion"))

  const categorias = (Array.isArray(organization.categorias) ? organization.categorias : [])
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter((c) => c.length > 0)
  lines.push(categorias.length > 0 ? `Categorias: ${categorias.join(", ")}` : formatMissing("Categorias"))

  const tags = (Array.isArray(organization.tags) ? organization.tags : [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
  lines.push(tags.length > 0 ? `Etiquetas: ${tags.join(", ")}` : formatMissing("Etiquetas"))

  const landmarkRefs = await fetchLandmarkReferences().catch(() => [])
  const landmarkNameById = new Map(landmarkRefs.map((l) => [l.id, l.nombre]))

  const landmarkIds = (Array.isArray(organization.landmarks) ? organization.landmarks : [])
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)

  const landmarkLines = landmarkIds.map((id) => {
    const name = landmarkNameById.get(id) ?? getCachedLandmarkName(id)
    return `- ${name} (id: ${id})`
  })
  lines.push(...formatCappedSection("Lugares", landmarkLines, landmarkIds.length))

  const buildingIds = (Array.isArray(organization.edificios) ? organization.edificios : [])
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0)

  // Prefer a single fetch to resolve building names, but keep it bounded.
  // fetchBuildings hydrates owner names but still keeps requests low (buildings + characters).
  const buildings = await fetchBuildings().catch(() => [])
  const buildingNameById = new Map(buildings.map((b) => [b.id, b.nombre]))
  const buildingLandmarkIdById = new Map(
    buildings
      .filter((b) => typeof b.landmarkId === "number" && b.landmarkId > 0)
      .map((b) => [b.id, b.landmarkId as number]),
  )

  const buildingLines = buildingIds.map((buildingId) => {
    const name =
      toOptionalTrimmedText(buildingNameById.get(buildingId)) ??
      toOptionalTrimmedText(getCachedBuildingName(buildingId)) ??
      UNKNOWN_LABEL

    const parts: string[] = [`- ${name} (id: ${buildingId})`]
    const buildingLandmarkId = buildingLandmarkIdById.get(buildingId)
    if (typeof buildingLandmarkId === "number" && buildingLandmarkId > 0) {
      const landmarkName = landmarkNameById.get(buildingLandmarkId) ?? getCachedLandmarkName(buildingLandmarkId)
      parts.push(`Lugar: ${landmarkName} (id: ${buildingLandmarkId})`)
    }

    return parts.join(" | ")
  })
  lines.push(...formatCappedSection("Edificios", buildingLines, buildingIds.length))

  const members = Array.isArray(organization.miembros) ? organization.miembros : []
  const memberLines = members.map((member) => memberToLine(member, landmarkNameById))
  lines.push(...formatCappedSection("Miembros", memberLines, members.length))

  return lines.join("\n")
}
