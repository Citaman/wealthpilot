import type { Transaction } from "./types";
import { normalizedText, recurrenceIdentity } from "./transactionIdentity";

export type DateRange = { from: string; to: string };
export type Granularity = "day" | "week" | "month";
export type IncomeBoundary = {
  month: string;
  date: string;
  transactionIds: string[];
};
export type BudgetCalendar = {
  asOf: string;
  observed: IncomeBoundary[];
  projected: IncomeBoundary[];
};
export function shiftCycle(month: string, count: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + count, 15)).toISOString().slice(0, 7);
}
function offset(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function boundary(month: string, day: number) {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return month + "-" + String(Math.min(day, last)).padStart(2, "0");
}
const civilMonth = (month: string): DateRange => ({
  from: boundary(month, 1),
  to: offset(boundary(shiftCycle(month, 1), 1), -1),
});
const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const distance = (a: string, b: string) =>
  (Date.parse(b) - Date.parse(a)) / 86400000;
const calendarCache = new WeakMap<Transaction[], Map<string, BudgetCalendar>>();

function incomeEvidence(t: Transaction) {
  if (t.amount <= 0 || t.internal) return null;
  const text = normalizedText(
    [
      t.merchant,
      t.label,
      t.category,
      t.subcategory,
      ...Object.values(t.raw ?? {}),
    ].join(" "),
  );
  const payroll = /\b(salaires?|salary|payroll|paie|paye)\b/.test(text);
  if (
    /\b(refunds?|remboursements?|avoirs?|acompte|avance|tickets? resto|titres? restaurant|octoplus)\b/.test(
      text,
    )
  )
    return null;
  // A separate bonus isn't a payday; a full salary including a bonus is.
  if (!payroll && /\b(bonus|prime)\b/.test(text)) return null;
  const explicit =
    /\b(salaires?|salary|payroll|paie|paye|pension|retraite|allocations?|caf|france travail|pole emploi)\b/.test(
      text,
    );
  const identity = recurrenceIdentity(t);
  if (!identity) return null;
  return { identity, explicit, payroll };
}

/** Household calendar shared by every account view. Only recorded external
 * income opens historical months; estimated dates belong to forecasts only. */
export function budgetCalendar(
  transactions: Transaction[],
  asOf: string,
): BudgetCalendar {
  const cached = calendarCache.get(transactions)?.get(asOf);
  if (cached) return cached;
  const groups = new Map<
    string,
    { rows: Transaction[]; explicit: boolean; payroll: boolean }
  >();
  for (const t of transactions) {
    if (t.amount <= 0 || t.internal || t.date > asOf) continue;
    const evidence = incomeEvidence(t);
    if (!evidence) continue;
    const { identity, explicit, payroll } = evidence;
    const key = JSON.stringify([t.account, identity]);
    const group = groups.get(key) ?? {
      rows: [],
      explicit: false,
      payroll: false,
    };
    group.rows.push(t);
    group.explicit ||= explicit;
    group.payroll ||= payroll;
    groups.set(key, group);
  }
  const actual = new Map<string, IncomeBoundary>(),
    predictions = new Map<string, IncomeBoundary>();
  const record = (
    map: Map<string, IncomeBoundary>,
    month: string,
    date: string,
    ids: string[],
  ) => {
    const previous = map.get(month);
    if (!previous || date < previous.date)
      map.set(month, { month, date, transactionIds: ids });
    else if (date === previous.date) previous.transactionIds.push(...ids);
  };
  for (const { rows, explicit, payroll } of groups.values()) {
    const dates = [...new Set(rows.map((t) => t.date))].sort();
    const gaps = dates.slice(1).map((d, i) => distance(dates[i], d));
    const monthly =
      dates.length >= 3 &&
      gaps.filter((n) => n >= 22 && n <= 40).length >=
        Math.ceil(gaps.length * 0.75);
    if (!explicit && !monthly) continue;
    // A late-month payment finances the following named month. This labels the
    // month, never rounds its boundary: the exact transaction date is retained.
    const phase = Number(dates[0].slice(8)) > 15 ? 1 : 0;
    const paymentMonthFor = (date: string) => {
      const typicalDay = median(
        dates
          .filter((d) => d <= date)
          .slice(-6)
          .map((d) => Number(d.slice(8))),
      );
      // A payday moved across New Year/month-end still belongs to the nearest
      // pay wave (e.g. Dec 31 arriving Jan 2), not an extra empty budget month.
      return [-1, 0, 1]
        .map((n) => shiftCycle(date.slice(0, 7), n))
        .sort(
          (a, b) =>
            Math.abs(distance(boundary(a, typicalDay), date)) -
            Math.abs(distance(boundary(b, typicalDay), date)),
        )[0];
    };
    for (const t of rows)
      record(actual, shiftCycle(paymentMonthFor(t.date), phase), t.date, [
        t.id,
      ]);
    const last = dates.at(-1)!;
    if (distance(last, asOf) > 62 || (!payroll && !monthly)) continue;
    const expectedDay = median(dates.slice(-3).map((d) => Number(d.slice(8))));
    const known = new Map<string, string>();
    for (const t of transactions.filter(
      (t) =>
        t.date > asOf &&
        incomeEvidence(t) !== null &&
        t.account === rows[0].account &&
        recurrenceIdentity(t) === recurrenceIdentity(rows[0]),
    )) {
      const month = shiftCycle(paymentMonthFor(t.date), phase);
      if (!known.has(month) || t.date < known.get(month)!)
        known.set(month, t.date);
    }
    // This cadence is solely a forecast assumption; it cannot create history.
    for (let i = 1; i <= 14; i++) {
      const paymentMonth = shiftCycle(paymentMonthFor(last), i);
      const month = shiftCycle(paymentMonth, phase);
      const date = known.get(month) ?? boundary(paymentMonth, expectedDay);
      if (date > asOf) record(predictions, month, date, []);
    }
  }
  const observed = [...actual.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const last = observed.at(-1);
  const projected = [...predictions.values()]
    .filter((p) => !last || (p.month > last.month && p.date > last.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const result = { asOf, observed, projected };
  const cache = calendarCache.get(transactions) ?? new Map();
  cache.set(asOf, result);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  calendarCache.set(transactions, cache);
  return result;
}

export function budgetCycle(
  month: string,
  calendar?: BudgetCalendar,
): DateRange {
  if (!calendar?.observed.length) return civilMonth(month);
  const starts = [...calendar.observed, ...calendar.projected];
  const start = starts.find((p) => p.month === month);
  const next = starts.find((p) => p.month > month);
  if (start)
    return {
      from: start.date,
      to: next
        ? offset(next.date, -1)
        : [civilMonth(month).to, calendar.asOf].sort().at(-1)!,
    };
  // Missing income inside the recorded history does not fabricate a new month.
  if (month > calendar.observed[0].month)
    return {
      from: next?.date ?? offset(calendar.asOf, 1),
      to: next ? offset(next.date, -1) : calendar.asOf,
    };
  const civil = civilMonth(month);
  if (month === shiftCycle(calendar.observed[0].month, -1))
    return { from: civil.from, to: offset(calendar.observed[0].date, -1) };
  return {
    from: civil.from,
    to: next ? [civil.to, offset(next.date, -1)].sort()[0] : civil.to,
  };
}
export function budgetCycleKey(date: string, calendar?: BudgetCalendar) {
  const month = date.slice(0, 7);
  if (!calendar?.observed.length) return month;
  const starts =
    date > calendar.asOf
      ? [...calendar.observed, ...calendar.projected]
      : calendar.observed;
  const found = starts.findLast((p) => p.date <= date);
  return (
    found?.month ??
    [month, shiftCycle(calendar.observed[0].month, -1)].sort()[0]
  );
}
export function periodBounds(
  from: string,
  month: string,
  calendar?: BudgetCalendar,
): DateRange {
  return {
    from: budgetCycle(from, calendar).from,
    to: budgetCycle(month, calendar).to,
  };
}
export const within = (date: string, range: DateRange) =>
  date >= range.from && date <= range.to;
export function bucketKey(date: string, granularity: Granularity) {
  if (granularity === "month") return date.slice(0, 7);
  if (granularity === "week") {
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    return offset(date, -((weekday + 6) % 7));
  }
  return date;
}
