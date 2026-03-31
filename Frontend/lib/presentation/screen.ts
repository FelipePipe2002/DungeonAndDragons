import type { BattleSceneType } from "@/lib/types"

export const PRESENTATION_SCREEN_STORAGE_KEY = "presentation-screen-target"
export const PRESENTATION_SCREEN_STATUS_STORAGE_KEY = "presentation-screen-status"
export const PRESENTATION_SCREEN_WINDOW_NAME = "dnd-presentation-screen"
const PRESENTATION_SCREEN_STATUS_EVENT_NAME = "dnd:presentation-screen-status"

export type PresentationScreenTarget = {
  sceneType: BattleSceneType
  sceneSlug: string
}

export type PresentationScreenPayload = PresentationScreenTarget & {
  revision: number
}

export type PresentationSceneStatusPayload = PresentationScreenPayload & {
  sceneLabel: string
  status: "loaded" | "error"
  message?: string
}

function parsePresentationScreenPayload(value: string | null): PresentationScreenPayload | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<PresentationScreenPayload>
    const sceneSlug =
      typeof parsed.sceneSlug === "string" && parsed.sceneSlug.trim().length > 0
        ? parsed.sceneSlug.trim()
        : typeof (parsed as { landmarkSlug?: string }).landmarkSlug === "string" &&
            (parsed as { landmarkSlug?: string }).landmarkSlug!.trim().length > 0
          ? (parsed as { landmarkSlug?: string }).landmarkSlug!.trim()
          : null
    const sceneType = parsed.sceneType === "building" ? "building" : "landmark"

    if (
      !sceneSlug ||
      typeof parsed.revision !== "number" ||
      !Number.isFinite(parsed.revision)
    ) {
      return null
    }

    return {
      sceneType,
      sceneSlug,
      revision: parsed.revision,
    }
  } catch {
    return null
  }
}

function parsePresentationSceneStatusPayload(value: string | null): PresentationSceneStatusPayload | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<PresentationSceneStatusPayload>
    const target = parsePresentationScreenPayload(JSON.stringify(parsed))
    const sceneLabel = typeof parsed.sceneLabel === "string" && parsed.sceneLabel.trim().length > 0
      ? parsed.sceneLabel.trim()
      : null
    const status = parsed.status === "error" ? "error" : parsed.status === "loaded" ? "loaded" : null
    const message = typeof parsed.message === "string" && parsed.message.trim().length > 0
      ? parsed.message.trim()
      : undefined

    if (!target || !sceneLabel || !status) {
      return null
    }

    return {
      ...target,
      sceneLabel,
      status,
      message,
    }
  } catch {
    return null
  }
}

function emitPresentationSceneStatus(payload: PresentationSceneStatusPayload) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<PresentationSceneStatusPayload>(PRESENTATION_SCREEN_STATUS_EVENT_NAME, {
      detail: payload,
    }),
  )
}

export function readPresentationScreenTarget(): PresentationScreenPayload | null {
  if (typeof window === "undefined") return null

  const payload = parsePresentationScreenPayload(
    window.localStorage.getItem(PRESENTATION_SCREEN_STORAGE_KEY),
  )

  return payload
}

export function readPresentationSceneStatus(): PresentationSceneStatusPayload | null {
  if (typeof window === "undefined") return null

  return parsePresentationSceneStatusPayload(
    window.localStorage.getItem(PRESENTATION_SCREEN_STATUS_STORAGE_KEY),
  )
}

export function clearPresentationScreenTarget() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PRESENTATION_SCREEN_STORAGE_KEY)
}

export function setPresentationScreenTarget(
  target: PresentationScreenTarget,
  revision = Date.now(),
): PresentationScreenPayload | null {
  if (typeof window === "undefined") return null

  const normalizedSlug = target.sceneSlug.trim()
  if (!normalizedSlug) {
    clearPresentationScreenTarget()
    return null
  }

  const payload = {
    sceneType: target.sceneType,
    sceneSlug: normalizedSlug,
    revision,
  } satisfies PresentationScreenPayload

  window.localStorage.setItem(PRESENTATION_SCREEN_STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function publishPresentationSceneStatus(payload: PresentationSceneStatusPayload) {
  if (typeof window === "undefined") return

  window.localStorage.setItem(PRESENTATION_SCREEN_STATUS_STORAGE_KEY, JSON.stringify(payload))
  emitPresentationSceneStatus(payload)
}

export function subscribeToPresentationSceneStatus(
  listener: (payload: PresentationSceneStatusPayload) => void,
) {
  if (typeof window === "undefined") {
    return () => {}
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== PRESENTATION_SCREEN_STATUS_STORAGE_KEY) {
      return
    }

    const payload = parsePresentationSceneStatusPayload(event.newValue)
    if (payload) {
      listener(payload)
    }
  }

  const handleCustomEvent = (event: Event) => {
    const payload = (event as CustomEvent<PresentationSceneStatusPayload>).detail
    if (payload) {
      listener(payload)
    }
  }

  window.addEventListener("storage", handleStorage)
  window.addEventListener(PRESENTATION_SCREEN_STATUS_EVENT_NAME, handleCustomEvent)

  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(PRESENTATION_SCREEN_STATUS_EVENT_NAME, handleCustomEvent)
  }
}

export function openPresentationScreen(options?: {
  sceneType?: BattleSceneType | null
  sceneSlug?: string | null
  landmarkSlug?: string | null
  reset?: boolean
}): PresentationScreenPayload | null {
  if (typeof window === "undefined") return null

  const normalizedSlug = options?.sceneSlug?.trim() || options?.landmarkSlug?.trim()
  const sceneType = options?.sceneType === "building" ? "building" : "landmark"
  let nextTarget: PresentationScreenPayload | null = null
  if (normalizedSlug) {
    nextTarget = setPresentationScreenTarget({
      sceneType,
      sceneSlug: normalizedSlug,
    })
  } else if (options?.reset) {
    clearPresentationScreenTarget()
  }

  const nextUrl = normalizedSlug
    ? `/presentacion?sceneType=${encodeURIComponent(sceneType)}&scene=${encodeURIComponent(normalizedSlug)}`
    : "/presentacion"

  window.open(nextUrl, PRESENTATION_SCREEN_WINDOW_NAME)
  return nextTarget
}
