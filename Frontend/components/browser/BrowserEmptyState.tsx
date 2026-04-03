type BrowserEmptyStateProps = {
  title: string
  description?: string
}

export function BrowserEmptyState({ title, description }: BrowserEmptyStateProps) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-sm border border-dashed border-border bg-card p-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-serif text-primary">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {description ?? "No hay resultados para el filtro actual. Proba con otra busqueda o selecciona otra categoria."}
        </p>
      </div>
    </div>
  )
}
