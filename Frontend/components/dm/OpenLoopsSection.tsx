"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MentionField } from "@/components/mentionField/MentionField"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getBackendErrorMessage } from "@/lib/services/backend-api.service"
import { createDmOpenLoop, deleteDmOpenLoop, fetchDmOpenLoops, updateDmOpenLoop } from "@/lib/services/dm-open-loops-api.service"
import type { DmOpenLoop, DmOpenLoopInput, DmOpenLoopPriority, DmOpenLoopStatus, DmOpenLoopType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Pencil, Plus, Trash2, X } from "lucide-react"

type OpenLoopFormState = {
  title: string
  loopType: DmOpenLoopType
  status: DmOpenLoopStatus
  priority: DmOpenLoopPriority
  summary: string
  nextStep: string
  consequence: string
  reward: string
  location: string
  dueAt: string
  notes: string
}

const LOOP_TYPE_LABEL: Record<DmOpenLoopType, string> = {
  rescue: "Rescue",
  threat: "Threat",
  sidequest: "Sidequest",
  opportunity: "Opportunity",
  plan: "Plan",
  bounty: "Bounty",
  mystery: "Mystery",
  debt: "Debt",
}

const LOOP_STATUS_LABEL: Record<DmOpenLoopStatus, string> = {
  open: "Open",
  "in-progress": "In Progress",
  blocked: "Blocked",
  urgent: "Urgent",
  resolved: "Resolved",
  failed: "Failed",
}

const LOOP_PRIORITY_LABEL: Record<DmOpenLoopPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

const LOOP_TYPE_ORDER: DmOpenLoopType[] = ["rescue", "threat", "sidequest", "opportunity", "plan", "bounty", "mystery", "debt"]
const LOOP_STATUS_ORDER: DmOpenLoopStatus[] = ["open", "in-progress", "blocked", "urgent", "resolved", "failed"]
const LOOP_PRIORITY_ORDER: DmOpenLoopPriority[] = ["low", "medium", "high", "critical"]
const PRIORITY_RANK: Record<DmOpenLoopPriority, number> = { low: 0, medium: 1, high: 2, critical: 3 }
const STATUS_RANK: Record<DmOpenLoopStatus, number> = { urgent: 0, open: 1, "in-progress": 2, blocked: 3, resolved: 4, failed: 5 }

const EMPTY_FORM: OpenLoopFormState = {
  title: "",
  loopType: "sidequest",
  status: "open",
  priority: "medium",
  summary: "",
  nextStep: "",
  consequence: "",
  reward: "",
  location: "",
  dueAt: "",
  notes: "",
}

function formatTimestamp(value?: string) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function buildInputPayload(form: OpenLoopFormState): DmOpenLoopInput {
  return {
    title: form.title,
    loopType: form.loopType,
    status: form.status,
    priority: form.priority,
    summary: form.summary,
    nextStep: form.nextStep,
    consequence: form.consequence,
    reward: form.reward,
    location: form.location,
    dueAt: form.dueAt,
    notes: form.notes,
  }
}

function buildFormState(loop: DmOpenLoop): OpenLoopFormState {
  return {
    title: loop.title,
    loopType: loop.loopType,
    status: loop.status,
    priority: loop.priority,
    summary: loop.summary,
    nextStep: loop.nextStep ?? "",
    consequence: loop.consequence ?? "",
    reward: loop.reward ?? "",
    location: loop.location ?? "",
    dueAt: loop.dueAt ?? "",
    notes: loop.notes ?? "",
  }
}

function statusBadgeClass(status: DmOpenLoopStatus) {
  switch (status) {
    case "urgent":
      return "border-red-500/40 bg-red-500/10 text-red-300"
    case "in-progress":
      return "border-blue-500/40 bg-blue-500/10 text-blue-300"
    case "blocked":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300"
    case "resolved":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    case "failed":
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
    default:
      return "border-primary/30 bg-primary/10 text-primary"
  }
}

function priorityBadgeClass(priority: DmOpenLoopPriority) {
  switch (priority) {
    case "critical":
      return "border-red-500/40 bg-red-500/10 text-red-300"
    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-300"
    case "medium":
      return "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
    default:
      return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300"
  }
}

