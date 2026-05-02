import { normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import { normalizeBattleConditionStatus } from "@/lib/battle/conditions"
import { normalizeBestiaryLocalImagePath } from "@/lib/monster/utils"
import { backendRequest } from "@/lib/services/backend-api.service"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import type {
  BattleCenterHistory,
  BattleDungeonFogState,
  BattleFogReveal,
  BattleObstacle,
  BattleObstacleShape,
  BattleSceneType,
  BattleState,
  BattleStatus,
  BattleSummary,
  BattleToken,
  BattleTokenSourceType,
  BattleTokenType,
} from "@/lib/types"

type BattleTokenDto = {
  number?: number | null
  nombre?: string | null
  characterId?: number | null
  sourceType?: string | null
  sourceRef?: string | null
  image?: string | null
  imageAssetId?: number | null
  imageFocusX?: number | null
  imageFocusY?: number | null
  imageZoom?: number | null
  type?: string | null
  x?: number | null
  y?: number | null
  initiative?: number | null
  life?: number | null
  size?: number | null
  status?: string | null
  statusDurationTurns?: number | null
  hidden?: boolean | null
}

type BattleObstacleDto = {
  id?: number | null
  shape?: string | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  color?: string | null
}

type BattleFogRevealDto = {
  id?: number | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
}

type BattleDungeonFogStateDto = {
  enabled?: boolean | null
  exploredCellKeys?: string[] | null
  playerVisionBrightRadiusCells?: number | null
  playerVisionDimRadiusCells?: number | null
}

type BattleStateDto = {
  id?: number | null
  slug?: string | null
  landmarkSlug?: string | null
  sceneType?: string | null
  sceneSlug?: string | null
  parentLandmarkSlug?: string | null
  title?: string | null
  status?: string | null
  roundNumber?: number | null
  dmNotes?: string | null
  nextTokenNumber?: number | null
  currentTurnTokenNumber?: number | null
  tokens?: BattleTokenDto[] | null
  nextObstacleId?: number | null
  obstacles?: BattleObstacleDto[] | null
  fogEnabled?: boolean | null
  nextFogRevealId?: number | null
  fogReveals?: BattleFogRevealDto[] | null
  dungeonFog?: BattleDungeonFogStateDto | null
  createdAt?: string | null
  updatedAt?: string | null
  endedAt?: string | null
}

type BattleSummaryDto = {
  id?: number | null
  slug?: string | null
  landmarkSlug?: string | null
  sceneType?: string | null
  sceneSlug?: string | null
  parentLandmarkSlug?: string | null
  title?: string | null
  status?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  endedAt?: string | null
  tokenCount?: number | null
  obstacleCount?: number | null
}

type BattleCenterHistoryDto = {
  activeBattles?: BattleSummaryDto[] | null
  finishedBattles?: BattleSummaryDto[] | null
  page?: number | null
  pageSize?: number | null
  totalFinishedBattles?: number | null
  totalFinishedPages?: number | null
  hasPreviousPage?: boolean | null
  hasNextPage?: boolean | null
}

type UpdateBattlePayload = {
  title: string
  roundNumber: number
  dmNotes: string | null
  nextTokenNumber: number
  currentTurnTokenNumber: number | null
  tokens: Array<{
    number: number
    nombre: string
    characterId: number | null
    sourceType: BattleTokenSourceType | null
    sourceRef: string | null
    image: string | null
    imageAssetId: number | null
    imageFocusX: number | null
    imageFocusY: number | null
    imageZoom: number | null
    type: BattleTokenType
    x: number
    y: number
    initiative: number | null
    life: number | null
    size: number | null
    status: string | null
    statusDurationTurns: number | null
    hidden: boolean | null
  }>
  nextObstacleId: number
  obstacles: Array<{
    id: number
    shape: BattleObstacleShape
    x: number
    y: number
    width: number
    height: number
    color: string | null
  }>
  fogEnabled: boolean
  nextFogRevealId: number
  fogReveals: Array<{
    id: number
    x: number
    y: number
    width: number
    height: number
  }>
  dungeonFog: BattleDungeonFogState
}

type CreateBattleInput =
  | string
  | {
      sceneType: BattleSceneType
      sceneSlug: string
      parentLandmarkSlug: string
    }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampTokenSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.round(value * 100) / 100
}

