import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MentionField } from "@/components/mentionField/MentionField"
import { Separator } from "@/components/ui/separator"
import { fetchLandmarkById } from "@/lib/services/landmark-api.service"
import type { Landmark } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Castle, TreePine, Mountain, Skull, MapPin, Users, Building2 } from "lucide-react"

interface LandmarkResumeDialogProps {
  landmarkId: number
  className?: string
  onClick?: () => void
}

const iconMap = {
  castle: Castle,
  trees: TreePine,
  mountain: Mountain,
  skull: Skull,
}

export function LandmarkResumeDialog({ landmarkId, className, onClick }: LandmarkResumeDialogProps) {
  const [landmark, setLandmark] = useState<Landmark | null>(null)

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

  const interactive = typeof onClick === "function"
  const Icon = iconMap[landmark.icono as keyof typeof iconMap] || MapPin

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
          <Icon className="size-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-bold text-primary leading-tight">
            {landmark.nombre}
          </h3>
          <p className="text-xs text-muted-foreground capitalize">
            {landmark.tipo}
          </p>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {landmark.descripcionCorta && (
          <MentionField
            source="auto"
            value={landmark.descripcionCorta}
            editable={false}
            className="block text-xs leading-relaxed text-foreground/80 line-clamp-3"
          />
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

        {landmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {landmark.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                {tag}
              </Badge>
            ))}
            {landmark.tags.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                +{landmark.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
