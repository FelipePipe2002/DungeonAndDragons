"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { FrameBypass } from "@/components/frameBypass/FrameBypass"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { deleteSavedPage, createSavedPage, fetchSavedPages, updateSavedPage } from "@/lib/services/saved-page-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import type { SavedPage } from "@/lib/types"
import { Link2, Loader2, Plus, Trash2 } from "lucide-react"

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (trimmed.length === 0) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  return `https://${trimmed}`
}

export default function PaginasPage() {
  const [pages, setPages] = useState<SavedPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formTitulo, setFormTitulo] = useState("")
  const [formUrl, setFormUrl] = useState("https://")
  const [formError, setFormError] = useState<string | null>(null)
  const [editingPageId, setEditingPageId] = useState<number | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  useEffect(() => {
    let cancelled = false

    async function loadPages() {
      setIsLoading(true)
      setError(null)
      try {
        const storedPages = await fetchSavedPages()
        if (cancelled) return
        setPages(storedPages)
        setSelectedPageId((current) => {
          if (current && storedPages.some((page) => page.id === current)) return current
          return storedPages[0]?.id ?? null
        })
      } catch (err) {
        if (cancelled) return
        setPages([])
        setSelectedPageId(null)
        setError(getBackendErrorMessage(err, "No se pudieron cargar las paginas."))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadPages()
    return () => {
      cancelled = true
    }
  }, [])

  function resetForm() {
    setFormTitulo("")
    setFormUrl("https://")
    setFormError(null)
    setEditingPageId(null)
  }

  const handleOpenDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handleStartEdit = (page: SavedPage) => {
    setEditingPageId(page.id)
    setFormTitulo(page.titulo)
    setFormUrl(page.url)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSavePage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return

    const titulo = formTitulo.trim()
    const url = normalizeUrl(formUrl)

    if (!titulo) {
      setFormError("El titulo es obligatorio")
      return
    }
    if (!url.startsWith("http")) {
      setFormError("La URL debe comenzar con http:// o https://")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (editingPageId) {
        const updated = await updateSavedPage(editingPageId, { titulo, url })
        setPages((prev) => {
          const next = prev.map((p) => (p.id === updated.id ? updated : p))
          return next.sort((a, b) => a.titulo.localeCompare(b.titulo))
        })
        setSelectedPageId(updated.id)
      } else {
        const created = await createSavedPage({ titulo, url })
        setPages((prev) => {
          const next = [...prev, created]
          return next.sort((a, b) => a.titulo.localeCompare(b.titulo))
        })
        setSelectedPageId(created.id)
      }
      setDialogOpen(false)
      resetForm()
    } catch (err) {
      setFormError(getBackendErrorMessage(err, "No se pudo guardar la pagina."))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(pageId: number) {
    const page = pages.find((item) => item.id === pageId)
    if (!page) return
    const shouldDelete = window.confirm(`Eliminar "${page.titulo}"?`)
    if (!shouldDelete) return

    setIsDeletingId(pageId)
    setError(null)
    try {
      await deleteSavedPage(pageId)
      setPages((prev) => {
        const next = prev.filter((item) => item.id !== pageId)
        setSelectedPageId((current) => (current === pageId ? next[0]?.id ?? null : current))
        return next
      })
    } catch (err) {
      setError(getBackendErrorMessage(err, "No se pudo eliminar la pagina."))
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6">
        <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <Link2 className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">Paginas</h1>
              <p className="text-sm text-muted-foreground">
                Guarda accesos a recursos externos y ábrelos en un iframe embebido.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleOpenDialog} className="gap-2">
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : pages.length === 0 ? (
        <div className="mb-4 rounded-sm border border-border bg-card p-4 text-sm text-muted-foreground">
          Todavía no guardaste paginas.
        </div>
      ) : (
        <ScrollArea className="mb-4 whitespace-nowrap" orientation="horizontal">
          <div className="flex items-center gap-2 pr-2">
            {pages.map((page) => {
              const isActive = page.id === selectedPageId
              return (
                <div
                  key={page.id}
                  className={`group flex items-center gap-1 rounded-full border px-2 py-1 transition-colors ${
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 px-2 rounded-full group-hover:bg-transparent"
                    onClick={() => setSelectedPageId(page.id)}
                    onDoubleClick={() => handleStartEdit(page)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleStartEdit(page)
                    }}
                    title="Click: abrir | Doble click: editar"
                  >
                    <Link2 className="size-4 text-primary" />
                    <span className="max-w-44 truncate text-sm font-medium">{page.titulo}</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Eliminar"
                    disabled={isDeletingId === page.id}
                    onClick={() => void handleDelete(page.id)}
                  >
                    {isDeletingId === page.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 text-destructive" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      <div className="min-h-[70vh] overflow-hidden rounded-sm border border-border bg-card">
        {selectedPage ? (
          <FrameBypass
            src={selectedPage.url}
            title={selectedPage.titulo}
            className="min-h-[70vh]"
          />
        ) : isLoading ? (
          <div className="flex h-full min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
            Cargando pagina...
          </div>
        ) : (
          <div className="flex h-full min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
            Agrega una pagina para verla aqui.
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPageId ? "Editar pagina" : "Agregar pagina"}</DialogTitle>
            <DialogDescription>
              Ingresa un titulo descriptivo y la URL completa. Se abrirá en un iframe.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo</Label>
              <Input
                id="titulo"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                placeholder="Bestiario"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://5e.tools/bestiary.html"
                required
              />
              <p className="text-xs text-muted-foreground">Debe comenzar con http:// o https://</p>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
