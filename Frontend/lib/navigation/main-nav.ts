export type MainNavItemId =
  | "mapa"
  | "entidades"
  | "notas"
  | "informacion"
  | "batalla"
  | "presentacion"

export type MainNavItem = {
  id: MainNavItemId
  href: string
  label: string
  shortcutIndex?: number
  opensInPresentationWindow?: boolean
}

export type NavigationShortcut = {
  key: string
  action: string
}

export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { id: "mapa", href: "/mapa", label: "Mapa", shortcutIndex: 1 },
  { id: "informacion", href: "/informacion", label: "Informacion", shortcutIndex: 7 },
  { id: "entidades", href: "/entidades", label: "Entidades", shortcutIndex: 2 },
  { id: "notas", href: "/notas", label: "Notas", shortcutIndex: 6 },
  { id: "batalla", href: "/batalla", label: "Batalla", shortcutIndex: 8 },
  { id: "presentacion", href: "/presentacion", label: "Presentacion", opensInPresentationWindow: true },
]

const NAV_PATH_ALIASES: Record<string, string> = {
  "/personajes": "/entidades",
  "/characters": "/entidades",
  "/Jugadores": "/entidades",
  "/organizaciones": "/entidades",
  "/landmarks": "/entidades",
  "/edificios": "/entidades",
  "/Batalla": "/batalla",
}

export function normalizeMainNavPath(pathname: string | null | undefined): string {
  if (!pathname) {
    return ""
  }

  return NAV_PATH_ALIASES[pathname] ?? pathname
}

const MAIN_NAV_SHORTCUT_ITEMS = MAIN_NAV_ITEMS.filter(
  (item) => typeof item.shortcutIndex === "number" && !item.opensInPresentationWindow,
)

export function getMainNavItemByShortcut(shortcutIndex: number): MainNavItem | null {
  return MAIN_NAV_SHORTCUT_ITEMS.find((item) => item.shortcutIndex === shortcutIndex) ?? null
}

export function getMainNavItemByPath(pathname: string | null | undefined): MainNavItem | null {
  const normalizedPath = normalizeMainNavPath(pathname)

  if (
    normalizedPath.startsWith("/landmarks/") ||
    normalizedPath.startsWith("/edificios/") ||
    normalizedPath.startsWith("/organizaciones/") ||
    normalizedPath.startsWith("/personajes/") ||
    normalizedPath.startsWith("/characters/") ||
    normalizedPath.startsWith("/Jugadores/")
  ) {
    return MAIN_NAV_ITEMS.find((item) => item.href === "/entidades") ?? null
  }

  const exactMatch = MAIN_NAV_ITEMS.find((item) => item.href === normalizedPath)
  if (exactMatch) {
    return exactMatch
  }

  return (
    MAIN_NAV_ITEMS.find((item) => {
      if (item.opensInPresentationWindow) {
        return false
      }

      return normalizedPath.startsWith(`${item.href}/`)
    }) ?? null
  )
}

export const GLOBAL_NAVIGATION_SHORTCUTS: NavigationShortcut[] = MAIN_NAV_SHORTCUT_ITEMS
  .map((item) => {
    if (typeof item.shortcutIndex !== "number") {
      return null
    }

    return {
      key: `Alt+${item.shortcutIndex}`,
      action: `Ir a ${item.label}`,
    } satisfies NavigationShortcut
  })
  .filter((shortcut): shortcut is NavigationShortcut => shortcut !== null)

// Atajos locales por pantalla. La vista detalle de landmarks agrega shortcuts propios.
const LOCAL_SHORTCUTS_BY_PATH: Record<string, NavigationShortcut[]> = {
  "/entidades": [],
  "/informacion": [],
  "/presentacion": [
    {
      key: "Esc",
      action: "Pantalla negra",
    },
    {
      key: "H",
      action: "Mostrar/ocultar numero de ficha",
    },
    {
      key: "F",
      action: "Voltear imagen vertical",
    },
  ],
  "/batalla": [
    {
      key: "Ctrl/Cmd+Z",
      action: "Deshacer",
    },
    {
      key: "Ctrl/Cmd+Shift+Z",
      action: "Rehacer",
    },
    {
      key: "Ctrl/Cmd+Y",
      action: "Rehacer",
    },
    {
      key: "Shift+H",
      action: "Ocultar/mostrar ficha",
    },
    {
      key: "S",
      action: "Cambiar aliado/enemigo de la ficha seleccionada o hovereada",
    },
    {
      key: "Shift+D",
      action: "Duplicar ficha",
    },
    {
      key: "Shift+R",
      action: "Reiniciar iniciativas y mandar jugadores con personaje al final",
    },
    {
      key: "F",
      action: "Activar/desactivar modo Friendly en presentacion",
    },
    {
      key: "Shift+Click y arrastrar (ficha)",
      action: "Mover ficha",
    },
    {
      key: "Alt (durante arrastre de ficha)",
      action: "Ajustar a grilla",
    },
    {
      key: "Alt (durante niebla)",
      action: "Ajustar las esquinas del rectangulo a la grilla",
    },
    {
      key: "Esc (editor de niebla)",
      action: "Salir de Mostrar/Tapar sin cerrar el panel",
    },
    {
      key: "Shift+Click derecho (ficha)",
      action: "Eliminar ficha",
    },
    {
      key: "Shift+Scroll (ficha)",
      action: "Cambiar tamano de ficha",
    },
  ],
}

export function getLocalNavigationShortcuts(pathname: string | null | undefined): NavigationShortcut[] {
  const normalizedPath = normalizeMainNavPath(pathname)
  if (normalizedPath.startsWith("/landmarks/")) {
    return [
      {
        key: "Ctrl+Click",
        action: "Marcar seleccion en mapa",
      },
      {
        key: "Shift+Click (edificio)",
        action: "Ocultar/mostrar edificio en mapa",
      },
      {
        key: "Esc",
        action: "Quitar foco del mapa",
      },
      {
        key: "Ctrl+R",
        action: "Limpiar seleccion",
      },
      {
        key: "Ctrl+Shift+R",
        action: "Restablecer mapa",
      },
    ]
  }

  return LOCAL_SHORTCUTS_BY_PATH[normalizedPath] ?? []
}
