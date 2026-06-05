"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { ItemCard } from "@/components/card/item-card"
import { useItemsSection } from "@/app/informacion/hooks/useItemsSection"

export default function ItemsSection() {
  const items = useItemsSection({ isActive: true })

  return (
      <BrowserLayout
        sidebar={
        <BrowserSidebar query={items.itemQuery} onQueryChange={items.setItemQuery} placeholder="Buscar item, tipo o rareza...">
          <BrowserList>
            {items.itemsStatus === "loading" ? (
              <BrowserListMessage>Cargando items...</BrowserListMessage>
            ) : items.itemsStatus === "error" ? (
              <BrowserListMessage tone="error">{items.itemsErrorMessage || "No se pudieron cargar los items."}</BrowserListMessage>
            ) : (
              items.filteredItems.map((itemEntry) => {
                const isActive = items.selectedItemId === itemEntry.id
                const { item } = itemEntry
                const subtitle = [item.typeLabel, item.rarityLabel].filter(Boolean).join(" · ")

                return (
                  <BrowserSelectableListItem
                    key={itemEntry.id}
                    onClick={() => items.setSelectedItemId(itemEntry.id)}
                    isActive={isActive}
                    accentColor="#8a5a2b"
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
                  </BrowserSelectableListItem>
                )
              })
            )}
            {items.itemsStatus === "ready" && items.filteredItems.length === 0 ? (
              <BrowserListMessage>No hay items que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {items.selectedItem ? <ItemCard item={items.selectedItem} /> : <BrowserEmptyState title="Sin item seleccionado" />}
        </BrowserDetailPanel>
      }
    />
  )
}
