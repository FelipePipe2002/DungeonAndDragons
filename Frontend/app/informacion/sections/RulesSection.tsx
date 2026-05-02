"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { RuleCard } from "@/components/card/rule-card"
import { useRulesSection } from "@/app/informacion/hooks/useRulesSection"
import { getRuleTone } from "@/lib/informacion/constants"
import { getListItemClassName, InformationSidebar } from "./shared"

export default function RulesSection() {
  const rules = useRulesSection({ isActive: true })

  return (
    <BrowserLayout
      sidebar={
        <InformationSidebar query={rules.ruleQuery} onQueryChange={rules.setRuleQuery} placeholder="Buscar regla...">
          <BrowserList>
            {rules.rulesStatus === "loading" ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">Cargando reglas...</p>
            ) : rules.rulesStatus === "error" ? (
              <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                {rules.rulesErrorMessage || "No se pudieron cargar las reglas."}
              </p>
            ) : (
              rules.filteredRules.map((ruleItem) => {
                const isActive = rules.selectedRuleId === ruleItem.id
                const { rule } = ruleItem
                const tone = getRuleTone()

                return (
                  <button
                    key={ruleItem.id}
                    type="button"
                    onClick={() => rules.setSelectedRuleId(ruleItem.id)}
                    className={getListItemClassName(isActive)}
                    style={{ borderLeftWidth: 4, borderLeftColor: tone }}
                  >
                    <p className="font-semibold text-foreground">{rule.name}</p>
                  </button>
                )
              })
            )}
            {rules.rulesStatus === "ready" && rules.filteredRules.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay reglas que coincidan con esa busqueda.
              </p>
            ) : null}
          </BrowserList>
        </InformationSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {rules.selectedRule ? <RuleCard rule={rules.selectedRule} /> : <BrowserEmptyState title="Sin regla seleccionada" />}
        </BrowserDetailPanel>
      }
    />
  )
}
