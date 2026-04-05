import { NextResponse } from "next/server"

import { getMonsterBatch, getMonsterByExactName, prefetchMissingMonsterTokens } from "@/lib/monster/monsters-store"
import { buildMonsterListItem, normalizeMonsterRecord } from "@/lib/monster/utils"

function parseIntegerParam(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBooleanParam(value: string | null, fallback: boolean) {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true
  if (normalized === "0" || normalized === "false" || normalized === "no") return false
  return fallback
}

function buildMonsterRequestContext(request: Request) {
  const requestUrl = new URL(request.url)
  const hostname = requestUrl.hostname.trim().toLowerCase()
  const cookie = request.headers.get("cookie")?.trim() ?? ""
  const xsrfToken = request.headers.get("x-xsrf-token")?.trim() ?? ""
  const configuredBackendApiBaseUrl = process.env.BACKEND_API_BASE_URL?.trim() ?? ""
  const backendApiBaseUrl = configuredBackendApiBaseUrl
    ? configuredBackendApiBaseUrl.replace(/\/+$/, "")
    : hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
      ? `${requestUrl.protocol}//${hostname}:8086/api`
      : "http://localhost:8086/api"

  return {
    cookie,
    xsrfToken,
    backendApiBaseUrl,
  }
}

function buildMonsterSummaryItem(rawMonster: unknown) {
  const monster = normalizeMonsterRecord(rawMonster)
  if (!monster) {
    return null
  }

  const summary = buildMonsterListItem(monster)
  if (!summary) {
    return null
  }

  const normalizedCr =
    typeof summary.cr === "string" && summary.cr.trim().length > 0 && summary.cr.trim() !== "-"
      ? summary.cr
      : "Unknown"

  return {
    ...summary,
    cr: normalizedCr,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const prefetchTokens = searchParams.get("prefetchTokens")?.trim().toLowerCase()
  const nameExact = searchParams.get("nameExact")?.trim() ?? ""
  const withTokenImage = parseBooleanParam(searchParams.get("withTokenImage"), true)
  const summaryOnly = parseBooleanParam(searchParams.get("summaryOnly"), false)
  const sortBy = searchParams.get("sortBy")?.trim().toLowerCase() ?? ""
  const sortDir = searchParams.get("sortDir")?.trim().toLowerCase() ?? ""
  const requestContext = buildMonsterRequestContext(request)

  try {
    if (prefetchTokens === "1" || prefetchTokens === "true") {
      const limit = parseIntegerParam(searchParams.get("limit"), 8)
      const summary = await prefetchMissingMonsterTokens(limit, requestContext)
      return NextResponse.json(summary)
    }

    if (nameExact) {
      const monster = normalizeMonsterRecord(
        await getMonsterByExactName(nameExact, requestContext, { withTokenImage }),
      )
      return NextResponse.json({ item: monster ?? null })
    }

    const offset = parseIntegerParam(searchParams.get("offset"), 0)
    const requestedLimit = parseIntegerParam(searchParams.get("limit"), 30)
    const rawFilters: Record<string, string> = {}
    for (const [key, value] of searchParams.entries()) {
      if (
        !value ||
        key === "offset" ||
        key === "limit" ||
        key === "nameExact" ||
        key === "prefetchTokens" ||
        key === "withTokenImage" ||
        key === "summaryOnly" ||
        key === "sortBy" ||
        key === "sortDir"
      ) {
        continue
      }
      rawFilters[key] = value
    }

    const batch = await getMonsterBatch(offset, requestedLimit, rawFilters as any, requestContext, {
      withTokenImage,
      sortField: sortBy === "type" || sortBy === "cr" ? sortBy : "name",
      sortDirection: sortDir === "desc" ? "desc" : "asc",
    })
    const items = Array.isArray(batch?.items) ? batch.items : []
    const normalizedItems = summaryOnly
      ? items.map(buildMonsterSummaryItem).filter(Boolean)
      : items.map((monster) => normalizeMonsterRecord(monster)).filter(Boolean)

    return NextResponse.json({
      items: normalizedItems,
      hasMore: Boolean(batch?.hasMore),
      nextOffset: Number.isFinite(batch?.nextOffset) ? batch.nextOffset : offset + normalizedItems.length,
      total: Number.isFinite(batch?.total) ? batch.total : normalizedItems.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar monstruos."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
