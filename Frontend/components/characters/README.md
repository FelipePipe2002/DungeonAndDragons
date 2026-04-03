# characters

## Purpose
Characters list page content and related UI.

## Key Files and Responsibilities
- `CharactersPageContent.tsx`
  - Fetches characters and reference lookups (landmarks/buildings/orgs).
  - Supports scope switching (players vs NPCs).
  - Provides search across multiple fields (name, race, class, description, tags, locations).
  - Opens `CharacterDetailDialog` for edit/view and `CharacterSheetDialog` for sheet edit.
- `CharacterCard.tsx`
  - Card UI for a single character with quick actions and sheet access.
  - Always shows a sheet button ("Hoja" or "Crear hoja") for consistent access.
- `CharactersPageHeader.tsx`
  - Shared header with scope toggle and create action.

## Data and Props Expectations
- Uses `fetchCharacters`, `fetchCharacterReferences`, and `updateCharacter` services.
- Requires consistent IDs for landmarks/buildings/organizations to show names.

## UI Behavior
- Character cards are clickable; keyboard support on Enter/Space.
- Uses `SearchInput` and `Badge` from shared UI.

## Extension Points
- Add new filter facets by extending `matchesSearchQuery` calls.
- If list gets large, consider pagination or infinite scroll.
