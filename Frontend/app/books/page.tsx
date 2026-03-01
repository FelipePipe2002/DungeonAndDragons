"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { BookOpen, ExternalLink, Loader2, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { deleteBook, fetchBooks, uploadBook } from "@/lib/services/book-api.service"
import type { StoredBook } from "@/lib/types"

const BOOK_FILE_ACCEPT =
  ".pdf,.epub,.txt,.md,application/pdf,application/epub+zip,text/plain,text/markdown"

function resolveSelectedBookId(
  books: StoredBook[],
  currentSelectedId: number | null,
  preferredId?: number | null,
) {
  if (typeof preferredId === "number" && books.some((book) => book.id === preferredId)) {
    return preferredId
  }

  if (typeof currentSelectedId === "number" && books.some((book) => book.id === currentSelectedId)) {
    return currentSelectedId
  }

  return books[0]?.id ?? null
}

function formatByteSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "0 B"
  }

  if (byteSize < 1024) {
    return `${byteSize} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = byteSize / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

export default function BooksPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [books, setBooks] = useState<StoredBook[]>([])
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null

  async function reloadBooks(preferredId?: number | null) {
    const storedBooks = await fetchBooks()
    setBooks(storedBooks)
    setSelectedBookId((currentSelectedId) => resolveSelectedBookId(storedBooks, currentSelectedId, preferredId))
    return storedBooks
  }

  useEffect(() => {
    let isCancelled = false

    async function loadInitialBooks() {
      setIsLoading(true)

      try {
        const storedBooks = await fetchBooks()
        if (isCancelled) return
        setBooks(storedBooks)
        setSelectedBookId(resolveSelectedBookId(storedBooks, null))
        setErrorMessage(null)
      } catch (error) {
        if (isCancelled) return
        setBooks([])
        setSelectedBookId(null)
        setErrorMessage(getBackendErrorMessage(error, "No se pudieron cargar los libros."))
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialBooks()

    return () => {
      isCancelled = true
    }
  }, [])

  async function handleUpload(file: File) {
    setIsUploading(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const createdBook = await uploadBook(file)
      await reloadBooks(createdBook.id)
      setStatusMessage(`Libro cargado: ${createdBook.filename}`)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo subir el libro."))
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete() {
    if (!selectedBook) return

    const shouldDelete = window.confirm(`Eliminar "${selectedBook.filename}"?`)
    if (!shouldDelete) return

    setIsDeleting(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      await deleteBook(selectedBook.id)
      await reloadBooks()
      setStatusMessage(`Libro eliminado: ${selectedBook.filename}`)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo eliminar el libro."))
    } finally {
      setIsDeleting(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return
    void handleUpload(file)
  }

  return (
    <div className="mx-auto w-full max-w-[2200px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-8">
        <input
          ref={fileInputRef}
          type="file"
          accept={BOOK_FILE_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading || isDeleting}
        />

        <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              <BookOpen className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-primary">Libros</h1>
              <p className="text-sm text-muted-foreground">
                {books.length} libros guardados en la base de datos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading || isDeleting}
            >
              {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {isUploading ? "Cargando..." : "Agregar"}
            </Button>
          </div>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Cargando libros...
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
          No hay libros cargados todavia.
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2.5">
            {books.map((book) => {
              const isSelected = selectedBook?.id === book.id

              return (
                <Button
                  key={book.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => {
                    setSelectedBookId(book.id)
                    setStatusMessage(null)
                    setErrorMessage(null)
                  }}
                >
                  <BookOpen className="size-4" />
                  <span className="max-w-[300px] truncate">{book.filename}</span>
                </Button>
              )
            })}
          </div>

          {selectedBook && (
            <>
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  <a
                    href={selectedBook.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    Abrir en otra pestana
                    <ExternalLink className="size-3.5" />
                  </a>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDelete()}
                    disabled={isUploading || isDeleting}
                  >
                    {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                  </Button>
                </div>
              </div>

              <div className="h-[90vh] min-h-[560px] overflow-hidden rounded-sm border border-border bg-card md:h-[86vh] md:min-h-[900px]">
                <iframe
                  key={selectedBook.id}
                  src={selectedBook.downloadUrl}
                  title={`Lector de ${selectedBook.filename}`}
                  className="size-full"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
