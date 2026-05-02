# Dungeon Generator And UI

This is the agent onboarding guide for the frontend dungeon generator and renderer. Read this before opening the large TSX files.

## What This Feature Does

The dungeon feature lets a `mazmorra` landmark use a JSON dungeon map instead of an image map. The frontend can:

- Generate deterministic room-and-corridor dungeon JSON from editor settings.
- Upload generated dungeon JSON as a map asset.
- Render dungeon JSON on a canvas with pan, zoom, doors, markers, walls, labels, colors, and optional textures.
- Edit saved dungeon maps in-place by creating or removing corridors.
- Re-upload edited dungeon JSON and update the landmark's map asset reference.
- Render the same dungeon map in the presentation/map-only view without edit tools.

## Quick File Map

- `Frontend/app/landmarks/[nombreLandmark]/page.tsx`
  - Owns the landmark detail page and dungeon editor sidebar.
  - Builds and persists `DungeonGeneratorConfig` in `landmark.dungeonGeneratorConfig`.
  - Calls `generateDungeonMapDocument` and `stringifyDungeonMapDocument`.
  - Uploads generated or edited JSON with `uploadJsonAsset`.
  - Renders editable `<DungeonMap />` for dungeon landmarks with JSON maps.
- `Frontend/app/presentacion/LandmarkMapOnlyClient.tsx`
  - Read-only presentation renderer.
  - Parses `landmark.dungeonGeneratorConfig.displayStyle` and passes it to `<DungeonMap />`.
- `Frontend/lib/landmarks/map-policy.ts`
  - Decides whether a landmark map should render as `image`, `buildings-json`, `dungeon-json`, or `unsupported`.
  - For `tipo === "mazmorra"`, only uploaded JSON assets (`mapAssetKind === "json"`) become `dungeon-json`; arbitrary JSON references are rejected.
- `Frontend/lib/dungeons/types.ts`
  - Public document contract and normalized render model.
- `Frontend/lib/dungeons/schema.ts`
  - Minimal contract validation for `type`, `version`, and required `layout` fields.
- `Frontend/lib/dungeons/adapter.ts`
  - Validates raw JSON and normalizes all room/corridor/door/marker shapes into `NormalizedDungeonMap`.
- `Frontend/lib/dungeons/generator.ts`
  - Public generator entry point.
  - Orchestrates room placement, topology, corridor routing, corridor cleanup, and final validation.
- `Frontend/lib/dungeons/generator/*`
  - Generator internals. Prefer editing these for generation behavior, not the UI.
- `Frontend/components/dungeons/DungeonMap.tsx`
  - Client component that loads JSON, stores normalized dungeon state, handles edit tools, persists edits, and delegates drawing to `DungeonCanvas`.
- `Frontend/components/dungeons/DungeonCanvas.tsx`
  - Canvas host. Handles viewport sizing, texture loading, camera state, pan/zoom, click hit-testing, and calls `drawDungeon`.
- `Frontend/components/dungeons/canvas/*`
  - Pure-ish render helpers for camera math, geometry, hit-testing, render types, constants, and draw order.
- `Frontend/components/dungeons/dungeon-map-editor.ts`
  - Pure editing helpers: corridor IDs, pathfinding, path compression, door rebuilds, normalized-to-document conversion.
- `Frontend/components/dungeons/DungeonMap.module.css`
  - Canvas container and edit-tool styling.
- `Frontend/lib/dungeons/README.md`
  - Shorter JSON contract and generator API reference.

## Data Model

The persisted file is a `DungeonMapDocument`:

```ts
{
  type: "mazmorra",
  version: 1,
  metadata?: { name?: string; seed?: string | number; generator?: string; notes?: string },
  layout: {
    width: number,
    height: number,
    units?: "tile" | "cell",
    origin?: { x: number; y: number },
    rooms: DungeonRoom[],
    corridors?: DungeonCorridor[],
    doors?: DungeonDoor[],
    markers?: DungeonMarker[],
  }
}
```

The renderer does not draw this raw shape directly. `readDungeonMapDocument(raw)` validates and normalizes it to `NormalizedDungeonMap`, which has:

- `bounds`: width, height, origin, units.
- `rooms`: canonical `cells`, `spans`, bounds, kind, and label anchor.
- `corridors`: IDs, orthogonal point paths, normalized width.
- `doors`: IDs, cell position, direction, kind.
- `markers`: IDs, cell position, kind, optional label.

Supported room shapes in raw JSON:

