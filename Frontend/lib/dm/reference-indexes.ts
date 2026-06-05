import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building, Character, Landmark, Organization } from "@/lib/types"

export type ReferenceIndexes = {
  landmarksById: Map<number, Landmark>
  buildingsById: Map<number, Building>
  charactersById: Map<number, Character>
  organizationsById: Map<number, Organization>
  landmarkNameById: Map<number, string>
  buildingNameById: Map<number, string>
  organizationNameById: Map<number, string>
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

export async function buildReferenceIndexes(): Promise<ReferenceIndexes> {
  const storedLandmarks = await fetchLandmarks().catch(() => [])
  const landmarks = mergeById(storedLandmarks)
  const landmarkNameById = new Map<number, string>()
  for (const landmark of landmarks) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  const buildings = mergeById(
    landmarks.flatMap((landmark) =>
      (landmark.edificios ?? []).map((building) => ({
        ...building,
        landmarkId: building.landmarkId ?? landmark.id,
      })),
    ),
    await fetchBuildings().catch(() => []),
  )

  const characters = mergeById(
    landmarks.flatMap((landmark) =>
      (landmark.personajes ?? []).map((character) => ({
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })),
    ),
    await fetchCharacters().catch(() => []),
  )

  const organizations = await fetchOrganizations().catch(() => [])

  const buildingNameById = new Map<number, string>()
  for (const building of buildings) {
    buildingNameById.set(building.id, building.nombre)
  }

  const organizationNameById = new Map<number, string>()
  for (const organization of organizations) {
    organizationNameById.set(organization.id, organization.nombre)
  }

  return {
    landmarksById: new Map(landmarks.map((item) => [item.id, item])),
    buildingsById: new Map(buildings.map((item) => [item.id, item])),
    charactersById: new Map(characters.map((item) => [item.id, item])),
    organizationsById: new Map(organizations.map((item) => [item.id, item])),
    landmarkNameById,
    buildingNameById,
    organizationNameById,
  }
}
