# UI Revamp Task — Notifications Center

**Version**: v0.15.0

## Why
The UI currently shows mock notifications. A premium finance app needs actionable alerts users can trust.

## Goals
- Notifications represent real app events.
- Users can dismiss, mute, and navigate to the relevant context.

## Notification Types (initial)
- Budget: category exceeded / pace warning
- Import: duplicates detected / transfers matched
- Balance: suspicious drop / pre-salary low
- Subscriptions: upcoming bill due

## Data Model
Option A (recommended): store in Dexie table `notifications`:
- `id`, `type`, `title`, `body`, `createdAt`, `readAt?`, `actionHref?`, `payload?`

Option B: computed-only (no storage) for some alerts; but “read/dismiss” requires storage.

## UX
- Bell icon shows unread count.
- Dropdown list:
  - unread at top
  - “Mark all read”
  - per-item actions: open / dismiss
- “Notification Settings” page section to mute categories.

## Implementation Notes
- Replace mock data in `src/components/layout/header.tsx`.
- Create minimal notification generation:
  - budgets pace check
  - upcoming bills check

## Acceptance Criteria
- At least 2 real notification types implemented.
- Dismiss persists across reload.
- Clicking navigates to the right page and context.

## QA Checklist
- Create a budget overrun and confirm a notification appears.
- Mark as read/dismiss and confirm it’s gone after reload.
