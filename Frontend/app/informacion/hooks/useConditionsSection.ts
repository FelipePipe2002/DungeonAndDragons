import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { CONDITION_ITEMS } from "@/lib/informacion/conditions"
import { normalizeSearch } from "@/lib/informacion/normalize"

type UseConditionsSectionProps = {
  isActive: boolean
}

export function useConditionsSection({ isActive }: UseConditionsSectionProps) {
  const [conditionQuery, setConditionQuery] = useState("")
  const [selectedConditionId, setSelectedConditionId] = useState(CONDITION_ITEMS[0]?.id ?? "")

  const deferredConditionQuery = useDeferredValue(conditionQuery)
  const normalizedConditionQuery = normalizeSearch(deferredConditionQuery)

  const filteredConditions = useMemo(() => {
    return CONDITION_ITEMS.filter((condition) => {
      if (!normalizedConditionQuery) {
        return true
      }

      return condition.searchText.includes(normalizedConditionQuery)
    })
  }, [normalizedConditionQuery])

  useEffect(() => {
    if (!isActive) {
      return
    }

    if (filteredConditions.some((condition) => condition.id === selectedConditionId)) {
      return
    }

    setSelectedConditionId(filteredConditions[0]?.id ?? "")
  }, [filteredConditions, isActive, selectedConditionId])

  const selectedCondition = filteredConditions.find((condition) => condition.id === selectedConditionId) ?? null

  return {
    conditionQuery,
    setConditionQuery,
    filteredConditions,
    selectedConditionId,
    setSelectedConditionId,
    selectedCondition,
  }
}
