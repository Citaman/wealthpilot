# UI Revamp Page — Import Wizard

**Version**: v0.16.0

## Why
Import is the first trust moment. A bank-grade app makes import safe and transparent.

## Goals
- Guided flow with preview and confidence.
- Clear dedup + transfer detection summary.
- Users understand what will change before it changes.

## Wizard Steps
1) Select account (or create)
2) Upload CSV
3) Preview + mapping (format detection shown)
4) Rules preview (merchant renames, category rules)
5) Dedup/transfer summary
6) Confirm import

## UX Requirements
- Show counts:
  - total rows
  - new transactions
  - duplicates skipped
  - transfers linked
- Clear errors:
  - invalid date/amount rows
  - unknown columns

## Acceptance Criteria
- User can preview before committing.
- Import result is summarized with clear next actions.
- Failures are recoverable (no partial corruption).
