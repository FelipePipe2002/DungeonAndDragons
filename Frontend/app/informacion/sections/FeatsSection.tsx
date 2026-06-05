"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { FeatCard } from "@/components/card/feat-card"
import { useFeatsSection } from "@/app/informacion/hooks/useFeatsSection"
import { getFeatCategoryTone } from "@/lib/informacion/constants"

export default function FeatsSection() {
  const feats = useFeatsSection({ isActive: true })

  return (
      <BrowserLayout
        sidebar={
        <BrowserSidebar query={feats.featQuery} onQueryChange={feats.setFeatQuery} placeholder="Buscar feat, categoria o prerequisito...">
          <BrowserList>
            {feats.featsStatus === "loading" ? (
              <BrowserListMessage>Cargando feats...</BrowserListMessage>
            ) : feats.featsStatus === "error" ? (
              <BrowserListMessage tone="error">{feats.featsErrorMessage || "No se pudieron cargar los feats."}</BrowserListMessage>
            ) : (
              feats.filteredFeats.map((featItem) => {
                const isActive = feats.selectedFeatId === featItem.id
                const { feat } = featItem
                const tone = getFeatCategoryTone(feat.categoryCode)

                return (
                  <BrowserSelectableListItem
                    key={featItem.id}
                    onClick={() => feats.setSelectedFeatId(featItem.id)}
                    isActive={isActive}
                    accentColor={tone}
                  >
                    <p className="font-semibold text-foreground">{feat.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">{feat.categoryLabel}</span>
                      {feat.repeatable ? (
                        <span className="rounded-sm border border-[#d2c2a8] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#6a4b31]">
                          Repeatable
                        </span>
                        ) : null}
                    </p>
                  </BrowserSelectableListItem>
                )
              })
            )}
            {feats.featsStatus === "ready" && feats.filteredFeats.length === 0 ? (
              <BrowserListMessage>No hay feats que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {feats.selectedFeat ? <FeatCard feat={feats.selectedFeat} /> : <BrowserEmptyState title="Sin feat seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
