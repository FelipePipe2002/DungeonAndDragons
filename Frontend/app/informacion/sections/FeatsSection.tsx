"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { FeatCard } from "@/components/card/feat-card"
import { useFeatsSection } from "@/app/informacion/hooks/useFeatsSection"
import { getFeatCategoryTone } from "@/lib/informacion/constants"
import { getListItemClassName, InformationSidebar } from "./shared"

export default function FeatsSection() {
  const feats = useFeatsSection({ isActive: true })

  return (
    <BrowserLayout
      sidebar={
        <InformationSidebar query={feats.featQuery} onQueryChange={feats.setFeatQuery} placeholder="Buscar feat, categoria o prerequisito...">
          <BrowserList>
            {feats.featsStatus === "loading" ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">Cargando feats...</p>
            ) : feats.featsStatus === "error" ? (
              <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                {feats.featsErrorMessage || "No se pudieron cargar los feats."}
              </p>
            ) : (
              feats.filteredFeats.map((featItem) => {
                const isActive = feats.selectedFeatId === featItem.id
                const { feat } = featItem
                const tone = getFeatCategoryTone(feat.categoryCode)

                return (
                  <button
                    key={featItem.id}
                    type="button"
                    onClick={() => feats.setSelectedFeatId(featItem.id)}
                    className={getListItemClassName(isActive)}
                    style={{ borderLeftWidth: 4, borderLeftColor: tone }}
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
                  </button>
                )
              })
            )}
            {feats.featsStatus === "ready" && feats.filteredFeats.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay feats que coincidan con esa busqueda.
              </p>
            ) : null}
          </BrowserList>
        </InformationSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {feats.selectedFeat ? <FeatCard feat={feats.selectedFeat} /> : <BrowserEmptyState title="Sin feat seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
