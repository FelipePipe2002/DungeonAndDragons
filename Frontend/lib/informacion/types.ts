import type { Feat, FeatEntryBlock } from "@/lib/informacion/feats/store"
import type { Item, ItemEntryBlock } from "@/lib/informacion/items/store"
import type { MonsterListItem, MonsterRecord } from "@/lib/monster/types"
import type { Rule, RuleEntryBlock } from "@/lib/informacion/rules/store"
import type { Spell } from "@/lib/informacion/spells/store"

export type InformationSection = "monsters" | "conditions" | "spells" | "items" | "feats" | "rules" | "books" | "pages"

export type MonsterSortField = "name" | "cr"
export type SortDirection = "asc" | "desc"

export type ConditionEntryBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }

export type MonsterBrowserItem = {
  id: string
  record: MonsterRecord
  summary: MonsterListItem
  source: string
}

export type ConditionBrowserItem = {
  id: string
  name: string
  color: string
  blocks: ConditionEntryBlock[]
  searchText: string
}

export type SpellBrowserItem = {
  id: string
  spell: Spell
  searchText: string
}

export type ItemBrowserItem = {
  id: string
  item: Item
  searchText: string
}

export type FeatBrowserItem = {
  id: string
  feat: Feat
  searchText: string
}

export type RuleBrowserItem = {
  id: string
  rule: Rule
  searchText: string
}

export type { Feat, FeatEntryBlock, Item, ItemEntryBlock, MonsterListItem, MonsterRecord, Rule, RuleEntryBlock, Spell }
