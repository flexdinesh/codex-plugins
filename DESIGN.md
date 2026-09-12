# Tool Logger design system

This file is the visual constitution for the viewer. It consolidates the strongest existing direction: an observability workspace with dark evergreen navigation, quiet neutral surfaces, deliberate green accents, dense data views, and monospace technical details. Implementation must use semantic CSS variables exposed to Tailwind and consumed through shared shadcn/ui-based primitives.

## Design direction

The interface is:

- calm and restrained
- clear before decorative
- dense enough for operational data, never cramped
- precise and trustworthy
- local-first and utilitarian
- modern through typography, rhythm, and finish rather than effects

Avoid loud saturation, arbitrary gradients, decorative accent color, excessive cards, excessive borders, soft pill shapes everywhere, deep shadows, novelty type, and ornamental motion. Preserve the product structure and behavior unless a usability requirement demands change.

## Design principles

1. Consistency over novelty. Reuse tokens, primitives, and established compositions.
2. Hierarchy before decoration. Establish importance with type, spacing, alignment, and surface level.
3. Spacing communicates grouping. Keep related controls close and separate conceptual sections clearly.
4. Semantic colors over arbitrary colors. Components consume roles, never private palettes.
5. Fewer visual styles with clearer roles. A difference must communicate meaning.
6. Data remains primary. Chrome should support scanning, filtering, comparing, and inspecting logs.
7. Responsive behavior preserves hierarchy. Reflow and prioritize; do not merely shrink.
8. Accessibility is part of the component contract, not a final pass.

## Tokens

Define canonical tokens in the viewer's global CSS. Expose them through Tailwind's theme layer and map shadcn roles to them. Components must use the semantic role, not a raw value.

Keep the system intentionally small. Alias implementation tokens only when an API requires it; do not create synonymous roles.

### Color

Use these semantic roles:

- `--color-app-bg`: application canvas.
- `--color-bg-surface`: primary content surface, including raised overlays.
- `--color-bg-surface-secondary`: table headings, code blocks, selected-neutral regions, and quiet grouped content.
- `--color-text-primary`: headings and primary data.
- `--color-text-secondary`: supporting copy and ordinary labels.
- `--color-text-muted`: timestamps, metadata, placeholders, and tertiary guidance.
- `--color-stroke`: default separation.
- `--color-stroke-strong`: emphasized boundaries and active control outlines.
- `--color-action`: primary action, selection, links, and active data emphasis.
- `--color-action-hover`: action hover and pressed state.
- `--color-action-soft`: selected and quiet action surface.
- `--color-on-action`: text and icons on an action fill.
- `--color-state-success`: confirmed or completed state.
- `--color-state-warning`: awaiting, partial, or caution state.
- `--color-state-destructive`: errors and destructive actions.
- `--color-focus-ring`: keyboard focus ring.
- `--color-bg-overlay`: overlay scrim.
- `--color-data` and `--color-data-strong`: visualization series.
- `--color-nav-bg`: evergreen navigation surface.
- `--color-nav-foreground` and `--color-nav-muted`: navigation text hierarchy.
- `--color-nav-surface`: active navigation surface.

The palette remains warm-neutral with an evergreen accent. Use accent only for actions, current selection, focus, and meaningful chart emphasis. It is not decoration.

Text hierarchy uses `primary`, `secondary`, then `muted`; never invent a new gray to create another level. Default borders separate controls or dense regions. Strong borders communicate focus, selection, or a major structural boundary. Prefer whitespace or a surface change before adding a border.

Status color supplements a label or icon; it never carries meaning alone. Success means a confirmed event, not inferred tool success. Warning means awaiting or incomplete. Destructive means an actual error or destructive action.

The viewer has no dark mode today. Keep all components theme-ready by using semantic roles exclusively. A future `.dark` theme must redefine the same tokens rather than introduce a separate component palette.

### Typography

Use the system sans stack for interface text and the system monospace stack for paths, commands, IDs, payloads, code, and tabular technical values.

Canonical sizes:

- `--font-size-xs`: 12px; captions, timestamps, metadata, badges, table headings.
- `--font-size-sm`: 14px; compact body, controls, table cells, labels.
- `--font-size-md`: 16px; body and standard component text.
- `--font-size-lg`: 18px; subsection heading.
- `--font-size-xl`: 20px; section heading.
- `--font-size-2xl`: 24px; panel or inspector title.
- `--font-size-3xl`: 32px; page title and key display value.

