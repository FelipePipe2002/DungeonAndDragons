import type { Organization, OrganizationMember } from "@/lib/types"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRequest } from "@/lib/services/backend-api.service"

type OrganizationApiMemberDto = {
  personajeId: number
  nombre?: string | null
  profesion?: string | null
  raza?: string | null
  landmarkId?: number | null
  categoria?: string | null
}

type OrganizationApiDto = {
  id: number
  nombre: string
  descripcion?: string | null
  tags?: string[] | null
  imagen?: string | null
  imagenAssetId?: number | null
  categorias?: string[] | null
  edificios?: number[] | null
  miembros?: OrganizationApiMemberDto[] | null
  landmarks?: number[] | null
}

type OrganizationMemberUpsertPayload = {
  personajeId: number
  categoria: string
}

type OrganizationUpsertPayload = {
  nombre: string
  descripcion: string
  tags: string[]
  imagen: string | null
  imagenAssetId: number | null
  categorias: string[]
  edificios: number[]
  miembros: OrganizationMemberUpsertPayload[]
  landmarks: number[]
}

let organizationsCache: Organization[] | null = null
let organizationsPromise: Promise<Organization[]> | null = null
const organizationByIdCache = new Map<number, Organization>()

function toOptionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function toNumberArray(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
}

function dedupeNumbers(values: number[]) {
  return Array.from(new Set(values))
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values))
}

function toOrganizationMember(dto: OrganizationApiMemberDto): OrganizationMember {
  const characterId =
    typeof dto.personajeId === "number" && Number.isFinite(dto.personajeId) ? dto.personajeId : 0

  return {
    personajeId: characterId,
    nombre: toOptionalText(dto.nombre) ?? `Miembro ${characterId}`,
    profesion: toOptionalText(dto.profesion) ?? "",
    raza: toOptionalText(dto.raza) ?? "",
    landmarkId:
      typeof dto.landmarkId === "number" && Number.isFinite(dto.landmarkId) ? dto.landmarkId : 0,
    categoria: toOptionalText(dto.categoria) ?? "",
  }
}

function toOrganization(dto: OrganizationApiDto): Organization {
  const imagenAssetId =
    typeof dto.imagenAssetId === "number" && Number.isFinite(dto.imagenAssetId) && dto.imagenAssetId > 0
      ? dto.imagenAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.nombre ?? "",
    descripcion: dto.descripcion ?? "",
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.imagen),
    imagenAssetId,
    categorias: dedupeStrings(
      toStringArray(dto.categorias).map((category) => category.trim()).filter((category) => category.length > 0),
    ),
    edificios: dedupeNumbers(toNumberArray(dto.edificios)),
    miembros: Array.isArray(dto.miembros) ? dto.miembros.map(toOrganizationMember) : [],
    landmarks: dedupeNumbers(toNumberArray(dto.landmarks).filter((landmarkId) => landmarkId > 0)),
  }
}

function toOrganizationUpsertPayload(input: Omit<Organization, "id">): OrganizationUpsertPayload {
  const membersByCharacterId = new Map<number, OrganizationMember>()
  for (const member of input.miembros) {
    if (typeof member.personajeId !== "number" || !Number.isFinite(member.personajeId)) {
      continue
    }
    membersByCharacterId.set(member.personajeId, member)
  }

  const imagenAssetId =
    typeof input.imagenAssetId === "number" && Number.isFinite(input.imagenAssetId) && input.imagenAssetId > 0
      ? input.imagenAssetId
      : null

  return {
    nombre: input.nombre.trim(),
    descripcion: input.descripcion.trim(),
    tags: dedupeStrings(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    imagen: imagenAssetId ? null : toOptionalText(input.imagen) ?? null,
    imagenAssetId,
    categorias: dedupeStrings(input.categorias.map((category) => category.trim()).filter((category) => category.length > 0)),
    edificios: dedupeNumbers(input.edificios.filter((buildingId) => Number.isFinite(buildingId))),
    miembros: Array.from(membersByCharacterId.values()).map((member) => ({
      personajeId: member.personajeId,
      categoria: member.categoria?.trim() ?? "",
    })),
    landmarks: dedupeNumbers(input.landmarks.filter((landmarkId) => Number.isFinite(landmarkId) && landmarkId > 0)),
  }
}

function writeOrganizationsCache(organizations: Organization[]) {
  organizationsCache = organizations
  organizationByIdCache.clear()
  for (const organization of organizations) {
    organizationByIdCache.set(organization.id, organization)
  }
}

export async function fetchOrganizations(forceRefresh = false): Promise<Organization[]> {
  if (!forceRefresh && organizationsCache) {
    return organizationsCache
  }

  if (!forceRefresh && organizationsPromise) {
    return organizationsPromise
  }

  const pendingRequest = backendRequest<OrganizationApiDto[]>("/v1/organizations")
    .then((response) => {
      const organizations = response.map(toOrganization)
      writeOrganizationsCache(organizations)
      return organizations
    })
    .finally(() => {
      organizationsPromise = null
    })

  organizationsPromise = pendingRequest
  return pendingRequest
}

export async function fetchOrganizationById(organizationId: number): Promise<Organization> {
  const cached = organizationByIdCache.get(organizationId)
  if (cached) {
    return cached
  }

  const response = await backendRequest<OrganizationApiDto>(`/v1/organizations/${organizationId}`)
  const organization = toOrganization(response)
  organizationByIdCache.set(organization.id, organization)
  return organization
}

export async function createOrganization(input: Omit<Organization, "id">): Promise<Organization> {
  const response = await backendRequest<OrganizationApiDto>("/v1/organizations", {
    method: "POST",
    body: toOrganizationUpsertPayload(input),
  })

  organizationsCache = null
  organizationsPromise = null
  const organization = toOrganization(response)
  organizationByIdCache.set(organization.id, organization)
  return organization
}

export async function updateOrganization(
  organizationId: number,
  input: Omit<Organization, "id">,
): Promise<Organization> {
  const response = await backendRequest<OrganizationApiDto>(`/v1/organizations/${organizationId}`, {
    method: "PUT",
    body: toOrganizationUpsertPayload(input),
  })

  organizationsCache = null
  organizationsPromise = null
  const organization = toOrganization(response)
  organizationByIdCache.set(organization.id, organization)
  return organization
}

export async function deleteOrganization(organizationId: number): Promise<void> {
  await backendRequest<void>(`/v1/organizations/${organizationId}`, {
    method: "DELETE",
  })

  organizationsCache = null
  organizationsPromise = null
  organizationByIdCache.delete(organizationId)
}

export function clearOrganizationsCache() {
  organizationsCache = null
  organizationsPromise = null
  organizationByIdCache.clear()
}

export function getCachedOrganizationName(organizationId: number) {
  return organizationByIdCache.get(organizationId)?.nombre ?? "Desconocido"
}
