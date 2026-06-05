import { buildFeatItems } from "@/lib/informacion/feats"
import { loadFeats } from "@/lib/informacion/feats/store"
import { useInformationCatalogSection } from "./useInformationCatalogSection"

type UseFeatsSectionProps = {
  isActive: boolean
}

export function useFeatsSection({ isActive }: UseFeatsSectionProps) {
  const section = useInformationCatalogSection({
    isActive,
    load: loadFeats,
    buildItems: buildFeatItems,
    selectValue: (featItem) => featItem.feat,
    errorMessage: "No se pudieron cargar los feats.",
  })

  return {
    featQuery: section.query,
    setFeatQuery: section.setQuery,
    featItems: section.items,
    filteredFeats: section.filteredItems,
    selectedFeatId: section.selectedId,
    setSelectedFeatId: section.setSelectedId,
    selectedFeat: section.selectedItem,
    featsStatus: section.status,
    featsErrorMessage: section.error,
  }
}
