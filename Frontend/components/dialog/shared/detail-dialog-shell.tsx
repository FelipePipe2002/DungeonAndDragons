import type { ReactNode } from "react"

import { Dialog, DialogContent } from "@/components/ui/dialog"

type DetailDialogShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentClassName: string
  children: ReactNode
}

export function DetailDialogShell({
  open,
  onOpenChange,
  contentClassName,
  children,
}: DetailDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>{children}</DialogContent>
    </Dialog>
  )
}
