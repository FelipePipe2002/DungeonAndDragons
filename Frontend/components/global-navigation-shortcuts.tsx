"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  openCreateBuildingDialog,
  openCreateCharacterDialog,
  openCreateOrganizationDialog,
} from "@/lib/navigation/global-create-events"
import { getMainNavItemByShortcut, normalizeMainNavPath } from "@/lib/navigation/main-nav"
import { toggleNavSettingsPanel } from "@/lib/navigation/nav-settings-events"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  return Boolean(target.closest("[contenteditable='true'], [contenteditable=''], input, textarea, select"))
}

function getShortcutIndexFromKeyboardEvent(event: KeyboardEvent): number | null {
  const match = event.code.match(/^(?:Digit|Numpad)([1-8])$/)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

export function GlobalNavigationShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLocaleLowerCase("es") === "c") {
        event.preventDefault()
        toggleNavSettingsPanel()
        return
      }

      if (event.key.toLocaleLowerCase("es") === "p") {
        event.preventDefault()
        openCreateCharacterDialog()
        return
      }

      if (event.key.toLocaleLowerCase("es") === "b") {
        event.preventDefault()
        openCreateBuildingDialog()
        return
      }

      if (event.key.toLocaleLowerCase("es") === "o") {
        event.preventDefault()
        openCreateOrganizationDialog()
        return
      }

      if (event.key.toLocaleLowerCase("es") === "n") {
        const notesPath = "/notas"
        const currentPath = normalizeMainNavPath(pathname)
        if (currentPath === notesPath) {
          return
        }

        event.preventDefault()
        router.push(notesPath)
        return
      }

      const shortcutIndex = getShortcutIndexFromKeyboardEvent(event)
      if (shortcutIndex == null) {
        return
      }

      const targetItem = getMainNavItemByShortcut(shortcutIndex)
      if (!targetItem) {
        return
      }

      const currentPath = normalizeMainNavPath(pathname)
      if (currentPath === normalizeMainNavPath(targetItem.href)) {
        return
      }

      event.preventDefault()
      router.push(targetItem.href)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [pathname, router])

  return null
}
