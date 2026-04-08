export type BattleTokenType = "enemy" | "player"
export type BattleTokenSourceType = "character" | "monster" | "manual"
export type BattleObstacleShape = "circle" | "rectangle"
export type BattleStatus = "active" | "finished"
export type BattleSceneType = "landmark" | "building"

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
   statusDurationTurns?: number
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

export interface BattleFogReveal {
  id: number
  x: number
  y: number
  width: number
  height: number
}

export interface BattleSummary {
  id: number
  slug: string
  // Legacy alias kept for compatibility; it resolves to parentLandmarkSlug in normalized data.
  landmarkSlug: string
  sceneType: BattleSceneType
  sceneSlug: string
  parentLandmarkSlug: string
  title: string
  status: BattleStatus
  createdAt?: string
  updatedAt?: string
  endedAt?: string
  tokenCount: number
  obstacleCount: number
}

export interface BattleCenterHistory {
  activeBattles: BattleSummary[]
  finishedBattles: BattleSummary[]
  page: number
  pageSize: number
  totalFinishedBattles: number
  totalFinishedPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface BattleState {
  id?: number
  slug: string
  // Legacy alias kept for compatibility; it resolves to parentLandmarkSlug in normalized data.
  landmarkSlug: string
  sceneType: BattleSceneType
  sceneSlug: string
  parentLandmarkSlug: string
  title: string
  status: BattleStatus
  roundNumber: number
  dmNotes: string
  nextTokenNumber: number
  nextObstacleId: number
  fogEnabled: boolean
  nextFogRevealId: number
  currentTurnTokenNumber?: number | null
  tokens: BattleToken[]
  obstacles: BattleObstacle[]
  fogReveals: BattleFogReveal[]
  createdAt?: string
  updatedAt?: string
  endedAt?: string
}
