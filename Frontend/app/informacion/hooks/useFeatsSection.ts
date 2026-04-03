import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { buildFeatItems } from "@/lib/informacion/feats"
import { normalizeSearch } from "@/lib/informacion/normalize"
import type { FeatBrowserItem } from "@/lib/informacion/types"
import { loadFeats } from "@/lib/feats/feat-store"

type UseFeatsSectionProps = {
  isActive: boolean
}

export function useFeatsSection({ isActive }: UseFeatsSectionProps) {
  const [featQuery, setFeatQuery] = useState("")
  const [featItems, setFeatItems] = useState<FeatBrowserItem[]>([])
  const [selectedFeatId, setSelectedFeatId] = useState("")
  const [featsStatus, setFeatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [featsErrorMessage, setFeatsErrorMessage] = useState("")

  const deferredFeatQuery = useDeferredValue(featQuery)
  const normalizedFeatQuery = normalizeSearch(deferredFeatQuery)

  const filteredFeats = useMemo(() => {
    return featItems.filter((featItem) => {
      if (!normalizedFeatQuery) {
        return true
      }

      return featItem.searchText.includes(normalizedFeatQuery)
    })
  }, [featItems, normalizedFeatQuery])

  useEffect(() => {
    if (!isActive || featItems.length > 0) {
      return
    }

    let cancelled = false
    setFeatsStatus("loading")
    setFeatsErrorMessage("")

    async function loadFeatList() {
      try {
        const loadedFeats = await loadFeats()
        if (cancelled) {
          return
        }

        const nextFeatItems = buildFeatItems(loadedFeats)
        setFeatItems(nextFeatItems)
        setSelectedFeatId(nextFeatItems[0]?.id ?? "")
        setFeatsStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setFeatsStatus("error")
        setFeatsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los feats.")
      }
    }

    void loadFeatList()

    return () => {
      cancelled = true
    }
  }, [featItems.length, isActive])

  useEffect(() => {
    if (!isActive || featsStatus !== "ready") {
      return
    }

    if (filteredFeats.some((feat) => feat.id === selectedFeatId)) {
      return
    }

    setSelectedFeatId(filteredFeats[0]?.id ?? "")
  }, [featsStatus, filteredFeats, isActive, selectedFeatId])

  const selectedFeat = filteredFeats.find((feat) => feat.id === selectedFeatId)?.feat ?? null

  return {
    featQuery,
    setFeatQuery,
    featItems,
    filteredFeats,
    selectedFeatId,
    setSelectedFeatId,
    selectedFeat,
    featsStatus,
    featsErrorMessage,
  }
}
