# UI Revamp Page — Subscriptions

**Version**: v0.17.0

## Why
Recurring payments are where users lose money. The UX must be clean and actionable.

## Goals
- Detect recurring items reliably.
- Make editing/merging/linking simple.
- Show upcoming payments.

## UX Requirements
- List view:
  - name, amount, cadence, next expected, last paid
  - status badge (on track / missing / overdue)
- Detail view:
  - linked transactions
  - edit schedule
  - mute/ignore

## Acceptance Criteria
- User can confirm a subscription and it stays linked.
- Upcoming view is accurate.
- Overdue detection doesn’t spam.
