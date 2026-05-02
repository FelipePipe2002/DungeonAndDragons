"use client"

import { Suspense, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"

import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"

const CharactersPageContent = dynamic(() =>
  import("@/components/characters/CharactersPageContent").then((mod) => mod.CharactersPageContent),
)
const BuildingsPageContent = dynamic(() =>
  import("@/components/entities/BuildingsPageContent").then((mod) => mod.BuildingsPageContent),
)
const EstadosPageContent = dynamic(() =>
  import("@/components/entities/EstadosPageContent").then((mod) => mod.EstadosPageContent),
)
const LandmarksPageContent = dynamic(() =>
  import("@/components/entities/LandmarksPageContent").then((mod) => mod.LandmarksPageContent),
)
const OrganizationsPageContent = dynamic(() =>
  import("@/components/entities/OrganizationsPageContent").then((mod) => mod.OrganizationsPageContent),
)

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
    return <CharactersPageContent initialScope="players" showHeader={false} loadRelatedData={false} />
  }

  if (activeSection === "edificios") {
    return <BuildingsPageContent showHeader={false} loadRelatedData={false} />
  }
  
  if (activeSection === "organizaciones") {
    return <OrganizationsPageContent showHeader={false} loadRelatedData={false} />
  }
  
  if (activeSection === "landmarks") {
    return <LandmarksPageContent showHeader={false} loadRelatedData={false} />
  }
  
  if (activeSection === "estados") {
    return <EstadosPageContent showHeader={false} />
  }

  return <CharactersPageContent initialScope="npcs" showHeader={false} loadRelatedData={false} />
}

export default function EntidadesPage() {
  return (
    <Suspense fallback={null}>
      <EntidadesPageContent />
    </Suspense>
  )
}
