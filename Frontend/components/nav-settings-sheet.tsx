"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings2 } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  GLOBAL_NAVIGATION_SHORTCUTS,
  getLocalNavigationShortcuts,
  getMainNavItemByPath,
  type NavigationShortcut,
} from "@/lib/navigation/main-nav"
import { TOGGLE_NAV_SETTINGS_EVENT, toggleNavSettingsPanel } from "@/lib/navigation/nav-settings-events"

type NavSettingsSheetProps = {
  showTrigger?: boolean
}

export function NavSettingsSheet({ showTrigger = true }: NavSettingsSheetProps) {
  const pathname = usePathname()
  const currentNavItem = getMainNavItemByPath(pathname)
  const localShortcuts = getLocalNavigationShortcuts(pathname)
  const [open, setOpen] = useState(false)
  const globalShortcuts = useMemo<NavigationShortcut[]>(
    () => [
      ...GLOBAL_NAVIGATION_SHORTCUTS,
      {
        key: "Alt+P",
        action: "Crear personaje",
      },
      {
        key: "Alt+B",
        action: "Crear edificio",
      },
      {
        key: "Alt+O",
        action: "Crear organizacion",
      },
      {
        key: "Alt+E",
        action: "Agregar evento del DM",
      },
      {
        key: "Alt+R",
        action: "Agregar relacion del DM",
      },
      {
        key: "Alt+N",
        action: "Ir a DM",
      },
      {
        key: "Alt+C",
        action: "Abrir/cerrar configuracion",
      },
    ],
    [],
  )

  useEffect(() => {
    const handleToggleSettings = () => {
      setOpen((current) => !current)
    }

    window.addEventListener(TOGGLE_NAV_SETTINGS_EVENT, handleToggleSettings)
    return () => {
      window.removeEventListener(TOGGLE_NAV_SETTINGS_EVENT, handleToggleSettings)
    }
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Configuracion"
          title="Configuracion"
          className="text-muted-foreground hover:text-foreground"
          onClick={toggleNavSettingsPanel}
        >
          <Settings2 className="size-4" />
        </Button>
      ) : null}

      <SheetContent side="right" className="w-full max-w-md sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configuracion</SheetTitle>
          <SheetDescription>Controles globales y atajos generales de navegacion.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <Tabs defaultValue="globales" className="gap-3">
            <TabsList>
              <TabsTrigger value="globales">Globales</TabsTrigger>
              <TabsTrigger value="locales">Locales</TabsTrigger>
            </TabsList>

            <TabsContent value="globales" className="space-y-3">
              <div className="rounded-md border bg-card p-3">
                <p className="text-sm font-medium text-foreground">Navegacion rapida</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Usa <span className="font-semibold">Alt + [numero]</span> para ir a secciones clave.
                </p>
              </div>

              <div className="rounded-md border bg-card p-3">
                <ul className="space-y-2">
                  {globalShortcuts.map((shortcut) => (
                    <li key={shortcut.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-foreground">{shortcut.action}</span>
                      <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {shortcut.key}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Los atajos globales no se ejecutan mientras escribis en campos de texto.
              </p>
            </TabsContent>

            <TabsContent value="locales" className="space-y-3">
              <div className="rounded-md border bg-card p-3">
                <p className="text-sm font-medium text-foreground">Controles locales</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pagina actual: <span className="font-semibold">{currentNavItem?.label ?? "Sin seccion principal"}</span>
                </p>
              </div>

              {localShortcuts.length > 0 ? (
                <div className="rounded-md border bg-card p-3">
                  <ul className="space-y-2">
                    {localShortcuts.map((shortcut) => (
                      <li key={`${shortcut.key}-${shortcut.action}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-foreground">{shortcut.action}</span>
                        <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {shortcut.key}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border bg-card p-3">
                  <p className="text-sm text-muted-foreground">Ninguna.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
