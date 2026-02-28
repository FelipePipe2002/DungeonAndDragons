"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ImageEmbeddingPicker } from "@/components/media/ImageEmbeddingPicker"
import { MentionField } from "@/components/mentionField/MentionField"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  fetchCharacterReferences,
  fetchCharacters,
  type CharacterLandmarkReference,
} from "@/lib/services/character-api.service"
import { fetchBuildings } from "@/lib/services/building-api.service"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizationById,
  updateOrganization,
} from "@/lib/services/organization-api.service"
import type { Building, Character, Organization, OrganizationMember } from "@/lib/types"
import { Building2, Crown, MapPin, Pencil, Save, Search, Trash2, Users, X } from "lucide-react"

interface OrganizationDetailDialogProps {
  organizationId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  resolveBuildingName?: (buildingId: number) => string
  resolveLandmarkName?: (landmarkId: number) => string
  onOrganizationUpdated?: (organization: Organization) => void
  onOrganizationDeleted?: (organizationId: number) => void
  initialLandmarkId?: number
}

type OrganizationFormState = {
  nombre: string
  descripcion: string
  imagen: string
  imagenAssetId: number | null
  categorias: string
  tags: string
  landmarks: number[]
  edificios: number[]
  miembros: OrganizationMember[]
}

const EMPTY_ORGANIZATION_FORM_STATE: OrganizationFormState = {
  nombre: "",
  descripcion: "",
  imagen: "",
  imagenAssetId: null,
  categorias: "",
  tags: "",
  landmarks: [],
  edificios: [],
  miembros: [],
}

const RELATION_IDS_PER_PAGE = 6
const RELATION_MEMBERS_PER_PAGE = 4

function toOrganizationFormState(organization: Organization): OrganizationFormState {
  return {
    nombre: organization.nombre,
    descripcion: organization.descripcion,
    imagen: organization.imagen ?? "",
    imagenAssetId: organization.imagenAssetId ?? null,
    categorias: organization.categorias.join(", "),
    tags: organization.tags.join(", "),
    landmarks: [...organization.landmarks],
    edificios: [...organization.edificios],
    miembros: organization.miembros.map((member) => ({ ...member })),
  }
}

function toList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  )
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function dedupeNumbers(values: number[]) {
  return Array.from(new Set(values))
}

function dedupeMembers(values: OrganizationMember[]) {
  const byCharacterId = new Map<number, OrganizationMember>()
  for (const member of values) {
    byCharacterId.set(member.personajeId, member)
  }
  return Array.from(byCharacterId.values())
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase()
}

function sortMembersByRoleOrder(
  members: OrganizationMember[],
  roleOrder: string[],
  options?: { emptyRoleLast?: boolean },
) {
  const emptyRoleLast = options?.emptyRoleLast ?? false
  const roleIndexByName = new Map<string, number>()
  roleOrder.forEach((role, index) => {
    const normalized = normalizeRole(role)
    if (normalized.length > 0 && !roleIndexByName.has(normalized)) {
      roleIndexByName.set(normalized, index)
    }
  })

  return members
    .map((member, index) => {
      const normalizedRole = normalizeRole(member.categoria ?? "")
      const isEmptyRole = normalizedRole.length === 0
      const roleIndex = normalizedRole.length > 0 ? roleIndexByName.get(normalizedRole) : undefined
      return {
        member,
        index,
        isEmptyRole,
        // Roles missing or unknown go first.
        sortIndex: roleIndex ?? -1,
      }
    })
    .sort((a, b) => {
      if (emptyRoleLast && a.isEmptyRole !== b.isEmptyRole) {
        return a.isEmptyRole ? 1 : -1
      }
      if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex
      return a.index - b.index
    })
    .map((entry) => entry.member)
}

function getEmptyOrganizationFormState(defaultLandmarkId: number): OrganizationFormState {
  return {
    ...EMPTY_ORGANIZATION_FORM_STATE,
    landmarks: defaultLandmarkId > 0 ? [defaultLandmarkId] : [],
  }
}

