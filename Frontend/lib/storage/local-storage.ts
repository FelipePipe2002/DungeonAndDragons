export const LANDMARKS_STORAGE_KEY = "dnd:mapa:landmarks"
export const CHARACTERS_STORAGE_KEY = "dnd:mapa:characters"

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readJsonFromLocalStorage<T>(key: string): T | null {
  if (!hasWindow()) return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJsonToLocalStorage(key: string, value: unknown): boolean {
  if (!hasWindow()) return false

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function mapImageStorageKey(storageKey = LANDMARKS_STORAGE_KEY) {
  return `${storageKey}:map-image`
}
