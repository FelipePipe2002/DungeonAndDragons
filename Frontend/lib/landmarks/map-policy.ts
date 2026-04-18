import type { Landmark, LandmarkMapReference, LandmarkType, MediaAssetKind } from "@/lib/types"

export type LandmarkMapMode = "image" | "buildings-json" | "dungeon-json" | "unsupported"

type LandmarkMapDescriptor = Pick<Landmark, "tipo" | "mapAssetKind" | "mapa">

export function isJsonMapReference(value: string | null | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()

  return (
    normalized.startsWith("data:application/json") ||
    normalized.startsWith("data:text/json") ||
    normalized.endsWith(".json") ||
    normalized.includes(".json?")
  )
}

function isJsonReferenceCandidate(reference: LandmarkMapReference | undefined, mapUrl: string | null | undefined) {
  if (!reference) {
    return isJsonMapReference(mapUrl)
  }

  if (reference.kind === "embedded") return isJsonMapReference(reference.dataUrl)
  if (reference.kind === "external") return isJsonMapReference(reference.url)
  if (reference.kind === "asset") return isJsonMapReference(reference.filename)
  if (reference.kind === "stored") return isJsonMapReference(reference.key)
  if (reference.kind === "buildings") return isJsonMapReference(reference.source === "external" ? reference.url : reference.filename)

  return false
}

export function isDungeonJsonDocument(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Boolean(parsed && typeof parsed === "object" && (parsed as { type?: unknown }).type === "mazmorra")
  } catch {
    return false
  }
}

export function resolveLandmarkMapMode(
  landmark: LandmarkMapDescriptor | null | undefined,
  mapUrl: string | null | undefined,
): LandmarkMapMode {
  if (!landmark) {
    return "unsupported"
  }

  const hasMapUrl = typeof mapUrl === "string" && mapUrl.trim().length > 0
  const hasMapReference = Boolean(landmark.mapa)
  if (!hasMapUrl && !hasMapReference) {
    return "unsupported"
  }

  const usesJsonAsset = landmark.mapAssetKind === "json"
  const usesBuildingsReference = landmark.mapa?.kind === "buildings"
  const usesJsonReference = isJsonReferenceCandidate(landmark.mapa, mapUrl)

  if (landmark.tipo === "mazmorra") {
    if (usesBuildingsReference) return "unsupported"
    if (usesJsonAsset) return "dungeon-json"
    if (usesJsonReference) return "unsupported"
    return "image"
  }

  if (usesJsonAsset || usesBuildingsReference || usesJsonReference) {
    return "buildings-json"
  }

  return "image"
}

export function isDungeonLandmarkMapAllowed(
  landmarkType: LandmarkType | null | undefined,
  mapAssetKind: MediaAssetKind | undefined,
  mapReference: LandmarkMapReference | undefined,
  mapUrl: string | null | undefined,
) {
  if (landmarkType !== "mazmorra") {
    return true
  }

  return (
    resolveLandmarkMapMode(
      {
        tipo: landmarkType,
        mapAssetKind,
        mapa: mapReference,
      },
      mapUrl,
    ) !== "unsupported"
  )
}
