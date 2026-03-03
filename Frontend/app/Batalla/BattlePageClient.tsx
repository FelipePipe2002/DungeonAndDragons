"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Circle, Monitor, Square, Swords, UserRound } from "lucide-react"

import { LandmarkMapOnlyClient } from "@/app/presentacion/LandmarkMapOnlyClient"
import { BattleInitiativeStrip } from "@/components/battle/BattleInitiativeStrip"
import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { getNextTurnTokenNumber, normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import {
  broadcastBattleTurn,
  broadcastBattleObstaclePreview,
  broadcastBattleTokenPreview,
  readBattleScreenState,
  setBattleScreenState,
} from "@/lib/battle/sync"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { openPresentationScreen, readPresentationScreenTarget } from "@/lib/presentation/screen"
import {
  createBattle,
  fetchActiveBattleForLandmark,
  fetchBattleById,
  fetchBattleHistory,
  finishBattle,
  reopenBattle,
  updateBattle,
} from "@/lib/services/battle-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import type { BattleObstacle, BattleObstacleShape, BattleState, BattleSummary, BattleToken, Character, Landmark } from "@/lib/types"

function supportsBattleMap(landmark: Landmark) {
  if (landmark.mapAssetId && landmark.mapAssetKind !== "json") {
    return true
  }

  if (!landmark.mapa) {
    return false
  }

  return landmark.mapa.kind !== "buildings"
}

function parseNumberInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDecimalInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed.replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined
}

function sortBattleState(battle: BattleState): BattleState {
  const tokens = [...battle.tokens].sort((left, right) => left.number - right.number)

  return {
    ...battle,
    currentTurnTokenNumber: normalizeCurrentTurnTokenNumber(tokens, battle.currentTurnTokenNumber ?? null),
    tokens,
    obstacles: [...battle.obstacles].sort((left, right) => left.id - right.id),
  }
}

function isTurnOnlyBattleChange(previous: BattleState | null, next: BattleState | null) {
  if (!previous || !next) {
    return false
  }

  return (
    previous !== next &&
    previous.id === next.id &&
    previous.slug === next.slug &&
    previous.landmarkSlug === next.landmarkSlug &&
    previous.status === next.status &&
    previous.nextTokenNumber === next.nextTokenNumber &&
    previous.nextObstacleId === next.nextObstacleId &&
    previous.tokens === next.tokens &&
    previous.obstacles === next.obstacles &&
    (previous.currentTurnTokenNumber ?? null) !== (next.currentTurnTokenNumber ?? null)
  )
}

function toBattleSummary(battle: BattleState): BattleSummary {
  return {
    id: battle.id ?? 0,
    slug: battle.slug,
    landmarkSlug: battle.landmarkSlug,
    status: battle.status,
    createdAt: battle.createdAt,
    updatedAt: battle.updatedAt,
    endedAt: battle.endedAt,
    tokenCount: battle.tokens.length,
    obstacleCount: battle.obstacles.length,
  }
}

function sortBattleHistory(history: BattleSummary[]) {
  return [...history].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "active" ? -1 : 1
    }

    const leftDate = Date.parse(left.updatedAt ?? left.createdAt ?? "")
    const rightDate = Date.parse(right.updatedAt ?? right.createdAt ?? "")
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
      return rightDate - leftDate
    }

    return right.id - left.id
  })
}

