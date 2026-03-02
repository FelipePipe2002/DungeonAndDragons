import { backendRequest } from "@/lib/services/backend-api.service"
import type { BattleObstacle, BattleObstacleShape, BattleState, BattleToken, BattleTokenType } from "@/lib/types"

type BattleTokenDto = {
  number?: number | null
  nombre?: string | null
  type?: string | null
  x?: number | null
  y?: number | null
  initiative?: number | null
  life?: number | null
  size?: number | null
  status?: string | null
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

type BattleStateDto = {
  id?: number | null
  slug?: string | null
  landmarkSlug?: string | null
  nextTokenNumber?: number | null
  tokens?: BattleTokenDto[] | null
  nextObstacleId?: number | null
  obstacles?: BattleObstacleDto[] | null
}

type BattleStatePayload = {
  landmarkSlug: string | null
  nextTokenNumber: number
  tokens: Array<{
    number: number
    nombre: string
    type: BattleTokenType
    x: number
    y: number
    initiative: number | null
    life: number | null
    size: number | null
    status: string | null
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
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function clampTokenSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }

  return Math.round(clamp(value, 0.4, 2) * 100) / 100
}

function clampObstacleDimension(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.round(clamp(value, 1, 100) * 100) / 100
}

function toOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isBattleTokenType(value: unknown): value is BattleTokenType {
  return value === "enemy" || value === "player"
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

  return {
    number,
    nombre: toOptionalText(dto.nombre) ?? `${type === "player" ? "Jugador" : "Enemigo"} ${number}`,
    type,
    x: typeof dto.x === "number" && Number.isFinite(dto.x) ? clamp(dto.x, 0, 100) : 50,
    y: typeof dto.y === "number" && Number.isFinite(dto.y) ? clamp(dto.y, 0, 100) : 50,
    initiative:
      typeof dto.initiative === "number" && Number.isFinite(dto.initiative) ? Math.trunc(dto.initiative) : undefined,
    life: type === "enemy" && typeof dto.life === "number" && Number.isFinite(dto.life) ? Math.trunc(dto.life) : undefined,
    size: clampTokenSize(dto.size),
    status: toOptionalText(dto.status) ?? "",
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

function normalizeState(dto: BattleStateDto): BattleState {
  const tokens = Array.isArray(dto.tokens) ? dto.tokens.map(normalizeToken) : []
  const obstacles = Array.isArray(dto.obstacles) ? dto.obstacles.map(normalizeObstacle) : []
  const nextTokenNumber =
    typeof dto.nextTokenNumber === "number" && Number.isFinite(dto.nextTokenNumber) && dto.nextTokenNumber > 0
      ? Math.trunc(dto.nextTokenNumber)
      : 1
  const minNextTokenNumber = Math.max(
    nextTokenNumber,
    tokens.reduce((max, token) => Math.max(max, token.number + 1), 1),
  )
  const nextObstacleId =
    typeof dto.nextObstacleId === "number" && Number.isFinite(dto.nextObstacleId) && dto.nextObstacleId > 0
      ? Math.trunc(dto.nextObstacleId)
      : 1
  const minNextObstacleId = Math.max(
    nextObstacleId,
    obstacles.reduce((max, obstacle) => Math.max(max, obstacle.id + 1), 1),
  )

  return {
    id: typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : undefined,
    slug: toOptionalText(dto.slug) ?? "active",
    landmarkSlug: toOptionalText(dto.landmarkSlug),
    nextTokenNumber: minNextTokenNumber,
    nextObstacleId: minNextObstacleId,
    tokens: tokens.sort((a, b) => a.number - b.number),
    obstacles: obstacles.sort((a, b) => a.id - b.id),
  }
}

function toPayload(input: BattleState): BattleStatePayload {
  return {
    landmarkSlug: toOptionalText(input.landmarkSlug) ?? null,
    nextTokenNumber: Math.max(
      1,
      Math.trunc(input.nextTokenNumber),
      input.tokens.reduce((max, token) => Math.max(max, token.number + 1), 1),
    ),
    tokens: input.tokens.map((token) => ({
      number: Math.max(1, Math.trunc(token.number)),
      nombre: token.nombre.trim(),
      type: token.type,
      x: clamp(token.x, 0, 100),
      y: clamp(token.y, 0, 100),
      initiative:
        typeof token.initiative === "number" && Number.isFinite(token.initiative) ? Math.trunc(token.initiative) : null,
      life:
        token.type === "enemy" && typeof token.life === "number" && Number.isFinite(token.life)
          ? Math.trunc(token.life)
          : null,
      size: clampTokenSize(token.size),
      status: toOptionalText(token.status) ?? null,
    })),
    nextObstacleId: Math.max(
      1,
      Math.trunc(input.nextObstacleId),
      input.obstacles.reduce((max, obstacle) => Math.max(max, obstacle.id + 1), 1),
    ),
    obstacles: input.obstacles.map((obstacle) => {
      const width = clampObstacleDimension(obstacle.width, obstacle.shape === "circle" ? 8 : 14)
      const height =
        obstacle.shape === "circle" ? width : clampObstacleDimension(obstacle.height, 8)

      return {
        id: Math.max(1, Math.trunc(obstacle.id)),
        shape: obstacle.shape,
        x: clamp(obstacle.x, 0, 100),
        y: clamp(obstacle.y, 0, 100),
        width,
        height,
        color: normalizeHexColor(obstacle.color, obstacle.shape === "circle" ? "#f59e0b" : "#0f766e"),
      }
    }),
  }
}

export async function fetchCurrentBattleState(): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>("/v1/battle/current")
  return normalizeState(response)
}

export async function updateCurrentBattleState(input: BattleState): Promise<BattleState> {
  const response = await backendRequest<BattleStateDto>("/v1/battle/current", {
    method: "PUT",
    body: toPayload(input),
  })
  return normalizeState(response)
}
