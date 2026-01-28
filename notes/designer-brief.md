# Kontrol Fin (WIP) — Designer Brief

Working title: **Kontrol Fin (WIP)** (internal repo name: WealthPilot).  
Scope: current product only (exclude any `/lab` experiments).

## 1) Product Snapshot
Kontrol Fin is a privacy-first personal finance dashboard that runs fully offline. Users import bank CSVs, categorize and analyze spending, plan budgets, track goals, and monitor subscriptions/bills. All data stays in the browser (IndexedDB) with no accounts or backend.

## 2) Audience + Core Promise
- **Audience:** Individuals who want a clear, modern view of their personal finances without sharing data.
- **Promise:** “Full control and insight, zero data leaving your device.”

## 3) Current Information Architecture (Non‑Lab)
- **Dashboard (`/`)**: At-a-glance health, quick stats, upcoming bills, monthly summary.
- **Transactions (`/transactions`)**: List + filters, categorization, edits, overrides.
- **Analytics (`/analytics`)**: Trends, bento-grid insights, forecasts, health score.
- **Budgets (`/budgets`)**: 50/30/20 + custom budgets, pace, alerts, overrides.
- **Goals (`/goals`)**: Savings goals, history, optional account linking.
- **Subscriptions (`/subscriptions`)**: Recurring detection, payment history, merges.
- **Calendar (`/calendar`)**: Bill calendar and cashflow timing.
- **Accounts (`/accounts`)**: Multi-account overview, balances, checkpoints.
- **Import (`/import`)**: CSV import with smart/legacy modes.
- **Settings (`/settings`)**: Data backup/restore, preferences, system info.
- **Categories (`/categories`)**: Category organization and editing.

## 4) Current UX Shell + Navigation
- **Navigation:** A bottom “Command Dock” is the primary nav (Dashboard, Transactions, Analytics, Budgets, Goals). Secondary routes live in a dropdown (Subscriptions, Calendar, Accounts, Import, Settings).
- **Command Search:** Global command palette (Cmd/Ctrl+K) with natural query filters (merchant, category, account, tags, amount, date ranges).
- **Keyboard:** “G + key” navigation chords (e.g., G D, G T, G B, G A).
- **Account Context:** Global account switcher (All Accounts or specific account).
- **Privacy Mode:** Toggle hides/blur currency values across the UI.
- **Page Structure:** Non-dashboard pages display a title + subtitle in the header area.

## 5) Visual System (Current)
- **Surfaces:** Card-based layouts 
- **Background:** Subtle gradient wash with radial highlights.
- **Motion:** Subtle “float-in” page load and dock glow.

## 6) Key Interaction Patterns
- **Cards + bento grids** on Dashboard and Analytics.
- **Data tables** for Transactions and import previews.
- **Chips/badges** for categories, statuses, and summaries.
- **Inline actions** for edits, linking, and bulk operations.

## 7) Primary Flow to Describe (CSV Import)
**Entry point:** `/import` (Smart Import mode is default; Basic is optional fallback).
1. **Select/Create Account**: User chooses an existing account or creates one inline.
2. **Upload CSV**: Drag & drop or file picker. System auto-detects CSV format.
3. **Preview**: Summary counts, date range, category breakdown, duplicate detection.
4. **Import**: Batch import + recurring transaction detection.
5. **Complete**: Success summary (imported / duplicates / errors) with CTA to Transactions.

## 8) Non‑Negotiables / Constraints
- **Offline‑first:** No backend; all data local in IndexedDB.
- **Privacy:** Data never leaves the device; privacy blur must be supported.
- **Multi‑account:** Account context filters all views.
- **Design direction (roadmap):** Next phase is a design system + UI revamp (v0.15–v0.17).

## 9) Goal for Designer
Interpret the current UX into a cohesive, premium UI system while preserving the existing information architecture and core flows, especially the import flow and account context. The design should feel “bank‑grade” but modern and friendly.