function formatBattleTimestamp(summary: BattleSummary) {
  const source = summary.status === "active" ? summary.updatedAt ?? summary.createdAt : summary.endedAt ?? summary.updatedAt ?? summary.createdAt
  if (!source) {
    return "Sin fecha"
  }

  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha"
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

type TokenFormDraft = {
  nombre: string
  characterId: number | null
  initiative: string
  initiativeModifier: string
  life: string
  status: string
}

function createEmptyTokenFormDraft(type: BattleToken["type"]): TokenFormDraft {
  return {
    nombre: "",
    characterId: null,
    initiative: "",
    initiativeModifier: type === "enemy" ? "0" : "",
    life: type === "enemy" ? "0" : "",
    status: "",
  }
}

export function BattlePageClient() {
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedLandmarkSlug, setSelectedLandmarkSlug] = useState<string | null>(null)
  const [activeBattle, setActiveBattle] = useState<BattleState | null>(null)
  const [selectedBattle, setSelectedBattle] = useState<BattleState | null>(null)
  const [battleHistory, setBattleHistory] = useState<BattleSummary[]>([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTokenNumber, setSelectedTokenNumber] = useState<number | null>(null)
  const [selectedObstacleId, setSelectedObstacleId] = useState<number | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false)
  const [isCharacterSuggestionOpen, setIsCharacterSuggestionOpen] = useState(false)
  const [tokenDialogType, setTokenDialogType] = useState<BattleToken["type"]>("enemy")
  const [tokenDialogDraft, setTokenDialogDraft] = useState<TokenFormDraft>(createEmptyTokenFormDraft("enemy"))
  const [savedTokenDrafts, setSavedTokenDrafts] = useState<Partial<Record<BattleToken["type"], TokenFormDraft>>>({})
  const [pendingDeleteToken, setPendingDeleteToken] = useState<BattleToken | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedSnapshotRef = useRef<string | null>(null)
  const lastBroadcastSnapshotRef = useRef<string | null>(null)
  const lastBroadcastBattleRef = useRef<BattleState | null>(null)
  const battleLoadRequestRef = useRef(0)
  const characterSuggestionCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (characterSuggestionCloseTimeoutRef.current) {
        clearTimeout(characterSuggestionCloseTimeoutRef.current)
        characterSuggestionCloseTimeoutRef.current = null
      }
    }
  }, [])

  const applySelectedBattle = useCallback((battle: BattleState | null) => {
    setSelectedBattle(battle)
    setSelectedTokenNumber(battle?.tokens[0]?.number ?? null)
    setSelectedObstacleId(battle?.obstacles[0]?.id ?? null)
  }, [])

  const syncBattleSummary = useCallback((battle: BattleState) => {
    setBattleHistory((current) => {
      const next = current.map((summary) => (summary.id === battle.id ? toBattleSummary(battle) : summary))
      return sortBattleHistory(next)
    })
  }, [])

  const loadBattlesForLandmark = useCallback(
    async (landmarkSlug: string, preferredBattleId?: number | null) => {
      const requestId = ++battleLoadRequestRef.current
      setIsBattleLoading(true)
      setLoadError(null)

      try {
        const [history, fetchedActiveBattle] = await Promise.all([
          fetchBattleHistory(landmarkSlug),
          fetchActiveBattleForLandmark(landmarkSlug),
        ])

        let nextActiveBattle = fetchedActiveBattle
        const localBattle = readBattleScreenState()
        if (
          localBattle &&
          localBattle.status === "active" &&
          localBattle.landmarkSlug === landmarkSlug &&
          (!nextActiveBattle || localBattle.id === nextActiveBattle.id)
        ) {
          nextActiveBattle = localBattle
        }

        let nextSelectedBattle = nextActiveBattle
        if (
          typeof preferredBattleId === "number" &&
          (!nextSelectedBattle || nextSelectedBattle.id !== preferredBattleId)
        ) {
          try {
            const fetchedBattle = await fetchBattleById(preferredBattleId)
            if (fetchedBattle.landmarkSlug === landmarkSlug) {
              nextSelectedBattle = fetchedBattle
            }
          } catch {
            nextSelectedBattle = nextActiveBattle
          }
        }

        if (requestId !== battleLoadRequestRef.current) {
          return
        }

        setBattleHistory(sortBattleHistory(history))
        setActiveBattle(nextActiveBattle)
        applySelectedBattle(nextSelectedBattle)
        lastSyncedSnapshotRef.current = nextActiveBattle ? JSON.stringify(nextActiveBattle) : null
      } catch (error) {
        if (requestId !== battleLoadRequestRef.current) {
          return
        }

        setLoadError(getBackendErrorMessage(error, "No se pudieron cargar las batallas del landmark."))
        setBattleHistory([])
        setActiveBattle(null)
        applySelectedBattle(null)
        lastSyncedSnapshotRef.current = null
      } finally {
        if (requestId === battleLoadRequestRef.current) {
          setIsBattleLoading(false)
        }
      }
    },
    [applySelectedBattle],
  )

  useEffect(() => {
    let isMounted = true

    void fetchLandmarks()
      .then((fetchedLandmarks) => {
        if (!isMounted) {
          return
        }

        const battleReadyLandmarks = fetchedLandmarks.filter(supportsBattleMap)
        const availableSlugs = new Set(battleReadyLandmarks.map((landmark) => landmarkNameToSlug(landmark.nombre)))
        const presentationSlug = readPresentationScreenTarget()

        setLandmarks(battleReadyLandmarks)
        setSelectedLandmarkSlug(
          presentationSlug && availableSlugs.has(presentationSlug) ? presentationSlug : null,
        )
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        setLoadError(getBackendErrorMessage(error, "No se pudieron cargar los landmarks."))
        setLandmarks([])
        setSelectedLandmarkSlug(null)
      })
      .finally(() => {
        if (isMounted) {
          setIsPageLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void fetchCharacters()
      .then((fetchedCharacters) => {
        if (!isMounted) {
          return
        }

        setCharacters(fetchedCharacters)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setCharacters([])
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isPageLoading) {
      return
    }

    if (!selectedLandmarkSlug) {
      battleLoadRequestRef.current += 1
      setBattleHistory([])
      setActiveBattle(null)
      applySelectedBattle(null)
      lastSyncedSnapshotRef.current = null
      return
    }

    setBattleHistory([])
    setActiveBattle(null)
    applySelectedBattle(null)
    lastSyncedSnapshotRef.current = null

    void loadBattlesForLandmark(selectedLandmarkSlug)
  }, [applySelectedBattle, isPageLoading, loadBattlesForLandmark, selectedLandmarkSlug])

  useEffect(() => {
    if (isTurnOnlyBattleChange(lastBroadcastBattleRef.current, activeBattle)) {
      if (
        activeBattle &&
        typeof activeBattle.id === "number" &&
        !broadcastBattleTurn({
          battleId: activeBattle.id,
          landmarkSlug: activeBattle.landmarkSlug,
          currentTurnTokenNumber: activeBattle.currentTurnTokenNumber ?? null,
        })
      ) {
        setBattleScreenState(activeBattle)
      }

      lastBroadcastBattleRef.current = activeBattle
      return
    }

    const nextSnapshot = activeBattle ? JSON.stringify(activeBattle) : null
    if (nextSnapshot === lastBroadcastSnapshotRef.current) {
      return
    }

    setBattleScreenState(activeBattle)
    lastBroadcastSnapshotRef.current = nextSnapshot
    lastBroadcastBattleRef.current = activeBattle
  }, [activeBattle])

  const selectedBattleId = selectedBattle?.id ?? null
  const selectedBattleStatus = selectedBattle?.status ?? null

  useEffect(() => {
    setIsHistoryOpen(selectedBattleStatus === "finished")
  }, [selectedBattleId, selectedBattleStatus])

  const isSelectedBattleEditable =
    selectedBattle?.status === "active" && typeof selectedBattle.id === "number" && selectedBattle.id === activeBattle?.id

  useEffect(() => {
    if (!isSelectedBattleEditable || !selectedBattle?.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      setIsSaving(false)
      return
    }

    const snapshot = JSON.stringify(selectedBattle)
    if (snapshot === lastSyncedSnapshotRef.current) {
      setIsSaving(false)
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setIsSaving(true)
    setSaveError(null)

    saveTimeoutRef.current = setTimeout(() => {
      const battleToSave = selectedBattle
      const battleId = selectedBattle.id
      const stateSnapshot = snapshot

      if (typeof battleId !== "number") {
        setIsSaving(false)
        return
      }

      void updateBattle(battleId, battleToSave)
        .then((savedBattle) => {
          const savedSnapshot = JSON.stringify(savedBattle)
          lastSyncedSnapshotRef.current = savedSnapshot
          setActiveBattle((current) => (current?.id === savedBattle.id ? savedBattle : current))
          setSelectedBattle((current) =>
            current?.id === savedBattle.id && JSON.stringify(current) === stateSnapshot ? savedBattle : current,
          )
          syncBattleSummary(savedBattle)
        })
        .catch((error) => {
          setSaveError(getBackendErrorMessage(error, "No se pudo guardar la batalla."))
        })
        .finally(() => {
          setIsSaving(false)
        })
    }, 450)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [isSelectedBattleEditable, selectedBattle, syncBattleSummary])

  const selectedLandmark = useMemo(() => {
    if (!selectedLandmarkSlug) {
      return null
    }

    return landmarks.find((landmark) => landmarkNameToSlug(landmark.nombre) === selectedLandmarkSlug) ?? null
  }, [landmarks, selectedLandmarkSlug])

  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  const filteredCharacterSuggestions = useMemo(() => {
    const query = tokenDialogDraft.nombre.trim().toLocaleLowerCase("es")
    const baseList = [...characters].sort((left, right) => left.nombre.localeCompare(right.nombre, "es"))
    if (!query) {
      return baseList.slice(0, 8)
    }

    const startsWith = baseList.filter((character) => character.nombre.toLocaleLowerCase("es").startsWith(query))
    const includes = baseList.filter(
      (character) =>
        !character.nombre.toLocaleLowerCase("es").startsWith(query) &&
        character.nombre.toLocaleLowerCase("es").includes(query),
    )

    return [...startsWith, ...includes].slice(0, 8)
  }, [characters, tokenDialogDraft.nombre, tokenDialogType])

  const handleSelectToken = useCallback((tokenNumber: number) => {
    setSelectedTokenNumber(tokenNumber)
    setSelectedObstacleId(null)
  }, [])

  const handleSelectObstacle = useCallback((obstacleId: number) => {
    setSelectedObstacleId(obstacleId)
    setSelectedTokenNumber(null)
  }, [])

  const updateSelectedBattle = useCallback((updater: (current: BattleState) => BattleState) => {
    setSelectedBattle((current) => {
      if (!current || !isSelectedBattleEditable) {
        return current
      }

      const nextBattle = sortBattleState(updater(current))
      setActiveBattle((activeCurrent) => (activeCurrent?.id === nextBattle.id ? nextBattle : activeCurrent))
      syncBattleSummary(nextBattle)
      return nextBattle
    })
  }, [isSelectedBattleEditable, syncBattleSummary])

  const handleAdvanceTurn = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    setSelectedBattle((current) => {
      if (!current) {
        return current
      }

      const nextTurnTokenNumber = getNextTurnTokenNumber(current.tokens, current.currentTurnTokenNumber)
      if ((current.currentTurnTokenNumber ?? null) === nextTurnTokenNumber) {
        return current
      }

      const nextBattle = {
        ...current,
        currentTurnTokenNumber: nextTurnTokenNumber,
      }

      if (typeof nextBattle.id === "number") {
        const didBroadcastTurn = broadcastBattleTurn({
          battleId: nextBattle.id,
          landmarkSlug: nextBattle.landmarkSlug,
          currentTurnTokenNumber: nextBattle.currentTurnTokenNumber ?? null,
        })

        if (!didBroadcastTurn) {
          setBattleScreenState(nextBattle)
        }
      }

      setActiveBattle((activeCurrent) => (activeCurrent?.id === nextBattle.id ? nextBattle : activeCurrent))
      return nextBattle
    })
  }, [isSelectedBattleEditable])

  const updateToken = useCallback(
    (tokenNumber: number, updater: (token: BattleToken) => BattleToken) => {
      updateSelectedBattle((current) => ({
        ...current,
        tokens: current.tokens.map((token) => (token.number === tokenNumber ? updater(token) : token)),
      }))
    },
    [updateSelectedBattle],
  )

  const createToken = useCallback(
    (type: BattleToken["type"], draft?: TokenFormDraft) => {
      if (!isSelectedBattleEditable) {
        return
      }

      let createdTokenNumber: number | null = null

      updateSelectedBattle((current) => {
        const tokenNumber = current.nextTokenNumber
        createdTokenNumber = tokenNumber
        const manualInitiative = draft ? parseDecimalInput(draft.initiative) : undefined
        const initiativeModifier = draft ? parseNumberInput(draft.initiativeModifier) ?? 0 : 0
        const rolledInitiative = Math.floor(Math.random() * 20) + 1 + initiativeModifier
        const nextInitiative =
          type === "enemy" && manualInitiative === undefined ? rolledInitiative : manualInitiative
        const parsedLife = draft ? parseNumberInput(draft.life) : undefined
        const nextLife = type === "enemy" ? parsedLife ?? 0 : parsedLife
        const draftName = draft?.nombre.trim() ?? ""
        const draftStatus = draft?.status ?? ""
        const nextToken: BattleToken = {
          number: tokenNumber,
          nombre: draftName || `${type === "player" ? "Jugador" : "Enemigo"} ${tokenNumber}`,
          characterId: typeof draft?.characterId === "number" && draft.characterId > 0 ? draft.characterId : undefined,
          type,
          x: 50,
          y: 50,
          initiative: nextInitiative,
          life: nextLife,
          size: 1,
          status: draftStatus,
        }

        return {
          ...current,
          nextTokenNumber: tokenNumber + 1,
          tokens: [...current.tokens, nextToken],
        }
      })

      if (createdTokenNumber !== null) {
        setSelectedTokenNumber(createdTokenNumber)
        setSelectedObstacleId(null)
      }
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const removeToken = useCallback(
    (tokenNumber: number) => {
      if (!isSelectedBattleEditable) {
        return
      }

      updateSelectedBattle((current) => ({
        ...current,
        tokens: current.tokens.filter((token) => token.number !== tokenNumber),
      }))
      setSelectedTokenNumber((current) => (current === tokenNumber ? null : current))
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const openTokenDialog = useCallback((type: BattleToken["type"]) => {
    if (!isSelectedBattleEditable) {
      return
    }

    setTokenDialogType(type)
    setTokenDialogDraft(createEmptyTokenFormDraft(type))
    setIsCharacterSuggestionOpen(false)
    setIsTokenDialogOpen(true)
  }, [isSelectedBattleEditable])

  const handleSaveTokenDraftPreset = useCallback(() => {
    setSavedTokenDrafts((current) => ({
      ...current,
      [tokenDialogType]: { ...tokenDialogDraft },
    }))
  }, [tokenDialogDraft, tokenDialogType])

  const handleRestoreTokenDraftPreset = useCallback(() => {
    const savedDraft = savedTokenDrafts[tokenDialogType]
    if (!savedDraft) {
      return
    }

    setTokenDialogDraft({ ...savedDraft })
  }, [savedTokenDrafts, tokenDialogType])

  const handleSubmitTokenDialog = useCallback(() => {
    createToken(tokenDialogType, tokenDialogDraft)
    setIsCharacterSuggestionOpen(false)
    setIsTokenDialogOpen(false)
  }, [createToken, tokenDialogDraft, tokenDialogType])

  const updateObstacle = useCallback(
    (obstacleId: number, updater: (obstacle: BattleObstacle) => BattleObstacle) => {
      updateSelectedBattle((current) => ({
        ...current,
        obstacles: current.obstacles.map((obstacle) => (obstacle.id === obstacleId ? updater(obstacle) : obstacle)),
      }))
    },
    [updateSelectedBattle],
  )

  const createObstacle = useCallback(
    (shape: BattleObstacleShape) => {
      if (!isSelectedBattleEditable) {
        return
      }

      let createdObstacleId: number | null = null

      updateSelectedBattle((current) => {
        const obstacleId = current.nextObstacleId
        createdObstacleId = obstacleId
        const diameter = 8
        const nextObstacle: BattleObstacle = {
          id: obstacleId,
          shape,
          x: 50,
          y: 50,
          width: shape === "circle" ? diameter : 14,
          height: shape === "circle" ? diameter : 8,
          color: shape === "circle" ? "#f59e0b" : "#0f766e",
        }

        return {
          ...current,
          nextObstacleId: obstacleId + 1,
          obstacles: [...current.obstacles, nextObstacle],
        }
      })

      if (createdObstacleId !== null) {
        setSelectedObstacleId(createdObstacleId)
        setSelectedTokenNumber(null)
      }
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const removeObstacle = useCallback(
    (obstacleId: number) => {
      if (!isSelectedBattleEditable) {
        return
      }

      updateSelectedBattle((current) => ({
        ...current,
        obstacles: current.obstacles.filter((obstacle) => obstacle.id !== obstacleId),
      }))
      setSelectedObstacleId((current) => (current === obstacleId ? null : current))
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const handleCreateBattle = useCallback(async () => {
    if (!selectedLandmarkSlug || activeBattle) {
      return
    }

    setSaveError(null)

    try {
      const createdBattle = await createBattle(selectedLandmarkSlug)
      await loadBattlesForLandmark(selectedLandmarkSlug, createdBattle.id)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo crear la batalla."))
    }
  }, [activeBattle, loadBattlesForLandmark, selectedLandmarkSlug])

  const handleFinishBattle = useCallback(async () => {
    if (!selectedLandmarkSlug || !selectedBattle?.id || selectedBattle.status !== "active") {
      return
    }

    setSaveError(null)

    try {
      await finishBattle(selectedBattle.id)
      await loadBattlesForLandmark(selectedLandmarkSlug, selectedBattle.id)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo finalizar la batalla."))
    }
  }, [loadBattlesForLandmark, selectedBattle, selectedLandmarkSlug])

  const handleReopenBattle = useCallback(async () => {
    if (!selectedLandmarkSlug || !selectedBattle?.id || selectedBattle.status !== "finished") {
      return
    }

    setSaveError(null)

    try {
      await reopenBattle(selectedBattle.id)
      await loadBattlesForLandmark(selectedLandmarkSlug, selectedBattle.id)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo reabrir la batalla."))
    }
  }, [loadBattlesForLandmark, selectedBattle, selectedLandmarkSlug])

  const handleSelectHistoryBattle = useCallback(async (battleId: number) => {
    setLoadError(null)

    try {
      const battle = await fetchBattleById(battleId)
      applySelectedBattle(battle)
      if (battle.status === "active") {
        setActiveBattle(battle)
        lastSyncedSnapshotRef.current = JSON.stringify(battle)
      }
    } catch (error) {
      setLoadError(getBackendErrorMessage(error, "No se pudo cargar la batalla seleccionada."))
    }
  }, [applySelectedBattle])

  const battleOverlay = useMemo(() => {
    if (!selectedBattle) {
      return null
    }

    return (
      <BattleTokenOverlay
        tokens={selectedBattle.tokens}
        obstacles={selectedBattle.obstacles}
        characterById={charactersById}
        interactive={isSelectedBattleEditable}
        enableTokenInspector
        tokenInspectorEditable={isSelectedBattleEditable}
        ghostHiddenTokens
        selectedTokenNumber={selectedTokenNumber}
        selectedObstacleId={selectedObstacleId}
        onSelectToken={handleSelectToken}
        onUpdateTokenDetails={(tokenNumber, nextValues) => {
          updateToken(tokenNumber, (token) => ({
            ...token,
            ...nextValues,
          }))
        }}
        onRequestTokenDelete={(tokenNumber) => {
          const token = selectedBattle.tokens.find((candidate) => candidate.number === tokenNumber)
          if (!token) {
            return
          }
          setPendingDeleteToken(token)
        }}
        onPreviewTokenMove={(tokenNumber, nextPosition) => {
          if (!selectedBattle.id) {
            return
          }

          broadcastBattleTokenPreview({
            battleId: selectedBattle.id,
            landmarkSlug: selectedBattle.landmarkSlug,
            tokenNumber,
            position: nextPosition,
          })
        }}
        onPreviewObstacleMove={(obstacleId, nextPosition) => {
          if (!selectedBattle.id) {
            return
          }

          broadcastBattleObstaclePreview({
            battleId: selectedBattle.id,
            landmarkSlug: selectedBattle.landmarkSlug,
            obstacleId,
            position: nextPosition,
          })
        }}
        onSelectObstacle={handleSelectObstacle}
        onMoveToken={(tokenNumber, nextPosition) => {
          updateToken(tokenNumber, (token) => ({ ...token, ...nextPosition }))
        }}
        onResizeToken={(tokenNumber, nextSize) => {
          updateToken(tokenNumber, (token) => ({ ...token, size: nextSize }))
        }}
        onMoveObstacle={(obstacleId, nextPosition) => {
          updateObstacle(obstacleId, (obstacle) => ({ ...obstacle, ...nextPosition }))
        }}
        onResizeObstacle={(obstacleId, nextSize) => {
          updateObstacle(obstacleId, (obstacle) => ({ ...obstacle, ...nextSize }))
        }}
        onRemoveObstacle={removeObstacle}
      />
    )
  }, [
    charactersById,
    isSelectedBattleEditable,
    selectedBattle?.id,
    selectedBattle?.landmarkSlug,
    selectedBattle?.obstacles,
    selectedBattle?.tokens,
    handleSelectObstacle,
    handleSelectToken,
    removeObstacle,
    selectedObstacleId,
    selectedTokenNumber,
    updateObstacle,
    updateToken,
  ])

  const battleTopOverlay = useMemo(() => {
    if (!selectedBattle) {
      return null
    }

    return (
      <BattleInitiativeStrip
        tokens={selectedBattle.tokens}
        characterById={charactersById}
        currentTurnTokenNumber={normalizeCurrentTurnTokenNumber(
          selectedBattle.tokens,
          selectedBattle.currentTurnTokenNumber ?? null,
        )}
        interactive={isSelectedBattleEditable && selectedBattle.status === "active"}
        onAdvanceTurn={isSelectedBattleEditable && selectedBattle.status === "active" ? handleAdvanceTurn : undefined}
      />
    )
  }, [charactersById, handleAdvanceTurn, isSelectedBattleEditable, selectedBattle])

  if (isPageLoading) {
    return (
      <main className="flex min-h-[calc(100dvh-var(--app-nav-height))] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,231,190,0.55),_rgba(222,205,165,0.8)_45%,_rgba(177,151,109,0.9)_100%)] px-6 text-sm font-semibold text-stone-700">
        Cargando campo de batalla...
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100dvh-var(--app-nav-height))] bg-[radial-gradient(circle_at_top_left,_rgba(244,223,174,0.45),_rgba(210,186,135,0.7)_40%,_rgba(154,128,88,0.88)_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1720px] flex-col gap-4 lg:flex-row">
        <section className="h-[52dvh] overflow-hidden rounded-[2rem] border border-stone-900/10 bg-stone-950/80 shadow-2xl sm:h-[58dvh] lg:h-[calc(100dvh-var(--app-nav-height)-3rem)] lg:min-h-0 lg:flex-[1.35]">
          {selectedLandmarkSlug ? (
            <LandmarkMapOnlyClient
              nombreLandmark={selectedLandmarkSlug}
              showControls
              fitParentHeight
              topOverlay={battleTopOverlay}
              overlay={battleOverlay}
              leftControls={
                <div className="flex items-center gap-2 rounded-2xl border border-stone-900/10 bg-white/90 p-2 shadow-lg backdrop-blur">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Agregar enemigo"
                    title="Agregar enemigo"
                    onClick={() => openTokenDialog("enemy")}
                    disabled={!isSelectedBattleEditable}
                  >
                    <Swords className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Agregar jugador"
                    title="Agregar jugador"
                    onClick={() => openTokenDialog("player")}
                    disabled={!isSelectedBattleEditable}
                  >
                    <UserRound className="size-4" />
                  </Button>
                  <div className="h-6 w-px bg-stone-200" aria-hidden="true" />
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Agregar esfera"
                    title="Agregar esfera"
                    onClick={() => createObstacle("circle")}
                    disabled={!isSelectedBattleEditable}
                  >
                    <Circle className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Agregar rectangulo"
                    title="Agregar rectangulo"
                    onClick={() => createObstacle("rectangle")}
                    disabled={!isSelectedBattleEditable}
                  >
                    <Square className="size-4" />
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="flex h-full min-h-[50dvh] items-center justify-center px-8 text-center text-sm font-medium text-stone-200">
              Seleccioná un landmark para ver o crear una batalla.
            </div>
          )}
        </section>

        <aside className="w-full shrink-0 rounded-[2rem] border border-stone-900/10 bg-white/85 p-4 shadow-2xl backdrop-blur lg:flex lg:w-[420px] lg:max-h-[calc(100dvh-var(--app-nav-height)-3rem)] lg:flex-col lg:overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-amber-700/20 bg-amber-100 text-amber-900">
                    <Swords className="size-4" />
                  </div>
                  <div>
                    <h1 className="font-serif text-xl text-stone-950">Batalla</h1>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                      {selectedBattle ? `${selectedBattle.tokens.length} fichas / ${selectedBattle.obstacles.length} obstaculos` : "Sin batalla activa"}
                    </p>
                  </div>
                </div>
                {selectedLandmark ? (
                  <p className="mt-2 text-xs text-stone-600">Landmark: {selectedLandmark.nombre}</p>
                ) : null}
              </div>

              <Button
                variant="outline"
                className="h-9 gap-2 px-3"
                onClick={() =>
                  openPresentationScreen(
                    selectedLandmarkSlug
                      ? { landmarkSlug: selectedLandmarkSlug }
                      : { reset: true },
                  )
                }
              >
                <Monitor className="size-4" />
                Presentacion
              </Button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500" htmlFor="battle-map-selector">
                Mapa
              </label>
              <select
                id="battle-map-selector"
                className="flex h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none ring-0 transition focus:border-amber-500"
                value={selectedLandmarkSlug ?? ""}
                onChange={(event) => {
                  const nextSlug = event.target.value.trim()
                  setSelectedLandmarkSlug(nextSlug.length > 0 ? nextSlug : null)
                  setSaveError(null)
                }}
              >
                <option value="">Sin mapa</option>
                {landmarks.map((landmark) => {
                  const slug = landmarkNameToSlug(landmark.nombre)
                  return (
                    <option key={landmark.id} value={slug}>
                      {landmark.nombre}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button className="h-10 rounded-xl px-3" onClick={() => void handleCreateBattle()} disabled={!selectedLandmarkSlug || Boolean(activeBattle)}>
                Nueva batalla
              </Button>
              {selectedBattle?.status === "active" ? (
                <Button variant="outline" className="h-10 rounded-xl px-3" onClick={() => void handleFinishBattle()}>
                  Finalizar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-10 rounded-xl px-3"
                  onClick={() => void handleReopenBattle()}
                  disabled={selectedBattle?.status !== "finished"}
                >
                  Reabrir
                </Button>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Estado</p>
                  <p className="mt-1 text-sm font-medium text-stone-700">
                    {!selectedLandmarkSlug
                      ? "Seleccioná un landmark."
                      : isBattleLoading
                        ? "Cargando batallas..."
                        : !selectedBattle
                          ? "No hay batalla activa para este landmark."
                          : selectedBattle.status === "finished"
                            ? "Estás viendo una batalla terminada."
                            : "Batalla activa editable."}
                  </p>
                </div>
                {selectedBattle ? (
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-stone-500">
                    #{selectedBattle.id} · {selectedBattle.status === "active" ? "Activa" : "Terminada"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-medium text-stone-500">
              <span>{isSaving ? "Guardando cambios..." : "Persistencia automatica"}</span>
              <span>{selectedBattle ? `Proxima ficha: #${selectedBattle.nextTokenNumber}` : "Sin batalla"}</span>
            </div>

            {(loadError || saveError) && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {saveError ?? loadError}
              </p>
            )}
          </div>

          <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1 lg:flex-1">
            <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen} className="rounded-2xl border border-stone-200 bg-white/70 p-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-stone-50"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Historial</span>
                  <span className="flex items-center gap-2 text-[11px] font-medium text-stone-500">
                    <span>{battleHistory.length}</span>
                    <ChevronDown className={`size-4 transition ${isHistoryOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {battleHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-500">
                    {selectedLandmarkSlug ? "Todavia no hay batallas para este landmark." : "Elegí un landmark para ver su historial."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {battleHistory.map((battle) => (
                      <button
                        key={battle.id}
                        type="button"
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                          battle.id === selectedBattle?.id
                            ? "border-amber-500 bg-amber-50"
                            : "border-stone-200 bg-white hover:border-stone-300"
                        }`}
                        onClick={() => void handleSelectHistoryBattle(battle.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-stone-900">
                            #{battle.id} · {battle.status === "active" ? "Activa" : "Terminada"}
                          </span>
                          <span className="text-[11px] text-stone-500">{formatBattleTimestamp(battle)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-500">
                          {battle.tokenCount} fichas / {battle.obstacleCount} obstaculos
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <section className="space-y-3 rounded-2xl border border-stone-200 bg-white/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Edicion en mapa</h2>
                <span className="text-[11px] text-stone-500">
                  {selectedBattle ? `${selectedBattle.tokens.length} fichas / ${selectedBattle.obstacles.length} obstaculos` : "Sin batalla"}
                </span>
              </div>

              <p className="text-xs leading-5 text-stone-600">
                Click izquierdo mueve la ficha u obstaculo, rueda cambia tamano. Hover abre el inspector, mantenerlo lo fija y desde ahi editás la ficha. Click derecho en ficha pide borrar, doble click en obstaculo lo elimina. Los botones de alta están abajo a la izquierda del mapa.
              </p>

              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-xs text-stone-500">
                {selectedTokenNumber !== null
                  ? `Ficha seleccionada: #${selectedTokenNumber}`
                  : selectedObstacleId !== null
                    ? `Obstaculo seleccionado: #${selectedObstacleId}`
                    : "Seleccioná una ficha u obstaculo desde el mapa para operar sobre él."}
              </div>
            </section>
          </div>
        </aside>
      </div>

      <Dialog
        open={isTokenDialogOpen}
        onOpenChange={(open) => {
          setIsTokenDialogOpen(open)
          if (!open) {
            setIsCharacterSuggestionOpen(false)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border-stone-200 bg-white/95 p-5">
          <DialogHeader>
            <DialogTitle>Nueva ficha</DialogTitle>
            <DialogDescription>
              Cargá los datos iniciales y después vas a poder seguir editándolos desde el mapa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Tipo
                <span className="mt-1 block rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-700">
                  {tokenDialogType === "enemy" ? "Enemigo" : "Jugador"}
                </span>
              </label>

              <label className="relative text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Nombre
                <Input
                  value={tokenDialogDraft.nombre}
                  className="mt-1 h-10"
                  placeholder="Nombre o personaje"
                  autoComplete="off"
                  onFocus={() => {
                    if (characterSuggestionCloseTimeoutRef.current) {
                      clearTimeout(characterSuggestionCloseTimeoutRef.current)
                      characterSuggestionCloseTimeoutRef.current = null
                    }
                    setIsCharacterSuggestionOpen(true)
                  }}
                  onBlur={() => {
                    characterSuggestionCloseTimeoutRef.current = setTimeout(() => {
                      setIsCharacterSuggestionOpen(false)
                      characterSuggestionCloseTimeoutRef.current = null
                    }, 120)
                  }}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setTokenDialogDraft((current) => ({
                      ...current,
                      nombre: nextValue,
                      characterId: current.characterId && current.nombre !== nextValue ? null : current.characterId,
                    }))
                    setIsCharacterSuggestionOpen(true)
                  }}
                />
                {isCharacterSuggestionOpen && filteredCharacterSuggestions.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                    {filteredCharacterSuggestions.map((character) => (
                      <button
                        key={character.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-stone-700 transition hover:bg-stone-50"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          if (characterSuggestionCloseTimeoutRef.current) {
                            clearTimeout(characterSuggestionCloseTimeoutRef.current)
                            characterSuggestionCloseTimeoutRef.current = null
                          }
                          setTokenDialogDraft((current) => ({
                            ...current,
                            nombre: character.nombre,
                            characterId: character.id,
                          }))
                          setIsCharacterSuggestionOpen(false)
                        }}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden bg-stone-100 text-[10px] font-bold text-stone-500 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.1)]">
                          {character.imagen ? (
                            <img src={character.imagen} alt={character.nombre} className="size-full object-cover" />
                          ) : (
                            character.nombre.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{character.nombre}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Iniciativa
                <Input
                  value={tokenDialogDraft.initiative}
                  inputMode="decimal"
                  className="mt-1 h-10"
                  placeholder="Ini"
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setTokenDialogDraft((current) => ({ ...current, initiative: nextValue }))
                  }}
                />
              </label>

              {tokenDialogType === "enemy" ? (
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Mod Ini
                  <Input
                    value={tokenDialogDraft.initiativeModifier}
                    inputMode="decimal"
                    className="mt-1 h-10"
                    placeholder="0"
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setTokenDialogDraft((current) => ({ ...current, initiativeModifier: nextValue }))
                    }}
                  />
                </label>
              ) : (
                <div />
              )}
            </div>

            {tokenDialogType === "enemy" ? (
              <p className="text-[11px] leading-4 text-stone-500">
                Si dejás <span className="font-semibold text-stone-700">Iniciativa</span> vacía, al crear se tira
                {" "}1d20 + modificador automáticamente.
              </p>
            ) : null}

            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Vida
              <Input
                value={tokenDialogDraft.life}
                inputMode="numeric"
                className="mt-1 h-10"
                placeholder={tokenDialogType === "enemy" ? "0" : "Vida"}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setTokenDialogDraft((current) => ({ ...current, life: nextValue }))
                }}
              />
            </label>

            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Estado
              <Input
                value={tokenDialogDraft.status}
                className="mt-1 h-10"
                placeholder="Estado"
                onChange={(event) => {
                  const nextValue = event.target.value
                  setTokenDialogDraft((current) => ({ ...current, status: nextValue }))
                }}
              />
            </label>
          </div>

          <DialogFooter className="mt-2 sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="rounded-xl" onClick={handleSaveTokenDraftPreset}>
                Guardar plantilla
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={handleRestoreTokenDraftPreset}
                disabled={!savedTokenDrafts[tokenDialogType]}
              >
                Recargar ultima
              </Button>
            </div>
            <Button type="button" className="rounded-xl" onClick={handleSubmitTokenDialog} disabled={!isSelectedBattleEditable}>
              Crear ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeleteToken)} onOpenChange={(open) => {
        if (!open) {
          setPendingDeleteToken(null)
        }
      }}>
        <DialogContent className="max-w-sm rounded-3xl border-stone-200 bg-white/95 p-5">
          <DialogHeader>
            <DialogTitle>Eliminar ficha</DialogTitle>
            <DialogDescription>
              {pendingDeleteToken
                ? `Vas a eliminar la ficha #${pendingDeleteToken.number} (${pendingDeleteToken.nombre}).`
                : "Vas a eliminar la ficha seleccionada."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setPendingDeleteToken(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (pendingDeleteToken) {
                  removeToken(pendingDeleteToken.number)
                }
                setPendingDeleteToken(null)
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
