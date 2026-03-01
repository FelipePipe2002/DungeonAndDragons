import { CharactersPageContent } from "@/components/characters/CharactersPageContent"

export default function PersonajesPage() {
  return (
    <CharactersPageContent
      title="Personajes"
      emptyLabel="personajes registrados en el codex"
      loadingLabel="Cargando personajes..."
      noMatchesLabel="No hay personajes que coincidan."
      creationLabel="Crear Personaje"
      scope="npcs"
    />
  )
}
