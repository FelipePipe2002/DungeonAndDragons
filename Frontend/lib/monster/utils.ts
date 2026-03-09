import type { MonsterListItem, MonsterRecord } from "@/lib/monster/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

export function normalizeBestiaryLocalImagePath(rawPath: string): string {
  const value = rawPath.trim()
  const bestiaryPrefix = "/img/bestiary/"

  if (!value.startsWith(bestiaryPrefix)) {
    return value
  }

  const suffixIndex = value.search(/[?#]/)
  const pathname = suffixIndex >= 0 ? value.slice(0, suffixIndex) : value
  const suffix = suffixIndex >= 0 ? value.slice(suffixIndex) : ""
  const encodedFileName = pathname.slice(bestiaryPrefix.length)
  if (!encodedFileName) {
    return value
  }

  let decodedFileName = encodedFileName
  try {
    decodedFileName = decodeURIComponent(encodedFileName)
  } catch {
    decodedFileName = encodedFileName
  }

  const normalizedFileName = decodedFileName.replace(/\s+/g, "_")
  return `${bestiaryPrefix}${encodeURIComponent(normalizedFileName)}${suffix}`
}

function extractFirstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/)
    if (!match) return null
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractFirstNumber(item)
      if (parsed !== null) return parsed
    }
  }

  if (isRecord(value)) {
    for (const candidate of Object.values(value)) {
      const parsed = extractFirstNumber(candidate)
      if (parsed !== null) return parsed
    }
  }

  return null
}

function formatTypeTag(tag: unknown): string {
  if (typeof tag === "string") {
    return cleanText(tag)
  }

  if (!isRecord(tag)) {
    return ""
  }

  const baseTag = cleanText(tag.tag)
  const prefix = cleanText(tag.prefix)
  const suffix = cleanText(tag.suffix)
  const prefixText = prefix && tag.prefixHidden !== true ? `${prefix} ` : ""
  const suffixText = suffix && tag.suffixHidden !== true ? ` ${suffix}` : ""
  const composed = `${prefixText}${baseTag}${suffixText}`.trim()
  return composed || baseTag
}

export function formatMonsterType(typeValue: unknown): string {
  if (typeof typeValue === "string") {
    return cleanText(typeValue)
  }

  if (!isRecord(typeValue)) {
    return ""
  }

  const baseType = cleanText(typeValue.type)
  const tags = Array.isArray(typeValue.tags) ? typeValue.tags.map(formatTypeTag).filter(Boolean) : []

  if (baseType && tags.length > 0) {
    return `${baseType} (${tags.join(", ")})`
  }

  if (baseType) {
    return baseType
  }

  return tags.join(", ")
}

export function formatMonsterCrCompact(crValue: unknown): string {
  if (typeof crValue === "string") {
    return cleanText(crValue)
  }

  if (typeof crValue === "number" && Number.isFinite(crValue)) {
    return String(crValue)
  }

  if (isRecord(crValue)) {
    const baseCr = cleanText(crValue.cr)
    if (baseCr) return baseCr

    const lairCr = cleanText(crValue.lair)
    if (lairCr) return lairCr
  }

  const parsed = extractFirstNumber(crValue)
  return parsed === null ? "" : String(parsed)
}

export function extractMonsterHpAverage(hpValue: unknown): number | null {
  if (typeof hpValue === "number" && Number.isFinite(hpValue)) {
    return Math.trunc(hpValue)
  }

  if (isRecord(hpValue)) {
    const average = extractFirstNumber(hpValue.average)
    if (average !== null) return Math.trunc(average)
  }

  const parsed = extractFirstNumber(hpValue)
  return parsed === null ? null : Math.trunc(parsed)
}

function toModifier(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const cleaned = value.trim()
    if (!cleaned) return null
    const parsed = Number.parseInt(cleaned.replace(/^\+/, ""), 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getDexModifier(monster: MonsterRecord): number {
  const dexScore = extractFirstNumber(monster.dex)
  if (dexScore === null) {
    return 0
  }

  return Math.floor((dexScore - 10) / 2)
}

export function extractMonsterInitiativeModifier(monster: MonsterRecord): number {
  const initiative = monster.initiative

  if (typeof initiative === "number" || typeof initiative === "string") {
    const parsed = toModifier(initiative)
    if (parsed !== null) return parsed
  }

  if (isRecord(initiative)) {
    const bonus = toModifier(initiative.bonus)
    if (bonus !== null) return bonus

    const proficiency = toModifier(initiative.proficiency)
    if (proficiency !== null) {
      return getDexModifier(monster) + proficiency
    }
  }

  return getDexModifier(monster)
}

function normalizeImageUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value
  }

  if (value.startsWith("/")) {
    return normalizeBestiaryLocalImagePath(value)
  }

  if (value.startsWith("img/")) {
    return `https://5e.tools/${value}`
  }

  return null
}

function readFluffImage(monster: MonsterRecord): string | null {
  const fluff = monster.fluff
  if (!isRecord(fluff) || !Array.isArray(fluff.images) || fluff.images.length === 0) {
    return null
  }

  const firstImage = fluff.images[0]
  if (!isRecord(firstImage) || !isRecord(firstImage.href)) {
    return null
  }

  const path = cleanText(firstImage.href.path)
  if (!path) return null

  return normalizeImageUrl(path)
}

export function resolveMonsterImage(monster: MonsterRecord): string | null {
  const imageKeys = ["image", "img", "tokenImage", "token", "tokenUrl", "portrait", "portraitUrl"]

  for (const key of imageKeys) {
    const value = monster[key]
    if (typeof value === "string") {
      const normalized = normalizeImageUrl(value)
      if (normalized) return normalized
    }
  }

  return readFluffImage(monster)
}

export function buildMonsterListItem(monster: MonsterRecord): MonsterListItem | null {
  const name = cleanText(monster.name)
  if (!name) return null

  return {
    name,
    nameExact: name,
    type: formatMonsterType(monster.type),
    cr: formatMonsterCrCompact(monster.cr),
    hpAverage: extractMonsterHpAverage(monster.hp),
    initiativeModifier: extractMonsterInitiativeModifier(monster),
    image: resolveMonsterImage(monster),
  }
}

export function normalizeMonsterRecord(input: unknown): MonsterRecord | null {
  if (!isRecord(input)) return null

  return input as MonsterRecord
}
