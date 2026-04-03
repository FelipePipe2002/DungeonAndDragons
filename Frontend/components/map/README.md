# map

## Purpose
Standalone map viewer with landmark markers and editing controls.

## Key Files and Responsibilities
- `StandaloneMapViewer.tsx`
  - Interactive map with pan/zoom, create/edit landmarks, and marker popovers.
  - Supports drag/drop or file input to replace the map image (stored in localStorage).
  - Manages marker selection, moving, and inline editing.
- `StandaloneMapViewer.module.css`
  - Styles for map viewport, markers, labels, drag-over hints, and popovers.

## Data and Props Expectations
- `initialLandmarks` is required and acts as a fallback if the API fails.
- `initialFolderAssets` maps folders to icon images for landmark types.
- `mapImageUrl` is the default map image, with optional user override from localStorage.

## Controls and Behaviors
- Drag to pan; wheel to zoom with pointer focus.
- Right click: create landmark at position.
- Click marker: open action popover; second click toggles.
- Context menu on marker: open actions.
- Double-click on viewport: open map file picker.

## Pitfalls
- Contains a lot of UI state; avoid large refactors without manual testing.
- Popovers rely on anchor positioning in screen space.
