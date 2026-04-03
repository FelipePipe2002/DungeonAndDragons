# dialog/detailed

## Purpose
Full-detail dialogs for entities and session/event editing.

## Key Files and Responsibilities
- `BuildingDetailDialog.tsx`
  - Create/edit building, assign owner, tags, and location.
  - Owner picker uses character references + popover search.
- `CharacterDetailDialog.tsx`
  - Create/edit character, link buildings/organizations, manage session notes.
  - Launches `CharacterSheetDialog` for sheet edits.
- `CharacterSheetDialog.tsx`
  - Full DnD character sheet editor with derived values (AC, initiative, skills).
  - Handles multi-class and weapons list.
  - Includes a summary header with character name/race/class for quick context.
  - Adds extra scroll padding to prevent list fields from clipping at the bottom.
  - Uses parchment styling and lined list fields to mimic a DnD sheet.
  - Organizes the body into a three-column sheet layout: stats/skills, combat/classes, and roleplay/lists.
  - Keeps panel styling intentionally light to avoid nested-box overload and layout overflow.
  - Uses a wider dialog and compact internal fields so attributes can stay in a 3x2 grid without pushing combat sections out of bounds.
  - Current styling avoids gradients, rounded corners, and excessive nested borders in favor of flatter, denser parchment panels.
  - Skills render in a two-column grid and support manual override values via double-click on the displayed bonus.
  - Uses a flex dialog layout with a native overflow container so the footer action row stays visible while the sheet content scrolls above it.
- `CreateCharacterEventDialog.tsx`
  - Add/edit session notes with required session/order numbers.
- `CreateLandmarkEventDialog.tsx`
  - Add/edit landmark historical events.
- `LandmarkDetailDialog.tsx`
  - Edit landmark details, tags, population, and events.
- `OrganizationDetailDialog.tsx`
  - Edit organization data, members, buildings, and landmarks.
  - Handles multi-picker popovers and pagination for large lists.

## Data and Props Expectations
- All dialogs rely on `lib/services/*` for CRUD.
- `MentionField` is used for rich text; `source="auto"` loads entities.

## Common UI Patterns
- Top-right action bar with Edit/Save/Cancel/Delete.
- `ScrollArea` used to constrain long content.
- Popover pickers for linking related entities.

## Extension Points
- Add validation by extending local save handlers.
- Consider replacing `window.confirm` with `AlertDialog` for consistent UX.
