# src/domain — pure finance API

No React, no Dexie, no clock: `asOf` lives in the `Ledger`. Money in integer cents, dates `YYYY-MM-DD`.
`account: ""` is the household. Import modules directly (no barrel). Selectors marked *memo* are cached per
ledger identity + args: call them freely from render.

## Ledger (`ledger.ts`)
- `financePrefs(prefs) → FinancePrefs` — finance subset of `Preferences` (`projectsReserve` = saved money of `goal` + `extraGoals`).
- `buildLedger({transactions, accounts, budgets, dues, batches, prefs}, asOf) → Ledger` — adds `asOf`, `byAccount` (date-sorted), `calendar`.
- `memo(fn)` — wrap a `(ledger, ...args)` selector. `Scope = {account, range, asOf}` (selectors read `asOf` from the ledger).
- `accountsIn(ledger, account)`, `rowsIn(ledger, account)` (transactions of the scope), `accountName(ledger, id)` (alias or id).

## Budget months (`periods.ts`) — income-anchored, see brief §28
- `budgetCalendar(tx, asOf) → {asOf, start, observed[], projected[]}` (cached per array + asOf; `ledger.calendar`).
- `monthOf(date, calendar) → "YYYY-MM"` · `monthRange(key, calendar) → {from, to, partial?, estimatedEnd?}` (may be empty `from > to` for a month without income).
- `currentMonthKey(calendar, asOf)` · `nextBoundary(calendar) → {date, estimated} | null`.
- `currentMonthEnd(calendar, asOf)` — end of the current budget month (asOf + 35 d when no next income) · `nextMonthEnd(...)` — balance-card forecast horizon.
- `periodOptions(calendar, asOf) → {value: PeriodValue, label, range}[]` — months newest first (non-empty only), then 30 j, 3/6/12 mois, tout.
- `resolvePeriod(value, calendar, asOf) → {from, to, label, partial?, estimatedEnd?}` — month ranges are full (may end after asOf).

## Balances (`balances.ts`)
- `checkpointForDate(account, date)` · `coverageStatus(account, date) → observed|covered|derived|incomplete|unknown`.
- `balanceAt(account, rows, date) → number | null` · `householdBalance(ledger, account, date) → number | null` (null if any account has no anchor).
- *memo* `balanceSeries(ledger, scope) → {granularity, points: {date, value|null, gap, observed, count, net}[], perAccount: {account, name, values[]}[]}` — closing balances up to `min(range.to, asOf)`; day ≤ 120 d, week ≤ 2 y, else month (bucket = last day; first point kept).
- *memo* `accountStatus(ledger) → {id, name, balance, checkpoint, ageDays, freshness: ok|stale(>7 d)|unknown, lastImport, coverage: DateRange[]}[]`.

## Expected movements (`events.ts`, `recurring.ts`)
- `Occurrence = {id, kind: due|estimate|known, date, amount, label, account, category?, internal?, overdue, recurrenceKey?, confirmed?, confidence?, spread}`.
- *memo* `upcoming(ledger, account, until) → Occurrence[]` — unlinked dues (overdue included), estimates, future-dated imports; sorted.
- `effectiveDate(o, asOf)` — overdue items move cash on `asOf`. *memo* `nextIncome(ledger, account) → Occurrence | null`.
- `detectRecurrences(tx, asOf) → Recurrence[]` (cached) · *memo* `activeRecurrences(ledger)` — rules + detected, `confirmed`, `paused` (paused rule or dismissed).
- *memo* `estimates(ledger, end) → Occurrence[]` — ids `estimate:<key>:<date>`, key `JSON.stringify([account, identity, sign])` (`recurrenceKey(t)`).

## Envelopes and available (`envelopes.ts`, `available.ts`)
- *memo* `envelopes(ledger, account, monthKey) → {category, budgets, allocated, paid, committed, free, over}[]` — the only paid/committed/free; ordered by `budgetOrder`.
- `envelopeTotals(rows) → {allocated, paid, committed, free}` · `scopedBudgets(budgets, account)` · `byBudgetOrder(order)` comparator.
- *memo* `available(ledger, account) → {cash, until, charges[], chargesTotal, envelopesFree, safety, projects, free, expectedIncome[], unknownBalance, sharedReserveNote}` — current budget month, independent of the dock period; `free = cash − charges − envelopesFree − safety − projects` (null if cash unknown, negative kept).

## Forecast (`forecast.ts`)
- *memo* `forecast(ledger, account, end) → {start, points: {date, value, low, high}[], events, lowPoint: {date, value, account?} | null, committedLow, provisions: Record<month, cents>, reserve, shortfalls}`.
  Points start at `asOf` (overdue applied there). `shortfalls: {account, date, threshold, low, amount}[]` per account (household = all accounts).
- `reserveFor(ledger, account)` — household: safety + projects; account: this week's saved plan reserve. `planningEnd(ledger, date)` — horizon used by week/simulation.

## Week (`week.ts`)
- *memo* `weekPlan(ledger, account, monday) → {start, end, account, days[7]: {date, spent, charges[], incomes[], endBalance}, envelopes: {category, limit, proposed, saved, paid, committed, possible}[], totals: {limit, paid, committed, possible}, lowPoint, assumptions: {status, weeks, verifiedWeeks, capacity, reserve, months}}`.

## Purchase test (`simulate.ts`)
- *memo* `simulatePurchase(ledger, {amount, category, date, account}) → {inEnvelope, envelope: {category, before, after} | null, free: {before, after}, low: {before, after}, projection: {date, value}[], verdict: ok|outside|risk, riskDate?}` — reuses the memoized forecast; an in-envelope purchase does not lower free money or the month-end balance again.

## Analyses, inbox, categories, search
- *memo* `monthlyFlows(ledger, account, count) → {month, range, income, spending, net, complete}[]` (oldest first, transfers excluded, ≤ asOf).
- *memo* `spendingByCategory(ledger, scope) → {category, amount, share, usual, deltaPct}[]` — usual = median of the 3 previous months with data. *memo* `unusualExpenses(ledger, scope) → Transaction[]` · *memo* `usualSpending(ledger, account, month) → Map`.
- *memo* `inbox(ledger, account) → ({kind: uncategorized, ids} | {kind: recurrence, recurrence} | {kind: balance, account, freshness, ageDays} | {kind: future, ids})[]`.
- `isUncategorized(name)` · `categoryColor(name, definitions)` · `CATEGORY_COLORS`, `OTHERS_COLOR` · *memo* `categoryNames(ledger)`, `subcategoryNames(ledger, category)` · `similarTransactions(ledger, t)` · `suggestCategories(ledger, t) → string[3]`.
- *memo* `filterTransactions(ledger, {account, range, kind, categories, min, max, uncategorized, withNote, query, sort, batchId?}) → Transaction[]` · `sortTransactions(rows, sort)` · `summarize(rows, asOf) → {count, income, spending, net}` · `searchScore`, `normalize`, `merchantLabel`.
- `brandFor(name)`, `subcategoryOf(raw)` (`merchants.ts`) · `normalizedText`, `recurrenceIdentity` (`text.ts`, frozen identity normalisation).
