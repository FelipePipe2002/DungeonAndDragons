"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Character } from "@/lib/types"
import { ArrowRight, BookOpen, ImageOff, MapPin, Shield } from "lucide-react"

type CharacterCardProps = {
  character: Character
  landmarkName: string
  organizationNames: string[]
  onOpenDetail: (character: Character) => void
  onOpenSheet: (character: Character) => void
}

function CharacterImage({
  imagen,
  nombre,
  size = "md",
}: {
  imagen?: string
  nombre: string
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "h-16 w-12",
    md: "h-52 w-32",
    lg: "h-64 w-40",
  }

  if (imagen) {
    return (
      <div className={`${sizeClasses[size]} overflow-hidden rounded-sm border border-border`}>
        <img src={imagen} alt={nombre} className="size-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} flex flex-col items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground`}
    >
      <ImageOff className="mb-1 size-6 opacity-30" />
      <span className="text-xs uppercase tracking-wider opacity-50">Sin imagen</span>
    </div>
  )
}

export function CharacterCard({
  character,
  landmarkName,
  organizationNames,
  onOpenDetail,
  onOpenSheet,
}: CharacterCardProps) {
  const traitLine = [character.clase, character.raza]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" / ")

  const sheetLabel = character.characterSheet ? "Hoja" : "Crear hoja"

  return (
    <div
      className="parchment group flex cursor-pointer flex-row gap-4 rounded-sm transition-all hover:border-primary/50 hover:shadow-md"
      onClick={() => onOpenDetail(character)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onOpenDetail(character)
        }
      }}
    >
      <div className="shrink-0">
        <CharacterImage imagen={character.imagen} nombre={character.nombre} size="md" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-4 pr-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-lg font-serif leading-tight text-foreground transition-colors group-hover:text-primary">
                {character.nombre}
              </h3>
              {character.isPlayer ? (
                <Badge variant="outline" className="border-primary/30 px-1.5 py-0 text-[10px] text-primary">
                  Jugador
                </Badge>
              ) : null}
            </div>
            {traitLine && <div className="mt-0.5 text-xs text-muted-foreground">{traitLine}</div>}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={(event) => {
                event.stopPropagation()
                onOpenSheet(character)
              }}
            >
              <BookOpen className="size-3" />
              {sheetLabel}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground group-hover:text-primary"
              onClick={(event) => {
                event.stopPropagation()
                onOpenDetail(character)
              }}
            >
              <ArrowRight className="size-4" />
              <span className="sr-only">Ir a {character.nombre}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3 text-primary/50" />
          {landmarkName}
        </div>

        {organizationNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {organizationNames.map((organizationName) => (
              <span
                key={organizationName}
                className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
              >
                <Shield className="size-2.5" />
                {organizationName}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {character.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
              {tag}
            </Badge>
          ))}
        </div>

        {character.eventos.length > 0 && (
          <div className="mt-1 flex items-center gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
            <BookOpen className="size-3" />
            {character.eventos.length} nota{character.eventos.length !== 1 ? "s" : ""} de sesion
          </div>
        )}
      </div>
    </div>
  )
}
