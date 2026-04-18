"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MentionField } from "@/components/mentionField/MentionField"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  CHARACTER_SHEET_ABILITY_SCORES,
  CHARACTER_SHEET_SKILL_ABILITY_SCORES,
  CHARACTER_SHEET_SKILLS,
  type CharacterSheet,
  type CharacterSheetAbilityScore,
  type CharacterSheetSkill,
} from "@/lib/types"
import { createEmptyCharacterSheetDraft, normalizeCharacterSheet } from "@/lib/character-sheet"
import { Plus, Trash2 } from "lucide-react"

interface CharacterSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: CharacterSheet | null
  onSave: (nextSheet: CharacterSheet | null) => void | boolean | Promise<void | boolean>
  characterName: string
  characterRace: string
  characterClass: string
  readOnly?: boolean
}

type CharacterSheetSeed = {
  nombre: string
  raza: string
  clase: string
}

const ABILITY_SCORE_LABELS = {
  str: "FUE",
  dex: "DES",
  con: "CON",
  int: "INT",
  wis: "SAB",
  cha: "CAR",
} satisfies Record<CharacterSheetAbilityScore, string>

const SKILL_LABELS = {
  Athletics: "Atletismo",
  Acrobatics: "Acrobacias",
  "Sleight of Hand": "Juego de manos",
  Stealth: "Sigilo",
  Arcana: "Arcano",
  History: "Historia",
  Investigation: "Investigacion",
  Nature: "Naturaleza",
  Religion: "Religion",
  "Animal Handling": "Trato con animales",
  Insight: "Perspicacia",
  Medicine: "Medicina",
  Perception: "Percepcion",
  Survival: "Supervivencia",
  Deception: "Engano",
  Intimidation: "Intimidacion",
  Performance: "Interpretacion",
  Persuasion: "Persuasion",
} satisfies Record<CharacterSheetSkill, string>

const SORTED_CHARACTER_SHEET_SKILLS = [...CHARACTER_SHEET_SKILLS].sort((left, right) =>
  SKILL_LABELS[left].localeCompare(SKILL_LABELS[right], "es"),
)

function toNumberInputValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

function toInteger(value: string, fallback = 0) {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toOptionalInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringList(value: string) {
  return value.split("\n")
}

function getAbilityModifier(score: number) {
  return Math.floor((score - 10) / 2)
}

function formatSignedValue(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function formatAbilityModifier(score: number) {
  return formatSignedValue(getAbilityModifier(score))
}

function getSavingThrowValue(sheet: CharacterSheet, abilityScore: CharacterSheetAbilityScore) {
  const modifier = getAbilityModifier(sheet.ability_scores[abilityScore].score)
  return modifier + (sheet.ability_scores[abilityScore].saving ? sheet.competence_bonus : 0)
}

function getSkillValue(sheet: CharacterSheet, skill: CharacterSheetSkill) {
  const override = sheet.skills[skill].bonus_override
  if (typeof override === "number") {
    return override
  }

  const abilityScore = CHARACTER_SHEET_SKILL_ABILITY_SCORES[skill]
  const modifier = getAbilityModifier(sheet.ability_scores[abilityScore].score)
  return modifier + (sheet.skills[skill].proficient ? sheet.competence_bonus : 0)
}

function getInitiativeValue(sheet: CharacterSheet) {
  return getAbilityModifier(sheet.ability_scores.dex.score)
}

function getPassivePerceptionValue(sheet: CharacterSheet) {
  return 10 + getAbilityModifier(sheet.ability_scores.wis.score) + sheet.competence_bonus
}

function getArmorClassValue(sheet: CharacterSheet) {
  const dexModifier = getAbilityModifier(sheet.ability_scores.dex.score)
  const hasArmor =
    sheet.armor.name.trim().length > 0 ||
    sheet.armor.ac_bonus > 0 ||
    sheet.armor.dex_bonus ||
    sheet.armor.capped_dex_bonus !== null

  if (!hasArmor) {
    return 10 + dexModifier
  }

  if (!sheet.armor.dex_bonus) {
    return sheet.armor.ac_bonus
  }

  const dexContribution =
    typeof sheet.armor.capped_dex_bonus === "number"
      ? Math.min(dexModifier, sheet.armor.capped_dex_bonus)
      : dexModifier

  return sheet.armor.ac_bonus + dexContribution
}

function createAbilityScoreInputs(sheet: CharacterSheet): Record<CharacterSheetAbilityScore, string> {
  const inputs = {} as Record<CharacterSheetAbilityScore, string>
  for (const abilityScore of CHARACTER_SHEET_ABILITY_SCORES) {
    inputs[abilityScore] = toNumberInputValue(sheet.ability_scores[abilityScore].score)
  }
  return inputs
}

function buildSeed(characterName: string, characterRace: string, characterClass: string): CharacterSheetSeed {
  return {
    nombre: characterName,
    raza: characterRace,
    clase: characterClass,
  }
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b4a2a]">{title}</h3>
        <div className="h-px flex-1 bg-[#d3bea3]" />
      </div>
      {description ? <p className="text-xs text-[#7f6348]">{description}</p> : null}
    </div>
  )
}

function SheetPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`border border-[#c4a27c] bg-[#f5ecde] p-4 ${className}`}
    >
      {children}
    </section>
  )
}

export function CharacterSheetDialog({
  open,
  onOpenChange,
  value,
  onSave,
  characterName,
  characterRace,
  characterClass,
  readOnly = false,
}: CharacterSheetDialogProps) {
  const [draft, setDraft] = useState<CharacterSheet>(() =>
    createEmptyCharacterSheetDraft(buildSeed(characterName, characterRace, characterClass)),
  )
  const [abilityScoreInputs, setAbilityScoreInputs] = useState<Record<CharacterSheetAbilityScore, string>>(() =>
    createAbilityScoreInputs(createEmptyCharacterSheetDraft(buildSeed(characterName, characterRace, characterClass))),
  )
  const [editingSkillOverride, setEditingSkillOverride] = useState<CharacterSheetSkill | null>(null)
  const [skillOverrideInput, setSkillOverrideInput] = useState("")

  useEffect(() => {
    if (!open) return

    const seed = buildSeed(characterName, characterRace, characterClass)
    const nextDraft = normalizeCharacterSheet(value, seed) ?? createEmptyCharacterSheetDraft(seed)
    setDraft(nextDraft)
    setAbilityScoreInputs(createAbilityScoreInputs(nextDraft))
    setEditingSkillOverride(null)
    setSkillOverrideInput("")
  }, [characterClass, characterName, characterRace, open, value])

  const handleSave = async () => {
    const seed = buildSeed(characterName, characterRace, characterClass)
    const nextDraft = {
      ...draft,
      armor_class: {
        ...draft.armor_class,
        value: getArmorClassValue(draft),
      },
    }

    const result = await onSave(normalizeCharacterSheet(nextDraft, seed) ?? createEmptyCharacterSheetDraft(seed))
    if (result !== false) {
      onOpenChange(false)
    }
  }

  const handleClear = async () => {
    const result = await onSave(null)
    if (result !== false) {
      onOpenChange(false)
    }
  }

  const handleAbilityScoreChange = (abilityScore: CharacterSheetAbilityScore, nextValue: string) => {
    setAbilityScoreInputs((prev) => ({
      ...prev,
      [abilityScore]: nextValue,
    }))

    const parsedValue = toOptionalInteger(nextValue)
    if (parsedValue === null) return

    setDraft((prev) => ({
      ...prev,
      ability_scores: {
        ...prev.ability_scores,
        [abilityScore]: {
          ...prev.ability_scores[abilityScore],
          score: parsedValue,
        },
      },
    }))
  }

  const handleAbilityScoreBlur = (abilityScore: CharacterSheetAbilityScore) => {
    setAbilityScoreInputs((prev) => ({
      ...prev,
      [abilityScore]:
        prev[abilityScore].trim().length > 0
          ? prev[abilityScore]
          : toNumberInputValue(draft.ability_scores[abilityScore].score),
    }))
  }

  const handleStartSkillOverrideEdit = (skill: CharacterSheetSkill) => {
    setEditingSkillOverride(skill)
    const override = draft.skills[skill].bonus_override
    setSkillOverrideInput(typeof override === "number" ? String(override) : String(getSkillValue(draft, skill)))
  }

  const handleCommitSkillOverride = () => {
    if (!editingSkillOverride) return

    const trimmed = skillOverrideInput.trim()
    const nextValue = trimmed.length > 0 ? Number.parseInt(trimmed, 10) : null

    setDraft((prev) => ({
      ...prev,
      skills: {
        ...prev.skills,
        [editingSkillOverride]: {
          ...prev.skills[editingSkillOverride],
          bonus_override: Number.isFinite(nextValue) ? nextValue : null,
        },
      },
    }))

    setEditingSkillOverride(null)
    setSkillOverrideInput("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment flex w-[min(97vw,84rem)] max-h-[92dvh] flex-col overflow-hidden border border-[#cdb89a] bg-[#f7efe2] shadow-none">
        <DialogHeader className="border-b border-[#cdb89a] bg-[#f7efe2] p-4">
          <DialogTitle className="font-serif text-xl uppercase tracking-[0.14em] text-[#6b3a1f]">
            Hoja de personaje
          </DialogTitle>
          <DialogDescription className="text-xs text-[#7f6348]">
            {readOnly
              ? "Vista de solo lectura de la hoja de personaje."
              : "Edita la hoja del personaje. Nombre, raza y clase principal se sincronizan con el personaje."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-4" style={{ scrollbarGutter: "stable" }}>
          <fieldset disabled={readOnly} className="space-y-6 pb-6 pt-4 text-[#2f2318]">
            <SheetPanel className="space-y-4">
              <SectionTitle title="Base" />
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_10rem_minmax(0,1.5fr)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nombre</label>
                  <Input value={characterName} readOnly disabled className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Raza</label>
                  <Input value={characterRace} readOnly disabled className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Clase principal</label>
                  <Input value={characterClass} readOnly disabled className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Alineamiento</label>
                  <Input
                    value={draft.alignment}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, alignment: event.target.value }))
                    }
                    className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Trasfondo</label>
                  <Input
                    value={draft.background}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, background: event.target.value }))
                    }
                    className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    Competencia
                  </label>
                  <Input
                    value={toNumberInputValue(draft.competence_bonus)}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        competence_bonus: toInteger(event.target.value),
                      }))
                    }
                    inputMode="numeric"
                    className="h-9 rounded-none border-[#b58a5d] bg-[#fffaf2] text-center font-semibold"
                  />
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    CA
                  </label>
                   <div className="flex h-9 items-center justify-center border border-[#b58a5d] bg-[#fffaf2] px-3 text-sm font-semibold text-foreground">
                    {getArmorClassValue(draft)}
                  </div>
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    Iniciativa
                  </label>
                   <div className="flex h-9 items-center justify-center border border-[#b58a5d] bg-[#fffaf2] px-3 text-sm font-semibold text-foreground">
                    {formatSignedValue(getInitiativeValue(draft))}
                  </div>
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    PG Max
                  </label>
                  <Input
                    value={toNumberInputValue(draft.hit_points.max)}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        hit_points: {
                          ...prev.hit_points,
                          max: toInteger(event.target.value),
                        },
                      }))
                    }
                    inputMode="numeric"
                    className="h-9 rounded-none border-[#b58a5d] bg-[#fffaf2] text-center font-semibold"
                  />
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    PG Act
                  </label>
                  <Input
                    value={toNumberInputValue(draft.hit_points.current)}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        hit_points: {
                          ...prev.hit_points,
                          current: toInteger(event.target.value),
                        },
                      }))
                    }
                    inputMode="numeric"
                    className="h-9 rounded-none border-[#b58a5d] bg-[#fffaf2] text-center font-semibold"
                  />
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    Percepcion pasiva
                  </label>
                   <div className="flex h-9 items-center justify-center border border-[#b58a5d] bg-[#fffaf2] px-3 text-sm font-semibold text-foreground">
                    {getPassivePerceptionValue(draft)}
                  </div>
                </div>
                <div className="">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#7f6348]">
                    Velocidad
                  </label>
                  <Input
                    value={toNumberInputValue(draft.speed)}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        speed: toInteger(event.target.value, 30),
                      }))
                    }
                    inputMode="numeric"
                    className="h-9 rounded-none border-[#b58a5d] bg-[#fffaf2] text-center font-semibold"
                  />
                </div>
              </div>
            </SheetPanel>

            <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1.18fr)_minmax(0,0.92fr)] xl:items-start">
              <div className="space-y-6">
                <SheetPanel className="space-y-3">
                  <SectionTitle title="Atributos" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                    {CHARACTER_SHEET_ABILITY_SCORES.map((abilityScore) => (
                      <div
                        key={abilityScore}
                        className="flex min-h-[6.5rem] flex-col border border-[#be9a70] bg-[#fbf5ea] p-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#934f24]">
                            {ABILITY_SCORE_LABELS[abilityScore]}
                          </span>
                          <Checkbox
                            checked={draft.ability_scores[abilityScore].saving}
                            onCheckedChange={(value) =>
                              setDraft((prev) => ({
                                ...prev,
                                ability_scores: {
                                  ...prev.ability_scores,
                                  [abilityScore]: {
                                    ...prev.ability_scores[abilityScore],
                                    saving: value === true,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-1 flex-col items-center justify-center gap-2">
                          <Input
                            value={abilityScoreInputs[abilityScore]}
                            onChange={(event) => handleAbilityScoreChange(abilityScore, event.target.value)}
                            onBlur={() => handleAbilityScoreBlur(abilityScore)}
                            inputMode="numeric"
                            className="h-10 rounded-none border-[#b58a5d] bg-[#fffaf2] px-2 text-center text-base font-semibold"
                          />
                          <div className="grid w-full grid-cols-2 gap-2 text-center">
                            <div className="bg-[#efe5d7] px-1.5 py-1">
                              <div className="text-[10px] uppercase tracking-wide text-[#7f6348]">Mod.</div>
                              <div className="text-sm font-medium text-foreground">
                                {formatAbilityModifier(draft.ability_scores[abilityScore].score)}
                              </div>
                            </div>
                            <div className="bg-[#efe5d7] px-1.5 py-1">
                              <div className="text-[10px] uppercase tracking-wide text-[#7f6348]">Salv.</div>
                              <div className="text-sm font-medium text-foreground">
                                {formatSignedValue(getSavingThrowValue(draft, abilityScore))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SheetPanel>

                <SheetPanel className="space-y-3">
                  <SectionTitle title="Habilidades" />
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {SORTED_CHARACTER_SHEET_SKILLS.map((skill) => (
                      <div
                        key={skill}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[#d7c5af] px-1 py-1.5"
                      >
                        <span className="min-w-0" title={SKILL_LABELS[skill]}>
                          <span className="block truncate text-xs font-medium text-foreground">{SKILL_LABELS[skill]}</span>
                          <span className="block text-[10px] uppercase tracking-wide text-[#7f6348]">
                            {ABILITY_SCORE_LABELS[CHARACTER_SHEET_SKILL_ABILITY_SCORES[skill]]}
                          </span>
                        </span>
                        {editingSkillOverride === skill ? (
                          <Input
                            value={skillOverrideInput}
                            onChange={(event) => setSkillOverrideInput(event.target.value)}
                            onBlur={handleCommitSkillOverride}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                handleCommitSkillOverride()
                              }
                              if (event.key === "Escape") {
                                setEditingSkillOverride(null)
                                setSkillOverrideInput("")
                              }
                            }}
                            inputMode="numeric"
                            autoFocus
                            className="h-7 w-[3.25rem] rounded-none border-[#c6aa84] bg-[#fffaf2] px-1 text-right text-sm font-medium"
                          />
                        ) : (
                          <button
                            type="button"
                            className="min-w-[3.25rem] text-right text-sm font-medium text-foreground"
                            onDoubleClick={() => handleStartSkillOverrideEdit(skill)}
                            title="Doble click para ajustar manualmente"
                          >
                            {formatSignedValue(getSkillValue(draft, skill))}
                          </button>
                        )}
                        <Checkbox
                          checked={draft.skills[skill].proficient}
                          onCheckedChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              skills: {
                                ...prev.skills,
                                [skill]: {
                                  ...prev.skills[skill],
                                  proficient: value === true,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </SheetPanel>
              </div>

              <div className="space-y-6">
                <SheetPanel className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle title="Clases" description="La primera clase usa siempre el campo principal del personaje." />
                    <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none border-[#b58a5d] bg-[#fffaf2] text-[#6b3a1f] hover:bg-[#f2e6d4]"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      classes: [
                        ...prev.classes,
                        {
                          name: "",
                          subtype: "",
                          level: 1,
                          hit_die: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 size-3.5" />
                  Multiclase
                </Button>
              </div>
              <div className="space-y-2">
                {draft.classes.map((sheetClass, index) => (
                   <div
                     key={`class-${index}`}
                     className="bg-transparent p-0"
                   >
                     <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_6.5rem_6.5rem_auto]">
                      <Input
                        value={index === 0 ? characterClass : sheetClass.name}
                        readOnly={index === 0}
                        disabled={index === 0}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            classes: prev.classes.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, name: event.target.value } : entry,
                            ),
                          }))
                        }
                          className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                      />
                      <Input
                        value={sheetClass.subtype ?? ""}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            classes: prev.classes.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, subtype: event.target.value } : entry,
                            ),
                          }))
                        }
                          className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Subclase"
                      />
                      <Input
                        value={toNumberInputValue(sheetClass.level)}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            classes: prev.classes.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, level: toInteger(event.target.value, 1) }
                                : entry,
                            ),
                          }))
                        }
                        inputMode="numeric"
                          className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Nivel"
                      />
                      <Input
                        value={sheetClass.hit_die}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            classes: prev.classes.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, hit_die: event.target.value }
                                : entry,
                            ),
                          }))
                        }
                          className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="d8"
                      />
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              classes: prev.classes.filter((_, entryIndex) => entryIndex !== index),
                            }))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <div />
                      )}
                    </div>
                  </div>
                ))}
              </div>
                </SheetPanel>

                <SheetPanel className="space-y-3">
                  <SectionTitle title="Armadura" />
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_7rem_7rem]">
                <Input
                  value={draft.armor.name}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      armor: {
                        ...prev.armor,
                        name: event.target.value,
                      },
                    }))
                  }
                  className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm md:col-span-1"
                  placeholder="Nombre de armadura"
                />
                <Input
                  value={toNumberInputValue(draft.armor.ac_bonus)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      armor: {
                        ...prev.armor,
                        ac_bonus: toInteger(event.target.value),
                      },
                    }))
                  }
                  inputMode="numeric"
                  className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                  placeholder="Bono CA"
                />
                <Input
                  value={toNumberInputValue(draft.armor.capped_dex_bonus)}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      armor: {
                        ...prev.armor,
                        capped_dex_bonus: event.target.value.trim()
                          ? toInteger(event.target.value)
                          : null,
                      },
                    }))
                  }
                  inputMode="numeric"
                  className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                  placeholder="Tope DES"
                />
                 <div className="flex flex-wrap items-center gap-3 px-1 py-1 md:col-span-3">
                   <label className="flex items-center gap-2 text-xs text-foreground">
                     <Checkbox
                      checked={draft.armor.dex_bonus}
                      onCheckedChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          armor: {
                            ...prev.armor,
                            dex_bonus: value === true,
                          },
                        }))
                      }
                    />
                     Bono DES
                   </label>
                   <label className="flex items-center gap-2 text-xs text-foreground">
                    <Checkbox
                      checked={draft.armor.stealth_disadvantage}
                      onCheckedChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          armor: {
                            ...prev.armor,
                            stealth_disadvantage: value === true,
                          },
                        }))
                      }
                    />
                     Desv. Sigilo
                   </label>
                 </div>
               </div>
                </SheetPanel>

                <SheetPanel className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle title="Armas" />
                    <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none border-[#b58a5d] bg-[#fffaf2] text-[#6b3a1f] hover:bg-[#f2e6d4]"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      weapons: [
                        ...prev.weapons,
                        {
                          name: "",
                          damage: "",
                          damage_type: "",
                          properties: [],
                          mastery: false,
                          mastery_description: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 size-3.5" />
                  Agregar
                </Button>
              </div>
              <div className="space-y-3">
                {draft.weapons.length === 0 ? (
                  <p className="text-xs text-[#7f6348]">Sin armas cargadas.</p>
                ) : null}
                {draft.weapons.map((weapon, index) => (
                   <div
                     key={`weapon-${index}`}
                     className="space-y-2 border-t border-[#d7c5af] pt-2"
                   >
                     <div className="grid gap-2 md:grid-cols-[minmax(0,1.15fr)_7rem_8rem_auto]">
                      <Input
                        value={weapon.name}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            weapons: prev.weapons.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, name: event.target.value } : entry,
                            ),
                          }))
                        }
                        className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Nombre"
                      />
                      <Input
                        value={weapon.damage}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            weapons: prev.weapons.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, damage: event.target.value } : entry,
                            ),
                          }))
                        }
                        className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Danio"
                      />
                      <Input
                        value={weapon.damage_type}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            weapons: prev.weapons.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, damage_type: event.target.value }
                                : entry,
                            ),
                          }))
                        }
                        className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Tipo"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            weapons: prev.weapons.filter((_, entryIndex) => entryIndex !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                     <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        value={weapon.properties.join(",")}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            weapons: prev.weapons.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    properties: event.target.value.split(","),
                                  }
                                : entry,
                            ),
                          }))
                        }
                        className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                        placeholder="Propiedades (separadas por coma)"
                      />
                        <label className="flex items-center gap-2 px-3 text-xs text-foreground">
                        <Checkbox
                          checked={weapon.mastery}
                          onCheckedChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              weapons: prev.weapons.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, mastery: value === true }
                                  : entry,
                              ),
                            }))
                          }
                        />
                        Maestria
                      </label>
                    </div>
                    <Input
                      value={weapon.mastery_description ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          weapons: prev.weapons.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, mastery_description: event.target.value }
                              : entry,
                          ),
                        }))
                      }
                      className="h-9 rounded-none border-[#c6aa84] bg-[#fffaf2] px-2.5 text-sm"
                      placeholder="Descripcion de maestria"
                    />
                  </div>
                ))}
              </div>
                </SheetPanel>
              </div>

              <div className="space-y-6">
                <SheetPanel className="space-y-3">
                  <SectionTitle title="Detalles" />
                  <div className="grid gap-3 xl:grid-cols-1">
                <Textarea
                  value={draft.details.personality}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      details: {
                        ...prev.details,
                        personality: event.target.value,
                      },
                    }))
                  }
                  placeholder="Personalidad"
                  rows={3}
                   className="rounded-none border-[#c6aa84] bg-[#fffaf2] text-[#2f2318]"
                />
                <Textarea
                  value={draft.details.ideal}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      details: {
                        ...prev.details,
                        ideal: event.target.value,
                      },
                    }))
                  }
                  placeholder="Ideal"
                  rows={3}
                   className="rounded-none border-[#c6aa84] bg-[#fffaf2] text-[#2f2318]"
                />
                <Textarea
                  value={draft.details.bond}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      details: {
                        ...prev.details,
                        bond: event.target.value,
                      },
                    }))
                  }
                  placeholder="Vinculo"
                  rows={3}
                   className="rounded-none border-[#c6aa84] bg-[#fffaf2] text-[#2f2318]"
                />
                <Textarea
                  value={draft.details.flaw}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      details: {
                        ...prev.details,
                        flaw: event.target.value,
                      },
                    }))
                  }
                  placeholder="Defecto"
                  rows={3}
                   className="rounded-none border-[#c6aa84] bg-[#fffaf2] text-[#2f2318]"
                />
              </div>
                </SheetPanel>

                <SheetPanel className="space-y-3">
                  <SectionTitle title="Listas" description="Una entrada por linea." />
                  <div className="grid gap-3 xl:grid-cols-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Idiomas</label>
                  <Textarea
                    value={draft.languages.join("\n")}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        languages: toStringList(event.target.value),
                      }))
                    }
                    rows={6}
                     className="rounded-none border-[#cdb89a] bg-[#fffaf2] text-[#2f2318]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Competencias</label>
                  <Textarea
                    value={draft.competences.join("\n")}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        competences: toStringList(event.target.value),
                      }))
                    }
                    rows={6}
                     className="rounded-none border-[#cdb89a] bg-[#fffaf2] text-[#2f2318]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Inventario</label>
                  <MentionField
                    source="auto"
                    value={draft.inventory.join("\n")}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        inventory: toStringList(value),
                      }))
                    }
                    placeholder="Una entrada por linea. Usa @ para mencionar items."
                    rows={6}
                    className="rounded-none border-[#cdb89a] bg-[#fffaf2] text-[#2f2318]"
                  />
                </div>
              </div>
                </SheetPanel>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#c6aa84] px-1 pb-1 pt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-[#b58a5d] bg-[#fffaf2] text-[#6b3a1f] hover:bg-[#f2e6d4]"
              onClick={() => onOpenChange(false)}
            >
            {readOnly ? "Cerrar" : "Cancelar"}
          </Button>
          {!readOnly ? (
            <div className="flex items-center gap-2">
              {value ? (
                <Button type="button" variant="destructive" className="rounded-none bg-[#9b4d32] hover:bg-[#843f28]" onClick={handleClear}>
                  Quitar hoja
                </Button>
              ) : null}
              <Button type="button" className="rounded-none bg-[#6b3a1f] text-[#fff7ec] hover:bg-[#552d18]" onClick={handleSave}>
                Guardar hoja
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
