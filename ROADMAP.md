# WealthPilot - Product Roadmap

**Last Audit Date**: January 20, 2026
**Last Update**: v0.11.0 Data Safety & Portability (Backups) COMPLETED ✅

---

## Architecture Snapshot (Current)

### System Context (Offline-First)

```mermaid
flowchart LR
  User[User] --> UI[Next.js App Router (React UI)]
  UI --> Hooks[Reactive Hooks\n(dexie-react-hooks)]
  Hooks --> Dexie[Dexie ORM]
  Dexie --> IDB[(IndexedDB)]

  CSV[Bank CSV File] --> ImportUI[Import Page]\nUI --> Importer[csv-importer.ts]
  Importer --> Parser[PapaParse]
  Parser --> Rules[migration.ts\nmerchant + category rules]
  Rules --> Dedup[duplicate-detection.ts\n+ transfer-detection.ts]
  Dedup --> Dexie

  IDB --> Charts[Charts + Analytics\n(Recharts)]
  Charts --> UI
```

### Module Boundaries (Where Things Live)

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

  subgraph State[src/contexts]
    AccountCtx[account-context.tsx\n(selected account)]
  end

  Pages --> UIComponents
  UIComponents --> Hooks
  Hooks --> Domain
  AccountCtx --> Hooks
  Domain --> DB
