"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { ItemCard } from "@/components/card/item-card"
import { useItemsSection } from "@/app/informacion/hooks/useItemsSection"
import { getListItemClassName, InformationSidebar } from "./shared"

export default function ItemsSection() {
  const items = useItemsSection({ isActive: true })

  return (
    <BrowserLayout
      sidebar={
        <InformationSidebar query={items.itemQuery} onQueryChange={items.setItemQuery} placeholder="Buscar item, tipo o rareza...">
          <BrowserList>
            {items.itemsStatus === "loading" ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">Cargando items...</p>
            ) : items.itemsStatus === "error" ? (
              <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                {items.itemsErrorMessage || "No se pudieron cargar los items."}
              </p>
            ) : (
              items.filteredItems.map((itemEntry) => {
                const isActive = items.selectedItemId === itemEntry.id
                const { item } = itemEntry
                const subtitle = [item.typeLabel, item.rarityLabel].filter(Boolean).join(" · ")

                return (
                  <button
                    key={itemEntry.id}
                    type="button"
                    onClick={() => items.setSelectedItemId(itemEntry.id)}
                    className={getListItemClassName(isActive)}
                    style={{ borderLeftWidth: 4, borderLeftColor: "#8a5a2b" }}
                  >
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{subtitle || "Item"}</span>
                      {item.attunement ? (
                        <span className="rounded-sm border border-[#d2c2a8] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#6a4b31]">
                          Attunement
                        </span>
                      ) : null}
                    </p>
                  </button>
                )
              })
            )}
            {items.itemsStatus === "ready" && items.filteredItems.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay items que coincidan con esa busqueda.
              </p>
            ) : null}
          </BrowserList>
        </InformationSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {items.selectedItem ? <ItemCard item={items.selectedItem} /> : <BrowserEmptyState title="Sin item seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
