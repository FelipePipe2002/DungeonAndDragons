export type MonsterRecord = Record<string, unknown> & {
  name?: string
  shortName?: string
}

export interface MonsterListItem {
  name: string
  nameExact: string
  type: string
  cr: string
  hpAverage: number | null
  initiativeModifier: number
  image: string | null
}

export interface MonsterBatchResponse {
  items: MonsterListItem[]
  hasMore: boolean
  nextOffset: number
  total: number
}

export interface MonsterExactResponse {
  item: MonsterRecord | null
}
