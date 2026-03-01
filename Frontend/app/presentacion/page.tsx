"use client"

import { useEffect, useState } from "react"

import { LandmarkMapOnlyClient } from "./LandmarkMapOnlyClient"
import {
  PRESENTATION_SCREEN_STORAGE_KEY,
  readPresentationScreenTarget,
} from "@/lib/presentation/screen"

export default function PresentationPage() {
  const [landmarkSlug, setLandmarkSlug] = useState<string | null>(null)
  const [showPresentationLabel, setShowPresentationLabel] = useState(true)
  const [isBlackout, setIsBlackout] = useState(false)

  useEffect(() => {
    const syncTarget = () => {
      setLandmarkSlug(readPresentationScreenTarget())
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

  if (!landmarkSlug || isBlackout) {
    return <main aria-label="Presentacion de mapa" className="h-dvh min-h-screen bg-black" />
  }

  return (
    <LandmarkMapOnlyClient
      nombreLandmark={landmarkSlug}
      showControls={false}
      showPresentationLabel={showPresentationLabel}
    />
  )
}
