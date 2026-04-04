"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { type LucideIcon, Boxes, Scroll, BookOpen, Monitor, Swords, FileText, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMainNavItemByPath, type MainNavItemId, MAIN_NAV_ITEMS } from "@/lib/navigation/main-nav"
import { toggleNavSettingsPanel } from "@/lib/navigation/nav-settings-events"
import { openPresentationScreen } from "@/lib/presentation/screen"

const NAV_ITEM_ICONS: Record<MainNavItemId, LucideIcon> = {
  mapa: Scroll,
  entidades: Boxes,
  notas: BookOpen,
  informacion: FileText,
  batalla: Swords,
  presentacion: Monitor,
}

export function AppNav() {
  const pathname = usePathname()
  const isPresentationScreenPage = pathname === "/presentacion"
  const activeItem = getMainNavItemByPath(pathname)

  if (pathname === "/login" || isPresentationScreenPage) {
    return null
  }

  return (
    <nav className="sticky top-0 z-50 h-[var(--app-nav-height)] border-b-2 border-primary/20 bg-card/95 shadow-sm backdrop-blur">
      <div className="mx-auto h-full max-w-[1600px] px-6">
        <div className="flex h-full items-center gap-1">
          <Link
            href="/"
            className="mr-8 flex h-full items-center gap-2.5"
          >
            <div className="flex size-9 items-center justify-center rounded-sm border-2 border-primary/40 bg-primary/10">
              <Scroll className="size-4 text-primary" />
            </div>
            <span className="hidden font-serif text-xl text-primary sm:inline tracking-wide">DM Codex</span>
          </Link>
          <div className="flex items-center">
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = activeItem?.id === item.id
              const Icon = NAV_ITEM_ICONS[item.id]
              if (item.opensInPresentationWindow) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPresentationScreen({ reset: true })}
                    className={cn(
                      "relative flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                      "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                )
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "relative flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden md:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              )
            })}
          </div>
          <div className="ml-auto flex items-center">
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
          </div>
        </div>
      </div>
    </nav>
  )
}
