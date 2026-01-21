# Architecture Overview (Current)

This document describes the current runtime architecture of WealthPilot as implemented in the codebase.

## 1) System Context

WealthPilot is an **offline-first**, **browser-only** app:

- No backend services.
- All user data lives in **IndexedDB**.
- Dexie.js is the persistence layer.

```mermaid
flowchart LR
  User[User] --> UI[Next.js App Router (React UI)]
  UI --> Hooks[Reactive Hooks\n(dexie-react-hooks)]
  Hooks --> Dexie[Dexie ORM]
  Dexie --> IDB[(IndexedDB)]

  CSV[Bank CSV File] --> ImportUI[Import Page]
  ImportUI --> Importer[csv-importer.ts]
  Importer --> Parser[PapaParse]
  Parser --> Rules[migration.ts\nmerchant + category rules]
  Rules --> Dedup[duplicate-detection.ts\n+ transfer-detection.ts]
  Dedup --> Dexie
```

## 2) Layered View

```mermaid
flowchart TB
  subgraph App[src/app]
    Pages[Routes: /, /transactions, /analytics, /budgets, ...]
  end

  subgraph UIComponents[src/components]
    Layout[Layout + Navigation]
    Feature[Feature Components\n(dashboard, analytics, budgets, ...)]
    Shadcn[UI Primitives\n(shadcn/radix)]
  end

  subgraph State[src/contexts]
    AccountCtx[account-context.tsx\n(selected account)]
  end

  subgraph Hooks[src/hooks]
    UseData[use-data.ts\n(useLiveQuery data access)]
    UseFM[use-financial-month.ts]
  end

  subgraph Domain[src/lib]
    DB[db.ts (Dexie schema + tables)]
    Import[CSV import + rules + dedup]
    Balance[balance.ts]
    Analytics[analytics.ts]
    FinancialMonth[financial-month.ts]
    BudgetTypes[budget-types.ts\n(smart income + overrides)]
  end

  Pages --> UIComponents
  UIComponents --> Hooks
  AccountCtx --> UIComponents
  Hooks --> Domain
  Domain --> DB
```

## 3) Key Data Concepts

- **Transaction**: core event record; can be linked as transfers; can be excluded from budgets/analytics.
- **Account**: holds computed balance; recalculation derives balances from transaction history.
- **Settings**: key-value store in DB used for user preferences and override maps.

## 4) Known Architectural Tensions (Pre-v1)

1. **Income / Salary detection is duplicated**
   - `financial-month.ts`: salary detection + salary-based month boundaries.
   - `budget-types.ts`: smart income (median/outlier) + salary day detection.
   - Before v1: converge into one "Income & Financial Month engine" used by budgets + analytics + dashboard.

2. **Override UX vs Override Infrastructure**
   - Category overrides are wired in budgets.
   - Transaction override components exist, but need wiring into transaction views.

3. **Offline-first means backups are mandatory**
   - Without export/import, users are one browser reset away from losing all data.

## 5) Pre-v1 Architectural Goals

- One canonical way to compute:
  - financial month boundaries
  - salary month income
  - bonus/outlier handling
- Typed settings registry (keys, defaults, migrations).
- Data portability: export/import snapshot + safety reset flow.
