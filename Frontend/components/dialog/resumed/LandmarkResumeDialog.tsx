import { useEffect, useState } from "react"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import {
  ResumeDialogCard,
  ResumeDialogPreviewText,
  ResumeDialogSectionSeparator,
  ResumeDialogTags,
} from "@/components/dialog/shared/resume-card"
import { fetchLandmarkById } from "@/lib/services/landmark-api.service"
import type { Landmark } from "@/lib/types"
import { Castle, TreePine, Mountain, Skull, MapPin, Users, Building2 } from "lucide-react"

interface LandmarkResumeDialogProps {
  landmarkId: number
  className?: string
  onClick?: () => void
  openOnClick?: boolean
}

const iconMap = {
  castle: Castle,
  trees: TreePine,
  mountain: Mountain,
  skull: Skull,
}

export function LandmarkResumeDialog({ landmarkId, className, onClick, openOnClick = true }: LandmarkResumeDialogProps) {
  const [landmark, setLandmark] = useState<Landmark | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    void fetchLandmarkById(landmarkId)
      .then((nextLandmark) => {
        if (isActive) {
          setLandmark(nextLandmark)
        }
      })
      .catch(() => {
        if (isActive) {
          setLandmark(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [landmarkId])

  if (!landmark) return null

  function handleClick() {
    onClick?.()
    if (openOnClick) {
      setIsDetailOpen(true)
    }
  }

  const Icon = iconMap[landmark.icono as keyof typeof iconMap] || MapPin

  return (
    <>
      <ResumeDialogCard className={className} onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
            <Icon className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-bold text-primary leading-tight">
              {landmark.nombre}
            </h3>
            <p className="text-xs capitalize text-muted-foreground">
              {landmark.tipo}
            </p>
          </div>
        </div>

        <ResumeDialogSectionSeparator />

        <div className="space-y-2">
          {landmark.descripcionCorta && (
            <ResumeDialogPreviewText value={landmark.descripcionCorta} />
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {landmark.poblacion && (
              <div className="flex items-center gap-1">
                <Users className="size-3" />
                <span>{landmark.poblacion.toLocaleString()}</span>
              </div>
            )}
            {landmark.edificios && landmark.edificios.length > 0 && (
              <div className="flex items-center gap-1">
                <Building2 className="size-3" />
                <span>{landmark.edificios.length}</span>
              </div>
            )}
          </div>

          <ResumeDialogTags tags={landmark.tags} />
        </div>
      </ResumeDialogCard>

      <LandmarkDetailDialog
        landmarkId={landmark.id}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onLandmarkUpdated={setLandmark}
        onLandmarkDeleted={() => {
          setLandmark(null)
          setIsDetailOpen(false)
        }}
      />
    </>
  )
}
