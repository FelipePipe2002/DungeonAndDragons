export const OPEN_CREATE_CHARACTER_EVENT = "dm-codex:open-create-character"
export const OPEN_CREATE_BUILDING_EVENT = "dm-codex:open-create-building"
export const OPEN_CREATE_ORGANIZATION_EVENT = "dm-codex:open-create-organization"

export const CHARACTERS_CHANGED_EVENT = "dm-codex:characters-changed"
export const BUILDINGS_CHANGED_EVENT = "dm-codex:buildings-changed"
export const ORGANIZATIONS_CHANGED_EVENT = "dm-codex:organizations-changed"

function dispatchWindowEvent(eventName: string) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(eventName))
}

export function openCreateCharacterDialog() {
  dispatchWindowEvent(OPEN_CREATE_CHARACTER_EVENT)
}

export function openCreateBuildingDialog() {
  dispatchWindowEvent(OPEN_CREATE_BUILDING_EVENT)
}

export function openCreateOrganizationDialog() {
  dispatchWindowEvent(OPEN_CREATE_ORGANIZATION_EVENT)
}

export function notifyCharactersChanged() {
  dispatchWindowEvent(CHARACTERS_CHANGED_EVENT)
}

export function notifyBuildingsChanged() {
  dispatchWindowEvent(BUILDINGS_CHANGED_EVENT)
}

export function notifyOrganizationsChanged() {
  dispatchWindowEvent(ORGANIZATIONS_CHANGED_EVENT)
}