function clampTokenImageZoom(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.round(clamp(value, 1, 3) * 100) / 100
}

function clampObstacleDimension(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.round(clamp(value, 0, 100) * 100) / 100
}

function clampFogRevealDimension(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.round(clamp(value, 0.1, 100) * 100) / 100
}

function toOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeDateText(value: string | null | undefined) {
  return toOptionalText(value)
}

function normalizeBattleTitle(value: string | null | undefined, sceneSlug: string) {
  return toOptionalText(value) ?? `Batalla en ${sceneSlug || "mapa"}`
}

function resolveLegacyBattleSceneSlug(input: { sceneSlug?: string | null; landmarkSlug?: string | null }) {
  return toOptionalText(input.sceneSlug) ?? toOptionalText(input.landmarkSlug) ?? ""
}

function resolveLegacyBattleParentLandmarkSlug(input: {
  parentLandmarkSlug?: string | null
  landmarkSlug?: string | null
  sceneSlug?: string | null
}) {
  return toOptionalText(input.parentLandmarkSlug) ?? toOptionalText(input.landmarkSlug) ?? resolveLegacyBattleSceneSlug(input)
}

function normalizeRoundNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return 1
  }

  return Math.trunc(value)
}

function normalizeStatus(value: unknown): BattleStatus {
  return value === "finished" ? "finished" : "active"
}

function normalizeSceneType(value: unknown): BattleSceneType {
  return value === "building" ? "building" : "landmark"
}

function isBattleTokenType(value: unknown): value is BattleTokenType {
  return value === "enemy" || value === "player"
}

function isBattleTokenSourceType(value: unknown): value is BattleTokenSourceType {
  return value === "character" || value === "monster" || value === "manual"
}

function isBattleObstacleShape(value: unknown): value is BattleObstacleShape {
  return value === "circle" || value === "rectangle"
}

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const trimmed = toOptionalText(value)?.toLowerCase()
  if (!trimmed) {
    return fallback
  }

  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : fallback
}

function normalizeToken(dto: BattleTokenDto): BattleToken {
  const number =
    typeof dto.number === "number" && Number.isFinite(dto.number) && dto.number > 0 ? Math.trunc(dto.number) : 1
  const type = isBattleTokenType(dto.type) ? dto.type : "enemy"
  const characterId =
    typeof dto.characterId === "number" && Number.isFinite(dto.characterId) && dto.characterId > 0
      ? Math.trunc(dto.characterId)
      : undefined
  const explicitSourceType = isBattleTokenSourceType(dto.sourceType) ? dto.sourceType : undefined
  const explicitSourceRef = toOptionalText(dto.sourceRef)
  const sourceType = characterId ? "character" : explicitSourceType ?? "manual"
  const sourceRef = characterId ? String(characterId) : explicitSourceRef ?? undefined
  const normalizedImageText = toOptionalText(dto.image)

  return {
    number,
    nombre: toOptionalText(dto.nombre) ?? `${type === "player" ? "Jugador" : "Enemigo"} ${number}`,
    characterId,
    sourceType,
    sourceRef,
    imageAssetId:
      typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
        ? Math.trunc(dto.imageAssetId)
        : undefined,
    image:
      typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
        ? buildAssetUrl(Math.trunc(dto.imageAssetId))
        : normalizedImageText
          ? normalizeBestiaryLocalImagePath(normalizedImageText)
          : undefined,
    imageFocusX:
      typeof dto.imageFocusX === "number" && Number.isFinite(dto.imageFocusX) ? clamp(dto.imageFocusX, 0, 100) : 50,
    imageFocusY:
      typeof dto.imageFocusY === "number" && Number.isFinite(dto.imageFocusY) ? clamp(dto.imageFocusY, 0, 100) : 50,
    imageZoom: clampTokenImageZoom(dto.imageZoom),
    type,
    x: typeof dto.x === "number" && Number.isFinite(dto.x) ? clamp(dto.x, 0, 100) : 50,
    y: typeof dto.y === "number" && Number.isFinite(dto.y) ? clamp(dto.y, 0, 100) : 50,
    initiative:
      typeof dto.initiative === "number" && Number.isFinite(dto.initiative) ? Math.trunc(dto.initiative) : undefined,
    life: typeof dto.life === "number" && Number.isFinite(dto.life) ? Math.trunc(dto.life) : undefined,
    size: clampTokenSize(dto.size),
    status: normalizeBattleConditionStatus(dto.status),
    statusDurationTurns:
      normalizeBattleConditionStatus(dto.status) &&
      typeof dto.statusDurationTurns === "number" &&
      Number.isFinite(dto.statusDurationTurns) &&
      dto.statusDurationTurns >= 0
        ? Math.trunc(dto.statusDurationTurns)
        : undefined,
    hidden: Boolean(dto.hidden),
  }
}

