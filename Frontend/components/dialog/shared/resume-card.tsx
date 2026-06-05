import type { KeyboardEvent, ReactNode } from "react"

import { MentionField } from "@/components/mentionField/MentionField"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type ResumeDialogCardProps = {
  className?: string
  onClick?: () => void
  children: ReactNode
}

function handleInteractiveCardKeyDown(event: KeyboardEvent<HTMLElement>, onClick?: () => void) {
  if (!onClick) return

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    onClick()
  }
}

export function ResumeDialogCard({ className, onClick, children }: ResumeDialogCardProps) {
  const interactive = typeof onClick === "function"

  return (
    <Card
      className={cn(
        "w-80 border-primary/20 bg-background p-4 shadow-lg",
        interactive && "cursor-pointer transition-colors hover:bg-secondary/40",
        className,
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (event) => handleInteractiveCardKeyDown(event, onClick) : undefined}
    >
      {children}
    </Card>
  )
}

export function ResumeDialogSectionSeparator() {
  return <Separator className="my-3" />
}

export function ResumeDialogPreviewText({ value }: { value: string }) {
  return (
    <MentionField
      source="auto"
      value={value}
      editable={false}
      className="block text-xs leading-relaxed text-foreground/80 line-clamp-3"
    />
  )
}

export function ResumeDialogTags({ tags, maxVisible = 3 }: { tags: string[]; maxVisible?: number }) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {tags.slice(0, maxVisible).map((tag, index) => (
        <Badge key={`${tag}-${index}`} variant="secondary" className="h-5 px-1.5 py-0 text-[10px]">
          {tag}
        </Badge>
      ))}
      {tags.length > maxVisible ? (
        <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
          +{tags.length - maxVisible}
        </Badge>
      ) : null}
    </div>
  )
}
