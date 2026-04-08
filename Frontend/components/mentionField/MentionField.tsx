"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { BuildingResumeDialog } from "@/components/dialog/resumed/BuildingResumeDialog"
import { CharacterResumeDialog } from "@/components/dialog/resumed/CharacterResumeDialog"
import { LandmarkResumeDialog } from "@/components/dialog/resumed/LandmarkResumeDialog"
import { OrganizationResumeDialog } from "@/components/dialog/resumed/OrganizationResumeDialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { fetchCharacters } from "@/lib/services/character-api.service"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { fetchLandmarks } from "@/lib/services/landmark-api.service"
import { fetchOrganizations } from "@/lib/services/organization-api.service"
import type { Building, Character, Landmark, Organization } from "@/lib/types"
import { cn } from "@/lib/utils"

import "./Mentions.css"

type MentionFormat = "token" | "plain"

export type MentionEntityType = "landmark" | "building" | "character" | "organization"

export interface MentionEntity {
  type: MentionEntityType
  id: number
  label: string
  description?: string
  subtitle?: string
  image?: string | null
}

export interface MentionRef {
  type?: MentionEntityType
  id?: number
  label: string
}

export interface MentionTextSegment {
  kind: "text" | "mention"
  text: string
  mention?: MentionRef
}

export type MentionLookup = Map<string, MentionEntity>

interface MentionDomainContext {
  landmarksById: Map<number, Landmark>
  buildingsById: Map<number, Building>
  charactersById: Map<number, Character>
  organizationsById: Map<number, Organization>
  landmarkNameById: Map<number, string>
}

interface AutoMentionContext {
  entities: MentionEntity[]
  mentionLookup: MentionLookup
  domain: MentionDomainContext
}

const EMPTY_DOMAIN_CONTEXT: MentionDomainContext = {
  landmarksById: new Map(),
  buildingsById: new Map(),
  charactersById: new Map(),
  organizationsById: new Map(),
  landmarkNameById: new Map(),
}

const MENTION_PATTERN =
  /@\[(.*?)\](?:\((landmark|building|character|organization):(\d+)\))?/g

const MAX_RESULTS = 8
const DROPDOWN_MARGIN = 10
const CARET_OFFSET_X = 10

const MENTION_TEXTAREA_BASE_CLASS =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

const sanitizeLabel = (label: string) =>
  label
    .replace(/[\]\[\(\)\n\r]/g, " ")
    .trim()

const isMentionEntityType = (value: string): value is MentionEntityType =>
  value === "landmark" ||
  value === "building" ||
  value === "character" ||
  value === "organization"

export const getMentionEntityKey = (type: MentionEntityType, id: number) => `${type}:${id}`

export const createMentionToken = (entity: MentionEntity) =>
  `@[${sanitizeLabel(entity.label) || "Entidad"}](${entity.type}:${entity.id})`

export const parseMentionText = (text: string): MentionTextSegment[] => {
  if (!text) return []

  const result: MentionTextSegment[] = []
  let cursor = 0
  MENTION_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null = MENTION_PATTERN.exec(text)

  while (match) {
    const [raw, label, type, idText] = match
    const start = match.index
    const end = start + raw.length

    if (start > cursor) {
      result.push({ kind: "text", text: text.slice(cursor, start) })
    }

    result.push({
      kind: "mention",
      text: `@${label}`,
      mention: {
        type: type && isMentionEntityType(type) ? type : undefined,
        id: idText ? Number(idText) : undefined,
        label,
      },
    })

    cursor = end
    match = MENTION_PATTERN.exec(text)
  }

  if (cursor < text.length) {
    result.push({ kind: "text", text: text.slice(cursor) })
  }

  return result
}

export const buildMentionLookup = (entities: MentionEntity[]): MentionLookup => {
  const lookup: MentionLookup = new Map()
  for (const entity of entities) {
    lookup.set(getMentionEntityKey(entity.type, entity.id), entity)
  }
  return lookup
}

function mergeById<T extends { id: number }>(...collections: T[][]): T[] {
  const byId = new Map<number, T>()
  for (const items of collections) {
    for (const item of items) {
      byId.set(item.id, item)
    }
  }
  return Array.from(byId.values())
}

function flattenBuildingsFromLandmarks(landmarks: Landmark[]) {
  const buildings: Building[] = []
  for (const landmark of landmarks) {
    for (const building of landmark.edificios ?? []) {
      buildings.push({
        ...building,
        landmarkId: building.landmarkId ?? landmark.id,
      })
    }
  }
  return buildings
}