- `rect`: `{ x, y, width, height }`.
- `composite`: multiple rectangular `parts`.
- `mask`: `{ x, y, mask: { width, height, cells } }` where occupied mask cells are `1`.

Important invariant: render/edit code mostly works in grid cells, not pixels. Pixel conversion happens at the canvas boundary using `BASE_CELL_SIZE = 32`.

## Generator Flow

Public entry point:

```ts
generateDungeonMapDocument(options?: GenerateDungeonMapOptions): DungeonMapDocument
```

The orchestration in `Frontend/lib/dungeons/generator.ts` is:

1. `createGenerationContext(options)` from `generator/core.ts` normalizes grouped and legacy flat options.
2. If preset is `minimal`, returns a valid empty document.
3. `placeRooms(context)` creates rectangular rooms.
4. `buildRoomGraph(placement.rooms, context)` chooses connectivity/topology.
5. `routeCorridors(context, placement.rooms, topology)` routes corridors between rooms.
6. `cleanupCorridors(context, placement.rooms, routing, topology)` finalizes rooms, corridors, and doors.
7. `readDungeonMapDocument(document)` validates the generated result before returning it.

The landmark editor currently saves using legacy flat options, even though the generator also supports grouped options:

```ts
generateDungeonMapDocument({
  preset: "rooms-corridors",
  name,
  seed,
  width,
  height,
  roomCount,
  minRoomWidth,
  maxRoomWidth,
  minRoomHeight,
  maxRoomHeight,
  roomPadding,
  roomDispersion,
  allowCorridorIntersections,
})
```

Use `npm run test:dungeons` from `Frontend/` after generator, schema, adapter, or edit-helper changes.

## Landmark Editor Integration

The dungeon editor lives inside `Frontend/app/landmarks/[nombreLandmark]/page.tsx`.

Key local types:

- `DungeonEditorDraft`: string/boolean form state used by inputs.
- `DungeonGeneratorConfig`: persisted configuration stored as JSON text in `landmark.dungeonGeneratorConfig`.

Key helpers:

- `toDefaultDungeonEditorDraft(name)` builds default input state from `DEFAULT_DUNGEON_DISPLAY_STYLE`.
- `parseDungeonGeneratorConfig(value)` validates persisted config and normalizes texture arrays.
- `toDungeonEditorDraftFromLandmark(landmark)` hydrates the editor from persisted config.
- `buildDungeonGeneratorConfig(seed)` creates the persisted config from normalized draft values.
- `handleSaveGeneratedDungeonMap()` generates JSON, uploads it, updates the landmark with the new `mapAssetId`/`mapAssetKind`, persists `dungeonGeneratorConfig`, and deletes the previous JSON asset best-effort.
- `handleSaveDungeonGeneratorConfig()` saves style/generator settings without regenerating the map JSON.
- `handleExportDungeonJson()` downloads `{ ...documentToExport, generatorConfig }` for manual export/import workflows.
- `handlePersistEditedDungeonDocument(document)` uploads an edited document produced by `<DungeonMap onDocumentChange />` and updates the landmark map asset.

Render routing in the detail page:

- `resolveLandmarkMapMode(...)` returns `dungeon-json` for eligible dungeon JSON assets.
- When `shouldUseDungeonMapPlaceholder && effectiveMapUrl`, the page renders:

```tsx
<DungeonMap
  dataUrl={effectiveMapUrl}
  onLoadError={setBuildingsMapError}
  onDocumentChange={handlePersistEditedDungeonDocument}
  displayStyle={dungeonEditorConfig.displayStyle}
/>
```

Passing `onDocumentChange` is what enables edit mode.

## Presentation Integration

`Frontend/app/presentacion/LandmarkMapOnlyClient.tsx` uses the same `<DungeonMap />`, but without `onDocumentChange`, so it is read-only.

It calls `parseDungeonDisplayStyle(landmark?.dungeonGeneratorConfig)` to extract only `displayStyle` from the saved generator config. That means visual changes saved in the landmark editor can affect presentation without regenerating the dungeon JSON.

## DungeonMap Component Architecture

`DungeonMap.tsx` is the boundary between app state and the canvas renderer.

Props:

- `dataUrl: string`: required URL/data URL for dungeon JSON.
- `onLoadError?: (message: string | null) => void`: receives load or persist errors; `null` clears prior errors.
- `onLoadComplete?: () => void`: called after successful load.
- `onDocumentChange?: (document: DungeonMapDocument) => Promise<void> | void`: enables editing and persists edited documents.
- `displayStyle?: Partial<DungeonDisplayStyle>`: merged over `DEFAULT_DUNGEON_DISPLAY_STYLE`.

