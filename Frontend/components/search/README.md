# search

## Purpose
Shared search input component with consistent icon placement and sizing.

## Key Files and Responsibilities
- `SearchInput.tsx`
  - Renders a search icon and wraps `ui/input` with a fixed height and left padding.
  - Designed for compact filters and list pages.
  - Exposes container `className` and `inputClassName` overrides.

## Props and Data Expectations
- `value` and `onChange` are required; `onChange` receives the raw string.
- `placeholder` is required and should be short for compact layouts.
- `inputClassName` is applied to the `Input` component for per-screen styling.

## Usage Notes
- The icon is absolutely positioned, so the input includes left padding (`pl-8`).
- Intended for small filters; if you need larger sizing, override `inputClassName` and/or `className`.
- Prefer this component for any icon+input search fields to keep UI consistent.

## Usage Notes
- Prefer this component for any icon+input search fields to keep UI consistent.
