"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { SpellCard } from "@/components/card/spell-card"
import { useSpellsSection } from "@/app/informacion/hooks/useSpellsSection"
import { getSpellSchoolTone } from "@/lib/informacion/constants"
import { getListItemClassName, InformationSidebar } from "./shared"

export default function SpellsSection() {
  const spells = useSpellsSection({ isActive: true })

  return (
    <BrowserLayout
      sidebar={
        <InformationSidebar query={spells.spellQuery} onQueryChange={spells.setSpellQuery} placeholder="Buscar spell, escuela o nivel...">
          <BrowserList>
            {spells.spellsStatus === "loading" ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">Cargando spells...</p>
            ) : spells.spellsStatus === "error" ? (
              <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                {spells.spellsErrorMessage || "No se pudieron cargar los spells."}
              </p>
            ) : (
              spells.filteredSpells.map((spellItem) => {
                const isActive = spells.selectedSpellId === spellItem.id
                const { spell } = spellItem
                const tone = getSpellSchoolTone(spell.schoolCode)
                const schoolLabel = spell.schoolLabel || "Sin escuela"
                const levelLabel = spell.levelLabel || "-"

                return (
                  <button
                    key={spellItem.id}
                    type="button"
                    onClick={() => spells.setSelectedSpellId(spellItem.id)}
                    className={getListItemClassName(isActive)}
                    style={{ borderLeftWidth: 4, borderLeftColor: tone.accent }}
                  >
                    <p className="font-semibold text-foreground">{spell.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {schoolLabel} {levelLabel}
                      </span>
                    </p>
                  </button>
                )
              })
            )}
            {spells.spellsStatus === "ready" && spells.filteredSpells.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay spells que coincidan con esa busqueda.
              </p>
            ) : null}
          </BrowserList>
        </InformationSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {spells.selectedSpell ? <SpellCard spell={spells.selectedSpell} /> : <BrowserEmptyState title="Sin spell seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
