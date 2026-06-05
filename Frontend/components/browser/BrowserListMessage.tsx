type BrowserListMessageProps = {
  children: string
  tone?: "default" | "error"
}

export function BrowserListMessage({ children, tone = "default" }: BrowserListMessageProps) {
  return (
    <p
      className={
        tone === "error"
          ? "rounded-sm border border-dashed border-destructive/50 p-4 text-sm text-destructive"
          : "rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground"
      }
    >
      {children}
    </p>
  )
}
