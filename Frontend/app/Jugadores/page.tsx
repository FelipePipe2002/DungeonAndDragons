import { CharactersPageContent } from "@/components/characters/CharactersPageContent"

export default function JugadoresPage() {
  return (
    <CharactersPageContent
      title="Jugadores"
      emptyLabel="jugadores registrados en el codex"
      loadingLabel="Cargando jugadores..."
      noMatchesLabel="No hay jugadores que coincidan."
      creationLabel="Crear Jugador"
      scope="players"
    />
  )
}
