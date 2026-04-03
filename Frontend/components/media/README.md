# media

## Purpose
Media picker and upload helpers for inline image embedding.

## Key Files and Responsibilities
- `ImageEmbeddingPicker.tsx`
  - Input + preview for images (URL, upload, or paste).
  - Supports server asset upload via `uploadAsset`.
  - Handles read-only states and edit requests.
  - Normalizes image references (`http`, `https`, `/`, `data:image/*`).

## Data and Props Expectations
- `value` is a URL or data URI; `assetId` is optional server asset ID.
- `usage` is used for logging and semantics (character, organization, map, generic).
- `editable=false` disables input and can call `onRequestEdit` when the user tries to edit.
- `onChange` receives the resolved URL and `assetId` (uploaded asset id or `null`).

## Usage Notes
- Shift+right click on preview opens file picker (editable mode).
- Pastes from clipboard if image or valid URL is detected.
- Click on empty preview triggers file picker when editable.
- URL mode appears only when there is no image set; it uses Enter or the "Cargar" button.

## Behavior Details
- Uploads use the file name if provided; otherwise a fallback name is used.
- When `assetId` is set, the component treats `value` as server-managed and avoids overwriting the URL field.
