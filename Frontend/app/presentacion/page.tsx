"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { BattleInitiativeStrip } from "@/components/battle/BattleInitiativeStrip"
import { BattleFogOverlay } from "@/components/battle/BattleFogOverlay"
import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import { BATTLE_CONDITIONS } from "@/lib/battle/conditions"
import {
  getBattleTokenFogVisibility,
  type BattleTokenFogVisibility,
} from "@/lib/battle/fog"
import {
  BATTLE_SCREEN_PRESENTATION_MIRROR_STORAGE_KEY,
  BATTLE_SCREEN_STORAGE_KEY,
  readBattleScreenPresentationVerticalMirror,
  readBattleScreenPayload,
  subscribeToBattleScreenEvents,
} from "@/lib/battle/sync"
import type { BattleState, Character } from "@/lib/types"
import type { NormalizedDungeonMap } from "@/lib/dungeons/types"
import { fetchActiveBattle, sanitizeBattleState } from "@/lib/services/battle-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { LandmarkMapOnlyClient } from "./LandmarkMapOnlyClient"
import {
  PRESENTATION_SCREEN_STORAGE_KEY,
  type PresentationScreenPayload,
  type PresentationScreenTarget,
  publishPresentationSceneStatus,
  readPresentationScreenTarget,
  setPresentationScreenTarget,
} from "@/lib/presentation/screen"
import { PresentationCover } from "./PresentationCover"

function matchesPresentationTarget(battle: BattleState | null, target: PresentationScreenTarget | null) {
  return Boolean(
    battle &&
      target &&
      battle.status === "active" &&
      battle.sceneType === target.sceneType &&
      battle.sceneSlug === target.sceneSlug,
  )
}

function isSamePreviewPosition(
  current: { x: number; y: number } | undefined,
  next: { x: number; y: number } | undefined,
) {
  return current?.x === next?.x && current?.y === next?.y
}

function matchesPresentationTargetIdentity(
  target: PresentationScreenTarget | null,
  payload: PresentationScreenPayload | null,
) {
  return Boolean(
    target &&
      payload &&
      target.sceneType === payload.sceneType &&
      target.sceneSlug === payload.sceneSlug,
  )
}

function resolvePresentationTarget(requestedTarget: PresentationScreenTarget | null, persist = true) {
  const storedTarget = readPresentationScreenTarget()
  if (!requestedTarget) {
    return storedTarget
  }

  if (matchesPresentationTargetIdentity(requestedTarget, storedTarget)) {
    return storedTarget
  }

  if (!persist) {
    return {
      ...requestedTarget,
      revision: storedTarget?.revision ?? Date.now(),
    }
  }

  return setPresentationScreenTarget(requestedTarget) ?? {
    ...requestedTarget,
    revision: Date.now(),
  }
}

function PresentationFallbackImage() {
  return <PresentationCover className="absolute inset-0" />
}

