import type { Character, CharacterEvent } from "@/lib/types"
import { fetchBuildingById, getCachedBuildingName } from "@/lib/services/building-api.service"
import { fetchCharacterReferences } from "@/lib/services/character-api.service"
import { fetchLandmarkById, getCachedLandmarkName } from "@/lib/services/landmark-api.service"
import {
  fetchOrganizationById,
  getCachedOrganizationName,
} from "@/lib/services/organization-api.service"

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatEntityRef(label: string, nombre: string, id: number) {
  return `${label}: ${nombre} (id: ${id})`
}

function formatMissing(label: string) {
  return `${label}: No tiene esta informacion`
}

function formatEventLine(event: CharacterEvent) {
  const sesion = toOptionalTrimmedText(event.sesion)
  const fecha = toOptionalTrimmedText(event.fecha)
  const descripcion = toOptionalTrimmedText(event.descripcion) ?? "No tiene esta informacion"

  const parts: string[] = []
  if (sesion) parts.push(`Sesion: ${sesion}`)
  if (fecha) parts.push(`Fecha: ${fecha}`)
  parts.push(descripcion)

  return `- ${parts.join(" | ")}`
}

// Formats a Character into a lore-focused text block for AI consumption.
// Notes:
// - Resolves IDs to names (while still keeping IDs in the output).
// - Excludes image/crop fields.
// - For characterSheet: there is no sheet id in the type; we expose the personaje id when a sheet exists.
export async function characterToText(character: Character): Promise<string> {
  const lines: string[] = []
  lines.push(`Personaje: ${character.nombre} (id: ${character.id})`)
  lines.push(`Tipo: ${character.isPlayer ? "Jugador" : "NPC"}`)

  const raza = toOptionalTrimmedText(character.raza)
  lines.push(raza ? `Raza: ${raza}` : formatMissing("Raza"))

  const clase = toOptionalTrimmedText(character.clase)
  lines.push(clase ? `Clase: ${clase}` : formatMissing("Clase"))

  // Resolve references in a single fetch when possible.
  const refs = await fetchCharacterReferences().catch(() => null)
  const landmarkNameById = new Map(refs?.landmarks?.map((l) => [l.id, l.nombre]) ?? [])
  const buildingNameById = new Map(refs?.buildings?.map((b) => [b.id, b.nombre]) ?? [])
  const organizationNameById = new Map(refs?.organizations?.map((o) => [o.id, o.nombre]) ?? [])

  if (typeof character.landmarkId === "number" && character.landmarkId > 0) {
    const landmarkId = character.landmarkId
    let landmarkName = landmarkNameById.get(landmarkId) ?? getCachedLandmarkName(landmarkId)

    if (!toOptionalTrimmedText(landmarkName) || landmarkName === "Desconocido") {
      try {
        const landmark = await fetchLandmarkById(landmarkId)
        if (landmark?.nombre?.trim()) {
          landmarkName = landmark.nombre.trim()
        }
      } catch {
        // Keep cached/fallback name.
      }
    }

    lines.push(formatEntityRef("Lugar", landmarkName, landmarkId))
  } else {
    lines.push(formatMissing("Lugar"))
  }

  const directBuildingIds = Array.isArray(character.buildingIds)
    ? character.buildingIds.filter(
        (id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0,
      )
    : []
  const ownedBuildingIds = (refs?.buildings ?? [])
    .filter(
      (building) =>
        typeof building.id === "number" &&
        building.id > 0 &&
        typeof building.duenoId === "number" &&
        building.duenoId > 0 &&
        building.duenoId === character.id,
    )
    .map((building) => building.id)

  const buildingIds = Array.from(new Set([...directBuildingIds, ...ownedBuildingIds]))

  if (buildingIds.length === 0) {
    lines.push(formatMissing("Edificios"))
  } else {
    lines.push("Edificios:")
    for (const buildingId of buildingIds) {
      let buildingName = buildingNameById.get(buildingId) ?? getCachedBuildingName(buildingId)

      if (!toOptionalTrimmedText(buildingName) || buildingName === "Desconocido") {
        try {
          const building = await fetchBuildingById(buildingId)
          if (building?.nombre?.trim()) {
            buildingName = building.nombre.trim()
          }
        } catch {
          // Keep cached/fallback name.
        }
      }

      lines.push(`- ${buildingName} (id: ${buildingId})`)
    }
  }

  const organizationIds = Array.isArray(character.organizationIds)
    ? character.organizationIds.filter(
        (id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0,
      )
    : []

  if (organizationIds.length === 0) {
    lines.push(formatMissing("Organizaciones"))
  } else {
    lines.push("Organizaciones:")
    for (const organizationId of organizationIds) {
      let organizationName =
        organizationNameById.get(organizationId) ?? getCachedOrganizationName(organizationId)

      if (!toOptionalTrimmedText(organizationName) || organizationName === "Desconocido") {
        try {
          const organization = await fetchOrganizationById(organizationId)
          if (organization?.nombre?.trim()) {
            organizationName = organization.nombre.trim()
          }
        } catch {
          // Keep cached/fallback name.
        }
      }

      lines.push(`- ${organizationName} (id: ${organizationId})`)
    }
  }

  const descripcion = toOptionalTrimmedText(character.descripcion)
  lines.push(descripcion ? `Descripcion: ${descripcion}` : formatMissing("Descripcion"))

  const tags = (Array.isArray(character.tags) ? character.tags : [])
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
  lines.push(tags.length > 0 ? `Etiquetas: ${tags.join(", ")}` : formatMissing("Etiquetas"))

  const eventos = Array.isArray(character.eventos) ? character.eventos : []
  if (eventos.length === 0) {
    lines.push(formatMissing("Eventos"))
  } else {
    lines.push("Eventos:")
    for (const event of eventos) {
      lines.push(formatEventLine(event))
    }
  }

  if (character.characterSheet) {
    // The sheet itself has no id; the character id is the lookup key.
    lines.push(`Hoja de personaje: ${character.id}`)
  } else {
    lines.push(formatMissing("Hoja de personaje"))
  }

  return lines.join("\n")
}
