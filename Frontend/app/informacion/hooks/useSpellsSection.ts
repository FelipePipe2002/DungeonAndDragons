import { buildSpellItems } from "@/lib/informacion/spells"
import { loadSpells } from "@/lib/informacion/spells/store"
import { useInformationCatalogSection } from "./useInformationCatalogSection"

type UseSpellsSectionProps = {
  isActive: boolean
}

export function useSpellsSection({ isActive }: UseSpellsSectionProps) {
  const section = useInformationCatalogSection({
    isActive,
    load: loadSpells,
    buildItems: buildSpellItems,
    selectValue: (spellItem) => spellItem.spell,
    errorMessage: "No se pudieron cargar los spells.",
  })

  return {
    spellQuery: section.query,
    setSpellQuery: section.setQuery,
    spellItems: section.items,
    filteredSpells: section.filteredItems,
    selectedSpellId: section.selectedId,
    setSelectedSpellId: section.setSelectedId,
    selectedSpell: section.selectedItem,
    spellsStatus: section.status,
    spellsErrorMessage: section.error,
  }
}
