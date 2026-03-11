"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { BookMarked, BookOpen, FileText, Link2, ScrollText, Star, Swords, WandSparkles } from "lucide-react"

import { FeatCard } from "@/components/card/feat-card"
import { RuleCard } from "@/components/card/rule-card"
import { SpellCard } from "@/components/card/spell-card"
import MonsterCard from "@/components/monster/monster-card"
import { type Feat, type FeatEntryBlock, loadFeats } from "@/lib/feats/feat-store"
import { fetchMonsterByExactName } from "@/lib/services/monster-api.service"
import type { MonsterListItem, MonsterRecord } from "@/lib/monster/types"
import { buildMonsterListItem, normalizeMonsterRecord } from "@/lib/monster/utils"
import { type Rule, type RuleEntryBlock, loadRules } from "@/lib/rules/rule-store"
import { loadSpells, type Spell } from "@/lib/spells/spell-store"
import conditionsDataset from "@/public/dataset/conditions.json"
import monstersDataset from "@/public/dataset/monsters.json"

type InformationSection = "monsters" | "conditions" | "spells" | "feats" | "rules"

type MonsterBrowserItem = {
  id: string
  record: MonsterRecord
  summary: MonsterListItem
  source: string
}

type ConditionBrowserItem = {
  id: string
  name: string
  color: string
  blocks: ConditionEntryBlock[]
  searchText: string
}

type SpellBrowserItem = {
  id: string
  spell: Spell
  searchText: string
}

type FeatBrowserItem = {
  id: string
  feat: Feat
  searchText: string
}

type RuleBrowserItem = {
  id: string
  rule: Rule
  searchText: string
}

type MonsterSortField = "name" | "cr"
type SortDirection = "asc" | "desc"

type ConditionEntryBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }

const CONDITION_TEXT_TAG_REGEX = /\{@[^}]+\s([^}]+)\}/g
const CONDITION_HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i
const DEFAULT_CONDITION_COLOR = "#6b7280"
const SPELL_SCHOOL_TONES: Record<string, { accent: string; soft: string }> = {
  A: { accent: "#355d8d", soft: "rgba(53, 93, 141, 0.14)" },
  C: { accent: "#417a66", soft: "rgba(65, 122, 102, 0.14)" },
  D: { accent: "#5d5f8c", soft: "rgba(93, 95, 140, 0.14)" },
  E: { accent: "#8a4f7a", soft: "rgba(138, 79, 122, 0.14)" },
  I: { accent: "#6b5a9d", soft: "rgba(107, 90, 157, 0.14)" },
  N: { accent: "#7a4456", soft: "rgba(122, 68, 86, 0.14)" },
  T: { accent: "#7f6a39", soft: "rgba(127, 106, 57, 0.14)" },
  V: { accent: "#8c4f2a", soft: "rgba(140, 79, 42, 0.14)" },
}
const DEFAULT_SPELL_SCHOOL_TONE = { accent: "#7d3e1d", soft: "rgba(125, 62, 29, 0.14)" }
const FEAT_CATEGORY_TONES: Record<string, string> = {
  G: "#7d3e1d",
  O: "#8a4f2a",
  EB: "#6a4f8f",
  FS: "#355d8d",
  "FS:P": "#355d8d",
  "FS:R": "#355d8d",
}
const DEFAULT_FEAT_CATEGORY_TONE = "#7d3e1d"
const RULE_TONE = "#6d533b"

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("es")
}

function formatSource(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "N/A"
}

function parseMonsterCrValue(rawCr: string): number | null {
  const value = rawCr.trim()
  if (!value) return null

  const fractionMatch = value.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1])
    const denominator = Number(fractionMatch[2])
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator
    }
  }

  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric
  }

  return null
}

function normalizeConditionText(raw: string) {
  return raw.replace(CONDITION_TEXT_TAG_REGEX, "$1").replace(/\s+/g, " ").trim()
}

function normalizeConditionColor(rawColor: unknown) {
  const parsed = typeof rawColor === "string" ? rawColor.trim() : ""
  return CONDITION_HEX_COLOR_REGEX.test(parsed) ? parsed : DEFAULT_CONDITION_COLOR
}

function getSpellSchoolTone(schoolCode: string) {
  return SPELL_SCHOOL_TONES[schoolCode] ?? DEFAULT_SPELL_SCHOOL_TONE
}

function getFeatCategoryTone(categoryCode: string) {
  return FEAT_CATEGORY_TONES[categoryCode] ?? DEFAULT_FEAT_CATEGORY_TONE
}

function getRuleTone() {
  return RULE_TONE
}

