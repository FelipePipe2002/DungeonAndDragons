import type { DmOpenLoop, DmOpenLoopInput, DmOpenLoopPriority, DmOpenLoopStatus, DmOpenLoopType } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"

type DmOpenLoopDto = {
  id?: number | null
  title?: string | null
  loopType?: string | null
  status?: string | null
  priority?: string | null
  summary?: string | null
  nextStep?: string | null
  consequence?: string | null
  reward?: string | null
  location?: string | null
  dueAt?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

const LOOP_TYPES = new Set<DmOpenLoopType>(["rescue", "threat", "sidequest", "opportunity", "plan", "bounty", "mystery", "debt"])
const LOOP_STATUSES = new Set<DmOpenLoopStatus>(["open", "in-progress", "blocked", "urgent", "resolved", "failed"])
const LOOP_PRIORITIES = new Set<DmOpenLoopPriority>(["low", "medium", "high", "critical"])

function normalizeLoopType(value: string | null | undefined): DmOpenLoopType {
  return value && LOOP_TYPES.has(value as DmOpenLoopType) ? (value as DmOpenLoopType) : "sidequest"
}

function normalizeStatus(value: string | null | undefined): DmOpenLoopStatus {
  return value && LOOP_STATUSES.has(value as DmOpenLoopStatus) ? (value as DmOpenLoopStatus) : "open"
}

function normalizePriority(value: string | null | undefined): DmOpenLoopPriority {
  return value && LOOP_PRIORITIES.has(value as DmOpenLoopPriority) ? (value as DmOpenLoopPriority) : "medium"
}

function normalizeLoop(dto: DmOpenLoopDto): DmOpenLoop | null {
  const id = typeof dto.id === "number" && Number.isFinite(dto.id) ? dto.id : 0
  const title = typeof dto.title === "string" ? dto.title.trim() : ""
  const summary = typeof dto.summary === "string" ? dto.summary.trim() : ""
  if (id <= 0 || !title || !summary) {
    return null
  }

  return {
    id,
    title,
    loopType: normalizeLoopType(dto.loopType),
    status: normalizeStatus(dto.status),
    priority: normalizePriority(dto.priority),
    summary,
    nextStep: typeof dto.nextStep === "string" && dto.nextStep.trim().length > 0 ? dto.nextStep : undefined,
    consequence: typeof dto.consequence === "string" && dto.consequence.trim().length > 0 ? dto.consequence : undefined,
    reward: typeof dto.reward === "string" && dto.reward.trim().length > 0 ? dto.reward : undefined,
    location: typeof dto.location === "string" && dto.location.trim().length > 0 ? dto.location : undefined,
    dueAt: typeof dto.dueAt === "string" && dto.dueAt.trim().length > 0 ? dto.dueAt : undefined,
    notes: typeof dto.notes === "string" && dto.notes.trim().length > 0 ? dto.notes : undefined,
    createdAt: typeof dto.createdAt === "string" ? dto.createdAt : undefined,
    updatedAt: typeof dto.updatedAt === "string" ? dto.updatedAt : undefined,
  }
}

function sanitizeInput(input: DmOpenLoopInput) {
  return {
    title: input.title.trim(),
    loopType: input.loopType,
    status: input.status,
    priority: input.priority,
    summary: input.summary.trim(),
    nextStep: input.nextStep?.trim() || null,
    consequence: input.consequence?.trim() || null,
    reward: input.reward?.trim() || null,
    location: input.location?.trim() || null,
    dueAt: input.dueAt?.trim() || null,
    notes: input.notes?.trim() || null,
  }
}

export async function fetchDmOpenLoops(): Promise<DmOpenLoop[]> {
  const response = await backendRequest<DmOpenLoopDto[]>("/v1/dm-open-loops")
  return Array.isArray(response) ? response.map((item) => normalizeLoop(item)).filter((item): item is DmOpenLoop => item !== null) : []
}

export async function createDmOpenLoop(input: DmOpenLoopInput): Promise<DmOpenLoop> {
  const response = await backendRequest<DmOpenLoopDto>("/v1/dm-open-loops", {
    method: "POST",
    body: sanitizeInput(input),
  })
  const loop = normalizeLoop(response)
  if (!loop) {
    throw new Error("Respuesta invalida al crear el Open Loop.")
  }
  return loop
}

export async function updateDmOpenLoop(loopId: number, input: DmOpenLoopInput): Promise<DmOpenLoop> {
  const response = await backendRequest<DmOpenLoopDto>(`/v1/dm-open-loops/${loopId}`, {
    method: "PUT",
    body: sanitizeInput(input),
  })
  const loop = normalizeLoop(response)
  if (!loop) {
    throw new Error("Respuesta invalida al actualizar el Open Loop.")
  }
  return loop
}

export async function deleteDmOpenLoop(loopId: number): Promise<void> {
  await backendRequest<void>(`/v1/dm-open-loops/${loopId}`, {
    method: "DELETE",
  })
}
