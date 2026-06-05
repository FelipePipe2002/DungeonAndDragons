"use client"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import { useConditionsSection } from "@/app/informacion/hooks/useConditionsSection"
import type { ConditionEntryBlock } from "@/lib/informacion/types"

function renderConditionBlock(conditionId: string, block: ConditionEntryBlock, index: number) {
  if (block.kind === "paragraph") {
    return (
      <p key={`${conditionId}-paragraph-${index}`} className="text-sm leading-7 text-[#3b2a1c]">
        {block.text}
      </p>
    )
  }

  if (block.kind === "list") {
    return (
      <ul key={`${conditionId}-list-${index}`} className="list-disc space-y-2 pl-5">
        {block.items.map((item, itemIndex) => (
          <li key={`${conditionId}-list-item-${index}-${itemIndex}`} className="text-sm leading-7 text-[#3b2a1c]">
            {item}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div key={`${conditionId}-table-${index}`} className="overflow-x-auto rounded-sm border" style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(255, 255, 255, 0.72)" }}>
      <table className="min-w-full text-left text-sm">
        {block.headers.length > 0 ? (
          <thead className="border-b" style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(125, 62, 29, 0.08)" }}>
            <tr>
              {block.headers.map((header, headerIndex) => (
                <th key={`${conditionId}-table-header-${index}-${headerIndex}`} className="px-3 py-2 font-semibold text-[#352417]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${conditionId}-table-row-${index}-${rowIndex}`} className={rowIndex % 2 === 0 ? "bg-white/60" : "bg-transparent"}>
              {row.map((cell, cellIndex) => (
                <td key={`${conditionId}-table-cell-${index}-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-[#3b2a1c]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ConditionsSection() {
  const conditions = useConditionsSection({ isActive: true })
  const selectedCondition = conditions.selectedCondition

  return (
    <BrowserLayout
      sidebar={
        <BrowserSidebar
          query={conditions.conditionQuery}
          onQueryChange={conditions.setConditionQuery}
          placeholder="Buscar condicion..."
        >
          <BrowserList>
            {conditions.filteredConditions.map((condition) => {
              const isActive = conditions.selectedConditionId === condition.id

              return (
                <BrowserSelectableListItem
                  key={condition.id}
                  onClick={() => conditions.setSelectedConditionId(condition.id)}
                  isActive={isActive}
                  accentColor={condition.color}
                >
                  <p className="font-semibold text-foreground">{condition.name}</p>
                </BrowserSelectableListItem>
              )
            })}
            {conditions.filteredConditions.length === 0 ? (
              <BrowserListMessage>No hay condiciones que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {selectedCondition ? (
            <article
              className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
              style={{ borderColor: "#d8c7ab", borderLeftWidth: 6, borderLeftColor: selectedCondition.color }}
            >
              <header className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">Condicion</p>
                  <h2 className="text-3xl font-serif text-[#6f3116]">{selectedCondition.name}</h2>
                </div>
                <span
                  className="mt-1 size-4 rounded-full border"
                  style={{ borderColor: "#d7c5a8", backgroundColor: selectedCondition.color }}
                  aria-hidden="true"
                />
              </header>
              <div className="rounded-sm border p-4" style={{ borderColor: "#d7c5a8", backgroundColor: "rgba(255, 249, 238, 0.74)" }}>
                <div className="space-y-4">{selectedCondition.blocks.map((block, index) => renderConditionBlock(selectedCondition.id, block, index))}</div>
              </div>
            </article>
          ) : (
            <BrowserEmptyState title="Sin condicion seleccionada" />
          )}
        </BrowserDetailPanel>
      }
    />
  )
}
