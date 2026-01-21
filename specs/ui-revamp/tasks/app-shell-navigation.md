# UI Revamp Task — App Shell & Navigation

**Version**: v0.15.0

## Why
The shell (sidebar + header) is the “bank app frame”. If it feels inconsistent, every page feels inconsistent.

## Goals
- Clean, responsive shell that matches a modern bank product.
- Navigation that works equally well on desktop + mobile.
- One global theme mechanism (not sidebar-owned).

## Scope
- Sidebar (desktop + collapsed)
- Header (page title, date range control slot, search, notifications)
- Mobile navigation (drawer + overlay)

## UX Requirements

### Sidebar
- States: expanded / collapsed / mobile-drawer
- Account selector:
  - Always visible and consistent in both expanded/collapsed
  - Shows balance + color dot
  - “All accounts” option
- Navigation groups:
  - Core (Dashboard, Transactions, Analytics, Budgets)
  - Planning (Goals, Subscriptions, Calendar)
  - Admin (Accounts, Import, Settings)
- Active state: clear but subtle

### Header
- Left: page title + optional subtitle
- Center (optional): global period selector when relevant (analytics/budgets)
- Right: search (Cmd/Ctrl+K), notifications, user/preferences menu

### Theme
- Theme state stored in one place (context or setting), not local-only in sidebar.
- Supports `system | light | dark`.

## Components
- `AppLayout` becomes a stable layout grid:
  - Sidebar: fixed width or collapsed width
  - Header: sticky
  - Content: scroll region

## Implementation Notes
- Likely touch points:
  - `src/components/layout/sidebar.tsx`
  - `src/components/layout/header.tsx`
  - `src/components/layout/app-layout.tsx`
  - Consider a `ThemeProvider` in `src/contexts/` to own theme state.

## Acceptance Criteria
- Works at 390px width: sidebar becomes drawer, header remains usable.
- Keyboard navigation: tab/shift-tab does not trap; focus visible.
- No duplicate theme toggles.

## QA Checklist
- iPhone-size: open/close drawer; navigate to each page.
- Desktop: collapse/expand sidebar; state persists.
- Dark mode: check header + sidebar contrast.
