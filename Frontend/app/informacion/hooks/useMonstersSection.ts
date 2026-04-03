import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import { normalizeSearch } from "@/lib/informacion/normalize"
import { MONSTER_ITEMS, MONSTER_ITEMS_BY_ID, parseMonsterCrValue } from "@/lib/informacion/monsters"
import type { MonsterRecord } from "@/lib/informacion/types"
import type { MonsterSortField, SortDirection } from "@/lib/informacion/types"
import { fetchMonsterByExactName } from "@/lib/services/monster-api.service"

type UseMonstersSectionProps = {
  isActive: boolean
}

export function useMonstersSection({ isActive }: UseMonstersSectionProps) {
  const [monsterQuery, setMonsterQuery] = useState("")
  const [monsterSortField, setMonsterSortField] = useState<MonsterSortField>("name")
  const [monsterSortDirection, setMonsterSortDirection] = useState<SortDirection>("asc")
  const [selectedMonsterId, setSelectedMonsterId] = useState(MONSTER_ITEMS[0]?.id ?? "")
  const [selectedMonsterRecord, setSelectedMonsterRecord] = useState<MonsterRecord | null>(
    MONSTER_ITEMS[0]?.record ?? null,
  )
  const monsterDetailsCacheRef = useRef(new Map<string, MonsterRecord>())

  const deferredMonsterQuery = useDeferredValue(monsterQuery)
  const normalizedMonsterQuery = normalizeSearch(deferredMonsterQuery)

  const filteredMonsters = useMemo(() => {
    return MONSTER_ITEMS.filter((monster) => {
      if (!normalizedMonsterQuery) {
        return true
      }

      const haystack = [monster.summary.name, monster.summary.type, monster.summary.cr, monster.source]
        .join(" ")
        .toLocaleLowerCase("es")

      return haystack.includes(normalizedMonsterQuery)
    })
  }, [normalizedMonsterQuery])

  const sortedMonsters = useMemo(() => {
    const sorted = [...filteredMonsters]

    sorted.sort((a, b) => {
      let comparison = 0

      if (monsterSortField === "cr") {
        const aCr = parseMonsterCrValue(a.summary.cr)
        const bCr = parseMonsterCrValue(b.summary.cr)

        if (aCr == null && bCr == null) {
          comparison = a.summary.name.localeCompare(b.summary.name, "es")
        } else if (aCr == null) {
          comparison = 1
        } else if (bCr == null) {
          comparison = -1
        } else if (aCr !== bCr) {
          comparison = aCr - bCr
        } else {
          comparison = a.summary.name.localeCompare(b.summary.name, "es")
        }
      } else {
        comparison = a.summary.name.localeCompare(b.summary.name, "es")
      }

      return monsterSortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredMonsters, monsterSortDirection, monsterSortField])

  useEffect(() => {
    if (!isActive) {
      return
    }

    if (sortedMonsters.some((monster) => monster.id === selectedMonsterId)) {
      return
    }

    setSelectedMonsterId(sortedMonsters[0]?.id ?? "")
  }, [isActive, selectedMonsterId, sortedMonsters])

  useEffect(() => {
    if (!isActive || !selectedMonsterId) {
      return
    }

    const localMonster = MONSTER_ITEMS_BY_ID.get(selectedMonsterId)?.record ?? null
    setSelectedMonsterRecord(localMonster)

    const cachedMonster = monsterDetailsCacheRef.current.get(selectedMonsterId)
    if (cachedMonster) {
      setSelectedMonsterRecord(cachedMonster)
      return
    }

    let cancelled = false

    async function loadMonsterDetail() {
      try {
        const remoteMonster = await fetchMonsterByExactName(selectedMonsterId, { withTokenImage: true })
        if (cancelled || !remoteMonster) {
          return
        }

        monsterDetailsCacheRef.current.set(selectedMonsterId, remoteMonster)
        setSelectedMonsterRecord(remoteMonster)
      } catch {
        if (!cancelled) {
          setSelectedMonsterRecord(localMonster)
        }
      }
    }

    void loadMonsterDetail()

    return () => {
      cancelled = true
    }
  }, [isActive, selectedMonsterId])

  const selectedMonster = sortedMonsters.find((monster) => monster.id === selectedMonsterId) ?? null

  return {
    monsterQuery,
    setMonsterQuery,
    monsterSortField,
    setMonsterSortField,
    monsterSortDirection,
    setMonsterSortDirection,
    sortedMonsters,
    filteredMonsters,
    selectedMonsterId,
    setSelectedMonsterId,
    selectedMonster,
    selectedMonsterRecord,
  }
}
