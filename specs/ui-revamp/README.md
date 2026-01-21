# WealthPilot UI Revamp (Bank‑Grade)

**Last updated**: January 21, 2026

This spec set defines a UI/UX revamp that makes WealthPilot feel like a modern Fortune‑500 bank product: calm, trustworthy, fast, and “operationally excellent”.

The intent is not “prettier cards”. It’s a cohesive system: navigation, typography, spacing, tables, empty states, editing flows, and consistent interactions across every page.

---

## Goals

- **Bank-grade trust**: calm layout, strong hierarchy, predictable behavior.
- **Fast day-to-day workflows**: search, filter, bulk actions, quick edits.
- **Clarity-first analytics**: drilldowns, explainability, consistent time ranges.
- **Mobile-ready**: responsive shell, touch targets, keyboard parity.
- **Accessibility**: AA contrast, proper focus, correct semantics.

## Non-goals (for this revamp)

- New backend / sync / accounts aggregation.
- Major data model redesign (unless required for UI consistency).
- Rebuilding all charts from scratch.

---

## Current UI Notes (Observed in code)

- App shell exists (sidebar + header) and already supports a **collapsed** mode.
- Dark mode exists but is currently **sidebar-owned** (localStorage + `document.documentElement` toggle).
- “Command palette” UI exists in header but search results are placeholder.
- Many pages are already “bento-ish”, but the overall visual language still reads as *template-like* because:
  - spacing/typography rhythm varies across pages,
  - tables/filters aren’t a unified system,
  - editing flows differ between features,
  - empty/loading/error states are inconsistent.

---

## Visual Directions (Pick one later)

These are “skins” over the same UX plan.

### Direction A — Bank Calm (recommended)
- White cards, soft borders, minimal gradients
- Neutral foregrounds; color only for meaning (income/expense, alerts)
- Typography: fewer weights, more whitespace

### Direction B — Bento Pro
- Stronger bento grid language
- More contrast between panels
- Slightly more playful data viz and micro‑motion

### Direction C — Mobile‑First Cards
- Designed for mobile scrolling first, desktop second
- More “cards” and stacked sections
- Strong sticky controls + bottom sheets/drawers

---

## Release Plan (3 versions)

- **v0.15.0 – UI Foundation & System**: design tokens, app shell, table/filters system, states, command palette groundwork.
- **v0.16.0 – Core Page Revamps**: dashboard, transactions, budgets, analytics, import, accounts.
- **v0.17.0 – Premium Polish**: goals/subscriptions/calendar cohesion, onboarding, personalization, PWA/mobile/a11y, micro‑motion, performance.

Each version has a “definition of done” checklist and task specs.

---

## Page Coverage

- Dashboard `/`
- Transactions `/transactions`
- Analytics `/analytics`
- Budgets `/budgets`
- Import `/import`
- Accounts `/accounts`
- Goals `/goals`
- Subscriptions `/subscriptions`
- Bill Calendar `/calendar`
- Settings `/settings`

---

## Task Specs Index

### v0.15.0 — Foundation
- [Design System & Visual Language](./tasks/design-system-visual-language.md)
- [App Shell & Navigation](./tasks/app-shell-navigation.md)
- [Data Table + Filters System](./tasks/data-table-filters-system.md)
- [Empty/Loading/Error States](./tasks/states-empty-loading-error.md)
- [Command Palette & Search](./tasks/command-palette-search.md)
- [Notifications Center](./tasks/notifications-center.md)

### v0.16.0 — Core Pages
- [Dashboard Revamp](./tasks/page-dashboard.md)
- [Transactions Revamp](./tasks/page-transactions.md)
- [Budgets Revamp](./tasks/page-budgets.md)
- [Analytics Revamp](./tasks/page-analytics.md)
- [Import Wizard Revamp](./tasks/page-import.md)
- [Accounts Revamp](./tasks/page-accounts.md)

### v0.17.0 — Premium
- [Goals Revamp](./tasks/page-goals.md)
- [Subscriptions Revamp](./tasks/page-subscriptions.md)
- [Calendar Revamp](./tasks/page-calendar.md)
- [Settings & Personalization](./tasks/page-settings.md)
- [Mobile/PWA/A11y](./tasks/mobile-pwa-a11y.md)
- [Micro‑Interactions & Motion](./tasks/microinteractions-motion.md)

---

## Quality Bar (Bank-grade)

- **Consistency**: spacing + typography scale consistent across pages.
- **One interaction language**: tables, filters, dialogs/drawers, toasts.
- **Keyboard-first**: all actions available by keyboard; visible focus.
- **Speed**: no page feels heavy at 10k+ transactions.
- **Explainability**: analytics and budgets show “why” (filters, ranges, exclusions).