function sortLoops(items: DmOpenLoop[]) {
  return [...items].sort((left, right) => {
    const leftResolved = left.status === "resolved" || left.status === "failed"
    const rightResolved = right.status === "resolved" || right.status === "failed"
    if (leftResolved !== rightResolved) {
      return leftResolved ? 1 : -1
    }

    const statusRank = STATUS_RANK[left.status] - STATUS_RANK[right.status]
    if (statusRank !== 0) {
      return statusRank
    }

    const priorityRank = PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority]
    if (priorityRank !== 0) {
      return priorityRank
    }

    return new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() - new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
  })
}

export function OpenLoopsSection() {
  const [loops, setLoops] = useState<DmOpenLoop[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | DmOpenLoopStatus>("all")
  const [editingLoopId, setEditingLoopId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DmOpenLoop | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<OpenLoopFormState>(EMPTY_FORM)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setLoops(sortLoops(await fetchDmOpenLoops()))
    } catch (loadError) {
      setError(getBackendErrorMessage(loadError, "No se pudieron cargar los Open Loops."))
      setLoops([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredLoops = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es")
    return loops.filter((loop) => {
      if (statusFilter !== "all" && loop.status !== statusFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        loop.title,
        LOOP_TYPE_LABEL[loop.loopType],
        LOOP_STATUS_LABEL[loop.status],
        LOOP_PRIORITY_LABEL[loop.priority],
        loop.summary,
        loop.nextStep ?? "",
        loop.consequence ?? "",
        loop.reward ?? "",
        loop.location ?? "",
        loop.notes ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("es")

      return haystack.includes(normalizedSearch)
    })
  }, [loops, search, statusFilter])

  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setEditingLoopId(null)
    setIsFormOpen(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim()) {
      setFormError("El titulo es obligatorio.")
      return
    }

    if (!form.summary.trim()) {
      setFormError("El resumen es obligatorio.")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      const payload = buildInputPayload(form)
      const savedLoop = editingLoopId === null ? await createDmOpenLoop(payload) : await updateDmOpenLoop(editingLoopId, payload)
      setLoops((current) => sortLoops(editingLoopId === null ? [savedLoop, ...current] : current.map((loop) => (loop.id === savedLoop.id ? savedLoop : loop))))
      resetForm()
    } catch (saveError) {
      setFormError(getBackendErrorMessage(saveError, "No se pudo guardar el Open Loop."))
    } finally {
      setIsSaving(false)
    }
  }, [editingLoopId, form, resetForm])

  const handleEdit = useCallback((loop: DmOpenLoop) => {
    setEditingLoopId(loop.id)
    setForm(buildFormState(loop))
    setFormError(null)
    setIsFormOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return

    setIsDeleting(true)
    try {
      await deleteDmOpenLoop(deleteTarget.id)
      setLoops((current) => current.filter((loop) => loop.id !== deleteTarget.id))
      if (editingLoopId === deleteTarget.id) {
        resetForm()
      }
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(getBackendErrorMessage(deleteError, "No se pudo eliminar el Open Loop."))
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTarget, editingLoopId, isDeleting, resetForm])

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-primary">Open Loops</h2>
            <p className="mt-1 text-sm text-muted-foreground">Track unresolved threats, rescues, plans, bounties, debts, and side objectives.</p>
          </div>

          <Button type="button" onClick={() => {
            if (isFormOpen && editingLoopId === null) {
              resetForm()
              return
            }

            setForm({ ...EMPTY_FORM })
            setFormError(null)
            setEditingLoopId(null)
            setIsFormOpen(true)
          }}>
            {isFormOpen && editingLoopId === null ? <X className="size-4" /> : <Plus className="size-4" />}
            {isFormOpen && editingLoopId === null ? "Cerrar" : "Agregar Loop"}
          </Button>
        </div>

        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        {isFormOpen ? (
          <div className="mb-6 space-y-4 rounded-md border border-border bg-background/60 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 xl:col-span-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-title">Title</label>
                <Input id="open-loop-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Rescue Juan from the casino" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type</label>
                <Select value={form.loopType} onValueChange={(value) => setForm((current) => ({ ...current, loopType: value as DmOpenLoopType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOOP_TYPE_ORDER.map((type) => <SelectItem key={type} value={type}>{LOOP_TYPE_LABEL[type]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Location</label>
                <Input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Port Nyanzaru" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as DmOpenLoopStatus }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOOP_STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{LOOP_STATUS_LABEL[status]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Priority</label>
                <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as DmOpenLoopPriority }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOOP_PRIORITY_ORDER.map((priority) => <SelectItem key={priority} value={priority}>{LOOP_PRIORITY_LABEL[priority]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 xl:col-span-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-due-at">Deadline</label>
                <Input id="open-loop-due-at" type="text" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} placeholder="Before the eclipse / 3 days / Next market day" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Summary</label>
              <MentionField
                source="auto"
                value={form.summary}
                onChange={(value) => setForm((current) => ({ ...current, summary: value }))}
                placeholder="What is happening, and why does it matter?"
                rows={4}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-next-step">Next Step</label>
                <Textarea id="open-loop-next-step" value={form.nextStep} onChange={(event) => setForm((current) => ({ ...current, nextStep: event.target.value }))} placeholder="What the party is likely to do next" rows={4} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-consequence">If Ignored</label>
                <Textarea id="open-loop-consequence" value={form.consequence} onChange={(event) => setForm((current) => ({ ...current, consequence: event.target.value }))} placeholder="Juan dies, bounty hunters close in, the opportunity is lost..." rows={4} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-reward">Reward / Payoff</label>
                <Textarea id="open-loop-reward" value={form.reward} onChange={(event) => setForm((current) => ({ ...current, reward: event.target.value }))} placeholder="Gold, favor, resurrection, safety, reputation..." rows={4} />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="open-loop-notes">Notes</label>
                <Textarea id="open-loop-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Extra context, hooks, or hidden consequences" rows={4} />
              </div>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>Cancel</Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={isSaving}>{editingLoopId === null ? "Guardar Loop" : "Actualizar Loop"}</Button>
            </div>
          </div>
        ) : null}

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, place, consequence, reward..." />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | DmOpenLoopStatus)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LOOP_STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{LOOP_STATUS_LABEL[status]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">Cargando Open Loops...</div>
        ) : filteredLoops.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background/80 p-6 text-sm text-muted-foreground">
            No hay Open Loops todavia. Agrega rescates, amenazas, recompensas, planes o sidequests para seguir la campana.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLoops.map((loop) => {
              const updatedLabel = formatTimestamp(loop.updatedAt ?? loop.createdAt)

              return (
                <article key={loop.id} className="rounded-md border border-border bg-background/80 p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-xl text-primary">{loop.title}</h3>
                        <Badge variant="outline">{LOOP_TYPE_LABEL[loop.loopType]}</Badge>
                        <Badge variant="outline" className={cn(statusBadgeClass(loop.status))}>{LOOP_STATUS_LABEL[loop.status]}</Badge>
                        <Badge variant="outline" className={cn(priorityBadgeClass(loop.priority))}>{LOOP_PRIORITY_LABEL[loop.priority]}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {loop.location ? <span>Location: {loop.location}</span> : null}
                        {loop.dueAt ? <span>Deadline: {loop.dueAt}</span> : null}
                        {updatedLabel ? <span>Updated: {updatedLabel}</span> : null}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => handleEdit(loop)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button type="button" variant="destructive" size="sm" className="h-8 px-2" onClick={() => setDeleteTarget(loop)} disabled={isDeleting}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
                      <MentionField
                        source="auto"
                        value={loop.summary}
                        editable={false}
                        emptyText=""
                        className="mt-1 text-sm leading-relaxed text-foreground"
                      />
                    </div>

                    {loop.nextStep ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next Step</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{loop.nextStep}</p>
                      </div>
                    ) : null}

                    {loop.consequence ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">If Ignored</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{loop.consequence}</p>
                      </div>
                    ) : null}

                    {loop.reward ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reward / Payoff</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{loop.reward}</p>
                      </div>
                    ) : null}
                  </div>

                  {loop.notes ? (
                    <div className="mt-4 border-t border-border/70 pt-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{loop.notes}</p>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
          }
        }}
        title="Eliminar Open Loop"
        description={deleteTarget ? `Se eliminara \"${deleteTarget.title}\".` : ""}
        confirmLabel={isDeleting ? "Eliminando..." : "Eliminar"}
        cancelLabel="Cancelar"
        confirmVariant="destructive"
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  )
}
