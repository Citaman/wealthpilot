# UI Revamp Task — Empty / Loading / Error States

**Version**: v0.15.0

## Why
Bank-grade apps feel “built”, not stitched together. Consistent states are a huge part of trust and polish.

## Goals
- Every page has:
  - a designed empty state,
  - a loading skeleton (not just spinners),
  - user-friendly recoverable error messaging.

## Deliverables

### 1) Page-level states
For each page:
- Dashboard
- Transactions
- Analytics
- Budgets
- Import
- Accounts
- Goals
- Subscriptions
- Calendar
- Settings

Define:
- **Empty**: what the user should do next
- **Loading**: skeleton layout matches the final layout
- **Error**: friendly text + retry + diagnostics link (optional)

### 2) Shared components
- `EmptyState` component:
  - icon, title, description, primary CTA, secondary CTA
- `PageSkeleton` variants:
  - dashboard skeleton
  - table skeleton
  - chart skeleton
- `InlineError` component:
  - compact message + retry

## UX Rules
- Never show raw stack traces.
- Always offer a “next step” CTA.
- Keep language consistent, short, confident.

## Implementation Notes
- Use existing skeleton patterns where present, but unify API.
- Avoid layout shift: skeleton sizes match real components.

## Acceptance Criteria
- No page renders a blank white area when empty.
- No page uses `alert()`.
- Errors are actionable and non-blocking when possible.

## QA Checklist
- First-run: no data → guide to Import.
- Broken import file → clear error + how to fix.
- Simulate Dexie error: UI shows retry.
