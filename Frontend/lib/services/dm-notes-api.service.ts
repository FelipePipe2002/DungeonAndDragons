import { backendRequest } from "@/lib/services/backend-api.service"

type DmNotesDto = {
  texto?: string | null
}

type DmNotesUpsertPayload = {
  texto: string
}

let dmNotesCache: string | null = null
let dmNotesPromise: Promise<string> | null = null

function normalizeNotes(value: string | null | undefined) {
  return typeof value === "string" ? value : ""
}

export async function fetchDmNotes(forceRefresh = false): Promise<string> {
  if (!forceRefresh && dmNotesCache !== null) {
    return dmNotesCache
  }

  if (!forceRefresh && dmNotesPromise) {
    return dmNotesPromise
  }

  const pendingRequest = backendRequest<DmNotesDto>("/v1/dm-notes")
    .then((response) => {
      const notes = normalizeNotes(response?.texto)
      dmNotesCache = notes
      return notes
    })
    .finally(() => {
      dmNotesPromise = null
    })

  dmNotesPromise = pendingRequest
  return pendingRequest
}

export async function updateDmNotes(texto: string): Promise<string> {
  const response = await backendRequest<DmNotesDto>("/v1/dm-notes", {
    method: "PUT",
    body: {
      texto,
    } satisfies DmNotesUpsertPayload,
  })

  const notes = normalizeNotes(response?.texto)
  dmNotesCache = notes
  dmNotesPromise = null
  return notes
}

export function clearDmNotesCache() {
  dmNotesCache = null
  dmNotesPromise = null
}
