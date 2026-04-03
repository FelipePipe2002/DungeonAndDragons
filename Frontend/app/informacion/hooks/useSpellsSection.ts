import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { buildSpellItems } from "@/lib/informacion/spells"
import { normalizeSearch } from "@/lib/informacion/normalize"
import type { SpellBrowserItem } from "@/lib/informacion/types"
import { loadSpells } from "@/lib/spells/spell-store"

type UseSpellsSectionProps = {
  isActive: boolean
}

export function useSpellsSection({ isActive }: UseSpellsSectionProps) {
  const [spellQuery, setSpellQuery] = useState("")
  const [spellItems, setSpellItems] = useState<SpellBrowserItem[]>([])
  const [selectedSpellId, setSelectedSpellId] = useState("")
  const [spellsStatus, setSpellsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [spellsErrorMessage, setSpellsErrorMessage] = useState("")

  const deferredSpellQuery = useDeferredValue(spellQuery)
  const normalizedSpellQuery = normalizeSearch(deferredSpellQuery)

  const filteredSpells = useMemo(() => {
    return spellItems.filter((spellItem) => {
      if (!normalizedSpellQuery) {
        return true
      }

      return spellItem.searchText.includes(normalizedSpellQuery)
    })
  }, [normalizedSpellQuery, spellItems])

  useEffect(() => {
    if (!isActive || spellItems.length > 0) {
      return
    }

    let cancelled = false
    setSpellsStatus("loading")
    setSpellsErrorMessage("")

    async function loadSpellList() {
      try {
        const loadedSpells = await loadSpells()
        if (cancelled) {
          return
        }

        const nextSpellItems = buildSpellItems(loadedSpells)
        setSpellItems(nextSpellItems)
        setSelectedSpellId(nextSpellItems[0]?.id ?? "")
        setSpellsStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setSpellsStatus("error")
        setSpellsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los spells.")
      }
    }

    void loadSpellList()

    return () => {
      cancelled = true
    }
  }, [isActive, spellItems.length])

  useEffect(() => {
    if (!isActive || spellsStatus !== "ready") {
      return
    }

    if (filteredSpells.some((spell) => spell.id === selectedSpellId)) {
      return
    }

    setSelectedSpellId(filteredSpells[0]?.id ?? "")
  }, [filteredSpells, isActive, selectedSpellId, spellsStatus])

  const selectedSpell = filteredSpells.find((spell) => spell.id === selectedSpellId)?.spell ?? null

  return {
    spellQuery,
    setSpellQuery,
    spellItems,
    filteredSpells,
    selectedSpellId,
    setSelectedSpellId,
    selectedSpell,
    spellsStatus,
    spellsErrorMessage,
  }
}
