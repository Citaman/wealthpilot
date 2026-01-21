# UI Revamp Task — Design System & Visual Language

**Version**: v0.15.0

## Why
The app currently looks “template-like” because components don’t share a strict hierarchy (type scale, spacing rhythm, borders, density, data formatting). This task defines the product’s visual language so every page feels like one bank-grade system.

## Goals
- One coherent visual system across all pages and states.
- Trust-first aesthetic: calm, high clarity, minimal “random gradients”.
- Strong readability for numeric finance data.

## Non-goals
- Redesigning charts from scratch (only harmonize styles).
- New information architecture (handled in page revamp tasks).

## Design Direction
Pick one for implementation (can be toggled later but choose now):
- **A: Bank Calm** (recommended)
- B: Bento Pro
- C: Mobile-First Cards

## Deliverables

### 1) Tokens (Tailwind + CSS variables)
- Typography scale (e.g., 12/13/14/16/18/24/30/36)
- Font weights policy (e.g., 400 body, 500 labels, 600 headings)
- Spacing rhythm (e.g., 4/8/12/16/24/32)
- Radii (system: sm/md/lg/xl)
- Elevation rules (shadow only for lift, never as decoration)
- Color semantics:
  - `income` (green), `expense` (red), `warning` (amber), `info` (blue)
  - Neutrals for most surfaces
- Tabular numerals everywhere amounts are shown

### 2) Component style contracts
Define “how it looks” rules for:
- Cards (header alignment, padding, border)
- Buttons (sizes, primary/secondary/ghost usage)
- Badges (status vs category vs tag)
- Inputs/selects (height, focus rings)
- Tables (row height variants, hover, zebra optional)
- Dialogs/drawers (header/footer pattern)
- Tooltips (when allowed / when not)
- Charts (colors, gridlines, tooltip style)

### 3) Formatting standards
- Currency: locale-aware (`fr-FR`, `EUR`) but consistent decimals per context
  - Lists: 2 decimals
  - KPI cards: 0 decimals (or configurable)
- Dates: short in lists, full in detail dialogs
- Percent change: always include base period label

## Implementation Notes (where to change)
- `src/app/globals.css`: add/adjust variables, radii, chart colors.
- `src/components/ui/*`: enforce consistent sizing and variants.
- `src/lib/utils` (or a new `src/lib/format.ts`): centralize `formatCurrency`, `formatPercent`, `formatDate`.

## Acceptance Criteria
- Same spacing + typography rules across: dashboard, transactions, budgets, analytics.
- All money values use tabular numerals.
- Color usage is semantic (no arbitrary colors per component).
- Dark mode remains readable with AA contrast on core surfaces.

## QA Checklist
- Compare at 100% and 125% zoom.
- Check “low data” pages (empty import, first-run state).
- Validate focus outlines on all interactive components.