```

### Key Notes (Important for v1 planning)

- **No server** today: everything is stored locally in **IndexedDB** via **Dexie**.
- The “source of truth” is the database; UI should only display computed views of DB state (mostly via `useLiveQuery`).
- There are currently **two overlapping salary/income concepts**:
  - Financial-month logic in `financial-month.ts` (salary-based month boundaries)
  - Smart income + overrides in `budget-types.ts`
  - Before v1, these should converge into one consistent “Income & Financial Month engine”.

## Critical Findings from Code Audit

### ✅ SOLVED: Data Flow is Now Reactive

**Problem (SOLVED)**: The app used `useState` + `useEffect` + manual `loadData()` in `use-data.ts` hooks instead of `useLiveQuery` from Dexie.

**Solution IMPLEMENTED**: All hooks now use `useLiveQuery` for reactive data:

- `useDashboard()` - Reactive ✅
- `useTransactions()` - Reactive ✅  
- `useBudgets()` - Reactive ✅
- `useGoals()` - Reactive ✅
- `useAccounts()` - Reactive ✅
- `useMerchantRules()` - Reactive ✅
- `useImportRules()` - Reactive ✅
- `useAllTags()` - Reactive ✅

### ✅ SOLVED: Balance Calculation on App Load

**Problem (SOLVED)**: Balance showed 0 on app load even with existing data.

**Solution IMPLEMENTED**:

- Auto-recalculate all balances when app loads (in `AccountProvider`)
- Added balance checkpoints feature (known balance at date)
- Fixed recalculate button to not use `alert()` and `window.reload()`

---

## Version History

| Version | Status | Theme | Verified |
|---------|--------|-------|----------|
| v0.6.0  | ✅ Released | Multi-Account | Accounts work |
| v0.6.0  | ✅ DONE | Reactive Data | Hooks use useLiveQuery |
| v0.6.1  | ✅ DONE | Balance Fix | Auto-recalculate on load |
| v0.6.5  | ✅ DONE | Cash Flow Chart | Complete redesign |
| v0.7.0  | ✅ DONE | Analytics Overhaul | 15 components, bento grid |
| v0.7.5  | ✅ DONE | Analytics Refinements | Balance timeline, Month comparison revamp |
| v0.8.0  | ✅ DONE | Dashboard Polish | Quick Stats, Upcoming Bills, Monthly Summary |
| v0.9.0  | ✅ DONE | Budgets Overhaul | Budget vs Actual, Pace, Alerts, Category Cards |
| v0.9.5  | ✅ DONE | Smart Income & Overrides | Smart income, Category/Transaction type overrides |

---

## Roadmap (Realistic)

### v0.6.0 - Reactive Data & Balance Fix ✅ COMPLETED

**Theme**: Make data update in real-time without page refresh

| # | Task | Status | Verification |
|---|------|--------|--------------|
| 1 | Rewrite `useDashboard` with `useLiveQuery` | ✅ DONE | Dashboard updates when editing transactions |
| 2 | Rewrite `useTransactions` with `useLiveQuery` | ✅ DONE | Transaction list updates live |
| 3 | Rewrite `useBudgets` with `useLiveQuery` | ✅ DONE | Budget page updates live |
| 4 | Rewrite `useGoals` with `useLiveQuery` | ✅ DONE | Goals page updates live |
| 5 | Balance recalculation triggers UI update | ✅ DONE | Balance changes visibly when tx edited |
| 6 | Remove `refresh()` calls - now automatic | ✅ DONE | No manual refresh needed anywhere |

---

### v0.6.1 - Balance Auto-Recalculate ✅ COMPLETED

**Theme**: Balance should always be correct

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Auto-recalculate on app load | ✅ DONE | AccountProvider calls recalculateAllBalances |
| 2 | Fix recalculate button UX | ✅ DONE | No more alert() or window.reload() |
| 3 | Balance checkpoints feature | ✅ DONE | Set known balance at specific dates |
| 4 | Calculate from checkpoint | ✅ DONE | Works backward from known balance |

**New Features**:

- **Settings > Account Balance > Known Balance Points**: Add dates where you know your exact balance (from bank statements)
- **Auto-recalculate**: On app startup, all account balances are recalculated from transactions
- **Better UX**: Recalculate button shows spinner and success message, no page reload

---

### v0.7.0 - Analytics Page Overhaul ✅ COMPLETED

**Theme**: Professional Fortune 500-quality analytics with actionable insights

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Personal Insights Carousel | ✅ DONE | Smart text insights with high/medium/low priority |
| 2 | Spending Calendar | ✅ DONE | Full calendar with daily amounts, click for details |
| 3 | Spending Velocity | ✅ DONE | Pace indicator vs budget and last month |
| 4 | Financial Health Score | ✅ DONE | Circular score with 4 metrics breakdown |
| 5 | Top Merchants | ✅ DONE | Where money goes ranking |
| 6 | Spending Forecast | ✅ DONE | What-if scenarios with 6-month projection |
| 7 | Savings Potential | ✅ DONE | Actionable recommendations to save |
| 8 | Category Trends | ✅ DONE | Multi-line chart with category selector |
| 9 | Recurring Expenses Tracker | ✅ DONE | Non-subscription patterns (fast food, etc.) |
| 10 | Bento Grid Layout | ✅ DONE | 15 components in professional layout |
| 11 | Remove Day-of-Week Analysis | ✅ DONE | Replaced with more useful components |
| 12 | 5 Summary Stats | ✅ DONE | Income, Expenses, Net Savings, Avg Monthly, vs Last Month |

**New Components Created**:

- `spending-calendar.tsx` - Full month view with click-to-see transactions
- `personal-insights.tsx` - Carousel with 8 smart insights, priority badges
- `recurring-expenses.tsx` - Non-subscription pattern detection with frequency chart
- `spending-forecast.tsx` - 6-month projection with what-if slider (-20% to +20%)
- `category-trends.tsx` - Multi-line chart with checkbox category selector
- `savings-potential.tsx` - Identifies savings opportunities with difficulty ratings
- `financial-health-score.tsx` - Circular score (0-100) with 4-metric breakdown
- `spending-velocity.tsx` - Real-time pace indicator with daily budget tracking

**Verification Checklist**:

- [x] Personal insights show high/medium/low priority badges ✅
- [x] Calendar shows spending amounts in cells (not dots) ✅
- [x] What-if slider adjusts forecast projections ✅
- [x] Recurring expenses detect non-subscription patterns ✅
- [x] All components work in dark/light mode ✅
- [x] Bento grid layout is responsive ✅

---

### v0.7.5 - Analytics Refinements ✅ COMPLETED

**Theme**: User feedback improvements to analytics components

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Remove duplicate Recurring Expenses | ✅ DONE | Removed old RecurringAnalysis, kept new RecurringExpenses |
| 2 | Revamp Balance Timeline | ✅ DONE | Daily points, period selector (1W/1M/3M/6M/1Y/All), salary/pre-salary markers |
| 3 | Show Pre-Salary Low Balance | ✅ DONE | Highlights day before salary with amber dot, shows "Pre-Salary Low" stat |
| 4 | Revamp Spending Trends | ✅ DONE | Compact bar chart, colored by above/below avg, trend badge |
| 5 | Revamp Month Comparison | ✅ DONE | Two view modes (Overview/Breakdown), donut chart, progress bars |
| 6 | Remove unused components | ✅ DONE | Removed Predictions, DailyHeatmap, RecurringAnalysis |
| 7 | Improved layout | ✅ DONE | 3-column grid for trends, better spacing |

**Component Changes**:

- `balance-timeline.tsx` - REWRITTEN
  - Line chart with daily data points
  - Period selector: 1W, 1M, 3M, 6M, 1Y, All
  - Green dots for salary days
  - Amber dots for days before salary (month low)
  - Stats: Lowest, Highest, Average, Current, Pre-Salary Low, Trend
  - Following tooltip with date context

- `spending-trends.tsx` - REWRITTEN
  - Compact vertical bar chart (reduced from 300px to 160px)
  - Bars colored: green (below avg), red (above avg), blue (current month)
  - Trend badge: Increasing/Decreasing/Stable
  - Compact stats: Min, Avg, Max, Current
  - No more confusing 3-month moving average line

- `month-comparison.tsx` - REWRITTEN
  - Two view modes: Overview (cards + bar chart) and Breakdown (donut + progress)
  - Overview: Income/Expenses/Net cards with change indicators
  - Breakdown: Donut chart with category list, vs previous month progress bars
  - Single month selector (compares to previous month automatically)
  - Removed confusing side-by-side horizontal bars

**Removed Files**:

- `predictions.tsx` - Replaced by SpendingForecast with what-if
- `daily-heatmap.tsx` - Replaced by SpendingCalendar
- `recurring-analysis.tsx` - Replaced by RecurringExpenses

---

### v0.8.0 - Dashboard Polish ✅ COMPLETED

**Theme**: Dashboard refinements and new widgets

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Quick Stats Widget | ✅ DONE | Savings rate, spending pace, month progress, projection |
| 2 | Upcoming Bills Widget | ✅ DONE | Predicts bills due in next 7 days based on patterns |
| 3 | Monthly Summary Card | ✅ DONE | Income/Expenses/Net with change indicators |
| 4 | Goal Progress Widget | ✅ DONE | Enhanced with circular progress rings |
| 5 | Dashboard Layout Update | ✅ DONE | Integrated all new widgets into 3-column layout |

**New Components Created**:

- `quick-stats.tsx` - 4-metric row at top of dashboard
  - Savings Rate (with color coding: green 20%+, amber 10-20%, red <10%)
  - Spending Pace (daily average with progress bar vs expected)
  - Month Progress (days elapsed/remaining)
  - Month Projection (estimated total vs last month)

- `upcoming-bills.tsx` - Smart bill prediction
  - Analyzes 6 months of transaction history
  - Finds recurring merchants (same day-of-month pattern)
  - Shows bills due in next 7 days
  - Confidence indicator (high: consistent day & amount)
  - Empty state when all caught up

- `monthly-summary.tsx` - Current month at-a-glance
  - Income/Expenses/Net cards with change vs last month
  - Top spending category
  - Days remaining progress bar
  - Link to analytics

- `goals-progress.tsx` - ENHANCED
  - Circular SVG progress rings (replaces linear Progress bars)
  - Shows top 3 active goals
  - Sparkle icon for completed goals
  - Overall progress summary
  - Link to goals page

**Dashboard Layout**:

- Quick Stats row at top (full width)
- 3-column grid:
  - Left: Income, Budget Control, Upcoming Bills
  - Center: Balance, Expense Donut, Monthly Summary
  - Right: Recent Transactions, Goals Progress
- Cash Flow Chart (full width at bottom)

**Verification Checklist**:

- [x] Quick Stats shows accurate savings rate ✅
- [x] Upcoming Bills predicts correctly from patterns ✅
- [x] All widgets self-contained (fetch own data) ✅
- [x] Circular progress looks good ✅
- [x] Loading skeletons for all new widgets ✅
- [x] Build passes with no errors ✅
- [ ] Mobile responsive

---

### v0.9.0 - Budgets Page Overhaul ✅ COMPLETED

**Theme**: Useful budget planning

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Budget vs Actual chart | ✅ DONE | Horizontal bar chart with budget/actual comparison |
| 2 | Category-level budgets with real tracking | ✅ DONE | Individual category cards with circular progress |
| 3 | Spending pace indicator | ✅ DONE | Shows if on track with daily budget guidance |
| 4 | Budget alerts at thresholds | ✅ DONE | 80%, 90%, 100% alerts with severity levels |
| 5 | Clean up confusing UI elements | ✅ DONE | Settings in collapsible, cleaner layout |

**New Components Created**:

- `budget-vs-actual.tsx` - Horizontal bar chart
  - Shows Needs/Wants/Savings budget vs actual spending
  - Bars turn red when over budget
  - Summary stats with difference amounts
  - Overall status badge (On Track/Caution/Over Budget)

- `budget-pace.tsx` - Spending pace tracker
  - Visual comparison: month progress vs budget usage
  - Status indicator (Excellent/Good/Warning/Danger)
  - Stats grid: Daily Budget, Daily Average, Can Spend/Day, Projected Total
  - Vertical line shows expected position in month

- `budget-alerts.tsx` - Alert notification system
  - Detects categories at 80%, 90%, 100%+ thresholds
  - Three severity levels: warning, danger, critical
  - Badge showing alert count
  - "All Good" state when no alerts

- `category-budget-card.tsx` - Individual category display
  - Circular progress ring (red when over)
  - Inline budget editing
  - Change vs previous month badge
  - Category icon and color

**Page Layout Changes**:

- Header with collapsible Settings button
- Budget settings hidden by default (cleaner view)
- 2-column grid: Budget vs Actual + Budget Pace
- Budget Alerts section
- Category sections by type (Needs/Wants/Savings)
- Each category type shows summary with percentage used

**Verification Checklist**:

- [x] User can set budget per category ✅
- [x] Actual spending from transactions shows correctly ✅
- [x] Visual makes budget status obvious ✅
- [x] Budget alerts trigger at correct thresholds ✅
- [x] Pace indicator matches day of month ✅
- [x] Build passes with no errors ✅

---

### v0.9.5 - Smart Income & Type Overrides ✅ COMPLETED

**Theme**: Improve income calculation and allow manual needs/wants/savings classification

**Problems Addressed**:

1. Monthly income was using latest income, not average salary (bonuses skewed the calculation)
2. Income detection used calendar month (Jan 1) instead of salary-based month (e.g., salary on Dec 25 should count for January budget)
3. No way to manually override the default needs/wants/savings type for categories or individual transactions

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Smart Income Calculation | ✅ DONE | Median-based detection, excludes outliers >1.3x median (bonuses) |
| 2 | Salary Day Detection | ✅ DONE | Identifies typical salary day from pattern analysis |
| 3 | Category Type Overrides | ✅ DONE | UI to change category types in budget settings |
| 4 | Transaction Type Overrides | ✅ DONE (Foundation) | Components + persistence exist; needs wiring into Transactions UI |
| 5 | Unit Tests | ✅ DONE | 17 tests covering outlier detection, overrides, priority resolution |
| 6 | Budget Page Integration | ✅ DONE | Smart income with tooltip showing calculation details |

**New Files Created**:

- `src/lib/budget-types.ts` - Core utilities for smart income and type overrides
  - `calculateSmartIncome()` - Analyzes last N months of income transactions
  - `getCategoryBudgetType()` - Returns effective type with override support
  - `getTransactionBudgetType()` - Returns effective type (tx override > cat override > default)
  - `setCategoryTypeOverride()` / `setTransactionTypeOverride()` - Persist overrides to settings
  - `useSmartIncome()` - React hook for smart income data
  - `useCategoryTypeOverrides()` / `useTransactionTypeOverrides()` - React hooks for overrides
  - `DEFAULT_CATEGORY_TYPES` - Exported constants for default classification

- `src/lib/__tests__/budget-types.test.ts` - Unit tests
  - Outlier detection tests
  - Average calculation tests (excluding bonuses)
  - Type override priority resolution tests
  - Spending calculation with overrides tests

- `src/components/budgets/category-type-overrides.tsx` - UI Component
  - List of all categories with dropdown type selector
  - Shows "Modified" badge for overridden categories
  - "Reset All" button to clear all overrides
  - Legend explaining needs/wants/savings

- `src/components/budgets/transaction-type-button.tsx` - UI Components
  - `TransactionTypeButton` - Inline button with dropdown to change transaction type
  - `TransactionTypeBadge` - Compact badge showing current type with override indicator
  - Tooltip showing whether using custom or default type

**Smart Income Features**:

- Uses median salary to detect typical income
- Flags outliers (>1.3x median) as bonuses
- Calculates average excluding outliers
- Detects typical salary day (most common day-of-month)
- Confidence level: high (4+ salaries), medium (2-3), low (<2)
- Shows in budget settings with tooltip explaining calculation

**Type Override System**:

- Priority: Transaction override > Category override > Default
- Stored in settings as JSON (categoryTypeOverrides, transactionTypeOverrides)
- Reactive updates using useLiveQuery
- Works with all budget calculations

**Budget Page Changes**:

- Uses `useSmartIncome()` for income calculation
- Uses `getCategoryBudgetType()` for type determination
- Added `CategoryTypeOverrides` component in settings
- Tooltip shows smart income details (median, average, outliers excluded, salary day)
- Warning when bonus months excluded from calculation

**Verification Checklist**:

- [x] Smart income calculates average excluding bonuses ✅
- [x] Outliers correctly identified (>1.3x median) ✅
- [x] Category type overrides save and persist ✅
- [x] Overrides affect spending by type calculation ✅
- [ ] Transaction override UI is available on transaction rows/dialogs
- [x] All 17 unit tests pass ✅
- [x] Build passes with no errors ✅

---

### v0.9.6 - Transaction Override UX (Wiring) ✅ COMPLETED

**Theme**: Make per-transaction “Needs/Wants/Savings” usable everywhere

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Add `TransactionTypeButton` to transaction rows | ✅ DONE | Quick override without opening edit dialog |
| 2 | Add to transaction edit dialog | ✅ DONE | Override + reset-to-default UX |
| 3 | Ensure budgets/analytics react instantly | ✅ DONE | Budgets respect tx overrides; excluded tx filtered out |
| 4 | Add “Exclude from budgets/analytics” shortcut | ✅ DONE | Quick toggle in rows + edit dialog checkbox |

**Verification Checklist**:

- [x] Override a transaction → budget totals update immediately
- [x] Reset override → falls back to category override / default
- [x] Excluded tx never counts in budgets/analytics

---

### v0.10.0 - Goals Page Overhaul 🚧 NEXT

**Theme**: Working goal tracking

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Contribution UX (add money) | ✅ DONE | Works today by updating `currentAmount` via Goals page dialog |
| 2 | Persist contribution history (data model) | ✅ DONE | Added `goalContributions` table (goalId, date, amount, note, createdAt) + migration backfill |
| 3 | Contribution history UI | ✅ DONE | Recent history list + delete/undo; notes + date support |
| 4 | Circular progress on Goals page | ✅ DONE | Goals cards now use circular progress rings |
| 5 | Forecasting / target-date calculator | ✅ DONE | Shows required/month (deadline) + estimated reach (from recent history) |
| 6 | Withdrawals + corrections | ✅ DONE | Negative contributions supported; guarded against negative balances |
| 7 | Link goal to real account (optional) | 📋 TODO | Add `linkedAccountId` and auto-calc progress from account balance/transfer rules |
| 8 | Goal details view | ✅ DONE | Dedicated per-goal page: summary, history, forecast |

**Verification Checklist**:

- [x] Can add contribution and see it immediately
- [x] Contributions are persisted as history events (not only `currentAmount`)
- [x] Progress stays consistent with history (currentAmount is updated atomically with events)
- [x] Forecasting is sensible (handles no history, irregular deposits, deadlines)
- [ ] Optional account linking does not break manual goals

---

### v0.11.0 - Data Safety & Portability

**Theme**: If the app is offline-first, backups are not “nice to have” — they are the foundation of trust.

**Spec**: `specs/features/data-backups.md`

**Product Goals (challenge + sharpen)**:

- **Zero-surprises safety**: no destructive operation without an explicit, reversible flow.
- **Portability**: a user can move to a new device/browser profile and keep everything.
- **Confidence**: the app should *prove* the backup is valid (preview + health checks).

**UI/UX North Star (until the UI revamp)**: the Backup/Restore experience should feel like **Dashboard/Analytics** — calm bento cards, clear hierarchy, strong defaults, and no “scary walls of text”.

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Add a dedicated “Data & Backups” screen | 📋 TODO | In Settings: bento-style cards for Backup, Restore, Reset; show DB stats (tx count, accounts, last backup date, schema/app version) |
| 2 | Export full database snapshot (versioned) | 📋 TODO | Single file download; include metadata `{formatVersion, appVersion, schemaVersion, createdAt}` + all tables (settings/accounts/transactions/rules/budgets/goals) |
| 3 | Optional compressed export | 📋 TODO | Offer “Compressed (.json.gz/.zip)” to keep file sizes reasonable; keep uncompressed JSON as a baseline |
| 4 | Restore flow with preview (dry-run first) | 📋 TODO | Show counts, date ranges, accounts, and warnings before writing anything |
| 5 | Clear conflict strategies (safe defaults) | 📋 TODO | Default to **Replace all data** (with automatic pre-backup); “Merge” as advanced option with clear rules |
| 6 | Import health checks + warnings model | 📋 TODO | Validate: schema/format version, invalid dates, missing refs, duplicates/transfers anomalies, missing balance checkpoints; show severity badges |
| 7 | Transaction safety guarantee | 📋 TODO | Restore is atomic: on failure, old DB remains intact; on success, post-restore recalculation runs once (balances + derived caches) |
| 8 | Reset app safety flow (professional) | 📋 TODO | Typed confirmation (“RESET”); shows impact summary; offers export first; clear success state + “how to restore” hint |
| 9 | Error UX + support-friendly report | 📋 TODO | Friendly error messages; optional downloadable diagnostic report (counts + validation errors, no extra PII) |
| 10 | Docs: where data lives + how to back up | 📋 TODO | Explain IndexedDB + browser profiles, private browsing, clearing site data, recommended backup frequency, restore steps |

**Verification Checklist**:

- [ ] User can export and re-import on a fresh profile and the app works with identical totals
- [ ] Restore preview shows what will change before committing
- [ ] Replace restore auto-creates a pre-restore backup
- [ ] Failed import does not modify existing data
- [ ] Post-restore balances match recalculation + checkpoints
- [ ] Data & Backups UI matches Dashboard/Analytics visual patterns (cards, spacing, typography)

---

### v0.12.0 - Mobile, PWA, Accessibility

**Theme**: Make WealthPilot feel professional on every device (mobile-first), with a trustworthy baseline for accessibility and installability.

**Product Goals (challenge + sharpen)**:

- **Mobile is not a “nice to have”**: every core page must be usable one-handed on a phone (scroll, tap targets, dialogs, tables).
- **Accessible by default**: keyboard navigation and focus states work everywhere; color is never the only signal.
- **Professional UX parity**: Settings and system flows should match **Dashboard/Analytics** (clear hierarchy, calm cards, predictable patterns, no browser `alert()` UX).
- **Offline confidence**: PWA install + clear offline behavior; no broken screens when offline.

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Settings UX parity pass | 📋 TODO | Convert Settings to Analytics-style header + tabs; group sections; bento cards where appropriate; remove scary/dense blocks |
| 2 | Replace `alert()` UX with in-app messaging | 📋 TODO | Use inline callouts/toasts for success/error; ensure messages are visible even when switching tabs |
| 3 | Persist key preferences | 📋 TODO | Store budget alert threshold, backup gzip toggle, and similar in DB settings (not only in-memory) |
| 4 | Mobile app shell + drawer navigation | ✅ DONE | Responsive sidebar (desktop) + mobile drawer + header menu button; shared layout applies across core pages |
| 5 | Mobile responsiveness audit (core pages) | 📋 TODO | Dashboard/Analytics/Budgets/Transactions/Settings: spacing, overflow, tables, charts, dialogs; validate common breakpoints |
| 6 | Touch + gesture ergonomics | 📋 TODO | Minimum 44px tap targets; sticky table headers where needed; sensible mobile defaults for dense widgets |
| 7 | PWA installable | ✅ DONE | Manifest route + icons + service worker + offline fallback page + production-only registration |
| 8 | Offline UX baseline | 📋 TODO | Clear offline indicator; avoid failing actions silently; ensure navigation/pages still render from IndexedDB |
| 9 | Accessibility baseline | 📋 TODO | Keyboard nav, focus rings, aria labels, semantic headings, color contrast, reduced-motion support |
| 10 | Reduce “chart size = -1” prerender warnings | ✅ DONE | Defer charts until mounted (client-only guard) to avoid early container measurement issues |

**Verification Checklist**:

- [ ] All core pages are usable on 375px width without horizontal scrolling
- [ ] Settings matches Dashboard/Analytics visual patterns (header, tabs, cards)
- [ ] No browser `alert()` used for user-facing flows in Settings
- [ ] Keyboard-only navigation works on Settings and major dialogs (Restore/Reset)
- [ ] Lighthouse PWA install criteria met (manifest + icons)
- [ ] Charts do not throw size warnings on first paint

---

### v0.13.0 - Performance, Testing, Consistency

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Consolidate income/salary engine | 📋 TODO | Unify `financial-month.ts` + `budget-types.ts` so salary detection/bonuses/month boundaries are consistent |
| 2 | Large dataset performance | 📋 TODO | Index usage, pagination/virtualization for transactions, memoization hotspots |
| 3 | Expand test coverage | 📋 TODO | Import pipeline + transfer/duplicate detection + financial month boundaries |
| 4 | Typed settings layer | 📋 TODO | Centralize settings keys, parsing, defaults, migrations |

---

### v0.14.0 - Security & Privacy Hardening

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Encrypted exports (passphrase) | 📋 TODO | Encrypt backup file (WebCrypto) so exported data isn’t plain-text |
| 2 | Optional app lock | 📋 TODO | Simple lock screen (PIN/passphrase) to protect casual access on shared devices |
| 3 | Privacy audit | 📋 TODO | Ensure no sensitive data ends up in console logs/toasts/error reports |

---

### v0.15.0 - UI Foundation & System

**Theme**: Remove the “template-like” feel by making one cohesive product system.

**Spec**: `specs/ui-revamp/v0.15.0-ui-foundation.md`

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Design system & visual language | 📋 TODO | Tokens (spacing/type/color), component standards, consistent hierarchy |
| 2 | App shell & navigation polish | 📋 TODO | Sidebar/header cohesion, responsive shell, unify theme control |
| 3 | Data table + filters system | 📋 TODO | One FilterBar + DataTable pattern for all list pages |
| 4 | Empty/loading/error states | 📋 TODO | Designed states for every major page + component |
| 5 | Command palette & search | 📋 TODO | Cmd/Ctrl+K that actually searches transactions/categories/merchants |
| 6 | Notifications center | 📋 TODO | Real notifications model + UX (not mock data) |

**Verification Checklist**:

- [ ] Design tokens applied across shell + buttons + cards
- [ ] One table/filter system used by Transactions and at least one other page
- [ ] Dark mode persisted and controlled in one place
- [ ] Command palette can open a transaction from search

---

### v0.16.0 - Core Pages Revamp

**Theme**: Make the core flows feel premium: glance → investigate → act.

**Spec**: `specs/ui-revamp/v0.16.0-core-pages.md`

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Dashboard revamp | 📋 TODO | Clear hierarchy + actionable widgets + consistent time range controls |
| 2 | Transactions revamp | 📋 TODO | Power-user list UX: chips, bulk actions, fast edit, better density controls |
| 3 | Budgets revamp | 📋 TODO | Planner UX: stable income display, allocations, pace, overrides discoverability |
| 4 | Analytics revamp | 📋 TODO | Drilldowns + consistent period model + clear explanations of metrics |
| 5 | Import wizard revamp | 📋 TODO | Guided flow: preview, rules, confidence, dedup summary |
| 6 | Accounts revamp | 📋 TODO | Account health, balances, checkpoints UX, transfer clarity |

**Verification Checklist**:

- [ ] Every core page uses v0.15 system components
- [ ] Empty/loading/error states exist for all core pages
- [ ] Main action per page reachable in ≤2 clicks

---

### v0.17.0 - Premium Polish (Bank-Grade)

**Theme**: Cohesion, personalization, mobile quality.

**Spec**: `specs/ui-revamp/v0.17.0-premium-polish.md`

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Goals revamp | 📋 TODO | Planning UX that feels connected to accounts and budget reality |
| 2 | Subscriptions revamp | 📋 TODO | Clean management + detection + lifecycle UX |
| 3 | Calendar revamp | 📋 TODO | Bills + cashflow cadence; fast drilldowns |
| 4 | Settings & personalization | 📋 TODO | Theme, preferences, defaults; “safe changes” UX |
| 5 | Mobile/PWA/A11y | 📋 TODO | Responsive QA, installable PWA, keyboard/focus/contrast baseline |
| 6 | Micro-interactions & motion | 📋 TODO | Subtle motion; reduced-motion support; better perceived performance |

**Verification Checklist**:

- [ ] Responsive QA: 390px / 768px / 1024px / 1440px
- [ ] AA contrast check passes for text + badges + charts
- [ ] Keyboard-only usability for core flows
- [ ] Reduced motion supported

---

### v1.0.0 - Production Ready (Updated Definition)

**v1.0 is a quality bar, not “more features”.** Given the offline-first architecture, v1 should mean: safe, predictable, portable.

| # | Release Criteria | Why it matters |
|---|------------------|---------------|
| 1 | Backup/restore works reliably | User must never “lose the browser” and lose their finances |
| 2 | Consistent financial month + income model | Budgeting/analytics must agree on what “this month” means |
| 3 | No critical data integrity bugs | Balances, transfers, duplicates, exclusions behave correctly |
| 4 | Good UX on mobile + desktop | Finance apps are used on phones |
| 5 | PWA install + offline behavior is intentional | Clear caching rules; no surprise stale UI |
| 6 | Accessibility baseline met | Keyboard/focus + readable charts |
| 7 | Performance acceptable at scale | 10k+ transactions shouldn’t feel sluggish |
| 8 | Error handling is user-friendly | Clear toasts/messages; recoverable failures |
| 9 | Documentation matches reality | README + roadmap + migration notes |

---

## DEPRECATED / REMOVED Features

| Feature | Reason | Status |
|---------|--------|--------|
| Financial month dropdown in header | Non-functional, confusing | ✅ Removed |
| Send/Request buttons | Useless | 📋 TO REMOVE |
| Big action buttons at dashboard bottom | Atrocious | 📋 TO REMOVE |
| Insights card | Generic, not useful | Consider removing |
| Quick Actions section | User said useless | 📋 TO REMOVE |

---

## Current State Summary

### What ACTUALLY Works ✅

- Reactive data flow via `useLiveQuery` (most pages update without refresh)
- Multi-account support + transfer detection linking
- CSV import pipeline (format detection, parsing, rules, dedup)
- Analytics overhaul (dashboard-quality components, richer insights)
- Budgets overhaul + smart income + category type overrides
- Balance recalculation + checkpoints (foundation for correct balances)

### What Still Needs Work (Pre-v1) ⚠️

- Goals: real contribution mechanism + history (v0.10.0)
- Transaction type override UX: wire into transactions screens (v0.9.6)
- Data safety: export/import backup + reset flow (v0.11.0)
- UI/UX revamp: bank-grade design system + core pages (v0.15.0–v0.17.0)
- Mobile + PWA + accessibility baseline (v0.12.0)
- Consistency: unify income/financial month logic (v0.13.0)

### Nice-to-Have (Pre-v1) 🌟

- Goals: deleting a goal should also delete its contribution history (avoid orphan rows)
- Transactions: support deep-linking to a goal-focused view (e.g. `/transactions?goalId=123`) to power “Fund this goal” flows

---

## Priority Order

1. **v0.9.6** - Transaction override UX wiring
2. **v0.10.0** - Goals overhaul
3. **v0.11.0** - Data safety & portability (backup/restore)
4. **v0.15.0** - UI foundation & system (design language + tables + states + search)
5. **v0.12.0** - Mobile + PWA + accessibility
6. **v0.13.0** - Performance + testing + consistency
7. **v0.16.0** - Core pages UI revamp
8. **v0.14.0** - Security & privacy hardening
9. **v0.17.0** - Premium polish
10. **v1.0.0** - Production-ready release criteria

---

*Each version = 1 focused work session with verification*
*DO NOT proceed to next version until current is VERIFIED WORKING*
