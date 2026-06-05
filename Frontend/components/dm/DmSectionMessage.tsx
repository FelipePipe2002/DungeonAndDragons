type DmSectionMessageProps = {
  variant?: "default" | "empty"
  children: React.ReactNode
}

export function DmSectionMessage({ variant = "default", children }: DmSectionMessageProps) {
  const className =
    variant === "empty"
      ? "rounded-md border border-dashed border-border bg-background/80 p-6 text-sm text-muted-foreground"
      : "rounded-md border border-border bg-background p-4 text-sm text-muted-foreground"

  return <div className={className}>{children}</div>
}