function normalizeObstacle(dto: BattleObstacleDto): BattleObstacle {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) && dto.id > 0 ? Math.trunc(dto.id) : 1
  const shape = isBattleObstacleShape(dto.shape) ? dto.shape : "rectangle"
  const width = clampObstacleDimension(dto.width, shape === "circle" ? 8 : 14)
  const height = shape === "circle" ? width : clampObstacleDimension(dto.height, 8)

  return {
    id,
    shape,
    x: typeof dto.x === "number" && Number.isFinite(dto.x) ? clamp(dto.x, 0, 100) : 50,
    y: typeof dto.y === "number" && Number.isFinite(dto.y) ? clamp(dto.y, 0, 100) : 50,
    width,
    height,
    color: normalizeHexColor(dto.color, shape === "circle" ? "#f59e0b" : "#0f766e"),
  }
}

function normalizeFogReveal(dto: BattleFogRevealDto): BattleFogReveal {
  const width = clampFogRevealDimension(dto.width, 12)
  const height = clampFogRevealDimension(dto.height, 12)
  const x = typeof dto.x === "number" && Number.isFinite(dto.x) ? clamp(dto.x, 0, 100 - width) : 44
  const y = typeof dto.y === "number" && Number.isFinite(dto.y) ? clamp(dto.y, 0, 100 - height) : 44

  return {
    id: typeof dto.id === "number" && Number.isFinite(dto.id) && dto.id > 0 ? Math.trunc(dto.id) : 1,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width,
    height,
  }
}

function normalizeDungeonFogRadius(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Math.round(clamp(fallback, min, max))
  }

  return Math.round(clamp(value, min, max))
}

function normalizeDungeonFogState(dto: BattleDungeonFogStateDto | null | undefined): BattleDungeonFogState {
  const brightRadius = normalizeDungeonFogRadius(dto?.playerVisionBrightRadiusCells, 4, 0, 64)
  const dimRadius = normalizeDungeonFogRadius(dto?.playerVisionDimRadiusCells, 8, brightRadius, 128)
  const exploredCellKeys = Array.isArray(dto?.exploredCellKeys)
    ? Array.from(
        new Set(
          dto.exploredCellKeys
            .filter((key): key is string => typeof key === "string")
            .map((key) => key.trim())
            .filter((key) => /^-?\d+,-?\d+$/.test(key)),
        ),
      ).sort((left, right) => left.localeCompare(right))
    : []

  return {
    enabled: Boolean(dto?.enabled),
    exploredCellKeys,
    playerVisionBrightRadiusCells: brightRadius,
    playerVisionDimRadiusCells: dimRadius,
  }
}

