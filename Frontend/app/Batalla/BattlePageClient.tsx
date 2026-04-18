"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent } from "react"
import {
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  Circle,
  Eye,
  FolderOpen,
  EyeOff,
  Flag,
  ImagePlus,
  Keyboard,
  Layers3,
  LoaderCircle,
  Info,
  Monitor,
  Redo2,
  Search,
  Square,
  Swords,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react"

import { LandmarkMapOnlyClient } from "@/app/presentacion/LandmarkMapOnlyClient"
import { BattleStatusBanner } from "@/components/battle/BattleStatusBanner"
import { CharacterImageCropDialog } from "@/components/battle/CharacterImageCropDialog"
import { BattleFogOverlay } from "@/components/battle/BattleFogOverlay"
import { BattleTokenOverlay } from "@/components/battle/BattleTokenOverlay"
import MonsterCard from "@/components/monster/monster-card"
import { CharacterSheetDialog } from "@/components/dialog/detailed/CharacterSheetDialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  BATTLE_CONDITIONS,
  findBattleConditionByName,
  normalizeBattleConditionStatus,
} from "@/lib/battle/conditions"
import type { MonsterListItem, MonsterRecord } from "@/lib/monster/types"
import { extractMonsterInitiativeModifier, resolveMonsterImage } from "@/lib/monster/utils"
import { getOrderedInitiativeTokens, normalizeCurrentTurnTokenNumber } from "@/lib/battle/initiative"
import { getBattleTokenImagePresentationStyle, normalizeBattleTokenImageCrop } from "@/lib/battle/token-image"
import {
  broadcastBattleTurn,
  broadcastBattleObstaclePreview,
  broadcastBattleTokenPreview,
  readBattleScreenPresentationFriendlyMode,
  readBattleScreenPresentationVerticalMirror,
  setBattleScreenPresentationVerticalMirror,
  setBattleScreenState,
} from "@/lib/battle/sync"
import {
  openPresentationScreen,
  type PresentationScreenTarget,
} from "@/lib/presentation/screen"
import { isJsonMapReference, resolveLandmarkMapMode } from "@/lib/landmarks/map-policy"
import {
  createBattle,
  deleteBattle,
  fetchActiveBattle,
  fetchBattleById,
  fetchBattleCenterHistory,
  finishBattle,
  reopenBattle,
  sanitizeBattleState,
  updateBattle,
} from "@/lib/services/battle-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchCharacters, updateCharacter } from "@/lib/services/character-api.service"
import { fetchMonsterByExactName, searchMonsters } from "@/lib/services/monster-api.service"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { serviceMessage } from "@/lib/service-message"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import type {
  BattleCenterHistory,
  BattleFogReveal,
  BattleObstacle,
  BattleObstacleShape,
  BattleState,
  BattleSummary,
  BattleToken,
  Building,
  Character,
  Landmark,
} from "@/lib/types"

function parseNumberInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDecimalInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseFloat(trimmed.replace(",", "."))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : undefined
}

function parseLifeModifierInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const hasExplicitSign = trimmed.startsWith("+") || trimmed.startsWith("-")
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return {
    value: parsed,
    hasExplicitSign,
  }
}

const DEFAULT_CONDITION_DURATION_TURNS = "1"

function parseConditionDurationTurns(value: string) {
  const parsed = parseNumberInput(value)
  return parsed !== undefined && parsed >= 0 ? parsed : null
}

function rollInitiativeDie() {
  return Math.floor(Math.random() * 20) + 1
}

function getAbilityModifier(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 0
  }

  return Math.floor((score - 10) / 2)
}

function getCharacterDexterityModifier(character: Character | null | undefined) {
  return getAbilityModifier(character?.characterSheet?.ability_scores?.dex?.score)
}

function getResetInitiativeForToken(
  token: BattleToken,
  charactersById: Map<number, Character>,
  monsterByNameCache: Map<string, MonsterRecord>,
) {
  if (token.type === "player" && typeof token.characterId === "number" && token.characterId > 0) {
    return -1
  }

  if (typeof token.characterId === "number" && token.characterId > 0) {
    return rollInitiativeDie() + getCharacterDexterityModifier(charactersById.get(token.characterId) ?? null)
  }

  if (token.sourceType === "monster") {
    const sourceKey = getMonsterSourceKeyFromToken(token)
    const cachedMonster = sourceKey ? monsterByNameCache.get(sourceKey) ?? null : null
    return rollInitiativeDie() + (cachedMonster ? extractMonsterInitiativeModifier(cachedMonster) : 0)
  }

  return rollInitiativeDie()
}

type MonsterSortField = "name" | "type" | "cr"
type MonsterSortDirection = "asc" | "desc"
type MonsterSortState = {
  field: MonsterSortField
  direction: MonsterSortDirection
}

const MONSTER_LIBRARY_PAGE_SIZE = 80
const MONSTER_LIBRARY_SCROLL_THRESHOLD_PX = 240

type TokenLibraryEntry =
  | {
      kind: "character"
      key: string
      name: string
      image: string | null
      raceOrType: string
      classOrCr: string
      character: Character
    }
  | {
      kind: "monster"
      key: string
      name: string
      image: string | null
      raceOrType: string
      classOrCr: string
      monster: MonsterListItem
    }

type MonsterBattleCropDraft = {
  sourceKey: string
  sourceLabel: string
  image: string
  focusX: number
  focusY: number
  zoom: number
}

function getMonsterSourceRefFromToken(token: BattleToken) {
  if (token.sourceType !== "monster") {
    return null
  }

  const normalized = token.sourceRef?.trim()
  if (normalized) {
    return normalized
  }

  const fallbackName = token.nombre.trim()
  return fallbackName ? fallbackName : null
}

function getMonsterSourceKeyFromToken(token: BattleToken) {
  if (token.sourceType !== "monster") {
    return null
  }

  const sourceRef = token.sourceRef?.trim()
  if (sourceRef) {
    return sourceRef.toLocaleLowerCase("es")
  }

  const tokenName = token.nombre.trim()
  return tokenName ? tokenName.toLocaleLowerCase("es") : null
}

function DelayedControlTooltip({
  label,
  children,
  side = "top",
}: {
  label: string
  children: ReactNode
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip delayDuration={1000}>
      <TooltipTrigger asChild>
        <span className="inline-flex max-w-full">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function getLandmarkMapReference(landmark: Landmark) {
  if (typeof landmark.mapAssetId === "number" && landmark.mapAssetId > 0) {
    return "__asset__"
  }

  const ref = landmark.mapa
  if (!ref) {
    return null
  }

  if (ref.kind === "embedded") return ref.dataUrl
  if (ref.kind === "external") return ref.url
  if (ref.kind === "asset") return ref.filename
  if (ref.kind === "stored") return ref.key
  if (ref.kind === "buildings") return ref.source === "external" ? ref.url : ref.filename

  return null
}

function isLandmarkEligibleForBattle(landmark: Landmark) {
  const persistedMapReference = getLandmarkMapReference(landmark)
  const mapMode = resolveLandmarkMapMode(landmark, persistedMapReference)

  return Boolean(persistedMapReference) && mapMode === "image" && Boolean(landmark.mapGridEnabled)
}

function getBuildingMapReference(building: Building) {
  if (typeof building.mapAssetId === "number" && building.mapAssetId > 0) {
    return "__asset__"
  }

  const ref = building.mapa
  if (!ref) {
    return null
  }

  if (ref.kind === "embedded") return ref.dataUrl
  if (ref.kind === "external") return ref.url
  if (ref.kind === "asset") return ref.filename
  if (ref.kind === "stored") return ref.key

  return null
}

function isBuildingEligibleForBattle(building: Building) {
  const persistedMapReference = getBuildingMapReference(building)
  const usesUnsupportedMap = building.mapAssetKind === "json" || isJsonMapReference(persistedMapReference)

  return Boolean(persistedMapReference) && !usesUnsupportedMap
}

type BattleCenterSceneEntry = {
  key: string
  sceneType: "landmark" | "building"
  sceneSlug: string
  parentLandmarkSlug: string
  label: string
}

const BATTLE_CENTER_HISTORY_PAGE_SIZE = 12

function getSelectedBattleModeLabel(selectedBattle: BattleState | null, isEditable: boolean) {
  if (!selectedBattle) {
    return "Mapa"
  }

  if (selectedBattle.status !== "active") {
    return "Lectura"
  }

  return isEditable ? "Edicion" : "Lectura"
}

function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  )
}

