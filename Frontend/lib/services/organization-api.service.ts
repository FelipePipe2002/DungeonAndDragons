import { toNumberArray, toOrganizationMember, toStringArray } from "@/lib/dto-mappers"
import { UNKNOWN_LABEL } from "@/lib/display"
import { dedupeNumbers, dedupeStrings, toOptionalText } from "@/lib/normalize"
import type {
  BackendOrganizationDto,
  BackendOrganizationUpsertPayload,
  Organization,
  OrganizationMember,
} from "@/lib/types"
import { buildAssetUrl } from "@/lib/services/asset-api.service"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

let organizationsCache: Organization[] | null = null
let organizationsPromise: Promise<Organization[]> | null = null
const organizationByIdCache = new Map<number, Organization>()

function toOrganization(dto: BackendOrganizationDto): Organization {
  const imagenAssetId =
    typeof dto.imageAssetId === "number" && Number.isFinite(dto.imageAssetId) && dto.imageAssetId > 0
      ? dto.imageAssetId
      : undefined

  return {
    id: dto.id,
    nombre: dto.name ?? "",
    descripcion: dto.description ?? "",
    tags: dedupeStrings(toStringArray(dto.tags).map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    imagen: imagenAssetId ? buildAssetUrl(imagenAssetId) : toOptionalText(dto.image),
    imagenAssetId,
    categorias: dedupeStrings(
      toStringArray(dto.categories).map((category) => category.trim()).filter((category) => category.length > 0),
    ),
    edificios: dedupeNumbers(toNumberArray(dto.buildingIds)),
    miembros: Array.isArray(dto.members) ? dto.members.map(toOrganizationMember) : [],
    landmarks: dedupeNumbers(toNumberArray(dto.landmarks).filter((landmarkId) => landmarkId > 0)),
  }
}

function toOrganizationUpsertPayload(input: Omit<Organization, "id">): BackendOrganizationUpsertPayload {
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
    name: input.nombre.trim(),
    description: input.descripcion.trim(),
    tags: dedupeStrings(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
    image: imagenAssetId ? null : toOptionalText(input.imagen) ?? null,
    imageAssetId: imagenAssetId,
    buildingIds: dedupeNumbers(input.edificios.filter((buildingId) => Number.isFinite(buildingId))),
    members: Array.from(membersByCharacterId.values()).map((member) => ({
      characterId: member.personajeId,
      category: member.categoria?.trim() ?? "",
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

  const pendingRequest = backendRequest<BackendOrganizationDto[]>(backendRoutes.organizations.collection)
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

  const response = await backendRequest<BackendOrganizationDto>(backendRoutes.organizations.byId(organizationId))
  const organization = toOrganization(response)
  organizationByIdCache.set(organization.id, organization)
  return organization
}

export async function createOrganization(input: Omit<Organization, "id">): Promise<Organization> {
  const response = await backendRequest<BackendOrganizationDto>(backendRoutes.organizations.collection, {
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
  const response = await backendRequest<BackendOrganizationDto>(backendRoutes.organizations.byId(organizationId), {
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
  await backendRequest<void>(backendRoutes.organizations.byId(organizationId), {
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
  return organizationByIdCache.get(organizationId)?.nombre ?? UNKNOWN_LABEL
}
