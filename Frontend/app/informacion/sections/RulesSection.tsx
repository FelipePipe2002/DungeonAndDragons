"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { RuleCard } from "@/components/card/rule-card"
import { useRulesSection } from "@/app/informacion/hooks/useRulesSection"
import { getRuleTone } from "@/lib/informacion/constants"

export default function RulesSection() {
  const rules = useRulesSection({ isActive: true })

  return (
      <BrowserLayout
        sidebar={
        <BrowserSidebar query={rules.ruleQuery} onQueryChange={rules.setRuleQuery} placeholder="Buscar regla...">
          <BrowserList>
            {rules.rulesStatus === "loading" ? (
              <BrowserListMessage>Cargando reglas...</BrowserListMessage>
            ) : rules.rulesStatus === "error" ? (
              <BrowserListMessage tone="error">{rules.rulesErrorMessage || "No se pudieron cargar las reglas."}</BrowserListMessage>
            ) : (
              rules.filteredRules.map((ruleItem) => {
                const isActive = rules.selectedRuleId === ruleItem.id
                const { rule } = ruleItem
                const tone = getRuleTone()

                return (
                  <BrowserSelectableListItem
                    key={ruleItem.id}
                    onClick={() => rules.setSelectedRuleId(ruleItem.id)}
                    isActive={isActive}
                    accentColor={tone}
                  >
                    <p className="font-semibold text-foreground">{rule.name}</p>
                  </BrowserSelectableListItem>
                )
              })
            )}
            {rules.rulesStatus === "ready" && rules.filteredRules.length === 0 ? (
              <BrowserListMessage>No hay reglas que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {rules.selectedRule ? <RuleCard rule={rules.selectedRule} /> : <BrowserEmptyState title="Sin regla seleccionada" />}
        </BrowserDetailPanel>
      }
    />
  )
}
