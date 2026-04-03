# dialog

## Purpose
Entity dialogs for full detail editing and compact resume/preview cards. This folder is a routing point for two parallel dialog systems that share domain models and service calls.

## Subfolders
- `detailed/`: Full CRUD dialogs and sheets.
- `resumed/`: Compact resume cards used in hover and mention previews.

## Usage Notes
- The detailed dialogs typically handle create/edit flows, validation, and save/delete actions.
- The resumed cards are read-only previews meant for hover cards or mention popovers.
- Most dialogs are client components and depend on backend services from `lib/services/*`.
- Shared UI pieces live in `Frontend/components/ui` (e.g., `dialog`, `sheet`, `button`, `field`).

## Where to Look Next
- See `Frontend/components/dialog/detailed/README.md` for the entity-specific edit dialogs.
- See `Frontend/components/dialog/resumed/README.md` for resume/preview cards and small panels.
