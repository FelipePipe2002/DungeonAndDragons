"use client"

import { useMemo } from "react"
import { AlertCircle, Check, LoaderCircle } from "lucide-react"

import { getOrderedInitiativeTokens, normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import type { BattleState, Character } from "@/lib/types"

type BattleStatusBannerProps = {
  battle: BattleState | null
  characterById?: Map<number, Character>
  variant?: "dm" | "presentation"
  landmarkLabel?: string | null
  modeLabel?: string | null
  isSaving?: boolean
  error?: string | null
}

function getTrimmedText(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveTurnLabel(battle: BattleState | null, characterById?: Map<number, Character>) {
  if (!battle) {
    return null
  }

  const orderedTokens = getOrderedInitiativeTokens(battle.tokens)
  const currentTurnTokenNumber = normalizeCurrentTurnTokenNumber(battle.tokens, battle.currentTurnTokenNumber ?? null)
  const currentToken = orderedTokens.find((token) => token.number === currentTurnTokenNumber) ?? null

  if (!currentToken) {
    return null
  }

  if (typeof currentToken.characterId === "number") {
    const linkedCharacter = characterById?.get(currentToken.characterId)
    const linkedCharacterName = getTrimmedText(linkedCharacter?.nombre)
    if (linkedCharacterName) {
      return linkedCharacterName
    }
  }

  return getTrimmedText(currentToken.nombre) ?? `Ficha #${currentToken.number}`
}

export function BattleStatusBanner({
  battle,
  characterById,
  variant = "dm",
  landmarkLabel = null,
  modeLabel = null,
  isSaving = false,
  error = null,
}: BattleStatusBannerProps) {
  const turnLabel = useMemo(() => resolveTurnLabel(battle, characterById), [battle, characterById])
  const saveStateIcon = error
    ? <AlertCircle className="size-3.5" />
    : isSaving
      ? <LoaderCircle className="size-3.5 animate-spin" />
      : battle
        ? <Check className="size-3.5" />
        : null
  const saveStateClassName = error
    ? "bg-red-100 text-red-700"
    : isSaving
      ? "bg-amber-100 text-amber-900"
      : "bg-emerald-100 text-emerald-800"
  const saveStateTitle = error
    ? error
    : isSaving
      ? "Guardando en backend"
      : battle
        ? "Guardado en backend"
        : null

  if (variant === "presentation") {
    if (!battle) {
      return null
    }

    return (
      <div className="mx-auto inline-flex max-w-[min(36rem,calc(100vw-1.5rem))] flex-col items-center gap-2 rounded-[1.5rem] border border-amber-200/18 bg-black/60 px-5 py-4 text-amber-50 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
          <span>{battle.title}</span>
          <span className="rounded-full border border-amber-200/20 bg-amber-100/10 px-2 py-1 text-[0.62rem] tracking-[0.14em]">
            Ronda {battle.roundNumber}
          </span>
          <span
            className={`rounded-full px-2 py-1 text-[0.62rem] tracking-[0.14em] ${
              battle.status === "active"
                ? "border border-emerald-200/20 bg-emerald-100/10 text-emerald-100"
                : "border border-stone-200/20 bg-stone-100/10 text-stone-100"
            }`}
          >
            {battle.status === "active" ? "En juego" : "Terminada"}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-amber-100/65">
            Turno actual
          </p>
          <p className="mt-1 text-balance text-[clamp(1.3rem,2.8vw,2.4rem)] font-black leading-none text-amber-50">
            {turnLabel ?? "Sin iniciativa"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="inline-flex max-w-[min(92vw,56rem)] flex-wrap items-center justify-center gap-2 rounded-full border border-stone-900/12 bg-white/92 px-3 py-2 text-[11px] font-semibold text-stone-800 shadow-[0_0.75rem_1.75rem_rgba(41,37,36,0.18)] backdrop-blur-md">
      <span className="rounded-full bg-stone-900/6 px-2.5 py-1">{battle ? `Ronda ${battle.roundNumber}` : "Sin batalla"}</span>
      <span className="max-w-[min(42vw,20rem)] truncate rounded-full bg-stone-900/6 px-2.5 py-1">
        {battle ? `Turno: ${turnLabel ?? "Sin iniciativa"}` : landmarkLabel ? `Mapa: ${landmarkLabel}` : "Abrí el centro de batalla"}
      </span>
      {modeLabel ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">{modeLabel}</span> : null}
      {battle?.title ? <span className="max-w-[min(36vw,16rem)] truncate text-stone-500">{battle.title}</span> : null}
      {saveStateIcon ? (
        <span className={`rounded-full px-2.5 py-1 ${saveStateClassName}`} title={saveStateTitle ?? undefined}>
          {saveStateIcon}
        </span>
      ) : null}
    </div>
  )
}
