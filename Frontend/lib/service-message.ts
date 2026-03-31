"use client"

import { toast } from "@/hooks/use-toast"

type ServiceMessageVariant = "success" | "info" | "error"

type ServiceMessageInput = {
  title: string
  description?: string
  durationMs?: number
}

const DEFAULT_DURATIONS: Record<ServiceMessageVariant, number> = {
  success: 2000,
  info: 2500,
  error: 4500,
}

function showMessage(variant: ServiceMessageVariant, input: ServiceMessageInput) {
  return toast({
    title: input.title,
    description: input.description,
    duration: input.durationMs ?? DEFAULT_DURATIONS[variant],
    variant: variant === "error" ? "error" : variant,
  })
}

export const serviceMessage = {
  success(input: ServiceMessageInput) {
    return showMessage("success", input)
  },
  info(input: ServiceMessageInput) {
    return showMessage("info", input)
  },
  error(input: ServiceMessageInput) {
    return showMessage("error", input)
  },
}

