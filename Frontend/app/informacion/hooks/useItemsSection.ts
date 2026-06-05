import { buildItemItems } from "@/lib/informacion/items"
import { loadItems } from "@/lib/informacion/items/store"
import { useInformationCatalogSection } from "./useInformationCatalogSection"

type UseItemsSectionProps = {
  isActive: boolean
}

export function useItemsSection({ isActive }: UseItemsSectionProps) {
  const section = useInformationCatalogSection({
    isActive,
    load: loadItems,
    buildItems: buildItemItems,
    selectValue: (itemEntry) => itemEntry.item,
    errorMessage: "No se pudieron cargar los items.",
  })

  return {
    itemQuery: section.query,
    setItemQuery: section.setQuery,
    itemItems: section.items,
    filteredItems: section.filteredItems,
    selectedItemId: section.selectedId,
    setSelectedItemId: section.setSelectedId,
    selectedItem: section.selectedItem,
    itemsStatus: section.status,
    itemsErrorMessage: section.error,
  }
}
