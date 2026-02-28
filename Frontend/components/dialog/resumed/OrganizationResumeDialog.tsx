import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MentionField } from "@/components/mentionField/MentionField"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { fetchOrganizationById } from "@/lib/services/organization-api.service"
import type { Organization } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Shield, Users } from "lucide-react"

interface OrganizationResumeDialogProps {
  organizationId: number
  className?: string
  onClick?: () => void
}

export function OrganizationResumeDialog({ organizationId, className, onClick }: OrganizationResumeDialogProps) {
  const [organization, setOrganization] = useState<Organization | null>(null)

  useEffect(() => {
    let isActive = true

    void fetchOrganizationById(organizationId)
      .then((nextOrganization) => {
        if (isActive) {
          setOrganization(nextOrganization)
        }
      })
      .catch(() => {
        if (isActive) {
          setOrganization(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [organizationId])

  if (!organization) return null

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
        <Avatar className="size-12 border-2 border-primary/30">
          <AvatarImage src={organization.imagen} alt={organization.nombre} />
          <AvatarFallback className="bg-primary/10">
            <Shield className="size-5 text-primary" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg font-bold text-primary leading-tight">
            {organization.nombre}
          </h3>
          {organization.categorias.length > 0 && (
            <p className="text-xs text-muted-foreground capitalize">
              {organization.categorias.join(", ")}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {organization.descripcion && (
          <MentionField
            source="auto"
            value={organization.descripcion}
            editable={false}
            className="block text-xs leading-relaxed text-foreground/80 line-clamp-3"
          />
        )}

        {organization.miembros.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3" />
            <span>{organization.miembros.length} miembro{organization.miembros.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {organization.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {organization.tags.slice(0, 3).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                {tag}
              </Badge>
            ))}
            {organization.tags.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5"
              >
                +{organization.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
