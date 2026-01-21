# UI Revamp Page — Budgets

**Version**: v0.16.0

## Why
Budgets should feel like planning — not a spreadsheet. Users should trust the income model and understand needs/wants/savings.

## Goals
- Make smart income understandable and editable.
- Make category overrides discoverable.
- Show pace (are you overspending?) clearly.

## UX Improvements

### Income panel
- Show:
  - Smart income average
  - Salary day + confidence
  - Bonus months excluded (count + total)
- Manual override input with “reset to smart”

### Allocation
- Presets (50/30/20 etc.) + custom
- Visual allocation bars

### Actuals
- Needs/Wants/Savings spending + progress
- Category list with:
  - budgeted
  - spent
  - remaining
  - pace indicator

### Overrides
- Category type overrides in a dedicated section:
  - searchable list
  - modified badge
  - reset per category + reset all
- Transaction overrides surfaced as:
  - “Overridden transactions this month” link to filtered Transactions

## Acceptance Criteria
- Users can answer “why is my income X?”
- Overrides are easy to find and reversible.
- Alerts are helpful and non-alarming.