function compactBattleTokenNumbers(tokens: BattleToken[], currentTurnTokenNumber?: number | null) {
  const sortedTokens = [...tokens].sort((left, right) => left.number - right.number)
  const normalizedCurrentTurn =
    typeof currentTurnTokenNumber === "number" && Number.isFinite(currentTurnTokenNumber) && currentTurnTokenNumber > 0
      ? Math.trunc(currentTurnTokenNumber)
      : null

  let mappedCurrentTurnTokenNumber: number | null = null
  const compactedTokens = sortedTokens.map((token, index) => {
    const nextNumber = index + 1
    if (normalizedCurrentTurn !== null && mappedCurrentTurnTokenNumber === null && token.number === normalizedCurrentTurn) {
      mappedCurrentTurnTokenNumber = nextNumber
    }

    if (token.number === nextNumber) {
      return token
    }

    return {
      ...token,
      number: nextNumber,
    }
  })

  return {
    tokens: compactedTokens,
    currentTurnTokenNumber: mappedCurrentTurnTokenNumber,
  }
}

function normalizeState(dto: BattleStateDto): BattleState {
  const tokens = Array.isArray(dto.tokens) ? dto.tokens.map(normalizeToken) : []
  const compactedTokens = compactBattleTokenNumbers(tokens, dto.currentTurnTokenNumber ?? null)
  const obstacles = Array.isArray(dto.obstacles) ? dto.obstacles.map(normalizeObstacle) : []
  const fogReveals = Array.isArray(dto.fogReveals) ? dto.fogReveals.map(normalizeFogReveal) : []
  const dungeonFog = normalizeDungeonFogState(dto.dungeonFog)
  const sceneSlug = resolveLegacyBattleSceneSlug(dto)
  const parentLandmarkSlug = resolveLegacyBattleParentLandmarkSlug(dto)
  const sortedObstacles = obstacles.sort((a, b) => a.id - b.id)
  const minNextTokenNumber = compactedTokens.tokens.length + 1
  const nextObstacleId =
    typeof dto.nextObstacleId === "number" && Number.isFinite(dto.nextObstacleId) && dto.nextObstacleId > 0
      ? Math.trunc(dto.nextObstacleId)
      : 1
  const minNextObstacleId = Math.max(
    nextObstacleId,
    obstacles.reduce((max, obstacle) => Math.max(max, obstacle.id + 1), 1),
  )
  const nextFogRevealId =
    typeof dto.nextFogRevealId === "number" && Number.isFinite(dto.nextFogRevealId) && dto.nextFogRevealId > 0
      ? Math.trunc(dto.nextFogRevealId)
      : 1
  const sortedFogReveals = fogReveals.sort((a, b) => a.id - b.id)
  const minNextFogRevealId = Math.max(
    nextFogRevealId,
    sortedFogReveals.reduce((max, reveal) => Math.max(max, reveal.id + 1), 1),
  )

  return {
    id: typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : undefined,
    slug: toOptionalText(dto.slug) ?? "battle",
    landmarkSlug: parentLandmarkSlug,
    sceneType: normalizeSceneType(dto.sceneType),
    sceneSlug,
    parentLandmarkSlug,
    title: normalizeBattleTitle(dto.title, sceneSlug),
    status: normalizeStatus(dto.status),
    roundNumber: normalizeRoundNumber(dto.roundNumber),
    dmNotes: toOptionalText(dto.dmNotes) ?? "",
    nextTokenNumber: minNextTokenNumber,
    nextObstacleId: minNextObstacleId,
    fogEnabled: Boolean(dto.fogEnabled),
    nextFogRevealId: minNextFogRevealId,
    dungeonFog,
    currentTurnTokenNumber: normalizeCurrentTurnTokenNumber(
      compactedTokens.tokens,
      compactedTokens.currentTurnTokenNumber ?? dto.currentTurnTokenNumber ?? null,
    ),
    tokens: compactedTokens.tokens,
    obstacles: sortedObstacles,
    fogReveals: sortedFogReveals,
    createdAt: normalizeDateText(dto.createdAt),
    updatedAt: normalizeDateText(dto.updatedAt),
    endedAt: normalizeDateText(dto.endedAt),
  }
}

