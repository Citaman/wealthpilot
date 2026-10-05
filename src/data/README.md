# src/data — persistence, commands, import

Components never touch `db` directly. Compatibility rules: `docs/data.md`.

## Reading (`hooks.ts`)

- `useTables()` → `{ transactions, accounts, budgets, dues, batches }` (`[]` until loaded). One shared live query per table: an array keeps its identity until its table is written.
- `usePreferences()` → stored row merged with defaults; never writes.
- `useLedger(asOf)` → `Ledger` shared by all components for that `asOf`. Rebuilt only when a table or the finance part of the prefs changes (`dashboard` edits keep it).
- `useLoaded()` → `true` once every table has been read. `useDashboardLayout()` → `prefs.dashboard` (may be `undefined`: use the default layout).

## Commands (`commands.ts`)

Each runs in one Dexie rw transaction and resolves to an `Undo` (`() => Promise<void>`) for the toast.

- `patchPreferences(p => partial)` — only returned keys change; `undefined` removes a key.
- `updateTransactions(ids, patch)` — `merchantName, category, subcategory, categoryId, subcategoryId, note, internal` only.
- `setBudget({ month, category, account? }, cents | null)` — create / update / delete (`null`).
- `reorderEnvelopes(order)`, `setSafety(cents)`, `saveDashboard(layout)`, `renameAccount(id, alias)` (`""` clears).
- `saveWeekLimit(account, monday, category, cents | null)` — undo only touches that category.
- `saveDue(due)`, `deleteDue(id)`, `adjustOccurrence(occurrence, { amount?, date? })` — an estimated occurrence becomes a persisted due with `originOccurrenceId` (and is listed in `ignoredOccurrences`, legacy contract); a persisted due is updated.
- `ignoreOccurrence(id)`, `restoreOccurrence(id)` (refused while an adjusted due exists), `confirmRecurrence(rule)`, `dismissRecurrence(key)`.
- `setCheckpoint(accountId, { date, amount })` — manual observed balance; replaces a manual one on the same date and wins against an imported one on that date.
- Errors: `ConflictError` (concurrent change, message is user-facing French), `RangeError` (invalid input the UI should have caught).

## Import (`importer/`)

1. `startImport(file, onProgress)` (`start.ts`) → `{ promise: Promise<ParsedFile>, cancel() }`. Decoding (UTF-8, else Windows-1252), SHA-256 and parsing run in the worker. Rejects with `ImportError` (extension, 20 Mo, unreadable) or `AbortError` on cancel. `fileProblem(file)` checks a drop before starting. `ParsedFile` exposes `encoding`, `delimiter`, `profile` (`sg` | `generic`), `errors`.
2. `analyzeFile(parsed, { accounts, batches })` (`mapping.ts`) → `{ profile, mapping, mappingIssues, detectedAccounts, identifiedAccount?, alreadyImported?, choice }`. Show the mapping step when `mappingIssues` is non-empty; stop when `alreadyImported`.
3. Mapping UI: `mappingFields` (`balance` = daily balance column, gives derived checkpoints), `mappingIssues(mapping)` for live validation.
4. Account dialog: `AccountChoice = Record<sourceAccount, destination>`; key `""` is for rows without an account column (single-account files, SG). Destination = existing id or new name (created at commit). `accountChoiceIssues(parsed, mapping, choice, accounts)` validates the dialog; `identifiedAccount` must stay locked.
5. `buildPreview(parsed, mapping, choice, { transactions, accounts })` (`preview.ts`) → `Preview { rows: { index, status: 'new'|'duplicate'|'invalid', reason?, tx?, existingId? }[], counts, checkpoints: { account, date, amount, status, delta?, coverageFrom?, coverageThrough? }[], newAccounts, errors, token }`. `errors` non-empty ⇒ commit is refused.
6. `commitImport(preview, { selected?, checkpointDecisions? })` (`commit.ts`) → `Batch`. `selected` defaults to every `new` row. Each `preview.checkpoints[].account` needs a decision: `accept` (observed only) | `derived` (reconstructed only) | `keep`. Throws `StaleError` when duplicates or balances changed since the preview: rebuild it and show « Les données ont changé, aperçu recalculé ».
7. `undoBlockers(batchId)` → hand-edited rows that undo would delete (show « N opérations modifiées · Voir »). `undoImport(batchId)` throws `ImportError` while there are blockers; rows shared with another batch are reassigned to it, never deleted.

## Backup (`backup.ts`)

- `exportBackup()` → JSON string; `parseBackup(json)` → `Snapshot` or `BackupError` (French reason); `backupInventory(snapshot)` → counts + date range for the confirm dialog; `restoreBackup(snapshot)` replaces every table atomically (download `exportBackup()` first).
- `exportTransactionsCsv(rows, aliases?)` → `;` CSV with BOM, French amounts, formula cells prefixed by `'`; account ids are kept so the file re-imports as duplicates (`account_name` column added with aliases).
- `downloadFile(name, content, type)`.

Legacy preference keys (`board`, `widgets`, `tones`, `goal`, `householdPlan`…) are restored and kept verbatim; only fields v2 reads are validated.
