export type DmOpenLoopType = "rescue" | "threat" | "sidequest" | "opportunity" | "plan" | "bounty" | "mystery" | "debt"

export type DmOpenLoopStatus = "open" | "in-progress" | "blocked" | "urgent" | "resolved" | "failed"

export type DmOpenLoopPriority = "low" | "medium" | "high" | "critical"

export interface DmOpenLoop {
  id: number
  title: string
  loopType: DmOpenLoopType
  status: DmOpenLoopStatus
  priority: DmOpenLoopPriority
  summary: string
  nextStep?: string
  consequence?: string
  reward?: string
  location?: string
  dueAt?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface DmOpenLoopInput {
  title: string
  loopType: DmOpenLoopType
  status: DmOpenLoopStatus
  priority: DmOpenLoopPriority
  summary: string
  nextStep?: string
  consequence?: string
  reward?: string
  location?: string
  dueAt?: string
  notes?: string
}
