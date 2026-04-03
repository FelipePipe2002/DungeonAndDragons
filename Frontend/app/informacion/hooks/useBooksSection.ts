import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import { normalizeSearch } from "@/lib/informacion/normalize"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import {
  deleteBook,
  fetchBooks,
  uploadBook,
  type BookUploadProgress,
} from "@/lib/services/book-api.service"
import type { StoredBook } from "@/lib/types"

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

type UseBooksSectionProps = {
  isActive: boolean
}

export function useBooksSection({ isActive }: UseBooksSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [books, setBooks] = useState<StoredBook[]>([])
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null)
  const [bookQuery, setBookQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<BookUploadProgress | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const deferredBookQuery = useDeferredValue(bookQuery)
  const normalizedBookQuery = normalizeSearch(deferredBookQuery)

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      if (!normalizedBookQuery) {
        return true
      }

      return book.filename.toLocaleLowerCase("es").includes(normalizedBookQuery)
    })
  }, [books, normalizedBookQuery])

  useEffect(() => {
    if (!isActive) {
      return
    }

    if (filteredBooks.some((book) => book.id === selectedBookId)) {
      return
    }

    setSelectedBookId(filteredBooks[0]?.id ?? null)
  }, [filteredBooks, isActive, selectedBookId])

  const selectedBook = filteredBooks.find((book) => book.id === selectedBookId) ?? null
  const deleteTargetBook = books.find((book) => book.id === deleteTargetId) ?? null

  async function reloadBooks(preferredId?: number | null) {
    const storedBooks = await fetchBooks()
    setBooks(storedBooks)
    setSelectedBookId((currentSelectedId) => resolveSelectedBookId(storedBooks, currentSelectedId, preferredId))
    return storedBooks
  }

  useEffect(() => {
    if (!isActive) {
      return
    }

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
  }, [isActive])

  async function handleUpload(file: File) {
    setIsUploading(true)
    setUploadProgress({
      fileName: file.name,
      frontendPercent: 0,
      frontendUploadedBytes: 0,
      frontendTotalBytes: file.size,
      backendStatus: "awaiting_upload",
      backendPercent: 0,
      backendProcessedBytes: 0,
      backendTotalBytes: file.size || null,
    })
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const createdBook = await uploadBook(file, {
        onProgress: (nextProgress) => {
          setUploadProgress(nextProgress)
        },
      })
      await reloadBooks(createdBook.id)
      setUploadProgress(null)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo subir el libro."))
    } finally {
      setIsUploading(false)
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) return
    void handleUpload(file)
  }

  function handleDeleteRequest(bookId?: number) {
    const targetId = typeof bookId === "number" ? bookId : selectedBookId
    const targetBook = books.find((book) => book.id === targetId)
    if (!targetBook) return
    setSelectedBookId(targetBook.id)
    setDeleteTargetId(targetBook.id)
    setIsDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    const targetBook = deleteTargetBook ?? selectedBook
    if (!targetBook) return

    setIsDeleting(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      await deleteBook(targetBook.id)
      await reloadBooks()
      setStatusMessage(`Libro eliminado: ${targetBook.filename}`)
      setDeleteTargetId(null)
    } catch (error) {
      setErrorMessage(getBackendErrorMessage(error, "No se pudo eliminar el libro."))
    } finally {
      setIsDeleting(false)
    }
  }

  return {
    fileInputRef,
    books,
    filteredBooks,
    bookQuery,
    setBookQuery,
    selectedBook,
    selectedBookId,
    setSelectedBookId,
    isLoading,
    isUploading,
    isDeleting,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    deleteTargetBook,
    uploadProgress,
    statusMessage,
    errorMessage,
    setStatusMessage,
    setErrorMessage,
    handleFileChange,
    handleDeleteRequest,
    handleConfirmDelete,
  }
}
