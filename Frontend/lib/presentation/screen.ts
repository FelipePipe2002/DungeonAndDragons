export const PRESENTATION_SCREEN_STORAGE_KEY = "presentation-screen-target"
export const PRESENTATION_SCREEN_WINDOW_NAME = "dnd-presentation-screen"

type PresentationScreenPayload = {
  landmarkSlug: string
  revision: number
}

function parsePresentationScreenPayload(value: string | null): PresentationScreenPayload | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<PresentationScreenPayload>
    if (
      typeof parsed.landmarkSlug !== "string" ||
      parsed.landmarkSlug.trim().length === 0 ||
      typeof parsed.revision !== "number" ||
      !Number.isFinite(parsed.revision)
    ) {
      return null
    }

    return {
      landmarkSlug: parsed.landmarkSlug.trim(),
      revision: parsed.revision,
    }
  } catch {
    return null
  }
}

export function readPresentationScreenTarget() {
  if (typeof window === "undefined") return null

  const payload = parsePresentationScreenPayload(
    window.localStorage.getItem(PRESENTATION_SCREEN_STORAGE_KEY),
  )

  return payload?.landmarkSlug ?? null
}

export function clearPresentationScreenTarget() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PRESENTATION_SCREEN_STORAGE_KEY)
}

export function setPresentationScreenTarget(landmarkSlug: string) {
  if (typeof window === "undefined") return

  const normalizedSlug = landmarkSlug.trim()
  if (!normalizedSlug) {
    clearPresentationScreenTarget()
    return
  }

  window.localStorage.setItem(
    PRESENTATION_SCREEN_STORAGE_KEY,
    JSON.stringify({
      landmarkSlug: normalizedSlug,
      revision: Date.now(),
    } satisfies PresentationScreenPayload),
  )
}

export function openPresentationScreen(options?: { landmarkSlug?: string | null; reset?: boolean }) {
  if (typeof window === "undefined") return

  const normalizedSlug = options?.landmarkSlug?.trim()
  if (normalizedSlug) {
    setPresentationScreenTarget(normalizedSlug)
  } else if (options?.reset) {
    clearPresentationScreenTarget()
  }

  window.open("/presentacion", PRESENTATION_SCREEN_WINDOW_NAME)
}