function normalizeSummary(dto: BattleSummaryDto): BattleSummary {
  const sceneSlug = resolveLegacyBattleSceneSlug(dto)
  const parentLandmarkSlug = resolveLegacyBattleParentLandmarkSlug(dto)

  return {
    id: typeof dto.id === "number" && Number.isFinite(dto.id) ? Math.trunc(dto.id) : 0,
    slug: toOptionalText(dto.slug) ?? "battle",
    landmarkSlug: parentLandmarkSlug,
    sceneType: normalizeSceneType(dto.sceneType),
    sceneSlug,
    parentLandmarkSlug,
    title: normalizeBattleTitle(dto.title, sceneSlug),
    status: normalizeStatus(dto.status),
    createdAt: normalizeDateText(dto.createdAt),
    updatedAt: normalizeDateText(dto.updatedAt),
    endedAt: normalizeDateText(dto.endedAt),
    tokenCount:
      typeof dto.tokenCount === "number" && Number.isFinite(dto.tokenCount) && dto.tokenCount >= 0
        ? Math.trunc(dto.tokenCount)
        : 0,
    obstacleCount:
      typeof dto.obstacleCount === "number" && Number.isFinite(dto.obstacleCount) && dto.obstacleCount >= 0
        ? Math.trunc(dto.obstacleCount)
        : 0,
  }
}

export function sanitizeBattleState(input: BattleStateDto | Partial<BattleState> | null | undefined): BattleState | null {
  if (!input || typeof input !== "object") {
    return null
  }

  return normalizeState(input as BattleStateDto)
}

