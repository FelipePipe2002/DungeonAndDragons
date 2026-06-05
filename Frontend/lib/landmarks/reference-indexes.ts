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

export function buildReferenceIndexes(
  allLandmarks: Landmark[],
  currentLandmark: Landmark | null,
  storedBuildings: Building[],
  storedCharacters: Character[],
  storedOrganizations: Organization[],
): ReferenceIndexes {
  const landmarksById = new Map<number, Landmark>()
  const buildingsById = new Map<number, Building>()
  const charactersById = new Map<number, Character>()
  const organizationsById = new Map<number, Organization>()

  for (const storedLandmark of allLandmarks) {
    landmarksById.set(storedLandmark.id, storedLandmark)
  }
  if (currentLandmark) {
    landmarksById.set(currentLandmark.id, currentLandmark)
  }

  // Include nested character entities so relation ids still resolve even before full reloads.
  for (const landmark of landmarksById.values()) {
    for (const character of landmark.personajes ?? []) {
      charactersById.set(character.id, {
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })
    }
  }

  for (const building of storedBuildings) {
    buildingsById.set(building.id, building)
  }
  for (const character of storedCharacters) {
    charactersById.set(character.id, character)
  }
  for (const organization of storedOrganizations) {
    organizationsById.set(organization.id, organization)
  }

  const landmarkNameById = new Map<number, string>()
  for (const [id, item] of landmarksById) {
    landmarkNameById.set(id, item.nombre)
  }

  const buildingNameById = new Map<number, string>()
  for (const [id, item] of buildingsById) {
    buildingNameById.set(id, item.nombre)
  }

  const organizationNameById = new Map<number, string>()
  for (const [id, item] of organizationsById) {
    organizationNameById.set(id, item.nombre)
  }

  return {
    landmarksById,
    buildingsById,
    charactersById,
    organizationsById,
    landmarkNameById,
    buildingNameById,
    organizationNameById,
  }
}
