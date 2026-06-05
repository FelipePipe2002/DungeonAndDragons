import { buildAssetUrl } from "@/lib/services/asset-api.service"
import type { Landmark, LandmarkType } from "@/lib/types"

export const LANDMARK_TYPE_LABELS: Record<LandmarkType, string> = {
  ciudad: "Ciudad",
  pueblo: "Pueblo",
  aldea: "Aldea",
  fuerte: "Fuerte",
  puente: "Puente",
  bandera: "Bandera",
  campamento: "Campamento",
  mazmorra: "Mazmorra",
}

export function isLandmarkImageIcon(value: string | undefined) {
  if (!value) return false

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.includes("/")
  )
}

export function fallbackLandmarkIconForType(tipo: LandmarkType) {
  if (tipo === "ciudad") return "🏰"
  if (tipo === "pueblo") return "🏘️"
  if (tipo === "aldea") return "🏡"
  if (tipo === "fuerte") return "🏯"
  if (tipo === "puente") return "🌉"
  if (tipo === "bandera") return "🚩"
  if (tipo === "campamento") return "⛺"
  if (tipo === "mazmorra") return "🗿"
  return "📍"
}

function assetFileToPublicUrl(filename: string) {
  if (
    filename.startsWith("/") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://") ||
    filename.startsWith("data:")
  ) {
    return filename
  }

  return `/maps/${filename}`
}

export function getLandmarkMapUrlFromReference(landmark: Landmark): string | null {
  if (typeof landmark.mapAssetId === "number" && landmark.mapAssetId > 0) {
    return buildAssetUrl(landmark.mapAssetId)
  }

  const ref = landmark.mapa
  if (!ref) return null

  if (ref.kind === "embedded") return ref.dataUrl
  if (ref.kind === "external") return ref.url
  if (ref.kind === "asset") return assetFileToPublicUrl(ref.filename)

  if (ref.kind === "stored") {
    const assetId = Number.parseInt(ref.key, 10)
    if (Number.isFinite(assetId) && assetId > 0) {
      return buildAssetUrl(assetId)
    }
    return null
  }

  if (ref.kind === "buildings") {
    if (ref.source === "external") {
      return ref.url
    }

    return assetFileToPublicUrl(ref.filename)
  }

  return null
}
