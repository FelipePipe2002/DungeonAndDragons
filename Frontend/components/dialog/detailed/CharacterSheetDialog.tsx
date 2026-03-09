"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  const abilityScore = CHARACTER_SHEET_SKILL_ABILITY_SCORES[skill]
  const modifier = getAbilityModifier(sheet.ability_scores[abilityScore].score)
  return modifier + (sheet.skills[skill] ? sheet.competence_bonus : 0)
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
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
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

  useEffect(() => {
    if (!open) return

    const seed = buildSeed(characterName, characterRace, characterClass)
    const nextDraft = normalizeCharacterSheet(value, seed) ?? createEmptyCharacterSheetDraft(seed)
    setDraft(nextDraft)
    setAbilityScoreInputs(createAbilityScoreInputs(nextDraft))
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="parchment w-[min(96vw,72rem)] max-h-[92dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary">Hoja de personaje</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {readOnly
              ? "Vista de solo lectura de la hoja de personaje."
              : "Edita la hoja del personaje. Nombre, raza y clase principal se sincronizan con el personaje."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh] pr-4">
          <fieldset disabled={readOnly} className="space-y-6">
            <section className="space-y-3">
              <SectionTitle title="Base" />
              <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_10rem_minmax(0,1.5fr)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nombre</label>
                  <Input value={characterName} readOnly disabled className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Raza</label>
                  <Input value={characterRace} readOnly disabled className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Clase principal</label>
                  <Input value={characterClass} readOnly disabled className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Alineamiento</label>
                  <Input
                    value={draft.alignment}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, alignment: event.target.value }))
                    }
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Trasfondo</label>
                  <Input
                    value={draft.background}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, background: event.target.value }))
                    }
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="h-9 text-center font-semibold"
                  />
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    CA
                  </label>
                  <div className="flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground">
                    {getArmorClassValue(draft)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Iniciativa
                  </label>
                  <div className="flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground">
                    {formatSignedValue(getInitiativeValue(draft))}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="h-9 text-center font-semibold"
                  />
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="h-9 text-center font-semibold"
                  />
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Percepcion pasiva
                  </label>
                  <div className="flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground">
                    {getPassivePerceptionValue(draft)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    className="h-9 text-center font-semibold"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle title="Clases" description="La primera clase usa siempre el campo principal del personaje." />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                    className="rounded-md border border-border/60 bg-background/60 p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[1.4fr_1.2fr_110px_110px_auto]">
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
                        className="h-9"
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
                        className="h-9"
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
                        className="h-9"
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
                        className="h-9"
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
            </section>

            <section className="space-y-3">
              <SectionTitle title="Atributos" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {CHARACTER_SHEET_ABILITY_SCORES.map((abilityScore) => (
                  <div
                    key={abilityScore}
                    className="flex aspect-square min-h-[8rem] flex-col rounded-md border border-border/60 bg-background/60 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
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
                        className="h-10 text-center text-lg font-semibold"
                      />
                      <div className="grid w-full grid-cols-2 gap-2 text-center">
                        <div className="rounded-sm bg-muted/40 px-2 py-1">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Mod.</div>
                          <div className="text-sm font-medium text-foreground">
                            {formatAbilityModifier(draft.ability_scores[abilityScore].score)}
                          </div>
                        </div>
                        <div className="rounded-sm bg-muted/40 px-2 py-1">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Salv.</div>
                          <div className="text-sm font-medium text-foreground">
                            {formatSignedValue(getSavingThrowValue(draft, abilityScore))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle title="Habilidades" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {SORTED_CHARACTER_SHEET_SKILLS.map((skill) => (
                  <div
                    key={skill}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-2"
                  >
                    <span className="min-w-0" title={SKILL_LABELS[skill]}>
                      <span className="block truncate text-xs font-medium text-foreground">{SKILL_LABELS[skill]}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ABILITY_SCORE_LABELS[CHARACTER_SHEET_SKILL_ABILITY_SCORES[skill]]}
                      </span>
                    </span>
                    <span className="min-w-[2.25rem] text-right text-sm font-medium text-foreground">
                      {formatSignedValue(getSkillValue(draft, skill))}
                    </span>
                    <Checkbox
                      checked={draft.skills[skill]}
                      onCheckedChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          skills: {
                            ...prev.skills,
                            [skill]: value === true,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle title="Armadura" />
              <div className="grid gap-3 md:grid-cols-5">
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
                  className="h-9 md:col-span-2"
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
                  className="h-9"
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
                  className="h-9"
                  placeholder="Tope DES"
                />
                <div className="flex items-center gap-4 rounded-md border border-border/60 bg-background/60 px-3">
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
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle title="Armas" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
                  <p className="text-xs text-muted-foreground">Sin armas cargadas.</p>
                ) : null}
                {draft.weapons.map((weapon, index) => (
                  <div
                    key={`weapon-${index}`}
                    className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-[1.2fr_120px_140px_auto]">
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
                        className="h-9"
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
                        className="h-9"
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
                        className="h-9"
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
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
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
                        className="h-9"
                        placeholder="Propiedades (separadas por coma)"
                      />
                      <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 text-xs text-foreground">
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
                      className="h-9"
                      placeholder="Descripcion de maestria"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle title="Detalles" />
              <div className="grid gap-3 md:grid-cols-2">
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
                />
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle title="Listas" description="Una entrada por linea." />
              <div className="grid gap-3 md:grid-cols-3">
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
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Inventario</label>
                  <Textarea
                    value={draft.inventory.join("\n")}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        inventory: toStringList(event.target.value),
                      }))
                    }
                    rows={6}
                  />
                </div>
              </div>
            </section>
          </fieldset>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Cerrar" : "Cancelar"}
          </Button>
          {!readOnly ? (
            <div className="flex items-center gap-2">
              {value ? (
                <Button type="button" variant="destructive" onClick={handleClear}>
                  Quitar hoja
                </Button>
              ) : null}
              <Button type="button" onClick={handleSave}>
                Guardar hoja
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
