import { useEffect, useMemo, useState } from "react"
import { BuildingDetailDialog } from "@/components/dialog/detailed/BuildingDetailDialog"
import {
  ResumeDialogCard,
  ResumeDialogPreviewText,
  ResumeDialogSectionSeparator,
  ResumeDialogTags,
} from "@/components/dialog/shared/resume-card"
import { fetchBuildingById } from "@/lib/services/building-api.service"
import { fetchLandmarkReferences } from "@/lib/services/landmark-api.service"
import type { Building } from "@/lib/types"
import { Building2, User, MapPin } from "lucide-react"

interface BuildingResumeDialogProps {
  buildingId: number
  className?: string
  onClick?: () => void
  openOnClick?: boolean
}

export function BuildingResumeDialog({
  buildingId,
  className,
  onClick,
  openOnClick = true,
}: BuildingResumeDialogProps) {
  const [storedLandmarks, setStoredLandmarks] = useState<Array<{ id: number; nombre: string }>>([])
  const landmarkNameById = useMemo(
    () => new Map(storedLandmarks.map((landmark) => [landmark.id, landmark.nombre])),
    [storedLandmarks],
  )
  const [building, setBuilding] = useState<Building | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    void fetchBuildingById(buildingId)
      .then((nextBuilding) => {
        if (isActive) {
          setBuilding(nextBuilding)
        }
      })
      .catch(() => {
        if (isActive) {
          setBuilding(null)
        }
      })

    void fetchLandmarkReferences()
      .then((references) => {
        if (isActive) {
          setStoredLandmarks(references)
        }
      })
      .catch(() => {
        if (isActive) {
          setStoredLandmarks([])
        }
      })

    return () => {
      isActive = false
    }
  }, [buildingId])

  if (!building) return null

  function handleClick() {
    onClick?.()
    if (openOnClick) {
      setIsDetailOpen(true)
    }
  }

  const landmarkName = typeof building.landmarkId === "number"
    ? landmarkNameById.get(building.landmarkId)
    : undefined
  return (
    <>
      <ResumeDialogCard className={className} onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-bold text-primary leading-tight">
              {building.nombre}
            </h3>
            {building.duenoNombre && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <User className="size-3" />
                <span>{building.duenoNombre}</span>
              </div>
            )}
          </div>
        </div>

        <ResumeDialogSectionSeparator />

        <div className="space-y-2">
          {building.descripcion && (
            <ResumeDialogPreviewText value={building.descripcion} />
          )}

          {landmarkName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              <span>{landmarkName}</span>
            </div>
          )}

          <ResumeDialogTags tags={building.tags} />
        </div>
      </ResumeDialogCard>

      <BuildingDetailDialog
        buildingId={building.id}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onBuildingUpdated={setBuilding}
        onBuildingDeleted={() => {
          setBuilding(null)
          setIsDetailOpen(false)
        }}
      />
    </>
  )
}
