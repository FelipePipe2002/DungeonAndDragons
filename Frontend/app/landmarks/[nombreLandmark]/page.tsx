"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  BookOpenText,
  Building2,
  CalendarDays,
  Download,
  Expand,
  Link2,
  Map as MapIcon,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Shield,
  Users,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import { CharacterDetailDialog, type CharacterDetailData } from "@/components/dialog/detailed/CharacterDetailDialog"
import { CreateLandmarkEventDialog } from "@/components/dialog/detailed/CreateLandmarkEventDialog"
import { EstadoDetailDialog } from "@/components/dialog/detailed/EstadoDetailDialog"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import { BuildingResumeDialog } from "@/components/dialog/resumed/BuildingResumeDialog"
import { CharacterResumeDialog } from "@/components/dialog/resumed/CharacterResumeDialog"
import { OrganizationResumeDialog } from "@/components/dialog/resumed/OrganizationResumeDialog"
import BuildingsMap from "@/components/buildings/BuildingsMap"
import DungeonMap, { DEFAULT_DUNGEON_DISPLAY_STYLE, type DungeonDisplayStyle } from "@/components/dungeons/DungeonMap"
import { ImageEmbeddingPicker } from "@/components/media/ImageEmbeddingPicker"
import { MentionField, type MentionRef } from "@/components/mentionField/MentionField"
import { SearchInput } from "@/components/search/SearchInput"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { generateDungeonMapDocument, stringifyDungeonMapDocument } from "@/lib/dungeons/generator"
import type { DungeonMapDocument } from "@/lib/dungeons/types"
import { isDungeonJsonDocument, resolveLandmarkMapMode } from "@/lib/landmarks/map-policy"
import { landmarkNameToSlug } from "@/lib/landmarks/slug"
import { openPresentationScreen } from "@/lib/presentation/screen"
import { matchesSearchQuery } from "@/lib/search/utils"
import { buildAssetUrl, deleteAsset, uploadAsset, uploadJsonAsset } from "@/lib/services/asset-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { createBattle, fetchBattleHistory } from "@/lib/services/battle-api.service"
import { fetchBuildings, updateBuilding } from "@/lib/services/building-api.service"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchLandmarks, updateLandmark } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import {
  DUNGEON_MAP_JSON_TYPE,
  type BattleSummary,
   type Building,
   type Character,
   type Estado,
   type Landmark,
  type LandmarkEvent,
  type LandmarkType,
  type Organization,
} from "@/lib/types"
import styles from "./LandmarkDetailPage.module.css"

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const INITIAL_SCALE = 1
const DUNGEON_INVALID_JSON_ERROR_MESSAGE = "El archivo JSON no es valido."
const DUNGEON_JSON_MISSING_TYPE_ERROR_MESSAGE = 'El JSON de una mazmorra debe incluir type="mazmorra".'
const DUNGEON_JSON_WRONG_TYPE_ERROR_MESSAGE = 'El JSON cargado no corresponde a una mazmorra: se esperaba type="mazmorra".'
const DUNGEON_PRELOADED_MAP_ERROR_MESSAGE = "Las mazmorras no permiten URLs externas ni mapas precargados."

const LANDMARK_TYPE_LABELS: Record<LandmarkType, string> = {
  ciudad: "Ciudad",
  pueblo: "Pueblo",
  aldea: "Aldea",
  fuerte: "Fuerte",
  puente: "Puente",
  bandera: "Bandera",
  campamento: "Campamento",
  mazmorra: "Mazmorra",
}

const BATTLE_GRID_SUPPORTED_TYPES = new Set<LandmarkType>(["puente", "bandera", "campamento", "mazmorra"])

type Point = {
  x: number
  y: number
}

type Size = {
  width: number
  height: number
}

type DragState = {
  pointerId: number
  start: Point
  origin: Point
}

type EditableLandmarkData = {
  descripcionCorta: string
  historia: string
}

type MapGridDraft = {
  enabled: boolean
  cellSize: string
  offsetX: string
  offsetY: string
}

type DungeonEditorDraft = {
  name: string
  seed: string
  width: string
  height: string
  roomCount: string
  minRoomWidth: string
  maxRoomWidth: string
  minRoomHeight: string
  maxRoomHeight: string
  roomPadding: string
  roomDispersion: string
  allowIntersections: boolean
  generateTorches: boolean
  torchDensityPercent: string
  roomColor: string
  corridorColor: string
  roomTextureUrl: string
  corridorTextureUrl: string
  roomTextureUrls: string[]
  corridorTextureUrls: string[]
  roomTextureRandomRotation: boolean
  corridorTextureRandomRotation: boolean
  doorColor: string
  showCorridorWalls: boolean
  wallWidth: string
  corridorWallColor: string
  roomWallColor: string
}

type DungeonGeneratorConfig = {
  version: 1
  preset: "rooms-corridors"
  name: string
  seed: string
  width: number
  height: number
  roomCount: number
  minRoomWidth: number
  maxRoomWidth: number
  minRoomHeight: number
  maxRoomHeight: number
  roomPadding: number
  roomDispersion: number
  allowIntersections: boolean
  generateTorches: boolean
  torchDensityPercent: number
  displayStyle: DungeonDisplayStyle
}

type ReferenceIndexes = {
  landmarksById: Map<number, Landmark>
  buildingsById: Map<number, Building>
  charactersById: Map<number, Character>
  organizationsById: Map<number, Organization>
  landmarkNameById: Map<number, string>
  buildingNameById: Map<number, string>
  organizationNameById: Map<number, string>
}

type LandmarkScopedData = {
  buildings: Building[]
  characters: Character[]
  organizations: Organization[]
  landmarkNameById: Map<number, string>
  buildingNameById: Map<number, string>
  organizationNameById: Map<number, string>
}

interface LandmarkDetailPageProps {
  params: Promise<{
    nombreLandmark: string
  }>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function isImageIcon(value: string | undefined) {
  if (!value) return false

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.includes("/")
  )
}

function fallbackIconForType(tipo: LandmarkType) {
  if (tipo === "ciudad") return "🏰"
  if (tipo === "pueblo") return "🏘️"
  if (tipo === "aldea") return "🏡"
  if (tipo === "fuerte") return "🏯"
  if (tipo === "puente") return "🌉"
  if (tipo === "bandera") return "🚩"
  if (tipo === "campamento") return "⛺"
  if (tipo === "mazmorra") return "🗿"
  return "📍"
}

function assetFileToPublicUrl(filename: string) {
  if (
    filename.startsWith("/") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://") ||
    filename.startsWith("data:")
  ) {
    return filename
  }

  return `/maps/${filename}`
}

function mapUrlFromReference(landmark: Landmark): string | null {
  if (typeof landmark.mapAssetId === "number" && landmark.mapAssetId > 0) {
    return buildAssetUrl(landmark.mapAssetId)
  }

  const ref = landmark.mapa
  if (!ref) return null

  if (ref.kind === "embedded") {
    return ref.dataUrl
  }

  if (ref.kind === "external") {
    return ref.url
  }

  if (ref.kind === "asset") {
    return assetFileToPublicUrl(ref.filename)
  }

  if (ref.kind === "stored") {
    const assetId = Number.parseInt(ref.key, 10)
    if (Number.isFinite(assetId) && assetId > 0) {
      return buildAssetUrl(assetId)
    }
    return null
  }

  if (ref.kind === "buildings") {
    if (ref.source === "external") {
      return ref.url
    }

    return assetFileToPublicUrl(ref.filename)
  }

  return null
}

function normalizePreloadedMapValue(value: string) {
  const normalized = value.trim()
  if (!normalized) return ""

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("/")
  ) {
    return normalized
  }

  return `/maps/${normalized.replace(/^maps\/preloaded\//, "")}`
}

function getDungeonJsonUploadError(value: string) {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    return DUNGEON_INVALID_JSON_ERROR_MESSAGE
  }

  if (!parsed || typeof parsed !== "object") {
    return DUNGEON_JSON_MISSING_TYPE_ERROR_MESSAGE
  }

  const root = parsed as { type?: unknown }
  if (root.type === undefined) {
    return DUNGEON_JSON_MISSING_TYPE_ERROR_MESSAGE
  }

  if (root.type !== DUNGEON_MAP_JSON_TYPE) {
    return DUNGEON_JSON_WRONG_TYPE_ERROR_MESSAGE
  }

  return null
}

function decodeSlug(raw: string | undefined) {
  if (!raw) return ""

  try {
    return decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}

function toDefaultDungeonEditorDraft(name: string | undefined): DungeonEditorDraft {
  const defaultRoomTextureUrl = DEFAULT_DUNGEON_DISPLAY_STYLE.roomTextureUrl ?? ""
  const defaultCorridorTextureUrl = DEFAULT_DUNGEON_DISPLAY_STYLE.corridorTextureUrl ?? ""
  return {
    name: name ?? "",
    seed: "",
    width: "48",
    height: "32",
    roomCount: "6",
    minRoomWidth: "5",
    maxRoomWidth: "10",
    minRoomHeight: "4",
    maxRoomHeight: "8",
    roomPadding: "1",
    roomDispersion: "0",
    allowIntersections: true,
    generateTorches: true,
    torchDensityPercent: "100",
    roomColor: DEFAULT_DUNGEON_DISPLAY_STYLE.roomColor,
    corridorColor: DEFAULT_DUNGEON_DISPLAY_STYLE.corridorColor,
    roomTextureUrl: defaultRoomTextureUrl,
    corridorTextureUrl: defaultCorridorTextureUrl,
    roomTextureUrls: defaultRoomTextureUrl ? [defaultRoomTextureUrl] : [],
    corridorTextureUrls: defaultCorridorTextureUrl ? [defaultCorridorTextureUrl] : [],
    roomTextureRandomRotation: DEFAULT_DUNGEON_DISPLAY_STYLE.roomTextureRandomRotation ?? false,
    corridorTextureRandomRotation: DEFAULT_DUNGEON_DISPLAY_STYLE.corridorTextureRandomRotation ?? false,
    doorColor: DEFAULT_DUNGEON_DISPLAY_STYLE.doorColor,
    showCorridorWalls: DEFAULT_DUNGEON_DISPLAY_STYLE.showCorridorWalls,
    wallWidth: String(DEFAULT_DUNGEON_DISPLAY_STYLE.wallWidth),
    corridorWallColor: DEFAULT_DUNGEON_DISPLAY_STYLE.corridorWallColor,
    roomWallColor: DEFAULT_DUNGEON_DISPLAY_STYLE.roomWallColor,
  }
}

function parseDungeonGeneratorConfig(value: string | undefined): DungeonGeneratorConfig | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<DungeonGeneratorConfig>
    if (!parsed || typeof parsed !== "object") return null
    if (parsed.version !== 1 || parsed.preset !== "rooms-corridors") return null
    if (typeof parsed.seed !== "string") return null

    const numericFields = [
      parsed.width,
      parsed.height,
      parsed.roomCount,
      parsed.minRoomWidth,
      parsed.maxRoomWidth,
      parsed.minRoomHeight,
      parsed.maxRoomHeight,
      parsed.roomPadding,
      parsed.roomDispersion,
    ]
    if (numericFields.some((field) => typeof field !== "number" || !Number.isFinite(field))) {
      return null
    }
    if (typeof parsed.allowIntersections !== "boolean") return null
    const generateTorches = typeof parsed.generateTorches === "boolean" ? parsed.generateTorches : true
    const torchDensityPercent = typeof parsed.torchDensityPercent === "number" && Number.isFinite(parsed.torchDensityPercent)
      ? Math.min(300, Math.max(0, Math.round(parsed.torchDensityPercent)))
      : 100
    const rawDisplayStyle = parsed.displayStyle
    const displayStyle = {
      ...DEFAULT_DUNGEON_DISPLAY_STYLE,
      ...(rawDisplayStyle && typeof rawDisplayStyle === "object" ? rawDisplayStyle : {}),
    }
    if (
      typeof displayStyle.roomColor !== "string"
      || typeof displayStyle.corridorColor !== "string"
      || typeof (displayStyle.roomTextureUrl ?? "") !== "string"
      || typeof (displayStyle.corridorTextureUrl ?? "") !== "string"
      || !Array.isArray(displayStyle.roomTextureUrls ?? [])
      || !Array.isArray(displayStyle.corridorTextureUrls ?? [])
      || (displayStyle.roomTextureUrls ?? []).some((value) => typeof value !== "string")
      || (displayStyle.corridorTextureUrls ?? []).some((value) => typeof value !== "string")
      || typeof (displayStyle.roomTextureRandomRotation ?? false) !== "boolean"
      || typeof (displayStyle.corridorTextureRandomRotation ?? false) !== "boolean"
      || typeof displayStyle.doorColor !== "string"
      || typeof displayStyle.wallWidth !== "number"
      || !Number.isFinite(displayStyle.wallWidth)
      || typeof displayStyle.corridorWallColor !== "string"
      || typeof displayStyle.roomWallColor !== "string"
      || typeof displayStyle.showCorridorWalls !== "boolean"
    ) {
      return null
    }

    const roomTextureUrls = (displayStyle.roomTextureUrls ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
    const corridorTextureUrls = (displayStyle.corridorTextureUrls ?? [])
      .map((value) => value.trim())
      .filter(Boolean)

    if (roomTextureUrls.length === 0 && displayStyle.roomTextureUrl?.trim()) {
      roomTextureUrls.push(displayStyle.roomTextureUrl.trim())
    }
    if (corridorTextureUrls.length === 0 && displayStyle.corridorTextureUrl?.trim()) {
      corridorTextureUrls.push(displayStyle.corridorTextureUrl.trim())
    }

    const width = parsed.width
    const height = parsed.height
    const roomCount = parsed.roomCount
    const minRoomWidth = parsed.minRoomWidth
    const maxRoomWidth = parsed.maxRoomWidth
    const minRoomHeight = parsed.minRoomHeight
    const maxRoomHeight = parsed.maxRoomHeight
    const roomPadding = parsed.roomPadding
    const roomDispersion = parsed.roomDispersion
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      typeof roomCount !== "number" ||
      typeof minRoomWidth !== "number" ||
      typeof maxRoomWidth !== "number" ||
      typeof minRoomHeight !== "number" ||
      typeof maxRoomHeight !== "number" ||
      typeof roomPadding !== "number" ||
      typeof roomDispersion !== "number"
    ) {
      return null
    }

    return {
      version: 1,
      preset: "rooms-corridors",
      name: typeof parsed.name === "string" ? parsed.name : "",
      seed: parsed.seed,
      width,
      height,
      roomCount,
      minRoomWidth,
      maxRoomWidth,
      minRoomHeight,
      maxRoomHeight,
      roomPadding,
      roomDispersion,
      allowIntersections: parsed.allowIntersections,
      generateTorches,
      torchDensityPercent,
      displayStyle: {
        ...displayStyle,
        roomTextureUrl: roomTextureUrls[0] ?? "",
        corridorTextureUrl: corridorTextureUrls[0] ?? "",
        roomTextureUrls,
        corridorTextureUrls,
      },
    }
  } catch {
    return null
  }
}

function toDungeonEditorDraftFromLandmark(landmark: Landmark | null): DungeonEditorDraft {
  const fallback = toDefaultDungeonEditorDraft(landmark?.nombre)
  const config = parseDungeonGeneratorConfig(landmark?.dungeonGeneratorConfig)
  if (!config) {
    return fallback
  }

  const roomTextureUrls = (config.displayStyle.roomTextureUrls ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
  const corridorTextureUrls = (config.displayStyle.corridorTextureUrls ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
  const roomTextureUrl = roomTextureUrls[0] ?? config.displayStyle.roomTextureUrl ?? ""
  const corridorTextureUrl = corridorTextureUrls[0] ?? config.displayStyle.corridorTextureUrl ?? ""

  return {
    name: config.name || landmark?.nombre || "",
    seed: config.seed,
    width: String(config.width),
    height: String(config.height),
    roomCount: String(config.roomCount),
    minRoomWidth: String(config.minRoomWidth),
    maxRoomWidth: String(config.maxRoomWidth),
    minRoomHeight: String(config.minRoomHeight),
    maxRoomHeight: String(config.maxRoomHeight),
    roomPadding: String(config.roomPadding),
    roomDispersion: String(config.roomDispersion),
    allowIntersections: config.allowIntersections,
    generateTorches: config.generateTorches,
    torchDensityPercent: String(config.torchDensityPercent),
    roomColor: config.displayStyle.roomColor,
    corridorColor: config.displayStyle.corridorColor,
    roomTextureUrl,
    corridorTextureUrl,
    roomTextureUrls: roomTextureUrls.length > 0 ? roomTextureUrls : (roomTextureUrl ? [roomTextureUrl] : []),
    corridorTextureUrls: corridorTextureUrls.length > 0 ? corridorTextureUrls : (corridorTextureUrl ? [corridorTextureUrl] : []),
    roomTextureRandomRotation: config.displayStyle.roomTextureRandomRotation ?? false,
    corridorTextureRandomRotation: config.displayStyle.corridorTextureRandomRotation ?? false,
    doorColor: config.displayStyle.doorColor,
    showCorridorWalls: config.displayStyle.showCorridorWalls,
    wallWidth: String(config.displayStyle.wallWidth),
    corridorWallColor: config.displayStyle.corridorWallColor,
    roomWallColor: config.displayStyle.roomWallColor,
  }
}

function readDungeonGeneratorConfigFromJson(value: string): DungeonGeneratorConfig | null {
  try {
    const parsed = JSON.parse(value) as { generatorConfig?: unknown }
    if (!parsed || typeof parsed !== "object") return null
    if (parsed.generatorConfig === undefined) return null
    return parseDungeonGeneratorConfig(JSON.stringify(parsed.generatorConfig))
  } catch {
    return null
  }
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(objectUrl)
}

function sanitizeDungeonEditorIntegerInput(value: string) {
  return value.replace(/[^0-9]/g, "")
}

function normalizeDungeonEditorInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed)) {
    return Math.min(max, Math.max(min, Math.round(fallback)))
  }

  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function sanitizeDungeonEditorDecimalInput(value: string) {
  return value.replace(/[^0-9.,-]/g, "")
}

