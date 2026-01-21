# UI Revamp Page — Dashboard

**Version**: v0.16.0

## Why
Dashboard is the “home base”. It must feel calm, premium, and action-oriented.

## Key Jobs-to-be-Done
- “What’s my current money situation?”
- “Am I on track this month?”
- “What changed since last month?”
- “What should I do next?”

## Layout Proposal (Desktop)
- Top bar:
  - Greeting + period chip (This month)
  - Primary actions: Import, Add transaction (optional)
- KPI row:
  - Income, Expenses, Net, Cashflow trend
- Main grid:
  - Balance (accounts) + cashflow
  - Spending breakdown (donut) + top categories
  - Recent transactions + alerts

## Interactions
- Clicking a KPI drills into Analytics with preset filters.
- “Recent transactions” supports quick edit (opens dialog).

## Consistency Rules
- All widgets share the same card header style.
- All money values tabular.

## Acceptance Criteria
- Clear hierarchy: KPIs are immediately scannable.
- Every widget has a “See details” path.
- Empty state guides to Import.
