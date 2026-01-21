# Data Safety & Portability (Backups / Restore) Specification

**Version**: v0.11.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

WealthPilot is offline-first (IndexedDB via Dexie). That means **backup/restore is a core feature**, not an add-on.

This spec defines:
- The **backup file format** (versioned, portable)
- The **restore strategies** and safety guarantees
- The **UI/UX flows** (aligned to Dashboard + Analytics visual patterns)
- Validation, health checks, and acceptance criteria

---

## Product Goals

1. **Zero-surprises safety**
   - No destructive operation (restore/replace/reset) without a clear preview and explicit confirmation.

2. **Portability**
   - A user can move to a new browser profile or new device and restore all data reliably.

3. **Confidence**
   - The app validates backups before writing anything (schema/format checks + data integrity checks).

4. **Professional UX**
   - Calm, predictable flows; no “developer-looking” JSON dumps; success/error states are clear.

---

## Non-Goals (Explicit)

- **Encryption** of exports (planned for v0.14.0). v0.11.0 files are plain JSON (optionally compressed).
- **Cloud sync** / multi-device real-time sync.
- **Multi-user accounts**.
- **Partial restore** of a single table (can be considered later).

---

## Source of Truth

- The canonical data lives in IndexedDB under Dexie database name `WealthPilotDB`.
- Backup/restore must include **all persistent tables** used by the app.

Current tables (as of schema v6):
- `accounts`
- `transactions`
- `budgets`
- `goals`
- `goalContributions`
- `categoryRules`
- `recurringTransactions`
- `detectedSalaries`
- `settings`
- `merchantRules`
- `importRules`
- `customCategories`
- `balanceCheckpoints`

---

## Backup File Format

### Format: Snapshot v1

- File content is JSON (UTF-8).
- Backup is **self-contained**.
- Backup is **versioned** to support future migrations.

Recommended filename:
- `wealthpilot-backup-YYYY-MM-DD.json`
- If compressed: `wealthpilot-backup-YYYY-MM-DD.json.gz` or `.zip`

### Schema

```ts
// formatVersion is NOT the Dexie schema version.
// formatVersion is the backup-file contract.

type BackupFormatVersion = 1;

type IsoDateTime = string; // ISO 8601, e.g. 2026-01-21T12:34:56.000Z

type BackupStrategy = 'snapshot';

type BackupMetaV1 = {
  formatVersion: BackupFormatVersion;
  strategy: BackupStrategy;
  createdAt: IsoDateTime;

  // For user understanding + diagnostics
  appVersion?: string;
  schemaVersion?: number; // Dexie version (e.g., 6)

  // Optional: identify environment (helpful for debug)
  userAgent?: string;
  timezone?: string;
};

// Table payloads are raw rows.
// All IDs must be preserved.

type BackupTablesV1 = {
  accounts: unknown[];
  transactions: unknown[];
  budgets: unknown[];
  goals: unknown[];
  goalContributions: unknown[];
  categoryRules: unknown[];
  recurringTransactions: unknown[];
  detectedSalaries: unknown[];
  settings: unknown[];
  merchantRules: unknown[];
  importRules: unknown[];
  customCategories: unknown[];
  balanceCheckpoints: unknown[];
};

type BackupSnapshotV1 = {
  meta: BackupMetaV1;
  tables: BackupTablesV1;
};
```

### Compatibility Rules

- **Backward compatibility** (import older backups):
  - v0.11.0 must support `formatVersion: 1` only.
  - Future versions may support 1…N.

- **Forward compatibility** (import newer backups):
  - If `formatVersion` is unknown/newer → show a friendly error and do not modify data.

---

## Compression

Compression is optional and must not be required.

- Default: uncompressed JSON download.
- Optional: compressed download (gzip/zip), only if supported in the runtime.

UX requirement:
- Compression toggle is **secondary** (advanced) and defaults to OFF.

---

## Restore Strategies

### Strategy A — Replace All Data (Default)

This is the safest, easiest-to-explain strategy.

Rules:
- Existing data is fully replaced by the backup snapshot.
- The UI must strongly recommend (and default) to creating a **pre-restore backup**.

Safety requirements:
- **Dry-run validation first** (no writes).
- **Atomicity**: either the restore fully succeeds, or the existing DB remains intact.

### Strategy B — Merge (Advanced)

Merge is optional for v0.11.0, but the behavior must be defined if it’s offered.

If enabled in v0.11.0, merge rules:
- Treat backup rows as authoritative for their primary keys.
- For each table:
  - If ID does not exist locally → insert.
  - If ID exists locally → by default **overwrite** the row.
