"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Users, Building2, Shield, Map, Scroll, BookOpen, BookMarked, Monitor, Link2, Swords } from "lucide-react"
import { openPresentationScreen } from "@/lib/presentation/screen"

const navItems = [
  { href: "/mapa", label: "Mapa", icon: Scroll },
  { href: "/Batalla", label: "Batalla", icon: Swords },
  { href: "/presentacion", label: "Presentacion", icon: Monitor, opensInPresentationWindow: true },
  { href: "/Jugadores", label: "Jugadores", icon: Users },
  { href: "/personajes", label: "Personajes", icon: Users },
  { href: "/edificios", label: "Edificios", icon: Building2 },
  { href: "/organizaciones", label: "Organizaciones", icon: Shield },
  { href: "/landmarks", label: "Landmarks", icon: Map },
  { href: "/books", label: "Libros", icon: BookMarked },
  { href: "/paginas", label: "Paginas", icon: Link2 },
  { href: "/notas", label: "Notas", icon: BookOpen },
]

export function AppNav() {
  const pathname = usePathname()
  const isPresentationScreenPage = pathname === "/presentacion"

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
            {navItems.map((item) => {
              const isActive = pathname === item.href
              if (item.opensInPresentationWindow) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => openPresentationScreen({ reset: true })}
                    className={cn(
                      "relative flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                      "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-full items-center gap-2 px-4 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="hidden md:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
