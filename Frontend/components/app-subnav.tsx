"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/main-nav"

export function AppSubnav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isMounted, setIsMounted] = useState(false)
  const config = getSubnavConfig(pathname)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || !config || pathname === "/login" || pathname === "/presentacion") {
    return null
  }

  const activeValue = getSubnavActiveValue(config, searchParams.get(config.queryKey))

  return (
    <div className="sticky top-[var(--app-nav-height)] z-40 border-b border-primary/10 bg-card/92 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-6 py-1.5">
        {config.items.map((item) => {
          const Icon = item.icon
          const isActive = activeValue === item.value

          return (
            <Link
              key={item.id}
              href={`${config.basePath}?${config.queryKey}=${encodeURIComponent(item.value)}`}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
              {isActive ? <span className="absolute inset-x-2 bottom-0 h-px bg-primary" /> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
