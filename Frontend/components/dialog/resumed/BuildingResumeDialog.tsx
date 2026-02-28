import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MentionField } from "@/components/mentionField/MentionField"
import { Separator } from "@/components/ui/separator"
import { fetchBuildingById } from "@/lib/services/building-api.service"
import { fetchLandmarkReferences } from "@/lib/services/landmark-api.service"
import type { Building } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Building2, User, MapPin } from "lucide-react"

interface BuildingResumeDialogProps {
  buildingId: number
  className?: string
  onClick?: () => void
}

export function BuildingResumeDialog({
  buildingId,
  className,
  onClick,
}: BuildingResumeDialogProps) {
  const [storedLandmarks, setStoredLandmarks] = useState<Array<{ id: number; nombre: string }>>([])
  const landmarkNameById = useMemo(
    () => new Map(storedLandmarks.map((landmark) => [landmark.id, landmark.nombre])),
    [storedLandmarks],
  )
  const [building, setBuilding] = useState<Building | null>(null)

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

  const landmarkName = typeof building.landmarkId === "number"
    ? landmarkNameById.get(building.landmarkId)
    : undefined
  const interactive = typeof onClick === "function"

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
        <div className="flex size-12 shrink-0 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
          <Building2 className="size-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-bold text-primary leading-tight">
            {building.nombre}
          </h3>
          {building.duenoNombre && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <User className="size-3" />
              <span>{building.duenoNombre}</span>
            </div>
          )}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {building.descripcion && (
          <MentionField
            source="auto"
            value={building.descripcion}
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

        {building.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {building.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                {tag}
              </Badge>
            ))}
            {building.tags.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                +{building.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
