"use client"

import { Suspense, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BookMarked, ExternalLink, Link2, Loader2, Plus, Trash2, Upload } from "lucide-react"

import { BrowserDetailPanel } from "@/components/browser/BrowserDetailPanel"
import { BrowserEmptyState } from "@/components/browser/BrowserEmptyState"
import { BrowserLayout } from "@/components/browser/BrowserLayout"
import { BrowserList } from "@/components/browser/BrowserList"
import { BrowserListPanel } from "@/components/browser/BrowserListPanel"
import { BrowserSearch } from "@/components/browser/BrowserSearch"
import { FeatCard } from "@/components/card/feat-card"
import { ItemCard } from "@/components/card/item-card"
import { RuleCard } from "@/components/card/rule-card"
import { SpellCard } from "@/components/card/spell-card"
import { FrameBypass } from "@/components/frameBypass/FrameBypass"
import MonsterCard from "@/components/monster/monster-card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFeatCategoryTone, getRuleTone, getSpellSchoolTone } from "@/lib/informacion/constants"
import type { InformationSection, MonsterSortField } from "@/lib/informacion/types"
import { getSubnavActiveValue, getSubnavConfig } from "@/lib/navigation/subnav"
import { useBooksSection } from "@/app/informacion/hooks/useBooksSection"
import { useConditionsSection } from "@/app/informacion/hooks/useConditionsSection"
import { useFeatsSection } from "@/app/informacion/hooks/useFeatsSection"
import { useItemsSection } from "@/app/informacion/hooks/useItemsSection"
import { useMonstersSection } from "@/app/informacion/hooks/useMonstersSection"
import { usePagesSection } from "@/app/informacion/hooks/usePagesSection"
import { useRulesSection } from "@/app/informacion/hooks/useRulesSection"
import { useSpellsSection } from "@/app/informacion/hooks/useSpellsSection"

const BOOK_FILE_ACCEPT =
  ".pdf,.epub,.txt,.md,application/pdf,application/epub+zip,text/plain,text/markdown"

function formatByteSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "0 B"
  }

  if (byteSize < 1024) {
    return `${byteSize} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = byteSize / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

function getListItemClassName(isActive: boolean) {
  return `w-full rounded-sm border p-3 text-left transition-colors ${
    isActive
      ? "border-[#a77243] bg-[linear-gradient(135deg,rgba(247,235,213,0.95),rgba(238,219,187,0.9))] shadow-[inset_0_0_0_1px_rgba(167,114,67,0.26)]"
      : "border-[#d6c2a5] bg-white/72 hover:border-[#a77243] hover:bg-[linear-gradient(135deg,rgba(250,240,222,0.9),rgba(244,228,200,0.86))]"
  }`
}

function InformacionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const infoSubnavConfig = getSubnavConfig("/informacion")
  const activeSection = (infoSubnavConfig
    ? getSubnavActiveValue(infoSubnavConfig, searchParams.get("section"))
    : "monsters") as InformationSection

  useEffect(() => {
    if (!infoSubnavConfig) {
      return
    }

    const currentSection = searchParams.get("section")
    const normalizedSection = getSubnavActiveValue(infoSubnavConfig, currentSection)
    if (currentSection === normalizedSection) {
      return
    }

    router.replace(`/informacion?section=${encodeURIComponent(normalizedSection)}`)
  }, [infoSubnavConfig, router, searchParams])

  const monsters = useMonstersSection({ isActive: activeSection === "monsters" })
  const conditions = useConditionsSection({ isActive: activeSection === "conditions" })
  const spells = useSpellsSection({ isActive: activeSection === "spells" })
  const items = useItemsSection({ isActive: activeSection === "items" })
  const feats = useFeatsSection({ isActive: activeSection === "feats" })
  const rules = useRulesSection({ isActive: activeSection === "rules" })
  const books = useBooksSection({ isActive: activeSection === "books" })
  const pages = usePagesSection({ isActive: activeSection === "pages" })

  const currentQuery =
    activeSection === "monsters"
      ? monsters.monsterQuery
      : activeSection === "conditions"
        ? conditions.conditionQuery
        : activeSection === "spells"
          ? spells.spellQuery
          : activeSection === "items"
            ? items.itemQuery
          : activeSection === "feats"
            ? feats.featQuery
            : activeSection === "rules"
              ? rules.ruleQuery
              : activeSection === "books"
                ? books.bookQuery
                : pages.pageQuery

  const queryPlaceholder =
    activeSection === "monsters"
      ? "Buscar monstruo, tipo o CR..."
      : activeSection === "conditions"
        ? "Buscar condicion..."
        : activeSection === "spells"
          ? "Buscar spell, escuela o nivel..."
          : activeSection === "items"
            ? "Buscar item, tipo o rareza..."
          : activeSection === "feats"
            ? "Buscar feat, categoria o prerequisito..."
            : activeSection === "rules"
              ? "Buscar regla..."
              : activeSection === "books"
                ? "Buscar libro..."
                : "Buscar pagina..."

  const handleQueryChange = (value: string) => {
    if (activeSection === "monsters") {
      monsters.setMonsterQuery(value)
      return
    }

    if (activeSection === "conditions") {
      conditions.setConditionQuery(value)
      return
    }

    if (activeSection === "spells") {
      spells.setSpellQuery(value)
      return
    }

    if (activeSection === "items") {
      items.setItemQuery(value)
      return
    }

    if (activeSection === "feats") {
      feats.setFeatQuery(value)
      return
    }

    if (activeSection === "rules") {
      rules.setRuleQuery(value)
      return
    }

    if (activeSection === "books") {
      books.setBookQuery(value)
      return
    }

    pages.setPageQuery(value)
  }

  const sortControls = useMemo(() => {
    if (activeSection !== "monsters") {
      return null
    }

    return (
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
          onClick={() =>
            monsters.setMonsterSortDirection((current) => (current === "asc" ? "desc" : "asc"))
          }
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-[#c9b393] bg-white/88 text-xs font-bold text-[#6a4b31] transition-colors hover:border-[#a77243] hover:text-[#3f2b1d]"
          title={monsters.monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
          aria-label={monsters.monsterSortDirection === "asc" ? "Orden ascendente" : "Orden descendente"}
        >
          {monsters.monsterSortDirection === "asc" ? "↑" : "↓"}
        </button>
      </div>
    )
  }, [activeSection, monsters])

  const uploadPhaseLabel =
    books.uploadProgress?.backendStatus === "completed"
      ? "Completado"
      : books.uploadProgress?.backendStatus === "failed"
        ? "Error"
        : books.uploadProgress?.frontendPercent === 100
          ? "Procesando en backend"
          : "Subiendo al backend"

  const headerActions = useMemo(() => {
    if (activeSection === "books") {
      return (
        <Button
          type="button"
          onClick={() => books.fileInputRef.current?.click()}
          disabled={books.isLoading || books.isUploading || books.isDeleting}
        >
          {books.isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {books.isUploading ? "Cargando..." : "Agregar"}
        </Button>
      )
    }

    if (activeSection === "pages") {
      return (
        <Button onClick={pages.handleOpenDialog} className="gap-2">
          <Plus className="size-4" />
          Agregar
        </Button>
      )
    }

    return null
  }, [activeSection, books, pages])

  return (
    <>
      <input
        ref={books.fileInputRef}
        type="file"
        accept={BOOK_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ""
          books.handleFileChange(file)
        }}
        disabled={books.isUploading || books.isDeleting}
      />
      <BrowserLayout
        sidebar={
          <BrowserListPanel>
            {headerActions ? <div className="mb-3 flex justify-end">{headerActions}</div> : null}
            <BrowserSearch
              value={currentQuery}
              onChange={handleQueryChange}
              placeholder={queryPlaceholder}
              controls={sortControls}
            />
            <BrowserList>
              {activeSection === "monsters"
                ? monsters.sortedMonsters.map((monster) => {
                    const isActive = monsters.selectedMonsterId === monster.id
                    const monsterType = monster.summary.type || "Sin tipo"
                    const monsterCr = monster.summary.cr || "-"
                    const monsterHp = monster.summary.hpAverage ?? "-"

                    return (
                      <button
                        key={monster.id}
                        type="button"
                        onClick={() => monsters.setSelectedMonsterId(monster.id)}
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
                  ? conditions.filteredConditions.map((condition) => {
                      const isActive = conditions.selectedConditionId === condition.id

                      return (
                        <button
                          key={condition.id}
                          type="button"
                          onClick={() => conditions.setSelectedConditionId(condition.id)}
                          className={getListItemClassName(isActive)}
                          style={{ borderLeftWidth: 4, borderLeftColor: condition.color }}
                        >
                          <p className="font-semibold text-foreground">{condition.name}</p>
                        </button>
                      )
                    })
                  : activeSection === "spells"
                    ? spells.spellsStatus === "loading"
                      ? (
                        <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Cargando spells...
                        </p>
                      )
                      : spells.spellsStatus === "error"
                        ? (
                          <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                            {spells.spellsErrorMessage || "No se pudieron cargar los spells."}
                          </p>
                        )
                        : spells.filteredSpells.map((spellItem) => {
                            const isActive = spells.selectedSpellId === spellItem.id
                            const { spell } = spellItem
                            const tone = getSpellSchoolTone(spell.schoolCode)
                            const schoolLabel = spell.schoolLabel || "Sin escuela"
                            const levelLabel = spell.levelLabel || "-"

                            return (
                              <button
                                key={spellItem.id}
                                type="button"
                                onClick={() => spells.setSelectedSpellId(spellItem.id)}
                                className={getListItemClassName(isActive)}
                                style={{ borderLeftWidth: 4, borderLeftColor: tone.accent }}
                              >
                                <p className="font-semibold text-foreground">{spell.name}</p>
                                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground">
                                    {schoolLabel} {levelLabel}
                                  </span>
                                </p>
                              </button>
                            )
                          })
                    : activeSection === "items"
                      ? items.itemsStatus === "loading"
                        ? (
                          <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                            Cargando items...
                          </p>
                        )
                        : items.itemsStatus === "error"
                          ? (
                            <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                              {items.itemsErrorMessage || "No se pudieron cargar los items."}
                            </p>
                          )
                          : items.filteredItems.map((itemEntry) => {
                              const isActive = items.selectedItemId === itemEntry.id
                              const { item } = itemEntry
                              const subtitle = [item.typeLabel, item.rarityLabel].filter(Boolean).join(" · ")

                              return (
                                <button
                                  key={itemEntry.id}
                                  type="button"
                                  onClick={() => {
                                    items.setSelectedItemId(itemEntry.id)
                                  }}
                                  className={getListItemClassName(isActive)}
                                  style={{ borderLeftWidth: 4, borderLeftColor: "#8a5a2b" }}
                                >
                                  <p className="font-semibold text-foreground">{item.name}</p>
                                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <span>{subtitle || "Item"}</span>
                                    {item.attunement ? (
                                      <span className="rounded-sm border border-[#d2c2a8] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#6a4b31]">
                                        Attunement
                                      </span>
                                    ) : null}
                                  </p>
                                </button>
                              )
                            })
                    : activeSection === "feats"
                      ? feats.featsStatus === "loading"
                        ? (
                          <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                            Cargando feats...
                          </p>
                        )
                        : feats.featsStatus === "error"
                          ? (
                            <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                              {feats.featsErrorMessage || "No se pudieron cargar los feats."}
                            </p>
                          )
                          : feats.filteredFeats.map((featItem) => {
                              const isActive = feats.selectedFeatId === featItem.id
                              const { feat } = featItem
                              const tone = getFeatCategoryTone(feat.categoryCode)

                              return (
                                <button
                                  key={featItem.id}
                                  type="button"
                                  onClick={() => feats.setSelectedFeatId(featItem.id)}
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
                      : activeSection === "rules"
                        ? rules.rulesStatus === "loading"
                          ? (
                            <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                              Cargando reglas...
                            </p>
                          )
                          : rules.rulesStatus === "error"
                            ? (
                              <p className="rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive">
                                {rules.rulesErrorMessage || "No se pudieron cargar las reglas."}
                              </p>
                            )
                            : rules.filteredRules.map((ruleItem) => {
                                const isActive = rules.selectedRuleId === ruleItem.id
                                const { rule } = ruleItem
                                const tone = getRuleTone()

                                return (
                                  <button
                                    key={ruleItem.id}
                                    type="button"
                                    onClick={() => rules.setSelectedRuleId(ruleItem.id)}
                                    className={getListItemClassName(isActive)}
                                    style={{ borderLeftWidth: 4, borderLeftColor: tone }}
                                  >
                                    <p className="font-semibold text-foreground">{rule.name}</p>
                                  </button>
                                )
                              })
                        : activeSection === "books"
                          ? books.isLoading
                            ? (
                              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                                Cargando libros...
                              </p>
                            )
                        : books.filteredBooks.map((book) => {
                            const isActive = books.selectedBookId === book.id
                            const isDeletingTarget = books.deleteTargetBook?.id === book.id && books.isDeleting

                            return (
                              <div
                                key={book.id}
                                className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 transition-colors ${
                                  isActive
                                    ? "border-primary/60 bg-primary/5"
                                    : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                                }`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex min-w-0 flex-1 items-center gap-2 px-2"
                                  onClick={() => {
                                    books.setSelectedBookId(book.id)
                                    books.setStatusMessage(null)
                                    books.setErrorMessage(null)
                                  }}
                                >
                                  <BookMarked className="size-4 text-primary" />
                                  <span className="truncate text-sm font-medium">{book.filename}</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  aria-label="Eliminar"
                                  disabled={books.isDeleting}
                                  onClick={() => books.handleDeleteRequest(book.id)}
                                >
                                  {isDeletingTarget ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            )
                          })
                          : pages.isLoading
                            ? (
                              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                                Cargando paginas...
                              </p>
                            )
                            : pages.filteredPages.map((page) => {
                                const isActive = page.id === pages.selectedPageId

                                return (
                                  <div
                                    key={page.id}
                                    className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 transition-colors ${
                                      isActive
                                        ? "border-primary/60 bg-primary/5"
                                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                                    }`}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex min-w-0 flex-1 items-center gap-2 px-2"
                                      onClick={() => pages.setSelectedPageId(page.id)}
                                      onDoubleClick={() => pages.handleStartEdit(page)}
                                      onContextMenu={(event) => {
                                        event.preventDefault()
                                        pages.handleStartEdit(page)
                                      }}
                                      title="Click: abrir | Doble click: editar"
                                    >
                                      <Link2 className="size-4 text-primary" />
                                      <span className="truncate text-sm font-medium">{page.titulo}</span>
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      aria-label="Eliminar"
                                      disabled={pages.isDeletingId === page.id}
                                      onClick={() => pages.handleDeleteRequest(page.id)}
                                    >
                                      {pages.isDeletingId === page.id ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="size-4 text-destructive" />
                                      )}
                                    </Button>
                                  </div>
                                )
                              })}

            {activeSection === "monsters" && monsters.sortedMonsters.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay monstruos que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "conditions" && conditions.filteredConditions.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay condiciones que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "spells" && spells.spellsStatus === "ready" && spells.filteredSpells.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay spells que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "items" && items.itemsStatus === "ready" && items.filteredItems.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay items que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "feats" && feats.featsStatus === "ready" && feats.filteredFeats.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay feats que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "rules" && rules.rulesStatus === "ready" && rules.filteredRules.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay reglas que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "books" && !books.isLoading && books.filteredBooks.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay libros que coincidan con esa busqueda.
              </p>
            ) : null}

            {activeSection === "pages" && !pages.isLoading && pages.filteredPages.length === 0 ? (
              <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
                No hay paginas que coincidan con esa busqueda.
              </p>
            ) : null}
          </BrowserList>
        </BrowserListPanel>
      }
      detail={
        <BrowserDetailPanel>
          {activeSection === "monsters" ? (
            monsters.selectedMonster ? (
              <MonsterCard monster={monsters.selectedMonsterRecord ?? monsters.selectedMonster.record} index={0} embedded />
            ) : (
              <BrowserEmptyState title="Sin monstruo seleccionado" />
            )
          ) : activeSection === "conditions" ? (
            conditions.selectedCondition ? (
              (() => {
                const selectedCondition = conditions.selectedCondition

                return (
              <article
                className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
                style={{
                  borderColor: "#d8c7ab",
                  borderLeftWidth: 6,
                  borderLeftColor: selectedCondition.color,
                }}
              >
                <header className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">Condicion</p>
                    <h2 className="text-3xl font-serif text-[#6f3116]">{selectedCondition.name}</h2>
                  </div>
                  <span
                    className="mt-1 size-4 rounded-full border"
                    style={{
                      borderColor: "#d7c5a8",
                      backgroundColor: selectedCondition.color,
                    }}
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
                              <li
                                key={`${selectedCondition.id}-list-item-${index}-${itemIndex}`}
                                className="text-sm leading-7 text-[#3b2a1c]"
                              >
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
                          style={{
                            borderColor: "rgba(125, 62, 29, 0.18)",
                            background: "rgba(255, 255, 255, 0.72)",
                          }}
                        >
                          <table className="min-w-full text-left text-sm">
                            {block.headers.length > 0 && (
                              <thead
                                className="border-b"
                                style={{
                                  borderColor: "rgba(125, 62, 29, 0.18)",
                                  background: "rgba(125, 62, 29, 0.08)",
                                }}
                              >
                                <tr>
                                  {block.headers.map((header, headerIndex) => (
                                    <th
                                      key={`${selectedCondition.id}-table-header-${index}-${headerIndex}`}
                                      className="px-3 py-2 font-semibold text-[#352417]"
                                    >
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
                                  className={rowIndex % 2 === 0 ? "bg-white/60" : "bg-transparent"}
                                >
                                  {row.map((cell, cellIndex) => (
                                    <td
                                      key={`${selectedCondition.id}-table-cell-${index}-${rowIndex}-${cellIndex}`}
                                      className="px-3 py-2 text-[#3b2a1c]"
                                    >
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
                )
              })()
            ) : (
              <BrowserEmptyState title="Sin condicion seleccionada" />
            )
          ) : activeSection === "spells" ? (
            spells.selectedSpell ? (
              <SpellCard spell={spells.selectedSpell} />
            ) : (
              <BrowserEmptyState title="Sin spell seleccionado" />
            )
          ) : activeSection === "items" ? (
            items.selectedItem ? (
              <ItemCard item={items.selectedItem} />
            ) : (
              <BrowserEmptyState title="Sin item seleccionado" />
            )
          ) : activeSection === "feats" ? (
            feats.selectedFeat ? (
              <FeatCard feat={feats.selectedFeat} />
            ) : (
              <BrowserEmptyState title="Sin feat seleccionado" />
            )
          ) : activeSection === "rules" ? (
            rules.selectedRule ? (
              <RuleCard rule={rules.selectedRule} />
            ) : (
              <BrowserEmptyState title="Sin regla seleccionada" />
            )
          ) : activeSection === "books" ? (
            books.isLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cargando libros...
              </div>
            ) : books.selectedBook ? (
              <>
                {books.uploadProgress ? (
                  <div className="mb-4 rounded-sm border border-border bg-card p-4">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Subida actual</p>
                        <p className="max-w-[720px] truncate text-xs text-muted-foreground">
                          {books.uploadProgress.fileName}
                        </p>
                      </div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Estado: {uploadPhaseLabel}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Frontend</span>
                          <span>
                            {books.uploadProgress.frontendPercent}% · {formatByteSize(books.uploadProgress.frontendUploadedBytes)} /{" "}
                            {formatByteSize(books.uploadProgress.frontendTotalBytes)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-200"
                            style={{ width: `${books.uploadProgress.frontendPercent}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Backend</span>
                          <span>
                            {books.uploadProgress.backendStatus === "awaiting_upload"
                              ? "Esperando recepcion"
                              : `${books.uploadProgress.backendPercent}% · ${formatByteSize(books.uploadProgress.backendProcessedBytes)} / ${formatByteSize(books.uploadProgress.backendTotalBytes ?? 0)}`}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-600 transition-[width] duration-200"
                            style={{
                              width: `${
                                books.uploadProgress.backendStatus === "awaiting_upload" ? 6 : books.uploadProgress.backendPercent
                              }%`,
                            }}
                          />
                        </div>
                        {books.uploadProgress.backendErrorMessage ? (
                          <p className="mt-1 text-xs text-destructive">{books.uploadProgress.backendErrorMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {books.statusMessage ? (
                  <div className="mb-4 rounded-sm border border-emerald-600/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">
                    {books.statusMessage}
                  </div>
                ) : null}

                {books.errorMessage ? (
                  <div className="mb-4 rounded-sm border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {books.errorMessage}
                  </div>
                ) : null}

                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={books.selectedBook.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      Abrir en otra pestana
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>

                <div className="h-[90vh] rounded-sm border border-border bg-card">
                  <iframe
                    key={books.selectedBook.id}
                    src={books.selectedBook.downloadUrl}
                    title={`Lector de ${books.selectedBook.filename}`}
                    className="size-full"
                  />
                </div>
              </>
            ) : (
              <BrowserEmptyState title="Sin libro seleccionado" />
            )
          ) : activeSection === "pages" ? (
            pages.isLoading ? (
              <div className="flex min-h-[70vh] items-center justify-center text-sm text-muted-foreground">
                Cargando pagina...
              </div>
            ) : pages.selectedPage ? (
              <>
                {pages.error && (
                  <p className="mb-4 text-sm text-destructive">{pages.error}</p>
                )}
                <div className="min-h-[70vh] overflow-hidden rounded-sm border border-border bg-card">
                  <FrameBypass
                    src={pages.selectedPage.url}
                    title={pages.selectedPage.titulo}
                    className="min-h-[70vh]"
                  />
                </div>
              </>
            ) : (
              <BrowserEmptyState title="Sin pagina seleccionada" />
            )
          ) : (
            <BrowserEmptyState title="Selecciona una seccion" />
          )}
        </BrowserDetailPanel>
      }
    />
    <ConfirmDialog
      open={books.isDeleteDialogOpen}
      onOpenChange={books.setIsDeleteDialogOpen}
      title="Eliminar libro"
      description={
        books.deleteTargetBook
          ? `Eliminar "${books.deleteTargetBook.filename}"? Esta accion no se puede deshacer.`
          : "Esta accion no se puede deshacer."
      }
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      confirmVariant="destructive"
      onConfirm={books.handleConfirmDelete}
    />
    <Dialog
      open={pages.dialogOpen}
      onOpenChange={(open) => {
        pages.setDialogOpen(open)
        if (!open) pages.resetForm()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pages.editingPageId ? "Editar pagina" : "Agregar pagina"}</DialogTitle>
          <DialogDescription>
            Ingresa un titulo descriptivo y la URL completa. Se abrirá en un iframe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={pages.handleSavePage} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Titulo</Label>
            <Input
              id="titulo"
              value={pages.formTitulo}
              onChange={(event) => pages.setFormTitulo(event.target.value)}
              placeholder="Bestiario"
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              value={pages.formUrl}
              onChange={(event) => pages.setFormUrl(event.target.value)}
              placeholder="https://5e.tools/bestiary.html"
              required
            />
            <p className="text-xs text-muted-foreground">Debe comenzar con http:// o https://</p>
          </div>

          {pages.formError && <p className="text-sm text-destructive">{pages.formError}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => pages.setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pages.isSaving} className="gap-2">
              {pages.isSaving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {pages.isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={pages.deleteTarget !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) pages.setDeleteTarget(null)
      }}
      title="Eliminar pagina"
      description={
        pages.deleteTarget
          ? `Eliminar "${pages.deleteTarget.titulo}"? Esta accion no se puede deshacer.`
          : "Esta accion no se puede deshacer."
      }
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      confirmVariant="destructive"
      onConfirm={pages.handleConfirmDelete}
    />
  </>
  )
}

export default function InformacionPage() {
  return (
    <Suspense fallback={null}>
      <InformacionPageContent />
    </Suspense>
  )
}
