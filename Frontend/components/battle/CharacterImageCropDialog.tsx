"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  getCharacterImageCrop,
  getCharacterImagePresentationStyle,
  normalizeCharacterImageCrop,
  type CharacterImageCrop,
  type CharacterImageCropKind,
} from "@/lib/character-image"
import type { Character } from "@/lib/types"

type CharacterImageCropDialogProps = {
  open: boolean
  character: Character | null
  saving?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (nextValues: {
    tokenCrop: CharacterImageCrop
    initiativeCrop: CharacterImageCrop
  }) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function CharacterImageCropDialog({
  open,
  character,
  saving = false,
  onOpenChange,
  onSave,
}: CharacterImageCropDialogProps) {
  const [activeMode, setActiveMode] = useState<CharacterImageCropKind>("token")
  const [tokenCrop, setTokenCrop] = useState<CharacterImageCrop>(() => normalizeCharacterImageCrop())
  const [initiativeCrop, setInitiativeCrop] = useState<CharacterImageCrop>(() => normalizeCharacterImageCrop())
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const tokenFrameRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    initialCrop: CharacterImageCrop
  } | null>(null)

  useEffect(() => {
    if (!open || !character) {
      return
    }

    setTokenCrop(getCharacterImageCrop(character, "token"))
    setInitiativeCrop(getCharacterImageCrop(character, "initiative"))
    setActiveMode("token")
  }, [character, open])

  const currentCrop = activeMode === "token" ? tokenCrop : initiativeCrop
  const setCurrentCrop = activeMode === "token" ? setTokenCrop : setInitiativeCrop
  const cropPreviewCharacter = useMemo(
    () => ({
      tokenImageFocusX: tokenCrop.focusX,
      tokenImageFocusY: tokenCrop.focusY,
      tokenImageZoom: tokenCrop.zoom,
      initiativeImageFocusX: initiativeCrop.focusX,
      initiativeImageFocusY: initiativeCrop.focusY,
      initiativeImageZoom: initiativeCrop.zoom,
    }),
    [initiativeCrop.focusX, initiativeCrop.focusY, initiativeCrop.zoom, tokenCrop.focusX, tokenCrop.focusY, tokenCrop.zoom],
  )
  const previewStyle = useMemo(
    () => (character ? getCharacterImagePresentationStyle(cropPreviewCharacter, activeMode) : undefined),
    [activeMode, character, cropPreviewCharacter],
  )
  const getActiveDragSurface = () =>
    activeMode === "token" ? (tokenFrameRef.current ?? viewportRef.current) : viewportRef.current

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!character?.imagen || !getActiveDragSurface() || event.button !== 0) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialCrop: currentCrop,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    const viewport = getActiveDragSurface()
    if (!dragState || dragState.pointerId !== event.pointerId || !viewport) {
      return
    }

    const movementScale = 1 / Math.max(1, dragState.initialCrop.zoom)
    const deltaX = ((event.clientX - dragState.startX) / Math.max(1, viewport.clientWidth)) * 100
    const deltaY = ((event.clientY - dragState.startY) / Math.max(1, viewport.clientHeight)) * 100

    setCurrentCrop({
      ...dragState.initialCrop,
      focusX: clamp(dragState.initialCrop.focusX - deltaX * movementScale, 0, 100),
      focusY: clamp(dragState.initialCrop.focusY - deltaY * movementScale, 0, 100),
    })
  }

  const handleViewportPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl border-stone-200 bg-[linear-gradient(180deg,rgba(250,248,241,0.98),rgba(237,229,206,0.98))] p-6">
        <DialogHeader>
          <DialogTitle>Ajustar retrato</DialogTitle>
          <DialogDescription>
            Arrastrá la imagen para encuadrarla y usá el zoom para decidir qué parte se muestra en la ficha o en la iniciativa.
          </DialogDescription>
        </DialogHeader>

        {character?.imagen ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={activeMode === "token" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setActiveMode("token")}
                >
                  Ficha
                </Button>
                <Button
                  type="button"
                  variant={activeMode === "initiative" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setActiveMode("initiative")}
                >
                  Iniciativa
                </Button>
              </div>

              <div
                ref={viewportRef}
                className={`relative mx-auto overflow-hidden ${
                  activeMode === "token"
                    ? "aspect-square w-[18rem] max-w-full rounded-full border-2 border-stone-700/70 bg-stone-950 shadow-[inset_0_0_0_1px_rgba(245,222,179,0.18),0_1rem_2rem_rgba(28,25,23,0.24)]"
                    : "aspect-[3/4] max-w-[18rem] border-2 border-stone-700/70 bg-stone-900 shadow-[inset_0_0_0_1px_rgba(245,222,179,0.18),0_1rem_2rem_rgba(28,25,23,0.24)]"
                }`}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={handleViewportPointerEnd}
                onPointerCancel={handleViewportPointerEnd}
              >
                {activeMode === "token" ? (
                  <div
                    ref={tokenFrameRef}
                    className="absolute inset-0 overflow-hidden rounded-full border-2 border-amber-100/85"
                    aria-hidden="true"
                  >
                    <img
                      src={character.imagen}
                      alt={character.nombre}
                      className="absolute inset-0 size-full object-cover"
                      style={getCharacterImagePresentationStyle(cropPreviewCharacter, "token")}
                      draggable={false}
                    />
                  </div>
                ) : (
                  <>
                    <img
                      src={character.imagen}
                      alt={character.nombre}
                      className="absolute inset-0 size-full object-cover"
                      style={previewStyle}
                      draggable={false}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 border-2 border-amber-100/85 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.18)]"
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>

              <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={currentCrop.zoom}
                  className="mt-2 h-2 w-full cursor-pointer accent-amber-700"
                  onChange={(event) => {
                    const nextZoom = clamp(Number.parseFloat(event.target.value) || 1, 1, 3)
                    setCurrentCrop({
                      ...currentCrop,
                      zoom: nextZoom,
                    })
                  }}
                />
              </label>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">Preview ficha</p>
                <div className="relative mx-auto aspect-square w-28 overflow-hidden rounded-full border-2 border-stone-700 bg-stone-900">
                  <img
                    src={character.imagen}
                    alt={character.nombre}
                    className="absolute inset-0 size-full object-cover"
                    style={getCharacterImagePresentationStyle(cropPreviewCharacter, "token")}
                    draggable={false}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">Preview iniciativa</p>
                <div className="relative mx-auto aspect-[3/4] w-24 overflow-hidden border-2 border-stone-700 bg-stone-900">
                  <img
                    src={character.imagen}
                    alt={character.nombre}
                    className="absolute inset-0 size-full object-cover"
                    style={getCharacterImagePresentationStyle(cropPreviewCharacter, "initiative")}
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white/80 px-4 py-5 text-sm text-stone-600">
            Este personaje no tiene imagen.
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!character?.imagen || saving}
            onClick={() =>
              onSave({
                tokenCrop: normalizeCharacterImageCrop(tokenCrop),
                initiativeCrop: normalizeCharacterImageCrop(initiativeCrop),
              })
            }
          >
            {saving ? "Guardando..." : "Guardar encuadre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
