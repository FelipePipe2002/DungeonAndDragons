export const TOGGLE_NAV_SETTINGS_EVENT = "dm-codex:toggle-nav-settings"

export function toggleNavSettingsPanel() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new Event(TOGGLE_NAV_SETTINGS_EVENT))
}
