import { within } from "./dates";
import { upcoming } from "./events";
import { memo, type Ledger } from "./ledger";
import { monthOf, monthRange } from "./periods";
import type { Budget } from "./types";

// The single paid/committed/free implementation, shared by available, forecast,
// week and simulation.

export interface Envelope {
  category: string;
  budgets: Budget[];
  allocated: number;
  paid: number;
  committed: number;
  /** Sum of max(0, allocated − paid − committed) per budget. */
  free: number;
  over: boolean;
}

/** Account allocations nest inside a household envelope, never on top of it. */
export const scopedBudgets = (budgets: Budget[], account: string) =>
  budgets.filter((b) =>
    account
      ? b.account === account
      : !b.account ||
        !budgets.some(
          (g) => !g.account && g.month === b.month && g.category === b.category,
        ),
  );

const key = (month: string, account: string, category: string) =>
  JSON.stringify([month, account, category]);

function add(
  map: Map<string, number>,
  month: string,
  account: string,
  category: string,
  n: number,
) {
  for (const k of [key(month, account, category), key(month, "", category)])
    map.set(k, (map.get(k) ?? 0) + n);
}

/** Paid external spending by budget month, account and category, up to `asOf`. */
const paidIndex = memo((ledger: Ledger) => {
  const paid = new Map<string, number>();
  for (const t of ledger.transactions)
    if (!t.internal && t.amount < 0 && t.date <= ledger.asOf)
      add(
        paid,
        monthOf(t.date, ledger.calendar),
        t.account,
        t.category,
        -t.amount,
      );
  return paid;
});

/** Unpaid expected spending dated inside the month's real range (capped, never open-ended). */
const committedIndex = memo((ledger: Ledger, month: string) => {
  const range = monthRange(month, ledger.calendar);
  const committed = new Map<string, number>();
  for (const o of upcoming(ledger, "", range.to))
    if (!o.internal && o.amount < 0 && o.category && within(o.date, range))
      add(committed, month, o.account, o.category, -o.amount);
  return committed;
});

export const envelopes = memo(
  (ledger: Ledger, account: string, month: string): Envelope[] => {
    const paid = paidIndex(ledger);
    const committed = committedIndex(ledger, month);
    const rows = new Map<string, Envelope>();
    for (const b of scopedBudgets(ledger.budgets, account)) {
      if (b.month !== month) continue;
      const k = key(month, b.account ?? "", b.category);
      const p = paid.get(k) ?? 0;
      const c = committed.get(k) ?? 0;
      const row = rows.get(b.category) ?? {
        category: b.category,
        budgets: [],
        allocated: 0,
        paid: 0,
        committed: 0,
        free: 0,
        over: false,
      };
      row.budgets.push(b);
      row.allocated += b.amount;
      row.paid += p;
      row.committed += c;
      row.free += Math.max(0, b.amount - p - c);
      row.over = row.paid + row.committed > row.allocated;
      rows.set(b.category, row);
    }
    return [...rows.values()].sort(byBudgetOrder(ledger.prefs.budgetOrder));
  },
);

export const envelopeTotals = (rows: Envelope[]) =>
  rows.reduce(
    (t, e) => ({
      allocated: t.allocated + e.allocated,
      paid: t.paid + e.paid,
      committed: t.committed + e.committed,
      free: t.free + e.free,
    }),
    { allocated: 0, paid: 0, committed: 0, free: 0 },
  );

/** Saved envelope order first (shared by the dashboard and the week), then by name. */
export function byBudgetOrder(order: string[]) {
  const rank = (c: string) =>
    order.includes(c) ? order.indexOf(c) : order.length;
  return (a: { category: string }, b: { category: string }) =>
    rank(a.category) - rank(b.category) ||
    a.category.localeCompare(b.category, "fr");
}
