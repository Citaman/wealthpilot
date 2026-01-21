# UI Revamp Task — Data Table + Filters System

**Version**: v0.15.0

## Why
Transactions (and future lists) are currently page-specific and drift in UX. A bank-grade app needs one consistent “table system” with:
- filter chips,
- bulk selection,
- sorting,
- pagination/virtualization,
- density toggle,
- column visibility.

## Goals
- Create reusable primitives used by:
  - Transactions list
  - Subscriptions list
  - Import preview list
  - Accounts movements (future)

## Deliverables

### 1) `FilterBar`
- Search input
- Filter chips (Category, Direction, Tag, Recurring, Excluded)
- Date range (optional)
- “Clear filters”
- Saved views (optional, later)

### 2) `DataTable`
- Column definitions (label, accessor, sort key)
- Row selection (checkboxes + shift select)
- Row actions (kebab menu)
- Keyboard navigation
- Density modes: Comfortable / Compact
- Pagination now; virtualization later if needed

### 3) `ListToolbar`
- Bulk actions area (categorize, tag, delete, exclude/include)
- Export button

## UX Rules
- Filters are visible and removable at a glance.
- Bulk actions appear only when selection > 0.
- Sorting: 3-state sort (none/asc/desc) for key columns.

## Data & Performance
- Prefer serverless/offline: filtering is in-memory today.
- Keep UI responsive at 10k transactions:
  - memoize filtered results
  - avoid expensive `JSON.stringify` loops
  - consider virtualization if needed (future)

## Implementation Notes
- Create `src/components/ui/data-table/*` or `src/components/common/*`.
- Keep it framework-agnostic (no page-specific logic).

## Acceptance Criteria
- Transactions page uses `FilterBar` + `DataTable`.
- At least one more page uses the same system.
- Filters + sorting preserve state on navigation back.

## QA Checklist
- Select 10 rows, run bulk action, see immediate updates.
- Combine filters (category + tag + search) without jank.
- Keyboard: arrows/enter escape in table and dialogs.
