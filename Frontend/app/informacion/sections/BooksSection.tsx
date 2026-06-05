"use client"

import { BookMarked, ExternalLink, Loader2, Trash2, Upload } from "lucide-react"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserListRow } from "@/components/browser/BrowserListRow"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useBooksSection } from "@/app/informacion/hooks/useBooksSection"
import { BOOK_FILE_ACCEPT, formatByteSize } from "./shared"

function getUploadPhaseLabel(uploadProgress: ReturnType<typeof useBooksSection>["uploadProgress"]) {
  if (uploadProgress?.backendStatus === "completed") {
    return "Completado"
  }

  if (uploadProgress?.backendStatus === "failed") {
    return "Error"
  }

  if (uploadProgress?.frontendPercent === 100) {
    return "Procesando en backend"
  }

  return "Subiendo al backend"
}

export default function BooksSection() {
  const books = useBooksSection({ isActive: true })
  const uploadPhaseLabel = getUploadPhaseLabel(books.uploadProgress)

  return (
    <>
      <input
        ref={books.fileInputRef}
        type="file"
        accept={BOOK_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ""
          books.handleFileChange(file)
        }}
        disabled={books.isUploading || books.isDeleting}
      />
      <BrowserLayout
        sidebar={
          <BrowserSidebar
            query={books.bookQuery}
            onQueryChange={books.setBookQuery}
            placeholder="Buscar libro..."
            actions={
              <Button type="button" onClick={() => books.fileInputRef.current?.click()} disabled={books.isLoading || books.isUploading || books.isDeleting}>
                {books.isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {books.isUploading ? "Cargando..." : "Agregar"}
              </Button>
            }
          >
            <BrowserList>
              {books.isLoading ? (
                <BrowserListMessage>Cargando libros...</BrowserListMessage>
              ) : (
                books.filteredBooks.map((book) => {
                  const isActive = books.selectedBookId === book.id
                  const isDeletingTarget = books.deleteTargetBook?.id === book.id && books.isDeleting

                  return (
                    <BrowserListRow
                      key={book.id}
                      isActive={isActive}
                      actions={
                        <Button size="icon" variant="ghost" className="size-7" aria-label="Eliminar" disabled={books.isDeleting} onClick={() => books.handleDeleteRequest(book.id)}>
                          {isDeletingTarget ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                        </Button>
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex min-w-0 flex-1 items-center gap-2 px-2"
                        onClick={() => {
                          books.setSelectedBookId(book.id)
                          books.setStatusMessage(null)
                          books.setErrorMessage(null)
                        }}
                      >
                        <BookMarked className="size-4 text-primary" />
                        <span className="truncate text-sm font-medium">{book.filename}</span>
                      </Button>
                    </BrowserListRow>
                  )
                })
              )}
              {!books.isLoading && books.filteredBooks.length === 0 ? (
                <BrowserListMessage>No hay libros que coincidan con esa busqueda.</BrowserListMessage>
              ) : null}
            </BrowserList>
          </BrowserSidebar>
        }
        detail={
          <BrowserDetailPanel>
            {books.isLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cargando libros...
              </div>
            ) : books.selectedBook ? (
              <>
                {books.uploadProgress ? (
                  <div className="mb-4 rounded-sm border border-border bg-card p-4">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Subida actual</p>
                        <p className="max-w-[720px] truncate text-xs text-muted-foreground">{books.uploadProgress.fileName}</p>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Estado: {uploadPhaseLabel}</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Frontend</span>
                          <span>
                            {books.uploadProgress.frontendPercent}% · {formatByteSize(books.uploadProgress.frontendUploadedBytes)} / {formatByteSize(books.uploadProgress.frontendTotalBytes)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${books.uploadProgress.frontendPercent}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Backend</span>
                          <span>
                            {books.uploadProgress.backendStatus === "awaiting_upload"
                              ? "Esperando recepcion"
                              : `${books.uploadProgress.backendPercent}% · ${formatByteSize(books.uploadProgress.backendProcessedBytes)} / ${formatByteSize(books.uploadProgress.backendTotalBytes ?? 0)}`}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-600 transition-[width] duration-200"
                            style={{ width: `${books.uploadProgress.backendStatus === "awaiting_upload" ? 6 : books.uploadProgress.backendPercent}%` }}
                          />
                        </div>
                        {books.uploadProgress.backendErrorMessage ? <p className="mt-1 text-xs text-destructive">{books.uploadProgress.backendErrorMessage}</p> : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                {books.statusMessage ? <div className="mb-4 rounded-sm border border-emerald-600/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">{books.statusMessage}</div> : null}
                {books.errorMessage ? <div className="mb-4 rounded-sm border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{books.errorMessage}</div> : null}
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <a href={books.selectedBook.downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      Abrir en otra pestana
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
                <div className="h-[90vh] rounded-sm border border-border bg-card">
                  <iframe key={books.selectedBook.id} src={books.selectedBook.downloadUrl} title={`Lector de ${books.selectedBook.filename}`} className="size-full" />
                </div>
              </>
            ) : (
              <BrowserEmptyState title="Sin libro seleccionado" />
            )}
          </BrowserDetailPanel>
        }
      />
      <ConfirmDialog
        open={books.isDeleteDialogOpen}
        onOpenChange={books.setIsDeleteDialogOpen}
        title="Eliminar libro"
        description={books.deleteTargetBook ? `Eliminar "${books.deleteTargetBook.filename}"? Esta accion no se puede deshacer.` : "Esta accion no se puede deshacer."}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        confirmVariant="destructive"
        onConfirm={books.handleConfirmDelete}
      />
    </>
  )
}
