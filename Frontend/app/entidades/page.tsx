"use client"

import { Suspense, type ComponentType, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"

import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/main-nav"

const CharactersPageContent = dynamic(() =>
  import("@/components/entities/CharactersPageContent").then((mod) => mod.CharactersPageContent),
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

const ENTITY_SECTION_COMPONENTS: Record<EntitySection, ComponentType> = {
  personajes: () => <CharactersPageContent initialScope="npcs" showHeader={false} loadRelatedData={false} />,
  jugadores: () => <CharactersPageContent initialScope="players" showHeader={false} loadRelatedData={false} />,
  estados: () => <EstadosPageContent showHeader={false} />,
  edificios: () => <BuildingsPageContent showHeader={false} loadRelatedData={false} />,
  organizaciones: () => <OrganizationsPageContent showHeader={false} loadRelatedData={false} />,
  landmarks: () => <LandmarksPageContent showHeader={false} loadRelatedData={false} />,
}

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

  const ActiveSectionComponent = ENTITY_SECTION_COMPONENTS[activeSection]

  return <ActiveSectionComponent />
}

export default function EntidadesPage() {
  return (
    <Suspense fallback={null}>
      <EntidadesPageContent />
    </Suspense>
  )
}
