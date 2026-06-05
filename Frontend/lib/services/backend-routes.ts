type QueryValue = string | number | boolean | null | undefined
type QueryRecord = Record<string, QueryValue | QueryValue[]>

function withQuery(path: string, query?: QueryRecord) {
  if (!query) {
    return path
  }

  const searchParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(query)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]

    for (const value of values) {
      if (value === null || value === undefined) continue

      const normalized = String(value).trim()
      if (!normalized) continue

      searchParams.append(key, normalized)
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${path}?${queryString}` : path
}

export const backendRoutes = {
  auth: {
    login: "/auth/login",
    registrationStatus: "/auth/registration-status",
    register: "/auth/register",
    logout: "/auth/logout",
  },
  battles: {
    collection: (query?: { parentLandmarkSlug?: string; sceneType?: string | null; sceneSlug?: string | null }) =>
      withQuery("/v1/battles", query),
    activeCurrent: "/v1/battles/active/current",
    active: (sceneType: string, sceneSlug: string) => withQuery("/v1/battles/active", { sceneType, sceneSlug }),
    centerHistory: (query?: { sceneType?: string | null; page?: number; pageSize?: number }) =>
      withQuery("/v1/battles/center-history", query),
    byId: (id: number) => `/v1/battles/${id}`,
    finish: (id: number) => `/v1/battles/${id}/finish`,
    reopen: (id: number) => `/v1/battles/${id}/reopen`,
  },
  books: {
    collection: "/v1/books",
    uploads: "/v1/books/uploads",
    uploadSession: (sessionId: string) => `/v1/books/uploads/${encodeURIComponent(sessionId)}`,
    uploadWithSession: (sessionId: string) => withQuery("/v1/books", { uploadSessionId: sessionId }),
    byId: (id: number) => `/v1/books/${id}`,
  },
  buildings: {
    collection: (query?: { landmarkId?: number | null; organizationId?: number | null }) => withQuery("/v1/buildings", query),
    byId: (id: number) => `/v1/buildings/${id}`,
  },
  characters: {
    collection: (query?: { isPlayer?: boolean }) => withQuery("/v1/characters", query),
    byId: (id: number) => `/v1/characters/${id}`,
  },
  dm: {
    events: "/v1/dm/events",
    eventById: (id: number) => `/v1/dm/events/${id}`,
    notes: "/v1/dm/notes",
    openLoops: "/v1/dm/open-loops",
    openLoopById: (id: number) => `/v1/dm/open-loops/${id}`,
    relationships: "/v1/dm/relationships",
    relationshipById: (id: number) => `/v1/dm/relationships/${id}`,
  },
  estados: {
    collection: (query?: { estadoPadreId?: number | null }) => withQuery("/v1/estados", query),
    byId: (id: number) => `/v1/estados/${id}`,
  },
  landmarks: {
    collection: (include?: string | null) => withQuery("/v1/landmarks", { include }),
    byId: (id: number, include?: string | null) => withQuery(`/v1/landmarks/${id}`, { include }),
  },
  assets: {
    collection: "/v1/assets",
    byId: (id: number) => `/v1/assets/${id}`,
    metadata: (id: number) => `/v1/assets/${id}/metadata`,
  },
  monsterTokenImages: {
    resolve: (name: string, source: string[]) => withQuery("/v1/monster-token-images/resolve", { name, source }),
  },
  organizations: {
    collection: "/v1/organizations",
    byId: (id: number) => `/v1/organizations/${id}`,
  },
  partyInventory: {
    root: "/v1/party-inventory",
    balance: "/v1/party-inventory/balance",
    items: "/v1/party-inventory/items",
    itemById: (id: number) => `/v1/party-inventory/items/${id}`,
  },
  pages: {
    collection: "/v1/pages",
    byId: (id: number) => `/v1/pages/${id}`,
  },
} as const

export { withQuery }
