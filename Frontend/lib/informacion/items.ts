import type { Item, ItemBrowserItem, ItemEntryBlock } from "@/lib/informacion/types"

function flattenItemEntryBlockText(block: ItemEntryBlock): string[] {
  if (block.kind === "paragraph") {
    return [block.name ?? "", block.text].filter(Boolean)
  }

  if (block.kind === "list") {
    return [block.name ?? "", ...block.items].filter(Boolean)
  }

  return [block.name ?? "", block.caption ?? "", ...block.headers, ...block.rows.flat()].filter(Boolean)
}

export function buildItemSearchText(item: Item) {
  const chunks = [item.name, item.typeLabel, item.rarityLabel, item.attunement, item.weightLabel, item.valueLabel, ...item.tags, ...item.entries.flatMap((block) => flattenItemEntryBlockText(block))]

  return chunks.join(" ").toLocaleLowerCase("es")
}

export function buildItemItems(items: Item[]): ItemBrowserItem[] {
  return items
    .map((item, index) => ({
      id: `${item.name.toLocaleLowerCase("es")}::${item.typeCode || "item"}::${index}`,
      item,
      searchText: buildItemSearchText(item),
    }))
    .sort((a, b) => a.item.name.localeCompare(b.item.name, "es"))
}
