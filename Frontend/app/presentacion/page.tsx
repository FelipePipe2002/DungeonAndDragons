"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import { BattleInitiativeStrip } from "@/components/battle/BattleInitiativeStrip"
import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import { BATTLE_CONDITIONS } from "@/lib/battle/conditions"
import {
  BATTLE_SCREEN_PRESENTATION_MIRROR_STORAGE_KEY,
  BATTLE_SCREEN_STORAGE_KEY,
  readBattleScreenPresentationVerticalMirror,
  readBattleScreenPayload,
  subscribeToBattleScreenEvents,
} from "@/lib/battle/sync"
import type { BattleState, Character } from "@/lib/types"
import { fetchActiveBattleForLandmark, sanitizeBattleState } from "@/lib/services/battle-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { LandmarkMapOnlyClient } from "./LandmarkMapOnlyClient"
import {
  PRESENTATION_SCREEN_STORAGE_KEY,
  readPresentationScreenTarget,
} from "@/lib/presentation/screen"

function PresentationPageContent() {
  const searchParams = useSearchParams()
  const requestedLandmarkSlug = useMemo(() => {
    const rawValue = searchParams.get("landmark")
    if (!rawValue) {
      return null
    }

    const normalizedValue = rawValue.trim()
    return normalizedValue.length > 0 ? normalizedValue : null
  }, [searchParams])
  const [landmarkSlug, setLandmarkSlug] = useState<string | null>(requestedLandmarkSlug ?? readPresentationScreenTarget())
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [tokenPreviews, setTokenPreviews] = useState<Record<number, { x: number; y: number }>>({})
  const [obstaclePreviews, setObstaclePreviews] = useState<Record<number, { x: number; y: number }>>({})
  const [showPresentationLabel, setShowPresentationLabel] = useState(true)
  const [isBlackout, setIsBlackout] = useState(false)
  const [isVerticallyMirrored, setIsVerticallyMirrored] = useState(() => readBattleScreenPresentationVerticalMirror())

  const syncTarget = useCallback(() => {
    setLandmarkSlug(requestedLandmarkSlug ?? readPresentationScreenTarget())
  }, [requestedLandmarkSlug])

  const syncBattleFromStorage = useCallback(
    (currentLandmarkSlug: string | null) => {
      const payload = readBattleScreenPayload()
      const nextBattle = sanitizeBattleState(payload?.battle)

      if (!currentLandmarkSlug) {
        return false
      }

      if (nextBattle && nextBattle.status === "active" && nextBattle.landmarkSlug === currentLandmarkSlug) {
        setBattleState(nextBattle)
        setTokenPreviews({})
        setObstaclePreviews({})
        return true
      }

      return false
    },
    [],
  )

  useEffect(() => {
    let isActive = true

    void fetchCharacters()
      .then((fetchedCharacters) => {
        if (!isActive) {
          return
        }

        setCharacters(fetchedCharacters)
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        setCharacters([])
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    syncTarget()

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PRESENTATION_SCREEN_STORAGE_KEY) return
      syncTarget()
    }

    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [syncTarget])

  useEffect(() => {
    let isActive = true

    if (!landmarkSlug) {
      setBattleState(null)
      setTokenPreviews({})
      setObstaclePreviews({})
      return () => {
        isActive = false
      }
    }

    syncBattleFromStorage(landmarkSlug)

    void fetchActiveBattleForLandmark(landmarkSlug)
      .then((nextBattleState) => {
        if (!isActive) {
          return
        }

        if (!syncBattleFromStorage(landmarkSlug)) {
          setBattleState(nextBattleState)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        if (!syncBattleFromStorage(landmarkSlug)) {
          setBattleState(null)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
      })

    return () => {
      isActive = false
    }
  }, [landmarkSlug, syncBattleFromStorage])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BATTLE_SCREEN_STORAGE_KEY) return

      const currentLandmarkSlug = requestedLandmarkSlug ?? readPresentationScreenTarget()
      if (!currentLandmarkSlug) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      const payload = readBattleScreenPayload()
      const nextBattle = sanitizeBattleState(payload?.battle)
      if (nextBattle) {
        if (nextBattle.status === "active" && nextBattle.landmarkSlug === currentLandmarkSlug) {
          setBattleState(nextBattle)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
        return
      }

      void fetchActiveBattleForLandmark(currentLandmarkSlug)
      .then((nextBattleState) => {
        setBattleState(nextBattleState)
        setTokenPreviews({})
        setObstaclePreviews({})
      })
      .catch(() => {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
      })
    }

    const handleFocus = () => {
      const currentLandmarkSlug = requestedLandmarkSlug ?? readPresentationScreenTarget()
      setLandmarkSlug(currentLandmarkSlug)

      if (!currentLandmarkSlug) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      if (syncBattleFromStorage(currentLandmarkSlug)) {
        return
      }

      void fetchActiveBattleForLandmark(currentLandmarkSlug)
        .then((nextBattleState) => {
          setBattleState(nextBattleState)
          setTokenPreviews({})
          setObstaclePreviews({})
        })
        .catch(() => {
          setBattleState(null)
          setTokenPreviews({})
          setObstaclePreviews({})
        })
    }

    window.addEventListener("storage", handleStorage)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("focus", handleFocus)
    }
  }, [requestedLandmarkSlug, syncBattleFromStorage])

  useEffect(() => {
    const syncMirrorFromStorage = () => {
      setIsVerticallyMirrored(readBattleScreenPresentationVerticalMirror())
    }

    syncMirrorFromStorage()

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BATTLE_SCREEN_PRESENTATION_MIRROR_STORAGE_KEY) {
        return
      }

      syncMirrorFromStorage()
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  useEffect(() => {
    return subscribeToBattleScreenEvents((event) => {
      const currentLandmarkSlug = requestedLandmarkSlug ?? readPresentationScreenTarget()

      if (!currentLandmarkSlug) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      if (event.type === "battle-state") {
        const nextBattle = sanitizeBattleState(event.payload.battle)
        if (nextBattle && nextBattle.status === "active" && nextBattle.landmarkSlug === currentLandmarkSlug) {
          setBattleState(nextBattle)
          setTokenPreviews({})
          setObstaclePreviews({})
          return
        }

        if (!nextBattle) {
          setBattleState(null)
          setTokenPreviews({})
          setObstaclePreviews({})
        }

        return
      }

      if (event.type === "presentation-vertical-mirror") {
        setIsVerticallyMirrored(event.payload.verticalMirror)
        return
      }

      if (event.type === "battle-turn") {
        if (event.update.landmarkSlug !== currentLandmarkSlug) {
          return
        }

        setBattleState((current) => {
          if (!current || current.id !== event.update.battleId) {
            return current
          }

          if ((current.currentTurnTokenNumber ?? null) === event.update.currentTurnTokenNumber) {
            return current
          }

          return {
            ...current,
            currentTurnTokenNumber: event.update.currentTurnTokenNumber,
            roundNumber: event.update.roundNumber,
          }
        })
        return
      }

      if (event.preview.landmarkSlug !== currentLandmarkSlug) {
        return
      }

      if (event.type === "obstacle-preview") {
        setObstaclePreviews((current) => {
          if (!event.preview.position) {
            if (!(event.preview.obstacleId in current)) {
              return current
            }

            const next = { ...current }
            delete next[event.preview.obstacleId]
            return next
          }

          return {
            ...current,
            [event.preview.obstacleId]: event.preview.position,
          }
        })
        return
      }

      setTokenPreviews((current) => {
        if (!event.preview.position) {
          if (!(event.preview.tokenNumber in current)) {
            return current
          }

          const next = { ...current }
          delete next[event.preview.tokenNumber]
          return next
        }

        return {
          ...current,
          [event.preview.tokenNumber]: event.preview.position,
        }
      })
    })
  }, [requestedLandmarkSlug])

  useEffect(() => {
    if (!landmarkSlug) {
      return
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const refreshBattleState = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      if (syncBattleFromStorage(landmarkSlug)) {
        return
      }

      void fetchActiveBattleForLandmark(landmarkSlug)
        .then((nextBattleState) => {
          if (cancelled || syncBattleFromStorage(landmarkSlug)) {
            return
          }

          setBattleState(nextBattleState)
          setTokenPreviews({})
          setObstaclePreviews({})
        })
        .catch(() => {
          if (cancelled || syncBattleFromStorage(landmarkSlug)) {
            return
          }

          setBattleState(null)
          setTokenPreviews({})
          setObstaclePreviews({})
        })
    }

    intervalId = setInterval(refreshBattleState, 2000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshBattleState()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [landmarkSlug, syncBattleFromStorage])

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

  const renderedBattleState = useMemo(() => {
    if (!battleState || (Object.keys(tokenPreviews).length === 0 && Object.keys(obstaclePreviews).length === 0)) {
      return battleState
    }

    return {
      ...battleState,
      tokens: battleState.tokens.map((token) => {
        const preview = tokenPreviews[token.number]
        if (!preview) {
          return token
        }

        return {
          ...token,
          x: preview.x,
          y: preview.y,
        }
      }),
      obstacles: battleState.obstacles.map((obstacle) => {
        const preview = obstaclePreviews[obstacle.id]
        if (!preview) {
          return obstacle
        }

        return {
          ...obstacle,
          x: preview.x,
          y: preview.y,
        }
      }),
    }
  }, [battleState, obstaclePreviews, tokenPreviews])

  const visibleBattle =
    renderedBattleState &&
    renderedBattleState.status === "active" &&
    renderedBattleState.landmarkSlug === landmarkSlug
      ? renderedBattleState
      : null
  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  if (!landmarkSlug || isBlackout) {
    return <main aria-label="Presentacion de mapa" className="h-dvh min-h-screen bg-black" />
  }

  return (
    <LandmarkMapOnlyClient
        nombreLandmark={landmarkSlug}
        showControls={false}
        showPresentationLabel={showPresentationLabel}
        flipVertical={isVerticallyMirrored}
        topOverlay={
          visibleBattle ? (
            <BattleInitiativeStrip
              tokens={visibleBattle.tokens}
              characterById={charactersById}
              currentTurnTokenNumber={visibleBattle.currentTurnTokenNumber ?? null}
              verticalMirror={isVerticallyMirrored}
            />
          ) : null
        }
        overlay={
        visibleBattle ? (
          <BattleTokenOverlay
            tokens={visibleBattle.tokens}
            statusDefinitions={BATTLE_CONDITIONS}
            obstacles={visibleBattle.obstacles}
            characterById={charactersById}
            currentTurnTokenNumber={visibleBattle.currentTurnTokenNumber ?? null}
            verticalMirror={isVerticallyMirrored}
            hideHiddenTokens
          />
        ) : null
      }
    />
  )
}

export default function PresentationPage() {
  return (
    <Suspense fallback={<main aria-label="Presentacion de mapa" className="h-dvh min-h-screen bg-black" />}>
      <PresentationPageContent />
    </Suspense>
  )
}
