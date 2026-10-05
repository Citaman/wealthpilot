import type { Account, Budget, Snapshot, Transaction } from "./types";
import { goalReserve } from "./intelligence";
import { forecastCash, scopedBudgets, type CashPoint } from "./forecasting";
import { balanceCoverage } from "./coverage";
import { checkpointForDate } from "./coverage";
import type { CashMovement } from "./chart-events";
import {
  budgetCalendar,
  budgetCycle,
  budgetCycleKey,
  periodBounds,
  within,
  type DateRange,
} from "./periods";
export const euro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format((cents || 0) / 100);
export const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}
export function weekStart(date: string) {
  const d = new Date(date + "T12:00:00Z").getUTCDay();
  return addDays(date, -((d + 6) % 7));
}
export function parseMoney(value: string): number | null {
  let s = value
    .trim()
    .replace(/[€\s\u00a0\u202f]/g, "")
    .replace(/EUR/gi, "");
  if (!s) return null;
  if (/^\(.*\)$/.test(s)) s = "-" + s.slice(1, -1);
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf("."))
      s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) s = s.replace(",", ".");
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return null;
  const neg = s.startsWith("-");
  const [whole, fraction = ""] = s.replace(/^[+-]/, "").split(".");
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) * (neg ? -1 : 1);
  return Number.isSafeInteger(result) && Math.abs(result) <= 1e12
    ? result
    : null;
}
export function parseDate(value: string): string | null {
  const s = value.trim();
  let y, m, d;
  let a = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (a) {
    [, y, m, d] = a;
  } else {
    a = s.match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
    if (!a) return null;
    [, d, m, y] = a;
  }
  const iso = y + "-" + m + "-" + d;
  const time = new Date(iso + "T12:00:00Z");
  return !isNaN(+time) && time.toISOString().slice(0, 10) === iso ? iso : null;
}
export function balanceAt(
  account: Account,
  tx: Transaction[],
  date: string,
): number | null {
  const c = checkpointForDate(account, date);
  if (!c) return null;
  const rows = tx.filter((t) => t.account === account.id);
  return (
    c.amount +
    (date >= c.date
      ? rows
          .filter((t) => t.date > c.date && t.date <= date)
          .reduce((s, t) => s + t.amount, 0)
      : -rows
          .filter((t) => t.date > date && t.date <= c.date)
          .reduce((s, t) => s + t.amount, 0))
  );
}
export function selectDashboard(
  s: Snapshot,
  month: string,
  accountId: string,
  asOf = today(),
  fromMonth = month,
  range?: DateRange,
) {
  const calendar = budgetCalendar(s.transactions, asOf);
  const period = range ?? periodBounds(fromMonth, month, calendar);
  const accounts = s.accounts.filter((a) => !accountId || a.id === accountId);
  const inScope = (account: string) => !accountId || account === accountId;
  const tx = s.transactions.filter((t) => inScope(t.account));
  const cutoff = period.to < asOf ? period.to : asOf;
  // The ledger may include future-dated entries. They remain available to the
  // forecast, but are not yet paid expenses, earned income or recent activity.
  const rows = tx.filter((t) => within(t.date, period) && t.date <= cutoff);
  const values = accounts.map((a) => balanceAt(a, tx, cutoff));
  const balance =
    accounts.length && values.every((x) => x !== null)
      ? values.reduce<number>((a, b) => a + (b ?? 0), 0)
      : null;
  const spending = rows
    .filter((t) => t.amount < 0 && !t.internal)
    .reduce((a, t) => a - t.amount, 0);
  const income = rows
    .filter((t) => t.amount > 0 && !t.internal)
    .reduce((a, t) => a + t.amount, 0);
  const overdue = s.dues.filter(
    (d) => !d.transactionId && inScope(d.account) && d.date < cutoff,
  );
  const horizon =
    cutoff === asOf
      ? [period.to, budgetCycle(budgetCycleKey(cutoff, calendar), calendar).to]
          .sort()
          .at(-1)!
      : period.to;
  const projection = forecastCash(s, horizon, accountId, cutoff);
  const pending = projection.events.filter((d) => !d.internal);
  const obligations = pending
    .filter((d) => d.amount < 0)
    .reduce((a, d) => a - d.amount, 0);
  const estimatedObligations = pending
    .filter((d) => d.estimated && d.amount < 0)
    .reduce((n, d) => n - d.amount, 0);
  const prefs = s.preferences;
  const scoped = scopedBudgets(s, accountId);
  const budgetSpent = (b: Budget) =>
    tx
      .filter(
        (t) =>
          budgetCycleKey(t.date, calendar) === b.month &&
          t.date <= cutoff &&
          !t.internal &&
          t.amount < 0 &&
          t.category === b.category &&
          (!b.account || t.account === b.account),
      )
      .reduce((n, t) => n - t.amount, 0);
  const budgetCommitted = (b: Budget) =>
    pending
      .filter(
        (d) =>
          budgetCycleKey(d.date, calendar) === b.month &&
          d.amount < 0 &&
          d.category === b.category &&
          (!b.account || d.account === b.account),
      )
      .reduce((n, d) => n - d.amount, 0);
  const remainingEnvelopes = scoped
    .filter((b) => b.month === month)
    .reduce(
      (sum, b) =>
        sum + Math.max(0, b.amount - budgetSpent(b) - budgetCommitted(b)),
      0,
    );
  const essentials =
    prefs.essentials > 0 ? prefs.essentials : remainingEnvelopes;
  const reserves = prefs.safety + essentials + goalReserve(s);
  // Household reserves have no per-account allocation. A filtered account must
  // not inherit every household envelope or pretend it owns the weekly allowance.
  const available =
    accountId || balance === null ? null : balance - obligations - reserves;
  const start = weekStart(cutoff),
    end = addDays(start, 6);
  const weekSpent = tx
    .filter(
      (t) => !t.internal && t.amount < 0 && t.date >= start && t.date <= cutoff,
    )
    .reduce((a, t) => a - t.amount, 0);
  const weekDue = s.dues
    .filter(
      (d) =>
        !d.transactionId &&
        inScope(d.account) &&
        d.amount < 0 &&
        d.date >= start &&
        d.date <= end,
    )
    .reduce((a, d) => a - d.amount, 0);
  const remainingDays = Math.max(
    1,
    Math.round((Date.parse(horizon) - Date.parse(cutoff)) / 86400000) + 1,
  );
  const weekDays = Math.min(
    remainingDays,
    Math.max(
      1,
      Math.round((Date.parse(end) - Date.parse(cutoff)) / 86400000) + 1,
    ),
  );
  const weekly = accountId
    ? null
    : prefs.weekly === null
      ? available === null
        ? null
        : Math.floor((available / remainingDays) * weekDays)
      : prefs.weekly - weekSpent - weekDue;
  const categories = new Map<string, number>();
  rows
    .filter((t) => !t.internal && t.amount < 0)
    .forEach((t) =>
      categories.set(t.category, (categories.get(t.category) ?? 0) - t.amount),
    );
  const combined = new Map<string, (typeof s.budgets)[number]>();
  for (const b of scoped.filter(
    (b) => b.month >= fromMonth && b.month <= month,
  )) {
    const old = combined.get(b.category);
    combined.set(b.category, {
      ...b,
      id: b.category,
      amount: b.amount + (old?.amount ?? 0),
    });
  }
  const budgets = [...combined.values()]
    .sort((a, b) => {
      const order = prefs.budgetOrder ?? [];
      const rank = (name: string) =>
        order.includes(name) ? order.indexOf(name) : order.length;
      return (
        rank(a.category) - rank(b.category) ||
        a.category.localeCompare(b.category, "fr")
      );
    })
    .map((b) => {
      const allocations = scoped.filter(
        (v) =>
          v.category === b.category && v.month >= fromMonth && v.month <= month,
      );
      const coveredMonths = [...new Set(allocations.map((v) => v.month))];
      const spent = allocations.reduce(
        (sum, allocation) => sum + budgetSpent(allocation),
        0,
      );
      const committed = allocations.reduce(
        (sum, allocation) => sum + budgetCommitted(allocation),
        0,
      );
      return {
        ...b,
        spent,
        committed,
        remaining: b.amount - spent - committed,
        coveredMonths,
      };
    });
  const points: Array<CashPoint & { movements: CashMovement[] }> = [];
  const byProjectionDate = new Map(projection.points.map((p) => [p.date, p]));
  if (balance !== null) {
    const startDate = period.from;
    const endDate = horizon > period.to ? horizon : period.to;
    const cashByDate = new Map<string, Map<string, number>>(),
      movementsByDate = new Map<string, CashMovement[]>();
    for (const t of tx) {
      const day = cashByDate.get(t.date) ?? new Map<string, number>();
      day.set(t.account, (day.get(t.account) ?? 0) + t.amount);
      cashByDate.set(t.date, day);
      const movements = movementsByDate.get(t.date) ?? [];
      movements.push({
        id: t.id,
        label: t.merchantName || t.merchant || t.label,
        account: t.account,
        amount: t.amount,
        kind: t.internal ? "transfer" : t.amount > 0 ? "income" : "expense",
      });
      movementsByDate.set(t.date, movements);
    }
    const historical = new Map(
      accounts.map((a) => [a.id, balanceAt(a, tx, startDate) ?? 0]),
    );
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      const adjustments: CashMovement[] = [];
      if (date > startDate)
        for (const [id, amount] of cashByDate.get(date) ?? [])
          historical.set(id, (historical.get(id) ?? 0) + amount);
      for (const account of accounts) {
        const checkpoint = checkpointForDate(account, date);
        if (checkpoint?.date === date) {
          const difference =
            checkpoint.amount - (historical.get(account.id) ?? 0);
          if (difference && date > startDate && date <= cutoff)
            adjustments.push({
              id: `checkpoint:${account.id}:${date}`,
              label: "Écart de reconstruction au solde bancaire confirmé",
              account: account.id,
              amount: difference,
              kind: "adjustment",
            });
          historical.set(account.id, checkpoint.amount);
        }
      }
      const value = [...historical.values()].reduce((sum, n) => sum + n, 0);
      const planned = byProjectionDate.get(date);
      const knownCoverage = accounts.every((a) =>
        ["observed", "covered"].includes(balanceCoverage(a, date)),
      );
      const movements =
        date > cutoff
          ? projection.events
              .filter((d) => d.date === date)
              .map(
                (d): CashMovement => ({
                  id: d.id,
                  label: d.label,
                  account: d.account,
                  amount: d.amount,
                  kind: d.internal
                    ? "transfer"
                    : d.amount > 0
                      ? "income"
                      : "expense",
                  estimated: d.estimated,
                }),
              )
          : [...(movementsByDate.get(date) ?? []), ...adjustments];
      if (date > cutoff && planned) {
        const previous = byProjectionDate.get(addDays(date, -1));
        const provision = previous
          ? planned.value -
            previous.value -
            movements.reduce((n, m) => n + m.amount, 0)
          : 0;
        if (provision)
          movements.push({
            id: `provision:${accountId}:${date}`,
            label: "Répartition estimée des enveloppes restantes",
            account: accountId || "Foyer",
            amount: provision,
            kind: "provision",
            estimated: true,
          });
        // The historical cutoff is the actual reconstructed balance. Forecasts
        // may additionally hold un-reconciled same-day dues; explain that gap.
        const pendingAtCutoff =
          date === addDays(cutoff, 1)
            ? (byProjectionDate.get(cutoff)?.value ?? balance) - balance
            : 0;
        if (pendingAtCutoff)
          movements.push({
            id: `pending:${accountId}:${cutoff}`,
            label: `Report des échéances à vérifier au ${dateLabel(cutoff)}`,
            account: accountId || "Foyer",
            amount: pendingAtCutoff,
            kind: "provision",
            estimated: true,
          });
      }
      const annotations = movements.map(
        (m) =>
          `${m.label} · ${m.account} · ${m.amount > 0 ? "+" : ""}${euro(m.amount)}`,
      );
      points.push(
        date > cutoff && planned
          ? { ...planned, movements, events: annotations }
          : {
              date,
              value,
              lower: value,
              upper: value,
              future: date > cutoff,
              uncertain: !knownCoverage,
              events: annotations,
              movements,
            },
      );
    }
  }
  const forecast = points.filter((p) => p.future);
  const low = forecast.length
    ? forecast.reduce((a, p) => (p.value < a.value ? p : a))
    : null;
  return {
    period,
    horizon,
    accounts,
    tx,
    rows,
    cutoff,
    balance,
    spending,
    income,
    available,
    obligations,
    estimatedObligations,
    confirmedObligations: obligations - estimatedObligations,
    reserves,
    essentials,
    remainingEnvelopes,
    weekly,
    weekSpent,
    weekDue,
    budgets,
    categories,
    points,
    low,
    overdue,
    projection,
  };
}
