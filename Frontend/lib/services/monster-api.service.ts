import type { MonsterBatchResponse, MonsterExactResponse, MonsterListItem, MonsterRecord } from "@/lib/monster/types"
import { buildMonsterListItem, normalizeMonsterRecord } from "@/lib/monster/utils"

const DEFAULT_BATCH_SIZE = 30

type MonsterQueryOptions = {
  withTokenImage?: boolean
  summaryOnly?: boolean
  offset?: number
  sortField?: "name" | "type" | "cr"
  sortDirection?: "asc" | "desc"
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }

  return null
}

function parseMonsterListItem(value: unknown): MonsterListItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const name = parseOptionalString(record.name)
  if (!name) {
    return null
  }

  const nameExact = parseOptionalString(record.nameExact) ?? name
  const type = parseOptionalString(record.type) ?? ""
  const cr = parseOptionalString(record.cr) ?? ""
  const initiativeModifier = parseOptionalNumber(record.initiativeModifier) ?? 0
  const hpAverage = parseOptionalNumber(record.hpAverage)
  const image = parseOptionalString(record.image)

  return {
    name,
    nameExact,
    type,
    cr,
    initiativeModifier,
    hpAverage,
    image,
  }
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (!text) continue
    searchParams.set(key, text)
  }

  return searchParams.toString()
}

export async function searchMonsters(
  query: string,
  limit = DEFAULT_BATCH_SIZE,
  options: MonsterQueryOptions = {},
): Promise<MonsterBatchResponse> {
  const withTokenImage = options.withTokenImage !== false
  const summaryOnly = options.summaryOnly !== false
  const search = buildQuery({
    q: query,
    offset: options.offset ?? 0,
    limit,
    withTokenImage: withTokenImage ? 1 : 0,
    summaryOnly: summaryOnly ? 1 : 0,
    sortBy: options.sortField,
    sortDir: options.sortDirection,
  })
  const response = await fetch(`/monster-api/monsters?${search}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo buscar monstruos.")
  }

  const payload = (await response.json()) as {
    items?: unknown[]
    hasMore?: unknown
    nextOffset?: unknown
    total?: unknown
  }
  const items = (Array.isArray(payload.items) ? payload.items : [])
    .map((monster) => parseMonsterListItem(monster) ?? buildMonsterListItem(normalizeMonsterRecord(monster) ?? {}))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return {
    items,
    hasMore: Boolean(payload.hasMore),
    nextOffset: typeof payload.nextOffset === "number" && Number.isFinite(payload.nextOffset) ? payload.nextOffset : 0,
    total: typeof payload.total === "number" && Number.isFinite(payload.total) ? payload.total : 0,
  }
}

export async function fetchMonsterByExactName(
  nameExact: string,
  options: MonsterQueryOptions = {},
): Promise<MonsterRecord | null> {
  const withTokenImage = options.withTokenImage !== false
  const search = buildQuery({ nameExact, withTokenImage: withTokenImage ? 1 : 0 })
  const response = await fetch(`/monster-api/monsters?${search}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo cargar el monstruo.")
  }

  const payload = (await response.json()) as MonsterExactResponse
  if (!payload || typeof payload !== "object") {
    return null
  }

  return normalizeMonsterRecord(payload.item) ?? null
}

export async function prefetchMonsterTokenImages(limit = 8): Promise<void> {
  const search = buildQuery({ prefetchTokens: 1, limit })
  const response = await fetch(`/monster-api/monsters?${search}`, {
    method: "GET",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("No se pudo predescargar imágenes de monstruos.")
  }
}
