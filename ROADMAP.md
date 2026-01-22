# WealthPilot - Product Roadmap

**Last Audit Date**: January 21, 2026
**Last Update**: v0.13.0 Performance, Testing & Consistency ✅ (shipped)

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
| v0.10.0 | ✅ Released | Goals Overhaul | Goal tracking + optional account linking |
| v0.11.0 | ✅ Released | Data Safety & Portability | Backup export/restore/reset baseline |
| v0.12.0 | ✅ Released | Mobile, PWA, Accessibility | Mobile shell + PWA baseline + chart mount-guard |
| v0.12.1 | ✅ Released | Professional Polish | Settings revamp + System integrity + Toasts |
| v0.13.0 | ✅ Released | Performance & Consistency | Income engine + Goal linking + Testing |

---

## Roadmap (Realistic)

### v0.12.1 - Professional Polish & Settings Revamp ✅ COMPLETED

**Theme**: Elevate the app's professionalism with a unified system and robust settings.

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Toast Notification System | ✅ DONE | Replaced `alert()` with shadcn/ui Toaster |
| 2 | Settings Page Architecture | ✅ DONE | Refactored into modular components (`components/settings/*`) |
| 3 | Settings UX Parity | ✅ DONE | Tabs layout, responsive design, visual consistency with Dashboard |
| 4 | "Merge" Backup Strategy | ✅ DONE | Added "Merge" option to Restore dialog (upsert logic) |
| 5 | Documentation | ✅ DONE | Added Help tab in Settings explaining data storage & backups |
| 6 | Mobile Responsiveness | ✅ DONE | Settings tabs are scrollable; grids adapt to mobile |

---

### v0.13.0 - Performance, Testing, Consistency ✅ COMPLETED

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Consolidate income/salary engine | ✅ DONE | Unified `financial-month.ts` + `budget-types.ts` into single source of truth |
| 2 | Large dataset performance | ✅ DONE | Defaulted transactions to 2 months view + added date range filter |
| 3 | Expand test coverage | ✅ DONE | Added `vitest` + unit tests for new income engine |
| 4 | Typed settings layer | ⏩ DEFERRED | Postponed to v1 cleanup |
| 5 | Link goal to real account | ✅ DONE | Added `linkedAccountId` to goals + UI support |

---

### v0.14.5 - Pro Intelligence & Security (In Progress)

**Theme**: "100x Engineer" standards - Proactive intelligence + Bank-grade security.

**Spec**: `specs/ui-revamp/v0.14.5-pro-intelligence.md`

| # | Task | Status | Details |
|---|------|--------|---------|
| 1 | Global Privacy Audit & Fix | 📋 TODO | Ensure `PrivacyBlur` covers ALL currency values across every page/component |
| 2 | Advanced CFO Layer | 📋 TODO | Health Score v2, Cash Flow Anomaly Detection, Multi-month Predictions |
| 3 | App Lock (PIN) | 📋 TODO | Lock screen with PIN protection + auto-lock on inactivity |
| 4 | Encrypted Backups | 📋 TODO | AES-GCM encryption for exports with user passphrase |
| 5 | Power-User Command Palette | 📋 TODO | Natural language search ("Amazon last month") + bulk actions |
| 6 | Bulk Transaction Workbench | 📋 TODO | Dedicated UI for fast categorizing/cleaning large datasets |
| 7 | Multi-Currency Engine | 📋 TODO | Support for accounts in different currencies with local FX caching |
| 8 | Reliability Hardening | 📋 TODO | Stress testing (10k+ tx) + Schema Migration framework |

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
- Data safety: export/import backup (Merge & Replace strategies)
- Settings: Unified, responsive, modular settings page
- System Feedback: Toast notifications for user actions
- **Goals linked to real accounts** (v0.13.0)
- **Consistent Income Engine** (v0.13.0)
- **Performance optimized for large datasets** (v0.13.0)

### What Still Needs Work (Pre-v1) ⚠️

- UI/UX revamp: bank-grade design system + core pages (v0.15.0–v0.17.0)

### Nice-to-Have (Pre-v1) 🌟

- Goals: deleting a goal should also delete its contribution history (avoid orphan rows)
- Transactions: support deep-linking to a goal-focused view (e.g. `/transactions?goalId=123`) to power “Fund this goal” flows

---

## Priority Order

1. **v0.15.0** - UI foundation & system (design language + tables + states + search)
2. **v0.16.0** - Core pages UI revamp
3. **v0.14.0** - Security & privacy hardening
4. **v0.17.0** - Premium polish
5. **v1.0.0** - Production-ready release criteria

---

*Each version = 1 focused work session with verification*
*DO NOT proceed to next version until current is VERIFIED WORKING*