import type { Building } from "@/lib/types"
import { createBuilding } from "@/lib/services/building-api.service"

type BuildingInput = Omit<Building, "id">

const KNOWN_LABELS = new Set([
  "Edificio",
  "Lugar",
  "Landmark",
  "Dueno",
  "Dueño",
  "Organizacion",
  "Organización",
  "Descripcion",
  "Descripción",
  "Etiquetas",
])

function toLines(text: string) {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function parseLabeledLine(line: string): { label: string; value: string } | null {
  const idx = line.indexOf(":")
  if (idx <= 0) return null
  const label = line.slice(0, idx).trim()
  const value = line.slice(idx + 1).trim()
  if (!label || !KNOWN_LABELS.has(label)) return null
  return { label, value }
}

function isMissingValue(value: string) {
  return value.toLowerCase().includes("no tiene esta informacion")
}

function extractFirstId(value: string): number | null {
  // Supports "Dueno: 1" and "Dueno: Juan (id: 1)".
  const match = value.match(/\b(\d+)\b/)
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) && id > 0 ? id : null
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const v = raw.trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(v)
  }
  return result
}

function parseTags(value: string): string[] {
  if (!value || isMissingValue(value)) return []
  return dedupeStrings(value.split(",").map((part) => part.trim()).filter(Boolean))
}

function parseBuildingName(value: string): string {
  // Accept "Bar de Juan (id: 7)" but store only the name.
  const name = value.replace(/\(id:\s*\d+\)\s*$/i, "").trim()
  return name
}

export function parseBuildingFromText(text: string): BuildingInput {
  const lines = toLines(text)

  const result: BuildingInput = {
    landmarkId: null,
    nombre: "",
    posicion: undefined,
    descripcion: "",
    tags: [],
    duenoId: undefined,
    duenoNombre: undefined,
    mapBuildingIndex: undefined,
    organizationId: undefined,
    mapAssetId: undefined,
    mapAssetKind: undefined,
    mapRotationDegrees: 0,
    mapGridEnabled: false,
    mapGridCellSize: 48,
    mapGridOffsetX: 0,
    mapGridOffsetY: 0,
    mapa: undefined,
  }

  let i = 0
  while (i < lines.length) {
    const parsed = parseLabeledLine(lines[i])

    if (!parsed) {
      i += 1
      continue
    }

    const { label, value } = parsed

    if (label === "Edificio") {
      if (!isMissingValue(value)) {
        result.nombre = parseBuildingName(value)
      }
      i += 1
      continue
    }

    if (label === "Lugar" || label === "Landmark") {
      if (!isMissingValue(value)) {
        result.landmarkId = extractFirstId(value)
      }
      i += 1
      continue
    }

    if (label === "Dueno" || label === "Dueño") {
      if (!isMissingValue(value)) {
        result.duenoId = extractFirstId(value) ?? undefined
      }
      i += 1
      continue
    }

    if (label === "Organizacion" || label === "Organización") {
      if (!isMissingValue(value)) {
        result.organizationId = extractFirstId(value) ?? undefined
      }
      i += 1
      continue
    }

    if (label === "Etiquetas") {
      result.tags = parseTags(value)
      i += 1
      continue
    }

    if (label === "Descripcion" || label === "Descripción") {
      if (isMissingValue(value)) {
        result.descripcion = ""
        i += 1
        continue
      }

      const descriptionLines: string[] = []
      if (value) descriptionLines.push(value)

      let j = i + 1
      while (j < lines.length) {
        const maybeNext = parseLabeledLine(lines[j])
        if (maybeNext) break
        descriptionLines.push(lines[j])
        j += 1
      }

      result.descripcion = descriptionLines.join("\n").trim()
      i = j
      continue
    }

    i += 1
  }

  if (!result.nombre.trim()) {
    throw new Error("No se pudo parsear el nombre del edificio (Edificio: ...).")
  }

  // Normalize landmarkId: keep null if not present/invalid.
  if (typeof result.landmarkId !== "number" || !Number.isFinite(result.landmarkId) || result.landmarkId <= 0) {
    result.landmarkId = null
  }

  return result
}

export async function createBuildingFromText(text: string): Promise<Building> {
  const input = parseBuildingFromText(text)
  return createBuilding(input)
}