function flattenCharactersFromLandmarks(landmarks: Landmark[]) {
  const characters: Character[] = []
  for (const landmark of landmarks) {
    for (const character of landmark.personajes ?? []) {
      characters.push({
        ...character,
        landmarkId: character.landmarkId ?? landmark.id,
      })
    }
  }
  return characters
}

function buildMentionEntitiesFromCollections(
  landmarks: Landmark[],
  buildings: Building[],
  characters: Character[],
  organizations: Organization[],
  landmarkNameById: Map<number, string>,
) {
  const entities: MentionEntity[] = []
  const seen = new Set<string>()

  const addEntity = (entity: MentionEntity) => {
    const key = getMentionEntityKey(entity.type, entity.id)
    if (seen.has(key)) return
    seen.add(key)
    entities.push(entity)
  }

  for (const landmark of landmarks) {
    addEntity({
      type: "landmark",
      id: landmark.id,
      label: landmark.nombre,
      description: landmark.descripcionCorta ?? landmark.historia,
      subtitle: landmark.tipo,
      image: landmark.icono,
    })
  }

  for (const building of buildings) {
    addEntity({
      type: "building",
      id: building.id,
      label: building.nombre,
      description: building.descripcion,
      subtitle:
        typeof building.landmarkId === "number" && building.landmarkId > 0
          ? landmarkNameById.get(building.landmarkId)
          : undefined,
    })
  }

  for (const character of characters) {
    const subtitleParts = [
      character.clase,
      character.raza,
      landmarkNameById.get(character.landmarkId),
    ].filter((part): part is string => Boolean(part && part.trim().length > 0))

    addEntity({
      type: "character",
      id: character.id,
      label: character.nombre,
      description: character.descripcion,
      subtitle: subtitleParts.join(" - "),
      image: character.imagen ?? null,
    })
  }

  for (const organization of organizations) {
    const landmarkNames = organization.landmarks
      .map((landmarkId) => landmarkNameById.get(landmarkId))
      .filter((name): name is string => Boolean(name && name.trim().length > 0))

    addEntity({
      type: "organization",
      id: organization.id,
      label: organization.nombre,
      description: organization.descripcion,
      subtitle: landmarkNames[0],
      image: organization.imagen ?? null,
    })
  }

  return entities.sort((a, b) => a.label.localeCompare(b.label, "es"))
}

async function buildAutoMentionContext(): Promise<AutoMentionContext> {
  const storedLandmarks = await fetchLandmarks().catch(() => [])
  const landmarks = mergeById<Landmark>(storedLandmarks)
  const storedCharacters = await fetchCharacters().catch(() => [])

  const buildings = mergeById<Building>(
    flattenBuildingsFromLandmarks(landmarks),
    await fetchBuildings().catch(() => []),
  )

  const characters = mergeById<Character>(
    flattenCharactersFromLandmarks(landmarks),
    storedCharacters,
  )

  const organizations = await fetchOrganizations().catch(() => [])

  const landmarkNameById = new Map<number, string>()
  for (const landmark of landmarks) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  const entities = buildMentionEntitiesFromCollections(
    landmarks,
    buildings,
    characters,
    organizations,
    landmarkNameById,
  )

  return {
    entities,
    mentionLookup: buildMentionLookup(entities),
    domain: {
      landmarksById: new Map(landmarks.map((item) => [item.id, item])),
      buildingsById: new Map(buildings.map((item) => [item.id, item])),
      charactersById: new Map(characters.map((item) => [item.id, item])),
      organizationsById: new Map(organizations.map((item) => [item.id, item])),
      landmarkNameById,
    },
  }
}

export const buildMentionEntitiesFromLandmarks = (
  landmarks: Landmark[],
  organizations: Organization[] = [],
): MentionEntity[] => {
  const landmarkNameById = new Map<number, string>()
  for (const landmark of landmarks) {
    landmarkNameById.set(landmark.id, landmark.nombre)
  }

  return buildMentionEntitiesFromCollections(
    landmarks,
    flattenBuildingsFromLandmarks(landmarks),
    flattenCharactersFromLandmarks(landmarks),
    organizations,
    landmarkNameById,
  )
}

interface MentionQueryState {
  start: number
  end: number
  query: string
}