function toPayload(input: BattleState): UpdateBattlePayload {
  const titleSceneSlug = toOptionalText(input.sceneSlug) ?? toOptionalText(input.landmarkSlug) ?? ""
  const tokens = Array.isArray(input.tokens) ? input.tokens : []
  const compactedTokens = compactBattleTokenNumbers(tokens, input.currentTurnTokenNumber ?? null)
  const obstacles = Array.isArray(input.obstacles) ? input.obstacles : []
  const fogReveals = Array.isArray(input.fogReveals) ? input.fogReveals : []
  const dungeonFog = normalizeDungeonFogState(input.dungeonFog)
  const normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(
    compactedTokens.tokens,
    compactedTokens.currentTurnTokenNumber ?? input.currentTurnTokenNumber ?? null,
  )

  return {
    title: normalizeBattleTitle(input.title, titleSceneSlug),
    roundNumber: normalizeRoundNumber(input.roundNumber),
    dmNotes: toOptionalText(input.dmNotes) ?? null,
    nextTokenNumber: compactedTokens.tokens.length + 1,
    currentTurnTokenNumber: normalizedCurrentTurnTokenNumber,
    tokens: compactedTokens.tokens.map((token, index) => {
      const type = isBattleTokenType(token.type) ? token.type : "enemy"
      const number =
        typeof token.number === "number" && Number.isFinite(token.number) && token.number > 0
          ? Math.max(1, Math.trunc(token.number))
          : index + 1

      return {
        number,
        nombre: toOptionalText(token.nombre) ?? `${type === "player" ? "Jugador" : "Enemigo"} ${number}`,
        characterId:
          typeof token.characterId === "number" && Number.isFinite(token.characterId) && token.characterId > 0
            ? Math.trunc(token.characterId)
            : null,
        sourceType:
          typeof token.characterId === "number" && Number.isFinite(token.characterId) && token.characterId > 0
            ? "character"
            : isBattleTokenSourceType(token.sourceType)
              ? token.sourceType
              : "manual",
        sourceRef:
          typeof token.characterId === "number" && Number.isFinite(token.characterId) && token.characterId > 0
            ? String(Math.trunc(token.characterId))
            : toOptionalText(token.sourceRef) ?? null,
        image:
          typeof token.imageAssetId === "number" && Number.isFinite(token.imageAssetId) && token.imageAssetId > 0
            ? null
            : (() => {
                const normalizedImageText = toOptionalText(token.image)
                return normalizedImageText ? normalizeBestiaryLocalImagePath(normalizedImageText) : null
              })(),
        imageAssetId:
          typeof token.imageAssetId === "number" && Number.isFinite(token.imageAssetId) && token.imageAssetId > 0
            ? Math.trunc(token.imageAssetId)
            : null,
        imageFocusX:
          typeof token.imageFocusX === "number" && Number.isFinite(token.imageFocusX) ? clamp(token.imageFocusX, 0, 100) : 50,
        imageFocusY:
          typeof token.imageFocusY === "number" && Number.isFinite(token.imageFocusY) ? clamp(token.imageFocusY, 0, 100) : 50,
        imageZoom: clampTokenImageZoom(token.imageZoom),
        type,
        x: clamp(token.x, 0, 100),
        y: clamp(token.y, 0, 100),
        initiative:
          typeof token.initiative === "number" && Number.isFinite(token.initiative) ? Math.trunc(token.initiative) : null,
        life: typeof token.life === "number" && Number.isFinite(token.life) ? Math.trunc(token.life) : null,
        size: clampTokenSize(token.size),
        status: (() => {
          const normalizedStatus = normalizeBattleConditionStatus(token.status)
          return normalizedStatus ? normalizedStatus : null
        })(),
        statusDurationTurns:
          normalizeBattleConditionStatus(token.status) &&
          typeof token.statusDurationTurns === "number" &&
          Number.isFinite(token.statusDurationTurns) &&
          token.statusDurationTurns >= 0
            ? Math.trunc(token.statusDurationTurns)
            : null,
        hidden: typeof token.hidden === "boolean" ? token.hidden : null,
      }
    }),
    nextObstacleId: Math.max(
      1,
      Math.trunc(input.nextObstacleId),
      obstacles.reduce((max, obstacle) => Math.max(max, obstacle.id + 1), 1),
    ),
    obstacles: obstacles.map((obstacle, index) => {
      const shape = isBattleObstacleShape(obstacle.shape) ? obstacle.shape : "rectangle"
      const width = clampObstacleDimension(obstacle.width, shape === "circle" ? 8 : 14)
      const height = shape === "circle" ? width : clampObstacleDimension(obstacle.height, 8)

      return {
        id:
          typeof obstacle.id === "number" && Number.isFinite(obstacle.id) && obstacle.id > 0
            ? Math.max(1, Math.trunc(obstacle.id))
            : index + 1,
        shape,
        x: clamp(obstacle.x, 0, 100),
        y: clamp(obstacle.y, 0, 100),
        width,
        height,
        color: normalizeHexColor(obstacle.color, shape === "circle" ? "#f59e0b" : "#0f766e"),
      }
    }),
    fogEnabled: Boolean(input.fogEnabled),
    nextFogRevealId: Math.max(
      1,
      Math.trunc(input.nextFogRevealId),
      fogReveals.reduce((max, reveal) => Math.max(max, reveal.id + 1), 1),
    ),
    fogReveals: fogReveals.map((reveal, index) => {
      const width = clampFogRevealDimension(reveal.width, 12)
      const height = clampFogRevealDimension(reveal.height, 12)
      const x = clamp(reveal.x, 0, 100 - width)
      const y = clamp(reveal.y, 0, 100 - height)

      return {
        id:
          typeof reveal.id === "number" && Number.isFinite(reveal.id) && reveal.id > 0
            ? Math.max(1, Math.trunc(reveal.id))
            : index + 1,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width,
        height,
      }
    }),
    dungeonFog,
  }
}

