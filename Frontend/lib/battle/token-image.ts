import type { CSSProperties } from "react"

import { getCharacterImagePresentationStyle, type CharacterImageCropKind } from "@/lib/character-image"
import type { BattleToken, Character } from "@/lib/types"

export type BattleTokenImageCrop = {
  focusX: number
  focusY: number
  zoom: number
}

const DEFAULT_TOKEN_IMAGE_CROP: BattleTokenImageCrop = {
  focusX: 50,
  focusY: 50,
  zoom: 1,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeBattleTokenImageCrop(
  input?: Partial<Pick<BattleToken, "imageFocusX" | "imageFocusY" | "imageZoom">> | null,
): BattleTokenImageCrop {
  return {
    focusX: clamp(Number.isFinite(input?.imageFocusX) ? Number(input?.imageFocusX) : DEFAULT_TOKEN_IMAGE_CROP.focusX, 0, 100),
    focusY: clamp(Number.isFinite(input?.imageFocusY) ? Number(input?.imageFocusY) : DEFAULT_TOKEN_IMAGE_CROP.focusY, 0, 100),
    zoom: clamp(Number.isFinite(input?.imageZoom) ? Number(input?.imageZoom) : DEFAULT_TOKEN_IMAGE_CROP.zoom, 1, 3),
  }
}

export function getBattleTokenImagePresentationStyle(
  token: Pick<BattleToken, "imageFocusX" | "imageFocusY" | "imageZoom">,
): CSSProperties {
  const crop = normalizeBattleTokenImageCrop(token)

  return {
    objectPosition: `${crop.focusX}% ${crop.focusY}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.focusX}% ${crop.focusY}%`,
  }
}

type ResolveBattleTokenImagePresentationInput = {
  token: Pick<BattleToken, "image" | "imageFocusX" | "imageFocusY" | "imageZoom">
  linkedCharacter?: Pick<
    Character,
    | "imagen"
    | "tokenImageFocusX"
    | "tokenImageFocusY"
    | "tokenImageZoom"
    | "initiativeImageFocusX"
    | "initiativeImageFocusY"
    | "initiativeImageZoom"
  > | null
  kind: CharacterImageCropKind
}

type BattleTokenImagePresentation = {
  image: string | null
  style?: CSSProperties
  isCustomTokenImage: boolean
}

export function resolveBattleTokenImagePresentation({
  token,
  linkedCharacter = null,
  kind,
}: ResolveBattleTokenImagePresentationInput): BattleTokenImagePresentation {
  const customTokenImage = token.image?.trim() || null
  const characterImage = linkedCharacter?.imagen?.trim() || null
  const displayedImage = customTokenImage || characterImage

  if (!displayedImage) {
    return {
      image: null,
      isCustomTokenImage: false,
    }
  }

  if (customTokenImage) {
    return {
      image: customTokenImage,
      style: getBattleTokenImagePresentationStyle(token),
      isCustomTokenImage: true,
    }
  }

  return {
    image: characterImage,
    style: linkedCharacter ? getCharacterImagePresentationStyle(linkedCharacter, kind) : undefined,
    isCustomTokenImage: false,
  }
}
