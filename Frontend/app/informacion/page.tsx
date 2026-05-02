"use client"

import dynamic from "next/dynamic"
import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import type { InformationSection } from "@/lib/informacion/types"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"

const MonstersSection = dynamic(() => import("@/app/informacion/sections/MonstersSection"))
const ConditionsSection = dynamic(() => import("@/app/informacion/sections/ConditionsSection"))
const SpellsSection = dynamic(() => import("@/app/informacion/sections/SpellsSection"))
const ItemsSection = dynamic(() => import("@/app/informacion/sections/ItemsSection"))
const FeatsSection = dynamic(() => import("@/app/informacion/sections/FeatsSection"))
const RulesSection = dynamic(() => import("@/app/informacion/sections/RulesSection"))
const BooksSection = dynamic(() => import("@/app/informacion/sections/BooksSection"))
const PagesSection = dynamic(() => import("@/app/informacion/sections/PagesSection"))

function InformacionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const infoSubnavConfig = getSubnavConfig("/informacion")
  const activeSection = (infoSubnavConfig
    ? getSubnavActiveValue(infoSubnavConfig, searchParams.get("section"))
    : "monsters") as InformationSection

  useEffect(() => {
    if (!infoSubnavConfig) {
      return
    }

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(infoSubnavConfig, currentSection)
    if (currentSection === normalizedSection) {
      return
    }

    router.replace(`/informacion?section=${encodeURIComponent(normalizedSection)}`)
  }, [infoSubnavConfig, router, searchParams])

  if (activeSection === "conditions") {
    return <ConditionsSection />
  }

  if (activeSection === "spells") {
    return <SpellsSection />
  }

  if (activeSection === "items") {
    return <ItemsSection />
  }

  if (activeSection === "feats") {
    return <FeatsSection />
  }

  if (activeSection === "rules") {
    return <RulesSection />
  }

  if (activeSection === "books") {
    return <BooksSection />
  }

  if (activeSection === "pages") {
    return <PagesSection />
  }

  return <MonstersSection />
}

export default function InformacionPage() {
  return (
    <Suspense fallback={null}>
      <InformacionPageContent />
    </Suspense>
  )
}
