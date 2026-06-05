import { useEffect, useState } from "react"
import { OrganizationDetailDialog } from "@/components/dialog/detailed/OrganizationDetailDialog"
import {
  ResumeDialogCard,
  ResumeDialogPreviewText,
  ResumeDialogSectionSeparator,
  ResumeDialogTags,
} from "@/components/dialog/shared/resume-card"
import { fetchOrganizationById } from "@/lib/services/organization-api.service"
import type { Organization } from "@/lib/types"
import { Shield, Users } from "lucide-react"

interface OrganizationResumeDialogProps {
  organizationId: number
  className?: string
  onClick?: () => void
  openOnClick?: boolean
}

export function OrganizationResumeDialog({ organizationId, className, onClick, openOnClick = true }: OrganizationResumeDialogProps) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  function handleClick() {
    onClick?.()
    if (openOnClick) {
      setIsDetailOpen(true)
    }
  }

  return (
    <>
      <ResumeDialogCard className={className} onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border-2 border-primary/30 bg-primary/10">
            {organization.imagen ? (
              <img src={organization.imagen} alt={organization.nombre} className="size-full object-cover" />
            ) : (
              <Shield className="size-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-bold text-primary leading-tight">
              {organization.nombre}
            </h3>
            {organization.categorias.length > 0 && (
              <p className="text-xs capitalize text-muted-foreground">
                {organization.categorias.join(", ")}
              </p>
            )}
          </div>
        </div>

        <ResumeDialogSectionSeparator />

        <div className="space-y-2">
          {organization.descripcion && (
            <ResumeDialogPreviewText value={organization.descripcion} />
          )}

          {organization.miembros.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3" />
              <span>{organization.miembros.length} miembro{organization.miembros.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          <ResumeDialogTags tags={organization.tags} />
        </div>
      </ResumeDialogCard>

      <OrganizationDetailDialog
        organizationId={organization.id}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onOrganizationUpdated={setOrganization}
        onOrganizationDeleted={() => {
          setOrganization(null)
          setIsDetailOpen(false)
        }}
      />
    </>
  )
}
