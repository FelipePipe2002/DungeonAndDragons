# monster

## Purpose
Monster card rendering and search UI.

## Key Files and Responsibilities
- `monster-card.tsx`
  - Renders a detailed monster panel with sections, stats, actions, and extras.
  - Uses a panel model built in `lib/monster/monster-panel-service` and UI CSS from `lib/monster/monster-ui-css`.
  - `ts-nocheck` is enabled due to dynamic data shapes.
- `monsters-search.tsx`
  - Filterable monster list with server-backed pagination and infinite load.
  - Supports text and numeric filters (CR/AC/HP) with debounce.
- `monster-card.js`, `monsters-search.js`
  - Re-export shims to allow JS imports.

## Data and Props Expectations
- `MonsterRecord` is the core model used for rendering.
- Search API expected at `/api/monsters` with `offset`, `limit`, and filters.

## Usage Notes
- `monsters-search` injects UI CSS globally via `<style>`.
- `monster-card` supports `embedded` mode to include UI CSS in-place.
