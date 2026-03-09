import type { CSSProperties } from "react"

import type { Character } from "@/lib/types"

export type CharacterImageCropKind = "token" | "initiative"

export type CharacterImageCrop = {
  focusX: number
  focusY: number
  zoom: number
}

const DEFAULT_CROP: CharacterImageCrop = {
  focusX: 50,
  focusY: 50,
  zoom: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeCharacterImageCrop(input?: Partial<CharacterImageCrop> | null): CharacterImageCrop {
  return {
    focusX: clamp(Number.isFinite(input?.focusX) ? Number(input?.focusX) : DEFAULT_CROP.focusX, 0, 100),
    focusY: clamp(Number.isFinite(input?.focusY) ? Number(input?.focusY) : DEFAULT_CROP.focusY, 0, 100),
    zoom: clamp(Number.isFinite(input?.zoom) ? Number(input?.zoom) : DEFAULT_CROP.zoom, 1, 3),
  }
}

export function getCharacterImageCrop(
  character: Pick<
    Character,
    | "tokenImageFocusX"
    | "tokenImageFocusY"
    | "tokenImageZoom"
    | "initiativeImageFocusX"
    | "initiativeImageFocusY"
    | "initiativeImageZoom"
  >,
  kind: CharacterImageCropKind,
): CharacterImageCrop {
  if (kind === "token") {
    return normalizeCharacterImageCrop({
      focusX: character.tokenImageFocusX,
      focusY: character.tokenImageFocusY,
      zoom: character.tokenImageZoom,
    })
  }

  return normalizeCharacterImageCrop({
    focusX: character.initiativeImageFocusX,
    focusY: character.initiativeImageFocusY,
    zoom: character.initiativeImageZoom,
  })
}

export function getCharacterImagePresentationStyle(
  character: Pick<
    Character,
    | "tokenImageFocusX"
    | "tokenImageFocusY"
    | "tokenImageZoom"
    | "initiativeImageFocusX"
    | "initiativeImageFocusY"
    | "initiativeImageZoom"
  >,
  kind: CharacterImageCropKind,
): CSSProperties {
  const crop = getCharacterImageCrop(character, kind)

  return {
    objectPosition: `${crop.focusX}% ${crop.focusY}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.focusX}% ${crop.focusY}%`,
  }
}
