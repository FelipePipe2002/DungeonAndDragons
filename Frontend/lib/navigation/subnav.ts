import type { LucideIcon } from "lucide-react"
import { BookMarked, BookOpen, Building2, CalendarDays, Link2, MapPin, Package, ScrollText, Shield, Star, Swords, UserRound, Users, WandSparkles } from "lucide-react"

import { normalizeMainNavPath } from "@/lib/navigation/main-nav"

export type AppSubnavItem = {
  id: string
  label: string
  icon: LucideIcon
  value: string
}

export type AppSubnavConfig = {
  basePath: string
  queryKey: string
  defaultValue: string
  items: AppSubnavItem[]
}

export const APP_SUBNAV_CONFIGS: AppSubnavConfig[] = [
  {
    basePath: "/informacion",
    queryKey: "section",
    defaultValue: "monsters",
    items: [
      { id: "monsters", value: "monsters", label: "Monstruos", icon: Swords },
      { id: "conditions", value: "conditions", label: "Condiciones", icon: ScrollText },
      { id: "spells", value: "spells", label: "Conjuros", icon: WandSparkles },
      { id: "items", value: "items", label: "Items", icon: Package },
      { id: "feats", value: "feats", label: "Dotes", icon: Star },
      { id: "rules", value: "rules", label: "Reglas", icon: BookOpen },
      { id: "books", value: "books", label: "Libros", icon: BookMarked },
      { id: "pages", value: "pages", label: "Paginas", icon: Link2 },
    ],
  },
  {
    basePath: "/entidades",
    queryKey: "section",
    defaultValue: "personajes",
    items: [
      { id: "personajes", value: "personajes", label: "Personajes", icon: Users },
      { id: "jugadores", value: "jugadores", label: "Jugadores", icon: UserRound },
      { id: "edificios", value: "edificios", label: "Edificios", icon: Building2 },
      { id: "organizaciones", value: "organizaciones", label: "Organizaciones", icon: Shield },
      { id: "landmarks", value: "landmarks", label: "Landmarks", icon: MapPin },
    ],
  },
  {
    basePath: "/notas",
    queryKey: "section",
    defaultValue: "dm-notes",
    items: [
      { id: "dm-notes", value: "dm-notes", label: "Notas DM", icon: BookOpen },
      { id: "dm-events", value: "dm-events", label: "Eventos DM", icon: CalendarDays },
      { id: "dm-relationships", value: "dm-relationships", label: "Relaciones", icon: Link2 },
    ],
  },
]

export function getSubnavConfig(pathname: string | null | undefined): AppSubnavConfig | null {
  const normalizedPath = normalizeMainNavPath(pathname)

  return (
    APP_SUBNAV_CONFIGS.find((config) => normalizedPath === config.basePath || normalizedPath.startsWith(`${config.basePath}/`)) ?? null
  )
}

export function getSubnavActiveValue(config: AppSubnavConfig, currentValue: string | null | undefined): string {
  const normalizedValue = currentValue?.trim()
  if (!normalizedValue) {
    return config.defaultValue
  }

  return config.items.some((item) => item.value === normalizedValue) ? normalizedValue : config.defaultValue
}
