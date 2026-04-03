# components

## Purpose
High-level React components used across the frontend. This folder contains app shell pieces (nav, overlays) and domain-specific component folders.

## Top-Level Components
- `app-global-overlays.tsx`
  - Shows global toaster (`ui/toaster`) and listens for presentation screen load status.
  - Disabled on `/presentacion` route to avoid overlay in presentation mode.
- `app-nav.tsx`
  - Main top navigation with icons and active state.
  - Includes presentation window trigger and settings button.
- `global-navigation-shortcuts.tsx`
  - Keyboard shortcuts for main navigation (Alt + 1..8) and settings (Alt + C).
  - Ignores input/textarea/contentEditable targets.
- `nav-settings-sheet.tsx`
  - Right-side sheet listing global/local shortcuts for the current route.
  - Uses `Tabs` to switch between global/local lists.
- `theme-provider.tsx`
  - Next-themes wrapper used at the app root.

## Subfolders
- `battle/`: Battle map overlays, tokens, initiative, fog, and crop dialog.
- `buildings/`: City/building SVG map renderer with interactions and state persistence.
- `browser/`: Reusable browser-style layout and controls for list/detail screens.
- `card/`: Rule/feat/spell cards with parchment styling.
- `characters/`: Characters list page content and dialogs wiring.
- `dialog/`: Detailed CRUD dialogs and compact resume cards.
- `frameBypass/`: Generic iframe wrapper.
- `map/`: Standalone map viewer (landmarks, upload, edit) and styles.
- `media/`: Media pickers and upload helpers.
- `mentionField/`: Mention input and read-only rendering.
- `monster/`: Monster card renderer and search UI.
- `search/`: Search input UI.
- `ui/`: Shared UI primitives and hooks.

## Usage Notes
- Most components are client components and depend on `lib/services/*` for data.
- Keep presentation route logic in mind when adding global overlays or shortcuts.
