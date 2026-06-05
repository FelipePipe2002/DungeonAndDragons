"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { CharacterDetailDialog } from "@/components/dialog/detailed/CharacterDetailDialog"
import { EstadoDetailDialog } from "@/components/dialog/detailed/EstadoDetailDialog"
import { LandmarkDetailDialog } from "@/components/dialog/detailed/LandmarkDetailDialog"
import { EntitiesPageHeader } from "@/components/entities/EntitiesPageHeader"
import { EstadoResumeDialog } from "@/components/dialog/resumed/EstadoResumeDialog"
import { SearchInput } from "@/components/search/SearchInput"
import { Button } from "@/components/ui/button"
import { matchesSearchQuery } from "@/lib/search/utils"
import { fetchEstados } from "@/lib/services/estado-api.service"
import type { Estado } from "@/lib/types"
import { Crown, Plus } from "lucide-react"

type EstadosPageContentProps = {
  showHeader?: boolean
}

export function EstadosPageContent({ showHeader = true }: EstadosPageContentProps) {
  const [estadosData, setEstadosData] = useState<Estado[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEstadoId, setSelectedEstadoId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [estadoDialogStack, setEstadoDialogStack] = useState<number[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null)
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false)
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<number | null>(null)
  const [isLandmarkDialogOpen, setIsLandmarkDialogOpen] = useState(false)

  const loadPageData = useCallback(async () => {
    const stored = await fetchEstados(true).catch(() => [])
    stored.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    setEstadosData(stored)
  }, [])

  useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const filteredEstados = useMemo(
    () =>
      estadosData
        .filter((estado) => typeof estado.estadoPadreId !== "number")
        .filter((estado) => matchesSearchQuery(searchQuery, estado.nombre, estado.tipo, estado.gobiernoTipo)),
    [estadosData, searchQuery],
  )

  const visibleRootCount = useMemo(
    () => estadosData.filter((estado) => typeof estado.estadoPadreId !== "number").length,
    [estadosData],
  )

  const createEstadoAction = (
    <Button
      onClick={() => {
        setSelectedEstadoId(null)
        setDialogOpen(true)
      }}
      className="gap-2"
    >
      <Plus className="size-4" />
      Crear Estado
    </Button>
  )

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <EntitiesPageHeader
        showHeader={showHeader}
        title="Estados"
        summary={`${filteredEstados.length} de ${visibleRootCount} estados registrados`}
        icon={<Crown className="size-5 text-primary" />}
        action={createEstadoAction}
      />

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nombre, tipo o gobierno..." className="mb-4" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredEstados.map((estado) => (
          <EstadoResumeDialog
            key={estado.id}
            estadoId={estado.id}
            openOnClick={false}
            onClick={() => {
              setSelectedEstadoId(estado.id)
              setDialogOpen(true)
            }}
          />
        ))}
      </div>
      {filteredEstados.length === 0 ? <p className="mt-6 text-center text-sm text-muted-foreground">No hay estados que coincidan.</p> : null}

      <EstadoDetailDialog
        estadoId={selectedEstadoId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedEstadoId(null)
            setEstadoDialogStack([])
          }
        }}
        onEstadoUpdated={() => {
          void loadPageData()
        }}
        onEstadoDeleted={() => {
          setDialogOpen(false)
          setSelectedEstadoId(null)
          void loadPageData()
        }}
        onOpenEstado={(nextEstadoId) => {
          setEstadoDialogStack((prev) => [...prev, nextEstadoId])
        }}
        onOpenCharacter={(characterId) => {
          setSelectedCharacterId(characterId)
          setIsCharacterDialogOpen(true)
        }}
        onOpenLandmark={(landmarkId) => {
          setSelectedLandmarkId(landmarkId)
          setIsLandmarkDialogOpen(true)
        }}
      />

      {estadoDialogStack.map((estadoId, index) => (
        <EstadoDetailDialog
          key={`${estadoId}-${index}`}
          estadoId={estadoId}
          open={true}
          onOpenChange={(open) => {
            if (open) return
            setEstadoDialogStack((prev) => prev.slice(0, index))
          }}
          onEstadoUpdated={() => {
            void loadPageData()
          }}
          onEstadoDeleted={() => {
            setEstadoDialogStack((prev) => prev.slice(0, index))
            void loadPageData()
          }}
          onOpenEstado={(nextEstadoId) => {
            setEstadoDialogStack((prev) => [...prev, nextEstadoId])
          }}
          onOpenCharacter={(characterId) => {
            setSelectedCharacterId(characterId)
            setIsCharacterDialogOpen(true)
          }}
          onOpenLandmark={(landmarkId) => {
            setSelectedLandmarkId(landmarkId)
            setIsLandmarkDialogOpen(true)
          }}
        />
      ))}

      <CharacterDetailDialog
        characterId={selectedCharacterId}
        open={isCharacterDialogOpen}
        onOpenChange={(open) => {
          setIsCharacterDialogOpen(open)
          if (!open) setSelectedCharacterId(null)
        }}
        onCharacterUpdated={() => {
          void loadPageData()
        }}
      />

      <LandmarkDetailDialog
        landmarkId={selectedLandmarkId}
        open={isLandmarkDialogOpen}
        onOpenChange={(open) => {
          setIsLandmarkDialogOpen(open)
          if (!open) setSelectedLandmarkId(null)
        }}
        onLandmarkUpdated={() => {
          void loadPageData()
        }}
      />
    </div>
  )
}