function normalizeDungeonEditorDecimal(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(value.trim().replace(",", "."))
  if (!Number.isFinite(parsed)) {
    return Math.min(max, Math.max(min, fallback))
  }

  return Math.min(max, Math.max(min, parsed))
}

function createAutoDungeonSeed() {
  return `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function CountCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card className="flex-1 bg-secondary/50 p-2 text-center">
      <div className="mb-1 flex justify-center text-primary/60">{icon}</div>
      <div className="font-serif text-lg font-bold text-foreground">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </Card>
  )
}

function toEditableLandmarkData(landmark: Landmark | null): EditableLandmarkData {
  return {
    descripcionCorta: landmark?.descripcionCorta ?? "",
    historia: landmark?.historia ?? "",
  }
}

function formatBattleSummaryTimestamp(summary: BattleSummary) {
  const source =
    summary.status === "active"
      ? summary.updatedAt ?? summary.createdAt
      : summary.endedAt ?? summary.updatedAt ?? summary.createdAt

  if (!source) {
    return "Sin fecha"
  }

  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha"
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed)
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeMapRotationDegrees(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = Math.round(value)
  const snappedQuarterTurns = Math.round(normalized / 90)
  return ((snappedQuarterTurns % 4) + 4) % 4 * 90
}

function normalizeMapGridCellSize(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 48
  return Math.round(clamp(value, 8, 512) * 100) / 100
}

function normalizeMapGridOffset(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function formatMapGridNumber(value: number | null | undefined) {
  const normalized = typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
  const asText = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/\.?0+$/, "")
  return asText.replace(".", ",")
}

function parseMapGridNumber(value: string) {
  const normalized = value.trim().replace(",", ".")
  if (!normalized || normalized === "-" || normalized === "+" || normalized === "." || normalized === "-.") {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function toMapGridDraft(landmark: Landmark | null): MapGridDraft {
  return {
    enabled: Boolean(landmark?.mapGridEnabled),
    cellSize: formatMapGridNumber(normalizeMapGridCellSize(landmark?.mapGridCellSize)),
    offsetX: formatMapGridNumber(normalizeMapGridOffset(landmark?.mapGridOffsetX)),
    offsetY: formatMapGridNumber(normalizeMapGridOffset(landmark?.mapGridOffsetY)),
  }
}

function findLandmarkBySlug(landmarks: Landmark[], slug: string) {
  return landmarks.find((item) => landmarkNameToSlug(item.nombre) === slug) ?? null
}

function buildReferenceIndexes(
  allLandmarks: Landmark[],
  currentLandmark: Landmark | null,
  storedBuildings: Building[],
  storedCharacters: Character[],
  storedOrganizations: Organization[],
): ReferenceIndexes {
  const landmarksById = new Map<number, Landmark>()
  const buildingsById = new Map<number, Building>()
  const charactersById = new Map<number, Character>()
  const organizationsById = new Map<number, Organization>()

  for (const storedLandmark of allLandmarks) {
    landmarksById.set(storedLandmark.id, storedLandmark)
  }
  if (currentLandmark) {
    landmarksById.set(currentLandmark.id, currentLandmark)
  }

  // Include nested character/org entities from landmarks so relation ids can still resolve.
  for (const landmark of landmarksById.values()) {
    for (const character of landmark.personajes ?? []) {
      charactersById.set(character.id, {
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })
    }
  }

  for (const building of storedBuildings) {
    buildingsById.set(building.id, building)
  }
  for (const character of storedCharacters) {
    charactersById.set(character.id, character)
  }
  for (const organization of storedOrganizations) {
    organizationsById.set(organization.id, organization)
  }

  const landmarkNameById = new Map<number, string>()
  for (const [id, item] of landmarksById) {
    landmarkNameById.set(id, item.nombre)
  }

  const buildingNameById = new Map<number, string>()
  for (const [id, item] of buildingsById) {
    buildingNameById.set(id, item.nombre)
  }

  const organizationNameById = new Map<number, string>()
  for (const [id, item] of organizationsById) {
    organizationNameById.set(id, item.nombre)
  }

  return {
    landmarksById,
    buildingsById,
    charactersById,
    organizationsById,
    landmarkNameById,
    buildingNameById,
    organizationNameById,
  }
}

function compareByName(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, "es")
}

function buildScopedLandmarkData(
  allLandmarks: Landmark[],
  landmark: Landmark,
  storedBuildings: Building[],
  storedCharacters: Character[],
  storedOrganizations: Organization[],
): LandmarkScopedData {
  const landmarkNameById = new Map(allLandmarks.map((item) => [item.id, item.nombre]))
  const buildingNameById = new Map(storedBuildings.map((item) => [item.id, item.nombre]))
  const organizationNameById = new Map(storedOrganizations.map((item) => [item.id, item.nombre]))

  // Backfill landmark names from current collections so ids can always resolve labels.
  for (const storedLandmark of allLandmarks) {
    if (!landmarkNameById.has(storedLandmark.id)) {
      landmarkNameById.set(storedLandmark.id, storedLandmark.nombre)
    }
  }

  const storedCharacterIds = new Set(storedCharacters.map((character) => character.id))

  const buildings = storedBuildings.filter((building) => building.landmarkId === landmark.id).sort(compareByName)

  const characters = [
    ...storedCharacters.filter((character) => character.landmarkId === landmark.id),
    ...landmark.personajes.filter((character) => !storedCharacterIds.has(character.id)),
  ].sort(compareByName)

  const organizations = [
    ...storedOrganizations.filter((organization) => organization.landmarks.includes(landmark.id)),
  ].sort(compareByName)
  if (!landmarkNameById.has(landmark.id)) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  return { buildings, characters, organizations, landmarkNameById, buildingNameById, organizationNameById }
}

export default function LandmarkDetailPage({ params }: LandmarkDetailPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()

  const slug = useMemo(
    () => decodeSlug(resolvedParams?.nombreLandmark),
    [resolvedParams?.nombreLandmark]
  )

  const [landmark, setLandmark] = useState<Landmark | null>(null)
  const [allLandmarks, setAllLandmarks] = useState<Landmark[]>([])
  const [hasResolvedLoad, setHasResolvedLoad] = useState(false)

  const [scale, setScale] = useState(INITIAL_SCALE)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<EditableLandmarkData>(() =>
    toEditableLandmarkData(null)
  )
  const [uploadedMapUrl, setUploadedMapUrl] = useState<string | null>(null)
  const [buildingsMapError, setBuildingsMapError] = useState<string | null>(null)
  const [mapGridError, setMapGridError] = useState<string | null>(null)
  const [isRotatingMap, setIsRotatingMap] = useState(false)
  const [isGridPanelOpen, setIsGridPanelOpen] = useState(false)
  const [isSavingMapGrid, setIsSavingMapGrid] = useState(false)
  const [isSavingDungeonMap, setIsSavingDungeonMap] = useState(false)
  const [isSavingDungeonConfig, setIsSavingDungeonConfig] = useState(false)
  const [mapGridDraft, setMapGridDraft] = useState<MapGridDraft>(() => toMapGridDraft(null))
  const [dungeonEditorDraft, setDungeonEditorDraft] = useState<DungeonEditorDraft>(() => toDefaultDungeonEditorDraft(undefined))
  const [activeRoomTextureIndex, setActiveRoomTextureIndex] = useState(0)
  const [activeCorridorTextureIndex, setActiveCorridorTextureIndex] = useState(0)
  const [autoDungeonSeed, setAutoDungeonSeed] = useState(() => createAutoDungeonSeed())
  const [mapViewportSize, setMapViewportSize] = useState<Size | null>(null)
  const [mapImageNaturalSize, setMapImageNaturalSize] = useState<Size | null>(null)
  const [preloadedMapValue, setPreloadedMapValue] = useState("")
  const [dungeonEditorError, setDungeonEditorError] = useState<string | null>(null)
  const [selectedLandmarkDetail, setSelectedLandmarkDetail] = useState<Landmark | null>(null)
  const [selectedEstadoDetailId, setSelectedEstadoDetailId] = useState<number | null>(null)
  const [isCreateEventDialogOpen, setIsCreateEventDialogOpen] = useState(false)
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null)
  const [eventSaveError, setEventSaveError] = useState<string | null>(null)
  const [selectedBuildingDetailId, setSelectedBuildingDetailId] = useState<number | null>(null)
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false)
  const [activeMapLinkBuildingId, setActiveMapLinkBuildingId] = useState<number | null>(null)
  const [activeMapLinkOrganizationId, setActiveMapLinkOrganizationId] = useState<number | null>(null)
  const [focusedMapBuildingIndex, setFocusedMapBuildingIndex] = useState<number | null>(null)
  const [focusedMapOrganizationIndices, setFocusedMapOrganizationIndices] = useState<number[] | null>(null)
  const [focusedMapRequestId, setFocusedMapRequestId] = useState(0)
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState<CharacterDetailData | null>(null)
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [selectedOrganizationDetail, setSelectedOrganizationDetail] = useState<Organization | null>(null)
  const [isOrganizationDialogOpen, setIsOrganizationDialogOpen] = useState(false)
  const [storedBuildings, setStoredBuildings] = useState<Building[]>([])
  const [storedCharacters, setStoredCharacters] = useState<Character[]>([])
  const [storedOrganizations, setStoredOrganizations] = useState<Organization[]>([])
  const [activeTab, setActiveTab] = useState("general")
  const [charactersSearchQuery, setCharactersSearchQuery] = useState("")
  const [buildingsSearchQuery, setBuildingsSearchQuery] = useState("")
  const [organizationsSearchQuery, setOrganizationsSearchQuery] = useState("")
  const [detailLandmarkNameById, setDetailLandmarkNameById] = useState<Map<number, string>>(() => new Map())
  const [detailBuildingNameById, setDetailBuildingNameById] = useState<Map<number, string>>(() => new Map())
  const [detailOrganizationNameById, setDetailOrganizationNameById] = useState<Map<number, string>>(
    () => new Map()
  )
  const [landmarkBattleHistory, setLandmarkBattleHistory] = useState<BattleSummary[]>([])
  const [isBattleHistoryLoading, setIsBattleHistoryLoading] = useState(false)
  const [isCreatingBattle, setIsCreatingBattle] = useState(false)
  const [battleHistoryError, setBattleHistoryError] = useState<string | null>(null)
  const [organizationMapLinks, setOrganizationMapLinks] = useState<Record<number, number[]>>({})

  const battleHistoryRequestRef = useRef(0)
  const organizationMapStorageKey = null

  useEffect(() => {
    let isActive = true
    void fetchCharacters()
      .then((characters) => {
        if (isActive) {
          setStoredCharacters(characters)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredCharacters([])
        }
      })
    void fetchBuildings()
      .then((buildings) => {
        if (isActive) {
          setStoredBuildings(buildings)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredBuildings([])
        }
      })
    void fetchOrganizations()
      .then((organizations) => {
        if (isActive) {
          setStoredOrganizations(organizations)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredOrganizations([])
        }
      })

    return () => {
      isActive = false
    }
  }, [slug])

  useEffect(() => {
    const referenceIndexes = buildReferenceIndexes(
      allLandmarks,
      landmark,
      storedBuildings,
      storedCharacters,
      storedOrganizations,
    )
    setDetailLandmarkNameById(referenceIndexes.landmarkNameById)
    setDetailBuildingNameById(referenceIndexes.buildingNameById)
    setDetailOrganizationNameById(referenceIndexes.organizationNameById)
  }, [allLandmarks, landmark, storedBuildings, storedCharacters, storedOrganizations])

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const panFrameRef = useRef<number | null>(null)
  const pendingOffsetRef = useRef<Point | null>(null)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)

  const flushPendingPanUpdate = () => {
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current)
      panFrameRef.current = null
    }
    if (pendingOffsetRef.current) {
      const nextOffset = pendingOffsetRef.current
      pendingOffsetRef.current = null
      offsetRef.current = nextOffset
      setOffset(nextOffset)
    }
  }

  useEffect(() => {
    let isActive = true
    setLandmark(null)
    setAllLandmarks([])
    setHasResolvedLoad(false)

    void fetchLandmarks()
      .then((landmarks) => {
        if (!isActive) return
        setAllLandmarks(landmarks)
        setLandmark(findLandmarkBySlug(landmarks, slug))
        setHasResolvedLoad(true)
      })
      .catch(() => {
        if (!isActive) return
        setAllLandmarks([])
        setLandmark(null)
        setHasResolvedLoad(true)
      })

    return () => {
      isActive = false
    }
  }, [slug])

  const mapUrlByReference = useMemo(() => {
    if (!landmark) return null
    return mapUrlFromReference(landmark)
  }, [landmark])

  const persistedMapMode = resolveLandmarkMapMode(landmark, mapUrlByReference)
  const effectiveMapUrl = uploadedMapUrl ?? mapUrlByReference
  const effectiveMapMode = resolveLandmarkMapMode(landmark, effectiveMapUrl)
  const shouldUseBuildingsMap = effectiveMapMode === "buildings-json"
  const shouldUseDungeonMapPlaceholder = effectiveMapMode === "dungeon-json"
  const shouldUseImageMap = effectiveMapMode === "image"
  const isDungeonLandmark = landmark?.tipo === "mazmorra"
  const canUseBattleGrid = landmark
    ? Boolean(effectiveMapUrl) && shouldUseImageMap && BATTLE_GRID_SUPPORTED_TYPES.has(landmark.tipo)
    : false
  const canManageLandmarkBattles = landmark
    ? Boolean(mapUrlByReference) &&
      (persistedMapMode === "dungeon-json" ||
        (persistedMapMode === "image" && Boolean(landmark.mapGridEnabled)))
    : false
  const dungeonEditorConfig = useMemo(() => {
    const width = normalizeDungeonEditorInteger(dungeonEditorDraft.width, 48, 8, 512)
    const height = normalizeDungeonEditorInteger(dungeonEditorDraft.height, 32, 8, 512)
    const roomCount = normalizeDungeonEditorInteger(dungeonEditorDraft.roomCount, 6, 0, 64)
    const minRoomWidth = normalizeDungeonEditorInteger(dungeonEditorDraft.minRoomWidth, 5, 3, width)
    const maxRoomWidth = normalizeDungeonEditorInteger(dungeonEditorDraft.maxRoomWidth, 10, 3, width)
    const minRoomHeight = normalizeDungeonEditorInteger(dungeonEditorDraft.minRoomHeight, 4, 3, height)
    const maxRoomHeight = normalizeDungeonEditorInteger(dungeonEditorDraft.maxRoomHeight, 8, 3, height)
    const roomPadding = normalizeDungeonEditorInteger(dungeonEditorDraft.roomPadding, 1, 0, 8)
    const roomDispersion = normalizeDungeonEditorDecimal(dungeonEditorDraft.roomDispersion, 0, 0, 1)
    const torchDensityPercent = normalizeDungeonEditorInteger(dungeonEditorDraft.torchDensityPercent, 100, 0, 300)
    const allowIntersections = dungeonEditorDraft.allowIntersections
    const roomTextureUrls = dungeonEditorDraft.roomTextureUrls
      .map((value) => value.trim())
      .filter(Boolean)
    const corridorTextureUrls = dungeonEditorDraft.corridorTextureUrls
      .map((value) => value.trim())
      .filter(Boolean)
    const wallWidth = normalizeDungeonEditorDecimal(dungeonEditorDraft.wallWidth, DEFAULT_DUNGEON_DISPLAY_STYLE.wallWidth, 0.02, 0.48)
    const displayStyle: DungeonDisplayStyle = {
      roomColor: dungeonEditorDraft.roomColor,
      corridorColor: dungeonEditorDraft.corridorColor,
      roomTextureUrl: roomTextureUrls[0] ?? "",
      corridorTextureUrl: corridorTextureUrls[0] ?? "",
      roomTextureUrls,
      corridorTextureUrls,
      roomTextureRandomRotation: dungeonEditorDraft.roomTextureRandomRotation,
      corridorTextureRandomRotation: dungeonEditorDraft.corridorTextureRandomRotation,
      doorColor: dungeonEditorDraft.doorColor,
      showCorridorWalls: dungeonEditorDraft.showCorridorWalls,
      wallWidth,
      corridorWallColor: dungeonEditorDraft.corridorWallColor,
      roomWallColor: dungeonEditorDraft.roomWallColor,
      imageSmoothingEnabled: DEFAULT_DUNGEON_DISPLAY_STYLE.imageSmoothingEnabled,
      snapGridToPixel: DEFAULT_DUNGEON_DISPLAY_STYLE.snapGridToPixel,
    }
    const errors: string[] = []

    if (minRoomWidth > maxRoomWidth) {
      errors.push("El ancho minimo de sala no puede ser mayor que el maximo.")
    }

    if (minRoomHeight > maxRoomHeight) {
      errors.push("El alto minimo de sala no puede ser mayor que el maximo.")
    }

    return {
      width,
      height,
      roomCount,
      minRoomWidth,
      maxRoomWidth,
      minRoomHeight,
      maxRoomHeight,
      roomPadding,
      roomDispersion,
      torchDensityPercent,
      allowIntersections,
      displayStyle,
      errors,
    }
  }, [dungeonEditorDraft])
  const activeRoomTextureUrl = dungeonEditorDraft.roomTextureUrls[activeRoomTextureIndex] ?? ""
  const activeCorridorTextureUrl = dungeonEditorDraft.corridorTextureUrls[activeCorridorTextureIndex] ?? ""
  const mapRotationDegrees = normalizeMapRotationDegrees(landmark?.mapRotationDegrees)
  const parsedMapGridCellSize = parseMapGridNumber(mapGridDraft.cellSize)
  const parsedMapGridOffsetX = parseMapGridNumber(mapGridDraft.offsetX)
  const parsedMapGridOffsetY = parseMapGridNumber(mapGridDraft.offsetY)
  const isMapGridDraftValid =
    parsedMapGridCellSize !== null && parsedMapGridOffsetX !== null && parsedMapGridOffsetY !== null
  const normalizedDraftMapGridCellSize = normalizeMapGridCellSize(
    parsedMapGridCellSize ?? landmark?.mapGridCellSize,
  )
  const normalizedDraftMapGridOffsetX = normalizeMapGridOffset(parsedMapGridOffsetX ?? landmark?.mapGridOffsetX)
  const normalizedDraftMapGridOffsetY = normalizeMapGridOffset(parsedMapGridOffsetY ?? landmark?.mapGridOffsetY)
  const hasMapGridChanges =
    mapGridDraft.enabled !== Boolean(landmark?.mapGridEnabled) ||
    normalizedDraftMapGridCellSize !== normalizeMapGridCellSize(landmark?.mapGridCellSize) ||
    normalizedDraftMapGridOffsetX !== normalizeMapGridOffset(landmark?.mapGridOffsetX) ||
    normalizedDraftMapGridOffsetY !== normalizeMapGridOffset(landmark?.mapGridOffsetY)
  const rotatedMapRenderSize = useMemo(() => {
    if (!mapViewportSize || !mapImageNaturalSize) return null

    const viewportWidth = mapViewportSize.width
    const viewportHeight = mapViewportSize.height
    const naturalWidth = mapImageNaturalSize.width
    const naturalHeight = mapImageNaturalSize.height

    if (viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
      return null
    }

    const isQuarterTurn = mapRotationDegrees % 180 !== 0
    const rotatedWidth = isQuarterTurn ? naturalHeight : naturalWidth
    const rotatedHeight = isQuarterTurn ? naturalWidth : naturalHeight
    const scaleToFit = Math.min(viewportWidth / rotatedWidth, viewportHeight / rotatedHeight)

    if (!Number.isFinite(scaleToFit) || scaleToFit <= 0) {
      return null
    }

    return {
      imageWidth: naturalWidth * scaleToFit,
      imageHeight: naturalHeight * scaleToFit,
      boundsWidth: rotatedWidth * scaleToFit,
      boundsHeight: rotatedHeight * scaleToFit,
    }
  }, [mapImageNaturalSize, mapRotationDegrees, mapViewportSize])
  const mapGridRenderScale =
    rotatedMapRenderSize && mapImageNaturalSize && mapImageNaturalSize.width > 0
      ? rotatedMapRenderSize.imageWidth / mapImageNaturalSize.width
      : 1
  const mapGridOverlayStyle = useMemo(() => {
    if (!canUseBattleGrid || !mapGridDraft.enabled) return undefined

    const cellSize = normalizedDraftMapGridCellSize * mapGridRenderScale
    const offsetX = normalizedDraftMapGridOffsetX * mapGridRenderScale
    const offsetY = normalizedDraftMapGridOffsetY * mapGridRenderScale

    return {
      backgroundImage:
        "linear-gradient(to right, rgba(248, 234, 199, 0.58) 1px, transparent 1px), linear-gradient(to bottom, rgba(248, 234, 199, 0.58) 1px, transparent 1px)",
      backgroundSize: `${cellSize}px ${cellSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px, ${offsetX}px ${offsetY}px`,
    }
  }, [
    canUseBattleGrid,
    mapGridDraft.enabled,
    normalizedDraftMapGridCellSize,
    normalizedDraftMapGridOffsetX,
    normalizedDraftMapGridOffsetY,
    mapGridRenderScale,
  ])

  useEffect(() => {
    setUploadedMapUrl(null)
  }, [landmark?.id])

  useEffect(() => {
    setSelectedBuildingDetailId(null)
    setIsBuildingDialogOpen(false)
    setActiveMapLinkBuildingId(null)
    setActiveMapLinkOrganizationId(null)
    setFocusedMapBuildingIndex(null)
    setFocusedMapOrganizationIndices(null)
    setFocusedMapRequestId(0)
    setSelectedCharacterDetail(null)
    setIsCharacterDialogOpen(false)
    setSelectedOrganizationDetail(null)
    setIsOrganizationDialogOpen(false)
    setCharactersSearchQuery("")
    setBuildingsSearchQuery("")
    setOrganizationsSearchQuery("")
    setIsCreateEventDialogOpen(false)
    setEditingEventIndex(null)
    setEventSaveError(null)
    setOrganizationMapLinks({})
  }, [landmark?.id])

  useEffect(() => {
    if (!landmark) return
    setOrganizationMapLinks(landmark.organizationMapLinks ?? {})
  }, [landmark])

  useEffect(() => {
    if (landmark?.mapAssetId || !mapUrlByReference || mapUrlByReference.startsWith("data:")) {
      setPreloadedMapValue("")
      return
    }

    setPreloadedMapValue(mapUrlByReference)
  }, [landmark?.mapAssetId, mapUrlByReference])

  useEffect(() => {
    setBuildingsMapError(null)
  }, [effectiveMapMode, effectiveMapUrl])

  useEffect(() => {
    setMapGridError(null)
  }, [landmark?.id])

  useEffect(() => {
    setIsRotatingMap(false)
  }, [landmark?.id])

  useEffect(() => {
    setMapGridDraft(toMapGridDraft(landmark))
  }, [
    landmark?.id,
    landmark?.mapGridCellSize,
    landmark?.mapGridEnabled,
    landmark?.mapGridOffsetX,
    landmark?.mapGridOffsetY,
  ])

  useEffect(() => {
    if (!canUseBattleGrid) {
      setIsGridPanelOpen(false)
    }
  }, [canUseBattleGrid])

  useEffect(() => {
    if (!shouldUseImageMap) {
      setMapViewportSize(null)
      return
    }

    const viewport = viewportRef.current
    if (!viewport) {
      setMapViewportSize(null)
      return
    }

    const syncViewportSize = () => {
      setMapViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      })
    }

    syncViewportSize()

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      syncViewportSize()
    })
    resizeObserver.observe(viewport)

    return () => {
      resizeObserver.disconnect()
    }
  }, [effectiveMapUrl, shouldUseImageMap])

  useEffect(() => {
    setMapImageNaturalSize(null)
  }, [effectiveMapMode, effectiveMapUrl])

  useEffect(() => {
    if (!shouldUseBuildingsMap) {
      setActiveMapLinkBuildingId(null)
      setFocusedMapBuildingIndex(null)
      setFocusedMapRequestId(0)
    }
  }, [shouldUseBuildingsMap])

  useEffect(() => {
    setEditedData(toEditableLandmarkData(landmark))
    setIsEditing(false)
    setEditError(null)
  }, [landmark?.id])

  useEffect(() => {
    setDungeonEditorDraft(toDungeonEditorDraftFromLandmark(landmark))
    setActiveRoomTextureIndex(0)
    setActiveCorridorTextureIndex(0)
    setDungeonEditorError(null)
    setAutoDungeonSeed(createAutoDungeonSeed())
  }, [landmark?.id, landmark?.nombre, landmark?.dungeonGeneratorConfig])

  useEffect(() => {
    setActiveRoomTextureIndex((current) => {
      const maxIndex = Math.max(0, dungeonEditorDraft.roomTextureUrls.length - 1)
      return Math.min(current, maxIndex)
    })
  }, [dungeonEditorDraft.roomTextureUrls])

  useEffect(() => {
    setActiveCorridorTextureIndex((current) => {
      const maxIndex = Math.max(0, dungeonEditorDraft.corridorTextureUrls.length - 1)
      return Math.min(current, maxIndex)
    })
  }, [dungeonEditorDraft.corridorTextureUrls])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    setScale(INITIAL_SCALE)
    setOffset({ x: 0, y: 0 })
    scaleRef.current = INITIAL_SCALE
    offsetRef.current = { x: 0, y: 0 }
    pendingOffsetRef.current = null
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current)
      panFrameRef.current = null
    }
  }, [effectiveMapUrl, landmark?.id])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !effectiveMapUrl || !shouldUseImageMap) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()

      const rect = viewport.getBoundingClientRect()
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      const zoomFactor = Math.exp(-event.deltaY * 0.0012)
      const currentScale = scaleRef.current
      const currentOffset = offsetRef.current
      const nextScale = clamp(currentScale * zoomFactor, MIN_SCALE, MAX_SCALE)
      if (nextScale === currentScale) return

      const worldX = (pointer.x - currentOffset.x) / currentScale
      const worldY = (pointer.y - currentOffset.y) / currentScale

      scaleRef.current = nextScale
      setScale(nextScale)
      const nextOffset = {
        x: pointer.x - worldX * nextScale,
        y: pointer.y - worldY * nextScale,
      }
      offsetRef.current = nextOffset
      setOffset(nextOffset)
    }

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", onWheel)
  }, [effectiveMapUrl, shouldUseImageMap])

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) {
        window.cancelAnimationFrame(panFrameRef.current)
        panFrameRef.current = null
      }
      pendingOffsetRef.current = null
    }
  }, [])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!effectiveMapUrl || !shouldUseImageMap) return
    if (event.button !== 0 && event.button !== 1) return
    event.preventDefault()

    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offsetRef.current,
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.start.x
    const deltaY = event.clientY - dragState.start.y

    pendingOffsetRef.current = {
      x: dragState.origin.x + deltaX,
      y: dragState.origin.y + deltaY,
    }
    if (panFrameRef.current === null) {
      panFrameRef.current = window.requestAnimationFrame(() => {
        panFrameRef.current = null
        if (!pendingOffsetRef.current) return
        const nextOffset = pendingOffsetRef.current
        pendingOffsetRef.current = null
        offsetRef.current = nextOffset
        setOffset(nextOffset)
      })
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    flushPendingPanUpdate()
    dragRef.current = null
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const applyPersistedLandmark = useCallback((nextLandmark: Landmark) => {
    setLandmark(nextLandmark)
    setAllLandmarks((current) =>
      current.some((item) => item.id === nextLandmark.id)
        ? current.map((item) => (item.id === nextLandmark.id ? nextLandmark : item))
        : [...current, nextLandmark],
    )
    return nextLandmark
  }, [])

  const persistLandmark = useCallback(
    async (nextLandmark: Landmark) => {
      const { id: _ignoredLandmarkId, ...payload } = nextLandmark
      const savedLandmark = await updateLandmark(nextLandmark.id, payload)
      return applyPersistedLandmark(savedLandmark)
    },
    [applyPersistedLandmark],
  )

  const handleFileChange = async (event: ReactChangeEvent<HTMLInputElement>) => {
    if (!landmark) return

    const file = event.target.files?.[0]
    event.target.value = ""
    setBuildingsMapError(null)

    if (!file) {
      return
    }

    try {
      const isJsonFile = file.type === "application/json" || file.name.toLowerCase().endsWith(".json")

      if (isJsonFile) {
        const jsonText = await file.text()
        const dungeonMapError = isDungeonLandmark && !isDungeonJsonDocument(jsonText)
          ? getDungeonJsonUploadError(jsonText)
          : null
        const importedDungeonConfig = isDungeonLandmark ? readDungeonGeneratorConfigFromJson(jsonText) : null

        if (dungeonMapError) {
          throw new Error(dungeonMapError)
        }

        const uploaded = await uploadJsonAsset(jsonText, file.name || "map.json")
        setUploadedMapUrl(uploaded.downloadUrl)
        await persistLandmark({
          ...landmark,
          mapAssetId: uploaded.id,
          mapAssetKind: uploaded.kind,
          dungeonGeneratorConfig: importedDungeonConfig ? JSON.stringify(importedDungeonConfig) : undefined,
          mapa: undefined,
        })
      } else if (file.type.startsWith("image/")) {
        const uploaded = await uploadAsset(file, {
          filename: file.name || "mapa",
        })
        setUploadedMapUrl(uploaded.downloadUrl)
        await persistLandmark({
          ...landmark,
          mapAssetId: uploaded.id,
          mapAssetKind: uploaded.kind,
          dungeonGeneratorConfig: undefined,
          mapa: undefined,
        })
      } else {
        return
      }

      setEditError(null)
    } catch (error) {
      setUploadedMapUrl(null)
      setBuildingsMapError(getBackendErrorMessage(error, "No se pudo guardar el mapa del landmark."))
    }
  }

  const buildDungeonGeneratorConfig = useCallback((seed: string): DungeonGeneratorConfig => ({
    version: 1,
    preset: "rooms-corridors",
    name: dungeonEditorDraft.name,
    seed,
    width: dungeonEditorConfig.width,
    height: dungeonEditorConfig.height,
    roomCount: dungeonEditorConfig.roomCount,
    minRoomWidth: dungeonEditorConfig.minRoomWidth,
    maxRoomWidth: dungeonEditorConfig.maxRoomWidth,
    minRoomHeight: dungeonEditorConfig.minRoomHeight,
    maxRoomHeight: dungeonEditorConfig.maxRoomHeight,
    roomPadding: dungeonEditorConfig.roomPadding,
    roomDispersion: dungeonEditorConfig.roomDispersion,
    allowIntersections: dungeonEditorConfig.allowIntersections,
    generateTorches: dungeonEditorDraft.generateTorches,
    torchDensityPercent: dungeonEditorConfig.torchDensityPercent,
    displayStyle: dungeonEditorConfig.displayStyle,
  }), [dungeonEditorConfig, dungeonEditorDraft.generateTorches, dungeonEditorDraft.name])

  const handleSaveGeneratedDungeonMap = useCallback(async () => {
    if (!landmark || !isDungeonLandmark || dungeonEditorConfig.errors.length > 0) {
      return
    }

    setIsSavingDungeonMap(true)
    setDungeonEditorError(null)
    setBuildingsMapError(null)

    let uploadedAssetId: number | null = null

    try {
      const explicitSeed = dungeonEditorDraft.seed.trim()
      const seedToUse = explicitSeed || createAutoDungeonSeed()
      const generatorConfig = buildDungeonGeneratorConfig(seedToUse)
      const documentToSave = generateDungeonMapDocument({
        preset: "rooms-corridors",
        name: generatorConfig.name,
        seed: generatorConfig.seed,
        width: generatorConfig.width,
        height: generatorConfig.height,
        roomCount: generatorConfig.roomCount,
        minRoomWidth: generatorConfig.minRoomWidth,
        maxRoomWidth: generatorConfig.maxRoomWidth,
        minRoomHeight: generatorConfig.minRoomHeight,
        maxRoomHeight: generatorConfig.maxRoomHeight,
        roomPadding: generatorConfig.roomPadding,
        roomDispersion: generatorConfig.roomDispersion,
        allowCorridorIntersections: generatorConfig.allowIntersections,
        lightingOptions: {
          enabled: generatorConfig.generateTorches,
          placement: "rooms-and-corridors",
          densityPercent: generatorConfig.torchDensityPercent,
        },
      })
      const jsonToSave = stringifyDungeonMapDocument(documentToSave)

      if (!explicitSeed) {
        setAutoDungeonSeed(seedToUse)
      }

      const previousAssetId = typeof landmark.mapAssetId === "number" ? landmark.mapAssetId : null
      const previousAssetKind = landmark.mapAssetKind

      const uploaded = await uploadJsonAsset(
        jsonToSave,
        `${landmarkNameToSlug(landmark.nombre) || "mazmorra"}.dungeon.json`,
      )
      uploadedAssetId = uploaded.id

      setUploadedMapUrl(uploaded.downloadUrl)
      await persistLandmark({
        ...landmark,
        mapAssetId: uploaded.id,
        mapAssetKind: uploaded.kind,
        dungeonGeneratorConfig: JSON.stringify(generatorConfig),
        mapa: undefined,
      })

      if (previousAssetId !== null && previousAssetId !== uploaded.id && previousAssetKind === "json") {
        try {
          await deleteAsset(previousAssetId)
        } catch {
          // Avoid blocking the save flow if backend cleanup fails.
        }
      }

      setEditError(null)
    } catch (error) {
      if (uploadedAssetId !== null) {
        try {
          await deleteAsset(uploadedAssetId)
        } catch {
          // Ignore cleanup failures after a save error.
        }
      }

      const message = getBackendErrorMessage(error, "No se pudo guardar el JSON de la mazmorra.")
      setDungeonEditorError(message)
      setBuildingsMapError(message)
      setUploadedMapUrl(null)
    } finally {
      setIsSavingDungeonMap(false)
    }
  }, [buildDungeonGeneratorConfig, dungeonEditorConfig.errors.length, dungeonEditorDraft.seed, isDungeonLandmark, landmark, persistLandmark])

  const handleSaveDungeonGeneratorConfig = useCallback(async () => {
    if (!landmark || !isDungeonLandmark || dungeonEditorConfig.errors.length > 0) {
      return
    }

    setIsSavingDungeonConfig(true)
    setDungeonEditorError(null)
    setBuildingsMapError(null)

    try {
      const explicitSeed = dungeonEditorDraft.seed.trim()
      const seedToUse = explicitSeed || autoDungeonSeed
      const generatorConfig = buildDungeonGeneratorConfig(seedToUse)

      if (!explicitSeed) {
        setAutoDungeonSeed(seedToUse)
      }

      await persistLandmark({
        ...landmark,
        dungeonGeneratorConfig: JSON.stringify(generatorConfig),
      })
      setEditError(null)
    } catch (error) {
      const message = getBackendErrorMessage(error, "No se pudo guardar la configuracion de la mazmorra.")
      setDungeonEditorError(message)
      setBuildingsMapError(message)
    } finally {
      setIsSavingDungeonConfig(false)
    }
  }, [autoDungeonSeed, buildDungeonGeneratorConfig, dungeonEditorConfig.errors.length, dungeonEditorDraft.seed, isDungeonLandmark, landmark, persistLandmark])

  const handleExportDungeonJson = useCallback(() => {
    if (!landmark || !isDungeonLandmark || dungeonEditorConfig.errors.length > 0) {
      return
    }

    try {
      const explicitSeed = dungeonEditorDraft.seed.trim()
      const seedToUse = explicitSeed || createAutoDungeonSeed()
      const generatorConfig = buildDungeonGeneratorConfig(seedToUse)
      const documentToExport = generateDungeonMapDocument({
        preset: "rooms-corridors",
        name: generatorConfig.name,
        seed: generatorConfig.seed,
        width: generatorConfig.width,
        height: generatorConfig.height,
        roomCount: generatorConfig.roomCount,
        minRoomWidth: generatorConfig.minRoomWidth,
        maxRoomWidth: generatorConfig.maxRoomWidth,
        minRoomHeight: generatorConfig.minRoomHeight,
        maxRoomHeight: generatorConfig.maxRoomHeight,
        roomPadding: generatorConfig.roomPadding,
        roomDispersion: generatorConfig.roomDispersion,
        allowCorridorIntersections: generatorConfig.allowIntersections,
        lightingOptions: {
          enabled: generatorConfig.generateTorches,
          placement: "rooms-and-corridors",
          densityPercent: generatorConfig.torchDensityPercent,
        },
      })

      if (!explicitSeed) {
        setAutoDungeonSeed(seedToUse)
      }

      downloadTextFile(
        `${landmarkNameToSlug(landmark.nombre) || "mazmorra"}.dungeon.json`,
        JSON.stringify({ ...documentToExport, generatorConfig }, null, 2),
      )
      setDungeonEditorError(null)
    } catch (error) {
      setDungeonEditorError(getBackendErrorMessage(error, "No se pudo exportar el JSON de la mazmorra."))
    }
  }, [buildDungeonGeneratorConfig, dungeonEditorConfig.errors.length, dungeonEditorDraft.seed, isDungeonLandmark, landmark])

  const handlePersistEditedDungeonDocument = useCallback(async (document: DungeonMapDocument) => {
    if (!landmark || !isDungeonLandmark) {
      return
    }

    const jsonToSave = stringifyDungeonMapDocument(document)
    const previousAssetId = typeof landmark.mapAssetId === "number" ? landmark.mapAssetId : null
    const previousAssetKind = landmark.mapAssetKind
    let uploadedAssetId: number | null = null

    try {
      const uploaded = await uploadJsonAsset(
        jsonToSave,
        `${landmarkNameToSlug(landmark.nombre) || "mazmorra"}.dungeon.json`,
      )
      uploadedAssetId = uploaded.id

      setUploadedMapUrl(uploaded.downloadUrl)
      await persistLandmark({
        ...landmark,
        mapAssetId: uploaded.id,
        mapAssetKind: uploaded.kind,
        mapa: undefined,
      })

      if (previousAssetId !== null && previousAssetId !== uploaded.id && previousAssetKind === "json") {
        try {
          await deleteAsset(previousAssetId)
        } catch {
          // Avoid blocking the save flow if backend cleanup fails.
        }
      }

      setBuildingsMapError(null)
      setEditError(null)
    } catch (error) {
      if (uploadedAssetId !== null) {
        try {
          await deleteAsset(uploadedAssetId)
        } catch {
          // Ignore cleanup failures after a save error.
        }
      }

      throw new Error(getBackendErrorMessage(error, "No se pudo guardar el JSON editado de la mazmorra."))
    }
  }, [isDungeonLandmark, landmark, persistLandmark])

  const handleDungeonEditorIntegerChange = useCallback(
    (field: keyof Pick<
      DungeonEditorDraft,
      "width" | "height" | "roomCount" | "minRoomWidth" | "maxRoomWidth" | "minRoomHeight" | "maxRoomHeight" | "roomPadding"
    >) => (event: ReactChangeEvent<HTMLInputElement>) => {
      const value = sanitizeDungeonEditorIntegerInput(event.target.value)
      setDungeonEditorDraft((current) => ({
        ...current,
        [field]: value,
      }))
    },
    [],
  )

  const handleDungeonEditorIntegerBlur = useCallback(
    (
      field: keyof Pick<
        DungeonEditorDraft,
        "width" | "height" | "roomCount" | "minRoomWidth" | "maxRoomWidth" | "minRoomHeight" | "maxRoomHeight" | "roomPadding" | "torchDensityPercent"
      >,
      fallback: number,
      min: number,
      max: number,
    ) => () => {
      setDungeonEditorDraft((current) => ({
        ...current,
        [field]: String(normalizeDungeonEditorInteger(current[field], fallback, min, max)),
      }))
    },
    [],
  )

  const handleDungeonEditorDispersionChange = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    const value = sanitizeDungeonEditorDecimalInput(event.target.value)
    setDungeonEditorDraft((current) => ({
      ...current,
      roomDispersion: value,
    }))
  }, [])

  const handleDungeonEditorDispersionBlur = useCallback(() => {
    setDungeonEditorDraft((current) => ({
      ...current,
      roomDispersion: String(normalizeDungeonEditorDecimal(current.roomDispersion, 0, 0, 1)),
    }))
  }, [])

  const handleDungeonEditorWallWidthChange = useCallback((event: ReactChangeEvent<HTMLInputElement>) => {
    const value = sanitizeDungeonEditorDecimalInput(event.target.value)
    setDungeonEditorDraft((current) => ({
      ...current,
      wallWidth: value,
    }))
  }, [])

  const handleDungeonEditorWallWidthBlur = useCallback(() => {
    setDungeonEditorDraft((current) => ({
      ...current,
      wallWidth: String(normalizeDungeonEditorDecimal(current.wallWidth, DEFAULT_DUNGEON_DISPLAY_STYLE.wallWidth, 0.02, 0.48)),
    }))
  }, [])

  const setRoomTextureAtIndex = useCallback((index: number, value: string) => {
    setDungeonEditorDraft((current) => {
      const next = [...current.roomTextureUrls]
      if (next.length === 0) {
        next.push("")
      }
      if (index < 0 || index >= next.length) {
        return current
      }

      const normalizedValue = value.trim()
      const hadImage = Boolean((next[index] ?? "").trim())

      if (!normalizedValue && hadImage) {
        next.splice(index, 1)
      } else {
        next[index] = normalizedValue
      }

      if (next.length === 0) {
        next.push("")
      }

      return {
        ...current,
        roomTextureUrls: next,
        roomTextureUrl: next[0] ?? "",
      }
    })
  }, [])

  const setCorridorTextureAtIndex = useCallback((index: number, value: string) => {
    setDungeonEditorDraft((current) => {
      const next = [...current.corridorTextureUrls]
      if (next.length === 0) {
        next.push("")
      }
      if (index < 0 || index >= next.length) {
        return current
      }

      const normalizedValue = value.trim()
      const hadImage = Boolean((next[index] ?? "").trim())

      if (!normalizedValue && hadImage) {
        next.splice(index, 1)
      } else {
        next[index] = normalizedValue
      }

      if (next.length === 0) {
        next.push("")
      }

      return {
        ...current,
        corridorTextureUrls: next,
        corridorTextureUrl: next[0] ?? "",
      }
    })
  }, [])

  const handleAddRoomTextureSlot = useCallback(() => {
    setDungeonEditorDraft((current) => {
      const next = [...current.roomTextureUrls, ""]
      return {
        ...current,
        roomTextureUrls: next,
        roomTextureUrl: next[0] ?? "",
      }
    })
    setActiveRoomTextureIndex((current) => current + 1)
  }, [])

  const handleAddCorridorTextureSlot = useCallback(() => {
    setDungeonEditorDraft((current) => {
      const next = [...current.corridorTextureUrls, ""]
      return {
        ...current,
        corridorTextureUrls: next,
        corridorTextureUrl: next[0] ?? "",
      }
    })
    setActiveCorridorTextureIndex((current) => current + 1)
  }, [])

  const handleRemoveRoomTextureSlot = useCallback((index: number) => {
    const currentUrls = dungeonEditorDraft.roomTextureUrls
    if (index < 0 || index >= currentUrls.length) {
      if (!(index === 0 && currentUrls.length === 0)) {
        return
      }
    }

    const next = currentUrls.filter((_, slotIndex) => slotIndex !== index)
    if (next.length === 0) {
      next.push("")
    }

    setDungeonEditorDraft((current) => ({
      ...current,
      roomTextureUrls: next,
      roomTextureUrl: next[0] ?? "",
    }))
    setActiveRoomTextureIndex(Math.min(activeRoomTextureIndex, next.length - 1))
  }, [activeRoomTextureIndex, dungeonEditorDraft.roomTextureUrls])

  const handleRemoveCorridorTextureSlot = useCallback((index: number) => {
    const currentUrls = dungeonEditorDraft.corridorTextureUrls
    if (index < 0 || index >= currentUrls.length) {
      if (!(index === 0 && currentUrls.length === 0)) {
        return
      }
    }

    const next = currentUrls.filter((_, slotIndex) => slotIndex !== index)
    if (next.length === 0) {
      next.push("")
    }

    setDungeonEditorDraft((current) => ({
      ...current,
      corridorTextureUrls: next,
      corridorTextureUrl: next[0] ?? "",
    }))
    setActiveCorridorTextureIndex(Math.min(activeCorridorTextureIndex, next.length - 1))
  }, [activeCorridorTextureIndex, dungeonEditorDraft.corridorTextureUrls])

  const handleRoomTexturePickerContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    event.stopPropagation()
    handleRemoveRoomTextureSlot(activeRoomTextureIndex)
  }, [activeRoomTextureIndex, handleRemoveRoomTextureSlot])

  const handleCorridorTexturePickerContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return
    event.preventDefault()
    event.stopPropagation()
    handleRemoveCorridorTextureSlot(activeCorridorTextureIndex)
  }, [activeCorridorTextureIndex, handleRemoveCorridorTextureSlot])

  const handleApplyPreloadedMap = useCallback(async () => {
    if (!landmark) return

    const normalized = normalizePreloadedMapValue(preloadedMapValue)
    if (!normalized) return

    setBuildingsMapError(null)
    setUploadedMapUrl(normalized)
    setPreloadedMapValue(normalized)

    try {
      if (isDungeonLandmark) {
        throw new Error(DUNGEON_PRELOADED_MAP_ERROR_MESSAGE)
      }

      await persistLandmark({
        ...landmark,
        mapAssetId: undefined,
        mapAssetKind: undefined,
          mapa: resolveLandmarkMapMode(
            { tipo: landmark.tipo, mapAssetKind: undefined, mapa: { kind: "external", url: normalized } },
            normalized,
          ) === "buildings-json"
            ? { kind: "buildings", source: "external", url: normalized }
            : { kind: "external", url: normalized },
        })
      setEditError(null)
    } catch (error) {
      setUploadedMapUrl(null)
      setBuildingsMapError(getBackendErrorMessage(error, "No se pudo actualizar el mapa del landmark."))
    }
  }, [isDungeonLandmark, landmark, persistLandmark, preloadedMapValue])

  const handleClearBrokenMap = useCallback(async () => {
    if (!landmark) return

    try {
      const { mapa: _ignoredMap, ...withoutMap } = landmark
      await persistLandmark({
        ...withoutMap,
        mapAssetId: undefined,
        mapAssetKind: undefined,
      })
      setUploadedMapUrl(null)
      setPreloadedMapValue("")
      setBuildingsMapError(null)
      setEditError(null)
    } catch (error) {
      setBuildingsMapError(getBackendErrorMessage(error, "No se pudo limpiar el mapa del landmark."))
    }
  }, [landmark, persistLandmark])

  const handleRotateMap = useCallback(async () => {
    if (!landmark || !effectiveMapUrl || !shouldUseImageMap || isRotatingMap) return

    setIsRotatingMap(true)
    setBuildingsMapError(null)

    try {
      await persistLandmark({
        ...landmark,
        mapRotationDegrees: normalizeMapRotationDegrees(mapRotationDegrees + 90),
      })
      setEditError(null)
    } catch (error) {
      setBuildingsMapError(getBackendErrorMessage(error, "No se pudo rotar el mapa del landmark."))
    } finally {
      setIsRotatingMap(false)
    }
  }, [effectiveMapUrl, isRotatingMap, landmark, mapRotationDegrees, persistLandmark, shouldUseImageMap])

  const handleSaveMapGrid = useCallback(async () => {
    if (!landmark || !canUseBattleGrid || isSavingMapGrid) return

    setIsSavingMapGrid(true)
    setMapGridError(null)

    try {
      await persistLandmark({
        ...landmark,
        mapGridEnabled: mapGridDraft.enabled,
        mapGridCellSize: normalizedDraftMapGridCellSize,
        mapGridOffsetX: normalizedDraftMapGridOffsetX,
        mapGridOffsetY: normalizedDraftMapGridOffsetY,
      })
      setEditError(null)
    } catch (error) {
      setMapGridError(getBackendErrorMessage(error, "No se pudo guardar la grilla del mapa."))
    } finally {
      setIsSavingMapGrid(false)
    }
  }, [
    canUseBattleGrid,
    isSavingMapGrid,
    landmark,
    mapGridDraft.enabled,
    normalizedDraftMapGridCellSize,
    normalizedDraftMapGridOffsetX,
    normalizedDraftMapGridOffsetY,
    persistLandmark,
  ])

  const handleShowMapOnPresentationScreen = useCallback(() => {
    if (!landmark || !effectiveMapUrl) return

    openPresentationScreen({
      landmarkSlug: landmarkNameToSlug(landmark.nombre),
    })
  }, [effectiveMapUrl, landmark])

  const handleResetMapGrid = useCallback(() => {
    setMapGridDraft(toMapGridDraft(landmark))
    setMapGridError(null)
  }, [landmark])

  const handleStartEdit = () => {
    setEditedData(toEditableLandmarkData(landmark))
    setIsEditing(true)
    setEditError(null)
  }

  const handleCancelEdit = () => {
    setEditedData(toEditableLandmarkData(landmark))
    setIsEditing(false)
    setEditError(null)
  }

  const handleSaveEdit = async () => {
    if (!landmark) return

    const nextLandmark: Landmark = {
      ...landmark,
      descripcionCorta: toOptionalText(editedData.descripcionCorta),
      historia: toOptionalText(editedData.historia),
    }

    try {
      await persistLandmark(nextLandmark)
      setIsEditing(false)
      setEditError(null)
    } catch (error) {
      setEditError(getBackendErrorMessage(error, "No se pudo guardar el landmark."))
    }
  }

  const handleSaveEvent = async (event: LandmarkEvent) => {
    if (!landmark) return

    const nextEvents =
      editingEventIndex === null
        ? [event, ...landmark.eventos]
        : landmark.eventos.map((currentEvent, index) =>
          index === editingEventIndex ? event : currentEvent,
        )

    const nextLandmark: Landmark = {
      ...landmark,
      eventos: nextEvents,
    }

    try {
      await persistLandmark(nextLandmark)
      setEditingEventIndex(null)
      setEventSaveError(null)
      return true
    } catch (error) {
      setEventSaveError(getBackendErrorMessage(error, "No se pudo guardar el evento."))
      return false
    }
  }

  const editingEvent = useMemo(() => {
    if (!landmark) return null
    if (editingEventIndex === null) return null
    return landmark.eventos[editingEventIndex] ?? null
  }, [editingEventIndex, landmark])

  const handleOpenMention = useCallback(
    (mention: MentionRef) => {
      if (!mention.type || typeof mention.id !== "number") return

      const referenceIndexes = buildReferenceIndexes(
        allLandmarks,
        landmark,
        storedBuildings,
        storedCharacters,
        storedOrganizations,
      )
      setDetailLandmarkNameById(referenceIndexes.landmarkNameById)
      setDetailBuildingNameById(referenceIndexes.buildingNameById)
      setDetailOrganizationNameById(referenceIndexes.organizationNameById)

      setSelectedLandmarkDetail(null)
      setSelectedEstadoDetailId(null)
      setSelectedBuildingDetailId(null)
      setIsBuildingDialogOpen(false)
      setSelectedCharacterDetail(null)
      setIsCharacterDialogOpen(false)
      setSelectedOrganizationDetail(null)
      setIsOrganizationDialogOpen(false)

      if (mention.type === "landmark") {
        const selected = referenceIndexes.landmarksById.get(mention.id)
        if (selected) setSelectedLandmarkDetail(selected)
        return
      }

      if (mention.type === "building") {
        const selected = referenceIndexes.buildingsById.get(mention.id)
        if (selected) {
          setSelectedBuildingDetailId(selected.id)
          setIsBuildingDialogOpen(true)
        }
        return
      }

      if (mention.type === "estado") {
        setSelectedEstadoDetailId(mention.id)
        return
      }

      if (mention.type === "character") {
        const selected = referenceIndexes.charactersById.get(mention.id)
        if (!selected) return

        setSelectedCharacterDetail({
          character: selected,
          landmarkName: referenceIndexes.landmarkNameById.get(selected.landmarkId) ?? "Desconocido",
          buildingNames: selected.buildingIds.map(
            (buildingId) => referenceIndexes.buildingNameById.get(buildingId) ?? "Desconocido"
          ),
          organizationNames: selected.organizationIds.map(
            (organizationId) => referenceIndexes.organizationNameById.get(organizationId) ?? "Desconocido"
          ),
        })
        setIsCharacterDialogOpen(true)
        return
      }

      if (mention.type === "organization") {
        const selected = referenceIndexes.organizationsById.get(mention.id)
        if (selected) {
          setSelectedOrganizationDetail(selected)
          setIsOrganizationDialogOpen(true)
        }
      }
    },
    [allLandmarks, landmark, storedBuildings, storedCharacters, storedOrganizations],
  )

  const resolveLandmarkName = useCallback(
    (landmarkId: number) => detailLandmarkNameById.get(landmarkId) ?? "Desconocido",
    [detailLandmarkNameById],
  )

  const resolveBuildingName = useCallback(
    (buildingId: number) => detailBuildingNameById.get(buildingId) ?? "Desconocido",
    [detailBuildingNameById],
  )

  const resolveOrganizationName = useCallback(
    (organizationId: number) => detailOrganizationNameById.get(organizationId) ?? "Desconocido",
    [detailOrganizationNameById],
  )
  const scopedData = useMemo(
    () =>
      landmark
        ? buildScopedLandmarkData(allLandmarks, landmark, storedBuildings, storedCharacters, storedOrganizations)
        : null,
    [allLandmarks, landmark, storedBuildings, storedCharacters, storedOrganizations],
  )

  const loadLandmarkBattleHistory = useCallback(
    async (landmarkSlug: string) => {
      const requestId = ++battleHistoryRequestRef.current
      setIsBattleHistoryLoading(true)
      setBattleHistoryError(null)

      try {
        const history = await fetchBattleHistory(landmarkSlug)
        if (requestId !== battleHistoryRequestRef.current) {
          return
        }

        setLandmarkBattleHistory(history)
      } catch (error) {
        if (requestId !== battleHistoryRequestRef.current) {
          return
        }

        setLandmarkBattleHistory([])
        setBattleHistoryError(getBackendErrorMessage(error, "No se pudo cargar el historial de batallas."))
      } finally {
        if (requestId === battleHistoryRequestRef.current) {
          setIsBattleHistoryLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!canManageLandmarkBattles) {
      battleHistoryRequestRef.current += 1
      setLandmarkBattleHistory([])
      setBattleHistoryError(null)
      setIsBattleHistoryLoading(false)
      return
    }

    void loadLandmarkBattleHistory(slug)
  }, [canManageLandmarkBattles, loadLandmarkBattleHistory, slug])

  const activeLandmarkBattle = useMemo(
    () => landmarkBattleHistory.find((battle) => battle.status === "active") ?? null,
    [landmarkBattleHistory],
  )

  const handleCreateLandmarkBattle = useCallback(async () => {
    if (!canManageLandmarkBattles || !landmark || isCreatingBattle || isBattleHistoryLoading || activeLandmarkBattle) {
      return
    }

    setBattleHistoryError(null)
    setIsCreatingBattle(true)

    try {
      const landmarkSlug = landmarkNameToSlug(landmark.nombre)
      await createBattle(landmarkSlug)
      await loadLandmarkBattleHistory(landmarkSlug)
    } catch (error) {
      setBattleHistoryError(getBackendErrorMessage(error, "No se pudo crear la batalla para este landmark."))
    } finally {
      setIsCreatingBattle(false)
    }
  }, [activeLandmarkBattle, canManageLandmarkBattles, isBattleHistoryLoading, isCreatingBattle, landmark, loadLandmarkBattleHistory])

  const filteredScopedCharacters = useMemo(() => {
    if (!scopedData) return []

    return scopedData.characters.filter((character) =>
      matchesSearchQuery(
        charactersSearchQuery,
        character.nombre,
        character.raza,
        character.clase,
        character.descripcion,
        character.tags,
        scopedData.landmarkNameById.get(character.landmarkId) ?? landmark?.nombre ?? "",
        character.buildingIds.map((buildingId) => scopedData.buildingNameById.get(buildingId) ?? ""),
        character.organizationIds.map(
          (organizationId) => scopedData.organizationNameById.get(organizationId) ?? "",
        ),
      ),
    )
  }, [charactersSearchQuery, landmark?.nombre, scopedData])
  const filteredScopedBuildings = useMemo(() => {
    if (!scopedData) return []

    return scopedData.buildings.filter((building) =>
      matchesSearchQuery(
        buildingsSearchQuery,
        building.nombre,
        building.descripcion,
        building.tags,
        building.duenoNombre,
        typeof building.landmarkId === "number"
          ? (scopedData.landmarkNameById.get(building.landmarkId) ?? landmark?.nombre ?? "")
          : "Sin ubicacion",
        building.organizationId ? scopedData.organizationNameById.get(building.organizationId) ?? "" : "",
      ),
    )
  }, [buildingsSearchQuery, landmark?.nombre, scopedData])
  const filteredScopedOrganizations = useMemo(() => {
    if (!scopedData) return []

    return scopedData.organizations.filter((organization) =>
      matchesSearchQuery(
        organizationsSearchQuery,
        organization.nombre,
        organization.descripcion,
        organization.tags,
        organization.categorias,
        organization.landmarks.map((landmarkId) => scopedData.landmarkNameById.get(landmarkId) ?? ""),
        organization.edificios.map((buildingId) => scopedData.buildingNameById.get(buildingId) ?? ""),
        organization.miembros.flatMap((member) => [
          member.nombre,
          member.raza,
          member.profesion,
          member.categoria,
        ]),
      ),
    )
  }, [organizationsSearchQuery, scopedData])

  const activeMapLinkBuilding = useMemo(() => {
    if (activeMapLinkBuildingId === null || !scopedData) return null
    return scopedData.buildings.find((building) => building.id === activeMapLinkBuildingId) ?? null
  }, [activeMapLinkBuildingId, scopedData])

  const activeMapLinkOrganization = useMemo(() => {
    if (activeMapLinkOrganizationId === null || !scopedData) return null
    return scopedData.organizations.find((organization) => organization.id === activeMapLinkOrganizationId) ?? null
  }, [activeMapLinkOrganizationId, scopedData])

  const buildingLinksByMapIndex = useMemo<Record<number, number>>(() => {
    if (!scopedData) return {}
    const links: Record<number, number> = {}
    for (const building of scopedData.buildings) {
      if (typeof building.mapBuildingIndex === "number" && Number.isFinite(building.mapBuildingIndex)) {
        links[building.mapBuildingIndex] = building.id
      }
    }
    return links
  }, [scopedData])

  const buildingNamesById = useMemo<Record<number, string>>(() => {
    if (!scopedData) return {}
    return Object.fromEntries(scopedData.buildings.map((building) => [building.id, building.nombre]))
  }, [scopedData])

  const organizationLinkCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const [key, indices] of Object.entries(organizationMapLinks)) {
      const id = Number(key)
      if (!Number.isFinite(id)) continue
      counts.set(id, indices?.length ?? 0)
    }
    return counts
  }, [organizationMapLinks])

  const highlightMapBuilding = useCallback((mapBuildingIndex: number) => {
    setFocusedMapBuildingIndex(mapBuildingIndex)
    setFocusedMapOrganizationIndices(null)
    setFocusedMapRequestId((current) => current + 1)
  }, [])

  const handleToggleFocusedBuilding = useCallback((mapBuildingIndex?: number) => {
    if (typeof mapBuildingIndex !== "number" || !Number.isFinite(mapBuildingIndex)) {
      return
    }

    setActiveTab("edificios")
    setFocusedMapOrganizationIndices(null)
    setFocusedMapBuildingIndex((current) => {
      if (current === mapBuildingIndex) {
        return null
      }
      setFocusedMapRequestId((requestId) => requestId + 1)
      return mapBuildingIndex
    })
  }, [])

  const getWritableBuildings = useCallback(() => {
    return storedBuildings
  }, [storedBuildings])

  const handleToggleMapLinkMode = useCallback(() => {
    setActiveMapLinkBuildingId((current) => {
      if (current !== null) return null
      return filteredScopedBuildings[0]?.id ?? null
    })
    setActiveMapLinkOrganizationId(null)
  }, [filteredScopedBuildings])

  const handleToggleOrganizationMapLinkMode = useCallback(() => {
    setActiveMapLinkOrganizationId((current) => {
      if (current !== null) return null
      return filteredScopedOrganizations[0]?.id ?? null
    })
    setActiveMapLinkBuildingId(null)
  }, [filteredScopedOrganizations])

  const handleAssignMapOrganizationLink = useCallback(
    (mapBuildingIndex: number) => {
      if (activeMapLinkOrganizationId === null || !landmark) return

      const current = organizationMapLinks[activeMapLinkOrganizationId] ?? []
      const hasIndex = current.includes(mapBuildingIndex)
      const next = hasIndex
        ? current.filter((index) => index !== mapBuildingIndex)
        : [...current, mapBuildingIndex]

      const nextLinks = {
        ...organizationMapLinks,
        [activeMapLinkOrganizationId]: next,
      }

      setOrganizationMapLinks(nextLinks)
      setFocusedMapOrganizationIndices(next.length > 0 ? next : null)
      setFocusedMapBuildingIndex(null)
      setFocusedMapRequestId((current) => current + 1)

      void (async () => {
        try {
          await persistLandmark({
            ...landmark,
            organizationMapLinks: nextLinks,
          })
        } catch (error) {
          setBuildingsMapError(
            getBackendErrorMessage(error, "No se pudo guardar la asociacion de organizaciones en backend."),
          )
        }
      })()
    },
    [activeMapLinkOrganizationId, landmark, organizationMapLinks, persistLandmark],
  )

  const handleFocusOrganizationMapLinks = useCallback((organizationId: number) => {
    const indices = organizationMapLinks[organizationId] ?? []
    const sortedIndices = [...indices].sort((a, b) => a - b)
    const current = focusedMapOrganizationIndices
      ? [...focusedMapOrganizationIndices].sort((a, b) => a - b)
      : null
    const isSameSelection =
      current !== null &&
      current.length === sortedIndices.length &&
      current.every((value, index) => value === sortedIndices[index])

    setActiveTab("organizaciones")
    setFocusedMapOrganizationIndices(isSameSelection ? null : sortedIndices)
    setFocusedMapBuildingIndex(null)
    setFocusedMapRequestId((currentRequest) => currentRequest + 1)
  }, [focusedMapOrganizationIndices, organizationMapLinks])

  const handleAssignMapBuildingLink = useCallback(
    (mapBuildingIndex: number) => {
      void (async () => {
        if (!landmark) return
        if (activeMapLinkBuildingId === null) return

        const writableBuildings = getWritableBuildings()
        if (writableBuildings.length === 0) return

        let hasChanges = false
        const nextBuildings = writableBuildings.map((building) => {
          if (building.id === activeMapLinkBuildingId) {
            if (building.mapBuildingIndex === mapBuildingIndex) {
              return building
            }
            hasChanges = true
            return {
              ...building,
              mapBuildingIndex,
            }
          }

          if (
            building.landmarkId === landmark.id &&
            building.mapBuildingIndex === mapBuildingIndex
          ) {
            hasChanges = true
            return {
              ...building,
              mapBuildingIndex: undefined,
            }
          }

          return building
        })

        if (!hasChanges) {
          setActiveMapLinkBuildingId(null)
          return
        }

        const changedBuildings = nextBuildings.filter((building, index) => {
          const previous = writableBuildings[index]
          return previous.mapBuildingIndex !== building.mapBuildingIndex
        })

        try {
          const persistedBuildings = await Promise.all(
            changedBuildings.map((building) =>
              updateBuilding(building.id, {
                landmarkId: building.landmarkId,
                nombre: building.nombre,
                posicion: building.posicion,
                descripcion: building.descripcion,
                tags: building.tags,
                duenoId: building.duenoId,
                duenoNombre: building.duenoNombre,
                mapBuildingIndex: building.mapBuildingIndex,
                organizationId: building.organizationId,
              }),
            ),
          )

          const updatedById = new Map(persistedBuildings.map((building) => [building.id, building]))
          setStoredBuildings((prev) =>
            prev.map((building) => updatedById.get(building.id) ?? building),
          )
          setLandmark((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              edificios: prev.edificios.map((building) => updatedById.get(building.id) ?? building),
            }
          })
          setSelectedBuildingDetailId((prev) => (prev !== null && !updatedById.has(prev) ? null : prev))
          highlightMapBuilding(mapBuildingIndex)
          setActiveMapLinkBuildingId(null)
          setBuildingsMapError(null)
        } catch (error) {
          setBuildingsMapError(
            getBackendErrorMessage(error, "No se pudo guardar la asociacion de edificios en backend."),
          )
        }
      })()
    },
    [activeMapLinkBuildingId, getWritableBuildings, highlightMapBuilding, landmark],
  )

  const handleClearMapBuildingLink = useCallback(
    (buildingId: number) => {
      void (async () => {
        const writableBuildings = getWritableBuildings()
        if (writableBuildings.length === 0) return
        const targetBuilding = writableBuildings.find((building) => building.id === buildingId)
        const currentMapBuildingIndex = targetBuilding?.mapBuildingIndex
        if (!targetBuilding || typeof currentMapBuildingIndex !== "number") return

        try {
          const updatedBuilding = await updateBuilding(buildingId, {
            landmarkId: targetBuilding.landmarkId,
            nombre: targetBuilding.nombre,
            posicion: targetBuilding.posicion,
            descripcion: targetBuilding.descripcion,
            tags: targetBuilding.tags,
            duenoId: targetBuilding.duenoId,
            duenoNombre: targetBuilding.duenoNombre,
            mapBuildingIndex: undefined,
            organizationId: targetBuilding.organizationId,
          })

          const updatedById = new Map([[updatedBuilding.id, updatedBuilding]])
          setStoredBuildings((prev) =>
            prev.map((building) => updatedById.get(building.id) ?? building),
          )
          setLandmark((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              edificios: prev.edificios.map((building) => updatedById.get(building.id) ?? building),
            }
          })
          setSelectedBuildingDetailId((prev) => (prev !== null && !updatedById.has(prev) ? null : prev))
          setActiveMapLinkBuildingId((current) => (current === buildingId ? null : current))
          if (focusedMapBuildingIndex === currentMapBuildingIndex) {
            setFocusedMapBuildingIndex(null)
          }
          setBuildingsMapError(null)
        } catch (error) {
          setBuildingsMapError(
            getBackendErrorMessage(error, "No se pudo desasociar el edificio del mapa en backend."),
          )
        }
      })()
    },
    [focusedMapBuildingIndex, getWritableBuildings],
  )

  const handleOpenBuildingFromMap = useCallback(
    (buildingId: number) => {
      if (activeMapLinkBuildingId !== null) return
      const selectedExists =
        Boolean(scopedData?.buildings.some((building) => building.id === buildingId)) ||
        Boolean(storedBuildings.some((building) => building.id === buildingId))

      if (!selectedExists) return
      setActiveTab("edificios")
      setSelectedBuildingDetailId(buildingId)
      setIsBuildingDialogOpen(true)
    },
    [activeMapLinkBuildingId, scopedData, storedBuildings],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setFocusedMapBuildingIndex(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!landmark && !hasResolvedLoad) {
    return (
      <div className="mx-auto px-6 py-8 text-sm text-muted-foreground">
        Cargando landmark...
      </div>
    )
  }

  if (!landmark) {
    return (
      <div className="mx-auto px-6 py-8">
        <div className="parchment rounded-sm p-5">
          <h1 className="font-serif text-xl text-primary">Landmark no encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El landmark no existe en los datos actuales del backend.
          </p>
          <div className="mt-4">
            <Link
              href="/entidades?section=landmarks"
              className="inline-flex rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/70"
            >
              Volver a landmarks
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const iconIsImage = isImageIcon(landmark.icono)

  return (
    <section className={styles.root}>
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,application/json,.json"
        onChange={handleFileChange}
      />

      <div className={styles.mapPane}>
        {canUseBattleGrid && (
          <>
            <button
              type="button"
              className={styles.mapGridToggleButton}
              onClick={() => setIsGridPanelOpen((current) => !current)}
            >
              {isGridPanelOpen ? "Ocultar grilla" : "Configurar grilla"}
            </button>
            {isGridPanelOpen && (
              <div className={styles.mapGridPanel}>
                <div className={styles.mapGridPanelTitle}>Grilla de combate</div>
                <div className={styles.mapGridHint}>
                  La grilla se dibuja sobre la imagen y respeta el zoom, pan y rotacion del mapa.
                </div>
                <div className={styles.mapGridActions}>
                  <button
                    type="button"
                    className={styles.mapGridActionButton}
                    onClick={() =>
                      setMapGridDraft((current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }))
                    }
                  >
                    {mapGridDraft.enabled ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className={styles.mapGridActionButton}
                    onClick={handleResetMapGrid}
                  >
                    Revertir
                  </button>
                  <button
                    type="button"
                    className={styles.mapGridPrimaryButton}
                    onClick={handleSaveMapGrid}
                    disabled={!hasMapGridChanges || !isMapGridDraftValid || isSavingMapGrid}
                  >
                    {isSavingMapGrid ? "Guardando..." : "Guardar"}
                  </button>
                </div>
                {mapGridError && <div className={styles.mapGridErrorText}>{mapGridError}</div>}
                {!isMapGridDraftValid && (
                  <div className={styles.mapGridHint}>Usa numeros. Se acepta coma o punto decimal.</div>
                )}
                <div className={styles.mapGridField}>
                  <label className={styles.mapGridLabel} htmlFor="map-grid-cell-size">
                    Tamano de cuadrado
                  </label>
                  <div className={styles.mapGridRangeRow}>
                    <input
                      id="map-grid-cell-size"
                      type="range"
                      min={8}
                      max={256}
                      step={0.1}
                      value={normalizedDraftMapGridCellSize}
                      className={styles.mapGridRangeInput}
                      onChange={(event) => {
                        setMapGridDraft((current) => ({
                          ...current,
                          cellSize: formatMapGridNumber(Number(event.target.value)),
                        }))
                      }}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={mapGridDraft.cellSize}
                      className={styles.mapGridNumberInput}
                      onChange={(event) => {
                        setMapGridDraft((current) => ({
                          ...current,
                          cellSize: event.target.value,
                        }))
                      }}
                    />
                  </div>
                </div>
                <div className={styles.mapGridOffsetsRow}>
                  <div className={styles.mapGridField}>
                    <label className={styles.mapGridLabel} htmlFor="map-grid-offset-x">
                      Offset X
                    </label>
                    <input
                      id="map-grid-offset-x"
                      type="text"
                      inputMode="decimal"
                      value={mapGridDraft.offsetX}
                      className={styles.mapGridNumberInput}
                      onChange={(event) => {
                        setMapGridDraft((current) => ({
                          ...current,
                          offsetX: event.target.value,
                        }))
                      }}
                    />
                  </div>
                  <div className={styles.mapGridField}>
                    <label className={styles.mapGridLabel} htmlFor="map-grid-offset-y">
                      Offset Y
                    </label>
                    <input
                      id="map-grid-offset-y"
                      type="text"
                      inputMode="decimal"
                      value={mapGridDraft.offsetY}
                      className={styles.mapGridNumberInput}
                      onChange={(event) => {
                        setMapGridDraft((current) => ({
                          ...current,
                          offsetY: event.target.value,
                        }))
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {landmark && effectiveMapUrl && shouldUseImageMap && (
          <button
            type="button"
            className={styles.mapRotateButton}
            onClick={handleRotateMap}
            disabled={isRotatingMap}
          >
            <RotateCw className={styles.mapRotateIcon} />
            {isRotatingMap ? "Rotando..." : `Rotar 90° (${mapRotationDegrees}°)`}
          </button>
        )}

        {shouldUseBuildingsMap && effectiveMapUrl ? (
          <div className={styles.mapViewport}>
          <BuildingsMap
            dataUrl={effectiveMapUrl}
            onLoadError={setBuildingsMapError}
            buildingLinks={buildingLinksByMapIndex}
            buildingNames={buildingNamesById}
            activeLinkBuildingId={activeMapLinkBuildingId}
            activeLinkOrganizationId={activeMapLinkOrganizationId}
            onAssignBuildingLink={handleAssignMapBuildingLink}
            onAssignOrganizationLink={handleAssignMapOrganizationLink}
            onOpenBuilding={handleOpenBuildingFromMap}
            focusBuildingIndex={focusedMapBuildingIndex}
            focusBuildingIndices={focusedMapOrganizationIndices}
            highlightBuildingIndices={
              activeMapLinkOrganizationId !== null
                ? organizationMapLinks[activeMapLinkOrganizationId] ?? []
                : null
            }
            hiddenBuildingIndices={landmark.hiddenMapBuildings ?? []}
            onHiddenBuildingsChange={(hidden) => {
              if (!landmark) return
              setLandmark((prev) => (prev ? { ...prev, hiddenMapBuildings: hidden } : prev))
              void (async () => {
                try {
                  await persistLandmark({
                    ...landmark,
                    hiddenMapBuildings: hidden,
                  })
                } catch (error) {
                  setBuildingsMapError(
                    getBackendErrorMessage(error, "No se pudo guardar el estado de edificios ocultos."),
                  )
                }
              })()
            }}
            focusRequestId={focusedMapRequestId}
          />
            {buildingsMapError && (
              <div className={styles.mapErrorPrompt}>
                <div className={styles.mapErrorTitle}>No se pudo cargar el mapa</div>
                <div className={styles.mapErrorText}>{buildingsMapError}</div>
                <div className={styles.mapErrorActions}>
                  <button
                    type="button"
                    className={styles.noMapPreloadedButton}
                    onClick={() => inputRef.current?.click()}
                  >
                    Cargar de nuevo
                  </button>
                  <button
                    type="button"
                    className={styles.mapErrorDangerButton}
                    onClick={handleClearBrokenMap}
                  >
                    Borrar mapa actual
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : shouldUseDungeonMapPlaceholder && effectiveMapUrl ? (
          <div className={styles.mapViewport}>
            <DungeonMap
              dataUrl={effectiveMapUrl}
              onLoadError={setBuildingsMapError}
              onDocumentChange={handlePersistEditedDungeonDocument}
              displayStyle={dungeonEditorConfig.displayStyle}
            />
            {buildingsMapError ? (
              <div className={styles.mapErrorPrompt}>
                <div className={styles.mapErrorTitle}>No se pudo cargar la mazmorra</div>
                <div className={styles.mapErrorText}>{buildingsMapError}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            ref={viewportRef}
            className={isDragging ? `${styles.mapViewport} ${styles.mapViewportDragging}` : styles.mapViewport}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onDragStart={(event) => event.preventDefault()}
          >
            {effectiveMapUrl && (
              <div
                className={styles.mapCanvas}
                style={{
                  transform: `matrix(${scale}, 0, 0, ${scale}, ${offset.x}, ${offset.y})`,
                }}
              >
                <div className={styles.mapImageFrame}>
                  <div
                    className={styles.mapImageBounds}
                    style={{
                      width: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsWidth}px` : undefined,
                      height: rotatedMapRenderSize ? `${rotatedMapRenderSize.boundsHeight}px` : undefined,
                    }}
                  >
                    <div
                      className={styles.mapImageLayer}
                      style={
                        rotatedMapRenderSize
                          ? {
                            width: `${rotatedMapRenderSize.imageWidth}px`,
                            height: `${rotatedMapRenderSize.imageHeight}px`,
                            transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
                          }
                          : {
                            transform: `translate(-50%, -50%) rotate(${mapRotationDegrees}deg)`,
                          }
                      }
                    >
                      <img
                        src={effectiveMapUrl}
                        alt={`Mapa de ${landmark.nombre}`}
                        className={styles.mapImageAsset}
                        draggable={false}
                        style={
                          rotatedMapRenderSize
                            ? {
                              width: "100%",
                              height: "100%",
                            }
                            : undefined
                        }
                        onLoad={(event) => {
                          const { naturalWidth, naturalHeight } = event.currentTarget
                          if (naturalWidth <= 0 || naturalHeight <= 0) {
                            setMapImageNaturalSize(null)
                            return
                          }

                          setMapImageNaturalSize({
                            width: naturalWidth,
                            height: naturalHeight,
                          })
                        }}
                        onError={() => {
                          setMapImageNaturalSize(null)
                        }}
                      />
                      <div className={styles.mapImageOverlay} />
                      {mapGridOverlayStyle && (
                        <div className={styles.mapGridOverlay} style={mapGridOverlayStyle} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!effectiveMapUrl && (
              <div className={styles.noMapPrompt}>
                <button
                  type="button"
                  className={styles.noMapMainButton}
                  onClick={() => inputRef.current?.click()}
                >
                  <span className={styles.noMapTitle}>Este landmark no tiene mapa</span>
                  <span className={styles.noMapText}>
                    {isDungeonLandmark
                      ? 'Click para cargar una imagen o un JSON con type="mazmorra"'
                      : "Click para cargar una imagen o un JSON"}
                  </span>
                </button>
                <div className={styles.noMapPreloadedRow}>
                  <input
                    type="text"
                    value={preloadedMapValue}
                    onChange={(event) => setPreloadedMapValue(event.target.value)}
                    disabled={isDungeonLandmark}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.preventDefault()
                      handleApplyPreloadedMap()
                    }}
                    className={styles.noMapPreloadedInput}
                    placeholder={
                      isDungeonLandmark ? "No disponible para mazmorras" : "/maps/city/daggerfire.json"
                    }
                  />
                  <button
                    type="button"
                    className={styles.noMapPreloadedButton}
                    disabled={isDungeonLandmark}
                    onClick={handleApplyPreloadedMap}
                  >
                    Cargar precargado
                  </button>
                </div>
                {isDungeonLandmark && (
                  <div className={styles.noMapText}>{DUNGEON_PRELOADED_MAP_ERROR_MESSAGE}</div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      <aside className={styles.infoPanel}>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
              {iconIsImage ? (
                <img src={landmark.icono} alt={landmark.nombre} className="size-7 object-contain" />
              ) : (
                <span className="text-lg">{fallbackIconForType(landmark.tipo)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="min-w-0 flex-1 truncate font-serif text-xl text-primary">{landmark.nombre}</h1>
                {effectiveMapUrl && (
                  <button
                    type="button"
                    onClick={handleShowMapOnPresentationScreen}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-primary/25 text-primary transition-colors hover:bg-primary/10"
                    title="Mostrar en pantalla"
                    aria-label="Mostrar en pantalla"
                  >
                    <Expand className="size-4" />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                  {LANDMARK_TYPE_LABELS[landmark.tipo] ?? landmark.tipo}
                </Badge>
                <Link
                  href="/entidades?section=landmarks"
                  className="text-[10px] font-medium text-muted-foreground hover:text-primary"
                >
                  Ver todos
                </Link>
              </div>
            </div>
          </div>
          {landmark.poblacion && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>{landmark.poblacion.toLocaleString()} habitantes</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
          <TabsList className={`grid h-auto w-full rounded-none border-b border-border bg-transparent p-0 ${isDungeonLandmark ? "grid-cols-6" : "grid-cols-5"}`}>
            <TabsTrigger
              value="general"
              className="h-9 rounded-none border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary"
            >
              <BookOpenText className="size-3.5" />
              <span className="sr-only">General</span>
            </TabsTrigger>
            <TabsTrigger
              value="personajes"
              className="h-9 rounded-none border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary"
            >
              <Users className="size-3.5" />
              <span className="sr-only">Personajes</span>
            </TabsTrigger>
            <TabsTrigger
              value="edificios"
              className="h-9 rounded-none border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary"
            >
              <Building2 className="size-3.5" />
              <span className="sr-only">Edificios</span>
            </TabsTrigger>
            <TabsTrigger
              value="organizaciones"
              className="h-9 rounded-none border-r border-border data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary"
            >
              <Shield className="size-3.5" />
              <span className="sr-only">Organizaciones</span>
            </TabsTrigger>
            <TabsTrigger
              value="eventos"
              className={`h-9 rounded-none ${isDungeonLandmark ? "border-r border-border" : ""} data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary`}
            >
              <CalendarDays className="size-3.5" />
              <span className="sr-only">Eventos</span>
            </TabsTrigger>
            {isDungeonLandmark ? (
              <TabsTrigger
                value="mazmorra"
                className="h-9 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:bg-secondary"
              >
                <MapIcon className="size-3.5" />
                <span className="sr-only">Mazmorra</span>
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="general" className="m-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button size="sm" variant="outline" className="text-xs" onClick={handleStartEdit}>
                      <Pencil className="mr-1.5 size-3" />
                      Editar
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" className="text-xs" onClick={handleSaveEdit}>
                        <Save className="mr-1.5 size-3" />
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={handleCancelEdit}
                      >
                        <X className="mr-1.5 size-3" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>

                {editError && <p className="text-xs text-destructive">{editError}</p>}

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-primary">Resumen</h3>
                  {isEditing ? (
                    <MentionField
                      source="auto"
                      value={editedData.descripcionCorta}
                      onChange={(value) => setEditedData((prev) => ({ ...prev, descripcionCorta: value }))}
                      className="min-h-[72px] text-xs md:text-xs"
                      placeholder="Descripcion corta del landmark..."
                      rows={3}
                    />
                  ) : (
                    <MentionField
                      source="auto"
                      value={landmark.descripcionCorta ?? ""}
                      editable={false}
                      className="text-xs leading-relaxed text-foreground/85"
                      emptyText="Sin descripcion"
                      onOpenMention={handleOpenMention}
                    />
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-primary">Historia</h3>
                  {isEditing ? (
                    <MentionField
                      source="auto"
                      value={editedData.historia}
                      onChange={(value) => setEditedData((prev) => ({ ...prev, historia: value }))}
                      className="min-h-[96px] text-xs md:text-xs"
                      placeholder="Historia del landmark..."
                      rows={4}
                    />
                  ) : (
                    <MentionField
                      source="auto"
                      value={landmark.historia ?? ""}
                      editable={false}
                      className="text-xs italic leading-relaxed text-foreground/80"
                      emptyText="Sin historia"
                      onOpenMention={handleOpenMention}
                    />
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold text-primary">Etiquetas</h3>
                  {landmark.tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin etiquetas</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {landmark.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <CountCard
                    label="Edificios"
                    value={scopedData?.buildings.length ?? 0}
                    icon={<Building2 className="size-4" />}
                  />
                  <CountCard
                    label="Personajes"
                    value={scopedData?.characters.length ?? 0}
                    icon={<Users className="size-4" />}
                  />
                  <CountCard
                    label="Organizaciones"
                    value={scopedData?.organizations.length ?? 0}
                    icon={<Shield className="size-4" />}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className={styles.mapErrorDangerButton}
                    onClick={handleClearBrokenMap}
                  >
                    Borrar mapa actual
                  </button>
                </div>

                {canManageLandmarkBattles ? (
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold text-primary">Historial de batallas</h3>
                        <p className="text-[10px] text-muted-foreground">
                          Disponible porque este landmark tiene mapa de imagen y grilla activa.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => void handleCreateLandmarkBattle()}
                        disabled={isCreatingBattle || isBattleHistoryLoading || Boolean(activeLandmarkBattle)}
                      >
                        <Plus className="mr-1 size-3" />
                        {isCreatingBattle ? "Creando..." : "Nueva batalla"}
                      </Button>
                    </div>

                    {activeLandmarkBattle ? (
                      <p className="text-[10px] font-medium text-amber-700">
                        Ya hay una batalla activa para este landmark.
                      </p>
                    ) : null}

                    {battleHistoryError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                        {battleHistoryError}
                      </p>
                    ) : null}

                    {isBattleHistoryLoading ? (
                      <p className="text-xs text-muted-foreground">Cargando historial...</p>
                    ) : landmarkBattleHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Todavía no hay batallas para este landmark.</p>
                    ) : (
                      <div className="space-y-2">
                        {landmarkBattleHistory.map((battle) => (
                          <div
                            key={battle.id}
                            className={`rounded-xl border px-3 py-2 ${
                              battle.status === "active"
                                ? "border-amber-300 bg-amber-50"
                                : "border-border/70 bg-background/80"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-foreground">
                                #{battle.id} · {battle.status === "active" ? "Activa" : "Terminada"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatBattleSummaryTimestamp(battle)}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {battle.tokenCount} fichas / {battle.obstacleCount} obstáculos
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    landmark: slug,
                                    battleId: String(battle.id),
                                  })
                                  router.push(`/batalla?${params.toString()}`)
                                }}
                              >
                                Abrir en /batalla
                              </Button>
                              {battle.status === "finished" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-[10px]"
                                  onClick={() => {
                                    const params = new URLSearchParams({
                                      landmark: slug,
                                      reopenBattleId: String(battle.id),
                                    })
                                    router.push(`/batalla?${params.toString()}`)
                                  }}
                                >
                                  Reabrir en /batalla
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="personajes" className="m-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => {
                    setSelectedCharacterDetail(null)
                    setIsCharacterDialogOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 size-3" />
                  Crear Personaje
                </Button>
                <SearchInput
                  value={charactersSearchQuery}
                  onChange={setCharactersSearchQuery}
                  placeholder="Buscar por nombre, raza, clase, descripcion, tags o ubicacion..."
                />
                <p className="text-[10px] text-muted-foreground">
                  {filteredScopedCharacters.length} de {scopedData?.characters.length ?? 0} personajes
                </p>

                {filteredScopedCharacters.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin personajes que coincidan</p>
                  </div>
                ) : (
                  filteredScopedCharacters.map((personaje) => (
                    <CharacterResumeDialog
                      key={personaje.id}
                      characterId={personaje.id}
                      className="w-full border-border/70 bg-card/70 p-3 shadow-none"
                      onClick={() => {
                        setSelectedCharacterDetail({
                          character: personaje,
                          landmarkName: scopedData?.landmarkNameById.get(personaje.landmarkId) ?? "Desconocido",
                          buildingNames: personaje.buildingIds.map(
                            (buildingId) => scopedData?.buildingNameById.get(buildingId) ?? "Desconocido",
                          ),
                          organizationNames: personaje.organizationIds.map(
                            (organizationId) =>
                              scopedData?.organizationNameById.get(organizationId) ?? "Desconocido",
                          ),
                        })
                        setIsCharacterDialogOpen(true)
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="edificios" className="m-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs"
                    onClick={() => {
                      setSelectedBuildingDetailId(null)
                      setIsBuildingDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-1.5 size-3" />
                    Crear Edificio
                  </Button>
                  {shouldUseBuildingsMap && (
                    <Button
                      size="sm"
                      variant={activeMapLinkBuildingId !== null ? "default" : "outline"}
                      className="h-8 flex-1 text-xs"
                      disabled={filteredScopedBuildings.length === 0}
                      onClick={handleToggleMapLinkMode}
                    >
                      <Link2 className="mr-1.5 size-3" />
                      {activeMapLinkBuildingId !== null ? "Cancelar asociacion" : "Asociar en mapa"}
                    </Button>
                  )}
                </div>
                <SearchInput
                  value={buildingsSearchQuery}
                  onChange={setBuildingsSearchQuery}
                  placeholder="Buscar por nombre, descripcion, ubicacion, tags o dueno..."
                />
                <p className="text-[10px] text-muted-foreground">
                  {filteredScopedBuildings.length} de {scopedData?.buildings.length ?? 0} edificios
                </p>
                {shouldUseBuildingsMap && activeMapLinkBuilding && (
                  <div className="rounded-sm border border-primary/30 bg-primary/8 px-2 py-1.5 text-[11px] text-primary">
                    Haz click en otro edificio de la lista para cambiar la seleccion. Luego click en el mapa para asociar{" "}
                    <span className="font-semibold">{activeMapLinkBuilding.nombre}</span>.
                  </div>
                )}
                {shouldUseBuildingsMap && activeMapLinkBuildingId !== null && !activeMapLinkBuilding && (
                  <div className="rounded-sm border border-primary/30 bg-primary/8 px-2 py-1.5 text-[11px] text-primary">
                    Selecciona un edificio en el mapa para asociarlo con{" "}
                    el edificio seleccionado en la lista.
                  </div>
                )}

                {filteredScopedBuildings.length === 0 ? (
                  <div className="py-8 text-center">
                    <Building2 className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin edificios que coincidan</p>
                  </div>
                ) : (
                  filteredScopedBuildings.map((edificio) => {
                    const isLinkingThis = activeMapLinkBuildingId === edificio.id
                    const isFocusedThis =
                      typeof edificio.mapBuildingIndex === "number" &&
                      focusedMapBuildingIndex === edificio.mapBuildingIndex
                    const hasMapLink = typeof edificio.mapBuildingIndex === "number"
                    return (
                      <div
                        key={edificio.id}
                        className="relative space-y-1.5"
                        onContextMenu={(event) => {
                          if (!shouldUseBuildingsMap || !hasMapLink) return
                          event.preventDefault()
                          event.stopPropagation()
                          handleToggleFocusedBuilding(edificio.mapBuildingIndex)
                        }}
                      >
                        {shouldUseBuildingsMap && hasMapLink && (
                          <button
                            type="button"
                            className="absolute right-2 top-2 z-20 rounded-full border border-primary/35 bg-background/90 p-1 text-primary transition-colors hover:bg-secondary/80"
                            title="Click derecho para desasociar"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              handleClearMapBuildingLink(edificio.id)
                            }}
                          >
                            <Link2 className="size-3" />
                          </button>
                        )}
                        <BuildingResumeDialog
                          buildingId={edificio.id}
                          className={
                            isFocusedThis
                              ? "w-full border-primary bg-primary/12 p-3 shadow-none"
                              : isLinkingThis
                                ? "w-full border-primary/45 bg-primary/6 p-3 shadow-none"
                                : "w-full border-border/70 bg-card/70 p-3 shadow-none"
                          }
                          onClick={() => {
                            if (shouldUseBuildingsMap && activeMapLinkBuildingId !== null) {
                              if (
                                isLinkingThis &&
                                typeof edificio.mapBuildingIndex === "number"
                              ) {
                                highlightMapBuilding(edificio.mapBuildingIndex)
                                return
                              }
                              setActiveMapLinkBuildingId(edificio.id)
                              return
                            }
                            setSelectedBuildingDetailId(edificio.id)
                            setIsBuildingDialogOpen(true)
                          }}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="organizaciones" className="m-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs"
                    onClick={() => {
                      setSelectedOrganizationDetail(null)
                      setIsOrganizationDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-1.5 size-3" />
                    Crear Organizacion
                  </Button>
                  {shouldUseBuildingsMap && (
                    <Button
                      size="sm"
                      variant={activeMapLinkOrganizationId !== null ? "default" : "outline"}
                      className="h-8 flex-1 text-xs"
                      disabled={filteredScopedOrganizations.length === 0}
                      onClick={handleToggleOrganizationMapLinkMode}
                    >
                      <Link2 className="mr-1.5 size-3" />
                      {activeMapLinkOrganizationId !== null ? "Cancelar asociacion" : "Asociar en mapa"}
                    </Button>
                  )}
                </div>
                <SearchInput
                  value={organizationsSearchQuery}
                  onChange={setOrganizationsSearchQuery}
                  placeholder="Buscar por nombre, descripcion, categorias, tags, miembros, sedes o regiones..."
                />
                <p className="text-[10px] text-muted-foreground">
                  {filteredScopedOrganizations.length} de {scopedData?.organizations.length ?? 0} organizaciones
                </p>

                {shouldUseBuildingsMap && activeMapLinkOrganizationId !== null && (
                  <div className="rounded-sm border border-primary/30 bg-primary/8 px-2 py-1.5 text-[11px] text-primary">
                    Click en el mapa para asociar o quitar bloques a {activeMapLinkOrganization?.nombre ?? "la organizacion"}.
                  </div>
                )}

                {filteredScopedOrganizations.length === 0 ? (
                  <div className="py-8 text-center">
                    <Shield className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin organizaciones que coincidan</p>
                  </div>
                ) : (
                  filteredScopedOrganizations.map((organizacion) => {
                    const linkCount = organizationLinkCounts.get(organizacion.id) ?? 0
                    return (
                      <div
                        key={organizacion.id}
                        className="space-y-1.5"
                        onContextMenu={(event) => {
                          if (!shouldUseBuildingsMap) return
                          event.preventDefault()
                          event.stopPropagation()
                          handleFocusOrganizationMapLinks(organizacion.id)
                        }}
                      >
                        <OrganizationResumeDialog
                          organizationId={organizacion.id}
                          className="w-full border-border/70 bg-card/70 p-3 shadow-none"
                          onClick={() => {
                            if (activeMapLinkOrganizationId !== null) {
                              setActiveMapLinkOrganizationId(organizacion.id)
                              setFocusedMapOrganizationIndices(organizationMapLinks[organizacion.id] ?? null)
                              setFocusedMapBuildingIndex(null)
                              setFocusedMapRequestId((current) => current + 1)
                              return
                            }
                            setSelectedOrganizationDetail(organizacion)
                            setIsOrganizationDialogOpen(true)
                          }}
                        />
                        {shouldUseBuildingsMap && linkCount > 0 ? (
                          <p className="text-[10px] text-muted-foreground">
                            {linkCount} bloque{linkCount !== 1 ? "s" : ""} asociado{linkCount !== 1 ? "s" : ""}
                          </p>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="eventos" className="m-0 flex-1">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => {
                    setEditingEventIndex(null)
                    setEventSaveError(null)
                    setIsCreateEventDialogOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 size-3" />
                  Agregar evento
                </Button>

                {eventSaveError && <p className="text-xs text-destructive">{eventSaveError}</p>}

                {landmark.eventos.length === 0 ? (
                  <div className="py-8 text-center">
                    <CalendarDays className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin eventos registrados</p>
                  </div>
                ) : (
                  landmark.eventos.map((evento, index) => (
                    <Card key={`${evento.nombre}-${index}`} className="relative space-y-1 p-3 pl-4 pr-8">
                      <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-primary/50" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 size-6 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setEditingEventIndex(index)
                          setEventSaveError(null)
                          setIsCreateEventDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Editar evento</span>
                      </Button>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-3 text-primary/70" />
                        <span className="font-serif text-xs font-semibold text-primary">{evento.nombre}</span>
                      </div>
                      {evento.fecha && <div className="text-[10px] text-muted-foreground">{evento.fecha}</div>}
                      <p className="text-xs leading-relaxed text-foreground/80">{evento.descripcion}</p>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {isDungeonLandmark ? (
            <TabsContent value="mazmorra" className="m-0 flex-1 min-h-0 overflow-hidden">
              <ScrollArea className={styles.dungeonEditorScrollArea}>
                <div className={styles.dungeonEditorContent}>
                  <div className={styles.dungeonEditorPanel}>
                    <div className={styles.dungeonEditorSection}>
                      <div className={styles.dungeonEditorSectionTitle}>Mapa</div>
                      <div className={`${styles.dungeonEditorGrid} ${styles.dungeonEditorGridCompact}`}>
                        <label className={styles.dungeonEditorField}>
                          <span>Ancho</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.width}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("width")}
                            onBlur={handleDungeonEditorIntegerBlur("width", 48, 8, 512)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Alto</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.height}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("height")}
                            onBlur={handleDungeonEditorIntegerBlur("height", 32, 8, 512)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Seed</span>
                          <input
                            type="text"
                            value={dungeonEditorDraft.seed}
                            className={styles.dungeonEditorInput}
                            placeholder={autoDungeonSeed}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, seed: event.target.value }))}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Dispersion</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={dungeonEditorDraft.roomDispersion}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorDispersionChange}
                            onBlur={handleDungeonEditorDispersionBlur}
                            placeholder="0 a 1"
                          />
                        </label>

                        <label className={styles.dungeonEditorToggleField}>
                          <span>Intersecciones</span>
                          <Switch
                            checked={dungeonEditorDraft.allowIntersections}
                            onCheckedChange={(checked) => {
                              setDungeonEditorDraft((current) => ({ ...current, allowIntersections: checked }))
                            }}
                            aria-label={dungeonEditorDraft.allowIntersections ? "Desactivar intersecciones" : "Activar intersecciones"}
                          />
                        </label>

                        <label className={styles.dungeonEditorToggleField}>
                          <span>Generar antorchas</span>
                          <Switch
                            checked={dungeonEditorDraft.generateTorches}
                            onCheckedChange={(checked) => {
                              setDungeonEditorDraft((current) => ({ ...current, generateTorches: checked }))
                            }}
                            aria-label={dungeonEditorDraft.generateTorches ? "Desactivar antorchas generadas" : "Activar antorchas generadas"}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Densidad antorchas %</span>
                          <input
                            type="number"
                            min={0}
                            max={300}
                            value={dungeonEditorDraft.torchDensityPercent}
                            className={styles.dungeonEditorInput}
                            onChange={(event) => {
                              const value = sanitizeDungeonEditorIntegerInput(event.target.value)
                              setDungeonEditorDraft((current) => ({ ...current, torchDensityPercent: value }))
                            }}
                            onBlur={handleDungeonEditorIntegerBlur("torchDensityPercent", 100, 0, 300)}
                            placeholder="0 a 300"
                          />
                        </label>

                      </div>
                    </div>

                    <div className={styles.dungeonEditorSection}>
                      <div className={styles.dungeonEditorSectionTitle}>Salas</div>
                      <div className={`${styles.dungeonEditorGrid} ${styles.dungeonEditorGridCompact}`}>
                        <label className={styles.dungeonEditorField}>
                          <span>Cantidad</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.roomCount}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("roomCount")}
                            onBlur={handleDungeonEditorIntegerBlur("roomCount", 6, 0, 64)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Ancho min</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.minRoomWidth}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("minRoomWidth")}
                            onBlur={handleDungeonEditorIntegerBlur("minRoomWidth", 5, 3, dungeonEditorConfig.width)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Ancho max</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.maxRoomWidth}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("maxRoomWidth")}
                            onBlur={handleDungeonEditorIntegerBlur("maxRoomWidth", 10, 3, dungeonEditorConfig.width)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Alto min</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.minRoomHeight}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("minRoomHeight")}
                            onBlur={handleDungeonEditorIntegerBlur("minRoomHeight", 4, 3, dungeonEditorConfig.height)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Alto max</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.maxRoomHeight}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("maxRoomHeight")}
                            onBlur={handleDungeonEditorIntegerBlur("maxRoomHeight", 8, 3, dungeonEditorConfig.height)}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Padding</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dungeonEditorDraft.roomPadding}
                            className={styles.dungeonEditorInput}
                            onChange={handleDungeonEditorIntegerChange("roomPadding")}
                            onBlur={handleDungeonEditorIntegerBlur("roomPadding", 1, 0, 8)}
                          />
                        </label>
                      </div>
                    </div>

                    <div className={styles.dungeonEditorSection}>
                      <div className={styles.dungeonEditorSectionTitle}>Estilo</div>
                      <div className={styles.dungeonEditorGrid}>
                        <label className={styles.dungeonEditorField}>
                          <span>Habitaciones</span>
                          <input
                            type="color"
                            value={dungeonEditorDraft.roomColor}
                            className={styles.dungeonEditorColorInput}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, roomColor: event.target.value }))}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Pasillos</span>
                          <input
                            type="color"
                            value={dungeonEditorDraft.corridorColor}
                            className={styles.dungeonEditorColorInput}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, corridorColor: event.target.value }))}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Textura habitaciones</span>
                          <div
                            className={styles.dungeonEditorTexturePickerWrap}
                            onContextMenuCapture={handleRoomTexturePickerContextMenu}
                          >
                            <ImageEmbeddingPicker
                              value={activeRoomTextureUrl}
                              usage="generic"
                              label="Textura de habitaciones"
                              placeholder="/textures/stone-floor.png"
                              previewClassName={styles.dungeonEditorTexturePreview}
                              previewMode="contain"
                              showUrlControls={false}
                              compact
                              overlayTopRight={(
                                <input
                                  type="checkbox"
                                  className={styles.dungeonEditorTextureRotateToggle}
                                  checked={Boolean(dungeonEditorDraft.roomTextureRandomRotation)}
                                  onChange={(event) => {
                                    const checked = event.target.checked
                                    setDungeonEditorDraft((current) => ({ ...current, roomTextureRandomRotation: checked }))
                                  }}
                                  aria-label="Rotacion aleatoria de textura de habitaciones"
                                />
                              )}
                              onChange={(value) => setRoomTextureAtIndex(activeRoomTextureIndex, value)}
                            />
                            <div className={styles.dungeonEditorTextureNav}>
                              <button
                                type="button"
                                className={styles.dungeonEditorTextureNavButton}
                                onClick={() => {
                                  setActiveRoomTextureIndex((current) => Math.max(0, current - 1))
                                }}
                                disabled={activeRoomTextureIndex <= 0}
                                aria-label="Textura anterior de habitaciones"
                              >
                                &lt;
                              </button>
                              <button
                                type="button"
                                className={styles.dungeonEditorTextureNavButton}
                                onClick={() => {
                                  if (activeRoomTextureIndex >= dungeonEditorDraft.roomTextureUrls.length - 1) {
                                    handleAddRoomTextureSlot()
                                    return
                                  }
                                  setActiveRoomTextureIndex((current) => current + 1)
                                }}
                                aria-label={activeRoomTextureIndex >= dungeonEditorDraft.roomTextureUrls.length - 1
                                  ? "Agregar textura de habitaciones"
                                  : "Siguiente textura de habitaciones"}
                              >
                                {activeRoomTextureIndex >= dungeonEditorDraft.roomTextureUrls.length - 1 ? "+" : ">"}
                              </button>
                            </div>
                          </div>
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Textura pasillos</span>
                          <div
                            className={styles.dungeonEditorTexturePickerWrap}
                            onContextMenuCapture={handleCorridorTexturePickerContextMenu}
                          >
                            <ImageEmbeddingPicker
                              value={activeCorridorTextureUrl}
                              usage="generic"
                              label="Textura de pasillos"
                              placeholder="/textures/dirt-floor.png"
                              previewClassName={styles.dungeonEditorTexturePreview}
                              previewMode="contain"
                              showUrlControls={false}
                              compact
                              overlayTopRight={(
                                <input
                                  type="checkbox"
                                  className={styles.dungeonEditorTextureRotateToggle}
                                  checked={Boolean(dungeonEditorDraft.corridorTextureRandomRotation)}
                                  onChange={(event) => {
                                    const checked = event.target.checked
                                    setDungeonEditorDraft((current) => ({ ...current, corridorTextureRandomRotation: checked }))
                                  }}
                                  aria-label="Rotacion aleatoria de textura de pasillos"
                                />
                              )}
                              onChange={(value) => setCorridorTextureAtIndex(activeCorridorTextureIndex, value)}
                            />
                            <div className={styles.dungeonEditorTextureNav}>
                              <button
                                type="button"
                                className={styles.dungeonEditorTextureNavButton}
                                onClick={() => {
                                  setActiveCorridorTextureIndex((current) => Math.max(0, current - 1))
                                }}
                                disabled={activeCorridorTextureIndex <= 0}
                                aria-label="Textura anterior de pasillos"
                              >
                                &lt;
                              </button>
                              <button
                                type="button"
                                className={styles.dungeonEditorTextureNavButton}
                                onClick={() => {
                                  if (activeCorridorTextureIndex >= dungeonEditorDraft.corridorTextureUrls.length - 1) {
                                    handleAddCorridorTextureSlot()
                                    return
                                  }
                                  setActiveCorridorTextureIndex((current) => current + 1)
                                }}
                                aria-label={activeCorridorTextureIndex >= dungeonEditorDraft.corridorTextureUrls.length - 1
                                  ? "Agregar textura de pasillos"
                                  : "Siguiente textura de pasillos"}
                              >
                                {activeCorridorTextureIndex >= dungeonEditorDraft.corridorTextureUrls.length - 1 ? "+" : ">"}
                              </button>
                            </div>
                          </div>
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Puertas</span>
                          <input
                            type="color"
                            value={dungeonEditorDraft.doorColor}
                            className={styles.dungeonEditorColorInput}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, doorColor: event.target.value }))}
                          />
                        </label>

                        <label className={styles.dungeonEditorToggleField}>
                          <span>Paredes</span>
                          <Switch
                            checked={dungeonEditorDraft.showCorridorWalls}
                            onCheckedChange={(checked) => {
                              setDungeonEditorDraft((current) => ({ ...current, showCorridorWalls: checked }))
                            }}
                            aria-label={dungeonEditorDraft.showCorridorWalls ? "Desactivar paredes de pasillo" : "Activar paredes de pasillo"}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Ancho pared</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={dungeonEditorDraft.wallWidth}
                            className={styles.dungeonEditorInput}
                            disabled={!dungeonEditorDraft.showCorridorWalls}
                            onChange={handleDungeonEditorWallWidthChange}
                            onBlur={handleDungeonEditorWallWidthBlur}
                            placeholder="0.02 a 0.48"
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Pared pasillo</span>
                          <input
                            type="color"
                            value={dungeonEditorDraft.corridorWallColor}
                            className={styles.dungeonEditorColorInput}
                            disabled={!dungeonEditorDraft.showCorridorWalls}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, corridorWallColor: event.target.value }))}
                          />
                        </label>

                        <label className={styles.dungeonEditorField}>
                          <span>Pared habitacion</span>
                          <input
                            type="color"
                            value={dungeonEditorDraft.roomWallColor}
                            className={styles.dungeonEditorColorInput}
                            disabled={!dungeonEditorDraft.showCorridorWalls}
                            onChange={(event) => setDungeonEditorDraft((current) => ({ ...current, roomWallColor: event.target.value }))}
                          />
                        </label>
                      </div>
                    </div>

                    {(dungeonEditorConfig.errors[0] || dungeonEditorError) ? (
                      <div className={styles.dungeonEditorError}>{dungeonEditorConfig.errors[0] ?? dungeonEditorError}</div>
                    ) : null}

                    <div className={styles.dungeonEditorActions}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleExportDungeonJson}
                        disabled={isSavingDungeonMap || isSavingDungeonConfig || dungeonEditorConfig.errors.length > 0}
                        aria-label="Exportar JSON"
                        title="Exportar JSON"
                      >
                        <Download className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleSaveDungeonGeneratorConfig}
                        disabled={isSavingDungeonMap || isSavingDungeonConfig || dungeonEditorConfig.errors.length > 0}
                        aria-label={isSavingDungeonConfig ? "Guardando configuracion" : "Guardar configuracion"}
                        title={isSavingDungeonConfig ? "Guardando configuracion" : "Guardar configuracion"}
                      >
                        <Save className={isSavingDungeonConfig ? "size-3.5 animate-spin" : "size-3.5"} />
                      </Button>
                      <Button
                        size="sm"
                        className={styles.dungeonEditorSaveButton}
                        onClick={handleSaveGeneratedDungeonMap}
                        disabled={isSavingDungeonMap || isSavingDungeonConfig || dungeonEditorConfig.errors.length > 0}
                        aria-label={isSavingDungeonMap ? "Guardando mapa" : "Generar y guardar mapa"}
                        title={isSavingDungeonMap ? "Guardando mapa" : "Generar y guardar mapa"}
                      >
                        <RotateCw className={isSavingDungeonMap ? "size-3.5 animate-spin" : "size-3.5"} />
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          ) : null}
        </Tabs>
      </aside>

      <LandmarkDetailDialog
        landmarkId={selectedLandmarkDetail?.id}
        open={Boolean(selectedLandmarkDetail)}
        onOpenChange={(open) => {
          if (!open) setSelectedLandmarkDetail(null)
        }}
        onLandmarkUpdated={(updatedLandmark) => {
          setSelectedLandmarkDetail(updatedLandmark)
          setAllLandmarks((current) =>
            current.some((item) => item.id === updatedLandmark.id)
              ? current.map((item) => (item.id === updatedLandmark.id ? updatedLandmark : item))
              : [...current, updatedLandmark],
          )
          setDetailLandmarkNameById((prev) => {
            const next = new Map(prev)
            next.set(updatedLandmark.id, updatedLandmark.nombre)
            return next
          })
          setLandmark((prev) => (prev && prev.id === updatedLandmark.id ? updatedLandmark : prev))
        }}
      />
      <EstadoDetailDialog
        estadoId={selectedEstadoDetailId}
        open={selectedEstadoDetailId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEstadoDetailId(null)
        }}
        onEstadoUpdated={(updatedEstado: Estado) => {
          setSelectedEstadoDetailId(updatedEstado.id)
        }}
        onOpenEstado={(nextEstadoId) => {
          setSelectedEstadoDetailId(nextEstadoId)
        }}
        onOpenCharacter={(characterId) => {
          handleOpenMention({ type: "character", id: characterId, label: "" })
        }}
        onOpenLandmark={(landmarkId) => {
          handleOpenMention({ type: "landmark", id: landmarkId, label: "" })
        }}
      />
      <CreateLandmarkEventDialog
        open={isCreateEventDialogOpen}
        initialEvent={editingEvent}
        onOpenChange={(nextOpen) => {
          setIsCreateEventDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditingEventIndex(null)
          }
        }}
        onSaveEvent={handleSaveEvent}
      />
      <BuildingDetailDialog
        buildingId={selectedBuildingDetailId}
        open={isBuildingDialogOpen}
        onOpenChange={(open) => {
          setIsBuildingDialogOpen(open)
          if (!open) setSelectedBuildingDetailId(null)
        }}
        initialLandmarkId={landmark.id}
        resolveLandmarkName={resolveLandmarkName}
        resolveOrganizationName={resolveOrganizationName}
        onBuildingUpdated={(updatedBuilding) => {
          setSelectedBuildingDetailId(updatedBuilding.id)
          setStoredBuildings((prev) => {
            const existingIndex = prev.findIndex((building) => building.id === updatedBuilding.id)
            if (existingIndex < 0) {
              return [...prev, updatedBuilding]
            }
            return prev.map((building) =>
              building.id === updatedBuilding.id ? updatedBuilding : building,
            )
          })
          setDetailBuildingNameById((prev) => {
            const next = new Map(prev)
            next.set(updatedBuilding.id, updatedBuilding.nombre)
            return next
          })
          setLandmark((prev) => {
            if (!prev) return prev

            const belongsToCurrentLandmark = updatedBuilding.landmarkId === prev.id
            const existingIndex = prev.edificios.findIndex((building) => building.id === updatedBuilding.id)

            if (existingIndex < 0) {
              if (!belongsToCurrentLandmark) return prev
              return {
                ...prev,
                edificios: [...prev.edificios, updatedBuilding],
              }
            }

            if (!belongsToCurrentLandmark) {
              return {
                ...prev,
                edificios: prev.edificios.filter((building) => building.id !== updatedBuilding.id),
              }
            }

            return {
              ...prev,
              edificios: prev.edificios.map((building) =>
                building.id === updatedBuilding.id ? updatedBuilding : building
              ),
            }
          })
        }}
      />
      <CharacterDetailDialog
        characterId={selectedCharacterDetail?.character.id}
        open={isCharacterDialogOpen}
        onOpenChange={(open) => {
          setIsCharacterDialogOpen(open)
          if (!open) setSelectedCharacterDetail(null)
        }}
        initialLandmarkId={landmark.id}
        onCharacterUpdated={(updatedCharacter) => {
          setStoredCharacters((prev) => {
            const existingIndex = prev.findIndex((character) => character.id === updatedCharacter.id)
            if (existingIndex < 0) {
              return [...prev, updatedCharacter]
            }
            return prev.map((character) =>
              character.id === updatedCharacter.id ? updatedCharacter : character,
            )
          })
          setSelectedCharacterDetail((prev) => (prev ? { ...prev, character: updatedCharacter } : prev))
          setLandmark((prev) => {
            if (!prev) return prev

            const belongsToCurrentLandmark = updatedCharacter.landmarkId === prev.id
            const existingIndex = prev.personajes.findIndex((character) => character.id === updatedCharacter.id)

            if (existingIndex < 0) {
              if (!belongsToCurrentLandmark) return prev
              return {
                ...prev,
                personajes: [...prev.personajes, updatedCharacter],
              }
            }

            if (!belongsToCurrentLandmark) {
              return {
                ...prev,
                personajes: prev.personajes.filter((character) => character.id !== updatedCharacter.id),
              }
            }

            return {
              ...prev,
              personajes: prev.personajes.map((character) =>
                character.id === updatedCharacter.id ? updatedCharacter : character
              ),
            }
          })
        }}
      />
      <OrganizationDetailDialog
        organizationId={selectedOrganizationDetail?.id}
        open={isOrganizationDialogOpen}
        onOpenChange={(open) => {
          setIsOrganizationDialogOpen(open)
          if (!open) setSelectedOrganizationDetail(null)
        }}
        initialLandmarkId={landmark.id}
        resolveBuildingName={resolveBuildingName}
        resolveLandmarkName={resolveLandmarkName}
        onOrganizationUpdated={(updatedOrganization) => {
          setSelectedOrganizationDetail(updatedOrganization)
          setStoredOrganizations((prev) => {
            const existingIndex = prev.findIndex((organization) => organization.id === updatedOrganization.id)
            if (existingIndex < 0) {
              return [...prev, updatedOrganization]
            }
            return prev.map((organization) =>
              organization.id === updatedOrganization.id ? updatedOrganization : organization,
            )
          })
          setDetailOrganizationNameById((prev) => {
            const next = new Map(prev)
            next.set(updatedOrganization.id, updatedOrganization.nombre)
            return next
          })
          setLandmark((prev) => {
            if (!prev) return prev

            const belongsToCurrentLandmark = updatedOrganization.landmarks.includes(prev.id)
            const existingIndex = prev.organizaciones.findIndex(
              (organization) => organization.id === updatedOrganization.id
            )

            if (existingIndex < 0) {
              if (!belongsToCurrentLandmark) return prev
              return {
                ...prev,
                organizaciones: [...prev.organizaciones, updatedOrganization],
              }
            }

            if (!belongsToCurrentLandmark) {
              return {
                ...prev,
                organizaciones: prev.organizaciones.filter(
                  (organization) => organization.id !== updatedOrganization.id
                ),
              }
            }

            return {
              ...prev,
              organizaciones: prev.organizaciones.map((organization) =>
                organization.id === updatedOrganization.id ? updatedOrganization : organization
              ),
            }
          })
        }}
      />
    </section>
  )
}