function formatBattleSummaryTimestamp(battle: BattleSummary) {
  const rawValue = battle.status === "finished" ? battle.endedAt ?? battle.updatedAt ?? battle.createdAt : battle.updatedAt ?? battle.createdAt
  if (!rawValue) {
    return "Sin fecha"
  }

  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) {
    return rawValue
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

function formatBattleDateTime(rawValue: string | null | undefined) {
  if (!rawValue) {
    return "-"
  }

  const parsed = new Date(rawValue)
  if (Number.isNaN(parsed.getTime())) {
    return rawValue
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

function sortBattleState(battle: BattleState): BattleState {
  const normalizedBattle = sanitizeBattleState(battle) ?? battle
  const tokens = [...normalizedBattle.tokens].sort((left, right) => left.number - right.number)

  return {
    ...normalizedBattle,
    currentTurnTokenNumber: normalizeCurrentTurnTokenNumber(tokens, normalizedBattle.currentTurnTokenNumber ?? null),
    tokens,
    obstacles: [...normalizedBattle.obstacles].sort((left, right) => left.id - right.id),
    fogReveals: [...normalizedBattle.fogReveals].sort((left, right) => left.id - right.id),
  }
}

function isLandmarkFogSupported(landmark: Landmark | null) {
  if (!landmark) {
    return true
  }

  return resolveLandmarkMapMode(landmark, getLandmarkMapReference(landmark)) === "image"
}

function isBuildingFogSupported(building: Building | null) {
  if (!building) {
    return true
  }

  if (building.mapAssetKind === "json") {
    return false
  }

  if (building.mapa?.kind === "asset") {
    return !isJsonMapReference(building.mapa.filename)
  }

  if (building.mapa?.kind === "external") {
    return !isJsonMapReference(building.mapa.url)
  }

  if (building.mapa?.kind === "embedded") {
    return !isJsonMapReference(building.mapa.dataUrl)
  }

  return true
}

function subtractFogAreaFromReveal(reveal: BattleFogReveal, coveredArea: Omit<BattleFogReveal, "id">) {
  const revealRight = reveal.x + reveal.width
  const revealBottom = reveal.y + reveal.height
  const coveredRight = coveredArea.x + coveredArea.width
  const coveredBottom = coveredArea.y + coveredArea.height

  const overlapLeft = Math.max(reveal.x, coveredArea.x)
  const overlapTop = Math.max(reveal.y, coveredArea.y)
  const overlapRight = Math.min(revealRight, coveredRight)
  const overlapBottom = Math.min(revealBottom, coveredBottom)

  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
    return [reveal]
  }

  const fragments: Array<Omit<BattleFogReveal, "id">> = []

  if (overlapTop > reveal.y) {
    fragments.push({
      x: reveal.x,
      y: reveal.y,
      width: reveal.width,
      height: overlapTop - reveal.y,
    })
  }

  if (overlapBottom < revealBottom) {
    fragments.push({
      x: reveal.x,
      y: overlapBottom,
      width: reveal.width,
      height: revealBottom - overlapBottom,
    })
  }

  if (overlapLeft > reveal.x) {
    fragments.push({
      x: reveal.x,
      y: overlapTop,
      width: overlapLeft - reveal.x,
      height: overlapBottom - overlapTop,
    })
  }

  if (overlapRight < revealRight) {
    fragments.push({
      x: overlapRight,
      y: overlapTop,
      width: revealRight - overlapRight,
      height: overlapBottom - overlapTop,
    })
  }

  return fragments
    .map((fragment) => ({
      x: Math.round(fragment.x * 100) / 100,
      y: Math.round(fragment.y * 100) / 100,
      width: Math.round(fragment.width * 100) / 100,
      height: Math.round(fragment.height * 100) / 100,
    }))
    .filter((fragment) => fragment.width >= 0.25 && fragment.height >= 0.25)
}

function isTurnOnlyBattleChange(previous: BattleState | null, next: BattleState | null) {
  if (!previous || !next) {
    return false
  }

  return (
    previous !== next &&
    previous.id === next.id &&
    previous.slug === next.slug &&
    previous.sceneType === next.sceneType &&
    previous.sceneSlug === next.sceneSlug &&
    previous.parentLandmarkSlug === next.parentLandmarkSlug &&
    previous.title === next.title &&
    previous.status === next.status &&
    previous.dmNotes === next.dmNotes &&
    previous.nextTokenNumber === next.nextTokenNumber &&
    previous.nextObstacleId === next.nextObstacleId &&
    previous.fogEnabled === next.fogEnabled &&
    previous.nextFogRevealId === next.nextFogRevealId &&
    previous.tokens === next.tokens &&
    previous.obstacles === next.obstacles &&
    previous.fogReveals === next.fogReveals &&
    ((previous.currentTurnTokenNumber ?? null) !== (next.currentTurnTokenNumber ?? null) ||
      previous.roundNumber !== next.roundNumber)
  )
}

const BATTLE_EDIT_HISTORY_LIMIT = 32

type BattleEditHistoryEntry = {
  battle: BattleState
  selectedTokenNumber: number | null
  selectedObstacleId: number | null
}

function areBattleStatesEqual(left: BattleState, right: BattleState) {
  if (left === right) {
    return true
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

function areBattleEditHistoryEntriesEqual(left: BattleEditHistoryEntry, right: BattleEditHistoryEntry) {
  return (
    left.selectedTokenNumber === right.selectedTokenNumber &&
    left.selectedObstacleId === right.selectedObstacleId &&
    areBattleStatesEqual(left.battle, right.battle)
  )
}

function appendUniqueBattleEditHistoryEntry(entries: BattleEditHistoryEntry[], entry: BattleEditHistoryEntry) {
  if (entries.length > 0 && areBattleEditHistoryEntriesEqual(entries[entries.length - 1], entry)) {
    return entries
  }

  return [...entries.slice(-(BATTLE_EDIT_HISTORY_LIMIT - 1)), entry]
}

function prependUniqueBattleEditHistoryEntry(entries: BattleEditHistoryEntry[], entry: BattleEditHistoryEntry) {
  if (entries.length > 0 && areBattleEditHistoryEntriesEqual(entries[0], entry)) {
    return entries
  }

  return [entry, ...entries].slice(0, BATTLE_EDIT_HISTORY_LIMIT)
}

function findPreviousDistinctBattleEditHistoryEntryIndex(
  entries: BattleEditHistoryEntry[],
  currentEntry: BattleEditHistoryEntry,
) {
  let index = entries.length - 1
  while (index >= 0 && areBattleEditHistoryEntriesEqual(entries[index], currentEntry)) {
    index -= 1
  }

  return index
}

function findNextDistinctBattleEditHistoryEntryIndex(entries: BattleEditHistoryEntry[], currentEntry: BattleEditHistoryEntry) {
  let index = 0
  while (index < entries.length && areBattleEditHistoryEntriesEqual(entries[index], currentEntry)) {
    index += 1
  }

  return index
}

type TokenFormDraft = {
  nombre: string
  characterId: number | null
  sourceType: BattleToken["sourceType"] | null
  sourceRef: string | null
  image: string
  imageAssetId: number | null
  imageFocusX: number
  imageFocusY: number
  imageZoom: number
  initiative: string
  initiativeModifier: string
  life: string
  status: string
  statusDurationTurns: string
}

const EMPTY_STATUS_SELECT_VALUE = "__none__"

function createEmptyTokenFormDraft(type: BattleToken["type"]): TokenFormDraft {
  return {
    nombre: "",
    characterId: null,
    sourceType: "manual",
    sourceRef: null,
    image: "",
    imageAssetId: null,
    imageFocusX: 50,
    imageFocusY: 50,
    imageZoom: 1,
    initiative: "",
    initiativeModifier: type === "enemy" ? "0" : "",
    life: type === "enemy" ? "0" : "",
    status: "",
    statusDurationTurns: "",
  }
}

export function BattlePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [characters, setCharacters] = useState<Character[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [activeBattle, setActiveBattle] = useState<BattleState | null>(null)
  const [selectedBattle, setSelectedBattle] = useState<BattleState | null>(null)
  const [selectedSceneKey, setSelectedSceneKey] = useState<string | null>(null)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isBattleLoading, setIsBattleLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [, setPresentationSyncStatus] = useState<"idle" | "broadcast" | "storage">("idle")
  const [selectedTokenNumber, setSelectedTokenNumber] = useState<number | null>(null)
  const [selectedObstacleId, setSelectedObstacleId] = useState<number | null>(null)
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false)
  const [isCharacterLibraryOpen, setIsCharacterLibraryOpen] = useState(false)
  const [isTokenLibraryDialogContentReady, setIsTokenLibraryDialogContentReady] = useState(false)
  const [characterLibraryQuery, setCharacterLibraryQuery] = useState("")
  const [tokenLibrarySearchMode, setTokenLibrarySearchMode] = useState<"character" | "monster">("character")
  const [monsterLibrarySort, setMonsterLibrarySort] = useState<MonsterSortState>({ field: "name", direction: "asc" })
  const [monsterLibraryEntries, setMonsterLibraryEntries] = useState<MonsterListItem[]>([])
  const [monsterLibraryTotal, setMonsterLibraryTotal] = useState(0)
  const [isMonsterLibraryLoading, setIsMonsterLibraryLoading] = useState(false)
  const [isMonsterLibraryLoadingMore, setIsMonsterLibraryLoadingMore] = useState(false)
  const [monsterLibraryHasMore, setMonsterLibraryHasMore] = useState(false)
  const [monsterLibraryError, setMonsterLibraryError] = useState<string | null>(null)
  const [isMonsterDetailDialogOpen, setIsMonsterDetailDialogOpen] = useState(false)
  const [detailMonsterPanel, setDetailMonsterPanel] = useState<MonsterRecord | null>(null)
  const [isMonsterDetailLoading, setIsMonsterDetailLoading] = useState(false)
  const [monsterDetailError, setMonsterDetailError] = useState<string | null>(null)
  const [tokenDialogType, setTokenDialogType] = useState<BattleToken["type"]>("enemy")
  const [tokenDialogDraft, setTokenDialogDraft] = useState<TokenFormDraft>(createEmptyTokenFormDraft("enemy"))
  const [savedTokenDrafts, setSavedTokenDrafts] = useState<Partial<Record<BattleToken["type"], TokenFormDraft>>>({})
  const [pendingDeleteToken, setPendingDeleteToken] = useState<BattleToken | null>(null)
  const [battleEditHistory, setBattleEditHistory] = useState<{
    past: BattleEditHistoryEntry[]
    future: BattleEditHistoryEntry[]
  }>({
    past: [],
    future: [],
  })
  const [cropCharacterId, setCropCharacterId] = useState<number | null>(null)
  const [isCharacterCropDialogOpen, setIsCharacterCropDialogOpen] = useState(false)
  const [isSavingCharacterCrop, setIsSavingCharacterCrop] = useState(false)
  const [monsterBattleCropDraft, setMonsterBattleCropDraft] = useState<MonsterBattleCropDraft | null>(null)
  const [isBattleCenterOpen, setIsBattleCenterOpen] = useState(false)
  const [isBattleInfoOpen, setIsBattleInfoOpen] = useState(false)
  const [battleCenterHistory, setBattleCenterHistory] = useState<BattleCenterHistory>({
    activeBattles: [],
    finishedBattles: [],
    page: 0,
    pageSize: BATTLE_CENTER_HISTORY_PAGE_SIZE,
    totalFinishedBattles: 0,
    totalFinishedPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  })
  const [battleHistoryError, setBattleHistoryError] = useState<string | null>(null)
  const [isBattleHistoryLoading, setIsBattleHistoryLoading] = useState(false)
  const [battleHistoryPage, setBattleHistoryPage] = useState(0)
  const [isCreatingBattle, setIsCreatingBattle] = useState(false)
  const [isOpeningBattle, setIsOpeningBattle] = useState(false)
  const [deletingBattleId, setDeletingBattleId] = useState<number | null>(null)
  const [selectedSceneActiveBattle, setSelectedSceneActiveBattle] = useState<BattleState | null>(null)
  const [isSelectedSceneActiveBattleLoading, setIsSelectedSceneActiveBattleLoading] = useState(false)
  const [isPresentationViewVerticallyMirrored, setIsPresentationViewVerticallyMirrored] = useState(
    () => readBattleScreenPresentationVerticalMirror(),
  )
  const [isPresentationFriendlyMode, setIsPresentationFriendlyMode] = useState(
    () => readBattleScreenPresentationFriendlyMode(),
  )
  const [isLifeModifierDialogOpen, setIsLifeModifierDialogOpen] = useState(false)
  const [lifeModifierTokenNumber, setLifeModifierTokenNumber] = useState("")
  const [lifeModifierValue, setLifeModifierValue] = useState("")
  const [lifeModifierError, setLifeModifierError] = useState<string | null>(null)
  const [isStatusLoaderDialogOpen, setIsStatusLoaderDialogOpen] = useState(false)
  const [statusLoaderTokenNumber, setStatusLoaderTokenNumber] = useState("")
  const [statusLoaderConditionName, setStatusLoaderConditionName] = useState("")
  const [statusLoaderDurationTurns, setStatusLoaderDurationTurns] = useState("")
  const [statusLoaderError, setStatusLoaderError] = useState<string | null>(null)
  const [reopeningBattleId, setReopeningBattleId] = useState<number | null>(null)
  const [librarySheetCharacter, setLibrarySheetCharacter] = useState<Character | null>(null)
  const [isLibrarySheetOpen, setIsLibrarySheetOpen] = useState(false)
  const [libraryMonsterPanel, setLibraryMonsterPanel] = useState<MonsterRecord | null>(null)
  const [isLibraryMonsterPanelDialogOpen, setIsLibraryMonsterPanelDialogOpen] = useState(false)
  const [monsterPanelError, setMonsterPanelError] = useState<string | null>(null)
  const [isMonsterPanelLoading, setIsMonsterPanelLoading] = useState(false)
  const [isFogEditorOpen, setIsFogEditorOpen] = useState(false)
  const [fogEditorMode, setFogEditorMode] = useState<"idle" | "reveal" | "erase">("idle")
  const [haveResolvedBuildings, setHaveResolvedBuildings] = useState(false)
  const battleCenterDialogRef = useRef<HTMLDivElement | null>(null)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenLibraryDialogFrameRef = useRef<number | null>(null)
  const tokenLibraryCloseCleanupFrameRef = useRef<number | null>(null)
  const libraryMonsterPanelCloseCleanupFrameRef = useRef<number | null>(null)
  const monsterDetailCloseCleanupFrameRef = useRef<number | null>(null)
  const saveSyncVersionRef = useRef(0)
  const lastSyncedSnapshotRef = useRef<string | null>(null)
  const lastBroadcastSnapshotRef = useRef<string | null>(null)
  const lastBroadcastBattleRef = useRef<BattleState | null>(null)
  const battleLoadRequestRef = useRef(0)
  const battleHistoryRequestRef = useRef(0)
  const monsterSearchRequestRef = useRef(0)
  const selectedBattleRef = useRef<BattleState | null>(null)
  const handledBattleNavigationRequestRef = useRef<string | null>(null)
  const battleEditHistoryRef = useRef<{
    past: BattleEditHistoryEntry[]
    future: BattleEditHistoryEntry[]
  }>({
    past: [],
    future: [],
  })
  const selectedTokenNumberRef = useRef<number | null>(null)
  const selectedObstacleIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (tokenLibraryDialogFrameRef.current !== null) {
      window.cancelAnimationFrame(tokenLibraryDialogFrameRef.current)
      tokenLibraryDialogFrameRef.current = null
    }

    if (!isCharacterLibraryOpen) {
      setIsTokenLibraryDialogContentReady(false)
      return
    }

    setIsTokenLibraryDialogContentReady(false)
    tokenLibraryDialogFrameRef.current = window.requestAnimationFrame(() => {
      tokenLibraryDialogFrameRef.current = null
      setIsTokenLibraryDialogContentReady(true)
    })

    return () => {
      if (tokenLibraryDialogFrameRef.current !== null) {
        window.cancelAnimationFrame(tokenLibraryDialogFrameRef.current)
        tokenLibraryDialogFrameRef.current = null
      }
    }
  }, [isCharacterLibraryOpen])

  useEffect(() => {
    return () => {
      if (tokenLibraryCloseCleanupFrameRef.current !== null) {
        window.cancelAnimationFrame(tokenLibraryCloseCleanupFrameRef.current)
      }
      if (libraryMonsterPanelCloseCleanupFrameRef.current !== null) {
        window.cancelAnimationFrame(libraryMonsterPanelCloseCleanupFrameRef.current)
      }
      if (monsterDetailCloseCleanupFrameRef.current !== null) {
        window.cancelAnimationFrame(monsterDetailCloseCleanupFrameRef.current)
      }
    }
  }, [])

  const scheduleTokenLibraryDialogCloseCleanup = useCallback(() => {
    if (tokenLibraryCloseCleanupFrameRef.current !== null) {
      window.cancelAnimationFrame(tokenLibraryCloseCleanupFrameRef.current)
    }

    tokenLibraryCloseCleanupFrameRef.current = window.requestAnimationFrame(() => {
      tokenLibraryCloseCleanupFrameRef.current = null
      setCharacterLibraryQuery("")
      setTokenLibrarySearchMode("character")
      setMonsterLibraryError(null)
      setIsLibraryMonsterPanelDialogOpen(false)
      setLibraryMonsterPanel(null)
      setMonsterPanelError(null)
      setIsMonsterPanelLoading(false)
    })
  }, [])

  const scheduleLibraryMonsterPanelCloseCleanup = useCallback(() => {
    if (libraryMonsterPanelCloseCleanupFrameRef.current !== null) {
      window.cancelAnimationFrame(libraryMonsterPanelCloseCleanupFrameRef.current)
    }

    libraryMonsterPanelCloseCleanupFrameRef.current = window.requestAnimationFrame(() => {
      libraryMonsterPanelCloseCleanupFrameRef.current = null
      setLibraryMonsterPanel(null)
      setMonsterPanelError(null)
      setIsMonsterPanelLoading(false)
    })
  }, [])

  const scheduleMonsterDetailCloseCleanup = useCallback(() => {
    if (monsterDetailCloseCleanupFrameRef.current !== null) {
      window.cancelAnimationFrame(monsterDetailCloseCleanupFrameRef.current)
    }

    monsterDetailCloseCleanupFrameRef.current = window.requestAnimationFrame(() => {
      monsterDetailCloseCleanupFrameRef.current = null
      setDetailMonsterPanel(null)
      setMonsterDetailError(null)
      setIsMonsterDetailLoading(false)
    })
  }, [])
  const undoBattleEditRef = useRef<() => void>(() => {})
  const redoBattleEditRef = useRef<() => void>(() => {})
  const monsterByNameCacheRef = useRef<Map<string, MonsterRecord>>(new Map())
  const lifeModifierTokenInputRef = useRef<HTMLInputElement | null>(null)
  const lifeModifierValueInputRef = useRef<HTMLInputElement | null>(null)
  const statusLoaderTokenInputRef = useRef<HTMLInputElement | null>(null)
  const deferredCharacterLibraryQuery = useDeferredValue(characterLibraryQuery)
  const requestedBattleLandmarkSlug = useMemo(() => {
    const rawValue = searchParams.get("landmark")
    return rawValue?.trim() ? rawValue.trim() : null
  }, [searchParams])
  const requestedBattleId = useMemo(() => {
    const rawValue = searchParams.get("battleId")
    if (!rawValue) {
      return null
    }

    const parsed = Number.parseInt(rawValue, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])
  const requestedReopenBattleId = useMemo(() => {
    const rawValue = searchParams.get("reopenBattleId")
    if (!rawValue) {
      return null
    }

    const parsed = Number.parseInt(rawValue, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])

  useEffect(() => {
    selectedTokenNumberRef.current = selectedTokenNumber
  }, [selectedTokenNumber])

  useEffect(() => {
    selectedObstacleIdRef.current = selectedObstacleId
  }, [selectedObstacleId])

  useEffect(() => {
    selectedBattleRef.current = selectedBattle
  }, [selectedBattle])

  useEffect(() => {
    if (!isFogEditorOpen) {
      return
    }

    setSelectedTokenNumber(null)
    setSelectedObstacleId(null)
  }, [isFogEditorOpen])

  useEffect(() => {
    if (!isFogEditorOpen || fogEditorMode === "idle") {
      return
    }

    const handleFogEditorEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      setFogEditorMode("idle")
    }

    window.addEventListener("keydown", handleFogEditorEscape, true)
    return () => {
      window.removeEventListener("keydown", handleFogEditorEscape, true)
    }
  }, [fogEditorMode, isFogEditorOpen])

  const updateBattleEditHistoryState = useCallback(
    (
      updater: (current: { past: BattleEditHistoryEntry[]; future: BattleEditHistoryEntry[] }) => {
        past: BattleEditHistoryEntry[]
        future: BattleEditHistoryEntry[]
      },
    ) => {
      const next = updater(battleEditHistoryRef.current)
      battleEditHistoryRef.current = next
      setBattleEditHistory(next)
    },
    [],
  )

  const applySelectedBattle = useCallback((battle: BattleState | null) => {
    const normalizedBattle = battle ? sortBattleState(battle) : null

    selectedBattleRef.current = normalizedBattle
    setSelectedBattle(normalizedBattle)
    setSelectedTokenNumber(normalizedBattle?.tokens[0]?.number ?? null)
    setSelectedObstacleId(null)
  }, [])

  const loadCurrentBattle = useCallback(async (initialLoad = false) => {
    const requestId = ++battleLoadRequestRef.current
    if (initialLoad) {
      setIsPageLoading(true)
    }
    setIsBattleLoading(true)
    setLoadError(null)

    try {
      if (requestId !== battleLoadRequestRef.current) {
        return
      }

      setActiveBattle(null)
      applySelectedBattle(null)
      lastSyncedSnapshotRef.current = null
    } catch (error) {
      if (requestId !== battleLoadRequestRef.current) {
        return
      }

      setLoadError(getBackendErrorMessage(error, "No se pudo cargar la batalla activa."))
      setActiveBattle(null)
      applySelectedBattle(null)
      lastSyncedSnapshotRef.current = null
    } finally {
      if (requestId === battleLoadRequestRef.current) {
        setIsBattleLoading(false)
        if (initialLoad) {
          setIsPageLoading(false)
        }
      }
    }
  }, [applySelectedBattle])

  useEffect(() => {
    let isMounted = true

    void fetchCharacters()
      .then((fetchedCharacters) => {
        if (!isMounted) {
          return
        }

        setCharacters(fetchedCharacters)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setCharacters([])
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void fetchBuildings()
      .then((fetchedBuildings) => {
        if (!isMounted) {
          return
        }

        setBuildings(fetchedBuildings)
        setHaveResolvedBuildings(true)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setBuildings([])
        setHaveResolvedBuildings(true)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    void fetchLandmarks()
      .then((fetchedLandmarks) => {
        if (!isMounted) {
          return
        }

        setLandmarks(fetchedLandmarks)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setLandmarks([])
      })

    return () => {
      isMounted = false
    }
  }, [])

  const getMonsterByExactNameCached = useCallback(async (nameExact: string) => {
    const normalized = nameExact.trim()
    if (!normalized) {
      return null
    }

    const cache = monsterByNameCacheRef.current
    const cacheKey = normalized.toLocaleLowerCase("es")
    const cachedMonster = cache.get(cacheKey)
    if (cachedMonster && resolveMonsterImage(cachedMonster)) {
      return cachedMonster
    }

    const fetchedMonster = await fetchMonsterByExactName(normalized, { withTokenImage: true })
    if (!fetchedMonster) {
      return cachedMonster ?? null
    }

    const resolvedImage = resolveMonsterImage(fetchedMonster)
    const normalizedMonster =
      resolvedImage && !(typeof fetchedMonster.image === "string" && fetchedMonster.image.trim())
        ? {
            ...fetchedMonster,
            image: resolvedImage,
          }
        : fetchedMonster

    cache.set(cacheKey, normalizedMonster)
    return normalizedMonster
  }, [])

  useEffect(() => {
    if (!selectedTokenNumber || !selectedBattle?.tokens?.length) {
      return
    }

    const selectedToken = selectedBattle.tokens.find((token) => token.number === selectedTokenNumber)
    if (!selectedToken) {
      return
    }

    const monsterSourceRef = getMonsterSourceRefFromToken(selectedToken)
    if (!monsterSourceRef) {
      return
    }

    void getMonsterByExactNameCached(monsterSourceRef).catch(() => {})
  }, [getMonsterByExactNameCached, selectedBattle?.tokens, selectedTokenNumber])

  const eligibleBattleScenes = useMemo<BattleCenterSceneEntry[]>(() => {
    const landmarkNameById = new Map(landmarks.map((landmark) => [landmark.id, landmark.nombre]))
    const landmarkEntries = landmarks
      .filter(isLandmarkEligibleForBattle)
      .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"))
      .map((landmark) => {
        const slug = landmarkNameToSlug(landmark.nombre)
        return {
          key: `landmark:${slug}`,
          sceneType: "landmark" as const,
          sceneSlug: slug,
          parentLandmarkSlug: slug,
          label: landmark.nombre,
        }
      })
    const buildingEntries: BattleCenterSceneEntry[] = []

    for (const building of buildings) {
      if (typeof building.landmarkId !== "number" || !isBuildingEligibleForBattle(building)) {
        continue
      }

        const parentLandmarkName = landmarkNameById.get(building.landmarkId ?? -1)
        if (!parentLandmarkName) {
          continue
        }

        buildingEntries.push({
          key: `building:${landmarkNameToSlug(building.nombre)}`,
          sceneType: "building" as const,
          sceneSlug: landmarkNameToSlug(building.nombre),
          parentLandmarkSlug: landmarkNameToSlug(parentLandmarkName),
          label: `${building.nombre} · ${parentLandmarkName}`,
        })
    }

    buildingEntries.sort((left, right) => left.label.localeCompare(right.label, "es"))

    return [...landmarkEntries, ...buildingEntries]
  }, [buildings, landmarks])

  const selectedScene = useMemo(
    () => eligibleBattleScenes.find((entry) => entry.key === selectedSceneKey) ?? null,
    [eligibleBattleScenes, selectedSceneKey],
  )

  useEffect(() => {
    if (selectedBattle?.sceneSlug) {
      setSelectedSceneKey(`${selectedBattle.sceneType}:${selectedBattle.sceneSlug}`)
    }
  }, [selectedBattle?.sceneSlug, selectedBattle?.sceneType])

  useEffect(() => {
    if (!selectedSceneKey && eligibleBattleScenes.length > 0) {
      setSelectedSceneKey(eligibleBattleScenes[0]?.key ?? null)
    }
  }, [eligibleBattleScenes, selectedSceneKey])

  useEffect(() => {
    void loadCurrentBattle(true)
  }, [loadCurrentBattle])

  const loadBattleCenterHistory = useCallback(async (page: number) => {
    const requestId = ++battleHistoryRequestRef.current
    setIsBattleHistoryLoading(true)
    setBattleHistoryError(null)

    try {
      const history = await fetchBattleCenterHistory({
        page,
        pageSize: BATTLE_CENTER_HISTORY_PAGE_SIZE,
      })
      if (requestId !== battleHistoryRequestRef.current) {
        return
      }

      setBattleCenterHistory(history)
    } catch (error) {
      if (requestId !== battleHistoryRequestRef.current) {
        return
      }

      setBattleCenterHistory({
        activeBattles: [],
        finishedBattles: [],
        page,
        pageSize: BATTLE_CENTER_HISTORY_PAGE_SIZE,
        totalFinishedBattles: 0,
        totalFinishedPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      })
      setBattleHistoryError(getBackendErrorMessage(error, "No se pudo cargar el historial de batallas."))
    } finally {
      if (requestId === battleHistoryRequestRef.current) {
        setIsBattleHistoryLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadBattleCenterHistory(battleHistoryPage)
  }, [battleHistoryPage, loadBattleCenterHistory])

  useEffect(() => {
    if (!isBattleCenterOpen) {
      return
    }

    void loadBattleCenterHistory(battleHistoryPage)
  }, [battleHistoryPage, isBattleCenterOpen, loadBattleCenterHistory])

  useEffect(() => {
    if (!selectedScene) {
      setSelectedSceneActiveBattle(null)
      setIsSelectedSceneActiveBattleLoading(false)
      return
    }

    let isMounted = true
    setIsSelectedSceneActiveBattleLoading(true)
    void fetchActiveBattle(selectedScene.sceneType, selectedScene.sceneSlug)
      .then((battle) => {
        if (!isMounted) {
          return
        }

        setSelectedSceneActiveBattle(battle)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setSelectedSceneActiveBattle(null)
      })
      .finally(() => {
        if (isMounted) {
          setIsSelectedSceneActiveBattleLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedScene])

  useEffect(() => {
    if (!isBattleCenterOpen || !selectedScene) {
      return
    }

    let isMounted = true
    setIsSelectedSceneActiveBattleLoading(true)
    void fetchActiveBattle(selectedScene.sceneType, selectedScene.sceneSlug)
      .then((battle) => {
        if (!isMounted) {
          return
        }

        setSelectedSceneActiveBattle(battle)
      })
      .catch(() => {
        if (!isMounted) {
          return
        }

        setSelectedSceneActiveBattle(null)
      })
      .finally(() => {
        if (isMounted) {
          setIsSelectedSceneActiveBattleLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isBattleCenterOpen, selectedScene])

  useEffect(() => {
    if (isTurnOnlyBattleChange(lastBroadcastBattleRef.current, activeBattle)) {
      if (
        activeBattle &&
        typeof activeBattle.id === "number" &&
        broadcastBattleTurn({
          battleId: activeBattle.id,
          sceneSlug: activeBattle.sceneSlug,
          currentTurnTokenNumber: activeBattle.currentTurnTokenNumber ?? null,
          roundNumber: activeBattle.roundNumber,
        })
      ) {
        setPresentationSyncStatus("broadcast")
      } else if (activeBattle) {
        setPresentationSyncStatus("storage")
      }

      setBattleScreenState(activeBattle, {
        presentationFriendlyMode: isPresentationFriendlyMode,
      })
      lastBroadcastBattleRef.current = activeBattle
      return
    }

    const nextSnapshot = JSON.stringify({
      battle: activeBattle,
      presentationFriendlyMode: isPresentationFriendlyMode,
    })
    if (nextSnapshot === lastBroadcastSnapshotRef.current) {
      return
    }

    setBattleScreenState(activeBattle, {
      presentationFriendlyMode: isPresentationFriendlyMode,
    })
    setPresentationSyncStatus("storage")
    lastBroadcastSnapshotRef.current = nextSnapshot
    lastBroadcastBattleRef.current = activeBattle
  }, [activeBattle, isPresentationFriendlyMode])

  const selectedBattleId = selectedBattle?.id ?? null

  const isSelectedBattleEditable = selectedBattle?.status === "active" && typeof selectedBattle.id === "number"

  useEffect(() => {
    updateBattleEditHistoryState(() => ({
      past: [],
      future: [],
    }))
  }, [isSelectedBattleEditable, selectedBattleId, updateBattleEditHistoryState])

  const applyBattleHistoryEntry = useCallback(
    (entry: BattleEditHistoryEntry) => {
      selectedBattleRef.current = entry.battle
      selectedTokenNumberRef.current = entry.selectedTokenNumber
      selectedObstacleIdRef.current = entry.selectedObstacleId
      setSelectedBattle(entry.battle)
      setActiveBattle((current) => (current?.id === entry.battle.id ? entry.battle : current))
      setSelectedTokenNumber(entry.selectedTokenNumber)
      setSelectedObstacleId(entry.selectedObstacleId)
    },
    [],
  )

  const pushBattleEditHistory = useCallback((battle: BattleState) => {
    const snapshot: BattleEditHistoryEntry = {
      battle,
      selectedTokenNumber: selectedTokenNumberRef.current,
      selectedObstacleId: selectedObstacleIdRef.current,
    }

    updateBattleEditHistoryState((current) => {
      const nextPast = appendUniqueBattleEditHistoryEntry(current.past, snapshot)
      if (nextPast === current.past && current.future.length === 0) {
        return current
      }

      return {
        past: nextPast,
        future: [],
      }
    })
  }, [updateBattleEditHistoryState])

  useEffect(() => {
    const syncVersion = saveSyncVersionRef.current + 1
    saveSyncVersionRef.current = syncVersion

    if (!isSelectedBattleEditable || !selectedBattle?.id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      setIsSaving(false)
      return
    }

    const snapshot = JSON.stringify(selectedBattle)
    if (snapshot === lastSyncedSnapshotRef.current) {
      setIsSaving(false)
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setIsSaving(true)
    setSaveError(null)

    saveTimeoutRef.current = setTimeout(() => {
      const battleToSave = selectedBattle
      const battleId = selectedBattle.id
      const stateSnapshot = snapshot

      if (typeof battleId !== "number") {
        setIsSaving(false)
        return
      }

      void updateBattle(battleId, battleToSave)
        .then((savedBattle) => {
          if (syncVersion !== saveSyncVersionRef.current) {
            return
          }

          const savedSnapshot = JSON.stringify(savedBattle)
          lastSyncedSnapshotRef.current = savedSnapshot
          selectedBattleRef.current = savedBattle
          setActiveBattle((current) => (current?.id === savedBattle.id ? savedBattle : current))
          setSelectedBattle((current) =>
            current?.id === savedBattle.id && JSON.stringify(current) === stateSnapshot ? savedBattle : current,
          )
        })
        .catch((error) => {
          if (syncVersion !== saveSyncVersionRef.current) {
            return
          }

          setSaveError(getBackendErrorMessage(error, "No se pudo guardar la batalla."))
        })
        .finally(() => {
          if (syncVersion !== saveSyncVersionRef.current) {
            return
          }

          setIsSaving(false)
        })
    }, 450)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [isSelectedBattleEditable, selectedBattle])

  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  const characterLibraryEntries = useMemo(() => {
    const query = deferredCharacterLibraryQuery.trim().toLocaleLowerCase("es")
    const sortedCharacters = [...characters].sort((left, right) => left.nombre.localeCompare(right.nombre, "es"))

    if (!query) {
      return sortedCharacters
    }

    return sortedCharacters.filter((character) => {
      const searchableText = [character.nombre, character.raza, character.clase]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .toLocaleLowerCase("es")

      return searchableText.includes(query)
    })
  }, [characters, deferredCharacterLibraryQuery])

  const normalizedMonsterLibraryQuery = useMemo(
    () => deferredCharacterLibraryQuery.trim(),
    [deferredCharacterLibraryQuery],
  )

  const handleToggleMonsterSort = useCallback((field: MonsterSortField) => {
    setMonsterLibrarySort((current) => {
      if (current.field !== field) {
        return { field, direction: "asc" }
      }

      return { field, direction: current.direction === "asc" ? "desc" : "asc" }
    })
  }, [])

  const fetchMonsterLibraryBatch = useCallback(
    async (offset: number, reset: boolean) => {
      const requestId = ++monsterSearchRequestRef.current

      if (reset) {
        setIsMonsterLibraryLoading(true)
        setIsMonsterLibraryLoadingMore(false)
      } else {
        setIsMonsterLibraryLoadingMore(true)
      }

      setMonsterLibraryError(null)

      try {
        const batch = await searchMonsters(normalizedMonsterLibraryQuery, MONSTER_LIBRARY_PAGE_SIZE, {
          offset,
          withTokenImage: false,
          summaryOnly: true,
          sortField: monsterLibrarySort.field,
          sortDirection: monsterLibrarySort.direction,
        })
        if (requestId !== monsterSearchRequestRef.current) {
          return
        }

        setMonsterLibraryEntries((current) => {
          if (reset) {
            return batch.items
          }

          const existingKeys = new Set(current.map((entry) => entry.nameExact.trim().toLocaleLowerCase("es")))
          const uniqueBatchItems = batch.items.filter(
            (entry) => !existingKeys.has(entry.nameExact.trim().toLocaleLowerCase("es")),
          )
          return [...current, ...uniqueBatchItems]
        })
        setMonsterLibraryTotal(batch.total)
        setMonsterLibraryHasMore(batch.hasMore)
      } catch (error) {
        if (requestId !== monsterSearchRequestRef.current) {
          return
        }

        if (reset) {
          setMonsterLibraryEntries([])
          setMonsterLibraryTotal(0)
          setMonsterLibraryHasMore(false)
        }

        setMonsterLibraryError(
          error instanceof Error ? error.message : "No se pudieron cargar monstruos para el selector.",
        )
      } finally {
        if (requestId === monsterSearchRequestRef.current) {
          setIsMonsterLibraryLoading(false)
          setIsMonsterLibraryLoadingMore(false)
        }
      }
    },
    [monsterLibrarySort.direction, monsterLibrarySort.field, normalizedMonsterLibraryQuery],
  )

  useEffect(() => {
    if (!isCharacterLibraryOpen || tokenLibrarySearchMode !== "monster") {
      monsterSearchRequestRef.current += 1
      setMonsterLibraryEntries([])
      setMonsterLibraryTotal(0)
      setMonsterLibraryHasMore(false)
      setIsMonsterLibraryLoading(false)
      setIsMonsterLibraryLoadingMore(false)
      setMonsterLibraryError(null)
      return
    }

    setMonsterLibraryEntries([])
    setMonsterLibraryTotal(0)
    setMonsterLibraryHasMore(false)
    void fetchMonsterLibraryBatch(0, true)
  }, [fetchMonsterLibraryBatch, isCharacterLibraryOpen, tokenLibrarySearchMode])

  const handleMonsterLibraryScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (
        tokenLibrarySearchMode !== "monster" ||
        isMonsterLibraryLoading ||
        isMonsterLibraryLoadingMore ||
        !monsterLibraryHasMore
      ) {
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
      if (scrollHeight - scrollTop - clientHeight > MONSTER_LIBRARY_SCROLL_THRESHOLD_PX) {
        return
      }

      void fetchMonsterLibraryBatch(monsterLibraryEntries.length, false)
    },
    [
      fetchMonsterLibraryBatch,
      isMonsterLibraryLoading,
      isMonsterLibraryLoadingMore,
      monsterLibraryEntries.length,
      monsterLibraryHasMore,
      tokenLibrarySearchMode,
    ],
  )

  const tokenLibraryEntries = useMemo<TokenLibraryEntry[]>(() => {
    const characterEntries = characterLibraryEntries.map<TokenLibraryEntry>((character) => ({
      kind: "character",
      key: `character-${character.id}`,
      name: character.nombre,
      image: character.imagen?.trim() || null,
      raceOrType: character.raza || "-",
      classOrCr: character.clase || "-",
      character,
    }))
    const monsterEntries = monsterLibraryEntries.map<TokenLibraryEntry>((monster) => ({
      kind: "monster",
      key: `monster-${monster.nameExact}`,
      name: monster.name,
      image: monster.image,
      raceOrType: monster.type || "-",
      classOrCr: monster.cr || "-",
      monster,
    }))

    return tokenLibrarySearchMode === "monster" ? monsterEntries : characterEntries
  }, [characterLibraryEntries, monsterLibraryEntries, tokenLibrarySearchMode])

  const selectedMonsterForTokenDialog = useMemo(() => {
    if (tokenDialogDraft.sourceType !== "monster") {
      return null
    }

    const sourceRef = tokenDialogDraft.sourceRef?.trim().toLocaleLowerCase("es")
    if (!sourceRef) {
      return null
    }

    return (
      monsterLibraryEntries.find((monster) => monster.nameExact.trim().toLocaleLowerCase("es") === sourceRef) ?? null
    )
  }, [monsterLibraryEntries, tokenDialogDraft.sourceRef, tokenDialogDraft.sourceType])

  const selectedMonsterTokenDialogImage = useMemo(() => {
    if (tokenDialogDraft.sourceType !== "monster") {
      return null
    }

    const draftImage = tokenDialogDraft.image.trim()
    if (draftImage) {
      return draftImage
    }

    const selectedImage = selectedMonsterForTokenDialog?.image?.trim()
    return selectedImage || null
  }, [selectedMonsterForTokenDialog?.image, tokenDialogDraft.image, tokenDialogDraft.sourceType])

  const libraryMonsterPanelImage = useMemo(() => {
    if (!libraryMonsterPanel) {
      return null
    }

    return resolveMonsterImage(libraryMonsterPanel)
  }, [libraryMonsterPanel])

  const selectedCharacterForCropDialog = useMemo(() => {
    if (typeof cropCharacterId !== "number" || cropCharacterId <= 0) {
      return null
    }

    return charactersById.get(cropCharacterId) ?? null
  }, [charactersById, cropCharacterId])

  const monsterBattleCropStyle = useMemo(() => {
    if (!monsterBattleCropDraft) {
      return undefined
    }

    return getBattleTokenImagePresentationStyle({
      imageFocusX: monsterBattleCropDraft.focusX,
      imageFocusY: monsterBattleCropDraft.focusY,
      imageZoom: monsterBattleCropDraft.zoom,
    })
  }, [monsterBattleCropDraft])

  const displayedSceneSlug = selectedBattle?.sceneSlug ?? selectedBattle?.landmarkSlug ?? selectedScene?.sceneSlug
  const displayedSceneTarget =
    selectedBattle
      ? {
          sceneType: selectedBattle.sceneType,
          sceneSlug: selectedBattle.sceneSlug,
        }
      : selectedScene
        ? {
            sceneType: selectedScene.sceneType,
            sceneSlug: selectedScene.sceneSlug,
          }
        : null
  const displayedSceneBuilding = useMemo(() => {
    if (!displayedSceneTarget || displayedSceneTarget.sceneType !== "building") {
      return null
    }

    return buildings.find((building) => landmarkNameToSlug(building.nombre) === displayedSceneTarget.sceneSlug) ?? null
  }, [buildings, displayedSceneTarget])
  const displayedSceneLandmark = useMemo(() => {
    if (!displayedSceneTarget || displayedSceneTarget.sceneType !== "landmark") {
      return null
    }

    return landmarks.find((landmark) => landmarkNameToSlug(landmark.nombre) === displayedSceneTarget.sceneSlug) ?? null
  }, [displayedSceneTarget, landmarks])
  const isFogOfWarSupported = useMemo(() => {
    if (!displayedSceneTarget) {
      return false
    }

    if (displayedSceneTarget.sceneType === "building") {
      if (!haveResolvedBuildings && !displayedSceneBuilding) {
        return true
      }

      return isBuildingFogSupported(displayedSceneBuilding)
    }

    return isLandmarkFogSupported(displayedSceneLandmark)
  }, [displayedSceneBuilding, displayedSceneLandmark, displayedSceneTarget, haveResolvedBuildings])

  const openSceneInPresentation = useCallback((target: PresentationScreenTarget) => {
    openPresentationScreen(target)
  }, [])
  const battleSceneLabelByKey = useMemo(() => {
    const nextMap = new Map<string, string>()

    for (const landmark of landmarks) {
      nextMap.set(`landmark:${landmarkNameToSlug(landmark.nombre)}`, landmark.nombre)
    }

    for (const building of buildings) {
      const parentLandmark = typeof building.landmarkId === "number" ? landmarks.find((item) => item.id === building.landmarkId) : null
      const key = `building:${landmarkNameToSlug(building.nombre)}`
      nextMap.set(key, parentLandmark ? `${building.nombre} · ${parentLandmark.nombre}` : building.nombre)
    }

    return nextMap
  }, [buildings, landmarks])
  const getBattleSceneLabel = useCallback(
    (battle: BattleSummary | BattleState) =>
      battleSceneLabelByKey.get(`${battle.sceneType}:${battle.sceneSlug}`) ??
      (battle.sceneType === "building" ? `${battle.sceneSlug} · ${battle.parentLandmarkSlug}` : battle.sceneSlug),
    [battleSceneLabelByKey],
  )
  const battleInfoSummary = useMemo(() => {
    if (!selectedBattle) {
      return null
    }

    const playerCount = selectedBattle.tokens.filter((token) => token.type === "player").length
    const enemyCount = selectedBattle.tokens.filter((token) => token.type === "enemy").length
    const hiddenTokenCount = selectedBattle.tokens.filter((token) => token.hidden).length
    const currentTurnToken =
      selectedBattle.currentTurnTokenNumber == null
        ? null
        : selectedBattle.tokens.find((token) => token.number === selectedBattle.currentTurnTokenNumber) ?? null

    return {
      statusLabel: selectedBattle.status === "active" ? "Activa" : "Terminada",
      sceneTypeLabel: selectedBattle.sceneType === "building" ? "Building" : "Landmark",
      playerCount,
      enemyCount,
      hiddenTokenCount,
      currentTurnLabel:
        selectedBattle.currentTurnTokenNumber == null
          ? "Sin turno"
          : currentTurnToken
            ? `#${currentTurnToken.number} · ${currentTurnToken.nombre}`
            : `#${selectedBattle.currentTurnTokenNumber}`,
      createdAtLabel: formatBattleDateTime(selectedBattle.createdAt),
      updatedAtLabel: formatBattleDateTime(selectedBattle.updatedAt),
      endedAtLabel: formatBattleDateTime(selectedBattle.endedAt),
    }
  }, [selectedBattle])
  const visibleActiveBattles = battleCenterHistory.activeBattles
  const visibleFinishedBattles = battleCenterHistory.finishedBattles

  const scheduleInputFocus = useCallback((inputRef: { current: HTMLInputElement | null }) => {
    window.requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) {
        return
      }

      input.focus()
      input.select()
    })
  }, [])

  const handleTokenSelectionPopoverInteractOutside = useCallback((event: Event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (target.closest('[data-battle-wheel-stop="true"]')) {
      event.preventDefault()
    }
  }, [])

  const handleTokenPanelPick = useCallback((tokenNumber: number) => {
    if (isLifeModifierDialogOpen) {
      setLifeModifierError(null)
      setLifeModifierTokenNumber(String(tokenNumber))
      scheduleInputFocus(lifeModifierValueInputRef)
      return
    }

    if (isStatusLoaderDialogOpen) {
      setStatusLoaderError(null)
      setStatusLoaderTokenNumber(String(tokenNumber))
    }
  }, [
    isLifeModifierDialogOpen,
    isStatusLoaderDialogOpen,
    scheduleInputFocus,
  ])

  const handleSelectToken = useCallback((tokenNumber: number) => {
    setSelectedTokenNumber(tokenNumber)
    setSelectedObstacleId(null)
  }, [])

  const handleSelectObstacle = useCallback((obstacleId: number) => {
    setSelectedObstacleId(obstacleId)
    setSelectedTokenNumber(null)
  }, [])

  const updateSelectedBattle = useCallback((updater: (current: BattleState) => BattleState) => {
    setSelectedBattle((current) => {
      if (!current || !isSelectedBattleEditable) {
        return current
      }

      const nextBattle = sortBattleState(updater(current))
      if (JSON.stringify(nextBattle) === JSON.stringify(current)) {
        selectedBattleRef.current = current
        return current
      }

      pushBattleEditHistory(current)
      selectedBattleRef.current = nextBattle
      setActiveBattle((activeCurrent) => (activeCurrent?.id === nextBattle.id ? nextBattle : activeCurrent))
      return nextBattle
    })
  }, [isSelectedBattleEditable, pushBattleEditHistory])

  const handleAdvanceTurn = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    setSelectedBattle((current) => {
      if (!current) {
        return current
      }

      const orderedTokens = getOrderedInitiativeTokens(current.tokens)
      const normalizedCurrentTurnTokenNumber = normalizeCurrentTurnTokenNumber(
        current.tokens,
        current.currentTurnTokenNumber ?? null,
      )
      const currentTurnIndex = orderedTokens.findIndex((token) => token.number === normalizedCurrentTurnTokenNumber)
      const nextTurnTokenNumber =
        currentTurnIndex >= 0
          ? orderedTokens[(currentTurnIndex + 1) % orderedTokens.length]?.number ?? null
          : orderedTokens[0]?.number ?? null
      if ((current.currentTurnTokenNumber ?? null) === nextTurnTokenNumber) {
        selectedBattleRef.current = current
        return current
      }

      pushBattleEditHistory(current)
      const wrappedRound =
        orderedTokens.length > 1 &&
        currentTurnIndex >= 0 &&
        currentTurnIndex === orderedTokens.length - 1 &&
        nextTurnTokenNumber === orderedTokens[0]?.number

      const nextBattle = {
        ...current,
        roundNumber: wrappedRound ? current.roundNumber + 1 : current.roundNumber,
        currentTurnTokenNumber: nextTurnTokenNumber,
      }
      selectedBattleRef.current = nextBattle

      if (typeof nextBattle.id === "number") {
        const didBroadcastTurn = broadcastBattleTurn({
          battleId: nextBattle.id,
          sceneSlug: nextBattle.sceneSlug,
          currentTurnTokenNumber: nextBattle.currentTurnTokenNumber ?? null,
          roundNumber: nextBattle.roundNumber,
        })

        setBattleScreenState(nextBattle, {
          presentationFriendlyMode: isPresentationFriendlyMode,
        })
        setPresentationSyncStatus(didBroadcastTurn ? "broadcast" : "storage")
      }

      setActiveBattle((activeCurrent) => (activeCurrent?.id === nextBattle.id ? nextBattle : activeCurrent))
      return nextBattle
    })
  }, [isPresentationFriendlyMode, isSelectedBattleEditable, pushBattleEditHistory])

  const handleResetBattleInitiatives = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    updateSelectedBattle((current) => ({
      ...current,
      currentTurnTokenNumber: null,
      tokens: current.tokens.map((token) => ({
        ...token,
        initiative: getResetInitiativeForToken(token, charactersById, monsterByNameCacheRef.current),
      })),
    }))
  }, [charactersById, isSelectedBattleEditable, updateSelectedBattle])

  useEffect(() => {
    const handlePresentationShortcutKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(event.target) || event.repeat) {
        return
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault()
        handleResetBattleInitiatives()
        return
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }

      if (event.key.toLowerCase() !== "f") {
        return
      }

      event.preventDefault()
      setIsPresentationFriendlyMode((current) => !current)
    }

    window.addEventListener("keydown", handlePresentationShortcutKeyDown)
    return () => {
      window.removeEventListener("keydown", handlePresentationShortcutKeyDown)
    }
  }, [handleResetBattleInitiatives])

  const handleUndoBattleEdit = useCallback(() => {
    const currentBattle = selectedBattleRef.current
    const history = battleEditHistoryRef.current

    if (!isSelectedBattleEditable || !currentBattle || history.past.length === 0) {
      return
    }

    const currentEntry: BattleEditHistoryEntry = {
      battle: currentBattle,
      selectedTokenNumber: selectedTokenNumberRef.current,
      selectedObstacleId: selectedObstacleIdRef.current,
    }
    const previousEntryIndex = findPreviousDistinctBattleEditHistoryEntryIndex(history.past, currentEntry)

    if (previousEntryIndex < 0) {
      updateBattleEditHistoryState((current) => {
        const nextPastEnd = findPreviousDistinctBattleEditHistoryEntryIndex(current.past, currentEntry) + 1
        const nextPast = current.past.slice(0, nextPastEnd)
        return nextPast.length === current.past.length
          ? current
          : {
              past: nextPast,
              future: current.future,
            }
      })
      return
    }

    const previousEntry = history.past[previousEntryIndex]

    applyBattleHistoryEntry(previousEntry)
    updateBattleEditHistoryState(() => ({
      past: history.past.slice(0, previousEntryIndex),
      future: prependUniqueBattleEditHistoryEntry(history.future, currentEntry),
    }))
  }, [applyBattleHistoryEntry, isSelectedBattleEditable, updateBattleEditHistoryState])

  const handleRedoBattleEdit = useCallback(() => {
    const currentBattle = selectedBattleRef.current
    const history = battleEditHistoryRef.current

    if (!isSelectedBattleEditable || !currentBattle || history.future.length === 0) {
      return
    }

    const currentEntry: BattleEditHistoryEntry = {
      battle: currentBattle,
      selectedTokenNumber: selectedTokenNumberRef.current,
      selectedObstacleId: selectedObstacleIdRef.current,
    }
    const nextEntryIndex = findNextDistinctBattleEditHistoryEntryIndex(history.future, currentEntry)

    if (nextEntryIndex >= history.future.length) {
      updateBattleEditHistoryState((current) => {
        const nextFutureStart = findNextDistinctBattleEditHistoryEntryIndex(current.future, currentEntry)
        const nextFuture = current.future.slice(nextFutureStart)
        return nextFuture.length === current.future.length
          ? current
          : {
              past: current.past,
              future: nextFuture,
            }
      })
      return
    }

    const nextEntry = history.future[nextEntryIndex]
    const remainingFuture = history.future.slice(nextEntryIndex + 1)

    applyBattleHistoryEntry(nextEntry)
    updateBattleEditHistoryState(() => ({
      past: appendUniqueBattleEditHistoryEntry(history.past, currentEntry),
      future: remainingFuture,
    }))
  }, [applyBattleHistoryEntry, isSelectedBattleEditable, updateBattleEditHistoryState])

  useEffect(() => {
    undoBattleEditRef.current = handleUndoBattleEdit
  }, [handleUndoBattleEdit])

  useEffect(() => {
    redoBattleEditRef.current = handleRedoBattleEdit
  }, [handleRedoBattleEdit])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return
      }

      if (shouldIgnoreShortcutTarget(event.target)) {
        return
      }

      if (event.repeat) {
        return
      }

      if (event.code === "KeyZ") {
        event.preventDefault()
        if (event.shiftKey) {
          redoBattleEditRef.current()
        } else {
          undoBattleEditRef.current()
        }
        return
      }

      if (event.code === "KeyY" && !event.shiftKey) {
        event.preventDefault()
        redoBattleEditRef.current()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const updateToken = useCallback(
    (tokenNumber: number, updater: (token: BattleToken) => BattleToken) => {
      updateSelectedBattle((current) => ({
        ...current,
        tokens: current.tokens.map((token) => (token.number === tokenNumber ? updater(token) : token)),
      }))
    },
    [updateSelectedBattle],
  )

  const createToken = useCallback(
    (type: BattleToken["type"], draft?: TokenFormDraft, autoInitiativeModifier = 0) => {
      if (!isSelectedBattleEditable) {
        return
      }

      let createdTokenNumber: number | null = null

      updateSelectedBattle((current) => {
        const tokenNumber = current.nextTokenNumber
        createdTokenNumber = tokenNumber
        const hasCharacterId = typeof draft?.characterId === "number" && draft.characterId > 0
        const draftSourceType = draft?.sourceType
        const nextSourceType: BattleToken["sourceType"] = hasCharacterId
          ? "character"
          : draftSourceType === "monster"
            ? "monster"
            : "manual"
        const manualInitiative = draft ? parseDecimalInput(draft.initiative) : undefined
        const rolledInitiative = rollInitiativeDie() + autoInitiativeModifier
        const shouldAutoRollInitiative = manualInitiative === undefined
        const nextInitiative = shouldAutoRollInitiative ? rolledInitiative : manualInitiative
        const parsedLife = draft ? parseNumberInput(draft.life) : undefined
        const nextLife = type === "enemy" ? parsedLife ?? 0 : parsedLife
        const draftName = typeof draft?.nombre === "string" ? draft.nombre.trim() : ""
        const draftStatus = normalizeBattleConditionStatus(typeof draft?.status === "string" ? draft.status : "")
        const draftStatusDurationTurns = draftStatus
          ? parseConditionDurationTurns(draft?.statusDurationTurns ?? DEFAULT_CONDITION_DURATION_TURNS) ?? 1
          : undefined
        const draftImageValue = typeof draft?.image === "string" ? draft.image : ""
        const nextSourceRef =
          hasCharacterId
            ? String(draft!.characterId)
            : nextSourceType === "monster"
              ? draft?.sourceRef?.trim() || undefined
              : undefined
        const draftImage =
          draft && (typeof draft.imageAssetId === "number" && draft.imageAssetId > 0
            ? draftImageValue
            : draftImageValue.trim())
        const normalizedImageCrop = normalizeBattleTokenImageCrop(draft)
        const nextToken: BattleToken = {
          number: tokenNumber,
          nombre: draftName || `${type === "player" ? "Jugador" : "Enemigo"} ${tokenNumber}`,
          characterId: hasCharacterId && draft ? (draft.characterId as number) : undefined,
          sourceType: nextSourceType,
          sourceRef: nextSourceRef,
          image: draftImage || undefined,
          imageAssetId:
            typeof draft?.imageAssetId === "number" && draft.imageAssetId > 0 ? draft.imageAssetId : undefined,
          imageFocusX: normalizedImageCrop.focusX,
          imageFocusY: normalizedImageCrop.focusY,
          imageZoom: normalizedImageCrop.zoom,
          type,
          x: 50,
          y: 50,
          initiative: nextInitiative,
          life: nextLife,
          size: 1,
          status: draftStatus,
          statusDurationTurns: draftStatusDurationTurns,
          hidden: true,
        }

        return {
          ...current,
          nextTokenNumber: tokenNumber + 1,
          tokens: [...current.tokens, nextToken],
        }
      })

      if (createdTokenNumber !== null) {
        setSelectedTokenNumber(createdTokenNumber)
        setSelectedObstacleId(null)
      }
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const removeToken = useCallback(
    (tokenNumber: number) => {
      if (!isSelectedBattleEditable) {
        return
      }

      updateSelectedBattle((current) => ({
        ...current,
        tokens: current.tokens.filter((token) => token.number !== tokenNumber),
      }))
      setSelectedTokenNumber((current) => (current === tokenNumber ? null : current))
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const duplicateToken = useCallback(
    (tokenNumber: number) => {
      if (!isSelectedBattleEditable) {
        return
      }

      let duplicatedTokenNumber: number | null = null

      updateSelectedBattle((current) => {
        const sourceToken = current.tokens.find((token) => token.number === tokenNumber)
        if (!sourceToken) {
          return current
        }

        const nextTokenNumber = current.nextTokenNumber
        duplicatedTokenNumber = nextTokenNumber
        const duplicatedToken: BattleToken = {
          ...sourceToken,
          number: nextTokenNumber,
          initiative: rollInitiativeDie(),
        }

        return {
          ...current,
          nextTokenNumber: nextTokenNumber + 1,
          tokens: [...current.tokens, duplicatedToken],
        }
      })

      if (duplicatedTokenNumber !== null) {
        setSelectedTokenNumber(duplicatedTokenNumber)
        setSelectedObstacleId(null)
      }
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const openTokenDialog = useCallback((type: BattleToken["type"]) => {
    if (!isSelectedBattleEditable) {
      return
    }

    setTokenDialogType(type)
    setTokenDialogDraft(createEmptyTokenFormDraft(type))
    setIsCharacterLibraryOpen(false)
    setCharacterLibraryQuery("")
    setCropCharacterId(null)
    setIsCharacterCropDialogOpen(false)
    setIsTokenDialogOpen(true)
  }, [isSelectedBattleEditable])

  const handleSaveTokenDraftPreset = useCallback(() => {
    setSavedTokenDrafts((current) => ({
      ...current,
      [tokenDialogType]: { ...tokenDialogDraft },
    }))
  }, [tokenDialogDraft, tokenDialogType])

  const handleRestoreTokenDraftPreset = useCallback(() => {
    const savedDraft = savedTokenDrafts[tokenDialogType]
    if (!savedDraft) {
      return
    }

    const hasCharacterId = typeof savedDraft.characterId === "number" && savedDraft.characterId > 0
    const normalizedImageCrop = normalizeBattleTokenImageCrop(savedDraft)
    setTokenDialogDraft({
      ...savedDraft,
      sourceType: hasCharacterId ? "character" : savedDraft.sourceType ?? "manual",
      sourceRef: hasCharacterId ? String(savedDraft.characterId) : savedDraft.sourceRef ?? null,
      imageFocusX: normalizedImageCrop.focusX,
      imageFocusY: normalizedImageCrop.focusY,
      imageZoom: normalizedImageCrop.zoom,
      statusDurationTurns: savedDraft.statusDurationTurns ?? (savedDraft.status ? DEFAULT_CONDITION_DURATION_TURNS : ""),
    })
  }, [savedTokenDrafts, tokenDialogType])

  const handleSubmitTokenDialog = useCallback(async () => {
    let nextDraft = tokenDialogDraft
    let linkedMonsterRecord: MonsterRecord | null = null
    let autoInitiativeModifier = 0

    if (tokenDialogDraft.sourceType === "monster") {
      const sourceRef = tokenDialogDraft.sourceRef?.trim() ?? ""
      if (sourceRef) {
        const cacheKey = sourceRef.toLocaleLowerCase("es")
        linkedMonsterRecord = monsterByNameCacheRef.current.get(cacheKey) ?? null

        try {
          if (!linkedMonsterRecord) {
            linkedMonsterRecord = await fetchMonsterByExactName(sourceRef, { withTokenImage: true })
            if (linkedMonsterRecord) {
              monsterByNameCacheRef.current.set(cacheKey, linkedMonsterRecord)
            }
          }

          const resolvedMonster = linkedMonsterRecord
          const resolvedImage = resolvedMonster ? (resolveMonsterImage(resolvedMonster) ?? "").trim() : ""

          if (!tokenDialogDraft.image.trim() && resolvedImage) {
            nextDraft = {
              ...tokenDialogDraft,
              image: resolvedImage,
              imageAssetId: null,
              ...(tokenDialogDraft.image.trim() !== resolvedImage.trim()
                ? {
                    imageFocusX: 50,
                    imageFocusY: 50,
                    imageZoom: 1,
                  }
                : {}),
            }
            setTokenDialogDraft(nextDraft)
          }
        } catch {
          // Ignore and keep current draft fallback.
        }
      }
    }

    if (nextDraft.sourceType === "character") {
      const linkedCharacterId =
        typeof nextDraft.characterId === "number" && nextDraft.characterId > 0
          ? nextDraft.characterId
          : Number.parseInt(nextDraft.sourceRef ?? "", 10)
      const linkedCharacter = Number.isFinite(linkedCharacterId) ? (charactersById.get(linkedCharacterId) ?? null) : null
      autoInitiativeModifier = getCharacterDexterityModifier(linkedCharacter)
    } else if (nextDraft.sourceType === "monster" && linkedMonsterRecord) {
      autoInitiativeModifier = extractMonsterInitiativeModifier(linkedMonsterRecord)
    } else {
      autoInitiativeModifier = 0
    }

    createToken(tokenDialogType, nextDraft, autoInitiativeModifier)
    setIsCharacterLibraryOpen(false)
    setCharacterLibraryQuery("")
    setCropCharacterId(null)
    setIsCharacterCropDialogOpen(false)
    setIsTokenDialogOpen(false)
  }, [charactersById, createToken, tokenDialogDraft, tokenDialogType])

  const hydrateMonsterTokenDialogImage = useCallback((monsterNameExact: string) => {
    const selectedSourceRef = monsterNameExact.trim().toLocaleLowerCase("es")
    if (!selectedSourceRef) {
      return
    }

    void fetchMonsterByExactName(monsterNameExact, { withTokenImage: true })
      .then((resolvedMonster) => {
        const resolvedImage = resolvedMonster ? (resolveMonsterImage(resolvedMonster) ?? "").trim() : ""

        if (!resolvedImage) {
          return
        }

        setMonsterLibraryEntries((current) =>
          current.map((entry) =>
            entry.nameExact.trim().toLocaleLowerCase("es") === selectedSourceRef
              ? { ...entry, image: resolvedImage }
              : entry,
          ),
        )
        setTokenDialogDraft((current) => {
          if (current.sourceType !== "monster") {
            return current
          }

          const currentSourceRef = current.sourceRef?.trim().toLocaleLowerCase("es")
          if (currentSourceRef !== selectedSourceRef) {
            return current
          }

          return {
            ...current,
            image: resolvedImage,
            imageAssetId: null,
            ...(current.image.trim() !== resolvedImage
              ? {
                  imageFocusX: 50,
                  imageFocusY: 50,
                  imageZoom: 1,
                }
              : {}),
          }
        })
      })
      .catch(() => {})
  }, [])

  const handleSelectCharacterForTokenDialog = useCallback((character: Character) => {
    setTokenDialogDraft((current) => ({
      ...current,
      nombre: character.nombre,
      characterId: character.id,
      sourceType: "character",
      sourceRef: String(character.id),
      imageFocusX: 50,
      imageFocusY: 50,
      imageZoom: 1,
    }))
    setIsCharacterLibraryOpen(false)
    scheduleTokenLibraryDialogCloseCleanup()
  }, [scheduleTokenLibraryDialogCloseCleanup])

  const handleSelectMonsterForTokenDialog = useCallback((monster: MonsterListItem) => {
    setTokenDialogDraft((current) => ({
      ...current,
      nombre: monster.name,
      characterId: null,
      sourceType: "monster",
      sourceRef: monster.nameExact,
      image: monster.image ?? "",
      imageAssetId: null,
      imageFocusX: 50,
      imageFocusY: 50,
      imageZoom: 1,
      life: typeof monster.hpAverage === "number" ? String(monster.hpAverage) : current.life,
      initiativeModifier: String(monster.initiativeModifier),
    }))
    setIsCharacterLibraryOpen(false)
    scheduleTokenLibraryDialogCloseCleanup()
    hydrateMonsterTokenDialogImage(monster.nameExact)
  }, [hydrateMonsterTokenDialogImage, scheduleTokenLibraryDialogCloseCleanup])

  useEffect(() => {
    if (tokenDialogDraft.sourceType !== "monster") {
      return
    }

    const sourceRef = tokenDialogDraft.sourceRef?.trim()
    if (!sourceRef || selectedMonsterTokenDialogImage) {
      return
    }

    hydrateMonsterTokenDialogImage(sourceRef)
  }, [
    hydrateMonsterTokenDialogImage,
    selectedMonsterTokenDialogImage,
    tokenDialogDraft.sourceRef,
    tokenDialogDraft.sourceType,
  ])

  const handleOpenLibraryCharacterSheet = useCallback((character: Character) => {
    if (!character.characterSheet) {
      return
    }

    setLibrarySheetCharacter(character)
    setIsLibrarySheetOpen(true)
  }, [])

  const handleOpenLibraryMonsterPanel = useCallback(
    async (monsterName: string) => {
      setIsLibraryMonsterPanelDialogOpen(true)
      setMonsterPanelError(null)
      setIsMonsterPanelLoading(true)
      setLibraryMonsterPanel(null)
      try {
        const monster = await getMonsterByExactNameCached(monsterName)
        if (!monster) {
          setLibraryMonsterPanel(null)
          setMonsterPanelError("No se encontró ese monstruo en el dataset.")
          return
        }

        setLibraryMonsterPanel(monster)
      } catch (error) {
        setLibraryMonsterPanel(null)
        setMonsterPanelError(error instanceof Error ? error.message : "No se pudo abrir el panel del monstruo.")
      } finally {
        setIsMonsterPanelLoading(false)
      }
    },
    [getMonsterByExactNameCached],
  )

  const handleSaveCharacterCrop = useCallback(
    async (nextValues: {
      tokenCrop: { focusX: number; focusY: number; zoom: number }
      initiativeCrop: { focusX: number; focusY: number; zoom: number }
    }) => {
      if (!selectedCharacterForCropDialog) {
        return
      }

      setIsSavingCharacterCrop(true)
      try {
        const updatedCharacter = await updateCharacter(selectedCharacterForCropDialog.id, {
          ...selectedCharacterForCropDialog,
          tokenImageFocusX: nextValues.tokenCrop.focusX,
          tokenImageFocusY: nextValues.tokenCrop.focusY,
          tokenImageZoom: nextValues.tokenCrop.zoom,
          initiativeImageFocusX: nextValues.initiativeCrop.focusX,
          initiativeImageFocusY: nextValues.initiativeCrop.focusY,
          initiativeImageZoom: nextValues.initiativeCrop.zoom,
        })

        setCharacters((current) =>
          current.map((character) => (character.id === updatedCharacter.id ? updatedCharacter : character)),
        )
        setIsCharacterCropDialogOpen(false)
      } catch (error) {
        setSaveError(getBackendErrorMessage(error, "No se pudo guardar el encuadre del personaje."))
      } finally {
        setIsSavingCharacterCrop(false)
      }
    },
    [selectedCharacterForCropDialog],
  )

  const getLinkedCharacterFromToken = useCallback(
    (token: BattleToken) => {
      const characterId = typeof token.characterId === "number" ? token.characterId : null
      if (characterId && characterId > 0) {
        return charactersById.get(characterId) ?? null
      }

      const sourceRef = token.sourceRef?.trim()
      if (token.sourceType === "character" && sourceRef) {
        const parsedCharacterId = Number.parseInt(sourceRef, 10)
        if (Number.isFinite(parsedCharacterId) && parsedCharacterId > 0) {
          return charactersById.get(parsedCharacterId) ?? null
        }

        const normalizedSourceRef = sourceRef.toLocaleLowerCase("es")
        const bySourceName =
          characters.find((character) => character.nombre.trim().toLocaleLowerCase("es") === normalizedSourceRef) ?? null
        if (bySourceName) {
          return bySourceName
        }
      }

      const tokenName = token.nombre.trim()
      if (!tokenName) {
        return null
      }

      const normalizedTokenName = tokenName.toLocaleLowerCase("es")
      return characters.find((character) => character.nombre.trim().toLocaleLowerCase("es") === normalizedTokenName) ?? null
    },
    [characters, charactersById],
  )

  const isTokenDetailAvailable = useCallback(
    (token: BattleToken) => {
      const linkedCharacter = getLinkedCharacterFromToken(token)
      if (linkedCharacter) {
        return Boolean(linkedCharacter?.characterSheet)
      }

      return Boolean(getMonsterSourceRefFromToken(token))
    },
    [getLinkedCharacterFromToken],
  )

  const handleRequestTokenCropEdit = useCallback(
    (tokenNumber: number) => {
      const token = selectedBattle?.tokens.find((entry) => entry.number === tokenNumber)
      if (!token) {
        return
      }

      const linkedCharacter = getLinkedCharacterFromToken(token)
      setSaveError(null)
      setIsCharacterLibraryOpen(false)
      setIsTokenDialogOpen(false)
      setIsMonsterDetailDialogOpen(false)
      setDetailMonsterPanel(null)
      setMonsterDetailError(null)

      if (linkedCharacter?.imagen) {
        setMonsterBattleCropDraft(null)
        setCropCharacterId(linkedCharacter.id)
        setIsCharacterCropDialogOpen(true)
        return
      }

      const monsterSourceKey = getMonsterSourceKeyFromToken(token)
      if (!monsterSourceKey) {
        setSaveError("La ficha no tiene un origen de monstruo válido para ajustar encuadre.")
        return
      }

      const groupedMonsterTokens = (selectedBattle?.tokens ?? []).filter(
        (entry) => getMonsterSourceKeyFromToken(entry) === monsterSourceKey,
      )
      const tokenWithImage = groupedMonsterTokens.find((entry) => {
        const image = entry.image?.trim()
        return Boolean(image)
      })
      const image = tokenWithImage?.image?.trim() ?? ""

      if (!image) {
        setSaveError("Ese tipo de monstruo no tiene imagen cargada para ajustar encuadre.")
        return
      }

      const initialCrop = normalizeBattleTokenImageCrop(tokenWithImage ?? token)
      const rawSourceLabel = getMonsterSourceRefFromToken(token) ?? token.nombre.trim()
      const sourceLabel = rawSourceLabel || `Ficha #${token.number}`

      setCropCharacterId(null)
      setIsCharacterCropDialogOpen(false)
      setMonsterBattleCropDraft({
        sourceKey: monsterSourceKey,
        sourceLabel,
        image,
        focusX: initialCrop.focusX,
        focusY: initialCrop.focusY,
        zoom: initialCrop.zoom,
      })
    },
    [getLinkedCharacterFromToken, selectedBattle?.tokens],
  )

  const handleSaveMonsterBattleCrop = useCallback(() => {
    if (!isSelectedBattleEditable || !monsterBattleCropDraft) {
      return
    }

    const nextCrop = normalizeBattleTokenImageCrop({
      imageFocusX: monsterBattleCropDraft.focusX,
      imageFocusY: monsterBattleCropDraft.focusY,
      imageZoom: monsterBattleCropDraft.zoom,
    })
    const sourceKey = monsterBattleCropDraft.sourceKey
    let matchedTokenCount = 0

    updateSelectedBattle((current) => {
      let hasChanges = false
      const nextTokens = current.tokens.map((token) => {
        if (getMonsterSourceKeyFromToken(token) !== sourceKey) {
          return token
        }

        matchedTokenCount += 1
        const currentCrop = normalizeBattleTokenImageCrop(token)
        if (
          currentCrop.focusX === nextCrop.focusX &&
          currentCrop.focusY === nextCrop.focusY &&
          currentCrop.zoom === nextCrop.zoom
        ) {
          return token
        }

        hasChanges = true
        return {
          ...token,
          imageFocusX: nextCrop.focusX,
          imageFocusY: nextCrop.focusY,
          imageZoom: nextCrop.zoom,
        }
      })

      return hasChanges
        ? {
            ...current,
            tokens: nextTokens,
          }
        : current
    })

    if (matchedTokenCount === 0) {
      setSaveError("No se encontraron fichas de ese monstruo en esta batalla.")
      return
    }

    setSaveError(null)
    setMonsterBattleCropDraft(null)
  }, [isSelectedBattleEditable, monsterBattleCropDraft, updateSelectedBattle])

  const handleRequestTokenDetail = useCallback(
    async (tokenNumber: number) => {
      const token = selectedBattle?.tokens.find((entry) => entry.number === tokenNumber)
      if (!token) {
        return
      }

      setIsCharacterLibraryOpen(false)
      setIsTokenDialogOpen(false)

      const linkedCharacter = getLinkedCharacterFromToken(token)
      if (linkedCharacter) {
        if (!linkedCharacter?.characterSheet) {
          return
        }

        setIsMonsterDetailDialogOpen(false)
        setLibrarySheetCharacter(linkedCharacter)
        setIsLibrarySheetOpen(true)
        return
      }

      const monsterSourceRef = getMonsterSourceRefFromToken(token)
      if (!monsterSourceRef) {
        return
      }

      setMonsterDetailError(null)
      setIsMonsterDetailLoading(true)
      setDetailMonsterPanel(null)
      setIsLibrarySheetOpen(false)
      setLibrarySheetCharacter(null)
      setIsMonsterDetailDialogOpen(true)
      try {
        const monster = await getMonsterByExactNameCached(monsterSourceRef)
        if (!monster) {
          setMonsterDetailError("No se encontró el monstruo asociado a esta ficha.")
          return
        }

        setDetailMonsterPanel(monster)
      } catch (error) {
        setMonsterDetailError(error instanceof Error ? error.message : "No se pudo cargar el monstruo asociado.")
      } finally {
        setIsMonsterDetailLoading(false)
      }
    },
    [getLinkedCharacterFromToken, getMonsterByExactNameCached, selectedBattle?.tokens],
  )

  const updateObstacle = useCallback(
    (obstacleId: number, updater: (obstacle: BattleObstacle) => BattleObstacle) => {
      updateSelectedBattle((current) => ({
        ...current,
        obstacles: current.obstacles.map((obstacle) => (obstacle.id === obstacleId ? updater(obstacle) : obstacle)),
      }))
    },
    [updateSelectedBattle],
  )

  const createObstacle = useCallback(
    (shape: BattleObstacleShape) => {
      if (!isSelectedBattleEditable) {
        return
      }

      let createdObstacleId: number | null = null

      updateSelectedBattle((current) => {
        const obstacleId = current.nextObstacleId
        createdObstacleId = obstacleId
        const diameter = 8
        const nextObstacle: BattleObstacle = {
          id: obstacleId,
          shape,
          x: 50,
          y: 50,
          width: shape === "circle" ? diameter : 14,
          height: shape === "circle" ? diameter : 8,
          color: shape === "circle" ? "#f59e0b" : "#0f766e",
        }

        return {
          ...current,
          nextObstacleId: obstacleId + 1,
          obstacles: [...current.obstacles, nextObstacle],
        }
      })

      if (createdObstacleId !== null) {
        setSelectedObstacleId(createdObstacleId)
        setSelectedTokenNumber(null)
      }
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const removeObstacle = useCallback(
    (obstacleId: number) => {
      if (!isSelectedBattleEditable) {
        return
      }

      updateSelectedBattle((current) => ({
        ...current,
        obstacles: current.obstacles.filter((obstacle) => obstacle.id !== obstacleId),
      }))
      setSelectedObstacleId((current) => (current === obstacleId ? null : current))
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const createFogReveal = useCallback(
    (draftReveal: Omit<BattleFogReveal, "id">) => {
      if (!isSelectedBattleEditable || !isFogOfWarSupported) {
        return
      }

      updateSelectedBattle((current) => {
        const nextReveal: BattleFogReveal = {
          id: current.nextFogRevealId,
          x: draftReveal.x,
          y: draftReveal.y,
          width: draftReveal.width,
          height: draftReveal.height,
        }

        return {
          ...current,
          fogEnabled: true,
          nextFogRevealId: current.nextFogRevealId + 1,
          fogReveals: [...current.fogReveals, nextReveal],
        }
      })
    },
    [isFogOfWarSupported, isSelectedBattleEditable, updateSelectedBattle],
  )

  const coverFogArea = useCallback(
    (coveredArea: Omit<BattleFogReveal, "id">) => {
      if (!isSelectedBattleEditable) {
        return
      }

      updateSelectedBattle((current) => {
        let nextFogRevealId = current.nextFogRevealId
        const nextFogReveals: BattleFogReveal[] = []

        for (const reveal of current.fogReveals) {
          const fragments = subtractFogAreaFromReveal(reveal, coveredArea)
          if (fragments.length === 0) {
            continue
          }

          fragments.forEach((fragment, index) => {
            nextFogReveals.push({
              id: index === 0 ? reveal.id : nextFogRevealId++,
              ...fragment,
            })
          })
        }

        return {
          ...current,
          nextFogRevealId,
          fogReveals: nextFogReveals,
        }
      })
    },
    [isSelectedBattleEditable, updateSelectedBattle],
  )

  const setFogEnabled = useCallback(
    (nextEnabled: boolean) => {
      if (!isSelectedBattleEditable) {
        return
      }

      if (!isFogOfWarSupported) {
        serviceMessage.info({
          title: "Niebla no disponible",
          description: "Por ahora la niebla de guerra solo funciona sobre mapas de imagen.",
        })
        return
      }

      updateSelectedBattle((current) => ({
        ...current,
        fogEnabled: nextEnabled,
      }))
    },
    [isFogOfWarSupported, isSelectedBattleEditable, updateSelectedBattle],
  )

  const clearFogReveals = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    updateSelectedBattle((current) => ({
      ...current,
      fogEnabled: true,
      fogReveals: [],
    }))
  }, [isSelectedBattleEditable, updateSelectedBattle])

  const handleApplyLifeModifier = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    const tokenNumber = parseNumberInput(lifeModifierTokenNumber)
    const modifier = parseLifeModifierInput(lifeModifierValue)

    if (!tokenNumber || tokenNumber <= 0) {
      setLifeModifierError("Indicá una ficha válida.")
      return
    }

    if (!modifier) {
      setLifeModifierError('Indicá un modificador válido (ej: "12" o "+2").')
      return
    }

    let nextError: string | null = null
    let wasApplied = false

    updateSelectedBattle((current) => {
      const targetToken = current.tokens.find((token) => token.number === tokenNumber)
      if (!targetToken) {
        nextError = `No existe la ficha #${tokenNumber}.`
        return current
      }

      const currentLife = typeof targetToken.life === "number" && Number.isFinite(targetToken.life) ? targetToken.life : 0
      const lifeDelta = modifier.hasExplicitSign ? modifier.value : -Math.abs(modifier.value)
      const nextLife = currentLife + lifeDelta

      wasApplied = true
      return {
        ...current,
        tokens: current.tokens.map((token) =>
          token.number === tokenNumber
            ? {
                ...token,
                life: nextLife,
              }
            : token,
        ),
      }
    })

    if (nextError) {
      setLifeModifierError(nextError)
      return
    }

    if (wasApplied) {
      setLifeModifierError(null)
      setSelectedTokenNumber(tokenNumber)
      setSelectedObstacleId(null)
      setIsLifeModifierDialogOpen(false)
      setLifeModifierTokenNumber("")
      setLifeModifierValue("")
    }
  }, [
    isSelectedBattleEditable,
    lifeModifierTokenNumber,
    lifeModifierValue,
    updateSelectedBattle,
  ])

  const handleApplyTokenStatus = useCallback(() => {
    if (!isSelectedBattleEditable) {
      return
    }

    const tokenNumber = parseNumberInput(statusLoaderTokenNumber)
    const nextStatus = normalizeBattleConditionStatus(statusLoaderConditionName)
    const nextStatusDurationTurns = nextStatus
      ? parseConditionDurationTurns(statusLoaderDurationTurns)
      : null

    if (!tokenNumber || tokenNumber <= 0) {
      setStatusLoaderError("Indicá un número de ficha válido.")
      return
    }

    if (statusLoaderConditionName.trim() && !findBattleConditionByName(nextStatus)) {
      setStatusLoaderError("La condición seleccionada no es válida.")
      return
    }

    if (nextStatus && nextStatusDurationTurns === null) {
      setStatusLoaderError("Indicá una duración válida en turnos. Usa 0 para infinito.")
      return
    }

    let tokenExists = false

    updateSelectedBattle((current) => {
      tokenExists = current.tokens.some((token) => token.number === tokenNumber)
      if (!tokenExists) {
        return current
      }

      return {
        ...current,
        tokens: current.tokens.map((token) =>
          token.number === tokenNumber
            ? {
                ...token,
                status: nextStatus,
                statusDurationTurns: nextStatus ? nextStatusDurationTurns ?? undefined : undefined,
              }
            : token,
        ),
      }
    })

    if (!tokenExists) {
      setStatusLoaderError(`No existe la ficha #${tokenNumber}.`)
      return
    }

    setStatusLoaderError(null)
    setSelectedTokenNumber(tokenNumber)
    setSelectedObstacleId(null)
    setIsStatusLoaderDialogOpen(false)
    setStatusLoaderTokenNumber("")
    setStatusLoaderConditionName("")
    setStatusLoaderDurationTurns("")
  }, [
    isSelectedBattleEditable,
    statusLoaderConditionName,
    statusLoaderDurationTurns,
    statusLoaderTokenNumber,
    updateSelectedBattle,
  ])

  const handleOpenBattle = useCallback(async (battleId: number) => {
    setSaveError(null)
    setBattleHistoryError(null)
    setIsOpeningBattle(true)

    try {
      const nextBattle =
        activeBattle?.id === battleId
          ? activeBattle
          : await fetchBattleById(battleId)

      const normalizedBattle = sortBattleState(nextBattle)
      applySelectedBattle(normalizedBattle)
      lastSyncedSnapshotRef.current = JSON.stringify(normalizedBattle)
      setIsBattleCenterOpen(false)
    } catch (error) {
      setBattleHistoryError(getBackendErrorMessage(error, "No se pudo abrir la batalla seleccionada."))
    } finally {
      setIsOpeningBattle(false)
    }
  }, [activeBattle, applySelectedBattle])

  const handleCreateBattleForSelectedScene = useCallback(async () => {
    if (!selectedScene || isCreatingBattle || selectedSceneActiveBattle) {
      return
    }

    setBattleHistoryError(null)
    setIsCreatingBattle(true)

    try {
      const createdBattle = sortBattleState(
        await createBattle(
          selectedScene.sceneType === "building"
            ? {
                sceneType: "building",
                sceneSlug: selectedScene.sceneSlug,
                parentLandmarkSlug: selectedScene.parentLandmarkSlug,
              }
            : selectedScene.sceneSlug,
        ),
      )
      setActiveBattle(createdBattle)
      applySelectedBattle(createdBattle)
      setSelectedSceneActiveBattle(createdBattle)
      lastSyncedSnapshotRef.current = JSON.stringify(createdBattle)
      await loadBattleCenterHistory(battleHistoryPage)
      setIsBattleCenterOpen(false)
    } catch (error) {
      setBattleHistoryError(getBackendErrorMessage(error, "No se pudo crear la batalla para esta escena."))
    } finally {
      setIsCreatingBattle(false)
    }
  }, [
    applySelectedBattle,
    battleHistoryPage,
    isCreatingBattle,
    loadBattleCenterHistory,
    selectedScene,
    selectedSceneActiveBattle,
  ])

  const handleReopenBattle = useCallback(async (battleId: number) => {
    setSaveError(null)
    setBattleHistoryError(null)
    setReopeningBattleId(battleId)

    try {
      const reopenedBattle = sortBattleState(await reopenBattle(battleId))
      setActiveBattle(reopenedBattle)
      applySelectedBattle(reopenedBattle)
      if (`${reopenedBattle.sceneType}:${reopenedBattle.sceneSlug}` === selectedSceneKey) {
        setSelectedSceneActiveBattle(reopenedBattle)
      }
      setSelectedSceneKey(`${reopenedBattle.sceneType}:${reopenedBattle.sceneSlug}`)
      lastSyncedSnapshotRef.current = JSON.stringify(reopenedBattle)
      await loadBattleCenterHistory(battleHistoryPage)
      setIsBattleCenterOpen(false)
    } catch (error) {
      setBattleHistoryError(getBackendErrorMessage(error, "No se pudo reabrir la batalla seleccionada."))
    } finally {
      setReopeningBattleId(null)
    }
  }, [applySelectedBattle, battleHistoryPage, loadBattleCenterHistory, selectedSceneKey])

  const handleDeleteBattle = useCallback(
    async (battle: BattleSummary) => {
      if (deletingBattleId || isOpeningBattle || reopeningBattleId === battle.id) {
        return
      }

      const confirmed = window.confirm(
        `Vas a borrar la batalla "${battle.title}". Esta acción no se puede deshacer.`,
      )
      if (!confirmed) {
        return
      }

      setBattleHistoryError(null)
      setSaveError(null)
      setDeletingBattleId(battle.id)

      try {
        await deleteBattle(battle.id)

        if (selectedBattle?.id === battle.id) {
          applySelectedBattle(null)
          lastSyncedSnapshotRef.current = null
        }

        if (activeBattle?.id === battle.id) {
          setActiveBattle(null)
        }

        if (selectedSceneActiveBattle?.id === battle.id) {
          setSelectedSceneActiveBattle(null)
        }

        await loadCurrentBattle(true)

        const shouldGoToPreviousPage =
          battle.status === "finished" &&
          battleCenterHistory.finishedBattles.length === 1 &&
          battleHistoryPage > 0 &&
          !battleCenterHistory.hasNextPage

        const nextPage = shouldGoToPreviousPage ? battleHistoryPage - 1 : battleHistoryPage
        if (nextPage !== battleHistoryPage) {
          setBattleHistoryPage(nextPage)
        } else {
          await loadBattleCenterHistory(nextPage)
        }
      } catch (error) {
        setBattleHistoryError(getBackendErrorMessage(error, "No se pudo borrar la batalla seleccionada."))
      } finally {
        setDeletingBattleId(null)
      }
    },
    [
      activeBattle?.id,
      applySelectedBattle,
      battleCenterHistory.finishedBattles.length,
      battleCenterHistory.hasNextPage,
      battleHistoryPage,
      deletingBattleId,
      isOpeningBattle,
      loadBattleCenterHistory,
      loadCurrentBattle,
      reopeningBattleId,
      selectedBattle?.id,
      selectedSceneActiveBattle?.id,
    ],
  )

  useEffect(() => {
    const requestedActionId = requestedReopenBattleId ?? requestedBattleId
    const requestedActionType = requestedReopenBattleId ? "reopen" : requestedBattleId ? "open" : null

    if (!requestedActionType || !requestedActionId) {
      handledBattleNavigationRequestRef.current = null
      return
    }

    const requestKey = `${requestedActionType}:${requestedActionId}:${requestedBattleLandmarkSlug ?? ""}`
    if (handledBattleNavigationRequestRef.current === requestKey) {
      return
    }

    handledBattleNavigationRequestRef.current = requestKey

    if (requestedBattleLandmarkSlug && selectedSceneKey !== `landmark:${requestedBattleLandmarkSlug}`) {
      setSelectedSceneKey(`landmark:${requestedBattleLandmarkSlug}`)
    }

    void (requestedActionType === "reopen"
      ? handleReopenBattle(requestedActionId)
      : handleOpenBattle(requestedActionId)
    ).finally(() => {
      router.replace("/batalla")
    })
  }, [
    handleOpenBattle,
    handleReopenBattle,
    requestedBattleId,
    requestedBattleLandmarkSlug,
    requestedReopenBattleId,
    router,
    selectedSceneKey,
  ])

  const handleFinishBattle = useCallback(async () => {
    if (!selectedBattle?.id || selectedBattle.status !== "active") {
      return
    }

    setSaveError(null)

    try {
      await finishBattle(selectedBattle.id)
      setActiveBattle(null)
      if (selectedScene && `${selectedBattle.sceneType}:${selectedBattle.sceneSlug}` === selectedScene.key) {
        setSelectedSceneActiveBattle(null)
      }
      applySelectedBattle(null)
      lastSyncedSnapshotRef.current = null
      await loadCurrentBattle()
      await loadBattleCenterHistory(battleHistoryPage)
    } catch (error) {
      setSaveError(getBackendErrorMessage(error, "No se pudo finalizar la batalla."))
    }
  }, [applySelectedBattle, battleHistoryPage, loadBattleCenterHistory, loadCurrentBattle, selectedBattle, selectedScene])

  const battleOverlay = useMemo(() => {
    if (!selectedBattle) {
      return null
    }

    return (
      <div className="relative size-full">
        <BattleTokenOverlay
          tokens={selectedBattle.tokens}
          statusDefinitions={BATTLE_CONDITIONS}
          obstacles={selectedBattle.obstacles}
          characterById={charactersById}
          currentTurnTokenNumber={selectedBattle.currentTurnTokenNumber ?? null}
          interactive={isSelectedBattleEditable && !isFogEditorOpen}
          enableTokenInspector={!isFogEditorOpen}
          suppressInspectorOnTokenClick={isLifeModifierDialogOpen || isStatusLoaderDialogOpen}
          tokenInspectorEditable={isSelectedBattleEditable}
          ghostHiddenTokens
          selectedTokenNumber={selectedTokenNumber}
          selectedObstacleId={selectedObstacleId}
          onSelectToken={handleSelectToken}
          onTokenClick={handleTokenPanelPick}
          onUpdateTokenDetails={(tokenNumber, nextValues) => {
            updateToken(tokenNumber, (token) => ({
              ...token,
              ...nextValues,
            }))
          }}
          onRequestToggleTokenType={(tokenNumber) => {
            updateToken(tokenNumber, (token) => ({
              ...token,
              type: token.type === "enemy" ? "player" : "enemy",
            }))
          }}
          onRequestTokenDuplicate={(tokenNumber) => {
            duplicateToken(tokenNumber)
          }}
          onRequestTokenQuickDelete={(tokenNumber) => {
            removeToken(tokenNumber)
          }}
          onRequestTokenDelete={(tokenNumber) => {
            const token = selectedBattle.tokens.find((candidate) => candidate.number === tokenNumber)
            if (!token) {
              return
            }
            setPendingDeleteToken(token)
          }}
          onRequestTokenCropEdit={(tokenNumber) => {
            handleRequestTokenCropEdit(tokenNumber)
          }}
          onRequestTokenDetail={(tokenNumber) => {
            void handleRequestTokenDetail(tokenNumber)
          }}
          isTokenDetailAvailable={isTokenDetailAvailable}
          onPreviewTokenMove={(tokenNumber, nextPosition) => {
            if (!selectedBattle.id) {
              return
            }

            broadcastBattleTokenPreview({
              battleId: selectedBattle.id,
              sceneSlug: selectedBattle.sceneSlug,
              tokenNumber,
              position: nextPosition,
            })
          }}
          onPreviewObstacleMove={(obstacleId, nextPosition) => {
            if (!selectedBattle.id) {
              return
            }

            broadcastBattleObstaclePreview({
              battleId: selectedBattle.id,
              sceneSlug: selectedBattle.sceneSlug,
              obstacleId,
              position: nextPosition,
            })
          }}
          onSelectObstacle={handleSelectObstacle}
          onMoveToken={(tokenNumber, nextPosition) => {
            updateToken(tokenNumber, (token) => ({ ...token, ...nextPosition }))
          }}
          onResizeToken={(tokenNumber, nextSize) => {
            updateToken(tokenNumber, (token) => ({ ...token, size: nextSize }))
          }}
          onMoveObstacle={(obstacleId, nextPosition) => {
            updateObstacle(obstacleId, (obstacle) => ({ ...obstacle, ...nextPosition }))
          }}
          onResizeObstacle={(obstacleId, nextSize) => {
            updateObstacle(obstacleId, (obstacle) => ({ ...obstacle, ...nextSize }))
          }}
          onRemoveObstacle={removeObstacle}
        />
        <BattleFogOverlay
          fogEnabled={selectedBattle.fogEnabled}
          fogReveals={selectedBattle.fogReveals}
          interactive={isSelectedBattleEditable && isFogEditorOpen && isFogOfWarSupported && fogEditorMode !== "idle"}
          editorMode={fogEditorMode}
          overlayOpacity={isFogEditorOpen ? 0.56 : 0.68}
          interactionPaddingPx={72}
          onCreateReveal={createFogReveal}
          onCoverArea={coverFogArea}
        />
      </div>
    )
  }, [
    charactersById,
    createFogReveal,
    coverFogArea,
    fogEditorMode,
    isSelectedBattleEditable,
    isFogEditorOpen,
    isFogOfWarSupported,
    isLifeModifierDialogOpen,
    isStatusLoaderDialogOpen,
    selectedBattle?.id,
    selectedBattle?.fogEnabled,
    selectedBattle?.fogReveals,
    selectedBattle?.sceneSlug,
    selectedBattle?.landmarkSlug,
    selectedBattle?.obstacles,
    selectedBattle?.tokens,
    handleSelectObstacle,
    handleSelectToken,
    handleTokenPanelPick,
    handleRequestTokenCropEdit,
    handleRequestTokenDetail,
    isTokenDetailAvailable,
    removeObstacle,
    removeToken,
    duplicateToken,
    selectedObstacleId,
    selectedTokenNumber,
    updateObstacle,
    updateToken,
  ])

  const battleModeLabel = `${getSelectedBattleModeLabel(selectedBattle, isSelectedBattleEditable)}${
    isPresentationFriendlyMode ? " · Friendly" : ""
  }`
  const hiddenBattleTokens = useMemo(
    () => [...(selectedBattle?.tokens ?? [])].filter((token) => token.hidden).sort((left, right) => left.number - right.number),
    [selectedBattle?.tokens],
  )

  const handleClearMapSelection = useCallback(() => {
    setSelectedTokenNumber(null)
    setSelectedObstacleId(null)
  }, [])

  const battleTopOverlay = useMemo(() => {
    return (
      <div className="flex flex-col items-center gap-2">
        <BattleStatusBanner
          battle={selectedBattle}
          characterById={charactersById}
          landmarkLabel={selectedScene?.label ?? selectedBattle?.sceneSlug ?? selectedBattle?.landmarkSlug ?? null}
          modeLabel={battleModeLabel}
          isSaving={isSaving}
          error={saveError ?? loadError}
        />
        {loadError || saveError ? (
          <p className="max-w-[min(36rem,calc(100vw-3rem))] rounded-2xl border border-red-200 bg-red-50/95 px-3 py-2 text-center text-xs font-medium text-red-700 shadow-lg">
            {saveError ?? loadError}
          </p>
        ) : null}
      </div>
    )
  }, [battleModeLabel, charactersById, isSaving, loadError, saveError, selectedBattle, selectedScene?.label])

  const battleTopLeftControls = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <DelayedControlTooltip label="Centro de batalla">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="h-10 w-10 rounded-full border border-stone-900/10 bg-white/95 shadow-lg backdrop-blur"
            aria-label="Centro de batalla"
            onClick={() => setIsBattleCenterOpen(true)}
          >
            <Layers3 className="size-4" />
          </Button>
        </DelayedControlTooltip>
        <DelayedControlTooltip label="Info de batalla">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="h-10 w-10 rounded-full border border-stone-900/10 bg-white/95 shadow-lg backdrop-blur"
            aria-label="Info de batalla"
            onClick={() => setIsBattleInfoOpen(true)}
            disabled={!selectedBattle}
          >
            <Info className="size-4" />
          </Button>
        </DelayedControlTooltip>
      </div>
    ),
    [selectedBattle],
  )

  const battleTopRightControls = useMemo(
    () => (
      <div className="flex flex-col items-end gap-2">
        <DelayedControlTooltip label="Siguiente turno" side="left">
          <Button
            type="button"
            size="icon-sm"
            className="h-10 w-10 rounded-full border border-amber-200/30 bg-[linear-gradient(180deg,rgba(217,119,6,0.95),rgba(146,64,14,0.98))] text-amber-50 shadow-[0_0.7rem_1.2rem_rgba(120,53,15,0.35)] hover:bg-[linear-gradient(180deg,rgba(245,158,11,0.96),rgba(180,83,9,0.98))]"
            aria-label="Siguiente turno"
            onClick={handleAdvanceTurn}
            disabled={!isSelectedBattleEditable || selectedBattle?.status !== "active"}
          >
            <LoaderCircle className={`size-4 ${isBattleLoading ? "animate-spin" : "hidden"}`} />
            {!isBattleLoading ? <ArrowRight className="size-4" /> : null}
          </Button>
        </DelayedControlTooltip>
        {hiddenBattleTokens.length > 0 ? (
          <div className="w-[min(14rem,calc(100vw-1.5rem))] rounded-2xl border border-cyan-400/25 bg-stone-950/78 p-2 text-cyan-50 shadow-[0_1rem_2rem_rgba(8,47,73,0.28)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">Ocultas</p>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                {hiddenBattleTokens.length}
              </span>
            </div>
            <div className="max-h-[11rem] space-y-1 overflow-y-auto pr-1">
              {hiddenBattleTokens.map((token) => (
                <button
                  key={`hidden-token-${token.number}`}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                    selectedTokenNumber === token.number
                      ? "border-cyan-200/65 bg-cyan-300/18 text-white"
                      : "border-cyan-500/10 bg-white/5 text-cyan-50 hover:border-cyan-300/40 hover:bg-cyan-300/10"
                  }`}
                  onClick={() => {
                    handleSelectToken(token.number)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{token.nombre}</span>
                    <span className="block text-[11px] text-cyan-100/70">#{token.number}</span>
                  </span>
                  <EyeOff className="size-3.5 shrink-0 text-cyan-200/85" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
    [
      handleAdvanceTurn,
      handleSelectToken,
      hiddenBattleTokens,
      isBattleLoading,
      isSelectedBattleEditable,
      selectedTokenNumber,
      selectedBattle?.status,
    ],
  )

  const battleBottomRightControls = useMemo(() => {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-col gap-2 rounded-2xl border border-stone-900/10 bg-white/90 p-2 shadow-lg backdrop-blur">
          <DelayedControlTooltip label="Deshacer" side="left">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Deshacer"
              onClick={handleUndoBattleEdit}
              disabled={!isSelectedBattleEditable || battleEditHistory.past.length === 0}
            >
              <Undo2 className="size-4" />
            </Button>
          </DelayedControlTooltip>
          <DelayedControlTooltip label="Rehacer" side="left">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Rehacer"
              onClick={handleRedoBattleEdit}
              disabled={!isSelectedBattleEditable || battleEditHistory.future.length === 0}
            >
              <Redo2 className="size-4" />
            </Button>
          </DelayedControlTooltip>
          <DelayedControlTooltip
            label={
              isPresentationViewVerticallyMirrored
                ? "Desactivar espejo H+V en presentación"
                : "Activar espejo H+V en presentación"
            }
            side="left"
          >
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={
                isPresentationViewVerticallyMirrored
                  ? "Desactivar espejo H+V en presentación"
                  : "Activar espejo H+V en presentación"
              }
              onClick={() => {
                const nextValue = !isPresentationViewVerticallyMirrored
                setIsPresentationViewVerticallyMirrored(nextValue)
                setBattleScreenPresentationVerticalMirror(nextValue)
              }}
              disabled={!displayedSceneSlug}
            >
              <ArrowUpDown className="size-4" />
            </Button>
          </DelayedControlTooltip>
          <DelayedControlTooltip label="Mostrar en presentación" side="left">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Mostrar en presentación"
              onClick={() => {
                if (!displayedSceneTarget) {
                  return
                }

                openSceneInPresentation(displayedSceneTarget)
              }}
              disabled={!displayedSceneTarget}
            >
              <Monitor className="size-4" />
            </Button>
          </DelayedControlTooltip>
          <DelayedControlTooltip label="Finalizar batalla" side="left">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Finalizar batalla"
              onClick={() => void handleFinishBattle()}
              disabled={selectedBattle?.status !== "active" || !selectedBattle?.id || isBattleLoading}
            >
              <Flag className="size-4" />
            </Button>
          </DelayedControlTooltip>
        </div>
      </div>
    )
  }, [
    battleEditHistory.future.length,
    battleEditHistory.past.length,
    displayedSceneSlug,
    displayedSceneTarget,
    handleAdvanceTurn,
    handleFinishBattle,
    openSceneInPresentation,
    handleRedoBattleEdit,
    handleUndoBattleEdit,
    isPresentationViewVerticallyMirrored,
    isSelectedBattleEditable,
    selectedBattle?.id,
    selectedBattle?.status,
  ])

  const battleLeftControls = useMemo(
    () => (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-900/10 bg-white/90 p-2 shadow-lg backdrop-blur">
        <DelayedControlTooltip label="Agregar enemigo" side="top">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Agregar enemigo"
            onClick={() => openTokenDialog("enemy")}
            disabled={!isSelectedBattleEditable}
          >
            <Swords className="size-4" />
          </Button>
        </DelayedControlTooltip>
        <DelayedControlTooltip label="Agregar jugador" side="top">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Agregar jugador"
            onClick={() => openTokenDialog("player")}
            disabled={!isSelectedBattleEditable}
          >
            <UserRound className="size-4" />
          </Button>
        </DelayedControlTooltip>
        <div className="h-6 w-px bg-stone-200" aria-hidden="true" />
        <DelayedControlTooltip label="Agregar esfera" side="top">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Agregar esfera"
            onClick={() => createObstacle("circle")}
            disabled={!isSelectedBattleEditable}
          >
            <Circle className="size-4" />
          </Button>
        </DelayedControlTooltip>
        <DelayedControlTooltip label="Agregar rectángulo" side="top">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Agregar rectángulo"
            onClick={() => createObstacle("rectangle")}
            disabled={!isSelectedBattleEditable}
          >
            <Square className="size-4" />
          </Button>
        </DelayedControlTooltip>
      </div>
    ),
    [createObstacle, isSelectedBattleEditable, openTokenDialog],
  )

  const battleMiddleLeftControls = useMemo(
    () => (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-stone-900/10 bg-white/90 p-2 shadow-lg backdrop-blur">
        <Popover
          open={isFogEditorOpen}
          onOpenChange={(open) => {
            if (open && !isFogOfWarSupported) {
              serviceMessage.info({
                title: "Niebla no disponible",
                description: "Por ahora la niebla de guerra solo funciona sobre mapas de imagen.",
              })
              return
            }

            setIsFogEditorOpen(open)
            setFogEditorMode("idle")
          }}
        >
          <DelayedControlTooltip label="Editor de niebla" side="right">
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant={selectedBattle?.fogEnabled ? "default" : "outline"}
                aria-label="Abrir editor de niebla"
                className="rounded-xl"
                disabled={!isSelectedBattleEditable || !displayedSceneTarget}
              >
                {selectedBattle?.fogEnabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </PopoverTrigger>
          </DelayedControlTooltip>
          <PopoverContent
            side="right"
            align="center"
            sideOffset={10}
            onInteractOutside={(event) => {
              event.preventDefault()
            }}
            className="w-[min(17rem,calc(100vw-1.5rem))] rounded-2xl border-stone-200 bg-white/97 p-3 shadow-xl"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-stone-900">Niebla</p>
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                  {selectedBattle?.fogEnabled ? `${selectedBattle.fogReveals.length} visibles` : "apagada"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="rounded-xl"
                  variant={selectedBattle?.fogEnabled ? "outline" : "default"}
                  onClick={() => {
                    setFogEnabled(!selectedBattle?.fogEnabled)
                  }}
                  disabled={!isSelectedBattleEditable}
                >
                  {selectedBattle?.fogEnabled ? "Apagar" : "Activar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={clearFogReveals}
                  disabled={!isSelectedBattleEditable || !selectedBattle?.fogEnabled}
                >
                  <Trash2 className="mr-2 size-4" />
                  Reset
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={fogEditorMode === "reveal" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setFogEditorMode((current) => (current === "reveal" ? "idle" : "reveal"))}
                  disabled={!selectedBattle?.fogEnabled}
                >
                  Mostrar
                </Button>
                <Button
                  type="button"
                  variant={fogEditorMode === "erase" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setFogEditorMode((current) => (current === "erase" ? "idle" : "erase"))}
                  disabled={!selectedBattle?.fogEnabled || selectedBattle.fogReveals.length === 0}
                >
                  Tapar
                </Button>
              </div>

              <p className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] leading-relaxed text-stone-600">
                {selectedBattle?.fogEnabled
                  ? fogEditorMode === "reveal"
                    ? "Arrastrá sobre el mapa. Ya podés empezar el drag un poco fuera de la imagen para revelar esquinas."
                    : fogEditorMode === "erase"
                      ? "Arrastrá el rectángulo a tapar. Con Alt, las esquinas se pegan a la grilla."
                      : "Elegí Mostrar o Tapar. Con Alt, las esquinas se pegan a la grilla."
                  : "Activala para empezar."}
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <Popover
          open={isLifeModifierDialogOpen}
          onOpenChange={(open) => {
            setIsLifeModifierDialogOpen(open)
            if (open) {
              setLifeModifierError(null)
              scheduleInputFocus(lifeModifierTokenInputRef)
            } else {
              setLifeModifierError(null)
            }
          }}
        >
          <DelayedControlTooltip label="Modificador de vida" side="right">
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Abrir modificador de vida"
                className="rounded-xl"
                disabled={!isSelectedBattleEditable}
              >
                <Swords className="size-4" />
              </Button>
            </PopoverTrigger>
          </DelayedControlTooltip>
          <PopoverContent
            side="right"
            align="center"
            sideOffset={10}
            onInteractOutside={handleTokenSelectionPopoverInteractOutside}
            className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border-stone-200 bg-white/97 p-4 shadow-xl"
          >
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">Modificador de vida</p>
                <p className="text-xs text-stone-600">Hacé click en una ficha para autocompletar. `+2` cura, `12` (sin signo) resta vida.</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Ficha</p>
                <Input
                  ref={lifeModifierTokenInputRef}
                  value={lifeModifierTokenNumber}
                  onChange={(event) => setLifeModifierTokenNumber(event.target.value)}
                  placeholder="Ej: 3"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Valor de vida</p>
                <Input
                  ref={lifeModifierValueInputRef}
                  value={lifeModifierValue}
                  onChange={(event) => setLifeModifierValue(event.target.value)}
                  placeholder="Ej: 12 o +2"
                />
              </div>
              {lifeModifierError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {lifeModifierError}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsLifeModifierDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-xl" onClick={handleApplyLifeModifier} disabled={!isSelectedBattleEditable}>
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover
          open={isStatusLoaderDialogOpen}
          onOpenChange={(open) => {
            setIsStatusLoaderDialogOpen(open)
            if (open) {
              setStatusLoaderError(null)
              scheduleInputFocus(statusLoaderTokenInputRef)
            } else {
              setStatusLoaderError(null)
              setStatusLoaderConditionName("")
              setStatusLoaderDurationTurns("")
            }
          }}
        >
          <DelayedControlTooltip label="Cargar estado" side="right">
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Abrir carga de estado"
                className="rounded-xl"
                disabled={!isSelectedBattleEditable}
              >
                <Flag className="size-4" />
              </Button>
            </PopoverTrigger>
          </DelayedControlTooltip>
          <PopoverContent
            side="right"
            align="center"
            sideOffset={10}
            onInteractOutside={handleTokenSelectionPopoverInteractOutside}
            className="w-[min(21rem,calc(100vw-2rem))] rounded-2xl border-stone-200 bg-white/97 p-4 shadow-xl"
          >
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-stone-900">Cargar estado</p>
                <p className="text-xs text-stone-600">Elegí la ficha y la condición del catálogo.</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Número de ficha</p>
                <Input
                  ref={statusLoaderTokenInputRef}
                  value={statusLoaderTokenNumber}
                  onChange={(event) => setStatusLoaderTokenNumber(event.target.value)}
                  placeholder="Ej: 5"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Condición</p>
                <Select
                  value={statusLoaderConditionName || EMPTY_STATUS_SELECT_VALUE}
                  onValueChange={(nextValue) => {
                    const nextStatus = nextValue === EMPTY_STATUS_SELECT_VALUE ? "" : nextValue
                    setStatusLoaderConditionName(nextStatus)
                    setStatusLoaderDurationTurns(nextStatus ? DEFAULT_CONDITION_DURATION_TURNS : "")
                    setStatusLoaderError(null)
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="Seleccioná una condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_STATUS_SELECT_VALUE}>Sin condición</SelectItem>
                    {BATTLE_CONDITIONS.map((condition) => (
                      <SelectItem key={`status-loader-condition-${condition.name}`} value={condition.name}>
                        {condition.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {findBattleConditionByName(statusLoaderConditionName)?.entriesText ? (
                  <p className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] leading-relaxed text-stone-600">
                    {findBattleConditionByName(statusLoaderConditionName)?.entriesText}
                  </p>
                ) : null}
              </div>
              {statusLoaderConditionName ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Duración</p>
                  <Input
                    value={statusLoaderDurationTurns}
                    inputMode="numeric"
                    onChange={(event) => {
                      setStatusLoaderDurationTurns(event.target.value)
                      setStatusLoaderError(null)
                    }}
                    placeholder="Ej: 1 o 0 = infinito"
                  />
                </div>
              ) : null}
              {statusLoaderError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {statusLoaderError}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsStatusLoaderDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-xl" onClick={handleApplyTokenStatus} disabled={!isSelectedBattleEditable}>
                  Guardar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    ),
    [
      clearFogReveals,
      displayedSceneTarget,
      fogEditorMode,
      handleApplyLifeModifier,
      handleApplyTokenStatus,
      handleTokenSelectionPopoverInteractOutside,
      isFogEditorOpen,
      isFogOfWarSupported,
      isLifeModifierDialogOpen,
      isSelectedBattleEditable,
      isStatusLoaderDialogOpen,
      lifeModifierError,
      lifeModifierTokenNumber,
      lifeModifierValue,
      scheduleInputFocus,
      selectedBattle?.fogEnabled,
      selectedBattle?.fogReveals.length,
      statusLoaderError,
      statusLoaderConditionName,
      statusLoaderDurationTurns,
      statusLoaderTokenNumber,
      setFogEnabled,
    ],
  )

  if (isPageLoading) {
    return (
      <main className="flex min-h-[calc(100dvh-var(--app-nav-height))] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,231,190,0.55),_rgba(222,205,165,0.8)_45%,_rgba(177,151,109,0.9)_100%)] px-6 text-sm font-semibold text-stone-700">
        Cargando campo de batalla...
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100dvh-var(--app-nav-height))] bg-[radial-gradient(circle_at_top_left,_rgba(244,223,174,0.45),_rgba(210,186,135,0.7)_40%,_rgba(154,128,88,0.88)_100%)]">
      <section className="relative h-[calc(100dvh-var(--app-nav-height))] min-h-[calc(100dvh-var(--app-nav-height))] overflow-hidden">
        {displayedSceneTarget ? (
          <LandmarkMapOnlyClient
            sceneType={displayedSceneTarget.sceneType}
            sceneSlug={displayedSceneTarget.sceneSlug}
            showControls
            fitParentHeight
            onMapBackgroundPointerDown={handleClearMapSelection}
            topOverlay={battleTopOverlay}
            topLeftControls={battleTopLeftControls}
            topRightControls={battleTopRightControls}
            bottomRightControls={battleBottomRightControls}
            overlay={battleOverlay}
            leftControls={battleLeftControls}
            middleLeftControls={battleMiddleLeftControls}
          />
        ) : (
          <>
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4 sm:top-4">
              {battleTopLeftControls}
            </div>
            <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3 px-8 text-center">
              <p className="text-base font-semibold text-stone-100">No hay mapas listos para batalla.</p>
              <p className="max-w-md text-sm font-medium text-stone-300">
                {loadError ? loadError : "Configurá un landmark con mapa de imagen y grilla para usar /batalla."}
              </p>
            </div>
          </>
        )}
      </section>

      <Dialog open={isBattleCenterOpen} onOpenChange={setIsBattleCenterOpen}>
        <DialogContent
          ref={battleCenterDialogRef}
          className="max-w-5xl rounded-[2rem] border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))] p-6"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            battleCenterDialogRef.current?.focus()
          }}
          tabIndex={-1}
        >
          <DialogHeader>
            <DialogTitle>Centro de batalla</DialogTitle>
            <DialogDescription>
              Gestioná encuentros, historial y metadata sin ocupar espacio permanente sobre el mapa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.88fr)]">
            <div className="space-y-4 order-2 lg:order-1">
              <section className="bg-white/70 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">Historial de batallas</h3>
                    <p className="text-xs text-stone-500">
                      Todas las batallas, con las activas arriba y las terminadas paginadas abajo.
                    </p>
                  </div>
                  {isOpeningBattle ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-stone-500">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Abriendo...
                    </span>
                  ) : null}
                </div>

                {battleHistoryError ? (
                  <p className="bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                    {battleHistoryError}
                  </p>
                ) : null}

                {isBattleHistoryLoading ? (
                  <p className="text-sm text-stone-500">Cargando historial...</p>
                ) : (
                  <div className="max-h-[36rem] space-y-5 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Activas</h4>
                        <span className="text-[11px] text-stone-500">{visibleActiveBattles.length}</span>
                      </div>

                      {visibleActiveBattles.length === 0 ? (
                        <p className="text-sm text-stone-500">No hay batallas activas.</p>
                      ) : (
                        visibleActiveBattles.map((battle) => (
                          <article
                            key={battle.id}
                            className={`border border-stone-200 px-3 py-3 ${battle.id === selectedBattle?.id ? "bg-stone-100" : "bg-transparent"}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-stone-900">{battle.title}</p>
                                <p className="mt-1 text-[11px] text-stone-500">
                                  #{battle.id} · {getBattleSceneLabel(battle)}
                                </p>
                                <p className="mt-1 text-[11px] text-stone-500">
                                  {formatBattleSummaryTimestamp(battle)} · {battle.tokenCount} fichas · {battle.obstacleCount} obstáculos
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <DelayedControlTooltip label="Abrir" side="left">
                                  <Button type="button" size="icon" variant="ghost" onClick={() => void handleOpenBattle(battle.id)}>
                                    <FolderOpen className="size-4" />
                                  </Button>
                                </DelayedControlTooltip>
                                <DelayedControlTooltip label="Presentación" side="left">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      openSceneInPresentation({
                                        sceneType: battle.sceneType,
                                        sceneSlug: battle.sceneSlug,
                                      })
                                    }
                                  >
                                    <Monitor className="size-4" />
                                  </Button>
                                </DelayedControlTooltip>
                                <DelayedControlTooltip label="Borrar" side="left">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void handleDeleteBattle(battle)}
                                    disabled={deletingBattleId === battle.id}
                                  >
                                    {deletingBattleId === battle.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                  </Button>
                                </DelayedControlTooltip>
                              </div>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Terminadas</h4>
                        <span className="text-[11px] text-stone-500">{battleCenterHistory.totalFinishedBattles}</span>
                      </div>

                      {visibleFinishedBattles.length === 0 ? (
                        <p className="text-sm text-stone-500">No hay batallas terminadas.</p>
                      ) : (
                        visibleFinishedBattles.map((battle) => (
                          <article
                            key={battle.id}
                            className={`border border-stone-200 px-3 py-3 ${battle.id === selectedBattle?.id ? "bg-stone-100" : "bg-transparent"}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-stone-900">{battle.title}</p>
                                <p className="mt-1 text-[11px] text-stone-500">
                                  #{battle.id} · {getBattleSceneLabel(battle)}
                                </p>
                                <p className="mt-1 text-[11px] text-stone-500">
                                  {formatBattleSummaryTimestamp(battle)} · {battle.tokenCount} fichas · {battle.obstacleCount} obstáculos
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap gap-2">
                                <DelayedControlTooltip label="Abrir" side="left">
                                  <Button type="button" size="icon" variant="ghost" onClick={() => void handleOpenBattle(battle.id)}>
                                    <FolderOpen className="size-4" />
                                  </Button>
                                </DelayedControlTooltip>
                                <DelayedControlTooltip label="Reabrir" side="left">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void handleReopenBattle(battle.id)}
                                    disabled={reopeningBattleId === battle.id}
                                  >
                                    {reopeningBattleId === battle.id ? <LoaderCircle className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                                  </Button>
                                </DelayedControlTooltip>
                                <DelayedControlTooltip label="Borrar" side="left">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void handleDeleteBattle(battle)}
                                    disabled={deletingBattleId === battle.id}
                                  >
                                    {deletingBattleId === battle.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                  </Button>
                                </DelayedControlTooltip>
                              </div>
                            </div>
                          </article>
                        ))
                      )}

                      {battleCenterHistory.totalFinishedPages > 1 ? (
                        <div className="flex items-center justify-between gap-3 pt-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setBattleHistoryPage((current) => Math.max(0, current - 1))}
                            disabled={!battleCenterHistory.hasPreviousPage || isBattleHistoryLoading}
                          >
                            Anterior
                          </Button>
                          <p className="text-[11px] text-stone-500">
                            Página {battleCenterHistory.page + 1} de {Math.max(1, battleCenterHistory.totalFinishedPages)}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setBattleHistoryPage((current) => current + 1)}
                            disabled={!battleCenterHistory.hasNextPage || isBattleHistoryLoading}
                          >
                            Siguiente
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {visibleActiveBattles.length === 0 && visibleFinishedBattles.length === 0 ? (
                      <p className="text-sm text-stone-500">No hay batallas para mostrar.</p>
                    ) : null}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-4 order-1 lg:order-2">
              <section className="bg-white/70 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Escena</p>
                    <select
                      value={selectedSceneKey ?? ""}
                      className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-800 outline-none transition focus:border-amber-500"
                      onChange={(event) => {
                        const nextSceneKey = event.target.value || null
                        setSelectedSceneKey(nextSceneKey)
                        if (
                          selectedBattle &&
                          `${selectedBattle.sceneType}:${selectedBattle.sceneSlug}` !== nextSceneKey &&
                          !isSelectedBattleEditable
                        ) {
                          applySelectedBattle(null)
                        }
                      }}
                    >
                      {eligibleBattleScenes.length === 0 ? (
                        <option value="">Sin escenas listas</option>
                      ) : null}
                      {eligibleBattleScenes.map((scene) => (
                        <option key={scene.key} value={scene.key}>
                          {scene.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    className="h-11 rounded-xl"
                    onClick={() => void handleCreateBattleForSelectedScene()}
                    disabled={!selectedScene || isCreatingBattle || Boolean(selectedSceneActiveBattle)}
                  >
                    {isCreatingBattle ? "Creando..." : "Nueva batalla"}
                  </Button>
                </div>

                {isSelectedSceneActiveBattleLoading ? (
                  <p className="mt-3 text-xs text-stone-500">Buscando batalla activa para esta escena...</p>
                ) : selectedSceneActiveBattle ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Hay una batalla activa para esta escena</p>
                    <p className="mt-1 text-xs text-amber-800">
                      {selectedSceneActiveBattle.title} · {getBattleSceneLabel(selectedSceneActiveBattle)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void handleOpenBattle(selectedSceneActiveBattle.id ?? 0)}
                        disabled={!selectedSceneActiveBattle.id}
                      >
                        Ir a la activa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                          openSceneInPresentation({
                            sceneType: selectedSceneActiveBattle.sceneType,
                            sceneSlug: selectedSceneActiveBattle.sceneSlug,
                          })
                        }
                      >
                        Presentación
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-stone-500">
                    No hay batalla activa para la escena seleccionada. Podés crear una nueva.
                  </p>
                )}
              </section>

            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBattleInfoOpen} onOpenChange={setIsBattleInfoOpen}>
        <DialogContent className="max-w-5xl rounded-[2rem] border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))] p-6">
          <DialogHeader>
            <DialogTitle>Batalla Info</DialogTitle>
            <DialogDescription>
              Resumen, contexto y notas de la batalla actualmente abierta.
            </DialogDescription>
          </DialogHeader>

          {selectedBattle && battleInfoSummary ? (
            <div className="space-y-5">
              <section className="border-b border-stone-200 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-600">{getBattleSceneLabel(selectedBattle)}</p>
                  </div>
                  <div className="bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                    {battleInfoSummary.statusLabel} · {isSelectedBattleEditable ? "Editable" : "Solo lectura"}
                  </div>
                </div>
              </section>

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
                <section className="space-y-5">
                  <section>
                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Título
                      <Input
                        value={selectedBattle.title}
                        className="mt-1 h-10"
                        disabled={!isSelectedBattleEditable}
                        onChange={(event) =>
                          updateSelectedBattle((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Notas DM
                      <Textarea
                        value={selectedBattle.dmNotes}
                        className="mt-1 min-h-24 resize-y"
                        disabled={!isSelectedBattleEditable}
                        placeholder="Notas rápidas del encuentro..."
                        onChange={(event) =>
                          updateSelectedBattle((current) => ({
                            ...current,
                            dmNotes: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </section>

                  <div className="border-t border-stone-200 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Contexto</p>
                    <div className="mt-3 grid gap-x-6 gap-y-3 lg:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Escena</p>
                        <p className="mt-1 text-sm text-stone-900">{getBattleSceneLabel(selectedBattle)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Tipo</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.sceneTypeLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Landmark padre</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.parentLandmarkSlug}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">ID / Slug</p>
                        <p className="mt-1 text-sm text-stone-900">#{selectedBattle.id ?? "-"} · {selectedBattle.slug}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Progreso</p>
                    <div className="mt-3 grid gap-x-6 gap-y-3 lg:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Ronda</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.roundNumber}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Turno actual</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.currentTurnLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Niebla</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.fogEnabled ? "Activa" : "Desactivada"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Zonas reveladas</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.fogReveals.length}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-5 border-l border-stone-200 pl-8">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Resumen</p>
                    <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Fichas</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.tokens.length}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Obstáculos</p>
                        <p className="mt-1 text-sm text-stone-900">{selectedBattle.obstacles.length}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Jugadores</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.playerCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Enemigos</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.enemyCount}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Fichas ocultas</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.hiddenTokenCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Fechas</p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Creada</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.createdAtLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Actualizada</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.updatedAtLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Finalizada</p>
                        <p className="mt-1 text-sm text-stone-900">{battleInfoSummary.endedAtLabel}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No hay una batalla seleccionada.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTokenDialogOpen}
        onOpenChange={(open) => {
          setIsTokenDialogOpen(open)
          if (!open) {
            setIsCharacterLibraryOpen(false)
            setCharacterLibraryQuery("")
            setCropCharacterId(null)
            setIsCharacterCropDialogOpen(false)
          }
        }}
      >
        <DialogContent className="w-[min(80vw,72rem)] max-h-[92dvh] overflow-y-auto rounded-[2rem] border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Nueva ficha</DialogTitle>
            <DialogDescription>
              Cargá los datos iniciales y después vas a poder seguir editándolos desde el mapa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Tipo
                    <span className="mt-1 block rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium normal-case tracking-normal text-stone-700">
                      {tokenDialogType === "enemy" ? "Enemigo" : "Jugador"}
                    </span>
                  </label>

                  <label className="relative text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Nombre
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        value={tokenDialogDraft.nombre}
                        className="h-10 flex-1"
                        placeholder="Nombre visible de la ficha"
                        autoComplete="off"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setTokenDialogDraft((current) => ({
                            ...(typeof current.characterId === "number" && current.characterId > 0
                              ? {
                                  ...current,
                                  characterId: current.nombre !== nextValue ? null : current.characterId,
                                  sourceType: current.nombre !== nextValue ? "manual" : "character",
                                  sourceRef: current.nombre !== nextValue ? null : current.sourceRef,
                                  nombre: nextValue,
                                }
                              : current.sourceType === "monster"
                                ? {
                                    ...current,
                                    sourceType: current.nombre !== nextValue ? "manual" : "monster",
                                    sourceRef: current.nombre !== nextValue ? null : current.sourceRef,
                                    nombre: nextValue,
                                  }
                                : {
                                    ...current,
                                    nombre: nextValue,
                                  }),
                          }))
                        }}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="h-10 w-10 shrink-0 rounded-xl"
                        aria-label="Abrir selector de personajes"
                        onClick={() => setIsCharacterLibraryOpen(true)}
                      >
                        <Search className="size-4" />
                      </Button>
                    </div>
                    <span className="mt-2 block text-[11px] font-medium normal-case tracking-normal text-stone-500">
                      Escribí un nombre manual o elegí un personaje/monstruo desde el selector.
                    </span>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Iniciativa
                    <Input
                      value={tokenDialogDraft.initiative}
                      inputMode="decimal"
                      className="mt-1 h-10"
                      placeholder="Ini"
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setTokenDialogDraft((current) => ({ ...current, initiative: nextValue }))
                      }}
                    />
                  </label>

                  {tokenDialogType === "enemy" ? (
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Mod Ini
                      <Input
                        value={tokenDialogDraft.initiativeModifier}
                        inputMode="decimal"
                        className="mt-1 h-10"
                        placeholder="0"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setTokenDialogDraft((current) => ({ ...current, initiativeModifier: nextValue }))
                        }}
                      />
                    </label>
                  ) : (
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Vida
                      <Input
                        value={tokenDialogDraft.life}
                        inputMode="numeric"
                        className="mt-1 h-10"
                        placeholder="Vida"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setTokenDialogDraft((current) => ({ ...current, life: nextValue }))
                        }}
                      />
                    </label>
                  )}
                </div>

                {tokenDialogType === "enemy" ? (
                  <>
                    <p className="mt-3 text-[11px] leading-4 text-stone-500">
                      Si dejás <span className="font-semibold text-stone-700">Iniciativa</span> vacía, al crear se tira
                      {" "}1d20 + <span className="font-semibold text-stone-700">Mod Ini</span> automáticamente.
                      {tokenDialogDraft.sourceType === "monster"
                        ? " Si elegiste un monstruo, usa su Mod Ini autocompletado (podés editarlo)."
                        : ""}
                    </p>
                    <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Vida
                      <Input
                        value={tokenDialogDraft.life}
                        inputMode="numeric"
                        className="mt-1 h-10"
                        placeholder="0"
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setTokenDialogDraft((current) => ({ ...current, life: nextValue }))
                        }}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Estado
                  <Select
                    value={normalizeBattleConditionStatus(tokenDialogDraft.status) || EMPTY_STATUS_SELECT_VALUE}
                    onValueChange={(nextValue) => {
                      const nextStatus = nextValue === EMPTY_STATUS_SELECT_VALUE ? "" : normalizeBattleConditionStatus(nextValue)
                      setTokenDialogDraft((current) => ({
                        ...current,
                        status: nextStatus,
                        statusDurationTurns: nextStatus ? DEFAULT_CONDITION_DURATION_TURNS : "",
                      }))
                    }}
                  >
                    <SelectTrigger className="mt-1 h-10 w-full">
                      <SelectValue placeholder="Sin estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_STATUS_SELECT_VALUE}>Sin estado</SelectItem>
                      {BATTLE_CONDITIONS.map((condition) => (
                        <SelectItem key={`token-dialog-condition-${condition.name}`} value={condition.name}>
                          {condition.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {findBattleConditionByName(tokenDialogDraft.status)?.entriesText ? (
                  <p className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] leading-relaxed text-stone-600">
                    {findBattleConditionByName(tokenDialogDraft.status)?.entriesText}
                  </p>
                ) : null}
                {tokenDialogDraft.status ? (
                  <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Duración (turnos, 0 = infinito)
                    <Input
                      value={tokenDialogDraft.statusDurationTurns}
                      inputMode="numeric"
                      className="mt-1 h-10"
                      placeholder="1 o 0"
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setTokenDialogDraft((current) => ({ ...current, statusDurationTurns: nextValue }))
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2 sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="rounded-xl" onClick={handleSaveTokenDraftPreset}>
                Guardar plantilla
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={handleRestoreTokenDraftPreset}
                disabled={!savedTokenDrafts[tokenDialogType]}
              >
                Recargar ultima
              </Button>
            </div>
            <Button type="button" className="rounded-xl" onClick={handleSubmitTokenDialog} disabled={!isSelectedBattleEditable}>
              Crear ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCharacterLibraryOpen}
        onOpenChange={(open) => {
          setIsCharacterLibraryOpen(open)
          if (!open) {
            scheduleTokenLibraryDialogCloseCleanup()
            return
          }

          setMonsterLibraryError(null)
        }}
      >
        <DialogContent className="max-w-5xl rounded-[2rem] border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))] p-6">
          <DialogHeader>
            <DialogTitle>Selector de fichas</DialogTitle>
            <DialogDescription>
              Elegí si querés buscar personajes o monstruos para cargar una ficha rápida.
            </DialogDescription>
          </DialogHeader>

          {isTokenLibraryDialogContentReady ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={characterLibraryQuery}
                  className="h-10 sm:max-w-sm"
                  placeholder={
                    tokenLibrarySearchMode === "monster"
                      ? "Buscar monstruo por nombre, tipo o CR"
                      : "Buscar personaje por nombre, raza o clase"
                  }
                  onChange={(event) => setCharacterLibraryQuery(event.target.value)}
                />
                <div className="flex flex-col items-start gap-2 text-xs font-medium text-stone-500 sm:items-end">
                  <div className="inline-flex rounded-xl border border-stone-300 bg-white p-1 shadow-sm">
                    <Button
                      type="button"
                      size="sm"
                      variant={tokenLibrarySearchMode === "character" ? "secondary" : "ghost"}
                      className="h-8 rounded-lg px-3 text-xs"
                      onClick={() => {
                        setTokenLibrarySearchMode("character")
                        setCharacterLibraryQuery("")
                        setMonsterLibraryError(null)
                      }}
                    >
                      Characters
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={tokenLibrarySearchMode === "monster" ? "secondary" : "ghost"}
                      className="h-8 rounded-lg px-3 text-xs"
                      onClick={() => {
                        setTokenLibrarySearchMode("monster")
                        setCharacterLibraryQuery("")
                        setMonsterLibraryError(null)
                      }}
                    >
                      Monsters
                    </Button>
                  </div>
                  <p>
                    {tokenLibraryEntries.length} resultado{tokenLibraryEntries.length === 1 ? "" : "s"}
                    {tokenLibrarySearchMode === "character"
                      ? ` · ${characterLibraryEntries.length} personaje${
                          characterLibraryEntries.length === 1 ? "" : "s"
                        }`
                      : ` · ${monsterLibraryEntries.length} monstruo${
                          monsterLibraryEntries.length === 1 ? "" : "s"
                        } ${monsterLibraryTotal > monsterLibraryEntries.length ? `(de ${monsterLibraryTotal})` : ""}`}
                  </p>
                </div>
              </div>

              {tokenLibrarySearchMode === "monster" && isMonsterLibraryLoading ? (
                <p className="text-xs text-stone-500">Buscando monstruos...</p>
              ) : null}
              {tokenLibrarySearchMode === "monster" && monsterLibraryError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                  {monsterLibraryError}
                </p>
              ) : null}

              <div
                className="max-h-[26rem] overflow-y-auto rounded-2xl border border-stone-200 bg-white/90"
                onScroll={tokenLibrarySearchMode === "monster" ? handleMonsterLibraryScroll : undefined}
              >
                <Table>
                  <TableHeader className="sticky top-0 bg-stone-50/95 backdrop-blur">
                    <TableRow>
                      <TableHead>
                        {tokenLibrarySearchMode === "monster" ? (
                          <button
                            type="button"
                            onClick={() => handleToggleMonsterSort("name")}
                            className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs transition-colors ${
                              monsterLibrarySort.field === "name" ? "text-stone-900" : "text-stone-500 hover:text-stone-700"
                            }`}
                            aria-label={`Ordenar por nombre ${
                              monsterLibrarySort.field === "name" && monsterLibrarySort.direction === "asc"
                                ? "descendente"
                                : "ascendente"
                            }`}
                          >
                            <span>Nombre</span>
                            <ArrowUp
                              className={`size-3.5 transition-transform ${
                                monsterLibrarySort.field === "name" ? "text-amber-600" : "text-stone-400"
                              } ${
                                monsterLibrarySort.field === "name" && monsterLibrarySort.direction === "desc"
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>
                        ) : (
                          "Nombre"
                        )}
                      </TableHead>
                      <TableHead>
                        {tokenLibrarySearchMode === "monster" ? (
                          <button
                            type="button"
                            onClick={() => handleToggleMonsterSort("type")}
                            className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs transition-colors ${
                              monsterLibrarySort.field === "type" ? "text-stone-900" : "text-stone-500 hover:text-stone-700"
                            }`}
                            aria-label={`Ordenar por tipo ${
                              monsterLibrarySort.field === "type" && monsterLibrarySort.direction === "asc"
                                ? "descendente"
                                : "ascendente"
                            }`}
                          >
                            <span>Tipo</span>
                            <ArrowUp
                              className={`size-3.5 transition-transform ${
                                monsterLibrarySort.field === "type" ? "text-amber-600" : "text-stone-400"
                              } ${
                                monsterLibrarySort.field === "type" && monsterLibrarySort.direction === "desc"
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>
                        ) : (
                          "Raza"
                        )}
                      </TableHead>
                      <TableHead>
                        {tokenLibrarySearchMode === "monster" ? (
                          <button
                            type="button"
                            onClick={() => handleToggleMonsterSort("cr")}
                            className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs transition-colors ${
                              monsterLibrarySort.field === "cr" ? "text-stone-900" : "text-stone-500 hover:text-stone-700"
                            }`}
                            aria-label={`Ordenar por CR ${
                              monsterLibrarySort.field === "cr" && monsterLibrarySort.direction === "asc"
                                ? "descendente"
                                : "ascendente"
                            }`}
                          >
                            <span>CR</span>
                            <ArrowUp
                              className={`size-3.5 transition-transform ${
                                monsterLibrarySort.field === "cr" ? "text-amber-600" : "text-stone-400"
                              } ${
                                monsterLibrarySort.field === "cr" && monsterLibrarySort.direction === "desc"
                                  ? "rotate-180"
                                  : ""
                              }`}
                            />
                          </button>
                        ) : (
                          "Profesión"
                        )}
                      </TableHead>
                      <TableHead className="w-56 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokenLibraryEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-sm text-stone-500">
                          {tokenLibrarySearchMode === "monster"
                            ? "No hay monstruos que coincidan con esa búsqueda."
                            : "No hay personajes que coincidan con esa búsqueda."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      tokenLibraryEntries.map((entry) => (
                        <TableRow
                          key={entry.key}
                          data-state={
                            entry.kind === "character"
                              ? tokenDialogDraft.sourceType === "character" &&
                                tokenDialogDraft.characterId === entry.character.id
                                ? "selected"
                                : undefined
                              : tokenDialogDraft.sourceType === "monster" &&
                                  tokenDialogDraft.sourceRef?.trim().toLocaleLowerCase("es") ===
                                    entry.monster.nameExact.trim().toLocaleLowerCase("es")
                                ? "selected"
                                : undefined
                          }
                        >
                          <TableCell className="max-w-0">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-stone-900">{entry.name}</p>
                              <p className="truncate text-[11px] text-stone-500">
                                {entry.kind === "character" ? "Personaje" : "Monstruo"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{entry.raceOrType || "-"}</TableCell>
                          <TableCell>{entry.classOrCr || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => {
                                  if (entry.kind === "character") {
                                    handleSelectCharacterForTokenDialog(entry.character)
                                    return
                                  }

                                  handleSelectMonsterForTokenDialog(entry.monster)
                                }}
                              >
                                Usar
                              </Button>
                              {entry.kind === "character" && entry.character.characterSheet ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => handleOpenLibraryCharacterSheet(entry.character)}
                                >
                                  Hoja
                                </Button>
                              ) : null}
                              {entry.kind === "monster" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => void handleOpenLibraryMonsterPanel(entry.monster.nameExact)}
                                >
                                  Panel
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {tokenLibrarySearchMode === "monster" && isMonsterLibraryLoadingMore ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-3 text-center text-xs text-stone-500">
                          <span className="inline-flex items-center gap-2">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Cargando más monstruos...
                          </span>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white/80 px-4 py-3 text-sm font-medium text-stone-600">
                <LoaderCircle className="size-4 animate-spin" />
                Preparando selector...
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isLibraryMonsterPanelDialogOpen}
        onOpenChange={(open) => {
          setIsLibraryMonsterPanelDialogOpen(open)
          if (!open) {
            scheduleLibraryMonsterPanelCloseCleanup()
          }
        }}
      >
        <DialogContent className="w-[min(96vw,72rem)] max-h-[92dvh] overflow-y-auto rounded-[2rem] border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.96))] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Panel de monstruo</DialogTitle>
            <DialogDescription>Referencia detallada del monstruo seleccionado.</DialogDescription>
          </DialogHeader>

          {isMonsterPanelLoading ? (
            <p className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
              Cargando monstruo...
            </p>
          ) : monsterPanelError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              {monsterPanelError}
            </p>
          ) : libraryMonsterPanel ? (
            <MonsterCard monster={libraryMonsterPanel} index={0} embedded />
          ) : (
            <p className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
              No hay monstruo para mostrar.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isMonsterDetailDialogOpen}
        onOpenChange={(open) => {
          setIsMonsterDetailDialogOpen(open)
          if (!open) {
            scheduleMonsterDetailCloseCleanup()
          }
        }}
      >
        <DialogContent className="w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] max-h-[92dvh] overflow-y-auto gap-0 border-0 bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del monstruo</DialogTitle>
            <DialogDescription>Información completa del monstruo vinculado a la ficha seleccionada.</DialogDescription>
          </DialogHeader>

          {isMonsterDetailLoading ? (
            <p className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
              Cargando monstruo...
            </p>
          ) : monsterDetailError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              {monsterDetailError}
            </p>
          ) : detailMonsterPanel ? (
            <MonsterCard monster={detailMonsterPanel} index={0} embedded />
          ) : (
            <p className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
              No hay monstruo para mostrar.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <CharacterImageCropDialog
        open={isCharacterCropDialogOpen}
        character={selectedCharacterForCropDialog}
        saving={isSavingCharacterCrop}
        onOpenChange={(open) => {
          setIsCharacterCropDialogOpen(open)
          if (!open) {
            setCropCharacterId(null)
          }
        }}
        onSave={handleSaveCharacterCrop}
      />

      <Dialog
        open={Boolean(monsterBattleCropDraft)}
        onOpenChange={(open) => {
          if (!open) {
            setMonsterBattleCropDraft(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl rounded-3xl border-stone-200 bg-[linear-gradient(180deg,rgba(250,248,241,0.98),rgba(237,229,206,0.98))] p-6">
          <DialogHeader>
            <DialogTitle>Ajustar encuadre de monstruo</DialogTitle>
            <DialogDescription>
              Este ajuste se guarda para este tipo de monstruo dentro de esta batalla.
              {monsterBattleCropDraft ? ` (${monsterBattleCropDraft.sourceLabel})` : ""}
            </DialogDescription>
          </DialogHeader>

          {monsterBattleCropDraft ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="relative mx-auto aspect-square w-[18rem] max-w-full overflow-hidden rounded-full border-2 border-stone-700/70 bg-stone-950 shadow-[inset_0_0_0_1px_rgba(245,222,179,0.18),0_1rem_2rem_rgba(28,25,23,0.24)]">
                  <img
                    src={monsterBattleCropDraft.image}
                    alt={monsterBattleCropDraft.sourceLabel}
                    className="absolute inset-0 size-full object-cover"
                    style={monsterBattleCropStyle}
                    draggable={false}
                  />
                </div>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={monsterBattleCropDraft.zoom}
                    className="mt-2 h-2 w-full cursor-pointer accent-amber-700"
                    onChange={(event) => {
                      setMonsterBattleCropDraft((current) => {
                        if (!current) {
                          return current
                        }

                        const nextCrop = normalizeBattleTokenImageCrop({
                          imageFocusX: current.focusX,
                          imageFocusY: current.focusY,
                          imageZoom: Number.parseFloat(event.target.value),
                        })
                        return {
                          ...current,
                          focusX: nextCrop.focusX,
                          focusY: nextCrop.focusY,
                          zoom: nextCrop.zoom,
                        }
                      })
                    }}
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Posición X
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={monsterBattleCropDraft.focusX}
                    className="mt-2 h-2 w-full cursor-pointer accent-amber-700"
                    onChange={(event) => {
                      setMonsterBattleCropDraft((current) => {
                        if (!current) {
                          return current
                        }

                        const nextCrop = normalizeBattleTokenImageCrop({
                          imageFocusX: Number.parseFloat(event.target.value),
                          imageFocusY: current.focusY,
                          imageZoom: current.zoom,
                        })
                        return {
                          ...current,
                          focusX: nextCrop.focusX,
                          focusY: nextCrop.focusY,
                          zoom: nextCrop.zoom,
                        }
                      })
                    }}
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">
                  Posición Y
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={monsterBattleCropDraft.focusY}
                    className="mt-2 h-2 w-full cursor-pointer accent-amber-700"
                    onChange={(event) => {
                      setMonsterBattleCropDraft((current) => {
                        if (!current) {
                          return current
                        }

                        const nextCrop = normalizeBattleTokenImageCrop({
                          imageFocusX: current.focusX,
                          imageFocusY: Number.parseFloat(event.target.value),
                          imageZoom: current.zoom,
                        })
                        return {
                          ...current,
                          focusX: nextCrop.focusX,
                          focusY: nextCrop.focusY,
                          zoom: nextCrop.zoom,
                        }
                      })
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">Preview ficha</p>
                  <div className="relative mx-auto aspect-square w-24 overflow-hidden rounded-full border-2 border-stone-700 bg-stone-900">
                    <img
                      src={monsterBattleCropDraft.image}
                      alt={monsterBattleCropDraft.sourceLabel}
                      className="absolute inset-0 size-full object-cover"
                      style={monsterBattleCropStyle}
                      draggable={false}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-600">Preview iniciativa</p>
                  <div className="relative mx-auto aspect-[3/4] w-24 overflow-hidden border-2 border-stone-700 bg-stone-900">
                    <img
                      src={monsterBattleCropDraft.image}
                      alt={monsterBattleCropDraft.sourceLabel}
                      className="absolute inset-0 size-full object-cover"
                      style={monsterBattleCropStyle}
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setMonsterBattleCropDraft(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={!isSelectedBattleEditable || !monsterBattleCropDraft}
              onClick={handleSaveMonsterBattleCrop}
            >
              Guardar encuadre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CharacterSheetDialog
        open={isLibrarySheetOpen}
        onOpenChange={(open) => {
          setIsLibrarySheetOpen(open)
          if (!open) {
            setLibrarySheetCharacter(null)
          }
        }}
        value={librarySheetCharacter?.characterSheet ?? null}
        onSave={async () => false}
        characterName={librarySheetCharacter?.nombre ?? ""}
        characterRace={librarySheetCharacter?.raza ?? ""}
        characterClass={librarySheetCharacter?.clase ?? ""}
        readOnly
      />

      <Dialog open={Boolean(pendingDeleteToken)} onOpenChange={(open) => {
        if (!open) {
          setPendingDeleteToken(null)
        }
      }}>
        <DialogContent className="max-w-sm rounded-3xl border-stone-200 bg-white/95 p-5">
          <DialogHeader>
            <DialogTitle>Eliminar ficha</DialogTitle>
            <DialogDescription>
              {pendingDeleteToken
                ? `Vas a eliminar la ficha #${pendingDeleteToken.number} (${pendingDeleteToken.nombre}).`
                : "Vas a eliminar la ficha seleccionada."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setPendingDeleteToken(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (pendingDeleteToken) {
                  removeToken(pendingDeleteToken.number)
                }
                setPendingDeleteToken(null)
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
