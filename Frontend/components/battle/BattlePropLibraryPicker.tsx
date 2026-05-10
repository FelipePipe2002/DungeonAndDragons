"use client"

import { useCallback, useEffect, useState, type ComponentProps } from "react"
import { ImagePlus } from "lucide-react"

import { ImageEmbeddingPicker } from "@/components/media/ImageEmbeddingPicker"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  createBattlePropLibraryId,
  readBattlePropLibrary,
  type BattlePropLibraryItem,
  writeBattlePropLibrary,
} from "@/lib/battle/props"

type BattlePropLibraryPickerProps = {
  pendingPropPlacement: BattlePropLibraryItem | null
  onPendingPropPlacementChange: (prop: BattlePropLibraryItem | null) => void
  disabled?: boolean
  buttonLabel?: string
  buttonClassName?: string
  buttonSize?: ComponentProps<typeof Button>["size"]
  side?: ComponentProps<typeof PopoverContent>["side"]
  align?: ComponentProps<typeof PopoverContent>["align"]
}

export type { BattlePropLibraryItem }

export function BattlePropLibraryPicker({
  pendingPropPlacement,
  onPendingPropPlacementChange,
  disabled = false,
  buttonLabel = "Props",
  buttonClassName = "gap-1.5",
  buttonSize = "sm",
  side = "top",
  align = "start",
}: BattlePropLibraryPickerProps) {
  const [propLibrary, setPropLibrary] = useState<BattlePropLibraryItem[]>(() => readBattlePropLibrary())
  const [isPropManagerOpen, setIsPropManagerOpen] = useState(false)
  const [isPropCreateDialogOpen, setIsPropCreateDialogOpen] = useState(false)
  const [propDraftName, setPropDraftName] = useState("")
  const [propDraftImage, setPropDraftImage] = useState("")
  const [propDraftImageAssetId, setPropDraftImageAssetId] = useState<number | null>(null)

  useEffect(() => {
    writeBattlePropLibrary(propLibrary)
  }, [propLibrary])

  const handleSelectProp = useCallback((prop: BattlePropLibraryItem) => {
    onPendingPropPlacementChange(prop)
    setIsPropManagerOpen(false)
  }, [onPendingPropPlacementChange])

  const savePropDraft = useCallback(() => {
    const name = propDraftName.trim()
    const image = propDraftImage.trim()
    if (!name || !image) {
      return
    }

    const nextProp: BattlePropLibraryItem = {
      id: createBattlePropLibraryId(),
      name,
      image,
      imageAssetId: propDraftImageAssetId,
    }
    setPropLibrary((current) => [...current, nextProp])
    onPendingPropPlacementChange(nextProp)
    setPropDraftName("")
    setPropDraftImage("")
    setPropDraftImageAssetId(null)
    setIsPropCreateDialogOpen(false)
    setIsPropManagerOpen(false)
  }, [onPendingPropPlacementChange, propDraftImage, propDraftImageAssetId, propDraftName])

  return (
    <>
      <Popover open={isPropManagerOpen} onOpenChange={setIsPropManagerOpen}>
        <PopoverTrigger asChild>
          <Button
            size={buttonSize}
            variant={pendingPropPlacement ? "default" : "outline"}
            className={buttonClassName}
            data-active={pendingPropPlacement ? "true" : undefined}
            disabled={disabled}
          >
            <ImagePlus className="size-4" />
            {buttonLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} side={side} className="w-72 p-3">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-stone-900">Props</p>
              <p className="text-xs text-stone-500">Elegí uno y luego hacé click en el mapa. Con Shift colocás varios.</p>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {propLibrary.length > 0 ? (
                propLibrary.map((prop) => (
                  <button
                    key={prop.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 text-left transition hover:border-amber-300 hover:bg-amber-50"
                    onClick={() => handleSelectProp(prop)}
                  >
                    <img src={prop.image} alt="" className="size-10 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800">{prop.name}</span>
                  </button>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-stone-300 px-3 py-4 text-center text-xs text-stone-500">
                  No hay props cargados.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => setIsPropCreateDialogOpen(true)}
            >
              <ImagePlus className="size-4" />
              Cargar prop
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={isPropCreateDialogOpen} onOpenChange={setIsPropCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cargar prop</DialogTitle>
            <DialogDescription>Guardá una textura para colocarla después en este mapa o en otras batallas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="space-y-1.5 text-sm font-medium text-stone-800">
              Nombre
              <Input value={propDraftName} onChange={(event) => setPropDraftName(event.target.value)} placeholder="Antorcha, mesa, cofre..." />
            </label>
            <ImageEmbeddingPicker
              label="Textura"
              usage="generic"
              value={propDraftImage}
              assetId={propDraftImageAssetId}
              onChange={(value, assetId) => {
                setPropDraftImage(value)
                setPropDraftImageAssetId(assetId)
              }}
              compact
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPropCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={savePropDraft} disabled={!propDraftName.trim() || !propDraftImage.trim()}>
              Guardar y usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
