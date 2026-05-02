"use client"

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { ImagePlus, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadAsset } from "@/lib/services/asset-api.service"
import { cn } from "@/lib/utils"

type ImageEmbeddingSource = "url" | "pasted" | "uploaded"
type ImageEmbeddingUsage = "character" | "organization" | "landmark-map" | "generic"
type ImageEmbeddingPreviewMode = "fill" | "fitHeight" | "contain"

interface ImageEmbeddingPickerProps {
  value?: string
  assetId?: number | null
  usage: ImageEmbeddingUsage
  onChange: (value: string, assetId: number | null) => void
  label?: string
  placeholder?: string
  className?: string
  previewClassName?: string
  previewMode?: ImageEmbeddingPreviewMode
  replaceOnClick?: boolean
  editable?: boolean
  onRequestEdit?: () => void
  showUrlControls?: boolean
  compact?: boolean
  overlayTopRight?: ReactNode
}

function isLikelyImageReference(value: string) {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("/")
  )
}

function inferFileNameFromUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return "imagen-url"

  try {
    const parsed = new URL(trimmed)
    const maybeName = parsed.pathname.split("/").pop()
    if (maybeName && maybeName.trim().length > 0) {
      return maybeName
    }
  } catch {
    // Not an absolute URL
  }

  const fallbackName = trimmed.split("/").pop()
  if (fallbackName && fallbackName.trim().length > 0) {
    return fallbackName
  }

  return "imagen-url"
}

function normalizeImageReference(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (isLikelyImageReference(trimmed)) return trimmed
  return ""
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error("No se pudo decodificar la imagen."))
      nextImage.src = objectUrl
    })

    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function convertImageFileToWebp(file: File) {
  if (file.type === "image/webp" || file.type === "image/gif") {
    return file
  }

  const image = await loadImageElement(file)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    throw new Error("La imagen no tiene dimensiones validas.")
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("No se pudo crear el contexto de conversion.")
  }

  context.drawImage(image, 0, 0, width, height)

  const webpBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.9)
  })

  if (!webpBlob) {
    throw new Error("El navegador no pudo convertir la imagen a WebP.")
  }

  const nextName = file.name.replace(/\.[^.]+$/, "") || "imagen"
  return new File([webpBlob], `${nextName}.webp`, { type: "image/webp" })
}

