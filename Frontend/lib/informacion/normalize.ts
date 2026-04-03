import {
  CONDITION_HEX_COLOR_REGEX,
  CONDITION_TEXT_TAG_REGEX,
  DEFAULT_CONDITION_COLOR,
} from "@/lib/informacion/constants"

export function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("es")
}

export function normalizeConditionText(raw: string) {
  return raw.replace(CONDITION_TEXT_TAG_REGEX, "$1").replace(/\s+/g, " ").trim()
}

export function normalizeConditionColor(rawColor: unknown) {
  const parsed = typeof rawColor === "string" ? rawColor.trim() : ""
  return CONDITION_HEX_COLOR_REGEX.test(parsed) ? parsed : DEFAULT_CONDITION_COLOR
}