export function OrganizationDetailDialog({
  organizationId,
  open,
  onOpenChange,
  resolveBuildingName,
  resolveLandmarkName,
  onOrganizationUpdated,
  onOrganizationDeleted,
  initialLandmarkId,
}: OrganizationDetailDialogProps) {
  const targetOrganizationId = typeof organizationId === "number" ? organizationId : undefined
  const [storedLandmarks, setStoredLandmarks] = useState<CharacterLandmarkReference[]>([])
  const [storedBuildings, setStoredBuildings] = useState<Building[]>([])
  const [storedCharacters, setStoredCharacters] = useState<Character[]>([])
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const defaultLandmarkId = useMemo(() => {
    if (
      typeof initialLandmarkId === "number" &&
      storedLandmarks.some((landmark) => landmark.id === initialLandmarkId)
    ) {
      return initialLandmarkId
    }
    return storedLandmarks[0]?.id ?? 0
  }, [initialLandmarkId, storedLandmarks])
  const [memberSearch, setMemberSearch] = useState("")
  const [landmarkSearch, setLandmarkSearch] = useState("")
  const [buildingSearch, setBuildingSearch] = useState("")
  const [memberAddSearch, setMemberAddSearch] = useState("")
  const [isLandmarkPickerOpen, setIsLandmarkPickerOpen] = useState(false)
  const [isBuildingPickerOpen, setIsBuildingPickerOpen] = useState(false)
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false)
  const [landmarksPage, setLandmarksPage] = useState(1)
  const [buildingsPage, setBuildingsPage] = useState(1)
  const [membersPage, setMembersPage] = useState(1)
  const [viewLandmarksPage, setViewLandmarksPage] = useState(1)
  const [viewBuildingsPage, setViewBuildingsPage] = useState(1)
  const [viewMembersPage, setViewMembersPage] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [formState, setFormState] = useState<OrganizationFormState>(() =>
    getEmptyOrganizationFormState(defaultLandmarkId),
  )
  const landmarkNameById = useMemo(
    () => new Map(storedLandmarks.map((landmark) => [landmark.id, landmark.nombre])),
    [storedLandmarks],
  )
  const buildingNameById = useMemo(
    () => new Map(storedBuildings.map((building) => [building.id, building.nombre])),
    [storedBuildings],
  )

  useEffect(() => {
    if (!open) return
    const isCreateRequest = typeof targetOrganizationId !== "number"

    setMemberSearch("")
    setLandmarkSearch("")
    setBuildingSearch("")
    setMemberAddSearch("")
    setIsLandmarkPickerOpen(false)
    setIsBuildingPickerOpen(false)
    setIsMemberPickerOpen(false)
    setLandmarksPage(1)
    setBuildingsPage(1)
    setMembersPage(1)
    setViewLandmarksPage(1)
    setViewBuildingsPage(1)
    setViewMembersPage(1)
    setSaveError(null)
    setLoadError(null)
    setIsLoadingReferences(true)

    if (isCreateRequest) {
      setCurrentOrganization(null)
      setIsEditing(true)
      setFormState(getEmptyOrganizationFormState(0))
    } else {
      setIsEditing(false)
    }

    let isActive = true

    void Promise.allSettled([
      fetchCharacters(true),
      fetchBuildings(true),
      fetchCharacterReferences(true),
    ])
      .then(async ([charactersResult, buildingsResult, referencesResult]) => {
        if (!isActive) return

        const characters = charactersResult.status === "fulfilled" ? charactersResult.value : []
        const buildings = buildingsResult.status === "fulfilled" ? buildingsResult.value : []
        const references =
          referencesResult.status === "fulfilled"
            ? referencesResult.value
            : { landmarks: [], buildings: [], organizations: [] }

        const failedReferenceLoads = [
          charactersResult.status === "rejected"
            ? getBackendErrorMessage(
                charactersResult.reason,
                "No se pudieron cargar los personajes disponibles.",
              )
            : null,
          buildingsResult.status === "rejected"
            ? getBackendErrorMessage(
                buildingsResult.reason,
                "No se pudieron cargar los edificios disponibles.",
              )
            : null,
          referencesResult.status === "rejected"
            ? getBackendErrorMessage(
                referencesResult.reason,
                "No se pudieron cargar los landmarks disponibles.",
              )
            : null,
        ].filter((message): message is string => Boolean(message))

        setStoredCharacters(characters)
        setStoredBuildings(buildings)
        setStoredLandmarks(references.landmarks)
        if (failedReferenceLoads.length > 0) {
          setLoadError(failedReferenceLoads[0])
        }

        const resolvedDefaultLandmarkId =
          typeof initialLandmarkId === "number" &&
          references.landmarks.some((landmark) => landmark.id === initialLandmarkId)
            ? initialLandmarkId
            : references.landmarks[0]?.id ?? 0

        if (typeof targetOrganizationId !== "number") {
          setCurrentOrganization(null)
          setIsEditing(true)
          setIsLoadingReferences(false)
          setFormState((prev) => ({
            ...prev,
            landmarks:
              prev.landmarks.length > 0
                ? prev.landmarks
                : resolvedDefaultLandmarkId > 0
                  ? [resolvedDefaultLandmarkId]
                  : [],
          }))
          return
        }

        try {
          const organization = await fetchOrganizationById(targetOrganizationId)
          if (!isActive) return
          setCurrentOrganization(organization)
          setIsEditing(false)
          setIsLoadingReferences(false)
          setFormState(toOrganizationFormState(organization))
        } catch (error) {
          if (!isActive) return
          setCurrentOrganization(null)
          setIsEditing(false)
          setIsLoadingReferences(false)
          setLoadError(getBackendErrorMessage(error, "No se pudo cargar la organizacion."))
          setFormState(getEmptyOrganizationFormState(resolvedDefaultLandmarkId))
        }
      })

    return () => {
      isActive = false
    }
  }, [initialLandmarkId, open, targetOrganizationId])

  const isCreateMode = currentOrganization === null
  const organizationView: Organization = currentOrganization ?? {
    id: 0,
    nombre: "",
    descripcion: "",
    tags: [],
    categorias: [],
    edificios: [],
    miembros: [],
    landmarks: defaultLandmarkId > 0 ? [defaultLandmarkId] : [],
  }

  const formRoleOrder = useMemo(() => toList(formState.categorias), [formState.categorias])
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()
    const baseMembers =
      query.length === 0
        ? organizationView.miembros
        : organizationView.miembros.filter(
            (member) =>
              member.nombre.toLowerCase().includes(query) ||
              member.profesion.toLowerCase().includes(query) ||
              member.raza.toLowerCase().includes(query) ||
              member.categoria.toLowerCase().includes(query),
          )

    return sortMembersByRoleOrder(baseMembers, organizationView.categorias, { emptyRoleLast: true })
  }, [memberSearch, organizationView.categorias, organizationView.miembros])

  const previewCategories = isEditing ? toList(formState.categorias) : organizationView.categorias
  const previewTags = isEditing ? toList(formState.tags) : organizationView.tags
  const previewImage = isEditing ? toOptionalText(formState.imagen) : organizationView.imagen
  const previewLandmarks = isEditing ? formState.landmarks : organizationView.landmarks
  const previewBuildings = isEditing ? formState.edificios : organizationView.edificios
  const previewMembers = isEditing ? formState.miembros : organizationView.miembros
  const memberRoleOptions = useMemo(() => {
    const fromMembers = formState.miembros
      .map((member) => member.categoria.trim())
      .filter((role) => role.length > 0)
    const roles = Array.from(new Set([...formRoleOrder, ...fromMembers]))
    return roles.length > 0 ? roles : ["Miembro"]
  }, [formRoleOrder, formState.miembros])
  const previewName = isEditing
    ? formState.nombre.trim() || (isCreateMode ? "Nueva organizacion" : organizationView.nombre)
    : organizationView.nombre || "Nueva organizacion"
  const availableLandmarksToAdd = useMemo(() => {
    const query = landmarkSearch.trim().toLowerCase()
    return storedLandmarks
      .filter((landmark) => !formState.landmarks.includes(landmark.id))
      .filter((landmark) => landmark.nombre.toLowerCase().includes(query))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [formState.landmarks, landmarkSearch, storedLandmarks])
  const availableBuildingsToAdd = useMemo(() => {
    const query = buildingSearch.trim().toLowerCase()
    return storedBuildings
      .filter((building) => !formState.edificios.includes(building.id))
      .filter((building) => building.nombre.toLowerCase().includes(query))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [buildingSearch, formState.edificios, storedBuildings])
  const availableMembersToAdd = useMemo(() => {
    const query = memberAddSearch.trim().toLowerCase()
    return storedCharacters
      .filter(
        (character) => !formState.miembros.some((member) => member.personajeId === character.id),
      )
      .filter(
        (character) =>
          character.nombre.toLowerCase().includes(query) ||
          character.clase.toLowerCase().includes(query) ||
          character.raza.toLowerCase().includes(query),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [formState.miembros, memberAddSearch, storedCharacters])
  const sortedFormMembers = useMemo(
    () => sortMembersByRoleOrder(formState.miembros, formRoleOrder),
    [formRoleOrder, formState.miembros],
  )
  const paginatedViewBuildingIds = useMemo(() => {
    const start = (viewBuildingsPage - 1) * RELATION_IDS_PER_PAGE
    return organizationView.edificios.slice(start, start + RELATION_IDS_PER_PAGE)
  }, [organizationView.edificios, viewBuildingsPage])
  const paginatedViewLandmarkIds = useMemo(() => {
    const start = (viewLandmarksPage - 1) * RELATION_IDS_PER_PAGE
    return organizationView.landmarks.slice(start, start + RELATION_IDS_PER_PAGE)
  }, [organizationView.landmarks, viewLandmarksPage])
  const paginatedViewMembers = useMemo(() => {
    const start = (viewMembersPage - 1) * RELATION_MEMBERS_PER_PAGE
    return filteredMembers.slice(start, start + RELATION_MEMBERS_PER_PAGE)
  }, [filteredMembers, viewMembersPage])
  const totalLandmarkPages = Math.max(1, Math.ceil(formState.landmarks.length / RELATION_IDS_PER_PAGE))
  const totalBuildingPages = Math.max(1, Math.ceil(formState.edificios.length / RELATION_IDS_PER_PAGE))
  const totalMemberPages = Math.max(1, Math.ceil(sortedFormMembers.length / RELATION_MEMBERS_PER_PAGE))
  const totalViewLandmarkPages = Math.max(
    1,
    Math.ceil(organizationView.landmarks.length / RELATION_IDS_PER_PAGE),
  )
  const totalViewBuildingPages = Math.max(
    1,
    Math.ceil(organizationView.edificios.length / RELATION_IDS_PER_PAGE),
  )
  const totalViewMemberPages = Math.max(1, Math.ceil(filteredMembers.length / RELATION_MEMBERS_PER_PAGE))
  const paginatedLandmarkIds = useMemo(() => {
    const start = (landmarksPage - 1) * RELATION_IDS_PER_PAGE
    return formState.landmarks.slice(start, start + RELATION_IDS_PER_PAGE)
  }, [formState.landmarks, landmarksPage])
  const paginatedBuildingIds = useMemo(() => {
    const start = (buildingsPage - 1) * RELATION_IDS_PER_PAGE
    return formState.edificios.slice(start, start + RELATION_IDS_PER_PAGE)
  }, [buildingsPage, formState.edificios])
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * RELATION_MEMBERS_PER_PAGE
    return sortedFormMembers.slice(start, start + RELATION_MEMBERS_PER_PAGE)
  }, [membersPage, sortedFormMembers])

  useEffect(() => {
    setLandmarksPage((current) => Math.min(current, totalLandmarkPages))
  }, [totalLandmarkPages])

  useEffect(() => {
    setBuildingsPage((current) => Math.min(current, totalBuildingPages))
  }, [totalBuildingPages])

  useEffect(() => {
    setMembersPage((current) => Math.min(current, totalMemberPages))
  }, [totalMemberPages])

  useEffect(() => {
    setViewLandmarksPage((current) => Math.min(current, totalViewLandmarkPages))
  }, [totalViewLandmarkPages])

  useEffect(() => {
    setViewBuildingsPage((current) => Math.min(current, totalViewBuildingPages))
  }, [totalViewBuildingPages])

  useEffect(() => {
    setViewMembersPage((current) => Math.min(current, totalViewMemberPages))
  }, [totalViewMemberPages])

  const handleStartEdit = () => {
    if (!currentOrganization) return

    setFormState(toOrganizationFormState(currentOrganization))
    setLandmarkSearch("")
    setBuildingSearch("")
    setMemberAddSearch("")
    setIsLandmarkPickerOpen(false)
    setIsBuildingPickerOpen(false)
    setIsMemberPickerOpen(false)
    setLandmarksPage(1)
    setBuildingsPage(1)
    setMembersPage(1)
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    if (!currentOrganization) {
      onOpenChange(false)
      return
    }

    setFormState(toOrganizationFormState(currentOrganization))
    setLandmarkSearch("")
    setBuildingSearch("")
    setMemberAddSearch("")
    setIsLandmarkPickerOpen(false)
    setIsBuildingPickerOpen(false)
    setIsMemberPickerOpen(false)
    setLandmarksPage(1)
    setBuildingsPage(1)
    setMembersPage(1)
    setViewLandmarksPage(1)
    setViewBuildingsPage(1)
    setViewMembersPage(1)
    setIsEditing(false)
    setSaveError(null)
  }

  const handleAddLandmark = (landmarkId: number) => {
    setFormState((prev) => ({
      ...prev,
      landmarks: prev.landmarks.includes(landmarkId)
        ? prev.landmarks
        : [...prev.landmarks, landmarkId],
    }))
    setLandmarkSearch("")
    setIsLandmarkPickerOpen(false)
  }

  const handleRemoveLandmark = (landmarkId: number) => {
    setFormState((prev) => ({
      ...prev,
      landmarks: prev.landmarks.filter((item) => item !== landmarkId),
    }))
  }

  const handleAddBuilding = (buildingId: number) => {
    setFormState((prev) => ({
      ...prev,
      edificios: prev.edificios.includes(buildingId) ? prev.edificios : [...prev.edificios, buildingId],
    }))
    setBuildingSearch("")
    setIsBuildingPickerOpen(false)
  }

  const handleRemoveBuilding = (buildingId: number) => {
    setFormState((prev) => ({
      ...prev,
      edificios: prev.edificios.filter((item) => item !== buildingId),
    }))
  }

  const handleAddMember = (character: Character) => {
    setFormState((prev) => ({
      ...prev,
      miembros: prev.miembros.some((member) => member.personajeId === character.id)
        ? prev.miembros
        : [
            ...prev.miembros,
            {
              personajeId: character.id,
              nombre: character.nombre,
              profesion: character.clase,
              raza: character.raza,
              landmarkId: character.landmarkId,
              categoria: "",
            },
          ],
    }))
    setMemberAddSearch("")
    setIsMemberPickerOpen(false)
  }

  const handleRemoveMember = (characterId: number) => {
    setFormState((prev) => ({
      ...prev,
      miembros: prev.miembros.filter((member) => member.personajeId !== characterId),
    }))
  }

  const handleMemberCategoryChange = (characterId: number, value: string) => {
    setFormState((prev) => ({
      ...prev,
      miembros: prev.miembros.map((member) =>
        member.personajeId === characterId ? { ...member, categoria: value } : member,
      ),
    }))
  }

  const handleSaveEdit = () => {
    void (async () => {
      const normalizedName = formState.nombre.trim()
      if (!normalizedName) {
        setSaveError("El nombre de la organizacion es obligatorio.")
        return
      }

      const nextLandmarks = dedupeNumbers(formState.landmarks)
      const nextBuildings = dedupeNumbers(formState.edificios)
      const nextMembers = dedupeMembers(formState.miembros)

      try {
        if (!currentOrganization) {
          const createdOrganization = await createOrganization({
            nombre: normalizedName,
            descripcion: formState.descripcion.trim(),
            imagen: formState.imagenAssetId ? undefined : toOptionalText(formState.imagen),
            imagenAssetId: formState.imagenAssetId ?? undefined,
            categorias: toList(formState.categorias),
            tags: toList(formState.tags),
            edificios: nextBuildings,
            miembros: nextMembers,
            landmarks: nextLandmarks,
          })

          setCurrentOrganization(createdOrganization)
          setFormState(toOrganizationFormState(createdOrganization))
          setIsEditing(false)
          setViewLandmarksPage(1)
          setViewBuildingsPage(1)
          setViewMembersPage(1)
          setSaveError(null)
          onOrganizationUpdated?.(createdOrganization)
          return
        }

        const updatedOrganization = await updateOrganization(currentOrganization.id, {
          nombre: normalizedName,
          descripcion: formState.descripcion.trim(),
          imagen: formState.imagenAssetId ? undefined : toOptionalText(formState.imagen),
          imagenAssetId: formState.imagenAssetId ?? undefined,
          categorias: toList(formState.categorias),
          tags: toList(formState.tags),
          edificios: nextBuildings,
          miembros: nextMembers,
          landmarks: nextLandmarks,
        })

        setCurrentOrganization(updatedOrganization)
        setFormState(toOrganizationFormState(updatedOrganization))
        setIsEditing(false)
        setViewLandmarksPage(1)
        setViewBuildingsPage(1)
        setViewMembersPage(1)
        setSaveError(null)
        onOrganizationUpdated?.(updatedOrganization)
      } catch (error) {
        setSaveError(getBackendErrorMessage(error, "No se pudo guardar la organizacion en backend."))
      }
    })()
  }

  const handleDelete = () => {
    if (!currentOrganization) return

    void (async () => {
      const confirmed = window.confirm(
        `¿Eliminar la organizacion ${currentOrganization.nombre}? Esta accion no se puede deshacer.`,
      )
      if (!confirmed) return

      try {
        await deleteOrganization(currentOrganization.id)
        setCurrentOrganization(null)
        setMemberSearch("")
        setLandmarkSearch("")
        setBuildingSearch("")
        setMemberAddSearch("")
        setIsLandmarkPickerOpen(false)
        setIsBuildingPickerOpen(false)
        setIsMemberPickerOpen(false)
        setLandmarksPage(1)
        setBuildingsPage(1)
        setMembersPage(1)
        setViewLandmarksPage(1)
        setViewBuildingsPage(1)
        setViewMembersPage(1)
        setIsEditing(false)
        setSaveError(null)
        setLoadError(null)
        setFormState(getEmptyOrganizationFormState(defaultLandmarkId))
        onOrganizationDeleted?.(currentOrganization.id)
        onOpenChange(false)
      } catch (error) {
        setSaveError(getBackendErrorMessage(error, "No se pudo eliminar la organizacion en backend."))
      }
    })()
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setMemberSearch("")
      setLandmarkSearch("")
      setBuildingSearch("")
      setMemberAddSearch("")
      setIsLandmarkPickerOpen(false)
      setIsBuildingPickerOpen(false)
      setIsMemberPickerOpen(false)
      setLandmarksPage(1)
      setBuildingsPage(1)
      setMembersPage(1)
      setViewLandmarksPage(1)
      setViewBuildingsPage(1)
      setViewMembersPage(1)
      setIsEditing(currentOrganization === null)
      setSaveError(null)
      setLoadError(null)
      setFormState(
        currentOrganization
          ? toOrganizationFormState(currentOrganization)
          : getEmptyOrganizationFormState(defaultLandmarkId),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="parchment flex max-h-[90vh] max-w-7xl flex-col overflow-hidden p-0">
        <div className="absolute right-12 top-3.5 z-20 flex items-center gap-1.5">
          {!isEditing && currentOrganization ? (
            <>
              <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={handleDelete}>
                <Trash2 className="mr-1 size-3" />
                Eliminar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleStartEdit}>
                <Pencil className="mr-1 size-3" />
                Editar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit}>
                <Save className="mr-1 size-3" />
                Guardar
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCancelEdit}>
                <X className="mr-1 size-3" />
                Cancelar
              </Button>
            </>
          )}
        </div>

        <div className="flex h-[85vh] min-h-0 flex-col">
          <div className="scroll-banner shrink-0">
            <DialogHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                <div className="w-36 shrink-0">
                  <ImageEmbeddingPicker
                    usage="organization"
                    value={previewImage}
                    assetId={formState.imagenAssetId}
                    onChange={(nextValue, nextAssetId) =>
                      setFormState((prev) => ({
                        ...prev,
                        imagen: nextValue,
                        imagenAssetId: nextAssetId,
                      }))
                    }
                    previewClassName="h-40 w-full"
                    editable={isEditing}
                    onRequestEdit={currentOrganization ? handleStartEdit : undefined}
                  />
                </div>
                <div className="min-w-0 flex flex-col gap-1.5">
                  {isEditing ? (
                    <>
                      <DialogTitle className="sr-only">{previewName}</DialogTitle>
                      <Input
                        value={formState.nombre}
                        onChange={(event) => setFormState((prev) => ({ ...prev, nombre: event.target.value }))}
                        className="h-9 border-primary/30 bg-card/80 font-serif text-lg"
                      />
                    </>
                  ) : (
                    <DialogTitle className="text-balance text-2xl font-serif leading-tight text-primary">
                      {previewName}
                    </DialogTitle>
                  )}

                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {previewCategories.map((category) => (
                      <Badge key={category} variant="outline" className="border-primary/30 text-[10px] text-primary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {previewMembers.length} miembros conocidos
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="size-3" />
                      {previewBuildings.length} sedes
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {previewLandmarks.length} regiones
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Etiquetas
                    </div>
                    {previewTags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sin etiquetas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {previewTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="border-primary/30 text-[10px] text-primary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-5 p-6">
              {loadError && <p className="text-xs text-destructive">{loadError}</p>}
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}

              {isEditing ? (
                <div>
                  <div>
                    <div className="ornament-divider mb-3 text-xs font-serif">Descripcion</div>
                    <MentionField
                      source="auto"
                      value={formState.descripcion}
                      onChange={(value) => setFormState((prev) => ({ ...prev, descripcion: value }))}
                      rows={4}
                      className="text-sm"
                      placeholder="Descripcion de la organizacion..."
                    />

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Categorias
                        </div>
                        <Input
                          value={formState.categorias}
                          onChange={(event) => setFormState((prev) => ({ ...prev, categorias: event.target.value }))}
                          className="h-8 text-sm"
                          placeholder="militar, comercio..."
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Etiquetas
                        </div>
                        <Input
                          value={formState.tags}
                          onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))}
                          className="h-8 text-sm"
                          placeholder="tag1, tag2..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="ornament-divider mb-3 text-xs font-serif">Descripcion</div>
                  <MentionField
                    source="auto"
                    value={organizationView.descripcion}
                    editable={false}
                    className="text-sm leading-relaxed text-foreground/85"
                    emptyText="Sin descripcion"
                  />
                </div>
              )}

              {isEditing && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <div className="flex h-[18rem] min-h-0 flex-col rounded-sm border border-border bg-secondary/40 p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <MapPin className="size-3" /> Presencia en landmarks ({formState.landmarks.length})
                    </h4>
                    <div className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-border/60 bg-card/50">
                      <ScrollArea className="h-full">
                        {formState.landmarks.length === 0 ? (
                          <p className="px-2.5 py-2 text-xs text-muted-foreground">Sin presencia asignada.</p>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {paginatedLandmarkIds.map((landmarkId) => {
                              const landmarkName =
                                landmarkNameById.get(landmarkId) ?? resolveLandmarkName?.(landmarkId) ?? "Desconocido"

                              return (
                                <div key={landmarkId} className="flex items-center gap-2 px-2 py-1.5">
                                  <span className="truncate text-xs text-foreground">{landmarkName}</span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="ml-auto size-7"
                                    onClick={() => handleRemoveLandmark(landmarkId)}
                                  >
                                    <X className="size-3.5" />
                                    <span className="sr-only">Quitar {landmarkName}</span>
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                    {formState.landmarks.length > 0 && (
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          Pagina {landmarksPage} de {totalLandmarkPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            disabled={landmarksPage <= 1}
                            onClick={() => setLandmarksPage((current) => Math.max(1, current - 1))}
                          >
                            Anterior
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            disabled={landmarksPage >= totalLandmarkPages}
                            onClick={() => setLandmarksPage((current) => Math.min(totalLandmarkPages, current + 1))}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                    {storedLandmarks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay landmarks disponibles para agregar.</p>
                    ) : (
                      <Popover open={isLandmarkPickerOpen} onOpenChange={setIsLandmarkPickerOpen}>
                        <PopoverAnchor asChild>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={landmarkSearch}
                              onFocus={() => setIsLandmarkPickerOpen(true)}
                              onChange={(event) => {
                                setLandmarkSearch(event.target.value)
                                setIsLandmarkPickerOpen(true)
                              }}
                              placeholder="Buscar landmark para agregar..."
                              className="h-8 border-border bg-card pl-8 text-xs"
                            />
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          align="start"
                          sideOffset={6}
                          className="w-[min(90vw,24rem)] border-border/70 p-1"
                        >
                          <ScrollArea className="max-h-72">
                            {availableLandmarksToAdd.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">No hay coincidencias.</p>
                            ) : (
                              <div className="space-y-0.5">
                                {availableLandmarksToAdd.map((landmark) => (
                                  <button
                                    key={landmark.id}
                                    type="button"
                                    onClick={() => handleAddLandmark(landmark.id)}
                                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary/60"
                                  >
                                    <span>{landmark.nombre}</span>
                                    <span className="text-primary">Agregar</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="flex h-[18rem] min-h-0 flex-col rounded-sm border border-border bg-secondary/40 p-3">
                      <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <Building2 className="size-3" /> Sedes y edificios ({formState.edificios.length})
                      </h4>
                      <div className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-border/60 bg-card/50">
                        <ScrollArea className="h-full">
                          {formState.edificios.length === 0 ? (
                            <p className="px-2.5 py-2 text-xs text-muted-foreground">Sin edificios asociados.</p>
                          ) : (
                            <div className="divide-y divide-border/50">
                              {paginatedBuildingIds.map((buildingId) => {
                                const buildingName =
                                  buildingNameById.get(buildingId) ??
                                  resolveBuildingName?.(buildingId) ??
                                  "Desconocido"

                                return (
                                  <div key={buildingId} className="flex items-center gap-2 px-2 py-1.5">
                                    <span className="truncate text-xs text-foreground">{buildingName}</span>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="ml-auto size-7"
                                      onClick={() => handleRemoveBuilding(buildingId)}
                                    >
                                      <X className="size-3.5" />
                                      <span className="sr-only">Quitar {buildingName}</span>
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                      {formState.edificios.length > 0 && (
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            Pagina {buildingsPage} de {totalBuildingPages}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={buildingsPage <= 1}
                              onClick={() => setBuildingsPage((current) => Math.max(1, current - 1))}
                            >
                              Anterior
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={buildingsPage >= totalBuildingPages}
                              onClick={() => setBuildingsPage((current) => Math.min(totalBuildingPages, current + 1))}
                            >
                              Siguiente
                            </Button>
                          </div>
                        </div>
                      )}
                      <Popover open={isBuildingPickerOpen} onOpenChange={setIsBuildingPickerOpen}>
                        <PopoverAnchor asChild>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={buildingSearch}
                              disabled={isLoadingReferences}
                              onFocus={() => setIsBuildingPickerOpen(true)}
                              onChange={(event) => {
                                setBuildingSearch(event.target.value)
                                setIsBuildingPickerOpen(true)
                              }}
                              placeholder={
                                isLoadingReferences
                                  ? "Cargando edificios..."
                                  : "Buscar edificio para agregar..."
                              }
                              className="h-8 border-border bg-card pl-8 text-xs"
                            />
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          align="start"
                          sideOffset={6}
                          className="w-[min(90vw,24rem)] border-border/70 p-1"
                        >
                          <ScrollArea className="max-h-72">
                            {isLoadingReferences ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                                Cargando edificios disponibles...
                              </p>
                            ) : storedBuildings.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                                No hay edificios disponibles para agregar.
                              </p>
                            ) : availableBuildingsToAdd.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">No hay coincidencias.</p>
                            ) : (
                              <div className="space-y-0.5">
                                {availableBuildingsToAdd.map((building) => (
                                  <button
                                    key={building.id}
                                    type="button"
                                    onClick={() => handleAddBuilding(building.id)}
                                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary/60"
                                  >
                                    <span>{building.nombre}</span>
                                    <span className="text-primary">Agregar</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                  </div>

                  <div className="flex h-[18rem] min-h-0 flex-col rounded-sm border border-border bg-secondary/40 p-3">
                      <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <Users className="size-3" /> Miembros conocidos ({formState.miembros.length})
                      </h4>
                      <div className="mb-2 min-h-0 flex-1 overflow-hidden rounded-sm border border-border/60 bg-card/50">
                        <ScrollArea className="h-full">
                          {formState.miembros.length === 0 ? (
                            <p className="px-2.5 py-2 text-xs text-muted-foreground">Sin miembros asociados.</p>
                          ) : (
                            <div className="divide-y divide-border/50">
                              {paginatedMembers.map((member) => (
                                <div key={member.personajeId} className="flex items-center gap-2 px-2 py-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-medium text-foreground">{member.nombre}</div>
                                    <div className="truncate text-[10px] text-muted-foreground">
                                      {member.raza} / {member.profesion}
                                    </div>
                                  </div>
                                  <select
                                    value={member.categoria}
                                    onChange={(event) =>
                                      handleMemberCategoryChange(member.personajeId, event.target.value)
                                    }
                                    className="h-7 w-24 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs sm:w-28"
                                  >
                                    <option value="">Sin rol</option>
                                    {memberRoleOptions.map((role) => (
                                      <option key={role} value={role}>
                                        {role}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-7"
                                    onClick={() => handleRemoveMember(member.personajeId)}
                                  >
                                    <X className="size-3.5" />
                                    <span className="sr-only">Quitar miembro</span>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                      {formState.miembros.length > 0 && (
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            Pagina {membersPage} de {totalMemberPages}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={membersPage <= 1}
                              onClick={() => setMembersPage((current) => Math.max(1, current - 1))}
                            >
                              Anterior
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              disabled={membersPage >= totalMemberPages}
                              onClick={() => setMembersPage((current) => Math.min(totalMemberPages, current + 1))}
                            >
                              Siguiente
                            </Button>
                          </div>
                        </div>
                      )}
                      <Popover open={isMemberPickerOpen} onOpenChange={setIsMemberPickerOpen}>
                        <PopoverAnchor asChild>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={memberAddSearch}
                              disabled={isLoadingReferences}
                              onFocus={() => setIsMemberPickerOpen(true)}
                              onChange={(event) => {
                                setMemberAddSearch(event.target.value)
                                setIsMemberPickerOpen(true)
                              }}
                              placeholder={
                                isLoadingReferences
                                  ? "Cargando personajes..."
                                  : "Buscar personaje para agregar..."
                              }
                              className="h-8 border-border bg-card pl-8 text-xs"
                            />
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          align="start"
                          sideOffset={6}
                          className="w-[min(90vw,24rem)] border-border/70 p-1"
                        >
                          <ScrollArea className="max-h-72">
                            {isLoadingReferences ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                                Cargando personajes disponibles...
                              </p>
                            ) : storedCharacters.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">
                                No hay personajes disponibles para agregar.
                              </p>
                            ) : availableMembersToAdd.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-muted-foreground">No hay coincidencias.</p>
                            ) : (
                              <div className="space-y-0.5">
                                {availableMembersToAdd.map((character) => (
                                  <button
                                    key={character.id}
                                    type="button"
                                    onClick={() => handleAddMember(character)}
                                    className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-secondary/60"
                                  >
                                    <span>
                                      {character.nombre}
                                      <span className="ml-1 text-muted-foreground">
                                        ({character.clase} / {character.raza})
                                      </span>
                                    </span>
                                    <span className="text-primary">Agregar</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                  </div>
                </div>
              )}

              {!isEditing && organizationView.miembros.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="size-4 text-primary" />
                      <h3 className="font-serif text-sm font-semibold text-primary">Miembros Conocidos</h3>
                      <span className="text-[10px] text-muted-foreground">
                        ({filteredMembers.length} de {organizationView.miembros.length})
                      </span>
                    </div>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar miembros..."
                        value={memberSearch}
                        onChange={(event) => {
                          setMemberSearch(event.target.value)
                          setViewMembersPage(1)
                        }}
                        className="h-8 border-border bg-card pl-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-sm border border-border">
                    <ScrollArea className="max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="border-b border-border bg-secondary/60">
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Nombre
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Profesion
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Raza
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Ubicacion
                            </th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              Rango
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                                Sin resultados
                              </td>
                            </tr>
                          ) : (
                            paginatedViewMembers.map((member) => (
                              <tr
                                key={member.personajeId}
                                className="last:border-0 border-b border-border/50 transition-colors hover:bg-secondary/30"
                              >
                                <td className="px-3 py-2.5 font-medium text-foreground">{member.nombre}</td>
                                <td className="px-3 py-2.5 text-muted-foreground">{member.profesion}</td>
                                <td className="px-3 py-2.5 text-muted-foreground">{member.raza}</td>
                                <td className="px-3 py-2.5">
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="size-3 text-primary/50" />
                                    {resolveLandmarkName?.(member.landmarkId) ?? "Desconocido"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Badge
                                    variant="outline"
                                    className="border-primary/30 text-[10px] font-normal text-primary"
                                  >
                                    {member.categoria}
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                  {filteredMembers.length > 0 && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Pagina {viewMembersPage} de {totalViewMemberPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewMembersPage <= 1}
                          onClick={() => setViewMembersPage((current) => Math.max(1, current - 1))}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewMembersPage >= totalViewMemberPages}
                          onClick={() =>
                            setViewMembersPage((current) => Math.min(totalViewMemberPages, current + 1))
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!isEditing && organizationView.edificios.length > 0 && (
                  <div className="rounded-sm border border-border bg-secondary/50 p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <Building2 className="size-3" /> Sedes y edificios
                    </h4>
                    <div className="flex flex-col gap-1">
                      {paginatedViewBuildingIds.map((buildingId) => (
                        <span key={buildingId} className="text-sm text-foreground">
                          {resolveBuildingName?.(buildingId) ?? "Desconocido"}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Pagina {viewBuildingsPage} de {totalViewBuildingPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewBuildingsPage <= 1}
                          onClick={() => setViewBuildingsPage((current) => Math.max(1, current - 1))}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewBuildingsPage >= totalViewBuildingPages}
                          onClick={() =>
                            setViewBuildingsPage((current) => Math.min(totalViewBuildingPages, current + 1))
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {!isEditing && previewLandmarks.length > 0 && (
                  <div className="rounded-sm border border-border bg-secondary/50 p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      <MapPin className="size-3" /> Presencia en
                    </h4>
                    <div className="flex flex-col gap-1">
                      {paginatedViewLandmarkIds.map((landmarkId) => (
                        <span key={landmarkId} className="text-sm text-foreground">
                          {resolveLandmarkName?.(landmarkId) ?? "Desconocido"}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        Pagina {viewLandmarksPage} de {totalViewLandmarkPages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewLandmarksPage <= 1}
                          onClick={() => setViewLandmarksPage((current) => Math.max(1, current - 1))}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={viewLandmarksPage >= totalViewLandmarkPages}
                          onClick={() =>
                            setViewLandmarksPage((current) => Math.min(totalViewLandmarkPages, current + 1))
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
