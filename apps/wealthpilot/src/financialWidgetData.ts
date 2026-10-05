import type { Snapshot } from "./types";
import { today } from "./domain";
import { monthRange, shiftMonth, spendingHistory } from "./intelligence";
import {
  budgetCalendar,
  budgetCycle,
  budgetCycleKey,
  periodBounds,
  within,
  type DateRange,
} from "./periods";

/** A descriptive threshold, never an outlier probability or a prediction. */
export function unusualExpenses(
  snapshot: Snapshot,
  account: string,
  fromMonth: string,
  month: string,
  asOf = today(),
  range?: DateRange,
) {
  const period =
    range ??
    periodBounds(fromMonth, month, budgetCalendar(snapshot.transactions, asOf));
  const scoped = snapshot.transactions.filter(
    (t) => !account || t.account === account,
  );
  const cutoff = [period.to, asOf].sort()[0];
  // Exclude the entire cycle containing the first selected day (or today for a
  // future selection). The reference must never train on the examined period.
  const referenceBefore = budgetCycle(
    budgetCycleKey(
      [period.from, asOf].sort()[0],
      budgetCalendar(snapshot.transactions, asOf),
    ),
    budgetCalendar(snapshot.transactions, asOf),
  ).from;
  const history = spendingHistory(
    { ...snapshot, transactions: scoped },
    referenceBefore,
    budgetCalendar(snapshot.transactions, asOf),
  );
  const baseline = new Map(
    history.categories.map((c) => [c.category, c.average]),
  );
  const candidates = scoped.filter(
    (t) =>
      !t.internal && t.amount < 0 && within(t.date, period) && t.date <= cutoff,
  );
  const rows = candidates
    .filter((t) => {
      const average = baseline.get(t.category);
      return (
        average !== undefined &&
        average > 0 &&
        -t.amount > average * 0.5 &&
        -t.amount > 10000
      );
    })
    .toSorted((a, b) => a.amount - b.amount);
  return {
    rows,
    history,
    cutoff,
    referenceBefore,
    unassessedCount: candidates.filter((t) => !baseline.has(t.category)).length,
  };
}

/** Compare actual imported spending in budget cycles, without extrapolation. */
export function cycleComparison(
  snapshot: Snapshot,
  account: string,
  period: DateRange,
  asOf = today(),
) {
  if (period.from > period.to) return [];
  const day = budgetCalendar(snapshot.transactions, asOf);
  const selected = monthRange(
    budgetCycleKey(period.from, day),
    budgetCycleKey(period.to, day),
  );
  const keys =
    selected.length > 1
      ? selected
      : [shiftMonth(selected[0], -2), shiftMonth(selected[0], -1), selected[0]];
  return keys
    .filter((key) => {
      const cycle = budgetCycle(key, day);
      return cycle.from <= cycle.to;
    })
    .map((key) => {
      const cycle = budgetCycle(key, day);
      const selectedCycle = selected.includes(key);
      const from =
        selectedCycle && period.from > cycle.from ? period.from : cycle.from;
      const selectedEnd =
        selectedCycle && period.to < cycle.to ? period.to : cycle.to;
      const to = selectedEnd < asOf ? selectedEnd : asOf;
      return {
        key,
        cycle,
        from,
        to,
        value: snapshot.transactions
          .filter(
            (t) =>
              within(t.date, { from, to }) &&
              (!account || t.account === account) &&
              !t.internal &&
              t.amount < 0,
          )
          .reduce((total, t) => total - t.amount, 0),
        future: from > to,
        partial: from > cycle.from || to < cycle.to,
        current: within(asOf, cycle),
      };
    });
}
