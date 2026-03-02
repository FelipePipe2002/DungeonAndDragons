export type BattleTokenType = "enemy" | "player"
export type BattleObstacleShape = "circle" | "rectangle"

export interface BattleToken {
  number: number
  nombre: string
  type: BattleTokenType
  x: number
  y: number
  initiative?: number
  life?: number
  size: number
  status: string
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

export interface BattleState {
  id?: number
  slug: string
  landmarkSlug?: string
  nextTokenNumber: number
  nextObstacleId: number
  tokens: BattleToken[]
  obstacles: BattleObstacle[]
}
