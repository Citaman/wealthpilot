# UI Revamp Page — Transactions

**Version**: v0.16.0

## Why
Transactions is the operational center. It must feel like a pro tool: fast, precise, consistent.

## Goals
- Fast search/filter.
- Bulk editing.
- Quick edit without losing context.

## UX Improvements

### Filters
- FilterBar with chips:
  - Date range (default: last 12 months)
  - Category, Direction, Tags, Recurring, Excluded
- Saved views (later)

### Table
- Density toggle: Comfortable/Compact
- Columns:
  - Merchant, Category, Date, Amount, Account, Flags, Tags
- Row interactions:
  - click: open edit drawer/dialog
  - hover: quick actions (edit, exclude)

### Bulk actions
- Categorize, Tag, Exclude/Include, Delete

### Classification shortcuts
- Inline “Needs/Wants/Savings” override control (from v0.9.6) integrated cleanly.

## Acceptance Criteria
- Combined filters don’t feel slow on large datasets.
- Bulk actions are obvious and safe (confirm destructive).
- Edit flow does not require page refresh.
