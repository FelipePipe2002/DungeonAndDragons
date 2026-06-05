import type { CharacterSheet } from "./CharacterSheet"
import type {
  BattleDungeonFogState,
  BattleObstacleShape,
  BattleSceneType,
  BattleTokenSourceType,
  BattleTokenType,
} from "./Battle"
import type { DmOpenLoopPriority, DmOpenLoopStatus, DmOpenLoopType } from "./DmOpenLoop"
import type { DmRelationshipDirection, DmRelationshipEntityType } from "./DmRelationship"
import type { LandmarkType } from "./Landmark"
import type { MediaAssetKind } from "./MediaAsset"
import type { PartyInventoryItemKind } from "./PartyInventory"

export interface BackendLandmarkReferenceDto {
  id: number
  name?: string | null
}

export interface BackendBuildingMapDto {
  kind?: string | null
  filename?: string | null
  url?: string | null
  key?: string | null
  dataUrl?: string | null
}

export interface BackendBuildingDto {
  id: number
  landmarkId?: number | null
  name: string
  position?: number[] | null
  description?: string | null
  tags?: string[] | null
  ownerId?: number | null
  mapBuildingIndex?: number | null
  organizationId?: number | null
  mapAssetId?: number | null
  mapAssetKind?: string | null
  mapRotationDegrees?: number | null
  mapGridEnabled?: boolean | null
  mapGridCellSize?: number | null
  mapGridOffsetX?: number | null
  mapGridOffsetY?: number | null
  map?: BackendBuildingMapDto | null
}

export interface BackendBuildingReferenceDto {
  id: number
  name: string
  landmarkId?: number | null
  ownerId?: number | null
}

export type BackendBuildingUpsertPayload = {
  landmarkId: number | null
  name: string
  position: [number, number] | null
  description: string
  tags: string[]
  ownerId: number | null
  mapBuildingIndex: number | null
  organizationId: number | null
  mapAssetId: number | null
  mapRotationDegrees: number
  mapGridEnabled: boolean
  mapGridCellSize: number
  mapGridOffsetX: number
  mapGridOffsetY: number
  map:
    | { kind: "asset"; filename: string }
    | { kind: "embedded"; dataUrl: string }
    | { kind: "external"; url: string }
    | { kind: "stored"; key: string }
    | null
}

export interface BackendCharacterEventDto {
  session?: string | null
  description?: string | null
  date?: string | null
}

export interface BackendCharacterDto {
  id: number
  name?: string | null
  characterClass?: string | null
  race?: string | null
  description?: string | null
  isPlayer?: boolean | null
  characterSheet?: CharacterSheet | null
  tags?: string[] | null
  image?: string | null
  imageAssetId?: number | null
  tokenImageFocusX?: number | null
  tokenImageFocusY?: number | null
  tokenImageZoom?: number | null
  initiativeImageFocusX?: number | null
  initiativeImageFocusY?: number | null
  initiativeImageZoom?: number | null
  landmarkId?: number | null
  buildingIds?: number[] | null
  organizationIds?: number[] | null
  events?: BackendCharacterEventDto[] | null
}

export type BackendCharacterUpsertPayload = {
  name: string
  characterClass: string
  race: string
  description: string
  isPlayer: boolean
  characterSheet: CharacterSheet | null
  tags: string[]
  image: string | null
  imageAssetId: number | null
  tokenImageFocusX: number | null
  tokenImageFocusY: number | null
  tokenImageZoom: number | null
  initiativeImageFocusX: number | null
  initiativeImageFocusY: number | null
  initiativeImageZoom: number | null
  landmarkId: number | null
  buildingIds: number[]
  organizationIds: number[]
  events: Array<{
    session: string
    description: string
    date: string | null
  }>
}

export interface BackendOrganizationMemberDto {
  characterId?: number | null
  name?: string | null
  profession?: string | null
  race?: string | null
  landmarkId?: number | null
  category?: string | null
}

export interface BackendOrganizationDto {
  id: number
  name?: string | null
  description?: string | null
  tags?: string[] | null
  image?: string | null
  imageAssetId?: number | null
  categories?: string[] | null
  buildingIds?: number[] | null
  members?: BackendOrganizationMemberDto[] | null
  landmarks?: number[] | null
}

export type BackendOrganizationMemberUpsertPayload = {
  characterId: number
  category: string
}

export type BackendOrganizationUpsertPayload = {
  name: string
  description: string
  tags: string[]
  image: string | null
  imageAssetId: number | null
  buildingIds: number[]
  members: BackendOrganizationMemberUpsertPayload[]
  landmarks: number[]
}

