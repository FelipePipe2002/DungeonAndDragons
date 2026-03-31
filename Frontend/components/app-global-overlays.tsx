"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { Toaster } from "@/components/ui/toaster"
import {
  readPresentationScreenTarget,
  subscribeToPresentationSceneStatus,
} from "@/lib/presentation/screen"
import { serviceMessage } from "@/lib/service-message"

export function AppGlobalOverlays() {
  const pathname = usePathname()
  const lastHandledPresentationStatusKeyRef = useRef<string | null>(null)
  const isPresentationRoute = pathname === "/presentacion"

  useEffect(() => {
    if (isPresentationRoute) {
      return
    }

    return subscribeToPresentationSceneStatus((payload) => {
      const currentTarget = readPresentationScreenTarget()
      if (
        !currentTarget ||
        payload.revision !== currentTarget.revision ||
        payload.sceneType !== currentTarget.sceneType ||
        payload.sceneSlug !== currentTarget.sceneSlug
      ) {
        return
      }

      const notificationKey = `${payload.revision}:${payload.status}:${payload.sceneType}:${payload.sceneSlug}:${payload.message ?? ""}`
      if (lastHandledPresentationStatusKeyRef.current === notificationKey) {
        return
      }

      lastHandledPresentationStatusKeyRef.current = notificationKey

      if (payload.status === "loaded") {
        serviceMessage.success({
          title: "Mapa cargado",
          description: `Se cargo exitosamente el mapa ${payload.sceneLabel}`,
        })
        return
      }

      serviceMessage.error({
        title: "Error al cargar mapa",
        description: payload.message
          ? `No se pudo cargar el mapa ${payload.sceneLabel}: ${payload.message}`
          : `No se pudo cargar el mapa ${payload.sceneLabel}`,
      })
    })
  }, [isPresentationRoute])

  if (isPresentationRoute) {
    return null
  }

  return <Toaster />
}
