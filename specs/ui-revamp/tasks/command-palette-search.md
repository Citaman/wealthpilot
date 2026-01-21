# UI Revamp Task — Command Palette & Search

**Version**: v0.15.0

## Why
Search is the fastest way to operate a finance app. A bank-grade product has Cmd/Ctrl+K that actually works.

## Goals
- Global command palette with real results.
- One search experience reused across pages.

## UX Requirements
- Shortcut: Cmd/Ctrl+K open, Esc closes.
- Types of results:
  - Transactions (by merchant, description, notes, tags)
  - Categories
  - Merchants (suggested)
  - Navigation commands (“Go to Budgets”, etc.)
- Result actions:
  - Open transaction (edit dialog)
  - Filter transactions by merchant/category
  - Jump to page

## Ranking Rules
- Exact match > prefix > contains
- Recent items boosted

## Data
- Search reads from IndexedDB (Dexie) via `useLiveQuery` or a debounced query.
- Avoid querying the full DB on each keystroke; use debounce (150–250ms).

## Implementation Notes
- Extend `src/components/layout/header.tsx` dialog:
  - replace placeholder “Searching…” with real list
- Consider a `useGlobalSearch(query)` hook.

## Acceptance Criteria
- Searching “netflix” shows matching transactions.
- Enter opens transaction edit.
- Cmd/Ctrl+K works on all pages.

## QA Checklist
- 10k transactions: typing stays responsive.
- Keyboard-only: up/down/enter/esc works.
- Dark mode readability.