Use weights 400 for body, 500 for labels and controls, 600 for headings, and 700 only for exceptional emphasis. Body line height is 1.5–1.7. Headings use 1.15–1.3. Captions and controls use 1.3–1.5. Use tight tracking only for display headings and wide tracking only for short uppercase labels. Numeric metrics and times use tabular numerals.

Every screen uses the same hierarchy: one page title, section headings below it, then subsection headings. Do not skip levels to achieve a visual effect. Introduce no new type style unless these roles cannot express a distinct semantic hierarchy.

### Spacing

Use a 4px base scale:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-12`: 48px
- `--space-16`: 64px

Use 4–12px between tightly related content, 12–16px inside controls and compact components, 16–24px as standard panel padding, 24–32px between related groups, and 48–64px between major conceptual sections.

Page gutters are 16px on mobile, 24px on tablet, and 32–40px on desktop. Use one gutter across the page grid. Standard control-to-label gap is 8px, related action gap is 8–12px, heading-to-body gap is 8–12px, and form field gap is 16px.

Custom spacing is acceptable only for optical alignment or required visualization geometry. Document the reason beside the value. Never preserve a one-off value solely because legacy CSS used it.

### Sizing, radii, and shadows

Controls use 36px compact, 40px default, or 44px touch-comfortable heights. Interactive targets must be at least 44×44px on touch layouts; their visible control may be smaller if the hit area remains sufficient. Icons use 16px, 20px, or 24px.

Use three radii:

- `--radius-sm`: 4px for tags, badges, and compact data marks.
- `--radius-md`: 8px for controls and ordinary grouped surfaces.
- `--radius-lg`: 12px for overlays and exceptional feature surfaces.

Do not make every section a rounded card. Status badges may be compact rounded rectangles; reserve fully rounded pills for intrinsically circular or binary indicators.

Use `--elevation-overlay` only for dialogs, menus, sheets, and other real elevation. Ordinary panels and cards use a border or surface contrast, not a shadow. Do not add decorative shadows.

## Layout

The viewer is a full-width application shell with a maximum content width of 1600px. Align titles, statistics, charts, filters, and the event explorer to one content grid.

- Desktop navigation width: 224px.
- Tablet navigation rail: 64px.
- Header height: 64px.
- Inspector width: up to 520px on desktop, full width on mobile.
- Narrow prose width: about 640px.
- Data tables: use available width and scroll horizontally when their meaningful columns cannot fit.

Use CSS Grid for page-level statistics and chart layouts; use Flexbox for one-dimensional control groups. Keep related labels and values aligned to shared columns. Do not independently center elements that belong to a grid.

Cards are appropriate for statistics, charts, and the call explorer because they are discrete query or visualization surfaces. Avoid nested cards. Within a major surface, prefer section spacing, subtle fills, or dividers.

## Components

Use shared shadcn/ui-based primitives before writing page-specific controls. Variants must represent distinct semantics, not tiny visual preferences.

### Buttons

Buttons use default, secondary, ghost, icon, or destructive intent. Match shared heights, padding, type, radius, focus, disabled, and icon rules. Place the icon before the label unless it indicates forward navigation. Icon-only buttons require an accessible name. Avoid filters such as generic brightness changes for hover; define states with semantic tokens.

### Forms

Inputs, native selects, and textareas share height, border, radius, type, focus ring, disabled treatment, and placeholder color. Every control has a programmatic label. Keep native selects for compact filters unless a custom interaction adds clear value. Validation text sits with its field and uses both text and status styling.

### Cards and panels

Use cards only for a meaningful grouped surface. Standard padding is 16px compact or 24px default. A heading row aligns title, description, and relevant action. Avoid shadows and repeated borders inside a card.

### Navigation

Navigation uses the evergreen surface and one unmistakable active state. Labels remain concise. Desktop shows full navigation, tablet uses an accessible icon rail with tooltips, and mobile replaces the persistent sidebar with a compact navigation control. Navigation icons come from the shared icon set, not text glyphs.

### Tables

Tables prioritize scanning. Keep headers compact, uppercase only for short labels, row density consistent, numbers tabular, and technical summaries monospace. Hover identifies an actionable row; selected is stronger and persistent. Preserve horizontal scrolling rather than truncating every field beyond recognition. Rows that open details must remain keyboard-operable.

### Tabs, badges, and status indicators

Tabs use a single selection cue and proper tab semantics. Badges label compact metadata; do not use them as decoration. Status indicators combine color with copy or an icon. Avoid adding near-identical variants.

### Overlays and modals

Use a sheet for detailed event inspection and a dialog for bounded decisions. Provide a scrim, focus trap, initial focus, Escape dismissal, close control, and focus return. Do not dismiss during an irreversible operation without confirmation.

### Visualizations

Charts use semantic accent and muted roles, consistent axes, legible labels, and non-color cues where comparison matters. Animation must be subtle and respect reduced-motion preferences. Do not use gradients or ornamental effects. Empty, loading, and error states occupy the same layout region to avoid jumps.

## Interaction states

- Hover: subtle surface, border, or foreground change; never the sole indication of interactivity.
- Focus: visible `--color-focus-ring` ring with sufficient offset on every keyboard-operable element.
- Active: stronger than hover and visibly connected to the action.
- Selected: persistent accent-tinted surface or border plus semantic state such as `aria-selected`.
- Disabled: reduced emphasis and blocked activation while retaining readable contrast; do not rely on cursor alone.
- Loading: preserve dimensions, announce asynchronous status when useful, and avoid replacing stable content unnecessarily.
- Error: concise actionable copy, destructive role, and `role="alert"` for newly surfaced errors.

Transitions are 120–200ms for color, border, opacity, and small transforms. Respect `prefers-reduced-motion`. Never animate live log updates in a way that disrupts reading or changes scroll position.

## Responsive design

- Mobile, below 640px: remove the persistent sidebar, use 16px gutters, stack statistics and charts into one column where needed, make the inspector full-width, and provide 44px touch targets.
- Tablet, 640–1023px: use the 64px navigation rail, two-column statistics, stacked charts, and 24px gutters.
- Desktop, 1024px and above: use full navigation, four-column statistics, split charts, and 32–40px gutters.
- Wide screens: cap primary content at 1600px and retain coherent alignment rather than stretching individual panels.

Collapse columns by meaning: preserve the primary metric, tool, status, and action before secondary metadata. Reorder only when reading order remains logical in the DOM. Filters may wrap or stack; labels stay attached. Tables scroll horizontally when a card transformation would reduce comparison. Responsive changes must preserve focus order, selection context, and access to every action.

## Accessibility

- Meet WCAG AA contrast for text and controls; target 4.5:1 for body text and 3:1 for large text and meaningful UI boundaries.
- Support complete keyboard operation with logical focus order and visible focus.
- Use semantic landmarks, headings, tables, labels, dialogs, and live regions before adding ARIA.
- Keep default body text readable and avoid long muted passages below 14px.
- Give every input a label and every icon-only action an accessible name.
- Maintain at least 44×44px touch targets on touch layouts.
- Never communicate status, selection, or validation with color alone.
- Preserve zoom, text reflow, and horizontal data access without clipping controls.
- Respect reduced-motion and operating-system contrast preferences where practical.

## Rules for future UI work

Before introducing a visual change, ask:

1. Does a semantic token already express this meaning?
2. Does a shared component already solve it?
3. Does this introduce a new visual pattern?
4. Is the difference meaningful or merely incidental?
5. Does it preserve hierarchy and data density?
6. Will it remain coherent and usable on mobile?
7. Are keyboard, contrast, labeling, and state communication correct?
8. Does it follow this file?

> Do not introduce a new color, font size, spacing value, radius, shadow, or component variant unless the existing system cannot express the required design meaning.

If a new value is necessary, add it centrally, name its semantic purpose, document why existing roles fail, and apply it consistently. Do not ship local exceptions as experimentation.

## Audit baseline

The initial viewer established the product's useful character: dark evergreen navigation, a light canvas, quiet white surfaces, green activity signals, amber waiting states, readable data cards, compact filters, a broad event table, and a right-side inspector. Preserve that direction.

The legacy implementation also used many nearly identical green and gray values, numerous incidental pixel gaps, several nearby radii, uneven control heights, and an oversized type scale driven by one-off roles. Consolidate these onto the tokens above during the Tailwind/shadcn migration. Preserve behavior, data hierarchy, the 1600px content cap, table overflow, and inspector focus handling. Leave information architecture, query behavior, and dark mode unchanged unless separately approved.