- No attempt to “reconcile” transactions by fuzzy match (that’s import/dedup territory).

UX requirement:
- Merge must be labeled **Advanced** and explain overwrite semantics.

---

## Validation & Health Checks (Dry-Run)

Dry-run runs after file selection and before the user can confirm restore.

### Required Validations (Hard Fail)

- JSON parse succeeds
- `meta.formatVersion === 1`
- `tables` contains all required keys
- Each table value is an array
- Row shapes are roughly valid (minimal required fields exist)
  - Example: every `transaction` has at least `date`, `amount`, `accountId`
- Referential integrity (hard checks):
  - `transactions.accountId` references an account ID present in `accounts`
  - `goalContributions.goalId` references a goal ID present in `goals`
  - `balanceCheckpoints.accountId` references `accounts`

### Warnings (Soft Fail / Continue Allowed)

- Date strings not ISO-like (still parseable)
- Missing optional tables/fields that can be defaulted (future migrations)
- “Suspicious” totals (e.g., 0 transactions, 0 accounts) — still allow restore

### Analytics-like Summary Metrics

The preview should compute and show:
- Count per table
- Date range of transactions
- Accounts list summary (name + currency + current balance field)
- Warning count (by severity)

---

## Post-Restore Actions

After a successful restore:
- Trigger **one** recalculation pass for balances (and any derived caches)
- Re-run transfer/duplicate linking if necessary (if the app normally recomputes these)
- Show a success screen with:
  - What changed
  - Quick links: Dashboard, Transactions, Settings

---

## UI/UX Specification

### Information Architecture

Settings → **Data & Backups**

### Layout Principles (match Dashboard/Analytics)

- Bento-like cards
- Strong typographic hierarchy
- Clear primary actions; secondary actions are visually de-emphasized
- Friendly status badges (Success / Warning / Error)

### Screen: Data & Backups

Cards:
1. **Backup**
   - Shows: “Last backup: …” (if tracked)
   - Primary CTA: “Export backup”
   - Secondary: “Advanced options” (compression toggle)

2. **Restore**
   - Primary CTA: “Import backup…”
   - Shows: accepted formats
   - Secondary: “View restore guide” (opens docs section)

3. **Reset App**
   - Danger styling
   - CTA: “Reset” (opens confirmation dialog)

### Flow: Export

1. Click Export
2. Show progress state (spinner + “Preparing backup…”)
3. Download file
4. Toast: “Backup exported” + file name
5. Update “last backup” timestamp in settings (best-effort)

### Flow: Restore (Replace)

1. Choose file
2. Parse + dry-run validation
3. Preview screen:
   - Summary (counts + date range)
   - Warnings list (collapsible)
   - Strategy selector (Replace default)
   - Toggle: “Create pre-restore backup” (default ON)
4. Confirm restore
5. Progress: “Restoring data…”
6. Post-restore: “Recalculating balances…”
7. Success screen

### Flow: Reset

1. Show impact summary (tables + counts)
2. Offer “Export backup first” (default ON)
3. Typed confirmation: user must type `RESET`
4. Perform reset
5. Success screen: “App reset” + CTA to restore

### Errors & Recovery

- Any failure must show:
  - What happened (human-readable)
  - What to do next (retry, pick another file, export diagnostics)
- Provide optional “Download diagnostics” with:
  - meta + counts + validation error list
  - no full transaction details by default

---

## Acceptance Criteria

### Functional

- Export produces a valid Snapshot v1 file containing all tables.
- Import preview runs validations and shows summary + warnings.
- Replace restore completes successfully on a fresh profile and yields identical totals.
- Failed restore does not modify existing data.
- Reset requires typed confirmation and offers export-first.

### UX

- All flows have clear loading/success/error states.
- Data & Backups screen matches the feel of Dashboard/Analytics (cards, spacing, typography).
- No scary/destructive action is one-click.

### Performance

- Export/Import handles at least 10k transactions without freezing the UI.
- Long operations show progress and remain responsive.

---

## Open Questions (Decide Before Coding)

1. Compression: prefer `.gz` (gzip) vs `.zip` (zip)? 
    - Answer: gzip is simpler for single files.
2. Should we track “last backup date” in settings automatically, or only show “exported now” after a success?
    - Answer: track last backup date automatically after each successful export.
3. Merge strategy: ship in v0.11.0 as Advanced, or defer to later?
    - Answer: defer to later; focus on Replace strategy for v0.11.0. (put it in the prev-v1 spec)
