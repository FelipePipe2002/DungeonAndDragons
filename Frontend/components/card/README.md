# card

## Purpose
Parchment-style cards for rules content (feats, rules, spells).

## Key Files and Responsibilities
- `feat-card.tsx`
  - Renders feat title, category, prerequisites, and structured entries (paragraph/list/table).
- `rule-card.tsx`
  - Renders rule title and structured entries (paragraph/list/table).
- `spell-card.tsx`
  - Renders spell title, school, meta info, and description/higher-level text.
  - Uses tone mapping by school code for accent colors.

## Data and Props Expectations
- Props are thin wrappers around `Feat`, `Rule`, and `Spell` store models.
- Content is assumed to already be normalized (entries with `kind`).

## Styling Notes
- Inline styles define parchment colors and borders; not theme-aware.
- Spell tones are defined per school code; update `SCHOOL_TONES` to adjust palette.