function PresentationPageContent() {
  const searchParams = useSearchParams()
  const requestedPresentationTarget = useMemo<PresentationScreenTarget | null>(() => {
    const rawScene = searchParams.get("scene")
    const rawSceneType = searchParams.get("sceneType")
    if (rawScene?.trim()) {
      return {
        sceneType: rawSceneType === "building" ? "building" : "landmark",
        sceneSlug: rawScene.trim(),
      }
    }

    const rawLandmark = searchParams.get("landmark")
    if (!rawLandmark?.trim()) {
      return null
    }

    return {
      sceneType: "landmark",
      sceneSlug: rawLandmark.trim(),
    }
  }, [searchParams])
  const [presentationTarget, setPresentationTarget] = useState<PresentationScreenPayload | null>(() =>
    resolvePresentationTarget(requestedPresentationTarget, false),
  )
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [tokenPreviews, setTokenPreviews] = useState<Record<number, { x: number; y: number }>>({})
  const [obstaclePreviews, setObstaclePreviews] = useState<Record<number, { x: number; y: number }>>({})
  const [showPresentationLabel, setShowPresentationLabel] = useState(true)
  const [isBlackout, setIsBlackout] = useState(false)
  const [isBlackoutImageVerticallyFlipped, setIsBlackoutImageVerticallyFlipped] = useState(false)
  const [presentationDungeon, setPresentationDungeon] = useState<NormalizedDungeonMap | null>(null)
  const [isVerticallyMirrored, setIsVerticallyMirrored] = useState(() => readBattleScreenPresentationVerticalMirror())
  const [isFriendlyPresentationMode, setIsFriendlyPresentationMode] = useState(() => {
    return readBattleScreenPayload()?.presentationFriendlyMode === true
  })
  const lastPresentedSceneKeyRef = useRef<string | null>(null)

  const syncTarget = useCallback(() => {
    setPresentationTarget(resolvePresentationTarget(requestedPresentationTarget))
  }, [requestedPresentationTarget])

  const loadActiveBattleForTarget = useCallback((target: PresentationScreenTarget) => {
    return fetchActiveBattle(target.sceneType, target.sceneSlug)
  }, [])

  const handleSceneReady = useCallback(
    (payload: { sceneType: PresentationScreenTarget["sceneType"]; sceneSlug: string; sceneLabel: string }) => {
      if (
        !presentationTarget ||
        payload.sceneType !== presentationTarget.sceneType ||
        payload.sceneSlug !== presentationTarget.sceneSlug
      ) {
        return
      }

      publishPresentationSceneStatus({
        sceneType: payload.sceneType,
        sceneSlug: payload.sceneSlug,
        sceneLabel: payload.sceneLabel,
        revision: presentationTarget.revision,
        status: "loaded",
      })
    },
    [presentationTarget],
  )

  const handleSceneLoadError = useCallback(
    (payload: { sceneType: PresentationScreenTarget["sceneType"]; sceneSlug: string; sceneLabel: string; message?: string }) => {
      if (
        !presentationTarget ||
        payload.sceneType !== presentationTarget.sceneType ||
        payload.sceneSlug !== presentationTarget.sceneSlug
      ) {
        return
      }

      publishPresentationSceneStatus({
        sceneType: payload.sceneType,
        sceneSlug: payload.sceneSlug,
        sceneLabel: payload.sceneLabel,
        revision: presentationTarget.revision,
        status: "error",
        message: payload.message,
      })
    },
    [presentationTarget],
  )

  const syncBattleFromStorage = useCallback(
    (currentTarget: PresentationScreenTarget | null) => {
      const payload = readBattleScreenPayload()
      const nextBattle = sanitizeBattleState(payload?.battle)
      setIsFriendlyPresentationMode(payload?.presentationFriendlyMode === true)

      if (!currentTarget) {
        return false
      }

      if (matchesPresentationTarget(nextBattle, currentTarget)) {
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
    const currentSceneKey = presentationTarget
      ? `${presentationTarget.sceneType}:${presentationTarget.sceneSlug}`
      : null

    setPresentationDungeon(null)

    if (currentSceneKey && currentSceneKey !== lastPresentedSceneKeyRef.current) {
      setIsBlackout(true)
    }

    lastPresentedSceneKeyRef.current = currentSceneKey
  }, [presentationTarget])

  useEffect(() => {
    let isActive = true

    if (!presentationTarget) {
      setBattleState(null)
      setTokenPreviews({})
      setObstaclePreviews({})
      return () => {
        isActive = false
      }
    }

    syncBattleFromStorage(presentationTarget)

    void loadActiveBattleForTarget(presentationTarget)
      .then((nextBattleState) => {
        if (!isActive) {
          return
        }

        if (!syncBattleFromStorage(presentationTarget)) {
          setBattleState(matchesPresentationTarget(nextBattleState, presentationTarget) ? nextBattleState : null)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
      })
      .catch(() => {
        if (!isActive) {
          return
        }

        if (!syncBattleFromStorage(presentationTarget)) {
          setBattleState(null)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
      })

    return () => {
      isActive = false
    }
  }, [loadActiveBattleForTarget, presentationTarget, syncBattleFromStorage])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BATTLE_SCREEN_STORAGE_KEY) return

      const currentTarget = requestedPresentationTarget ?? readPresentationScreenTarget()
      if (!currentTarget) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      const payload = readBattleScreenPayload()
      const nextBattle = sanitizeBattleState(payload?.battle)
      if (nextBattle) {
        if (matchesPresentationTarget(nextBattle, currentTarget)) {
          setBattleState(nextBattle)
          setTokenPreviews({})
          setObstaclePreviews({})
        }
        return
      }

      void loadActiveBattleForTarget(currentTarget)
      .then((nextBattleState) => {
        setBattleState(matchesPresentationTarget(nextBattleState, currentTarget) ? nextBattleState : null)
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
      const currentTarget = requestedPresentationTarget ?? readPresentationScreenTarget()
      setPresentationTarget(resolvePresentationTarget(requestedPresentationTarget))

      if (!currentTarget) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      if (syncBattleFromStorage(currentTarget)) {
        return
      }

      void loadActiveBattleForTarget(currentTarget)
        .then((nextBattleState) => {
          setBattleState(matchesPresentationTarget(nextBattleState, currentTarget) ? nextBattleState : null)
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
  }, [loadActiveBattleForTarget, requestedPresentationTarget, syncBattleFromStorage])

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
      const currentTarget = requestedPresentationTarget ?? readPresentationScreenTarget()

      if (!currentTarget) {
        setBattleState(null)
        setTokenPreviews({})
        setObstaclePreviews({})
        return
      }

      if (event.type === "battle-state") {
        const nextBattle = sanitizeBattleState(event.payload.battle)
        setIsFriendlyPresentationMode(event.payload.presentationFriendlyMode)
        if (matchesPresentationTarget(nextBattle, currentTarget)) {
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
        if (event.update.sceneSlug !== currentTarget.sceneSlug) {
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

      if (event.preview.sceneSlug !== currentTarget.sceneSlug) {
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

          if (isSamePreviewPosition(current[event.preview.obstacleId], event.preview.position)) {
            return current
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

          if (isSamePreviewPosition(current[event.preview.tokenNumber], event.preview.position)) {
            return current
          }

          return {
            ...current,
            [event.preview.tokenNumber]: event.preview.position,
        }
      })
    })
  }, [requestedPresentationTarget])

  useEffect(() => {
    if (!presentationTarget) {
      return
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const refreshBattleState = () => {
      if (document.visibilityState !== "visible") {
        return
      }

      if (syncBattleFromStorage(presentationTarget)) {
        return
      }

      void loadActiveBattleForTarget(presentationTarget)
        .then((nextBattleState) => {
          if (cancelled || syncBattleFromStorage(presentationTarget)) {
            return
          }

          setBattleState(matchesPresentationTarget(nextBattleState, presentationTarget) ? nextBattleState : null)
          setTokenPreviews({})
          setObstaclePreviews({})
        })
        .catch(() => {
          if (cancelled || syncBattleFromStorage(presentationTarget)) {
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
  }, [loadActiveBattleForTarget, presentationTarget, syncBattleFromStorage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === "Escape") {
        setIsBlackout((current) => !current)
        return
      }

      if (event.key.toLowerCase() === "h") {
        setShowPresentationLabel((current) => !current)
        return
      }

      if (event.key.toLowerCase() === "f") {
        setIsBlackoutImageVerticallyFlipped((current) => !current)
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
    battleState &&
    battleState.status === "active" &&
    presentationTarget &&
    battleState.sceneType === presentationTarget.sceneType &&
    battleState.sceneSlug === presentationTarget.sceneSlug
      ? battleState
      : null

  const renderedVisibleBattle =
    renderedBattleState &&
    renderedBattleState.status === "active" &&
    presentationTarget &&
    renderedBattleState.sceneType === presentationTarget.sceneType &&
    renderedBattleState.sceneSlug === presentationTarget.sceneSlug
      ? renderedBattleState
      : null

  const presentationDungeonOpenDoorIds = useMemo(() => {
    return new Set(visibleBattle?.dungeonFog.openDoorIds ?? [])
  }, [visibleBattle?.dungeonFog.openDoorIds])

  const tokenFogVisibilityByNumber = useMemo(() => {
    const visibilityByNumber = new Map<number, BattleTokenFogVisibility>()
    if (!visibleBattle) {
      return visibilityByNumber
    }

    for (const token of visibleBattle.tokens) {
      visibilityByNumber.set(
        token.number,
        getBattleTokenFogVisibility({
          battle: visibleBattle,
          token,
        }),
      )
    }

    return visibilityByNumber
  }, [visibleBattle])

  const visiblePresentationTokens = useMemo(() => {
    if (!visibleBattle || !renderedVisibleBattle) {
      return []
    }

    return renderedVisibleBattle.tokens.filter((token) => tokenFogVisibilityByNumber.get(token.number) !== "hidden")
  }, [renderedVisibleBattle, tokenFogVisibilityByNumber, visibleBattle])
  const visibleInitiativeCurrentTurnTokenNumber = useMemo(() => {
    if (!visibleBattle || typeof visibleBattle.currentTurnTokenNumber !== "number") {
      return null
    }

    return tokenFogVisibilityByNumber.get(visibleBattle.currentTurnTokenNumber) !== "hidden"
      ? visibleBattle.currentTurnTokenNumber
      : null
  }, [tokenFogVisibilityByNumber, visibleBattle])
  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  return (
    <main aria-label="Presentacion de mapa" className="relative h-dvh min-h-screen overflow-hidden bg-black">
      {presentationTarget ? (
        <LandmarkMapOnlyClient
          sceneType={presentationTarget.sceneType}
          sceneSlug={presentationTarget.sceneSlug}
          showControls={false}
          showPresentationLabel={showPresentationLabel}
          emptyFallbackImageSrc="/presentacion.png"
          onSceneReady={handleSceneReady}
          onSceneLoadError={handleSceneLoadError}
          onDungeonMapLoad={setPresentationDungeon}
          dungeonOpenDoorIds={presentationDungeonOpenDoorIds}
          dungeonDoorToggleEnabled={false}
          showDungeonLighting
          flipVertical={isVerticallyMirrored}
          showBattleGrid={!isFriendlyPresentationMode}
          topOverlay={
            visibleBattle && !isFriendlyPresentationMode ? (
              <BattleInitiativeStrip
                tokens={visiblePresentationTokens}
                characterById={charactersById}
                currentTurnTokenNumber={visibleInitiativeCurrentTurnTokenNumber}
                verticalMirror={isVerticallyMirrored}
              />
            ) : null
          }
          overlay={
            visibleBattle && renderedVisibleBattle ? (
              <div className="relative size-full">
                <BattleTokenOverlay
                  tokens={visiblePresentationTokens}
                  tokenFogVisibilityByNumber={tokenFogVisibilityByNumber}
                  statusDefinitions={BATTLE_CONDITIONS}
                  obstacles={renderedVisibleBattle.obstacles}
                  characterById={charactersById}
                  currentTurnTokenNumber={isFriendlyPresentationMode ? null : visibleInitiativeCurrentTurnTokenNumber}
                  verticalMirror={isVerticallyMirrored}
                  hideHiddenTokens
                  hideHiddenObstacles
                  neutralPalette={isFriendlyPresentationMode}
                />
                <BattleFogOverlay
                  fogEnabled={visibleBattle.fogEnabled}
                  fogReveals={visibleBattle.fogReveals}
                  verticalMirror={isVerticallyMirrored}
                />
              </div>
            ) : null
          }
        />
      ) : (
        <PresentationFallbackImage />
      )}
      {isBlackout ? (
        <PresentationCover
          alt="Presentacion oculta"
          className="absolute inset-0 z-[100]"
          flipVertical={isBlackoutImageVerticallyFlipped}
        />
      ) : null}
    </main>
  )
}

export default function PresentationPage() {
  return (
    <Suspense
      fallback={
        <main aria-label="Presentacion de mapa" className="relative h-dvh min-h-screen overflow-hidden bg-black">
          <PresentationFallbackImage />
        </main>
      }
    >
      <PresentationPageContent />
    </Suspense>
  )
}
