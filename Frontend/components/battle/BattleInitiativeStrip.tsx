"use client"

import { useMemo } from "react"

import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getOrderedInitiativeTokens, normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import type { BattleToken, Character } from "@/lib/types"

const MAX_TOKENS_PER_ROW = 12

function getTokenFrameClassName(token: BattleToken, isCurrent: boolean) {
  const baseClassName =
    "relative flex h-16 w-[3.25rem] flex-col items-center justify-end p-[3px] transition duration-200 sm:h-[4.35rem] sm:w-[3.55rem]"
  const typeClassName =
    token.type === "enemy"
      ? "bg-[linear-gradient(180deg,#9f1d1d,#6b1212_48%,#2f0808)] text-white shadow-[inset_0_0_0_1px_#fca5a5,inset_0_0_0_4px_#450a0a,0_0.45rem_0.8rem_rgba(40,5,5,0.28)]"
      : "bg-[linear-gradient(180deg,#2563b8,#1d4f96_48%,#172554)] text-white shadow-[inset_0_0_0_1px_#93c5fd,inset_0_0_0_4px_#0f2f63,0_0.45rem_0.8rem_rgba(7,22,54,0.26)]"
  const currentClassName = isCurrent
    ? " scale-[1.08] ring-2 ring-amber-200/85 shadow-[0_0_0_1px_rgba(250,204,21,0.55),0_0.9rem_1.4rem_rgba(0,0,0,0.4)]"
    : ""

  return `${baseClassName} ${typeClassName}${currentClassName}`
}

function getTokenPortraitClassName(token: BattleToken, isCurrent: boolean) {
  const baseClassName = "absolute inset-[3px]"
  const typeClassName =
    token.type === "enemy"
      ? "bg-[linear-gradient(180deg,#7f1d1d,#450a0a_52%,#1c0505)] shadow-[inset_0_0_0_1px_#fecaca,inset_0_0_0_3px_#3f0a0a]"
      : "bg-[linear-gradient(180deg,#1d4ed8,#173a8a_52%,#0f172a)] shadow-[inset_0_0_0_1px_#dbeafe,inset_0_0_0_3px_#102a60]"
  const currentClassName = isCurrent ? " brightness-110 saturate-110" : ""

  return `${baseClassName} ${typeClassName}${currentClassName}`
}

function getTokenImageNumberClassName(token: BattleToken, isCurrent: boolean) {
  const baseClassName =
    "pointer-events-none absolute inset-[3px] z-10 flex items-center justify-center text-[1.3rem] font-black leading-none sm:text-[1.55rem]"
  const typeClassName =
    token.type === "enemy"
      ? "text-red-50 [text-shadow:0_1px_0_#2f0808,0_0_12px_rgba(254,242,242,0.12)]"
      : "text-sky-50 [text-shadow:0_1px_0_#0f2f63,0_0_12px_rgba(224,242,254,0.12)]"
  const currentClassName = isCurrent ? " scale-105" : ""

  return `${baseClassName} ${typeClassName}${currentClassName}`
}

type BattleInitiativeStripProps = {
  tokens: BattleToken[]
  characterById?: Map<number, Character>
  currentTurnTokenNumber: number | null
  interactive?: boolean
  onAdvanceTurn?: () => void
}

export function BattleInitiativeStrip({
  tokens,
  characterById,
  currentTurnTokenNumber,
  interactive = false,
  onAdvanceTurn,
}: BattleInitiativeStripProps) {
  const orderedTokens = useMemo(() => getOrderedInitiativeTokens(tokens), [tokens])
  const tokenRows = useMemo(() => {
    const rows: BattleToken[][] = []

    for (let index = 0; index < orderedTokens.length; index += MAX_TOKENS_PER_ROW) {
      rows.push(orderedTokens.slice(index, index + MAX_TOKENS_PER_ROW))
    }

    return rows
  }, [orderedTokens])
  const normalizedCurrentTurnTokenNumber = useMemo(
    () => normalizeCurrentTurnTokenNumber(orderedTokens, currentTurnTokenNumber),
    [currentTurnTokenNumber, orderedTokens],
  )
  const canAdvance = interactive && typeof onAdvanceTurn === "function" && orderedTokens.length > 0

  if (orderedTokens.length === 0) {
    return (
      <div className="w-full px-4 py-1 text-center text-xs font-semibold text-amber-100">
        Sin fichas en iniciativa.
      </div>
    )
  }

  return (
    <div className="w-full px-1 py-1 text-amber-50">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="space-y-2 px-0.5 pb-1 pt-1">
            {tokenRows.map((row, rowIndex) => (
              <div key={`initiative-row-${rowIndex}`} className="flex items-start justify-center gap-x-1.5">
                {row.map((token) => {
                  const isCurrent = token.number === normalizedCurrentTurnTokenNumber
                  const linkedCharacter =
                    typeof token.characterId === "number" ? characterById?.get(token.characterId) ?? null : null
                  const shouldShowCharacterImage = Boolean(linkedCharacter?.imagen)
                  const shouldShowCharacterName = token.type === "player" && Boolean(linkedCharacter) && !shouldShowCharacterImage

                  return (
                    <div key={token.number} className="flex shrink-0 flex-col items-center gap-1">
                      <div className={getTokenFrameClassName(token, isCurrent)}>
                        <div className={getTokenPortraitClassName(token, isCurrent)} aria-hidden="true" />
                        {shouldShowCharacterImage ? (
                          <span className="absolute inset-[3px] z-10 overflow-hidden">
                            <img
                              src={linkedCharacter?.imagen}
                              alt={linkedCharacter?.nombre ?? token.nombre}
                              className="size-full object-cover"
                              draggable={false}
                            />
                          </span>
                        ) : (
                          <div className={getTokenImageNumberClassName(token, isCurrent)}>{token.number}</div>
                        )}
                      </div>
                      <div className="flex min-h-7 max-w-[4.6rem] flex-col items-center justify-start">
                        {shouldShowCharacterName ? (
                          <span className="line-clamp-2 text-center text-[0.58rem] font-semibold leading-tight text-amber-100 sm:text-[0.62rem]">
                            {linkedCharacter?.nombre}
                          </span>
                        ) : null}
                        {isCurrent ? (
                          <div className="flex flex-col items-center gap-0.5" aria-hidden="true">
                            <span className="block h-1 w-8 rounded-full bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.42)]" />
                            <span className="text-[0.82rem] leading-none text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.4)]">
                              ▼
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {canAdvance ? (
          <Button
            type="button"
            size="sm"
            className="mb-2 rounded-full border border-amber-200/25 bg-[linear-gradient(180deg,rgba(217,119,6,0.92),rgba(146,64,14,0.95))] px-3 text-amber-50 shadow-[0_0.55rem_1rem_rgba(120,53,15,0.35)] hover:bg-[linear-gradient(180deg,rgba(245,158,11,0.94),rgba(180,83,9,0.96))]"
            onClick={onAdvanceTurn}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
