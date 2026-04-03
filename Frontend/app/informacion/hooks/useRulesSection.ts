import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { buildRuleItems } from "@/lib/informacion/rules"
import { normalizeSearch } from "@/lib/informacion/normalize"
import type { RuleBrowserItem } from "@/lib/informacion/types"
import { loadRules } from "@/lib/rules/rule-store"

type UseRulesSectionProps = {
  isActive: boolean
}

export function useRulesSection({ isActive }: UseRulesSectionProps) {
  const [ruleQuery, setRuleQuery] = useState("")
  const [ruleItems, setRuleItems] = useState<RuleBrowserItem[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState("")
  const [rulesStatus, setRulesStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [rulesErrorMessage, setRulesErrorMessage] = useState("")

  const deferredRuleQuery = useDeferredValue(ruleQuery)
  const normalizedRuleQuery = normalizeSearch(deferredRuleQuery)

  const filteredRules = useMemo(() => {
    return ruleItems.filter((ruleItem) => {
      if (!normalizedRuleQuery) {
        return true
      }

      return ruleItem.searchText.includes(normalizedRuleQuery)
    })
  }, [normalizedRuleQuery, ruleItems])

  useEffect(() => {
    if (!isActive || ruleItems.length > 0) {
      return
    }

    let cancelled = false
    setRulesStatus("loading")
    setRulesErrorMessage("")

    async function loadRuleList() {
      try {
        const loadedRules = await loadRules()
        if (cancelled) {
          return
        }

        const nextRuleItems = buildRuleItems(loadedRules)
        setRuleItems(nextRuleItems)
        setSelectedRuleId(nextRuleItems[0]?.id ?? "")
        setRulesStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setRulesStatus("error")
        setRulesErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las reglas.")
      }
    }

    void loadRuleList()

    return () => {
      cancelled = true
    }
  }, [isActive, ruleItems.length])

  useEffect(() => {
    if (!isActive || rulesStatus !== "ready") {
      return
    }

    if (filteredRules.some((rule) => rule.id === selectedRuleId)) {
      return
    }

    setSelectedRuleId(filteredRules[0]?.id ?? "")
  }, [filteredRules, isActive, rulesStatus, selectedRuleId])

  const selectedRule = filteredRules.find((rule) => rule.id === selectedRuleId)?.rule ?? null

  return {
    ruleQuery,
    setRuleQuery,
    ruleItems,
    filteredRules,
    selectedRuleId,
    setSelectedRuleId,
    selectedRule,
    rulesStatus,
    rulesErrorMessage,
  }
}