interface DropdownPosition {
  left: number
  top: number
}

export interface MentionFieldProps {
  value: string
  entities?: MentionEntity[]
  mentionLookup?: MentionLookup
  source?: "provided" | "auto"
  editable?: boolean
  mentionFormat?: MentionFormat
  placeholder?: string
  rows?: number
  className?: string
  emptyText?: string
  disabled?: boolean
  onChange?: (value: string) => void
  onOpenMention?: (mention: MentionRef) => void
}

const getMentionQuery = (text: string, caret: number) => {
  let start = caret - 1
  while (
    start >= 0 &&
    text[start] !== "@" &&
    text[start] !== "\n" &&
    text[start] !== "\r" &&
    !/\s/.test(text[start])
  ) {
    start -= 1
  }
  if (start < 0 || text[start] !== "@") {
    return null
  }
  const end = caret
  const query = text.slice(start + 1, end)
  return { start, end, query }
}

const findSuggestions = (entities: MentionEntity[], query: string): MentionEntity[] => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) {
    return entities.slice(0, MAX_RESULTS)
  }
  return entities.filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, MAX_RESULTS)
}

const clampNumber = (value: number, min: number, max: number) => {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

const calcDropdownPosition = (textarea: HTMLTextAreaElement, caret: number) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      left: 6,
      top: textarea.clientHeight + DROPDOWN_MARGIN,
    }
  }

  const mirror = document.createElement("div")
  const textareaRect = textarea.getBoundingClientRect()
  const textareaStyle = getComputedStyle(textarea)
  const marker = document.createElement("span")
  marker.textContent = "\u200b"
  mirror.style.position = "fixed"
  mirror.style.left = `${textareaRect.left}px`
  mirror.style.top = `${textareaRect.top}px`
  mirror.style.whiteSpace = "pre-wrap"
  mirror.style.wordBreak = "break-word"
  mirror.style.overflowWrap = "break-word"
  mirror.style.visibility = "hidden"
  mirror.style.pointerEvents = "none"
  mirror.style.font = textareaStyle.font
  mirror.style.lineHeight = textareaStyle.lineHeight
  mirror.style.letterSpacing = textareaStyle.letterSpacing
  mirror.style.padding = textareaStyle.padding
  mirror.style.border = textareaStyle.border
  mirror.style.boxSizing = textareaStyle.boxSizing
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.textContent = textarea.value.slice(0, caret)
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  document.body.removeChild(mirror)

  const rawLeft =
    markerRect.left - textareaRect.left - textarea.scrollLeft + CARET_OFFSET_X
  const rawTop =
    markerRect.top - textareaRect.top - textarea.scrollTop + DROPDOWN_MARGIN + 16

  const estimatedMenuWidth = Math.min(Math.max(240, textarea.clientWidth * 0.7), 360)
  const maxLeft = Math.max(6, textarea.clientWidth - estimatedMenuWidth - 6)
  const left = clampNumber(rawLeft, 6, maxLeft)

  const maxTop = Math.max(6, textarea.clientHeight - 10)
  const top = clampNumber(rawTop, 6, maxTop)

  return {
    left,
    top,
  }
}