function flattenConditionEntryText(entry: unknown): string[] {
  if (typeof entry === "string") {
    const normalized = normalizeConditionText(entry)
    return normalized ? [normalized] : []
  }

  if (!entry || typeof entry !== "object") {
    return []
  }

  const parsed = entry as {
    items?: unknown
    rows?: unknown
    entries?: unknown
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items.flatMap((item) => flattenConditionEntryText(item))
  }

  if (Array.isArray(parsed.rows)) {
    return parsed.rows.flatMap((row) => {
      if (!Array.isArray(row)) {
        return flattenConditionEntryText(row)
      }

      const normalizedRow = row
        .flatMap((cell) => flattenConditionEntryText(cell))
        .join(" | ")
        .trim()

      return normalizedRow ? [normalizedRow] : []
    })
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries.flatMap((nested) => flattenConditionEntryText(nested))
  }

  return []
}

function parseConditionEntryBlocks(entry: unknown): ConditionEntryBlock[] {
  if (typeof entry === "string") {
    const text = normalizeConditionText(entry)
    return text ? [{ kind: "paragraph", text }] : []
  }

  if (!entry || typeof entry !== "object") {
    return []
  }

  const parsed = entry as {
    type?: unknown
    items?: unknown
    entries?: unknown
    colLabels?: unknown
    rows?: unknown
  }

  const type = typeof parsed.type === "string" ? parsed.type.trim().toLowerCase() : ""

  if (type === "table" && Array.isArray(parsed.rows)) {
    const headers = Array.isArray(parsed.colLabels)
      ? parsed.colLabels
          .map((label) => normalizeConditionText(String(label ?? "")))
          .filter((label) => label.length > 0)
      : []

    const rows = parsed.rows
      .map((row) => {
        if (!Array.isArray(row)) {
          const asText = flattenConditionEntryText(row)
          return asText.length > 0 ? [asText.join(" ")] : []
        }

        return row
          .map((cell) => flattenConditionEntryText(cell).join(" ").trim())
          .map((cell) => (cell.length > 0 ? cell : "-"))
      })
      .filter((row) => row.length > 0)

    return rows.length > 0 ? [{ kind: "table", headers, rows }] : []
  }

  if (type === "list" && Array.isArray(parsed.items)) {
    const items = parsed.items.flatMap((item) => flattenConditionEntryText(item))
    return items.length > 0 ? [{ kind: "list", items }] : []
  }

  if (Array.isArray(parsed.entries)) {
    return parsed.entries.flatMap((nestedEntry) => parseConditionEntryBlocks(nestedEntry))
  }

  return []
}

function buildConditionSearchText(name: string, blocks: ConditionEntryBlock[]) {
  const chunks = [name]

  for (const block of blocks) {
    if (block.kind === "paragraph") {
      chunks.push(block.text)
      continue
    }

    if (block.kind === "list") {
      chunks.push(...block.items)
      continue
    }

    chunks.push(...block.headers)
    for (const row of block.rows) {
      chunks.push(...row)
    }
  }

  return chunks.join(" ").toLocaleLowerCase("es")
}

function buildSpellSearchText(spell: Spell) {
  const chunks = [
    spell.name,
    spell.levelLabel,
    spell.schoolLabel,
    spell.castingTimeLabel,
    spell.range,
    spell.components,
    spell.duration,
    ...spell.damageTypes,
    ...spell.savingThrows,
  ]

  return chunks.join(" ").toLocaleLowerCase("es")
}

function buildSpellItems(spells: Spell[]): SpellBrowserItem[] {
  return spells
    .map((spell, index) => {
      return {
        id: `${spell.name.toLocaleLowerCase("es")}::${spell.level ?? "?"}::${index}`,
        spell,
        searchText: buildSpellSearchText(spell),
      } satisfies SpellBrowserItem
    })
    .sort((a, b) => {
      const levelA = typeof a.spell.level === "number" ? a.spell.level : Number.MAX_SAFE_INTEGER
      const levelB = typeof b.spell.level === "number" ? b.spell.level : Number.MAX_SAFE_INTEGER
      if (levelA !== levelB) {
        return levelA - levelB
      }

      return a.spell.name.localeCompare(b.spell.name, "es")
    })
}

function flattenFeatEntryBlockText(block: FeatEntryBlock): string[] {
  if (block.kind === "paragraph") {
    return [block.name ?? "", block.text].filter(Boolean)
  }

  if (block.kind === "list") {
    return [block.name ?? "", ...block.items].filter(Boolean)
  }

  return [block.name ?? "", block.caption ?? "", ...block.headers, ...block.rows.flat()].filter(Boolean)
}

function buildFeatSearchText(feat: Feat) {
  const chunks = [
    feat.name,
    feat.categoryCode,
    feat.categoryLabel,
    ...feat.prerequisites,
    ...feat.abilityBonuses,
    ...feat.entries.flatMap((block) => flattenFeatEntryBlockText(block)),
  ]

  return chunks.join(" ").toLocaleLowerCase("es")
}

