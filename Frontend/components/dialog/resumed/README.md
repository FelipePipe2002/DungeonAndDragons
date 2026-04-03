# dialog/resumed

## Purpose
Compact entity cards used for previews (hover cards, mention previews).

## Key Files and Responsibilities
- `BuildingResumeDialog.tsx`: Building summary (owner, location, tags).
- `CharacterResumeDialog.tsx`: Character summary (avatar, traits, location, tags).
- `LandmarkResumeDialog.tsx`: Landmark summary (type, population, counts, tags).
- `OrganizationResumeDialog.tsx`: Organization summary (image, categories, members, tags).

## Data and Props Expectations
- Each component loads its own entity by ID using `lib/services/*`.
- Optional `onClick` turns the card into an interactive button.

## Usage Notes
- These are used inside hover cards and mention previews, so keep them lightweight.
- All share a similar layout and can be abstracted into a shared resume card later.
