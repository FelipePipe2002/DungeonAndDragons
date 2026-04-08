import type { Building, Character, DmRelationshipEntityType, Landmark, Organization } from "@/lib/types"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"

export type RelationshipEntityOption = {
  type: DmRelationshipEntityType
  id: number
  label: string
  subtitle?: string
}

function mergeById<T extends { id: number }>(...collections: T[][]): T[] {
  const byId = new Map<number, T>()
  for (const items of collections) {
    for (const item of items) {
      byId.set(item.id, item)
    }
  }
  return Array.from(byId.values())
}

export async function fetchRelationshipEntityOptions(): Promise<RelationshipEntityOption[]> {
  const [storedLandmarks, storedBuildings, storedCharacters, storedOrganizations] = await Promise.all([
    fetchLandmarks().catch(() => []),
    fetchBuildings().catch(() => []),
    fetchCharacters().catch(() => []),
    fetchOrganizations().catch(() => []),
  ])

  const landmarks = mergeById<Landmark>(storedLandmarks)
  const buildings = mergeById<Building>(
    landmarks.flatMap((landmark) =>
      (landmark.edificios ?? []).map((building) => ({
        ...building,
        landmarkId: building.landmarkId ?? landmark.id,
      })),
    ),
    storedBuildings,
  )
  const characters = mergeById<Character>(
    landmarks.flatMap((landmark) =>
      (landmark.personajes ?? []).map((character) => ({
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })),
    ),
    storedCharacters,
  )
  const organizations = mergeById<Organization>(storedOrganizations)

  const landmarkNameById = new Map<number, string>()
  for (const landmark of landmarks) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  return [
    ...characters.map((character) => ({
      type: "character" as const,
      id: character.id,
      label: character.nombre,
      subtitle: character.isPlayer ? "Jugador" : (landmarkNameById.get(character.landmarkId) ?? "NPC"),
    })),
    ...buildings.map((building) => ({
      type: "building" as const,
      id: building.id,
      label: building.nombre,
      subtitle:
        typeof building.landmarkId === "number" ? (landmarkNameById.get(building.landmarkId) ?? undefined) : undefined,
    })),
    ...organizations.map((organization) => ({
      type: "organization" as const,
      id: organization.id,
      label: organization.nombre,
      subtitle:
        typeof organization.landmarks[0] === "number"
          ? (landmarkNameById.get(organization.landmarks[0]) ?? undefined)
          : undefined,
    })),
    ...landmarks.map((landmark) => ({
      type: "landmark" as const,
      id: landmark.id,
      label: landmark.nombre,
      subtitle: landmark.tipo,
    })),
  ].sort((left, right) => left.label.localeCompare(right.label, "es"))
}
