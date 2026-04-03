# buildings

## Purpose
Render the city/buildings map and support selection, filtering, and event placement.

## Key Files and Responsibilities
- `BuildingsMap.tsx`
  - Loads a JSON map asset and converts geometry into SVG primitives.
  - Renders buildings, walls, water, rivers, roads, trees, and event markers.
  - Supports panning, zoom, selection rectangle, category highlighting, and linking buildings.
  - Also supports map-linking organizations to JSON map building indices.
  - Persists local UI state (hidden walls/buildings, gates, zoom, center, selection) per `dataUrl`.

## Data and Props Expectations
- `dataUrl` is required to load map geometry; expected to contain specific feature indices (earth, buildings, walls, rivers, water).
- `events` is an array of `LandmarkEvent` with `posicion` used for markers.
- `buildingLinks` and `buildingNames` map map-building indices to backend building IDs/names.
- `highlightBuildingIndices` can be used to outline map blocks without dimming others (e.g., org link mode).
- `hiddenBuildingIndices` and `onHiddenBuildingsChange` allow external persistence of hidden buildings.
- Callback props allow: placing events, assigning links (building/org), opening buildings, reacting to load errors.

## Controls and Shortcuts
- Drag to pan; mouse wheel to zoom (with pointer-based zoom).
- `Ctrl + click` creates/finishes selection rectangle.
- `Ctrl + shift + R` resets stored view state.
- `Ctrl + R` clears selection.
- `Esc` clears category highlight.
- Right click on walls/tiles toggles visibility (when not in placement mode).

## Styling and Visuals
- Uses a custom serif look; many colors are hard-coded in the component.
- Includes a legend for building categories and highlight toggles.

## Pitfalls
- Geometry parsing assumes fixed indices in the asset. If the asset schema changes, update indices.
- Large component; changes should be tested with big map assets for performance.
