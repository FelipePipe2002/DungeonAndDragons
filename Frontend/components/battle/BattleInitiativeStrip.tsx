"use client"

import { useMemo } from "react"

import { getOrderedInitiativeTokens, normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import { resolveBattleTokenImagePresentation } from "@/lib/battle/token-image"
import type { BattleToken, Character } from "@/lib/types"

const MAX_TOKENS_PER_ROW = 16

function getTokenFrameClassName(token: BattleToken, isCurrent: boolean, verticalMirror: boolean) {
  const baseClassName =
    "relative flex h-16 w-[3.25rem] flex-col items-center justify-end p-[3px] transition duration-200 sm:h-[4.35rem] sm:w-[3.55rem]"
  const typeClassName =
    token.type === "enemy"
      ? verticalMirror
        ? "bg-[linear-gradient(0deg,#9f1d1d,#6b1212_48%,#2f0808)] text-white shadow-[inset_0_0_0_1px_#fca5a5,inset_0_0_0_4px_#450a0a,0_0.45rem_0.8rem_rgba(40,5,5,0.28)]"
        : "bg-[linear-gradient(180deg,#9f1d1d,#6b1212_48%,#2f0808)] text-white shadow-[inset_0_0_0_1px_#fca5a5,inset_0_0_0_4px_#450a0a,0_0.45rem_0.8rem_rgba(40,5,5,0.28)]"
      : verticalMirror
        ? "bg-[linear-gradient(0deg,#2563b8,#1d4f96_48%,#172554)] text-white shadow-[inset_0_0_0_1px_#93c5fd,inset_0_0_0_4px_#0f2f63,0_0.45rem_0.8rem_rgba(7,22,54,0.26)]"
        : "bg-[linear-gradient(180deg,#2563b8,#1d4f96_48%,#172554)] text-white shadow-[inset_0_0_0_1px_#93c5fd,inset_0_0_0_4px_#0f2f63,0_0.45rem_0.8rem_rgba(7,22,54,0.26)]"
  const currentClassName = isCurrent
    ? " scale-[1.08] ring-2 ring-amber-200/85 shadow-[0_0_0_1px_rgba(250,204,21,0.55),0_0.9rem_1.4rem_rgba(0,0,0,0.4)]"
    : ""

  return `${baseClassName} ${typeClassName}${currentClassName}`
}

function getTokenPortraitClassName(token: BattleToken, isCurrent: boolean, verticalMirror: boolean) {
  const baseClassName = "absolute inset-[3px]"
  const typeClassName =
    token.type === "enemy"
      ? verticalMirror
        ? "bg-[linear-gradient(0deg,#7f1d1d,#450a0a_52%,#1c0505)] shadow-[inset_0_0_0_1px_#fecaca,inset_0_0_0_3px_#3f0a0a]"
        : "bg-[linear-gradient(180deg,#7f1d1d,#450a0a_52%,#1c0505)] shadow-[inset_0_0_0_1px_#fecaca,inset_0_0_0_3px_#3f0a0a]"
      : verticalMirror
        ? "bg-[linear-gradient(0deg,#1d4ed8,#173a8a_52%,#0f172a)] shadow-[inset_0_0_0_1px_#dbeafe,inset_0_0_0_3px_#102a60]"
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
  verticalMirror?: boolean
  onRequestCharacterCropEdit?: (characterId: number) => void
}

export function BattleInitiativeStrip({
  tokens,
  characterById,
  currentTurnTokenNumber,
  verticalMirror = false,
  onRequestCharacterCropEdit,
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
    () =>
      typeof currentTurnTokenNumber === "number"
        ? normalizeCurrentTurnTokenNumber(orderedTokens, currentTurnTokenNumber)
        : null,
    [currentTurnTokenNumber, orderedTokens],
  )
  const displayedTokenRows = useMemo(
    () => (verticalMirror ? [...tokenRows].reverse().map((row) => [...row].reverse()) : tokenRows),
    [tokenRows, verticalMirror],
  )

  if (orderedTokens.length === 0) {
    return (
      <div className="w-full px-4 py-1 text-center text-xs font-semibold text-amber-100">
        Sin fichas en iniciativa.
      </div>
    )
  }

  return (
    <div className="w-full px-1 py-1 text-amber-50">
      <div className="space-y-2 px-0.5 pb-1 pt-1">
        {displayedTokenRows.map((row, rowIndex) => (
          <div key={`initiative-row-${rowIndex}`} className="flex items-start justify-center gap-x-1.5">
            {row.map((token) => {
              const isCurrent = token.number === normalizedCurrentTurnTokenNumber
              const isDefeated = typeof token.life === "number" && token.life <= 0
              const linkedCharacter =
                typeof token.characterId === "number" ? characterById?.get(token.characterId) ?? null : null
              const tokenImagePresentation = resolveBattleTokenImagePresentation({
                token,
                linkedCharacter,
                kind: "initiative",
              })
              const displayedImage = tokenImagePresentation.image
              const shouldShowCharacterImage = Boolean(displayedImage)
              const shouldShowMonsterNumberBadge = token.sourceType === "monster"
              const shouldShowCharacterName = token.type === "player" && Boolean(linkedCharacter) && !shouldShowCharacterImage
              const tokenImagePresentationStyle = tokenImagePresentation.style

              return (
                <div key={token.number} className="flex shrink-0 flex-col items-center gap-1">
                  <div
                    className={getTokenFrameClassName(token, isCurrent, verticalMirror)}
                    onClick={(event) => {
                      if (!event.shiftKey || tokenImagePresentation.isCustomTokenImage || !linkedCharacter?.imagen || !onRequestCharacterCropEdit) {
                        return
                      }

                      event.preventDefault()
                      event.stopPropagation()
                      onRequestCharacterCropEdit(linkedCharacter.id)
                    }}
                    title={
                      !tokenImagePresentation.isCustomTokenImage && linkedCharacter?.imagen && onRequestCharacterCropEdit
                        ? "Shift + click para ajustar el encuadre"
                        : undefined
                    }
                  >
                    <div className={getTokenPortraitClassName(token, isCurrent, verticalMirror)} aria-hidden="true" />
                    {shouldShowCharacterImage ? (
                      <span
                        className="absolute inset-[3px] z-10 overflow-hidden"
                        style={verticalMirror ? { transform: "scale(-1)", transformOrigin: "center" } : undefined}
                      >
                        <img
                          src={displayedImage ?? undefined}
                          alt={linkedCharacter?.nombre ?? token.nombre}
                          className={`absolute inset-[0] size-full object-cover ${isDefeated ? "grayscale brightness-75 saturate-0" : ""}`}
                          style={tokenImagePresentationStyle}
                          draggable={false}
                        />
                        {isDefeated ? (
                          <span className="absolute inset-0 bg-stone-900/30" aria-hidden="true" />
                        ) : null}
                      </span>
                    ) : (
                      <div className={getTokenImageNumberClassName(token, isCurrent)}>{token.number}</div>
                    )}
                    {shouldShowMonsterNumberBadge ? (
                      <span
                        className={`pointer-events-none absolute left-1/2 z-20 inline-flex min-w-[0.95rem] -translate-x-1/2 items-center justify-center rounded-full border border-black/70 bg-black/75 px-1 text-[0.58rem] font-bold leading-none text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] ${
                          verticalMirror ? "top-[-0.36rem]" : "bottom-[-0.36rem]"
                        }`}
                      >
                        {token.number}
                      </span>
                    ) : null}
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
                          {verticalMirror ? "▲" : "▼"}
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
  )
}
