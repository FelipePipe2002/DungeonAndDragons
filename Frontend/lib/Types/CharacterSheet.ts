export const CHARACTER_SHEET_ABILITY_SCORES = ["str", "dex", "con", "int", "wis", "cha"] as const

export type CharacterSheetAbilityScore = (typeof CHARACTER_SHEET_ABILITY_SCORES)[number]

export const CHARACTER_SHEET_SKILLS = [
  "Athletics",
  "Acrobatics",
  "Sleight of Hand",
  "Stealth",
  "Arcana",
  "History",
  "Investigation",
  "Nature",
  "Religion",
  "Animal Handling",
  "Insight",
  "Medicine",
  "Perception",
  "Survival",
  "Deception",
  "Intimidation",
  "Performance",
  "Persuasion",
] as const

export type CharacterSheetSkill = (typeof CHARACTER_SHEET_SKILLS)[number]

export const CHARACTER_SHEET_SKILL_ABILITY_SCORES = {
  Athletics: "str",
  Acrobatics: "dex",
  "Sleight of Hand": "dex",
  Stealth: "dex",
  Arcana: "int",
  History: "int",
  Investigation: "int",
  Nature: "int",
  Religion: "int",
  "Animal Handling": "wis",
  Insight: "wis",
  Medicine: "wis",
  Perception: "wis",
  Survival: "wis",
  Deception: "cha",
  Intimidation: "cha",
  Performance: "cha",
  Persuasion: "cha",
} satisfies Record<CharacterSheetSkill, CharacterSheetAbilityScore>

export interface CharacterSheetAbilityScoreEntry {
  score: number
  saving: boolean
}

export type CharacterSheetAbilityScores = Record<CharacterSheetAbilityScore, CharacterSheetAbilityScoreEntry>
export type CharacterSheetSkills = Record<CharacterSheetSkill, boolean>

export interface CharacterSheetClass {
  name: string
  subtype?: string
  level: number
  hit_die: string
}

export interface CharacterSheetHitPoints {
  max: number
  current: number
}

export interface CharacterSheetArmorClass {
  value: number
}

export interface CharacterSheetDetails {
  personality: string
  ideal: string
  bond: string
  flaw: string
}

export interface CharacterSheetWeapon {
  name: string
  damage: string
  damage_type: string
  properties: string[]
  mastery: boolean
  mastery_description?: string
}

export interface CharacterSheetArmor {
  name: string
  ac_bonus: number
  dex_bonus: boolean
  capped_dex_bonus: number | null
  stealth_disadvantage: boolean
}

export interface CharacterSheet {
  name: string
  race: string
  alignment: string
  background: string
  competence_bonus: number
  classes: CharacterSheetClass[]
  speed: number
  hit_points: CharacterSheetHitPoints
  ability_scores: CharacterSheetAbilityScores
  skills: CharacterSheetSkills
  armor_class: CharacterSheetArmorClass
  languages: string[]
  details: CharacterSheetDetails
  competences: string[]
  weapons: CharacterSheetWeapon[]
  armor: CharacterSheetArmor
  inventory: string[]
}

export type characterSheet = CharacterSheet
