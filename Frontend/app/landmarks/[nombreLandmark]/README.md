# Landmark Detail Page

## Purpose
This page is the control center for a single landmark. It combines the interactive map (image or buildings JSON), editing tools, and entity management (characters/buildings/organizations/events) into one workspace.

## Layout Overview
- **Map pane (left):** Shows the landmark map with pan/zoom/rotate and optional combat grid.
- **Info panel (right):** Tabbed sidebar with General, Characters, Buildings, Organizations, and Events.

## Map Source Resolution
Maps are resolved from multiple sources in priority order:
- `mapAssetId` (backend asset image)
- `mapa.kind`:
  - `embedded`: data URL
  - `external`: external URL
  - `asset`: `/maps/<filename>`
  - `stored`: stored asset key
  - `buildings`: buildings JSON map (see below)

## Map Modes
### Image Map Mode
- Standard image map with **pan**, **zoom**, and **rotation** (90-degree steps).
- Panning uses pointer drag state; zoom is clamped to `MIN_SCALE` and `MAX_SCALE`.
- Rotation updates the render bounds and recalculates fit-to-viewport size.

### Buildings JSON Mode
- When the map reference is JSON, `BuildingsMap` is used.
- Supports building linking, focus, and name overlays.
- Supports organization-to-map linking (map blocks can be associated to organizations even without DB buildings), stored on the landmark record.
- Map links are stored as indices that map back to actual building IDs.

## Combat Grid Overlay
- Only enabled for specific landmark types (`puente`, `bandera`, `campamento`, `mazmorra`).
- Grid is rendered over the image map and scales with zoom/rotation.
- Draft values (cell size, offsets) are validated and normalized before saving.

## Data Scoping & Reference Maps
The page merges data from multiple sources to keep relationships consistent:
- **Landmarks, buildings, characters, organizations** are merged into index maps.
- Name maps are built to resolve label references in lists and mentions.
- Scoped lists are derived for the current landmark (buildings, characters, organizations).

## Dialogs & Editing
- **Landmark detail dialog:** edit metadata and map settings.
- **Create event dialog:** add timeline events.
- **Building/Character/Organization dialogs:** open full detail editors.
- **Resume dialogs:** compact previews for list interactions.

## Sidebar Tabs
- **General:** summary, history, tags, counts, and battle history controls.
- **Characters / Buildings / Organizations:** search + list + open detail dialogs.
- **Organizations tab:** includes a map-association mode for linking JSON blocks to organizations.
- **Events:** timeline list, edit, and create flows.

## CSS Module
`LandmarkDetailPage.module.css` holds the layout and map-pane styling (grid overlay, map viewport, panels, and buttons).

## Key Files
- `Frontend/app/landmarks/[nombreLandmark]/page.tsx`
- `Frontend/app/landmarks/[nombreLandmark]/LandmarkDetailPage.module.css`

## Shortcuts and Map Gestures
- **Alt + click** or **Shift + click** a building shape in a buildings JSON map to hide/show that building.
- Hidden buildings are stored on the landmark record (not just local state).
- **Right click a building** in a buildings JSON map to cycle its category.
- **Ctrl + click** on a buildings JSON map creates/finishes a selection rectangle.
- **Ctrl + shift + R** resets stored view state (pan/zoom).
- **Ctrl + R** clears selection rectangle.
- **Esc** clears category highlight.