const MentionTextarea = ({
  value,
  entities = [],
  mentionFormat = "token",
  placeholder,
  rows = 3,
  className,
  disabled,
  onChange,
}: MentionFieldProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const selectedSuggestionRef = useRef<HTMLButtonElement | null>(null)
  const mentionQueryRef = useRef<MentionQueryState | null>(null)
  const [mentionQuery, setMentionQuery] = useState<MentionQueryState | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const suggestions = useMemo(
    () => (mentionQuery ? findSuggestions(entities, mentionQuery.query) : []),
    [entities, mentionQuery],
  )

  const updateMentionQuery = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const caret = textarea.selectionStart
    const query = getMentionQuery(textarea.value, caret)
    const previousQuery = mentionQueryRef.current
    const hasQueryChanged =
      (previousQuery === null) !== (query === null) ||
      previousQuery?.start !== query?.start ||
      previousQuery?.query !== query?.query

    if (hasQueryChanged) {
      mentionQueryRef.current = query
      setMentionQuery(query)
      setSelectedIndex(0)
    }
    if (query) {
      setDropdownPosition(calcDropdownPosition(textarea, caret))
      return
    }
    setDropdownPosition(null)
  }, [])

  useEffect(() => {
    setSelectedIndex((prev) => clampNumber(prev, 0, suggestions.length - 1))
  }, [suggestions.length])

  useEffect(() => {
    if (!mentionQuery || suggestions.length === 0) return
    selectedSuggestionRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    })
  }, [mentionQuery, selectedIndex, suggestions])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handleScroll = () => updateMentionQuery()
    textarea.addEventListener("scroll", handleScroll)
    return () => textarea.removeEventListener("scroll", handleScroll)
  }, [updateMentionQuery])

  useLayoutEffect(() => {
    updateMentionQuery()
  }, [value, updateMentionQuery])

  const closeSuggestions = useCallback(() => {
    mentionQueryRef.current = null
    setMentionQuery(null)
    setDropdownPosition(null)
  }, [])

  const insertMention = useCallback(
    (entity: MentionEntity) => {
      const textarea = textareaRef.current
      if (!textarea || !mentionQuery) return

      const mentionText = mentionFormat === "plain" ? `@${entity.label}` : createMentionToken(entity)
      const nextValue =
        value.slice(0, mentionQuery.start) +
        mentionText +
        value.slice(mentionQuery.end, value.length)
      const nextCaret = mentionQuery.start + mentionText.length
      onChange?.(nextValue)
      requestAnimationFrame(() => {
        textarea.selectionStart = nextCaret
        textarea.selectionEnd = nextCaret
        textarea.focus()
      })
      closeSuggestions()
    },
    [closeSuggestions, mentionFormat, mentionQuery, onChange, value],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mentionQuery) return

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      if (event.key === "Enter") {
        if (suggestions.length > 0) {
          event.preventDefault()
          insertMention(suggestions[selectedIndex] ?? suggestions[0])
        }
        return
      }

      if (event.key === "Tab") {
        if (suggestions.length > 0) {
          event.preventDefault()
          insertMention(suggestions[selectedIndex] ?? suggestions[0])
        }
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        closeSuggestions()
      }
    },
    [closeSuggestions, insertMention, mentionQuery, selectedIndex, suggestions],
  )

  return (
    <div className="mention-textarea-wrapper">
      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        className={cn(MENTION_TEXTAREA_BASE_CLASS, className)}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={updateMentionQuery}
        onClick={updateMentionQuery}
        onBlur={closeSuggestions}
      />

      {mentionQuery && suggestions.length > 0 && dropdownPosition && (
        <div
          className="mention-suggestions"
          style={{ left: dropdownPosition.left, top: dropdownPosition.top }}
        >
          {suggestions.map((entity, index) => (
            <button
              key={`mention-suggestion-${entity.type}-${entity.id}`}
              ref={(element) => {
                if (index === selectedIndex) {
                  selectedSuggestionRef.current = element
                }
              }}
              type="button"
              className={index === selectedIndex ? "is-active" : undefined}
              onMouseDown={(event) => {
                event.preventDefault()
                insertMention(entity)
              }}
            >
              <strong>{entity.label}</strong>
              {entity.subtitle && <span>{entity.subtitle}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function buildMentionPreviewContent(
  mention: MentionRef,
  _domain: MentionDomainContext,
  entity?: MentionEntity,
): ReactNode | null {
  if (!mention.type || typeof mention.id !== "number") {
    if (!entity) return null
    return (
      <div className="w-72 rounded-md border border-border bg-background px-3 py-2.5 shadow-md">
        <div className="text-sm font-semibold text-primary">{entity.label}</div>
        {entity.subtitle && (
          <div className="mt-0.5 text-xs text-muted-foreground">{entity.subtitle}</div>
        )}
        {entity.description && (
          <p className="mt-2 text-xs leading-relaxed text-foreground/85">{entity.description}</p>
        )}
      </div>
    )
  }

  if (mention.type === "landmark") {
    return <LandmarkResumeDialog landmarkId={mention.id} />
  }

  if (mention.type === "building") {
    return <BuildingResumeDialog buildingId={mention.id} />
  }

  if (mention.type === "character") {
    return <CharacterResumeDialog characterId={mention.id} />
  }

  if (mention.type === "organization") {
    return <OrganizationResumeDialog organizationId={mention.id} />
  }

  return null
}

const MentionText = ({
  text,
  mentionLookup,
  domain,
  emptyText = "Sin descripcion.",
  className,
  onOpenMention,
}: Pick<MentionFieldProps, "emptyText" | "className" | "onOpenMention"> & {
  text?: string | null
  mentionLookup: MentionLookup
  domain: MentionDomainContext
}) => {
  const sourceText = text ?? ""
  const segments = useMemo(() => parseMentionText(sourceText), [sourceText])

  if (sourceText.trim().length === 0) {
    return <span className={className}>{emptyText}</span>
  }

  return (
    <span className={cn("mention-rich-text", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          return <span key={`mention-text-${index}`}>{segment.text}</span>
        }

        const mention = segment.mention
        if (!mention) {
          return <span key={`mention-text-${index}`}>{segment.text}</span>
        }

        let entity =
          mention.type && typeof mention.id === "number"
            ? mentionLookup.get(getMentionEntityKey(mention.type, mention.id))
            : undefined

        if (!entity) {
          const normalizedLabel = mention.label.trim().toLowerCase()
          entity = Array.from(mentionLookup.values()).find(
            (candidate) => candidate.label.trim().toLowerCase() === normalizedLabel,
          )
        }

        const label = entity?.label ?? mention.label
        const resolvedMention: MentionRef | null =
          entity ? { type: entity.type, id: entity.id, label: entity.label } : null
        const previewContent = buildMentionPreviewContent(
          resolvedMention ?? mention,
          domain,
          entity,
        )
        const mentionButton = (
          <button
            type="button"
            className="mention-inline-link"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (resolvedMention) onOpenMention?.(resolvedMention)
            }}
          >
            {label}
          </button>
        )

        if (!resolvedMention && !previewContent) {
          return (
            <span
              key={`mention-link-${mention.type}-${mention.id}-${index}`}
              className="mention-inline-link mention-inline-link-static"
            >
              {label}
            </span>
          )
        }

        if (!previewContent) {
          return <span key={`mention-link-${mention.type}-${mention.id}-${index}`}>{mentionButton}</span>
        }

        return (
          <HoverCard key={`mention-link-${mention.type}-${mention.id}-${index}`} openDelay={120}>
            <HoverCardTrigger asChild>{mentionButton}</HoverCardTrigger>
            <HoverCardContent
              align="start"
              className="w-auto border-none bg-transparent p-0 shadow-none"
            >
              {previewContent}
            </HoverCardContent>
          </HoverCard>
        )
      })}
    </span>
  )
}

export function MentionField(props: MentionFieldProps) {
  const {
    value,
    entities,
    mentionLookup,
    source = "provided",
    editable = true,
    mentionFormat,
    placeholder,
    rows,
    className,
    emptyText,
    disabled,
    onChange,
    onOpenMention,
  } = props

  const [autoContext, setAutoContext] = useState<AutoMentionContext | null>(null)

  useEffect(() => {
    if (source !== "auto") {
      setAutoContext(null)
      return
    }

    let isActive = true
    void buildAutoMentionContext().then((context) => {
      if (isActive) {
        setAutoContext(context)
      }
    })

    return () => {
      isActive = false
    }
  }, [source])

  const resolvedEntities = useMemo(() => {
    if (entities && entities.length > 0) return entities
    if (source === "auto") return autoContext?.entities ?? []
    return []
  }, [autoContext?.entities, entities, source])

  const resolvedMentionLookup = useMemo(() => {
    if (mentionLookup) return mentionLookup
    if (
      source === "auto" &&
      autoContext &&
      resolvedEntities === autoContext.entities
    ) {
      return autoContext.mentionLookup
    }
    return buildMentionLookup(resolvedEntities)
  }, [mentionLookup, source, autoContext, resolvedEntities])

  const resolvedDomain = useMemo(() => {
    if (
      source === "auto" &&
      autoContext &&
      resolvedEntities === autoContext.entities
    ) {
      return autoContext.domain
    }
    return EMPTY_DOMAIN_CONTEXT
  }, [source, autoContext, resolvedEntities])

  if (!editable) {
    return (
      <MentionText
        text={value}
        mentionLookup={resolvedMentionLookup}
        domain={resolvedDomain}
        emptyText={emptyText}
        className={className}
        onOpenMention={onOpenMention}
      />
    )
  }

  return (
    <MentionTextarea
      value={value}
      entities={resolvedEntities}
      mentionFormat={mentionFormat}
      placeholder={placeholder}
      rows={rows}
      className={className}
      disabled={disabled}
      onChange={onChange}
    />
  )
}
