import type { Feat, FeatBrowserItem, FeatEntryBlock } from "@/lib/informacion/types"

function flattenFeatEntryBlockText(block: FeatEntryBlock): string[] {
  if (block.kind === "paragraph") {
    return [block.name ?? "", block.text].filter(Boolean)
  }

  if (block.kind === "list") {
    return [block.name ?? "", ...block.items].filter(Boolean)
  }

  return [block.name ?? "", block.caption ?? "", ...block.headers, ...block.rows.flat()].filter(Boolean)
}

export function buildFeatSearchText(feat: Feat) {
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

export function buildFeatItems(feats: Feat[]): FeatBrowserItem[] {
  return feats
    .map((feat, index) => ({
      id: `${feat.name.toLocaleLowerCase("es")}::${feat.categoryCode || "?"}::${index}`,
      feat,
      searchText: buildFeatSearchText(feat),
    }))
    .sort((a, b) => a.feat.name.localeCompare(b.feat.name, "es"))
}
