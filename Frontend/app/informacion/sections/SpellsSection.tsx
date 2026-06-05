"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { SpellCard } from "@/components/card/spell-card"
import { useSpellsSection } from "@/app/informacion/hooks/useSpellsSection"
import { getSpellSchoolTone } from "@/lib/informacion/constants"

export default function SpellsSection() {
  const spells = useSpellsSection({ isActive: true })

  return (
    <BrowserLayout
      sidebar={
        <BrowserSidebar query={spells.spellQuery} onQueryChange={spells.setSpellQuery} placeholder="Buscar spell, escuela o nivel...">
          <BrowserList>
            {spells.spellsStatus === "loading" ? (
              <BrowserListMessage>Cargando spells...</BrowserListMessage>
            ) : spells.spellsStatus === "error" ? (
              <BrowserListMessage tone="error">{spells.spellsErrorMessage || "No se pudieron cargar los spells."}</BrowserListMessage>
            ) : (
              spells.filteredSpells.map((spellItem) => {
                const isActive = spells.selectedSpellId === spellItem.id
                const { spell } = spellItem
                const tone = getSpellSchoolTone(spell.schoolCode)
                const schoolLabel = spell.schoolLabel || "Sin escuela"
                const levelLabel = spell.levelLabel || "-"

                return (
                  <BrowserSelectableListItem
                    key={spellItem.id}
                    onClick={() => spells.setSelectedSpellId(spellItem.id)}
                    isActive={isActive}
                    accentColor={tone.accent}
                  >
                    <p className="font-semibold text-foreground">{spell.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {schoolLabel} {levelLabel}
                      </span>
                    </p>
                  </BrowserSelectableListItem>
                )
              })
            )}
            {spells.spellsStatus === "ready" && spells.filteredSpells.length === 0 ? (
              <BrowserListMessage>No hay spells que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {spells.selectedSpell ? <SpellCard spell={spells.selectedSpell} /> : <BrowserEmptyState title="Sin spell seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
