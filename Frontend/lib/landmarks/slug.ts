import type { Landmark } from "@/lib/types"

export function landmarkNameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function findLandmarkBySlug(landmarks: Landmark[], slug: string): Landmark | null {
  const normalizedSlug = slug.trim().toLowerCase()
  return landmarks.find((landmark) => landmarkNameToSlug(landmark.nombre) === normalizedSlug) ?? null
}
