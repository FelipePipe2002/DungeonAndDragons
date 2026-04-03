import type React from "react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"

import { normalizeSearch } from "@/lib/informacion/normalize"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { createSavedPage, deleteSavedPage, fetchSavedPages, updateSavedPage } from "@/lib/services/saved-page-api.service"
import type { SavedPage } from "@/lib/types"

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (trimmed.length === 0) return ""
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  return `https://${trimmed}`
}

type UsePagesSectionProps = {
  isActive: boolean
}

export function usePagesSection({ isActive }: UsePagesSectionProps) {
  const [pages, setPages] = useState<SavedPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [pageQuery, setPageQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formTitulo, setFormTitulo] = useState("")
  const [formUrl, setFormUrl] = useState("https://")
  const [formError, setFormError] = useState<string | null>(null)
  const [editingPageId, setEditingPageId] = useState<number | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedPage | null>(null)

  const deferredPageQuery = useDeferredValue(pageQuery)
  const normalizedPageQuery = normalizeSearch(deferredPageQuery)

  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      if (!normalizedPageQuery) {
        return true
      }

      return page.titulo.toLocaleLowerCase("es").includes(normalizedPageQuery)
    })
  }, [normalizedPageQuery, pages])

  useEffect(() => {
    if (!isActive) {
      return
    }

    if (filteredPages.some((page) => page.id === selectedPageId)) {
      return
    }

    setSelectedPageId(filteredPages[0]?.id ?? null)
  }, [filteredPages, isActive, selectedPageId])

  const selectedPage = useMemo(
    () => filteredPages.find((page) => page.id === selectedPageId) ?? null,
    [filteredPages, selectedPageId],
  )

  useEffect(() => {
    if (!isActive) {
      return
    }

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
  }, [isActive])

  function resetForm() {
    setFormTitulo("")
    setFormUrl("https://")
    setFormError(null)
    setEditingPageId(null)
  }

  function handleOpenDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function handleStartEdit(page: SavedPage) {
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

  function handleDeleteRequest(pageId: number) {
    const page = pages.find((item) => item.id === pageId)
    if (!page) return
    setDeleteTarget(page)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return

    const pageId = deleteTarget.id
    setIsDeletingId(pageId)
    setError(null)
    try {
      await deleteSavedPage(pageId)
      setPages((prev) => {
        const next = prev.filter((item) => item.id !== pageId)
        setSelectedPageId((current) => (current === pageId ? next[0]?.id ?? null : current))
        return next
      })
      setDeleteTarget(null)
    } catch (err) {
      setError(getBackendErrorMessage(err, "No se pudo eliminar la pagina."))
    } finally {
      setIsDeletingId(null)
    }
  }

  return {
    pages,
    filteredPages,
    pageQuery,
    setPageQuery,
    selectedPage,
    selectedPageId,
    setSelectedPageId,
    isLoading,
    error,
    setError,
    dialogOpen,
    setDialogOpen,
    isSaving,
    formTitulo,
    setFormTitulo,
    formUrl,
    setFormUrl,
    formError,
    editingPageId,
    handleOpenDialog,
    handleStartEdit,
    handleSavePage,
    handleDeleteRequest,
    deleteTarget,
    setDeleteTarget,
    handleConfirmDelete,
    isDeletingId,
    resetForm,
  }
}
