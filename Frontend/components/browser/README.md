# browser

## Purpose
Reusable browser-style layout and controls for list/detail screens (two-column compendium pages).

## Key Files and Responsibilities
- `BrowserLayout.tsx`
  - Page shell with background glow, header slot, and two-column grid.
- `BrowserHeader.tsx`
  - Header block with icon, title/subtitle, tab row, and optional actions.
- `BrowserSectionButton.tsx`
  - Section tab button with active/inactive styles.
- `BrowserLinkButton.tsx`
  - Link-styled tab button for cross-page navigation.
- `BrowserSearch.tsx`
  - Search input with optional controls slot (e.g., sort widgets).
- `BrowserListPanel.tsx`
  - Left column container styling.
- `BrowserList.tsx`
  - Scrollable list wrapper for list items.
- `BrowserDetailPanel.tsx`
  - Right panel container with scroll handling.
- `BrowserEmptyState.tsx`
  - Empty-state placeholder for missing selection or no results.

## Usage Notes
- Designed to be composed in pages like `/informacion` but reusable for other list/detail sections.
- `BrowserLinkButton` is intended for quick cross-page navigation aligned with tab styles.
