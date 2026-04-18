# dungeons

## Purpose
Interactive dungeon renderer for JSON maps, with optional in-place corridor editing.

## Key Files and Responsibilities
- `DungeonMap.tsx`
  - Loads a dungeon document from `dataUrl` using `fetchJsonAsset` and normalizes it with `readDungeonMapDocument`.
  - Renders rooms, corridors, doors, markers, labels, grid, and viewport camera (pan + zoom).
  - Supports edit mode when `onDocumentChange` is provided:
    - create corridor (room-side anchor to room-side anchor or existing corridor intersection),
    - remove corridor,
    - rebuild doors from corridors,
    - persist changes and rollback UI on save failure.
  - Exposes load lifecycle callbacks (`onLoadError`, `onLoadComplete`).
- `dungeon-map-editor.ts`
  - Pure helpers for dungeon editing and pathing.
  - Corridor utilities: id generation, path compression, occupancy/cell key extraction.
  - Routing helpers (`findGridPath`, anchor picking, movement/direction helpers).
  - Document conversion (`normalizedDungeonToDocument`) and corridor patching (`buildEditedDungeonWithCorridors`).
- `DungeonMap.module.css`
  - Visual theme and interaction styling (parchment-like map, tools, debug panel, room/door/marker palettes).

## Component API (`DungeonMap`)
- `dataUrl: string` (required)
- `onLoadError?: (message: string | null) => void`
- `onLoadComplete?: () => void`
- `onDocumentChange?: (document: DungeonMapDocument) => Promise<void> | void`

## Behavior Notes
- Without `onDocumentChange`, the component is read-only.
- With `onDocumentChange`, edit tools appear in the top-left panel.
- The map always supports camera controls:
  - drag to pan,
  - mouse wheel to zoom,
  - initial fit-to-viewport camera on load.
- "Debug corredores" toggles per-corridor coloring and labels to inspect routing.
- Persist failures show an error state and restore the previous dungeon snapshot.

## Data Expectations
- `dataUrl` should return a document compatible with the dungeon adapter contract (`type: "mazmorra"`, `version: 1`, valid `layout`).
- Normalization is handled by `readDungeonMapDocument`/adapter layer, so rendering works with canonical `NormalizedDungeonMap` shape.
