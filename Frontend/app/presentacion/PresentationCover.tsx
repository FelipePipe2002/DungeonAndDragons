import { cn } from "@/lib/utils"

type PresentationCoverProps = {
  alt?: string
  className?: string
  imageClassName?: string
  flipVertical?: boolean
}

export function PresentationCover({
  alt = "Presentacion",
  className,
  imageClassName,
  flipVertical = false,
}: PresentationCoverProps) {
  return (
    <div className={cn("flex items-center justify-center bg-black px-[5vw]", className)}>
      <img
        src="/presentacion.png"
        alt={alt}
        className={cn("h-auto w-[80vw] max-w-[80vw] object-contain", imageClassName)}
        style={flipVertical ? { transform: "scaleY(-1)" } : undefined}
        draggable={false}
        suppressHydrationWarning
      />
    </div>
  )
}
