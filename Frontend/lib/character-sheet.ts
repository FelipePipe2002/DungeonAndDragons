import {
  CHARACTER_SHEET_ABILITY_SCORES,
  CHARACTER_SHEET_SKILLS,
  type CharacterSheet,
  type CharacterSheetAbilityScore,
  type CharacterSheetAbilityScoreEntry,
  type CharacterSheetSkill,
} from "@/lib/types"

type CharacterSheetSeed = {
  nombre: string
  raza: string
  clase: string
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function toTrimmedText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizeHitDie(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `d${value}`
  }

  return fallback
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function normalizeSpeed(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const entry of Object.values(value)) {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return entry
      }
    }
  }

  return fallback
}

function toAbilityScoreEntry(value: unknown): CharacterSheetAbilityScoreEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { score: 10, saving: false }
  }

  const nextValue = value as Partial<CharacterSheetAbilityScoreEntry>
  return {
    score: toFiniteNumber(nextValue.score, 10),
    saving: nextValue.saving === true,
  }
}

function createDefaultAbilityScores(): CharacterSheet["ability_scores"] {
  const result = {} as CharacterSheet["ability_scores"]
  for (const abilityScore of CHARACTER_SHEET_ABILITY_SCORES) {
    result[abilityScore] = { score: 10, saving: false }
  }
  return result
}

function createDefaultSkills(): CharacterSheet["skills"] {
  const result = {} as CharacterSheet["skills"]
  for (const skill of CHARACTER_SHEET_SKILLS) {
    result[skill] = false
  }
  return result
}

function normalizeClasses(value: unknown, clase: string): CharacterSheet["classes"] {
  const normalizedClass = clase.trim()
  const fallback = [{ name: normalizedClass, subtype: "", level: 1, hit_die: "" }]
  if (!Array.isArray(value) || value.length === 0) {
    return fallback
  }

  const result = value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry, index) => ({
      name: index === 0 ? normalizedClass : toTrimmedText(entry.name),
      subtype: toTrimmedText(entry.subtype),
      level: toFiniteNumber(entry.level, index === 0 ? 1 : 0),
      hit_die: normalizeHitDie(entry.hit_die),
    }))
    .filter((entry, index) => index === 0 || entry.name.length > 0)

  return result.length > 0 ? result : fallback
}

function normalizeAbilityScores(value: unknown): CharacterSheet["ability_scores"] {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Record<CharacterSheetAbilityScore, unknown>>)
      : {}
  const result = createDefaultAbilityScores()

  for (const abilityScore of CHARACTER_SHEET_ABILITY_SCORES) {
    result[abilityScore] = toAbilityScoreEntry(input[abilityScore])
  }

  return result
}

function normalizeSkills(value: unknown): CharacterSheet["skills"] {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<Record<CharacterSheetSkill, unknown>>)
      : {}
  const result = createDefaultSkills()

  for (const skill of CHARACTER_SHEET_SKILLS) {
    result[skill] = input[skill] === true
  }

  return result
}

export function createEmptyCharacterSheetDraft(seed: CharacterSheetSeed): CharacterSheet {
  return {
    name: seed.nombre.trim(),
    race: seed.raza.trim(),
    alignment: "",
    background: "",
    competence_bonus: 0,
    classes: normalizeClasses([], seed.clase),
    speed: 30,
    hit_points: {
      max: 0,
      current: 0,
    },
    ability_scores: createDefaultAbilityScores(),
    skills: createDefaultSkills(),
    armor_class: {
      value: 0,
    },
    languages: [],
    details: {
      personality: "",
      ideal: "",
      bond: "",
      flaw: "",
    },
    competences: [],
    weapons: [],
    armor: {
      name: "",
      ac_bonus: 0,
      dex_bonus: false,
      capped_dex_bonus: null,
      stealth_disadvantage: false,
    },
    inventory: [],
  }
}

export function normalizeCharacterSheet(
  value: CharacterSheet | null | undefined,
  seed: CharacterSheetSeed,
): CharacterSheet | null {
  if (!value) {
    return null
  }

  const fallback = createEmptyCharacterSheetDraft(seed)
  const cappedDexBonus = value.armor?.capped_dex_bonus

  return {
    name: seed.nombre.trim(),
    race: seed.raza.trim(),
    alignment: toTrimmedText(value.alignment),
    background: toTrimmedText(value.background),
    competence_bonus: toFiniteNumber(value.competence_bonus, 0),
    classes: normalizeClasses(value.classes, seed.clase),
    speed: normalizeSpeed(value.speed, fallback.speed),
    hit_points: {
      max: toFiniteNumber(value.hit_points?.max, 0),
      current: toFiniteNumber(value.hit_points?.current, 0),
    },
    ability_scores: normalizeAbilityScores(value.ability_scores),
    skills: normalizeSkills(value.skills),
    armor_class: {
      value: toFiniteNumber(value.armor_class?.value, 0),
    },
    languages: toStringList(value.languages),
    details: {
      personality: toTrimmedText(value.details?.personality),
      ideal: toTrimmedText(value.details?.ideal),
      bond: toTrimmedText(value.details?.bond),
      flaw: toTrimmedText(value.details?.flaw),
    },
    competences: toStringList(value.competences),
    weapons: Array.isArray(value.weapons)
      ? value.weapons
          .filter((entry): entry is NonNullable<CharacterSheet["weapons"]>[number] => !!entry && typeof entry === "object")
          .map((entry) => ({
            name: toTrimmedText(entry.name),
            damage: toTrimmedText(entry.damage),
            damage_type: toTrimmedText(entry.damage_type),
            properties: toStringList(entry.properties),
            mastery: entry.mastery === true,
            mastery_description: toTrimmedText(entry.mastery_description),
          }))
      : [],
    armor: {
      name: toTrimmedText(value.armor?.name),
      ac_bonus: toFiniteNumber(value.armor?.ac_bonus, 0),
      dex_bonus: value.armor?.dex_bonus === true,
      capped_dex_bonus:
        typeof cappedDexBonus === "number" && Number.isFinite(cappedDexBonus) ? cappedDexBonus : null,
      stealth_disadvantage: value.armor?.stealth_disadvantage === true,
    },
    inventory: toStringList(value.inventory),
  }
}
