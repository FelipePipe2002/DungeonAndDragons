import { useEffect, useState } from "react"
import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import {
  ResumeDialogCard,
  ResumeDialogPreviewText,
  ResumeDialogSectionSeparator,
  ResumeDialogTags,
} from "@/components/dialog/shared/resume-card"
import { Badge } from "@/components/ui/badge"
import { fetchCharacterById, fetchCharacterReferences } from "@/lib/services/character-api.service"
import type { Character } from "@/lib/types"
import { User, MapPin } from "lucide-react"

interface CharacterResumeDialogProps {
  characterId: number
  className?: string
  onClick?: () => void
  openOnClick?: boolean
}

export function CharacterResumeDialog({
  characterId,
  className,
  onClick,
  openOnClick = true,
}: CharacterResumeDialogProps) {
  const [character, setCharacter] = useState<Character | null>(null)
  const [storedLandmarks, setStoredLandmarks] = useState<Array<{ id: number; nombre: string }>>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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
        setStoredLandmarks(references.landmarks)
      } catch {
        if (cancelled) return
        setCharacter(null)
        setStoredLandmarks([])
      }
    }

    void loadResumeData()
    return () => {
      cancelled = true
    }
  }, [characterId])

  if (!character) return null

  function handleClick() {
    onClick?.()
    if (openOnClick) {
      setIsDetailOpen(true)
    }
  }

  const traitLine = [character.raza, character.clase]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join(" / ")
  const landmarkName = storedLandmarks.find((landmark) => landmark.id === character.landmarkId)?.nombre ?? null

  return (
    <>
      <ResumeDialogCard className={className} onClick={handleClick}>
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

        <ResumeDialogSectionSeparator />

        <div className="space-y-2">
          {character.descripcion && (
            <ResumeDialogPreviewText value={character.descripcion} />
          )}

          {landmarkName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              <span>{landmarkName}</span>
            </div>
          )}

          <ResumeDialogTags tags={character.tags} />
        </div>
      </ResumeDialogCard>

      <CharacterDetailDialog
        characterId={character.id}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onCharacterUpdated={setCharacter}
        onCharacterDeleted={() => {
          setCharacter(null)
          setIsDetailOpen(false)
        }}
      />
    </>
  )
}
