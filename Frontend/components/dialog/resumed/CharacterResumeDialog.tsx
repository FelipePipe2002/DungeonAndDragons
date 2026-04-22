import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MentionField } from "@/components/mentionField/MentionField"
import { Separator } from "@/components/ui/separator"
import { fetchCharacterById, fetchCharacterReferences } from "@/lib/services/character-api.service"
import type { Character } from "@/lib/types"
import { cn } from "@/lib/utils"
import { User, MapPin } from "lucide-react"

interface CharacterResumeDialogProps {
  characterId: number
  className?: string
  onClick?: () => void
}

export function CharacterResumeDialog({
  characterId,
  className,
  onClick,
}: CharacterResumeDialogProps) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [landmarkName, setLandmarkName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadResumeData() {
      try {
        const [nextCharacter, references] = await Promise.all([
          fetchCharacterById(characterId),
          fetchCharacterReferences(),
        ])
        if (cancelled) return

        setCharacter(nextCharacter)
        const nextLandmarkName =
          references.landmarks.find((landmark) => landmark.id === nextCharacter.landmarkId)?.nombre ?? null
        setLandmarkName(nextLandmarkName)
      } catch {
        if (cancelled) return
        setCharacter(null)
        setLandmarkName(null)
      }
    }

    void loadResumeData()
    return () => {
      cancelled = true
    }
  }, [characterId])

  if (!character) return null

  const interactive = typeof onClick === "function"
  const traitLine = [character.raza, character.clase]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join(" / ")

  return (
    <Card
      className={cn(
        "w-80 border-primary/20 bg-background p-4 shadow-lg",
        interactive && "cursor-pointer transition-colors hover:bg-secondary/40",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-primary/30 bg-primary/10">
          {character.imagen ? (
            <img src={character.imagen} alt={character.nombre} className="size-full object-cover" />
          ) : (
            <User className="size-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-serif text-lg font-bold text-primary leading-tight">
              {character.nombre}
            </h3>
            {character.isPlayer ? (
              <Badge variant="outline" className="border-primary/30 px-1.5 py-0 text-[10px] text-primary">
                Jugador
              </Badge>
            ) : null}
          </div>
          {traitLine && <p className="text-xs text-muted-foreground">{traitLine}</p>}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {character.descripcion && (
          <MentionField
            source="auto"
            value={character.descripcion}
            editable={false}
            className="block text-xs leading-relaxed text-foreground/80 line-clamp-3"
          />
        )}

        {landmarkName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            <span>{landmarkName}</span>
          </div>
        )}

        {character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {character.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                {tag}
              </Badge>
            ))}
            {character.tags.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                +{character.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
