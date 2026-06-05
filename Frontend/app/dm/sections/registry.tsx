import type { ReactNode } from "react"
import dynamic from "next/dynamic"

import type { MentionRef } from "@/components/mentionField/MentionField"

export type DmSection = "dm-notes" | "open-loops" | "dm-events" | "dm-relationships" | "party-inventory"

const DmNotesSection = dynamic(() => import("@/app/dm/sections/DmNotesSection"))
const OpenLoopsSection = dynamic(() => import("@/app/dm/sections/OpenLoopsSection").then((mod) => mod.OpenLoopsSection))
const DmEventsSection = dynamic(() => import("@/app/dm/sections/DmEventsSection"))
const DmRelationshipsSection = dynamic(() => import("@/app/dm/sections/DmRelationshipsSection").then((mod) => mod.DmRelationshipsSection))
const PartyInventorySection = dynamic(() => import("@/app/dm/sections/PartyInventorySection").then((mod) => mod.PartyInventorySection))

type SectionRendererProps = {
  onOpenMention: (mention: MentionRef) => void | Promise<void>
}

type DmSectionConfig = {
  pageTitle: string | null
  render: (props: SectionRendererProps) => ReactNode
}

export const DM_SECTION_CONFIG: Record<DmSection, DmSectionConfig> = {
  "dm-events": {
    pageTitle: null,
    render: ({ onOpenMention }) => <DmEventsSection onOpenMention={onOpenMention} />,
  },
  "dm-notes": {
    pageTitle: null,
    render: ({ onOpenMention }) => <DmNotesSection onOpenMention={onOpenMention} />,
  },
  "dm-relationships": {
    pageTitle: "Relaciones",
    render: () => <DmRelationshipsSection />,
  },
  "open-loops": {
    pageTitle: "Open Loops",
    render: () => <OpenLoopsSection />,
  },
  "party-inventory": {
    pageTitle: "Party Inventory",
    render: () => <PartyInventorySection />,
  },
}
