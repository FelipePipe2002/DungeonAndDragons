"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react"
import { Monitor, Plus, Swords, Trash2, UserRound } from "lucide-react"

import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import { LandmarkMapOnlyClient } from "@/app/presentacion/LandmarkMapOnlyClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readBattleScreenPayload, setBattleScreenState } from "@/lib/battle/sync"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { openPresentationScreen, readPresentationScreenTarget, setPresentationScreenTarget } from "@/lib/presentation/screen"
import { fetchCurrentBattleState, updateCurrentBattleState } from "@/lib/services/battle-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import type { BattleObstacle, BattleObstacleShape, BattleState, BattleToken, Landmark } from "@/lib/types"

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseBoundedDecimalInput(value: string, min: number, max: number) {
  const parsed = parseDecimalInput(value)
  if (typeof parsed !== "number") {
    return undefined
  }

  return Math.round(clamp(parsed, min, max) * 100) / 100
}

function selectInputText(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select()
}

function compareInitiative(left: BattleToken, right: BattleToken) {
  const leftInitiative = typeof left.initiative === "number" ? left.initiative : Number.NEGATIVE_INFINITY
  const rightInitiative = typeof right.initiative === "number" ? right.initiative : Number.NEGATIVE_INFINITY

  if (leftInitiative !== rightInitiative) {
    return rightInitiative - leftInitiative
  }

  return left.number - right.number
}

