"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { MentionField, type MentionRef } from "@/components/mentionField/MentionField"
import { Button } from "@/components/ui/button"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchDmNotes, updateDmNotes } from "@/lib/services/dm-notes-api.service"

const DM_NOTES_SAVE_DEBOUNCE_MS = 450

type DmNotesSectionProps = {
  onOpenMention: (mention: MentionRef) => void | Promise<void>
}

export default function DmNotesSection({ onOpenMention }: DmNotesSectionProps) {
  const [notes, setNotes] = useState("")
  const [hasLoadedNotes, setHasLoadedNotes] = useState(false)
  const [notesStatus, setNotesStatus] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const lastSavedNotesRef = useRef("")
  const saveRequestIdRef = useRef(0)

  useEffect(() => {
    let isCancelled = false

    fetchDmNotes()
      .then((storedNotes) => {
        if (isCancelled) return
        setNotes(storedNotes)
        lastSavedNotesRef.current = storedNotes
        setHasLoadedNotes(true)
        setNotesStatus(null)
      })
      .catch((error) => {
        if (isCancelled) return
        lastSavedNotesRef.current = ""
        setHasLoadedNotes(true)
        setNotesStatus(getBackendErrorMessage(error, "No se pudieron cargar las notas del backend."))
      })

    return () => {
      isCancelled = true
    }
  }, [])

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    setNotesStatus(null)
  }, [])

  useEffect(() => {
    if (!hasLoadedNotes) return
    if (notes === lastSavedNotesRef.current) return

    const requestId = saveRequestIdRef.current + 1
    saveRequestIdRef.current = requestId

    const timeoutId = window.setTimeout(() => {
      setNotesStatus("Guardando...")

      updateDmNotes(notes)
        .then((savedNotes) => {
          if (saveRequestIdRef.current !== requestId) return
          lastSavedNotesRef.current = savedNotes
          setNotes((currentNotes) => (currentNotes === notes ? savedNotes : currentNotes))
          setNotesStatus(null)
        })
        .catch((error) => {
          if (saveRequestIdRef.current !== requestId) return
          setNotesStatus(getBackendErrorMessage(error, "No se pudieron guardar las notas."))
        })
    }, DM_NOTES_SAVE_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [hasLoadedNotes, notes])

  useEffect(() => {
    if (!isEditing) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !editorContainerRef.current) return
      if (!editorContainerRef.current.contains(target)) {
        setIsEditing(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return

    const frameId = requestAnimationFrame(() => {
      const textarea = editorContainerRef.current?.querySelector("textarea")
      textarea?.focus()
    })

    return () => cancelAnimationFrame(frameId)
  }, [isEditing])

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-primary">DM</h1>
          <p className="mt-1 text-sm text-muted-foreground">DM</p>
        </div>

        <Button type="button" variant="outline" onClick={() => setIsEditing((prevState) => !prevState)}>
          {isEditing ? "Ver menciones" : "Editar notas"}
        </Button>
      </div>

      {notesStatus ? <p className="mb-3 text-sm text-muted-foreground">{notesStatus}</p> : null}

      {isEditing ? (
        <div ref={editorContainerRef}>
          <MentionField
            source="auto"
            value={notes}
            onChange={handleNotesChange}
            placeholder="Escribe tus notas del DM aqui..."
            rows={18}
          />
        </div>
      ) : (
        <div
          className="min-h-[340px] rounded-md border border-border bg-background p-3 text-sm"
          onClick={(event) => {
            const target = event.target as HTMLElement | null
            if (target?.closest(".mention-inline-link")) return
            setIsEditing(true)
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.currentTarget !== event.target) return
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setIsEditing(true)
            }
          }}
        >
          <MentionField
            source="auto"
            value={notes}
            editable={false}
            emptyText="No hay notas todavia. Haz click para escribir."
            onOpenMention={onOpenMention}
          />
        </div>
      )}
    </>
  )
}
