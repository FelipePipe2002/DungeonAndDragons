import { buildRuleItems } from "@/lib/informacion/rules"
import { loadRules } from "@/lib/informacion/rules/store"
import { useInformationCatalogSection } from "./useInformationCatalogSection"

type UseRulesSectionProps = {
  isActive: boolean
}

export function useRulesSection({ isActive }: UseRulesSectionProps) {
  const section = useInformationCatalogSection({
    isActive,
    load: loadRules,
    buildItems: buildRuleItems,
    selectValue: (ruleItem) => ruleItem.rule,
    errorMessage: "No se pudieron cargar las reglas.",
  })

  return {
    ruleQuery: section.query,
    setRuleQuery: section.setQuery,
    ruleItems: section.items,
    filteredRules: section.filteredItems,
    selectedRuleId: section.selectedId,
    setSelectedRuleId: section.setSelectedId,
    selectedRule: section.selectedItem,
    rulesStatus: section.status,
    rulesErrorMessage: section.error,
  }
}
