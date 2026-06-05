import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { normalizeSearch } from "@/lib/informacion/normalize"

type CatalogStatus = "idle" | "loading" | "ready" | "error"

type CatalogItem = {
  id: string
  searchText: string
}

type UseInformationCatalogSectionProps<TSource, TItem extends CatalogItem, TSelected> = {
  isActive: boolean
  load: () => Promise<TSource>
  buildItems: (source: TSource) => TItem[]
  selectValue: (item: TItem) => TSelected
  errorMessage: string
}

export function useInformationCatalogSection<TSource, TItem extends CatalogItem, TSelected>({
  isActive,
  load,
  buildItems,
  selectValue,
  errorMessage,
}: UseInformationCatalogSectionProps<TSource, TItem, TSelected>) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<TItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [status, setStatus] = useState<CatalogStatus>("idle")
  const [error, setError] = useState("")

  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = normalizeSearch(deferredQuery)

  const filteredItems = useMemo(() => {
    return items.filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery))
  }, [items, normalizedQuery])

  useEffect(() => {
    if (!isActive || items.length > 0) {
      return
    }

    let cancelled = false
    setStatus("loading")
    setError("")

    async function loadItems() {
      try {
        const source = await load()
        if (cancelled) {
          return
        }

        const nextItems = buildItems(source)
        setItems(nextItems)
        setSelectedId(nextItems[0]?.id ?? "")
        setStatus("ready")
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setStatus("error")
        setError(nextError instanceof Error ? nextError.message : errorMessage)
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [buildItems, errorMessage, isActive, items.length, load])

  useEffect(() => {
    if (!isActive || status !== "ready") {
      return
    }

    if (filteredItems.some((item) => item.id === selectedId)) {
      return
    }

    setSelectedId(filteredItems[0]?.id ?? "")
  }, [filteredItems, isActive, selectedId, status])

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? null

  return {
    query,
    setQuery,
    items,
    filteredItems,
    selectedId,
    setSelectedId,
    selectedItem: selectedItem ? selectValue(selectedItem) : null,
    status,
    error,
  }
}