export function ImageEmbeddingPicker({
  value,
  assetId,
  usage,
  onChange,
  label = "Imagen",
  placeholder = "/ruta/archivo.png o https://...",
  className,
  previewClassName,
  previewMode = "fill",
  replaceOnClick = false,
  editable = true,
  onRequestEdit,
  showUrlControls = true,
  compact = false,
  overlayTopRight,
}: ImageEmbeddingPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [urlValue, setUrlValue] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const currentValue = value?.trim() ?? ""
  const hasStoredAsset = typeof assetId === "number" && assetId > 0
  const hasImage = currentValue.length > 0

  useEffect(() => {
    if (hasStoredAsset || !currentValue || currentValue.startsWith("data:image/")) return
    setUrlValue(currentValue)
  }, [currentValue, hasStoredAsset])

  const storeValue = (
    inputValue: string,
    _source: ImageEmbeddingSource,
    fileName: string,
    _mimeType?: string,
  ) => {
    const normalized = inputValue.trim()
    if (!normalized) {
      console.error(`[ImageEmbeddingPicker] Valor de imagen invalido para ${usage}:`, fileName)
      return
    }

    onChange(normalized, null)
  }

  const applyUrl = () => {
    const normalized = normalizeImageReference(urlValue)
    if (!normalized) {
      console.error("[ImageEmbeddingPicker] URL/ruta de imagen invalida:", urlValue)
      return
    }

    storeValue(normalized, "url", inferFileNameFromUrl(normalized))
  }

  const applyFile = async (file: File, _source: ImageEmbeddingSource) => {
    if (!file.type.startsWith("image/")) {
      console.error("[ImageEmbeddingPicker] Solo se permiten archivos de imagen:", file.type)
      return
    }

    setIsBusy(true)
    try {
      let fileToUpload = file
      try {
        fileToUpload = await convertImageFileToWebp(file)
      } catch (error) {
        console.warn("[ImageEmbeddingPicker] No se pudo convertir la imagen a WebP. Se subira el original.", error)
      }

      const uploaded = await uploadAsset(fileToUpload, {
        filename: fileToUpload.name.trim().length > 0 ? fileToUpload.name : "imagen-pegada",
      })
      onChange(uploaded.downloadUrl, uploaded.id)
    } catch (error) {
      console.error("[ImageEmbeddingPicker] No se pudo procesar la imagen.", error)
    } finally {
      setIsBusy(false)
    }
  }

  const handleFileChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    void applyFile(file, "uploaded")
  }

  const handlePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (!editable || isBusy) return

    const clipboardItems = Array.from(event.clipboardData.items)
    const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"))
    if (imageItem) {
      const file = imageItem.getAsFile()
      if (!file) return
      event.preventDefault()
      void applyFile(file, "pasted")
      return
    }

    const pastedText = event.clipboardData.getData("text").trim()
    if (!pastedText) return

    const normalized = normalizeImageReference(pastedText)
    if (!normalized) return

    event.preventDefault()
    setUrlValue(normalized)
    storeValue(normalized, "url", inferFileNameFromUrl(normalized))
  }

  const handlePreviewClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!editable) {
      onRequestEdit?.()
      return
    }

    if (event.ctrlKey || replaceOnClick || !hasImage) {
      fileInputRef.current?.click()
    }
  }

  const handlePreviewContextMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.ctrlKey) {
      event.preventDefault()

      if (!editable) {
        onRequestEdit?.()
        return
      }

      onChange("", null)
      setUrlValue("")
      return
    }

    if (!event.shiftKey) return
    event.preventDefault()

    if (!editable) {
      onRequestEdit?.()
      return
    }

    fileInputRef.current?.click()
  }

  const handleInputFocus = () => {
    if (editable) return
    onRequestEdit?.()
  }

  return (
    <div
      className={cn(
        editable ? "rounded-sm" : "",
        className,
      )}
      onPaste={handlePaste}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={handlePreviewClick}
        onContextMenu={handlePreviewContextMenu}
        className={cn(
          "relative overflow-hidden rounded-sm border border-border bg-card text-left",
          previewMode === "fitHeight" && hasImage ? "w-fit" : "w-full",
          previewClassName ?? "h-44",
          !editable && "cursor-default",
          editable && !hasImage && "cursor-pointer",
        )}
      >
        {hasImage ? (
          isLikelyImageReference(currentValue) ? (
            <img
              src={currentValue}
              alt={label}
              className={
                previewMode === "fitHeight"
                  ? "h-full w-auto object-contain"
                  : previewMode === "contain"
                    ? "size-full object-contain"
                    : "size-full object-cover"
              }
            />
          ) : (
            <div className="flex size-full items-center justify-center px-3 text-xs text-muted-foreground">
              Referencia no valida para vista previa
            </div>
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {editable ? (
              <>
                <ImagePlus className="size-6 opacity-40" />
                {!compact ? (
                  <span className="text-xs uppercase tracking-wider opacity-70">
                    Cargar Imagen
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs uppercase tracking-wider opacity-70">Sin imagen</span>
            )}
          </div>
        )}

        {overlayTopRight ? (
          <div
            className="absolute right-1 top-1 z-10"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {overlayTopRight}
          </div>
        ) : null}
      </button>

      {!hasImage && editable && showUrlControls &&
        (
          <div className="mt-2 flex gap-2">
            <Input
              value={urlValue}
              onFocus={handleInputFocus}
              onChange={(event) => {
                if (!editable) return
                setUrlValue(event.target.value)
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                if (!editable) {
                  onRequestEdit?.()
                  return
                }
                applyUrl()
              }}
              placeholder={editable ? placeholder : undefined}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              onClick={applyUrl}
              disabled={isBusy}
            >
              <Link2 className="mr-1 size-3.5" />
              Cargar
            </Button>

          </div>
        )}
    </div>
  )
}
