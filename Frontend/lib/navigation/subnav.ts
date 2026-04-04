import type { LucideIcon } from "lucide-react"
import { BookMarked, BookOpen, Link2, ScrollText, Star, Swords, WandSparkles } from "lucide-react"

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
      { id: "feats", value: "feats", label: "Dotes", icon: Star },
      { id: "rules", value: "rules", label: "Reglas", icon: BookOpen },
      { id: "books", value: "books", label: "Libros", icon: BookMarked },
      { id: "pages", value: "pages", label: "Paginas", icon: Link2 },
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