Runtime state:

- `dungeon`: current `NormalizedDungeonMap`.
- `error`: load or save error shown as the component state.
- `openDoorIds`: local-only set of toggled/open doors.
- `activeTool`: `none`, `remove-corridor`, or `create-corridor`.
- `pendingCorridorAnchor`: selected room-side start anchor for corridor creation.
- `pendingCorridorPoint`: selected existing corridor intersection start point.
- `isPersistingEdit`: blocks overlapping edits while upload/persist is running.

Load flow:

1. Reset state when `dataUrl` changes.
2. Fetch raw JSON via `fetchJsonAsset<unknown>(dataUrl)`.
3. Normalize with `readDungeonMapDocument(raw)`.
4. Store normalized dungeon and call `onLoadComplete`.
5. On failure, show Spanish load error and call `onLoadError(message)`.

Persist flow:

1. Edit handlers build a next normalized dungeon.
2. `persistDungeonChange(nextDungeon, previousDungeon)` optimistically updates local state.
3. If editable, it calls `onDocumentChange(normalizedDungeonToDocument(nextDungeon))`.
4. If persistence fails, it restores `previousDungeon` and surfaces the error.

## Canvas Architecture

`DungeonCanvas.tsx` owns browser/canvas concerns. It receives already-normalized data and does not fetch or persist anything.

Responsibilities:

- Track root size with `ResizeObserver`.
- Load room/corridor texture images from `displayStyle.roomTextureUrls`, `roomTextureUrl`, `corridorTextureUrls`, and `corridorTextureUrl`.
- Fit camera to map bounds on initial load or bounds/viewport changes.
- Pan with pointer drag when no edit tool is active.
- Zoom around the mouse pointer with wheel input.
- Convert click positions from screen pixels to world grid cells.
- Hit-test doors, room spans, and corridor segments.
- Schedule drawing through `requestAnimationFrame` and account for device pixel ratio.

Important render helpers:

- `canvas/render-types.ts`: constants, `DungeonDisplayStyle`, camera/viewport types, and defaults.
- `canvas/camera.ts`: `fitToView`, `screenToWorld`, `worldToScreen`, and camera clamping.
- `canvas/geometry.ts`: room label positioning, door rectangles, and corridor segment expansion.
- `canvas/hit-test.ts`: room, corridor, and door hit tests.
- `canvas/draw.ts`: actual draw order and style/texture behavior.

Draw order in `drawDungeon`:

1. Black background.
2. Camera-transformed rooms.
3. Room walls.
4. Corridors.
5. Doors.
6. Markers.
7. Labels.
8. Pending corridor anchor.
9. Screen-space grid overlay.

## Editing Model

Edit mode is active only when `DungeonMap` receives `onDocumentChange`.

Tools:

- `remove-corridor`: click a corridor segment to remove the whole corridor.
- `create-corridor`: click a room cell or existing corridor segment/intersection to set a start, then click another valid room/corridor target to create a routed corridor.

Corridor creation from room to room:

1. First room click selects a `RoomSideAnchor` using `pickRoomSideAnchorFromPoint`.
2. Second room click selects another anchor.
3. Start/end hubs are one cell outside each room: `movePoint(anchor.point, anchor.direction)`.
4. Room cells are blocked except the endpoint room cells.
5. `findGridPath(startHub, endHub, bounds, blockedRoomCells, corridorCellKeys)` routes a grid path.
6. `compressPath([startRoomCell, ...route, endRoomCell])` removes redundant collinear points.
7. `buildEditedDungeonWithCorridors` rebuilds doors and normalizes the result.
8. The result is persisted through `onDocumentChange`.

Corridor creation from room/corridor to existing corridor:

- Uses the selected room anchor or pending corridor point as start.
- Routes to the clicked corridor cell.
- Builds a new corridor that can connect into existing corridor geometry.

Corridor removal:

- Filters the selected corridor out of `dungeon.corridors`.
- Calls `rebuildDoorsFromCorridors` so stale doors disappear.
- Persists the updated document.

Pathfinding notes:

- `findGridPath` is weighted grid search with Manhattan heuristic.
- It avoids blocked room cells and stays inside `dungeon.bounds`.
- It mildly prefers existing corridor cells to make intersections natural.
- It penalizes turns slightly to reduce jagged paths.

Door rebuild notes:

- Doors are derived from corridor endpoints touching rooms.
- Door IDs are regenerated as `door-1`, `door-2`, etc. Do not rely on stable door IDs across corridor edits.
- Door open/closed UI state is local to `DungeonMap` and is not persisted.

