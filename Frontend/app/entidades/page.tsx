"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { CharactersPageContent } from "@/components/characters/CharactersPageContent"
import { BuildingsPageContent } from "@/components/entities/BuildingsPageContent"
import { EstadosPageContent } from "@/components/entities/EstadosPageContent"
import { LandmarksPageContent } from "@/components/entities/LandmarksPageContent"
import { OrganizationsPageContent } from "@/components/entities/OrganizationsPageContent"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"

type EntitySection = "personajes" | "jugadores" | "estados" | "edificios" | "organizaciones" | "landmarks"

function EntidadesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const entidadesSubnavConfig = getSubnavConfig("/entidades")
  const activeSection = (entidadesSubnavConfig
    ? getSubnavActiveValue(entidadesSubnavConfig, searchParams.get("section"))
    : "personajes") as EntitySection

  useEffect(() => {
    if (!entidadesSubnavConfig) {
      return
    }

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(entidadesSubnavConfig, currentSection)
    if (currentSection === normalizedSection) {
      return
    }

    router.replace(`/entidades?section=${encodeURIComponent(normalizedSection)}`)
  }, [entidadesSubnavConfig, router, searchParams])

  if (activeSection === "jugadores") {
    return <CharactersPageContent initialScope="players" showHeader={false} />
  }

  if (activeSection === "edificios") {
    return <BuildingsPageContent showHeader={false} />
  }
  
  if (activeSection === "organizaciones") {
    return <OrganizationsPageContent showHeader={false} />
  }
  
  if (activeSection === "landmarks") {
    return <LandmarksPageContent showHeader={false} />
  }
  
  if (activeSection === "estados") {
    return <EstadosPageContent showHeader={false} />
  }

  return <CharactersPageContent initialScope="npcs" showHeader={false} />
}

export default function EntidadesPage() {
  return (
    <Suspense fallback={null}>
      <EntidadesPageContent />
    </Suspense>
  )
}
