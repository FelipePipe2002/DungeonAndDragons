"use client"

import { Link2, Loader2, Plus, Trash2 } from "lucide-react"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserListRow } from "@/components/browser/BrowserListRow"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { FrameBypass } from "@/components/frameBypass/FrameBypass"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
import { usePagesSection } from "@/app/informacion/hooks/usePagesSection"

export default function PagesSection() {
  const pages = usePagesSection({ isActive: true })

  return (
    <>
      <BrowserLayout
        sidebar={
          <BrowserSidebar
            query={pages.pageQuery}
            onQueryChange={pages.setPageQuery}
            placeholder="Buscar pagina..."
            actions={
              <Button onClick={pages.handleOpenDialog} className="gap-2">
                <Plus className="size-4" />
                Agregar
              </Button>
            }
          >
            <BrowserList>
              {pages.isLoading ? (
                <BrowserListMessage>Cargando paginas...</BrowserListMessage>
              ) : (
                pages.filteredPages.map((page) => {
                  const isActive = page.id === pages.selectedPageId

                  return (
                    <BrowserListRow
                      key={page.id}
                      isActive={isActive}
                      actions={
                        <Button size="icon" variant="ghost" className="size-7" aria-label="Eliminar" disabled={pages.isDeletingId === page.id} onClick={() => pages.handleDeleteRequest(page.id)}>
                          {pages.isDeletingId === page.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                        </Button>
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex min-w-0 flex-1 items-center gap-2 px-2"
                        onClick={() => pages.setSelectedPageId(page.id)}
                        onDoubleClick={() => pages.handleStartEdit(page)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          pages.handleStartEdit(page)
                        }}
                        title="Click: abrir | Doble click: editar"
                      >
                        <Link2 className="size-4 text-primary" />
                        <span className="truncate text-sm font-medium">{page.titulo}</span>
                      </Button>
                    </BrowserListRow>
                  )
                })
              )}
              {!pages.isLoading && pages.filteredPages.length === 0 ? (
                <BrowserListMessage>No hay paginas que coincidan con esa busqueda.</BrowserListMessage>
              ) : null}
            </BrowserList>
          </BrowserSidebar>
        }
        detail={
          <BrowserDetailPanel>
            {pages.isLoading ? (
              <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted-foreground">Cargando pagina...</div>
            ) : pages.selectedPage ? (
              <>
                {pages.error && <p className="mb-4 text-sm text-destructive">{pages.error}</p>}
                <div className="min-h-[70vh] overflow-hidden rounded-sm border border-border bg-card">
                  <FrameBypass src={pages.selectedPage.url} title={pages.selectedPage.titulo} className="min-h-[70vh]" />
                </div>
              </>
            ) : (
              <BrowserEmptyState title="Sin pagina seleccionada" />
            )}
          </BrowserDetailPanel>
        }
      />
      <Dialog
        open={pages.dialogOpen}
        onOpenChange={(open) => {
          pages.setDialogOpen(open)
          if (!open) pages.resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pages.editingPageId ? "Editar pagina" : "Agregar pagina"}</DialogTitle>
            <DialogDescription>Ingresa un titulo descriptivo y la URL completa. Se abrirá en un iframe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={pages.handleSavePage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo</Label>
              <Input id="titulo" value={pages.formTitulo} onChange={(event) => pages.setFormTitulo(event.target.value)} placeholder="Bestiario" maxLength={200} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" type="url" value={pages.formUrl} onChange={(event) => pages.setFormUrl(event.target.value)} placeholder="https://5e.tools/bestiary.html" required />
              <p className="text-xs text-muted-foreground">Debe comenzar con http:// o https://</p>
            </div>
            {pages.formError && <p className="text-sm text-destructive">{pages.formError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => pages.setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pages.isSaving} className="gap-2">
                {pages.isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {pages.isSaving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pages.deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) pages.setDeleteTarget(null)
        }}
        title="Eliminar pagina"
        description={pages.deleteTarget ? `Eliminar "${pages.deleteTarget.titulo}"? Esta accion no se puede deshacer.` : "Esta accion no se puede deshacer."}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="destructive"
        onConfirm={pages.handleConfirmDelete}
      />
    </>
  )
}
