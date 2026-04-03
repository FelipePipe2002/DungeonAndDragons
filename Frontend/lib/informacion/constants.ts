export const CONDITION_TEXT_TAG_REGEX = /\{@[^}]+\s([^}]+)\}/g
export const CONDITION_HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i
export const DEFAULT_CONDITION_COLOR = "#6b7280"

export const SPELL_SCHOOL_TONES: Record<string, { accent: string; soft: string }> = {
  A: { accent: "#355d8d", soft: "rgba(53, 93, 141, 0.14)" },
  C: { accent: "#417a66", soft: "rgba(65, 122, 102, 0.14)" },
  D: { accent: "#5d5f8c", soft: "rgba(93, 95, 140, 0.14)" },
  E: { accent: "#8a4f7a", soft: "rgba(138, 79, 122, 0.14)" },
  I: { accent: "#6b5a9d", soft: "rgba(107, 90, 157, 0.14)" },
  N: { accent: "#7a4456", soft: "rgba(122, 68, 86, 0.14)" },
  T: { accent: "#7f6a39", soft: "rgba(127, 106, 57, 0.14)" },
  V: { accent: "#8c4f2a", soft: "rgba(140, 79, 42, 0.14)" },
}

export const DEFAULT_SPELL_SCHOOL_TONE = { accent: "#7d3e1d", soft: "rgba(125, 62, 29, 0.14)" }

export const FEAT_CATEGORY_TONES: Record<string, string> = {
  G: "#7d3e1d",
  O: "#8a4f2a",
  EB: "#6a4f8f",
  FS: "#355d8d",
  "FS:P": "#355d8d",
  "FS:R": "#355d8d",
}

export const DEFAULT_FEAT_CATEGORY_TONE = "#7d3e1d"
export const RULE_TONE = "#6d533b"

export function getSpellSchoolTone(schoolCode: string) {
  return SPELL_SCHOOL_TONES[schoolCode] ?? DEFAULT_SPELL_SCHOOL_TONE
}

export function getFeatCategoryTone(categoryCode: string) {
  return FEAT_CATEGORY_TONES[categoryCode] ?? DEFAULT_FEAT_CATEGORY_TONE
}

export function getRuleTone() {
  return RULE_TONE
}
