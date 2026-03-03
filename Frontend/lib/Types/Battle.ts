export type BattleTokenType = "enemy" | "player"
export type BattleObstacleShape = "circle" | "rectangle"
export type BattleStatus = "active" | "finished"

export interface BattleToken {
  number: number
  nombre: string
  characterId?: number
  type: BattleTokenType
  x: number
  y: number
  initiative?: number
  life?: number
  size: number
  status: string
  hidden?: boolean
}

export interface BattleObstacle {
  id: number
  shape: BattleObstacleShape
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface BattleSummary {
  id: number
  slug: string
  landmarkSlug: string
  status: BattleStatus
  createdAt?: string
  updatedAt?: string
  endedAt?: string
  tokenCount: number
  obstacleCount: number
}

export interface BattleState {
  id?: number
  slug: string
  landmarkSlug: string
  status: BattleStatus
  nextTokenNumber: number
  nextObstacleId: number
  currentTurnTokenNumber?: number | null
  tokens: BattleToken[]
  obstacles: BattleObstacle[]
  createdAt?: string
  updatedAt?: string
  endedAt?: string
}