function buildFeatItems(feats: Feat[]): FeatBrowserItem[] {
  return feats
    .map((feat, index) => ({
      id: `${feat.name.toLocaleLowerCase("es")}::${feat.categoryCode || "?"}::${index}`,
      feat,
      searchText: buildFeatSearchText(feat),
    }))
    .sort((a, b) => a.feat.name.localeCompare(b.feat.name, "es"))
}

function flattenRuleEntryBlockText(block: RuleEntryBlock): string[] {
  if (block.kind === "paragraph") {
    return [block.name ?? "", block.text].filter(Boolean)
  }

  if (block.kind === "list") {
    return [block.name ?? "", ...block.items.flatMap((item) => [item.name ?? "", item.text])].filter(Boolean)
  }

  return [block.name ?? "", block.caption ?? "", ...block.headers, ...block.rows.flat()].filter(Boolean)
}

function buildRuleSearchText(rule: Rule) {
  const chunks = [
    rule.name,
    ...rule.entries.flatMap((block) => flattenRuleEntryBlockText(block)),
  ]

  return chunks.join(" ").toLocaleLowerCase("es")
}

function buildRuleItems(rules: Rule[]): RuleBrowserItem[] {
  return rules
    .map((rule, index) => ({
      id: `${rule.name.toLocaleLowerCase("es")}::${index}`,
      rule,
      searchText: buildRuleSearchText(rule),
    }))
    .sort((a, b) => a.rule.name.localeCompare(b.rule.name, "es"))
}

function buildMonsterBrowserItem(rawMonster: unknown): MonsterBrowserItem | null {
  const record = normalizeMonsterRecord(rawMonster)
  if (!record) {
    return null
  }

  const summary = buildMonsterListItem(record)
  if (!summary) {
    return null
  }

  return {
    id: summary.nameExact,
    record,
    summary,
    source: formatSource(record.source),
  }
}

const MONSTER_ITEMS = (Array.isArray(monstersDataset) ? monstersDataset : [])
  .map((monster) => buildMonsterBrowserItem(monster))
  .filter((monster): monster is MonsterBrowserItem => Boolean(monster))
  .sort((a, b) => a.summary.name.localeCompare(b.summary.name, "es"))

const CONDITION_ITEMS: ConditionBrowserItem[] = (Array.isArray(conditionsDataset) ? conditionsDataset : [])
  .map((rawCondition) => {
    const parsed = rawCondition as {
      name?: unknown
      color?: unknown
      entries?: unknown
    }

    const name = typeof parsed.name === "string" ? parsed.name.trim() : ""
    if (!name) {
      return null
    }

    const blocks = Array.isArray(parsed.entries)
      ? parsed.entries.flatMap((entry) => parseConditionEntryBlocks(entry))
      : []
    const normalizedBlocks =
      blocks.length > 0 ? blocks : [{ kind: "paragraph" as const, text: "Sin descripcion cargada." }]

    return {
      id: name,
      name,
      color: normalizeConditionColor(parsed.color),
      blocks: normalizedBlocks,
      searchText: buildConditionSearchText(name, normalizedBlocks),
    } satisfies ConditionBrowserItem
  })
  .filter((condition): condition is ConditionBrowserItem => Boolean(condition))
  .sort((a, b) => a.name.localeCompare(b.name, "es"))

const MONSTER_ITEMS_BY_ID = new Map(MONSTER_ITEMS.map((monster) => [monster.id, monster] as const))

function SectionButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Swords
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "border-[#8a4a24] bg-[linear-gradient(135deg,#8f4c26,#703619)] text-[#fff8ef] shadow-[0_6px_14px_rgba(75,41,19,0.24)]"
          : "border-[#d8c7ac] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,238,223,0.9))] text-[#6d5640] hover:border-[#a97647] hover:text-[#3f2b1d]"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function DetailPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-sm border border-dashed border-border bg-card p-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-serif text-primary">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          No hay resultados para el filtro actual. Proba con otra busqueda o selecciona otra categoria.
        </p>
      </div>
    </div>
  )
}

