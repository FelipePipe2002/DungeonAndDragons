export type BattleTokenType = "enemy" | "player"
export type BattleTokenSourceType = "character" | "monster" | "manual"
export type BattleObstacleShape = "circle" | "rectangle"
export type BattleStatus = "active" | "finished"

export interface BattleToken {
  number: number
  nombre: string
  characterId?: number
  sourceType?: BattleTokenSourceType
  sourceRef?: string
  image?: string
  imageAssetId?: number
  imageFocusX?: number
  imageFocusY?: number
  imageZoom?: number
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
  title: string
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
  title: string
  status: BattleStatus
  roundNumber: number
  dmNotes: string
  nextTokenNumber: number
  nextObstacleId: number
  currentTurnTokenNumber?: number | null
  tokens: BattleToken[]
  obstacles: BattleObstacle[]
  createdAt?: string
  updatedAt?: string
  endedAt?: string
}