export function BattlePageClient() {
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [sizeDrafts, setSizeDrafts] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTokenNumber, setSelectedTokenNumber] = useState<number | null>(null)
  const [selectedObstacleId, setSelectedObstacleId] = useState<number | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedSnapshotRef = useRef<string | null>(null)
  const lastBroadcastSnapshotRef = useRef<string | null>(null)

  const loadPageData = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const [fetchedBattleState, fetchedLandmarks] = await Promise.all([
        fetchCurrentBattleState(),
        fetchLandmarks(),
      ])
      const localBattlePayload = readBattleScreenPayload()
      const localBattleState = localBattlePayload?.state ?? null

      const battleReadyLandmarks = fetchedLandmarks.filter(supportsBattleMap)
      const availableSlugs = new Set(battleReadyLandmarks.map((landmark) => landmarkNameToSlug(landmark.nombre)))
      const presentationSlug = readPresentationScreenTarget()
      const sourceBattleState =
        localBattleState &&
        typeof localBattleState.nextObstacleId === "number" &&
        Array.isArray(localBattleState.obstacles)
          ? localBattleState
          : fetchedBattleState

      const nextBattleState =
        !sourceBattleState.landmarkSlug && presentationSlug && availableSlugs.has(presentationSlug)
          ? { ...sourceBattleState, landmarkSlug: presentationSlug }
          : sourceBattleState

      setLandmarks(battleReadyLandmarks)
      setBattleState(nextBattleState)
      setSizeDrafts({})
      setSelectedTokenNumber(nextBattleState.tokens[0]?.number ?? null)
      setSelectedObstacleId(nextBattleState.obstacles[0]?.id ?? null)
      lastSyncedSnapshotRef.current = JSON.stringify(fetchedBattleState)
      lastBroadcastSnapshotRef.current = localBattleState ? JSON.stringify(localBattleState) : null
    } catch (error) {
      setLoadError(getBackendErrorMessage(error, "No se pudo cargar la batalla actual."))
      setBattleState(null)
      setLandmarks([])
      setSizeDrafts({})
      setSelectedTokenNumber(null)
      setSelectedObstacleId(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  useEffect(() => {
    if (!battleState?.landmarkSlug) {
      return
    }

    setPresentationScreenTarget(battleState.landmarkSlug)
  }, [battleState?.landmarkSlug])

  useEffect(() => {
    if (!battleState) {
      return
    }

    const snapshot = JSON.stringify(battleState)
    if (snapshot !== lastBroadcastSnapshotRef.current) {
      setBattleScreenState(battleState)
      lastBroadcastSnapshotRef.current = snapshot
    }
  }, [battleState])

  useEffect(() => {
    if (!battleState) {
      return
    }

    const snapshot = JSON.stringify(battleState)
    if (snapshot === lastSyncedSnapshotRef.current) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setIsSaving(true)
    setSaveError(null)

    saveTimeoutRef.current = setTimeout(() => {
      const stateToSave = battleState
      const stateSnapshot = snapshot

      void updateCurrentBattleState(stateToSave)
        .then((savedState) => {
          const savedSnapshot = JSON.stringify(savedState)
          lastSyncedSnapshotRef.current = savedSnapshot

          setBattleState((current) => (current && JSON.stringify(current) === stateSnapshot ? savedState : current))
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
  }, [battleState])

  const selectedLandmark = useMemo(() => {
    if (!battleState?.landmarkSlug) {
      return null
    }

    return landmarks.find((landmark) => landmarkNameToSlug(landmark.nombre) === battleState.landmarkSlug) ?? null
  }, [battleState?.landmarkSlug, landmarks])

  const orderedTokens = useMemo(
    () => (battleState ? [...battleState.tokens].sort(compareInitiative) : []),
    [battleState],
  )

  const updateBattleState = useCallback((updater: (current: BattleState) => BattleState) => {
    setBattleState((current) => {
      if (!current) {
        return current
      }

      const nextState = updater(current)
      return {
        ...nextState,
        tokens: [...nextState.tokens].sort((left, right) => left.number - right.number),
        obstacles: [...nextState.obstacles].sort((left, right) => left.id - right.id),
      }
    })
  }, [])

  const updateToken = useCallback(
    (tokenNumber: number, updater: (token: BattleToken) => BattleToken) => {
      updateBattleState((current) => ({
        ...current,
        tokens: current.tokens.map((token) => (token.number === tokenNumber ? updater(token) : token)),
      }))
    },
    [updateBattleState],
  )

  const createToken = useCallback(
    (type: BattleToken["type"]) => {
      let createdTokenNumber: number | null = null

      updateBattleState((current) => {
        const tokenNumber = current.nextTokenNumber
        createdTokenNumber = tokenNumber
        const nextToken: BattleToken = {
          number: tokenNumber,
          nombre: `${type === "player" ? "Jugador" : "Enemigo"} ${tokenNumber}`,
          type,
          x: 50,
          y: 50,
          initiative: undefined,
          life: type === "enemy" ? 0 : undefined,
          size: 1,
          status: "",
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
    [updateBattleState],
  )

  const removeToken = useCallback(
    (tokenNumber: number) => {
      updateBattleState((current) => ({
        ...current,
        tokens: current.tokens.filter((token) => token.number !== tokenNumber),
      }))
      setSizeDrafts((current) => {
        const next = { ...current }
        delete next[tokenNumber]
        return next
      })

      setSelectedTokenNumber((current) => (current === tokenNumber ? null : current))
    },
    [updateBattleState],
  )

  const updateObstacle = useCallback(
    (obstacleId: number, updater: (obstacle: BattleObstacle) => BattleObstacle) => {
      updateBattleState((current) => ({
        ...current,
        obstacles: current.obstacles.map((obstacle) => (obstacle.id === obstacleId ? updater(obstacle) : obstacle)),
      }))
    },
    [updateBattleState],
  )

  const createObstacle = useCallback(
    (shape: BattleObstacleShape) => {
      let createdObstacleId: number | null = null

      updateBattleState((current) => {
        const obstacleId = current.nextObstacleId
        createdObstacleId = obstacleId
        const nextObstacle: BattleObstacle = {
          id: obstacleId,
          shape,
          x: 50,
          y: 50,
          width: shape === "circle" ? 8 : 14,
          height: 8,
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
    [updateBattleState],
  )

  const removeObstacle = useCallback(
    (obstacleId: number) => {
      updateBattleState((current) => ({
        ...current,
        obstacles: current.obstacles.filter((obstacle) => obstacle.id !== obstacleId),
      }))
      setSelectedObstacleId((current) => (current === obstacleId ? null : current))
    },
    [updateBattleState],
  )

  const battleOverlay = useMemo(() => {
    if (!battleState) {
      return null
    }

    return (
      <BattleTokenOverlay
        tokens={battleState.tokens}
        obstacles={battleState.obstacles}
        interactive
        selectedTokenNumber={selectedTokenNumber}
        selectedObstacleId={selectedObstacleId}
        onSelectToken={(tokenNumber) => {
          setSelectedTokenNumber(tokenNumber)
          setSelectedObstacleId(null)
        }}
        onSelectObstacle={(obstacleId) => {
          setSelectedObstacleId(obstacleId)
          setSelectedTokenNumber(null)
        }}
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
      />
    )
  }, [battleState, selectedObstacleId, selectedTokenNumber, updateObstacle, updateToken])

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100dvh-var(--app-nav-height))] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,231,190,0.55),_rgba(222,205,165,0.8)_45%,_rgba(177,151,109,0.9)_100%)] px-6 text-sm font-semibold text-stone-700">
        Cargando campo de batalla...
      </main>
    )
  }

  if (!battleState) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-var(--app-nav-height))] max-w-5xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-red-900/15 bg-white/85 p-8 text-center shadow-xl backdrop-blur">
          <p className="text-sm font-semibold text-red-800">{loadError ?? "No se pudo cargar la batalla."}</p>
          <Button className="mt-4" onClick={() => void loadPageData()}>
            Reintentar
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100dvh-var(--app-nav-height))] bg-[radial-gradient(circle_at_top_left,_rgba(244,223,174,0.45),_rgba(210,186,135,0.7)_40%,_rgba(154,128,88,0.88)_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1720px] flex-col gap-4 lg:flex-row">
        <section className="overflow-hidden rounded-[2rem] border border-stone-900/10 bg-stone-950/80 shadow-2xl lg:min-h-[calc(100dvh-var(--app-nav-height)-2rem)] lg:flex-[1.35]">
          {battleState.landmarkSlug ? (
            <LandmarkMapOnlyClient
              nombreLandmark={battleState.landmarkSlug}
              showControls
              overlay={battleOverlay}
              fitParentHeight={true}
            />
          ) : (
            <div className="flex h-full min-h-[50dvh] items-center justify-center px-8 text-center text-sm font-medium text-stone-200">
              Seleccioná un mapa para arrancar la batalla.
            </div>
          )}
        </section>

        <aside className="w-full shrink-0 rounded-[2rem] border border-stone-900/10 bg-white/85 p-4 shadow-2xl backdrop-blur lg:w-[390px] lg:max-h-[calc(100dvh-var(--app-nav-height)-2rem)] lg:overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl border border-amber-700/20 bg-amber-100 text-amber-900">
                  <Swords className="size-4" />
                </div>
                <div>
                  <h1 className="font-serif text-xl text-stone-950">Batalla</h1>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
                    {battleState.tokens.length} fichas / {battleState.obstacles.length} obstaculos
                  </p>
                </div>
              </div>
              {selectedLandmark ? (
                <p className="mt-2 text-xs text-stone-600">Mapa activo: {selectedLandmark.nombre}</p>
              ) : null}
            </div>

            <Button
              variant="outline"
              className="h-9 gap-2 px-3"
              onClick={() =>
                openPresentationScreen({
                  landmarkSlug: battleState.landmarkSlug,
                  reset: !battleState.landmarkSlug,
                })
              }
            >
              <Monitor className="size-4" />
              Presentacion
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500" htmlFor="battle-map-selector">
              Mapa
            </label>
            <select
              id="battle-map-selector"
              className="flex h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none ring-0 transition focus:border-amber-500"
              value={battleState.landmarkSlug ?? ""}
              onChange={(event) => {
                const nextSlug = event.target.value.trim()
                updateBattleState((current) => ({
                  ...current,
                  landmarkSlug: nextSlug.length > 0 ? nextSlug : undefined,
                }))
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

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button className="h-10 justify-between rounded-xl px-3" onClick={() => createToken("enemy")}>
              <span>Agregar enemigo</span>
              <Plus className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-10 justify-between rounded-xl px-3"
              onClick={() => createToken("player")}
            >
              <span>Agregar jugador</span>
              <UserRound className="size-4" />
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" className="h-9 justify-between rounded-xl px-3" onClick={() => createObstacle("circle")}>
              <span>Esfera</span>
              <Plus className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="h-9 justify-between rounded-xl px-3"
              onClick={() => createObstacle("rectangle")}
            >
              <span>Rectangulo</span>
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-stone-500">
            <span>{isSaving ? "Guardando cambios..." : "Cambios persistidos automaticamente"}</span>
            <span>Proxima ficha: #{battleState.nextTokenNumber}</span>
          </div>
          {(loadError || saveError) && (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {saveError ?? loadError}
            </p>
          )}

          <div className="space-y-2 overflow-y-auto lg:max-h-[calc(100dvh-var(--app-nav-height)-20.5rem)]">
            {battleState.obstacles.length === 0 && orderedTokens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
                No hay elementos todavia. Creá fichas u obstaculos y arrastralos sobre el mapa.
              </div>
            ) : (
              <>
                {battleState.obstacles.map((obstacle) => (
                  <section
                    key={`obstacle-panel-${obstacle.id}`}
                    className={`rounded-2xl border p-2.5 shadow-sm transition ${
                      obstacle.id === selectedObstacleId
                        ? "border-amber-500 bg-amber-50/80"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedObstacleId(obstacle.id)
                          setSelectedTokenNumber(null)
                        }}
                        aria-label={`Seleccionar obstaculo ${obstacle.id}`}
                      >
                        <span
                          className="block size-8 border-2"
                          style={{
                            borderColor: obstacle.color,
                            backgroundColor: `${obstacle.color}55`,
                            borderRadius: obstacle.shape === "circle" ? "9999px" : "0",
                          }}
                        />
                      </button>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <Input
                          type="color"
                          value={obstacle.color}
                          className="h-8 w-12 shrink-0 p-1"
                          aria-label={`Color del obstaculo ${obstacle.id}`}
                          onFocus={() => {
                            setSelectedObstacleId(obstacle.id)
                            setSelectedTokenNumber(null)
                          }}
                          onChange={(event) => {
                            const nextColor = event.target.value
                            updateObstacle(obstacle.id, (current) => ({ ...current, color: nextColor }))
                          }}
                        />
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={String(obstacle.width)}
                          className="h-8 w-16"
                          placeholder="An"
                          aria-label={`Ancho del obstaculo ${obstacle.id}`}
                          onFocus={(event) => {
                            selectInputText(event)
                            setSelectedObstacleId(obstacle.id)
                            setSelectedTokenNumber(null)
                          }}
                          onChange={(event) => {
                            const nextValue = parseBoundedDecimalInput(event.target.value, 1, 100)
                            if (typeof nextValue !== "number") return
                            updateObstacle(obstacle.id, (current) => ({ ...current, width: nextValue }))
                          }}
                        />
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={String(obstacle.height)}
                          className="h-8 w-16"
                          placeholder="Al"
                          aria-label={`Alto del obstaculo ${obstacle.id}`}
                          onFocus={(event) => {
                            selectInputText(event)
                            setSelectedObstacleId(obstacle.id)
                            setSelectedTokenNumber(null)
                          }}
                          onChange={(event) => {
                            const nextValue = parseBoundedDecimalInput(event.target.value, 1, 100)
                            if (typeof nextValue !== "number") return
                            updateObstacle(obstacle.id, (current) => ({ ...current, height: nextValue }))
                          }}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          {obstacle.shape === "circle" ? "Esfera" : "Rect"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-stone-500 hover:text-red-700"
                        onClick={() => removeObstacle(obstacle.id)}
                        aria-label={`Eliminar obstaculo ${obstacle.id}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </section>
                ))}

                {orderedTokens.map((token) => {
                const sizeValue = sizeDrafts[token.number] ?? String(token.size ?? 1)

                return (
                  <section
                    key={token.number}
                    className={`rounded-2xl border p-2.5 shadow-sm transition ${
                      token.number === selectedTokenNumber
                        ? "border-amber-500 bg-amber-50/80"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedTokenNumber(token.number)
                          setSelectedObstacleId(null)
                        }}
                        aria-label={`Seleccionar ficha ${token.number}`}
                      >
                        <span
                          className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                            token.type === "enemy"
                              ? (token.life ?? 1) <= 0
                                ? "bg-black text-stone-100"
                                : "bg-red-700 text-red-50"
                              : "bg-sky-700 text-sky-50"
                          }`}
                        >
                          {token.number}
                        </span>
                      </button>
                      <Input
                        value={token.nombre}
                        className="h-8 min-w-0 flex-1"
                        placeholder="Nombre"
                        aria-label={`Nombre de la ficha ${token.number}`}
                        onFocus={() => {
                          setSelectedTokenNumber(token.number)
                          setSelectedObstacleId(null)
                        }}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          updateToken(token.number, (current) => ({ ...current, nombre: nextValue }))
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-stone-500 hover:text-red-700"
                        onClick={() => removeToken(token.number)}
                        aria-label={`Eliminar ficha ${token.number}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        inputMode="numeric"
                        value={typeof token.initiative === "number" ? String(token.initiative) : ""}
                        className="h-8 w-14"
                        maxLength={2}
                        placeholder="Ini"
                        aria-label={`Iniciativa de la ficha ${token.number}`}
                        onFocus={(event) => {
                          selectInputText(event)
                          setSelectedTokenNumber(token.number)
                          setSelectedObstacleId(null)
                        }}
                        onChange={(event) => {
                          const nextValue = parseNumberInput(event.target.value)
                          updateToken(token.number, (current) => ({ ...current, initiative: nextValue }))
                        }}
                      />

                      {token.type === "enemy" ? (
                        <Input
                          inputMode="numeric"
                          value={typeof token.life === "number" ? String(token.life) : ""}
                          className="h-8 w-20"
                          maxLength={4}
                          placeholder="Vida"
                          aria-label={`Vida de la ficha ${token.number}`}
                          onFocus={(event) => {
                            selectInputText(event)
                            setSelectedTokenNumber(token.number)
                            setSelectedObstacleId(null)
                          }}
                          onChange={(event) => {
                            const nextValue = parseNumberInput(event.target.value)
                            updateToken(token.number, (current) => ({ ...current, life: nextValue }))
                          }}
                        />
                      ) : null}

                      <Input
                        type="text"
                        inputMode="decimal"
                        value={sizeValue}
                        className="h-8 w-16"
                        maxLength={5}
                        placeholder="Sz"
                        aria-label={`Tamano de la ficha ${token.number}`}
                        onFocus={(event) => {
                          selectInputText(event)
                          setSelectedTokenNumber(token.number)
                          setSelectedObstacleId(null)
                        }}
                        onChange={(event) => {
                          setSizeDrafts((current) => ({
                            ...current,
                            [token.number]: event.target.value,
                          }))
                        }}
                        onBlur={() => {
                          const nextValue = parseDecimalInput(sizeValue)
                          updateToken(token.number, (current) => ({
                            ...current,
                            size: nextValue ?? current.size,
                          }))
                          setSizeDrafts((current) => {
                            const next = { ...current }
                            delete next[token.number]
                            return next
                          })
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return
                          }

                          event.preventDefault()
                          event.currentTarget.blur()
                        }}
                      />

                      <Input
                        value={token.status}
                        className="h-8 min-w-[5rem] flex-1"
                        placeholder="Estado"
                        aria-label={`Estado de la ficha ${token.number}`}
                        onFocus={() => {
                          setSelectedTokenNumber(token.number)
                          setSelectedObstacleId(null)
                        }}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          updateToken(token.number, (current) => ({ ...current, status: nextValue }))
                        }}
                      />
                    </div>
                  </section>
                )
                })}
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
