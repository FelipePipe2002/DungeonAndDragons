import type { Spell, SpellBrowserItem } from "@/lib/informacion/types"

function flattenSpellEntryText(spell: Spell): string[] {
  return [
    ...spell.description.flatMap((entry) => [entry.name ?? "", entry.text]),
    ...spell.higherLevel.flatMap((entry) => [entry.name ?? "", entry.text]),
  ].filter(Boolean)
}

export function buildSpellSearchText(spell: Spell) {
  const chunks = [
    spell.name,
    spell.levelLabel,
    spell.schoolLabel,
    spell.castingTimeLabel,
    spell.range,
    spell.components,
    spell.duration,
    ...spell.damageTypes,
    ...spell.savingThrows,
    ...flattenSpellEntryText(spell),
  ]

  return chunks.join(" ").toLocaleLowerCase("es")
}

export function buildSpellItems(spells: Spell[]): SpellBrowserItem[] {
  return spells
    .map((spell, index) => {
      return {
        id: `${spell.name.toLocaleLowerCase("es")}::${spell.level ?? "?"}::${index}`,
        spell,
        searchText: buildSpellSearchText(spell),
      } satisfies SpellBrowserItem
    })
    .sort((a, b) => {
      const levelA = typeof a.spell.level === "number" ? a.spell.level : Number.MAX_SAFE_INTEGER
      const levelB = typeof b.spell.level === "number" ? b.spell.level : Number.MAX_SAFE_INTEGER
      if (levelA !== levelB) {
        return levelA - levelB
      }

      return a.spell.name.localeCompare(b.spell.name, "es")
    })
}
