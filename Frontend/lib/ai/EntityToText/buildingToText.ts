import { UNKNOWN_LABEL } from "@/lib/display"
import type { Building } from "@/lib/types"
import { fetchCharacterById } from "@/lib/services/character-api.service"
import { fetchLandmarkById, getCachedLandmarkName } from "@/lib/services/landmark-api.service"
import {
  fetchOrganizationById,
  getCachedOrganizationName,
} from "@/lib/services/organization-api.service"

function formatEntityRef(label: string, nombre: string, id: number) {
  return `${label}: ${nombre} (id: ${id})`
}

// Formats a Building into a lore-focused text block for AI consumption.
// Notes:
// - Resolves IDs to names (while still keeping IDs in the output).
// - Excludes map/asset/grid/position fields since they do not contribute to lore.
export async function buildingToText(building: Building): Promise<string> {
  const lines: string[] = []

  lines.push(`Edificio: ${building.nombre} (id: ${building.id})`)

  if (typeof building.landmarkId === "number" && building.landmarkId > 0) {
    const landmarkId = building.landmarkId
    let landmarkName = getCachedLandmarkName(landmarkId)

    try {
      const landmark = await fetchLandmarkById(landmarkId)
      if (landmark?.nombre?.trim()) {
        landmarkName = landmark.nombre.trim()
      }
    } catch {
      // Keep cached/fallback name.
    }

    lines.push(formatEntityRef("Lugar", landmarkName, landmarkId))
  }

  if (typeof building.duenoId === "number" && building.duenoId > 0) {
    const duenoId = building.duenoId
    let duenoNombre = building.duenoNombre?.trim()

    if (!duenoNombre) {
      try {
        const character = await fetchCharacterById(duenoId)
        duenoNombre = character?.nombre?.trim() || UNKNOWN_LABEL
      } catch {
        duenoNombre = UNKNOWN_LABEL
      }
    }

    lines.push(formatEntityRef("Dueno", duenoNombre, duenoId))
  }

  if (typeof building.organizationId === "number" && building.organizationId > 0) {
    const organizationId = building.organizationId
    let organizationName = getCachedOrganizationName(organizationId)

    try {
      const organization = await fetchOrganizationById(organizationId)
      if (organization?.nombre?.trim()) {
        organizationName = organization.nombre.trim()
      }
    } catch {
      // Keep cached/fallback name.
    }

    lines.push(formatEntityRef("Organizacion", organizationName, organizationId))
  }

  const descripcion = building.descripcion?.trim()
  if (descripcion) {
    lines.push(`Descripcion: ${descripcion}`)
  }

  const tags = (Array.isArray(building.tags) ? building.tags : [])
    .map((tag) => tag.trim())
    .filter(Boolean)
  if (tags.length > 0) {
    lines.push(`Etiquetas: ${tags.join(", ")}`)
  }

  return lines.join("\n")
}
