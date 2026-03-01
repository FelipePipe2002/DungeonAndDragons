"use client"

import type React from "react"
import { cn } from "@/lib/utils"

type FrameBypassProps = React.IframeHTMLAttributes<HTMLIFrameElement> & {
  src: string
}

export function FrameBypass({ className, src, title, sandbox, ...rest }: FrameBypassProps) {
  // Dejamos sandbox opcional; sin valor se omite el atributo para máxima compatibilidad
  const sandboxAttr = sandbox && sandbox.trim().length > 0 ? sandbox : undefined

  return (
    <iframe
      {...rest}
      title={title ?? "Vista embebida"}
      src={src}
      sandbox={sandboxAttr}
      className={cn("size-full border-0", className)}
      allowFullScreen
    />
  )
}
