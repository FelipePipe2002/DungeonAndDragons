import { Suspense } from "react"

import { BattlePageClient } from "./BattlePageClient"

export default function BatallaPage() {
  return (
    <Suspense fallback={null}>
      <BattlePageClient />
    </Suspense>
  )
}
