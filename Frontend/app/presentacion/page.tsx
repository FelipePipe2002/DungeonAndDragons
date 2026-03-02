"use client"

import { useEffect, useState } from "react"

import { BATTLE_SCREEN_STORAGE_KEY, readBattleScreenState } from "@/lib/battle/sync"
import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import type { BattleState } from "@/lib/types"
import { fetchCurrentBattleState } from "@/lib/services/battle-api.service"
import { LandmarkMapOnlyClient } from "./LandmarkMapOnlyClient"
import {
  PRESENTATION_SCREEN_STORAGE_KEY,
  readPresentationScreenTarget,
} from "@/lib/presentation/screen"

export default function PresentationPage() {
  const [fallbackLandmarkSlug, setFallbackLandmarkSlug] = useState<string | null>(null)
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [showPresentationLabel, setShowPresentationLabel] = useState(true)
  const [isBlackout, setIsBlackout] = useState(false)

  useEffect(() => {
    const syncTarget = () => {
      setFallbackLandmarkSlug(readPresentationScreenTarget())
    }

    syncTarget()

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PRESENTATION_SCREEN_STORAGE_KEY) return
      syncTarget()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", syncTarget)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", syncTarget)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const syncFromLocalStorage = () => {
      const nextBattleState = readBattleScreenState()
      if (!isActive || !nextBattleState) return
      setBattleState(nextBattleState)
    }

    syncFromLocalStorage()

    void fetchCurrentBattleState()
      .then((nextBattleState) => {
        if (!isActive) return
        if (!readBattleScreenState()) {
          setBattleState(nextBattleState)
        }
      })
      .catch(() => {
        if (!isActive) return
        if (!readBattleScreenState()) {
          setBattleState(null)
        }
      })

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BATTLE_SCREEN_STORAGE_KEY) return
      syncFromLocalStorage()
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", syncFromLocalStorage)

    return () => {
      isActive = false
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", syncFromLocalStorage)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === "Escape") {
        setIsBlackout((current) => !current)
        return
      }

      if (event.key.toLowerCase() === "h") {
        setShowPresentationLabel((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const landmarkSlug = battleState?.landmarkSlug ?? fallbackLandmarkSlug

  if (!landmarkSlug || isBlackout) {
    return <main aria-label="Presentacion de mapa" className="h-dvh min-h-screen bg-black" />
  }

  return (
    <LandmarkMapOnlyClient
      nombreLandmark={landmarkSlug}
      showControls={false}
      showPresentationLabel={showPresentationLabel}
      overlay={<BattleTokenOverlay tokens={battleState?.tokens ?? []} obstacles={battleState?.obstacles ?? []} />}
    />
  )
}