## Display Style

`DungeonDisplayStyle` is defined in `canvas/render-types.ts` and exported from `DungeonMap.tsx`.

Fields:

- `roomColor`, `corridorColor`, `doorColor`, `corridorWallColor`, `roomWallColor`.
- `roomTextureUrl`, `corridorTextureUrl`: legacy/single texture fields.
- `roomTextureUrls`, `corridorTextureUrls`: preferred texture arrays.
- `roomTextureRandomRotation`, `corridorTextureRandomRotation`.
- `showCorridorWalls`.
- `wallWidth`: normalized cell fraction, clamped to `0.02..0.48` by draw/geometry code.
- `imageSmoothingEnabled`.
- `snapGridToPixel`.

Texture behavior:

- `DungeonCanvas` trims and de-duplicates array textures plus the fallback single URL.
- Failed texture loads are ignored; rendering falls back to solid fills.
- Texture selection is deterministic by cell and dungeon seed.
- Random rotation is deterministic by cell.

## Map Mode Rules

Dungeon maps interact with the general landmark map system through `resolveLandmarkMapMode`.

- Non-dungeon landmarks using JSON render as `buildings-json`.
- Dungeon landmarks using uploaded JSON assets render as `dungeon-json`.
- Dungeon landmarks with arbitrary JSON references are `unsupported`.
- Dungeon landmarks without JSON can still render image maps.

Upload validation in the landmark detail page checks that imported dungeon JSON has `type: "mazmorra"` before treating it as a dungeon map.

## Common Change Guide

- Change generated room placement: edit `Frontend/lib/dungeons/generator/room-placement.ts` and run `npm run test:dungeons`.
- Change graph/connectivity rules: edit `generator/topology.ts`, `generator/graph-builder.ts`, or related topology options in `generator/core.ts`.
- Change corridor routing generated by the generator: edit `generator/corridor-routing.ts`, `generator/route-builder.ts`, or `generator/corridor-cleanup.ts`.
- Change manual corridor editing: edit `components/dungeons/dungeon-map-editor.ts` and the handlers in `DungeonMap.tsx`.
- Change canvas pan/zoom behavior: edit `DungeonCanvas.tsx` and `canvas/camera.ts`.
- Change hit areas: edit `canvas/hit-test.ts` and possibly `canvas/geometry.ts`.
- Change drawing, colors, wall visuals, labels, markers, or textures: edit `canvas/draw.ts` and `canvas/render-types.ts`.
- Change editor inputs/sidebar behavior: edit dungeon-specific sections of `app/landmarks/[nombreLandmark]/page.tsx`.
- Change presentation-only behavior: edit `app/presentacion/LandmarkMapOnlyClient.tsx`.
- Change whether a landmark uses dungeon rendering: edit `lib/landmarks/map-policy.ts`.

## Pitfalls And Invariants

- Do not bypass `readDungeonMapDocument` after creating or editing dungeon JSON; it catches invalid documents and normalizes render data.
- Keep generator output compatible with `DungeonMapDocument` version `1` unless you also add migration/version handling.
- `DungeonMap` state stores normalized data, but persistence expects raw `DungeonMapDocument`; use `normalizedDungeonToDocument`.
- Canvas rendering assumes orthogonal corridor point paths. Diagonal segments are ignored by corridor geometry helpers.
- The renderer uses `bounds.originX`/`originY`; do not assume the grid starts at `(0, 0)`.
- `room.cells` is the source of truth for occupied room cells after normalization.
- Edit tools are disabled while `isPersistingEdit` is true.
- Door IDs are not stable after corridor edits.
- `dungeonGeneratorConfig` stores display style separately from the dungeon JSON. Saving config alone can change future rendering style without changing the uploaded map JSON.
- Presentation mode intentionally does not pass `onDocumentChange`, so edit tools should not appear there.
- Existing JSON assets are deleted only best-effort after a replacement upload succeeds; failure to delete should not block map saving.

## Verification

Useful commands from `Frontend/`:

```bash
npm run test:dungeons
npm run lint
npm run build
```

Manual smoke checks:

- Open a `mazmorra` landmark with no map and generate/save a dungeon.
- Reload the page and confirm the dungeon renders from the uploaded JSON asset.
- Change only display style and save config; confirm presentation/detail rendering uses the new style.
- Use create-corridor between two rooms, then reload and confirm the edited map persisted.
- Use remove-corridor, then reload and confirm stale doors are gone.
- Open presentation/map-only view and confirm it renders read-only without edit tools.
