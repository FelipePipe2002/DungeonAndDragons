# frameBypass

## Purpose
Generic iframe wrapper that handles optional sandbox and shared styling for embedded tools.

## Key Files and Responsibilities
- `FrameBypass.tsx`
  - Wraps `<iframe>` with shared `cn` styling and optional `sandbox`.
  - Omits the sandbox attribute if empty to maximize compatibility.
  - Defaults `title` to `"Vista embebida"` and always allows fullscreen.

## Props and Behavior
- Extends `React.IframeHTMLAttributes<HTMLIFrameElement>` so native iframe props are supported.
- `sandbox` is only applied when it is a non-empty string; passing `""` removes it.
- `className` is merged with `size-full border-0` to fill the container.

## Usage Notes
- Use when embedding external tools or map viewers in the app shell.
- Prefer supplying a specific `title` for accessibility when possible.
- If a tool fails to render, check if a strict `sandbox` value is the cause.

## Usage Notes
- Use when embedding external tools or map viewers in the app shell.
