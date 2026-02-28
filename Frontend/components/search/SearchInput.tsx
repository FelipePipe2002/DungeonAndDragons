import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  inputClassName?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("h-8 border-border bg-card pl-8 text-xs", inputClassName)}
      />
    </div>
  )
}

