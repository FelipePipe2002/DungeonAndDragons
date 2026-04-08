import type { DmRelationship, DmRelationshipDirection, DmRelationshipEntityType, DmRelationshipInput } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"

type DmRelationshipDto = {
  id?: number | null
  leftEntityType?: string | null
  leftEntityId?: number | null
  rightEntityType?: string | null
  rightEntityId?: number | null
  direction?: string | null
  label?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

const ENTITY_TYPES = new Set<DmRelationshipEntityType>(["character", "building", "organization", "landmark"])
const DIRECTIONS = new Set<DmRelationshipDirection>(["left-to-right", "right-to-left", "both"])

function normalizeEntityType(value: string | null | undefined): DmRelationshipEntityType {
  return ENTITY_TYPES.has(value as DmRelationshipEntityType) ? (value as DmRelationshipEntityType) : "character"
}

function normalizeDirection(value: string | null | undefined): DmRelationshipDirection {
  return DIRECTIONS.has(value as DmRelationshipDirection) ? (value as DmRelationshipDirection) : "left-to-right"
}

function normalizeRelationship(dto: DmRelationshipDto): DmRelationship {
  return {
    id: typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0,
    leftEntityType: normalizeEntityType(dto.leftEntityType),
    leftEntityId: typeof dto.leftEntityId === "number" && Number.isFinite(dto.leftEntityId) ? dto.leftEntityId : 0,
    rightEntityType: normalizeEntityType(dto.rightEntityType),
    rightEntityId: typeof dto.rightEntityId === "number" && Number.isFinite(dto.rightEntityId) ? dto.rightEntityId : 0,
    direction: normalizeDirection(dto.direction),
    label: typeof dto.label === "string" ? dto.label : "",
    notes: typeof dto.notes === "string" && dto.notes.trim().length > 0 ? dto.notes : undefined,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function toPayload(input: DmRelationshipInput) {
  return {
    leftEntityType: input.leftEntityType,
    leftEntityId: input.leftEntityId,
    rightEntityType: input.rightEntityType,
    rightEntityId: input.rightEntityId,
    direction: input.direction,
    label: input.label.trim(),
    notes: input.notes?.trim() || null,
  }
}

export async function fetchDmRelationships(): Promise<DmRelationship[]> {
  const response = await backendRequest<DmRelationshipDto[]>("/v1/dm-relationships")
  return Array.isArray(response) ? response.map(normalizeRelationship).filter((item) => item.id > 0) : []
}

export async function createDmRelationship(input: DmRelationshipInput): Promise<DmRelationship> {
  const response = await backendRequest<DmRelationshipDto>("/v1/dm-relationships", {
    method: "POST",
    body: toPayload(input),
  })

  return normalizeRelationship(response)
}

export async function updateDmRelationship(id: number, input: DmRelationshipInput): Promise<DmRelationship> {
  const response = await backendRequest<DmRelationshipDto>(`/v1/dm-relationships/${id}`, {
    method: "PUT",
    body: toPayload(input),
  })

  return normalizeRelationship(response)
}

export async function deleteDmRelationship(id: number): Promise<void> {
  await backendRequest<void>(`/v1/dm-relationships/${id}`, {
    method: "DELETE",
  })
}