export interface BackendLandmarkEventDto {
  title?: string | null
  description?: string | null
  date?: string | null
  session?: string | null
}

export interface BackendLandmarkMapDto {
  kind?: string | null
  source?: string | null
  filename?: string | null
  url?: string | null
  key?: string | null
  dataUrl?: string | null
}

export type BackendLandmarkMapUpsertPayload =
  | { kind: "asset"; filename: string }
  | { kind: "embedded"; dataUrl: string }
  | { kind: "external"; url: string }
  | { kind: "stored"; key: string }
  | { kind: "buildings"; source: "asset"; filename: string }
  | { kind: "buildings"; source: "external"; url: string }

export interface BackendLandmarkDto {
  id: number
  icon?: string | null
  name?: string | null
  type?: string | null
  stateId?: number | null
  subdivisionId?: number | null
  iconScale?: number | null
  textScale?: number | null
  showLegend?: boolean | null
  position?: number[] | null
  tags?: string[] | null
  population?: number | null
  shortDescription?: string | null
  history?: string | null
  events?: BackendLandmarkEventDto[] | null
  mapAssetId?: number | null
  mapAssetKind?: string | null
  mapRotationDegrees?: number | null
  mapGridEnabled?: boolean | null
  mapGridCellSize?: number | null
  mapGridOffsetX?: number | null
  mapGridOffsetY?: number | null
  organizationMapLinks?: string | null
  hiddenMapBuildings?: string | null
  dungeonGeneratorConfig?: string | null
  map?: BackendLandmarkMapDto | null
  buildings?: BackendBuildingDto[] | null
  characters?: BackendCharacterDto[] | null
  organizations?: BackendOrganizationDto[] | null
}

export type BackendLandmarkEventUpsertPayload = {
  title: string
  description: string
  date: string | null
  session: string | null
}

export type BackendLandmarkUpsertPayload = {
  icon: string
  name: string
  type: LandmarkType
  stateId: number | null
  subdivisionId: number | null
  iconScale: number
  textScale: number
  showLegend: boolean
  position: [number, number]
  tags: string[]
  population: number | null
  shortDescription: string | null
  history: string | null
  events: BackendLandmarkEventUpsertPayload[]
  mapRotationDegrees: number
  mapGridEnabled: boolean
  mapGridCellSize: number
  mapGridOffsetX: number
  mapGridOffsetY: number
  organizationMapLinks: string | null
  hiddenMapBuildings: string | null
  dungeonGeneratorConfig: string | null
  mapAssetId: number | null
  map: BackendLandmarkMapUpsertPayload | null
}

