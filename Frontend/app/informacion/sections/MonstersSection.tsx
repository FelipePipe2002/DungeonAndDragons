"use client"

import { useMemo } from "react"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListMessage } from "@/components/browser/BrowserListMessage"
import { BrowserSelectableListItem } from "@/components/browser/BrowserSelectableListItem"
import { BrowserSidebar } from "@/components/browser/BrowserSidebar"
import MonsterCard from "@/components/monster/monster-card"
import { useMonstersSection } from "@/app/informacion/hooks/useMonstersSection"
import type { MonsterSortField } from "@/lib/informacion/types"

export default function MonstersSection() {
  const monsters = useMonstersSection({ isActive: true })

  const sortControls = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        <label htmlFor="monster-sort-field" className="sr-only">
          Orden de monstruos
        </label>
        <select
          id="monster-sort-field"
          value={monsters.monsterSortField}
          onChange={(event) => monsters.setMonsterSortField(event.target.value as MonsterSortField)}
          className="h-7 min-w-0 flex-1 rounded-sm border border-[#c9b393] bg-white/88 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a4b31] outline-none"
        >
          <option value="name">ABC</option>
          <option value="cr">CR</option>
        </select>
        <button
          type="button"
          onClick={() => monsters.setMonsterSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#c9b393] bg-white/88 text-xs font-bold text-[#6a4b31] transition-colors hover:border-[#a77243] hover:text-[#3f2b1d]"
          title={monsters.monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
          aria-label={monsters.monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
        >
          {monsters.monsterSortDirection === "asc" ? "↑" : "↓"}
        </button>
      </div>
    ),
    [monsters],
  )

  return (
      <BrowserLayout
        sidebar={
        <BrowserSidebar
          query={monsters.monsterQuery}
          onQueryChange={monsters.setMonsterQuery}
          placeholder="Buscar monstruo, tipo o CR..."
          controls={sortControls}
        >
          <BrowserList>
            {monsters.sortedMonsters.map((monster) => {
              const isActive = monsters.selectedMonsterId === monster.id
              const monsterType = monster.summary.type || "Sin tipo"
              const monsterCr = monster.summary.cr || "-"
              const monsterHp = monster.summary.hpAverage ?? "-"

              return (
                <BrowserSelectableListItem
                  key={monster.id}
                  onClick={() => monsters.setSelectedMonsterId(monster.id)}
                  isActive={isActive}
                  accentColor="#a77243"
                >
                  <p className="font-semibold text-foreground">{monster.summary.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {monsterType} · CR {monsterCr} · HP {monsterHp}
                  </p>
                </BrowserSelectableListItem>
              )
            })}
            {monsters.sortedMonsters.length === 0 ? (
              <BrowserListMessage>No hay monstruos que coincidan con esa busqueda.</BrowserListMessage>
            ) : null}
          </BrowserList>
        </BrowserSidebar>
      }
      detail={
        <BrowserDetailPanel>
          {monsters.selectedMonster ? (
            <MonsterCard monster={monsters.selectedMonsterRecord ?? monsters.selectedMonster.record} index={0} embedded />
          ) : (
            <BrowserEmptyState title="Sin monstruo seleccionado" />
          )}
        </BrowserDetailPanel>
      }
    />
  )
}
