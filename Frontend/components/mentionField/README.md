# mentionField

## Purpose
Rich text textarea with @mention support and hover previews.

## Key Files and Responsibilities
- `MentionField.tsx`
  - Editable textarea with suggestion dropdown.
  - Read-only renderer that parses tokens and shows hover previews.
  - Builds entity lookup from provided lists or auto-fetches via services.
- `Mentions.css`
  - Styles for suggestion dropdown and inline mention links.

## Token Format
- Mention tokens look like: `@[Label](type:id)` where type is `landmark|building|character|organization|item`.

## Data and Props Expectations
- `source="auto"` triggers fetch of landmarks/buildings/characters/organizations/items.
- You can pass `entities` and `mentionLookup` directly to avoid extra fetches.

## Behaviors
- Suggestion dropdown appears when typing `@`.
- Supports arrow navigation, Enter/Tab to insert.
- Hover cards show resume dialogs when type/id is available.
- Clicking an `item` mention opens `ItemDetailDialog` when the item exists in the loaded mention context.

## Extension Points
- Add new mention entity types by extending `MentionEntityType`, parser, and preview renderer.
