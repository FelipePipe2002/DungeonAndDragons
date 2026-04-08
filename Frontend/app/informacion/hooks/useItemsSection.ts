import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { buildItemItems } from "@/lib/informacion/items"
import { normalizeSearch } from "@/lib/informacion/normalize"
import type { ItemBrowserItem } from "@/lib/informacion/types"
import { loadItems } from "@/lib/items/item-store"

type UseItemsSectionProps = {
  isActive: boolean
}

export function useItemsSection({ isActive }: UseItemsSectionProps) {
  const [itemQuery, setItemQuery] = useState("")
  const [itemItems, setItemItems] = useState<ItemBrowserItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState("")
  const [itemsStatus, setItemsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [itemsErrorMessage, setItemsErrorMessage] = useState("")

  const deferredItemQuery = useDeferredValue(itemQuery)
  const normalizedItemQuery = normalizeSearch(deferredItemQuery)

  const filteredItems = useMemo(() => {
    return itemItems.filter((itemEntry) => {
      if (!normalizedItemQuery) {
        return true
      }

      return itemEntry.searchText.includes(normalizedItemQuery)
    })
  }, [itemItems, normalizedItemQuery])

  useEffect(() => {
    if (!isActive || itemItems.length > 0) {
      return
    }

    let cancelled = false
    setItemsStatus("loading")
    setItemsErrorMessage("")

    async function loadItemList() {
      try {
        const loadedItems = await loadItems()
        if (cancelled) {
          return
        }

        const nextItemItems = buildItemItems(loadedItems)
        setItemItems(nextItemItems)
        setSelectedItemId(nextItemItems[0]?.id ?? "")
        setItemsStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setItemsStatus("error")
        setItemsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los items.")
      }
    }

    void loadItemList()

    return () => {
      cancelled = true
    }
  }, [isActive, itemItems.length])

  useEffect(() => {
    if (!isActive || itemsStatus !== "ready") {
      return
    }

    if (filteredItems.some((item) => item.id === selectedItemId)) {
      return
    }

    setSelectedItemId(filteredItems[0]?.id ?? "")
  }, [filteredItems, isActive, itemsStatus, selectedItemId])

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId)?.item ?? null

  return {
    itemQuery,
    setItemQuery,
    itemItems,
    filteredItems,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    itemsStatus,
    itemsErrorMessage,
  }
}
