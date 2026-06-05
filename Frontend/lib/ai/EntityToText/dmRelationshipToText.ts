import { UNKNOWN_LABEL } from "@/lib/display"
import type { DmRelationship, DmRelationshipDirection, DmRelationshipEntityType } from "@/lib/types"
import { getCachedBuildingName } from "@/lib/services/building-api.service"
import { fetchCharacterReferences, fetchCharacters } from "@/lib/services/character-api.service"
import { getCachedLandmarkName } from "@/lib/services/landmark-api.service"
import { getCachedOrganizationName } from "@/lib/services/organization-api.service"

function toOptionalTrimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function formatMissing(label: string) {
  return `${label}: No tiene esta informacion`
}

function formatDirection(direction: DmRelationshipDirection) {
  if (direction === "left-to-right") return "De izquierda a derecha"
  if (direction === "right-to-left") return "De derecha a izquierda"
  return "Bidireccional"
}

function formatEntityType(entityType: DmRelationshipEntityType) {
  if (entityType === "character") return "Personaje"
  if (entityType === "building") return "Edificio"
  if (entityType === "organization") return "Organizacion"
  return "Lugar"
}

type RelationshipLookup = {
  characterNameById: Map<number, string>
  landmarkNameById: Map<number, string>
  buildingNameById: Map<number, string>
  organizationNameById: Map<number, string>
}

function resolveEntityName(entityType: DmRelationshipEntityType, id: number, lookup: RelationshipLookup): string {
  if (!(typeof id === "number" && Number.isFinite(id) && id > 0)) {
    return UNKNOWN_LABEL
  }

  if (entityType === "character") {
    return lookup.characterNameById.get(id) ?? UNKNOWN_LABEL
  }

  if (entityType === "landmark") {
    return lookup.landmarkNameById.get(id) ?? getCachedLandmarkName(id)
  }

  if (entityType === "building") {
    return lookup.buildingNameById.get(id) ?? getCachedBuildingName(id)
  }

  return lookup.organizationNameById.get(id) ?? getCachedOrganizationName(id)
}

async function buildLookup(): Promise<RelationshipLookup> {
  const [refs, characters] = await Promise.all([
    fetchCharacterReferences().catch(() => null),
    fetchCharacters().catch(() => []),
  ])

  const characterNameById = new Map<number, string>()
  for (const character of characters) {
    const name = toOptionalTrimmedText(character.nombre)
    if (name) {
      characterNameById.set(character.id, name)
    }
  }

  const landmarkNameById = new Map<number, string>(refs?.landmarks?.map((l) => [l.id, l.nombre]) ?? [])
  const buildingNameById = new Map<number, string>(refs?.buildings?.map((b) => [b.id, b.nombre]) ?? [])
  const organizationNameById = new Map<number, string>(
    refs?.organizations?.map((o) => [o.id, o.nombre]) ?? [],
  )

  return { characterNameById, landmarkNameById, buildingNameById, organizationNameById }
}

// Formats a DmRelationship into a lore-focused text block for AI consumption.
// Notes:
// - Resolves entity ids to names while still outputting ids.
export async function dmRelationshipToText(relationship: DmRelationship): Promise<string> {
  const lookup = await buildLookup()
  const lines: string[] = []

  lines.push(`Relacion (id: ${relationship.id})`)

  const leftName = resolveEntityName(relationship.leftEntityType, relationship.leftEntityId, lookup)
  const rightName = resolveEntityName(relationship.rightEntityType, relationship.rightEntityId, lookup)

  lines.push(
    `Izquierda: ${formatEntityType(relationship.leftEntityType)} ${leftName} (id: ${relationship.leftEntityId})`,
  )
  lines.push(
    `Derecha: ${formatEntityType(relationship.rightEntityType)} ${rightName} (id: ${relationship.rightEntityId})`,
  )

  lines.push(`Direccion: ${formatDirection(relationship.direction)}`)

  const label = toOptionalTrimmedText(relationship.label)
  lines.push(label ? `Etiqueta: ${label}` : formatMissing("Etiqueta"))

  const notes = toOptionalTrimmedText(relationship.notes)
  lines.push(notes ? `Notas: ${notes}` : formatMissing("Notas"))

  return lines.join("\n")
}
