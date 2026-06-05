"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { DmMentionDetailDialogs } from "@/components/dm/DmMentionDetailDialogs"
import { useDmMentionDetails } from "@/hooks/useDmMentionDetails"
import { DM_SECTION_CONFIG, type DmSection } from "@/app/dm/sections/registry"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/main-nav"

function DmPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dmSubnavConfig = getSubnavConfig("/dm")
  const activeSection = (dmSubnavConfig
    ? getSubnavActiveValue(dmSubnavConfig, searchParams.get("section"))
    : "dm-notes") as DmSection
  const mentionDetails = useDmMentionDetails()

  useEffect(() => {
    if (!dmSubnavConfig) return

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(dmSubnavConfig, currentSection)
    if (currentSection === normalizedSection) return

    router.replace(`/dm?section=${encodeURIComponent(normalizedSection)}`)
  }, [dmSubnavConfig, router, searchParams])

  const activeSectionConfig = DM_SECTION_CONFIG[activeSection]
  const pageTitle = activeSectionConfig.pageTitle

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      {pageTitle ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif text-primary">DM</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pageTitle}</p>
          </div>
        </div>
      ) : null}

      {activeSectionConfig.render({ onOpenMention: mentionDetails.handleOpenMention })}

      <DmMentionDetailDialogs mentionDetails={mentionDetails} />
    </div>
  )
}

export default function DmPage() {
  return (
    <Suspense fallback={null}>
      <DmPageContent />
    </Suspense>
  )
}
