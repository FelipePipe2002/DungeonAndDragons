# battle

## Purpose
Battle map overlays and combat UI elements for initiative, tokens, fog, and status. These components are used by the battle screen and the presentation screen.

## Key Files and Responsibilities
- `BattleTokenOverlay.tsx`
  - Core interactive overlay for tokens and obstacles.
  - Handles drag, resize, selection, inspector UI, quick delete, and keyboard shortcuts.
  - Supports mirroring/rotation and snapping to grid via CSS variables.
  - Emits preview updates while dragging (optimistic display) and final updates on drop.
- `BattleFogOverlay.tsx`
  - Renders fog-of-war mask and optionally allows editing via pointer input.
  - Supports reveal and erase modes with optional grid snapping (Alt key).
  - Works in percent-based coordinates (0-100) to be resolution independent.
- `BattleInitiativeStrip.tsx`
  - Shows ordered tokens, current turn indicator, and token images or numbers.
  - Supports vertical mirror for presentation views.
  - Shift+click on token image can request character crop edit.
- `BattleStatusBanner.tsx`
  - Compact or presentation-variant banner with round/turn and save state.
  - Can show backend saving/error state (icon + tooltip).
- `CharacterImageCropDialog.tsx`
  - Dialog to adjust portrait framing for token and initiative.
  - Reads/writes crop data via `lib/character-image` helpers.

## Data and Props Expectations
- Uses `BattleToken`, `BattleObstacle`, `BattleState`, `BattleConditionDefinition`, and `Character` from `lib/types`.
- Token and obstacle positions are percentage values (0-100) so overlays scale with map size.
- Many callbacks are optional to allow read-only render (e.g., presentation mode).

## Key Behaviors and Shortcuts
- `BattleTokenOverlay` shortcuts (when interactive and not typing):
  - `Shift` + drag token: move token.
  - `Shift` + wheel on token: resize token.
  - `Shift` + right click: quick delete.
  - `S`: toggle token type (player/enemy).
  - `Shift` + `H`: toggle hidden.
  - `Shift` + `D`: duplicate.
- `BattleFogOverlay` editing:
  - Drag to reveal or erase based on editor mode.
  - Hold `Alt` to snap to grid.

## Styling and CSS Dependencies
- Fog/grid snapping reads CSS variables on the overlay container:
  - `--battle-grid-cell-size`, `--battle-grid-offset-x`, `--battle-grid-offset-y`.
- Token visuals rely on `--map-rotation-deg` and `--map-canvas-scale` for proper transforms.

## Extension Points
- Add new token status icons in `CONDITION_ICON_BY_NAME`.
- Extend token inspector fields via `BattleTokenInspector`.
- Add new obstacle types by extending obstacle rendering and drag logic.

## Pitfalls
- `BattleTokenOverlay` is long and stateful; changes should be tested for drag/keyboard interactions.
- Mirroring logic is used in multiple places; keep token/fog transforms aligned.
