import type {
  BackendDmNotesDto as DmNotesDto,
  BackendDmNotesUpsertPayload as DmNotesUpsertPayload,
} from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

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

  const pendingRequest = backendRequest<DmNotesDto>(backendRoutes.dm.notes)
    .then((response) => {
      const notes = normalizeNotes(response?.text)
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
  const response = await backendRequest<DmNotesDto>(backendRoutes.dm.notes, {
    method: "PUT",
    body: {
      text: texto,
    } satisfies DmNotesUpsertPayload,
  })

  const notes = normalizeNotes(response?.text)
  dmNotesCache = notes
  dmNotesPromise = null
  return notes
}

export function clearDmNotesCache() {
  dmNotesCache = null
  dmNotesPromise = null
}
