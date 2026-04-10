"use client"

import { ItemCard } from "@/components/card/item-card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Item } from "@/lib/items/item-store"

type ItemDetailDialogProps = {
  item: Item | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ItemDetailDialog({ item, open, onOpenChange }: ItemDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-[#d8c7ab] bg-[linear-gradient(180deg,rgba(251,246,237,0.98),rgba(243,232,214,0.97))] p-0 shadow-[0_30px_90px_rgba(48,33,18,0.35)] sm:rounded-sm">
        {item ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{item.name}</DialogTitle>
            </DialogHeader>
            <div className="p-6">
              <ItemCard item={item} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