function normalizeCenterHistory(dto: BattleCenterHistoryDto | null | undefined): BattleCenterHistory {
  return {
    activeBattles: Array.isArray(dto?.activeBattles) ? dto.activeBattles.map(normalizeSummary) : [],
    finishedBattles: Array.isArray(dto?.finishedBattles) ? dto.finishedBattles.map(normalizeSummary) : [],
    page: typeof dto?.page === "number" && Number.isFinite(dto.page) && dto.page >= 0 ? Math.trunc(dto.page) : 0,
    pageSize: typeof dto?.pageSize === "number" && Number.isFinite(dto.pageSize) && dto.pageSize > 0 ? Math.trunc(dto.pageSize) : 12,
    totalFinishedBattles:
      typeof dto?.totalFinishedBattles === "number" && Number.isFinite(dto.totalFinishedBattles) && dto.totalFinishedBattles >= 0
        ? Math.trunc(dto.totalFinishedBattles)
        : 0,
    totalFinishedPages:
      typeof dto?.totalFinishedPages === "number" && Number.isFinite(dto.totalFinishedPages) && dto.totalFinishedPages >= 0
        ? Math.trunc(dto.totalFinishedPages)
        : 0,
    hasPreviousPage: Boolean(dto?.hasPreviousPage),
    hasNextPage: Boolean(dto?.hasNextPage),
  }
}

export async function fetchCurrentBattle(): Promise<BattleState | null> {
  const response = await backendRequest<BattleStateDto | undefined>("/v1/battles/active/current")
  return response ? normalizeState(response) : null
}

export async function fetchActiveBattle(
  sceneType: BattleSceneType,
  sceneSlug: string,
): Promise<BattleState | null> {
  const searchParams = new URLSearchParams({
    sceneType,
    sceneSlug,
  })

  const response = await backendRequest<BattleStateDto | undefined>(
    `/v1/battles/active?${searchParams.toString()}`,
  )

  return response ? normalizeState(response) : null
}

export async function fetchBattleHistory(
  landmarkSlug: string,
  options?: {
    sceneType?: BattleSceneType
    sceneSlug?: string | null
  },
): Promise<BattleSummary[]> {
  const searchParams = new URLSearchParams({
    parentLandmarkSlug: landmarkSlug,
  })

  if (options?.sceneSlug?.trim()) {
    searchParams.set("sceneSlug", options.sceneSlug.trim())
    searchParams.set("sceneType", options.sceneType === "building" ? "building" : "landmark")
  }

  const response = await backendRequest<BattleSummaryDto[]>(
    `/v1/battles?${searchParams.toString()}`,
  )

  return Array.isArray(response) ? response.map(normalizeSummary) : []
}

export async function fetchBattleCenterHistory(options?: {
  sceneType?: BattleSceneType | null
  page?: number
  pageSize?: number
}): Promise<BattleCenterHistory> {
  const searchParams = new URLSearchParams()

  if (options?.sceneType) {
    searchParams.set("sceneType", options.sceneType)
  }

  if (typeof options?.page === "number" && Number.isFinite(options.page) && options.page >= 0) {
    searchParams.set("page", String(Math.trunc(options.page)))
  }

  if (typeof options?.pageSize === "number" && Number.isFinite(options.pageSize) && options.pageSize > 0) {
    searchParams.set("pageSize", String(Math.trunc(options.pageSize)))
  }

  const response = await backendRequest<BattleCenterHistoryDto>(
    `/v1/battles/center-history${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
  )

  return normalizeCenterHistory(response)
}

export async function fetchBattleById(id: number): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>(`/v1/battles/${id}`)
  return normalizeState(response)
}

export async function createBattle(input: CreateBattleInput): Promise<BattleState> {
  const payload =
    typeof input === "string"
      ? {
          sceneType: "landmark" as const,
          sceneSlug: input,
          parentLandmarkSlug: input,
        }
      : input

  const response = await backendRequest<BattleStateDto>("/v1/battles", {
    method: "POST",
    body: payload,
  })
  return normalizeState(response)
}

export async function updateBattle(id: number, input: BattleState): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>(`/v1/battles/${id}`, {
    method: "PUT",
    body: toPayload(input),
  })
  return normalizeState(response)
}

export async function deleteBattle(id: number): Promise<void> {
  await backendRequest<void>(`/v1/battles/${id}`, {
    method: "DELETE",
  })
}

export async function finishBattle(id: number): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>(`/v1/battles/${id}/finish`, {
    method: "POST",
  })
  return normalizeState(response)
}

export async function reopenBattle(id: number): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>(`/v1/battles/${id}/reopen`, {
    method: "POST",
  })
  return normalizeState(response)
}