export default function InformacionPage() {
  const [activeSection, setActiveSection] = useState<InformationSection>("monsters")
  const [monsterQuery, setMonsterQuery] = useState("")
  const [monsterSortField, setMonsterSortField] = useState<MonsterSortField>("name")
  const [monsterSortDirection, setMonsterSortDirection] = useState<SortDirection>("asc")
  const [conditionQuery, setConditionQuery] = useState("")
  const [spellQuery, setSpellQuery] = useState("")
  const [featQuery, setFeatQuery] = useState("")
  const [ruleQuery, setRuleQuery] = useState("")
  const [selectedMonsterId, setSelectedMonsterId] = useState(MONSTER_ITEMS[0]?.id ?? "")
  const [selectedConditionId, setSelectedConditionId] = useState(CONDITION_ITEMS[0]?.id ?? "")
  const [selectedSpellId, setSelectedSpellId] = useState("")
  const [selectedFeatId, setSelectedFeatId] = useState("")
  const [selectedRuleId, setSelectedRuleId] = useState("")
  const [selectedMonsterRecord, setSelectedMonsterRecord] = useState<MonsterRecord | null>(
    MONSTER_ITEMS[0]?.record ?? null,
  )
  const [spellItems, setSpellItems] = useState<SpellBrowserItem[]>([])
  const [featItems, setFeatItems] = useState<FeatBrowserItem[]>([])
  const [ruleItems, setRuleItems] = useState<RuleBrowserItem[]>([])
  const [spellsStatus, setSpellsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [featsStatus, setFeatsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [rulesStatus, setRulesStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [spellsErrorMessage, setSpellsErrorMessage] = useState("")
  const [featsErrorMessage, setFeatsErrorMessage] = useState("")
  const [rulesErrorMessage, setRulesErrorMessage] = useState("")
  const monsterDetailsCacheRef = useRef(new Map<string, MonsterRecord>())

  const deferredMonsterQuery = useDeferredValue(monsterQuery)
  const deferredConditionQuery = useDeferredValue(conditionQuery)
  const deferredSpellQuery = useDeferredValue(spellQuery)
  const deferredFeatQuery = useDeferredValue(featQuery)
  const deferredRuleQuery = useDeferredValue(ruleQuery)
  const normalizedMonsterQuery = normalizeSearch(deferredMonsterQuery)
  const normalizedConditionQuery = normalizeSearch(deferredConditionQuery)
  const normalizedSpellQuery = normalizeSearch(deferredSpellQuery)
  const normalizedFeatQuery = normalizeSearch(deferredFeatQuery)
  const normalizedRuleQuery = normalizeSearch(deferredRuleQuery)

  const filteredMonsters = MONSTER_ITEMS.filter((monster) => {
    if (!normalizedMonsterQuery) {
      return true
    }

    const haystack = [
      monster.summary.name,
      monster.summary.type,
      monster.summary.cr,
      monster.source,
    ]
      .join(" ")
      .toLocaleLowerCase("es")

    return haystack.includes(normalizedMonsterQuery)
  })

  const sortedMonsters = useMemo(() => {
    const sorted = [...filteredMonsters]

    sorted.sort((a, b) => {
      let comparison = 0

      if (monsterSortField === "cr") {
        const aCr = parseMonsterCrValue(a.summary.cr)
        const bCr = parseMonsterCrValue(b.summary.cr)

        if (aCr == null && bCr == null) {
          comparison = a.summary.name.localeCompare(b.summary.name, "es")
        } else if (aCr == null) {
          comparison = 1
        } else if (bCr == null) {
          comparison = -1
        } else if (aCr !== bCr) {
          comparison = aCr - bCr
        } else {
          comparison = a.summary.name.localeCompare(b.summary.name, "es")
        }
      } else {
        comparison = a.summary.name.localeCompare(b.summary.name, "es")
      }

      return monsterSortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredMonsters, monsterSortDirection, monsterSortField])

  const filteredConditions = CONDITION_ITEMS.filter((condition) => {
    if (!normalizedConditionQuery) {
      return true
    }

    return condition.searchText.includes(normalizedConditionQuery)
  })

  const filteredSpells = spellItems.filter((spellItem) => {
    if (!normalizedSpellQuery) {
      return true
    }

    return spellItem.searchText.includes(normalizedSpellQuery)
  })

  const filteredFeats = featItems.filter((featItem) => {
    if (!normalizedFeatQuery) {
      return true
    }

    return featItem.searchText.includes(normalizedFeatQuery)
  })

  const filteredRules = ruleItems.filter((ruleItem) => {
    if (!normalizedRuleQuery) {
      return true
    }

    return ruleItem.searchText.includes(normalizedRuleQuery)
  })

  useEffect(() => {
    if (activeSection !== "spells" || spellItems.length > 0) {
      return
    }

    let cancelled = false
    setSpellsStatus("loading")
    setSpellsErrorMessage("")

    async function loadSpellList() {
      try {
        const loadedSpells = await loadSpells()
        if (cancelled) {
          return
        }

        const nextSpellItems = buildSpellItems(loadedSpells)
        setSpellItems(nextSpellItems)
        setSelectedSpellId(nextSpellItems[0]?.id ?? "")
        setSpellsStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setSpellsStatus("error")
        setSpellsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los spells.")
      }
    }

    void loadSpellList()

    return () => {
      cancelled = true
    }
  }, [activeSection, spellItems.length])

  useEffect(() => {
    if (activeSection !== "feats" || featItems.length > 0) {
      return
    }

    let cancelled = false
    setFeatsStatus("loading")
    setFeatsErrorMessage("")

    async function loadFeatList() {
      try {
        const loadedFeats = await loadFeats()
        if (cancelled) {
          return
        }

        const nextFeatItems = buildFeatItems(loadedFeats)
        setFeatItems(nextFeatItems)
        setSelectedFeatId(nextFeatItems[0]?.id ?? "")
        setFeatsStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setFeatsStatus("error")
        setFeatsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los feats.")
      }
    }

    void loadFeatList()

    return () => {
      cancelled = true
    }
  }, [activeSection, featItems.length])

  useEffect(() => {
    if (activeSection !== "rules" || ruleItems.length > 0) {
      return
    }

    let cancelled = false
    setRulesStatus("loading")
    setRulesErrorMessage("")

    async function loadRuleList() {
      try {
        const loadedRules = await loadRules()
        if (cancelled) {
          return
        }

        const nextRuleItems = buildRuleItems(loadedRules)
        setRuleItems(nextRuleItems)
        setSelectedRuleId(nextRuleItems[0]?.id ?? "")
        setRulesStatus("ready")
      } catch (error) {
        if (cancelled) {
          return
        }

        setRulesStatus("error")
        setRulesErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las reglas.")
      }
    }

    void loadRuleList()

    return () => {
      cancelled = true
    }
  }, [activeSection, ruleItems.length])

  useEffect(() => {
    if (activeSection !== "monsters") {
      return
    }

    if (sortedMonsters.some((monster) => monster.id === selectedMonsterId)) {
      return
    }

    setSelectedMonsterId(sortedMonsters[0]?.id ?? "")
  }, [activeSection, selectedMonsterId, sortedMonsters])

  useEffect(() => {
    if (activeSection !== "conditions") {
      return
    }

    if (filteredConditions.some((condition) => condition.id === selectedConditionId)) {
      return
    }

    setSelectedConditionId(filteredConditions[0]?.id ?? "")
  }, [activeSection, filteredConditions, selectedConditionId])

  useEffect(() => {
    if (activeSection !== "spells" || spellsStatus !== "ready") {
      return
    }

    if (filteredSpells.some((spell) => spell.id === selectedSpellId)) {
      return
    }

    setSelectedSpellId(filteredSpells[0]?.id ?? "")
  }, [activeSection, filteredSpells, selectedSpellId, spellsStatus])

  useEffect(() => {
    if (activeSection !== "feats" || featsStatus !== "ready") {
      return
    }

    if (filteredFeats.some((feat) => feat.id === selectedFeatId)) {
      return
    }

    setSelectedFeatId(filteredFeats[0]?.id ?? "")
  }, [activeSection, featsStatus, filteredFeats, selectedFeatId])

  useEffect(() => {
    if (activeSection !== "rules" || rulesStatus !== "ready") {
      return
    }

    if (filteredRules.some((rule) => rule.id === selectedRuleId)) {
      return
    }

    setSelectedRuleId(filteredRules[0]?.id ?? "")
  }, [activeSection, filteredRules, rulesStatus, selectedRuleId])

  useEffect(() => {
    if (activeSection !== "monsters" || !selectedMonsterId) {
      return
    }

    const localMonster = MONSTER_ITEMS_BY_ID.get(selectedMonsterId)?.record ?? null
    setSelectedMonsterRecord(localMonster)

    const cachedMonster = monsterDetailsCacheRef.current.get(selectedMonsterId)
    if (cachedMonster) {
      setSelectedMonsterRecord(cachedMonster)
      return
    }

    let cancelled = false

    async function loadMonsterDetail() {
      try {
        const remoteMonster = await fetchMonsterByExactName(selectedMonsterId, { withTokenImage: true })
        if (cancelled || !remoteMonster) {
          return
        }

        monsterDetailsCacheRef.current.set(selectedMonsterId, remoteMonster)
        setSelectedMonsterRecord(remoteMonster)
      } catch {
        if (!cancelled) {
          setSelectedMonsterRecord(localMonster)
        }
      }
    }

    void loadMonsterDetail()

    return () => {
      cancelled = true
    }
  }, [activeSection, selectedMonsterId])

  const selectedMonster = sortedMonsters.find((monster) => monster.id === selectedMonsterId) ?? null
  const selectedCondition = filteredConditions.find((condition) => condition.id === selectedConditionId) ?? null
  const selectedSpell = filteredSpells.find((spell) => spell.id === selectedSpellId)?.spell ?? null
  const selectedFeat = filteredFeats.find((feat) => feat.id === selectedFeatId)?.feat ?? null
  const selectedRule = filteredRules.find((rule) => rule.id === selectedRuleId)?.rule ?? null
  const currentQuery =
    activeSection === "monsters"
      ? monsterQuery
      : activeSection === "conditions"
        ? conditionQuery
        : activeSection === "spells"
          ? spellQuery
          : activeSection === "feats"
            ? featQuery
            : ruleQuery
  const getListItemClassName = (isActive: boolean) =>
    `w-full rounded-sm border p-3 text-left transition-colors ${
      isActive
        ? "border-[#a77243] bg-[linear-gradient(135deg,rgba(247,235,213,0.95),rgba(238,219,187,0.9))] shadow-[inset_0_0_0_1px_rgba(167,114,67,0.26)]"
        : "border-[#d6c2a5] bg-white/72 hover:border-[#a77243] hover:bg-[linear-gradient(135deg,rgba(250,240,222,0.9),rgba(244,228,200,0.86))]"
    }`

  return (
    <div className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(circle_at_top,rgba(205,171,127,0.22),rgba(255,255,255,0))]"
      />
      <section className="rounded-sm border border-[#d8c7ab] bg-[linear-gradient(135deg,rgba(255,252,246,0.98),rgba(244,234,217,0.95))] px-4 py-3 shadow-[0_10px_26px_rgba(48,33,18,0.12)] md:px-5 md:py-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-sm border border-[#cda979] bg-[linear-gradient(180deg,rgba(157,106,57,0.12),rgba(123,79,44,0.08))]">
                <FileText className="size-4 text-[#7d3e1d]" />
              </div>
              <div>
                <h1 className="text-2xl font-serif text-[#6f3116]">Informacion</h1>
                <p className="text-xs text-[#6a5642]">
                  Referencias rapidas en una sola pantalla.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <SectionButton
                active={activeSection === "monsters"}
                icon={Swords}
                label="Monstruos"
                onClick={() => setActiveSection("monsters")}
              />
              <SectionButton
                active={activeSection === "conditions"}
                icon={ScrollText}
                label="Condiciones"
                onClick={() => setActiveSection("conditions")}
              />
              <SectionButton
                active={activeSection === "spells"}
                icon={WandSparkles}
                label="Conjuros"
                onClick={() => setActiveSection("spells")}
              />
              <SectionButton
                active={activeSection === "feats"}
                icon={Star}
                label="Dotes"
                onClick={() => setActiveSection("feats")}
              />
              <SectionButton
                active={activeSection === "rules"}
                icon={BookOpen}
                label="Reglas"
                onClick={() => setActiveSection("rules")}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/books"
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#d6c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,240,228,0.88))] px-2.5 py-1.5 text-xs font-medium text-[#5e4937] transition-colors hover:border-[#a97748] hover:text-[#402b1c]"
            >
              <BookMarked className="size-3.5" />
              Libros
            </Link>
            <Link
              href="/paginas"
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#d6c4a7] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,240,228,0.88))] px-2.5 py-1.5 text-xs font-medium text-[#5e4937] transition-colors hover:border-[#a97748] hover:text-[#402b1c]"
            >
              <Link2 className="size-3.5" />
              Paginas
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          className="flex min-h-0 h-[calc(100dvh-15rem)] flex-col overflow-hidden rounded-sm border border-[#d8c7ab] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,222,0.96))] p-4 shadow-[0_12px_26px_rgba(48,33,18,0.12)]"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="mb-4 space-y-3">
            <input
              type="text"
              value={currentQuery}
              onChange={(event) => {
                if (activeSection === "monsters") {
                  setMonsterQuery(event.target.value)
                  return
                }

                if (activeSection === "conditions") {
                  setConditionQuery(event.target.value)
                  return
                }

                if (activeSection === "spells") {
                  setSpellQuery(event.target.value)
                  return
                }

                if (activeSection === "feats") {
                  setFeatQuery(event.target.value)
                  return
                }

                setRuleQuery(event.target.value)
              }}
              placeholder={
                activeSection === "monsters"
                  ? "Buscar monstruo, tipo o CR..."
                  : activeSection === "conditions"
                    ? "Buscar condicion..."
                    : activeSection === "spells"
                      ? "Buscar spell, escuela o nivel..."
                      : activeSection === "feats"
                        ? "Buscar feat, categoria o prerequisito..."
                        : "Buscar regla..."
              }
              className="w-full rounded-sm border border-[#c9b393] bg-white/88 px-3 py-2 text-sm text-[#3b291d] outline-none transition-colors placeholder:text-[#8d755c] focus:border-[#a97748]"
            />
            {activeSection === "monsters" ? (
              <div className="flex items-center gap-1.5">
                <label htmlFor="monster-sort-field" className="sr-only">
                  Orden de monstruos
                </label>
                <select
                  id="monster-sort-field"
                  value={monsterSortField}
                  onChange={(event) => setMonsterSortField(event.target.value as MonsterSortField)}
                  className="h-7 min-w-0 flex-1 rounded-sm border border-[#c9b393] bg-white/88 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a4b31] outline-none"
                >
                  <option value="name">ABC</option>
                  <option value="cr">CR</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setMonsterSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#c9b393] bg-white/88 text-xs font-bold text-[#6a4b31] transition-colors hover:border-[#a77243] hover:text-[#3f2b1d]"
                  title={monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
                  aria-label={monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
                >
                  {monsterSortDirection === "asc" ? "↑" : "↓"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {activeSection === "monsters"
              ? sortedMonsters.map((monster) => {
                  const isActive = selectedMonsterId === monster.id
                  const monsterType = monster.summary.type || "Sin tipo"
                  const monsterCr = monster.summary.cr || "-"
                  const monsterHp = monster.summary.hpAverage ?? "-"

                  return (
                    <button
                      key={monster.id}
                      type="button"
                      onClick={() => setSelectedMonsterId(monster.id)}
                      className={getListItemClassName(isActive)}
                      style={{ borderLeftWidth: 4, borderLeftColor: "#a77243" }}
                    >
                      <p className="font-semibold text-foreground">{monster.summary.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {monsterType} · CR {monsterCr} · HP {monsterHp}
                      </p>
                    </button>
                  )
                })
              : activeSection === "conditions"
                ? filteredConditions.map((condition) => {
                    const isActive = selectedConditionId === condition.id

                    return (
                      <button
                        key={condition.id}
                        type="button"
                        onClick={() => setSelectedConditionId(condition.id)}
                        className={getListItemClassName(isActive)}
                        style={{ borderLeftWidth: 4, borderLeftColor: condition.color }}
                      >
                        <p className="font-semibold text-foreground">{condition.name}</p>
                      </button>
                    )
                  })
                : activeSection === "spells"
                  ? spellsStatus === "loading"
                    ? (
                      <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Cargando spells...
                      </p>
                    )
                    : spellsStatus === "error"
                      ? (
                        <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                          {spellsErrorMessage || "No se pudieron cargar los spells."}
                        </p>
                      )
                      : filteredSpells.map((spellItem) => {
                          const isActive = selectedSpellId === spellItem.id
                          const { spell } = spellItem
                          const tone = getSpellSchoolTone(spell.schoolCode)
                          const schoolLabel = spell.schoolLabel || "Sin escuela"
                          const levelLabel = spell.levelLabel || "-"

                          return (
                            <button
                              key={spellItem.id}
                              type="button"
                              onClick={() => setSelectedSpellId(spellItem.id)}
                              className={getListItemClassName(isActive)}
                              style={{ borderLeftWidth: 4, borderLeftColor: tone.accent }}
                            >
                              <p className="font-semibold text-foreground">{spell.name}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">{schoolLabel} {levelLabel}</span>
                              </p>
                            </button>
                          )
                        })
                  : activeSection === "feats"
                    ? featsStatus === "loading"
                      ? (
                        <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Cargando feats...
                        </p>
                      )
                      : featsStatus === "error"
                        ? (
                          <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                            {featsErrorMessage || "No se pudieron cargar los feats."}
                          </p>
                        )
                        : filteredFeats.map((featItem) => {
                            const isActive = selectedFeatId === featItem.id
                            const { feat } = featItem
                            const tone = getFeatCategoryTone(feat.categoryCode)

                            return (
                              <button
                                key={featItem.id}
                                type="button"
                                onClick={() => setSelectedFeatId(featItem.id)}
                                className={getListItemClassName(isActive)}
                                style={{ borderLeftWidth: 4, borderLeftColor: tone }}
                              >
                                <p className="font-semibold text-foreground">{feat.name}</p>
                                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">{feat.categoryLabel}</span>
                                  {feat.repeatable ? (
                                    <span className="rounded-sm border border-[#d2c2a8] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#6a4b31]">
                                      Repeatable
                                    </span>
                                  ) : null}
                                </p>
                              </button>
                            )
                          })
                    : rulesStatus === "loading"
                      ? (
                        <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Cargando reglas...
                        </p>
                      )
                      : rulesStatus === "error"
                        ? (
                          <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                            {rulesErrorMessage || "No se pudieron cargar las reglas."}
                          </p>
                        )
                        : filteredRules.map((ruleItem) => {
                            const isActive = selectedRuleId === ruleItem.id
                            const { rule } = ruleItem
                            const tone = getRuleTone()

                            return (
                              <button
                                key={ruleItem.id}
                                type="button"
                                onClick={() => setSelectedRuleId(ruleItem.id)}
                                className={getListItemClassName(isActive)}
                                style={{ borderLeftWidth: 4, borderLeftColor: tone }}
                              >
                                <p className="font-semibold text-foreground">{rule.name}</p>
                              </button>
                            )
                          })}

            {activeSection === "monsters" && sortedMonsters.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay monstruos que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "conditions" && filteredConditions.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay condiciones que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "spells" && spellsStatus === "ready" && filteredSpells.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay spells que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "feats" && featsStatus === "ready" && filteredFeats.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay feats que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "rules" && rulesStatus === "ready" && filteredRules.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay reglas que coincidan con esa busqueda.
              </p>
            ) : null}
          </div>
        </aside>

        <div
          className="min-w-0 min-h-0 h-[calc(100dvh-16rem)] overflow-y-auto pr-1"
          style={{ scrollbarGutter: "stable" }}
        >
          {activeSection === "monsters" ? (
            selectedMonster ? (
              <MonsterCard monster={selectedMonsterRecord ?? selectedMonster.record} index={0} embedded />
            ) : (
              <DetailPlaceholder title="Sin monstruo seleccionado" />
            )
          ) : activeSection === "conditions" ? (
            selectedCondition ? (
              <article
                className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
                style={{ borderColor: "#d8c7ab", borderLeftWidth: 6, borderLeftColor: selectedCondition.color }}
              >
                <header className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">
                      Condicion
                    </p>
                    <h2 className="text-3xl font-serif text-[#6f3116]">{selectedCondition.name}</h2>
                  </div>
                  <span
                    className="mt-1 size-4 rounded-full border"
                    style={{ borderColor: "#d7c5a8", backgroundColor: selectedCondition.color }}
                    aria-hidden="true"
                  />
                </header>

                <div
                  className="rounded-sm border p-4"
                  style={{ borderColor: "#d7c5a8", backgroundColor: "rgba(255, 249, 238, 0.74)" }}
                >
                  <div className="space-y-4">
                    {selectedCondition.blocks.map((block, index) => {
                      if (block.kind === "paragraph") {
                        return (
                          <p key={`${selectedCondition.id}-paragraph-${index}`} className="text-sm leading-7 text-[#3b2a1c]">
                            {block.text}
                          </p>
                        )
                      }

                      if (block.kind === "list") {
                        return (
                          <ul key={`${selectedCondition.id}-list-${index}`} className="list-disc space-y-2 pl-5">
                            {block.items.map((item, itemIndex) => (
                              <li key={`${selectedCondition.id}-list-item-${index}-${itemIndex}`} className="text-sm leading-7 text-[#3b2a1c]">
                                {item}
                              </li>
                            ))}
                          </ul>
                        )
                      }

                      return (
                        <div
                          key={`${selectedCondition.id}-table-${index}`}
                          className="overflow-x-auto rounded-sm border"
                          style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(255, 255, 255, 0.72)" }}
                        >
                          <table className="min-w-full text-left text-sm">
                            {block.headers.length > 0 && (
                              <thead className="border-b" style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(125, 62, 29, 0.08)" }}>
                                <tr>
                                  {block.headers.map((header, headerIndex) => (
                                    <th key={`${selectedCondition.id}-table-header-${index}-${headerIndex}`} className="px-3 py-2 font-semibold text-[#352417]">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                            )}
                            <tbody>
                              {block.rows.map((row, rowIndex) => (
                                <tr
                                  key={`${selectedCondition.id}-table-row-${index}-${rowIndex}`}
                                  className="border-b last:border-b-0"
                                  style={{ borderColor: "rgba(125, 62, 29, 0.16)" }}
                                >
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${selectedCondition.id}-table-cell-${index}-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-[#3b2a1c]">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </article>
            ) : (
              <DetailPlaceholder title="Sin condicion seleccionada" />
            )
          ) : activeSection === "spells" ? (
            spellsStatus === "loading" ? (
              <DetailPlaceholder title="Cargando spells..." />
            ) : spellsStatus === "error" ? (
              <div className="rounded-sm border border-destructive/50 bg-card p-6 shadow-sm">
                <h2 className="text-2xl font-serif text-destructive">No se pudieron cargar los spells</h2>
                <p className="mt-2 text-sm text-muted-foreground">{spellsErrorMessage || "Error desconocido."}</p>
              </div>
            ) : selectedSpell ? (
              <SpellCard spell={selectedSpell} />
            ) : (
              <DetailPlaceholder title="Sin spell seleccionado" />
            )
          ) : activeSection === "feats" ? (
            featsStatus === "loading" ? (
              <DetailPlaceholder title="Cargando feats..." />
            ) : featsStatus === "error" ? (
              <div className="rounded-sm border border-destructive/50 bg-card p-6 shadow-sm">
                <h2 className="text-2xl font-serif text-destructive">No se pudieron cargar los feats</h2>
                <p className="mt-2 text-sm text-muted-foreground">{featsErrorMessage || "Error desconocido."}</p>
              </div>
            ) : selectedFeat ? (
              <FeatCard feat={selectedFeat} />
            ) : (
              <DetailPlaceholder title="Sin feat seleccionado" />
            )
          ) : rulesStatus === "loading" ? (
            <DetailPlaceholder title="Cargando reglas..." />
          ) : rulesStatus === "error" ? (
            <div className="rounded-sm border border-destructive/50 bg-card p-6 shadow-sm">
              <h2 className="text-2xl font-serif text-destructive">No se pudieron cargar las reglas</h2>
              <p className="mt-2 text-sm text-muted-foreground">{rulesErrorMessage || "Error desconocido."}</p>
            </div>
          ) : selectedRule ? (
            <RuleCard rule={selectedRule} />
          ) : (
            <DetailPlaceholder title="Sin regla seleccionada" />
          )}
        </div>
      </section>
    </div>
  )
}
