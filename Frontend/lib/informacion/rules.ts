import type { Rule, RuleBrowserItem, RuleEntryBlock } from "@/lib/informacion/types"

function flattenRuleEntryBlockText(block: RuleEntryBlock): string[] {
  if (block.kind === "paragraph") {
    return [block.name ?? "", block.text].filter(Boolean)
  }

  if (block.kind === "list") {
    return [block.name ?? "", ...block.items.flatMap((item) => [item.name ?? "", item.text])].filter(Boolean)
  }

  return [block.name ?? "", block.caption ?? "", ...block.headers, ...block.rows.flat()].filter(Boolean)
}

export function buildRuleSearchText(rule: Rule) {
  const chunks = [rule.name, ...rule.entries.flatMap((block) => flattenRuleEntryBlockText(block))]

  return chunks.join(" ").toLocaleLowerCase("es")
}

export function buildRuleItems(rules: Rule[]): RuleBrowserItem[] {
  return rules
    .map((rule, index) => ({
      id: `${rule.name.toLocaleLowerCase("es")}::${index}`,
      rule,
      searchText: buildRuleSearchText(rule),
    }))
    .sort((a, b) => a.rule.name.localeCompare(b.rule.name, "es"))
}
