import type { Building, Character, Landmark, LandmarkEvent, Organization } from "@/lib/types"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"

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

function formatLandmarkEventLine(event: LandmarkEvent) {
  const nombre = toOptionalTrimmedText(event.nombre) ?? "No tiene esta informacion"
  const fecha = toOptionalTrimmedText(event.fecha)
  const descripcion = toOptionalTrimmedText(event.descripcion) ?? "No tiene esta informacion"

  const parts: string[] = [nombre]
  if (fecha) parts.push(`Fecha: ${fecha}`)
  parts.push(descripcion)
  return `- ${parts.join(" | ")}`
}

function buildCharacterNameById(personajes: Character[]) {
  const map = new Map<number, string>()
  for (const character of personajes) {
    if (typeof character?.id === "number" && Number.isFinite(character.id) && character.id > 0) {
      const name = toOptionalTrimmedText(character.nombre)
      if (name) map.set(character.id, name)
    }
  }
  return map
}

function buildOrganizationNameById(organizaciones: Organization[]) {
  const map = new Map<number, string>()
  for (const org of organizaciones) {
    if (typeof org?.id === "number" && Number.isFinite(org.id) && org.id > 0) {
      const name = toOptionalTrimmedText(org.nombre)
      if (name) map.set(org.id, name)
    }
  }
  return map
}

function buildCharacterLine(character: Character) {
  const name = toOptionalTrimmedText(character.nombre) ?? "Desconocido"
  const raza = toOptionalTrimmedText(character.raza)
  const clase = toOptionalTrimmedText(character.clase)

  const extras: string[] = []
  if (raza) extras.push(`Raza: ${raza}`)
  if (clase) extras.push(`Clase: ${clase}`)

  return `- ${name} (id: ${character.id})${extras.length > 0 ? ` | ${extras.join(" | ")}` : ""}`
}

function buildBuildingLine(
  building: Building,
  characterNameById: Map<number, string>,
  organizationNameById: Map<number, string>,
) {
  const name = toOptionalTrimmedText(building.nombre) ?? "Desconocido"
  const parts: string[] = [`- ${name} (id: ${building.id})`]

  if (typeof building.duenoId === "number" && building.duenoId > 0) {
    const ownerName = characterNameById.get(building.duenoId) ?? "Desconocido"
    parts.push(formatEntityRef("Dueno", ownerName, building.duenoId))
  }

  if (typeof building.organizationId === "number" && building.organizationId > 0) {
    const orgName = organizationNameById.get(building.organizationId) ?? "Desconocido"
    parts.push(formatEntityRef("Organizacion", orgName, building.organizationId))
  }

  const descripcion = toOptionalTrimmedText(building.descripcion)
  if (descripcion) {
    parts.push(`Descripcion: ${descripcion}`)
  }

  const tags = (Array.isArray(building.tags) ? building.tags : [])
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
  if (tags.length > 0) {
    parts.push(`Etiquetas: ${tags.join(", ")}`)
  }

  // Single line, but keep it readable.
  return parts.join(" | ")
}

// Formats a Landmark into a lore-focused text block for AI consumption.
// Notes:
// - Includes related entity references as "Nombre (id: X)" so the AI can request details later.
// - Excludes map/asset/grid/position fields since they do not contribute to lore.
export async function landmarkToText(landmark: Landmark): Promise<string> {
  const lines: string[] = []

  lines.push(`Lugar: ${landmark.nombre} (id: ${landmark.id})`)
  lines.push(`Tipo: ${toOptionalTrimmedText(landmark.tipo) ?? "No tiene esta informacion"}`)

  if (typeof landmark.poblacion === "number" && Number.isFinite(landmark.poblacion)) {
    lines.push(`Poblacion: ${landmark.poblacion}`)
  } else {
    lines.push(formatMissing("Poblacion"))
  }

  const descripcionCorta = toOptionalTrimmedText(landmark.descripcionCorta)
  lines.push(descripcionCorta ? `Descripcion corta: ${descripcionCorta}` : formatMissing("Descripcion corta"))

  const historia = toOptionalTrimmedText(landmark.historia)
  lines.push(historia ? `Historia: ${historia}` : formatMissing("Historia"))

  const tags = (Array.isArray(landmark.tags) ? landmark.tags : [])
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
  lines.push(tags.length > 0 ? `Etiquetas: ${tags.join(", ")}` : formatMissing("Etiquetas"))

  const eventos = Array.isArray(landmark.eventos) ? landmark.eventos : []
  if (eventos.length === 0) {
    lines.push(formatMissing("Eventos"))
  } else {
    lines.push("Eventos:")
    for (const event of eventos) {
      lines.push(formatLandmarkEventLine(event))
    }
  }

  const personajes = Array.isArray(landmark.personajes) ? landmark.personajes : []
  const organizaciones = Array.isArray(landmark.organizaciones) ? landmark.organizaciones : []
  const edificios = Array.isArray(landmark.edificios) ? landmark.edificios : []

  // Build lookup tables from included collections.
  const characterNameById = buildCharacterNameById(personajes)
  const organizationNameById = buildOrganizationNameById(organizaciones)

  // Enrich lookups if the landmark doesn't include enough info.
  const missingOwnerIds = new Set<number>()
  for (const building of edificios) {
    if (typeof building.duenoId === "number" && building.duenoId > 0 && !characterNameById.has(building.duenoId)) {
      missingOwnerIds.add(building.duenoId)
    }
  }

  if (missingOwnerIds.size > 0) {
    const allCharacters = await fetchCharacters().catch(() => [])
    for (const character of allCharacters) {
      if (missingOwnerIds.has(character.id)) {
        const name = toOptionalTrimmedText(character.nombre)
        if (name) characterNameById.set(character.id, name)
      }
    }
  }

  const missingOrgIds = new Set<number>()
  for (const building of edificios) {
    if (
      typeof building.organizationId === "number" &&
      building.organizationId > 0 &&
      !organizationNameById.has(building.organizationId)
    ) {
      missingOrgIds.add(building.organizationId)
    }
  }

  if (missingOrgIds.size > 0) {
    const allOrgs = await fetchOrganizations().catch(() => [])
    for (const org of allOrgs) {
      if (missingOrgIds.has(org.id)) {
        const name = toOptionalTrimmedText(org.nombre)
        if (name) organizationNameById.set(org.id, name)
      }
    }
  }

  if (edificios.length === 0) {
    lines.push(formatMissing("Edificios"))
  } else {
    lines.push("Edificios:")
    for (const building of edificios) {
      lines.push(buildBuildingLine(building, characterNameById, organizationNameById))
    }
  }

  if (personajes.length === 0) {
    lines.push(formatMissing("Personajes"))
  } else {
    lines.push("Personajes:")
    for (const character of personajes) {
      lines.push(buildCharacterLine(character))
    }
  }

  if (organizaciones.length === 0) {
    lines.push(formatMissing("Organizaciones"))
  } else {
    lines.push("Organizaciones:")
    for (const org of organizaciones) {
      const name = toOptionalTrimmedText(org.nombre) ?? "Desconocido"
      lines.push(`- ${name} (id: ${org.id})`)
    }
  }

  return lines.join("\n")
}
