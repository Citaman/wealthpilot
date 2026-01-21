# UI Revamp Page — Analytics

**Version**: v0.16.0

## Why
Analytics is already rich, but it needs stronger cohesion: consistent period selection, drilldowns, and “why” explanations.

## Goals
- One period model across charts.
- Drilldowns to transactions are first-class.
- Exclusions/filters are visible everywhere.

## UX Improvements

### Header
- Period tabs: 1M / 3M / 6M / 1Y / YTD
- Show active account filter

### Drilldowns
- Every chart provides:
  - click segment → open Transactions page pre-filtered
  - “View underlying transactions” action

### Explainability
- For each KPI:
  - definition
  - formula
  - included/excluded rules

### Consistency
- Chart styling matches design tokens:
  - tooltip style
  - gridlines
  - colors (semantic)

## Acceptance Criteria
- Clicking a chart segment takes you to the right filtered list.
- All charts respect `isExcluded` and transfer exclusions.
- Period selection feels consistent and never confusing.