export interface BackendAssetMetadataDto {
  id: number
  kind?: string | null
  filename?: string | null
  contentType?: string | null
  byteSize?: number | null
  downloadUrl?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface BackendBookDto {
  id: number
  filename?: string | null
  contentType?: string | null
  byteSize?: number | null
  downloadUrl?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface BackendBookUploadSessionDto {
  sessionId?: string | null
  status?: string | null
  progressPercent?: number | null
  processedBytes?: number | null
  totalBytes?: number | null
  bookId?: number | null
  filename?: string | null
  errorMessage?: string | null
  updatedAt?: string | null
}

export interface BackendBattleTokenDto {
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

export interface BackendBattleObstacleDto {
  id?: number | null
  shape?: string | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  rotation?: number | null
  color?: string | null
  name?: string | null
  image?: string | null
  imageAssetId?: number | null
  hidden?: boolean | null
}

export interface BackendBattleFogRevealDto {
  id?: number | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
}

export interface BackendBattleDungeonFogStateDto {
  enabled?: boolean | null
  exploredCellKeys?: string[] | null
  openDoorIds?: string[] | null
  playerVisionBrightRadiusCells?: number | null
  playerVisionDimRadiusCells?: number | null
}

export interface BackendBattleStateDto {
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
  tokens?: BackendBattleTokenDto[] | null
  nextObstacleId?: number | null
  obstacles?: BackendBattleObstacleDto[] | null
  fogEnabled?: boolean | null
  nextFogRevealId?: number | null
  fogReveals?: BackendBattleFogRevealDto[] | null
  dungeonFog?: BackendBattleDungeonFogStateDto | null
  createdAt?: string | null
  updatedAt?: string | null
  endedAt?: string | null
}

export interface BackendBattleSummaryDto {
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

export interface BackendBattleCenterHistoryDto {
  activeBattles?: BackendBattleSummaryDto[] | null
  finishedBattles?: BackendBattleSummaryDto[] | null
  page?: number | null
  pageSize?: number | null
  totalFinishedBattles?: number | null
  totalFinishedPages?: number | null
  hasPreviousPage?: boolean | null
  hasNextPage?: boolean | null
}

export type BackendBattleUpdatePayload = {
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
    rotation: number
    color: string | null
    name: string | null
    image: string | null
    imageAssetId: number | null
    hidden: boolean | null
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

export type BackendBattleCreateInput =
  | string
  | {
      sceneType: BattleSceneType
      sceneSlug: string
      parentLandmarkSlug: string
    }

export interface BackendDmEventDto {
  id: number
  title?: string | null
  descripcion?: string | null
  description?: string | null
  date?: string | null
  session?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BackendDmEventUpsertPayload = {
  title: string | null
  description: string
  date?: string | null
  session?: string | null
}

export interface BackendDmNotesDto {
  text?: string | null
}

export type BackendDmNotesUpsertPayload = {
  text: string
}

export interface BackendDmOpenLoopDto {
  id?: number | null
  title?: string | null
  loopType?: string | null
  status?: string | null
  priority?: string | null
  summary?: string | null
  nextStep?: string | null
  consequence?: string | null
  reward?: string | null
  location?: string | null
  dueAt?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BackendDmOpenLoopUpsertPayload = {
  title: string
  loopType: DmOpenLoopType
  status: DmOpenLoopStatus
  priority: DmOpenLoopPriority
  summary: string
  nextStep: string | null
  consequence: string | null
  reward: string | null
  location: string | null
  dueAt: string | null
  notes: string | null
}

export interface BackendDmRelationshipDto {
  id?: number | null
  leftEntityType?: string | null
  leftEntityId?: number | null
  rightEntityType?: string | null
  rightEntityId?: number | null
  direction?: string | null
  label?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BackendDmRelationshipUpsertPayload = {
  leftEntityType: DmRelationshipEntityType
  leftEntityId: number
  rightEntityType: DmRelationshipEntityType
  rightEntityId: number
  direction: DmRelationshipDirection
  label: string
  notes: string | null
}

export interface BackendEstadoMemberDto {
  characterId: number
  role?: string | null
}

export interface BackendEstadoLandmarkDto {
  landmarkId: number
  role?: string | null
}

export interface BackendEstadoDto {
  id: number
  name: string
  type: string
  description?: string | null
  history?: string | null
  governmentType?: string | null
  image?: string | null
  imageAssetId?: number | null
  territoryImage?: string | null
  territoryImageAssetId?: number | null
  parentStateId?: number | null
  members?: BackendEstadoMemberDto[] | null
  landmarks?: BackendEstadoLandmarkDto[] | null
}

export type BackendEstadoUpsertPayload = {
  name: string
  type: string
  description: string
  history: string
  governmentType: string
  image: string | null
  imageAssetId: number | null
  territoryImage: string | null
  territoryImageAssetId: number | null
  parentStateId: number | null
  members: Array<{ characterId: number; role: string }>
  landmarks: Array<{ landmarkId: number; role: string }>
}

export interface BackendMonsterTokenImageResolveDto {
  status?: string | null
  assetId?: number | null
  downloadUrl?: string | null
  matchedSource?: string | null
}

export interface BackendPartyInventoryBalanceDto {
  copper?: number | null
  silver?: number | null
  gold?: number | null
  platinum?: number | null
  updatedAt?: string | null
}

export interface BackendPartyInventoryItemDto {
  id?: number | null
  kind?: string | null
  name?: string | null
  quantity?: number | null
  carrierCharacterId?: number | null
  carriedBy?: string | null
  important?: boolean | null
  notes?: string | null
  sourceItemName?: string | null
  sourceItemTypeCode?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface BackendPartyInventoryDto {
  balance?: BackendPartyInventoryBalanceDto | null
  items?: BackendPartyInventoryItemDto[] | null
}

export type BackendPartyInventoryItemUpsertPayload = {
  kind: PartyInventoryItemKind
  name: string
  quantity: number
  carrierCharacterId: number | null
  carriedBy: string | null
  important: boolean
  notes: string | null
  sourceItemName: string | null
  sourceItemTypeCode: string | null
}

export interface BackendSavedPageDto {
  id?: number | null
  title?: string | null
  url?: string | null
  selector?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type BackendSavedPageUpsertPayload = {
  title: string
  url: string
  selector?: string | null
}
