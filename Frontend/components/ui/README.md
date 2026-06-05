# ui

## Purpose
Shared UI primitives, patterns, and hooks used across the app. Most components are thin wrappers around Radix UI primitives with consistent styling and `data-slot` attributes for theming.

## Key Dependencies
- Radix UI primitives (`@radix-ui/react-*`) for accessible base behavior.
- `class-variance-authority` (`cva`) for variant styling in core components.
- `@/lib/utils` `cn` helper for class composition.
- Lucide icons for UI affordances.
- `react-hook-form`, `cmdk`, `embla-carousel`, `recharts`, `react-day-picker`, `vaul`, `sonner` for specific controls.

## Contents
### Layout & Containers
- `accordion`: Radix accordion with icon rotation and structured slots.
- `aspect-ratio`: Radix aspect ratio wrapper.
- `card`: Card building blocks (header, title, description, content, footer, action).
- `empty`: Empty-state layouts with icon/media variants.
- `item`: List item layout utilities with media/content/actions and separators.
- `scroll-area`: Radix scroll area with vertical/horizontal scrollbars.
- `separator`: Radix separator (horizontal/vertical).
- `table`: Table primitives wrapped in a scroll container.
- `tabs`: Radix tabs with list/trigger/content.
- `resizable`: `react-resizable-panels` wrappers with optional handle grip.
- `skeleton`: Animated loading placeholders.
- `breadcrumb`: Breadcrumb primitives with separators and ellipsis.
- `pagination`: Pagination controls (active state, previous/next, ellipsis).

### Inputs & Controls
- `button`: Variant/size-aware button (exports `buttonVariants`).
- `button-group`: Grouped button layouts with separators.
- `input`: Styled text input.
- `textarea`: Styled textarea.
- `input-group`: Composite input layout with addons, buttons, and focus handling.
- `input-otp`: OTP input with grouped slots and separators.
- `checkbox`: Radix checkbox.
- `radio-group`: Radix radio group with item indicator.
- `switch`: Radix switch.
- `slider`: Radix slider with dynamic thumb count based on values.
- `select`: Radix select with trigger, content, item, and scroll buttons.
- `toggle`: Radix toggle with variants.
- `toggle-group`: Radix toggle group with inherited variants.
- `label`: Radix label wrapper.
- `field`: Fieldset and input meta blocks (label, description, errors).
- `form`: React Hook Form adapters (FormProvider + Controller wrappers).

### Overlay & Popup
- `dialog`: Radix dialog with optional close button.
- `alert-dialog`: Radix alert dialog with action/cancel button variants.
- `sheet`: Radix dialog styled as a side sheet (`side` prop).
- `drawer`: Vaul drawer wrapper with directional layouts.
- `popover`: Radix popover.
- `tooltip`: Radix tooltip with provider defaults.
- `hover-card`: Radix hover card.
- `dropdown-menu`: Radix dropdown suite with sub-menus and checkbox/radio items.
- `context-menu`: Radix context menu suite mirroring dropdown patterns.
- `menubar`: Radix menubar suite with sub-menus.
- `command`: `cmdk` command palette, including `CommandDialog`.

### Navigation & Menus
- `navigation-menu`: Radix navigation menu with trigger styles and viewport.
- `sidebar`: Full sidebar system with provider, rails, groups, menus, and skeletons; includes Ctrl/Cmd + `b` shortcut and cookie-based persistence.

### Feedback & Status
- `alert`: Alert banner with `default|destructive` variants.
- `progress`: Radix progress with translate-based indicator.
- `spinner`: Simple loader icon.
- `toast`: Radix toast primitives with variants.
- `toaster`: Renders toasts from `useToast`.
- `sonner`: Sonner toaster wrapper tied to theme and CSS variables.

### Data Visualization & Media
- `chart`: Recharts wrapper with config-driven CSS variable injection.
- `carousel`: Embla carousel with keyboard navigation and API exposure.
- `calendar`: `react-day-picker` wrapper with custom classnames.

### Keyboard & Misc
- `kbd`: Keyboard key display with grouped styling.

## Usage Notes
- Most components accept native props from their underlying Radix primitives.
- Look for `data-slot` attributes to target styling consistently.
- `field` + `form` are intended to be used together for consistent labeling, errors, and accessibility.
- `sidebar` and `navigation-menu` are the only components with internal state persistence/keyboard shortcuts; keep that in mind when embedding.
