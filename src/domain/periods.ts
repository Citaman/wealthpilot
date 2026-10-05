import {
  addDays,
  clampDay,
  daysBetween,
  formatMonth,
  monthEnd,
  shiftMonth,
  type DateRange,
} from "./dates";
import { upperMedian } from "./money";
import { normalizedText, recurrenceIdentity } from "./text";
import type { IsoDate, Transaction } from "./types";

// A budget month opens on the household's first regular income of its pay
// wave and ends the day before the next one (brief §28).

export interface IncomeBoundary {
  month: string;
  date: IsoDate;
  /** Empty for a cadence estimate; a projected boundary may carry a known future payment. */
  transactionIds: string[];
}

export interface BudgetCalendar {
  asOf: IsoDate;
  /** Earliest transaction on or before `asOf`. */
  start: IsoDate | null;
  observed: IncomeBoundary[];
  projected: IncomeBoundary[];
}

export type MonthRange = DateRange & {
  partial?: boolean;
  estimatedEnd?: boolean;
};

export type PeriodValue =
  | { kind: "month"; key: string }
  | { kind: "rolling"; days: 30 }
  | { kind: "months"; count: 3 | 6 | 12 }
  | { kind: "all" };

export interface PeriodOption {
  value: PeriodValue;
  label: string;
  range: MonthRange;
}

const civilMonth = (month: string): DateRange => ({
  from: `${month}-01`,
  to: monthEnd(month),
});

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
  return { key: JSON.stringify([t.account, identity]), explicit, payroll };
}

const cache = new WeakMap<Transaction[], Map<IsoDate, BudgetCalendar>>();

/** Only recorded external income opens historical months; estimated dates belong to forecasts. */
export function budgetCalendar(
  transactions: Transaction[],
  asOf: IsoDate,
): BudgetCalendar {
  const cached = cache.get(transactions)?.get(asOf);
  if (cached) return cached;
  const result = computeCalendar(transactions, asOf);
  const entries = cache.get(transactions) ?? new Map();
  entries.set(asOf, result);
  if (entries.size > 16) entries.delete(entries.keys().next().value!);
  cache.set(transactions, entries);
  return result;
}

function computeCalendar(transactions: Transaction[], asOf: IsoDate) {
  let start: IsoDate | null = null;
  const groups = new Map<
    string,
    { rows: Transaction[]; explicit: boolean; payroll: boolean }
  >();
  const future = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.date <= asOf && (!start || t.date < start)) start = t.date;
    const evidence = incomeEvidence(t);
    if (!evidence) continue;
    if (t.date > asOf) {
      future.set(evidence.key, [...(future.get(evidence.key) ?? []), t]);
      continue;
    }
    const group = groups.get(evidence.key) ?? {
      rows: [],
      explicit: false,
      payroll: false,
    };
    group.rows.push(t);
    group.explicit ||= evidence.explicit;
    group.payroll ||= evidence.payroll;
    groups.set(evidence.key, group);
  }
  const actual = new Map<string, IncomeBoundary>();
  const predictions = new Map<string, IncomeBoundary>();
  const record = (
    map: Map<string, IncomeBoundary>,
    month: string,
    date: IsoDate,
    ids: string[],
  ) => {
    const previous = map.get(month);
    if (!previous || date < previous.date)
      map.set(month, { month, date, transactionIds: ids });
    else if (date === previous.date) previous.transactionIds.push(...ids);
  };
  for (const [key, { rows, explicit, payroll }] of groups) {
    const dates = [...new Set(rows.map((t) => t.date))].sort();
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
    const monthly =
      dates.length >= 3 &&
      gaps.filter((n) => n >= 22 && n <= 40).length >=
        Math.ceil(gaps.length * 0.75);
    if (!explicit && !monthly) continue;
    // A late-month payment finances the following named month. This labels the
    // month, never rounds its boundary: the exact transaction date is retained.
    const phase = Number(dates[0].slice(8)) > 15 ? 1 : 0;
    const paymentMonthFor = (date: IsoDate) => {
      const typicalDay = upperMedian(
        dates
          .filter((d) => d <= date)
          .slice(-6)
          .map((d) => Number(d.slice(8))),
      );
      // A payday moved across New Year/month-end still belongs to the nearest
      // pay wave (e.g. Dec 31 arriving Jan 2), not an extra empty budget month.
      return [-1, 0, 1]
        .map((n) => shiftMonth(date.slice(0, 7), n))
        .sort(
          (a, b) =>
            Math.abs(daysBetween(clampDay(a, typicalDay), date)) -
            Math.abs(daysBetween(clampDay(b, typicalDay), date)),
        )[0];
    };
    for (const t of rows)
      record(actual, shiftMonth(paymentMonthFor(t.date), phase), t.date, [
        t.id,
      ]);
    const last = dates.at(-1)!;
    if (daysBetween(last, asOf) > 62 || (!payroll && !monthly)) continue;
    const expectedDay = upperMedian(
      dates.slice(-3).map((d) => Number(d.slice(8))),
    );
    const known = new Map<string, Transaction>();
    for (const t of future.get(key) ?? []) {
      const month = shiftMonth(paymentMonthFor(t.date), phase);
      if (!known.has(month) || t.date < known.get(month)!.date)
        known.set(month, t);
    }
    // This cadence is solely a forecast assumption; it cannot create history.
    for (let i = 1; i <= 14; i++) {
      const paymentMonth = shiftMonth(paymentMonthFor(last), i);
      const month = shiftMonth(paymentMonth, phase);
      const payment = known.get(month);
      const date = payment?.date ?? clampDay(paymentMonth, expectedDay);
      if (date > asOf)
        record(predictions, month, date, payment ? [payment.id] : []);
    }
  }
  const byDate = (a: IncomeBoundary, b: IncomeBoundary) =>
    a.date.localeCompare(b.date);
  const observed = [...actual.values()].sort(byDate);
  const last = observed.at(-1);
  const projected = [...predictions.values()]
    .filter((p) => !last || (p.month > last.month && p.date > last.date))
    .sort(byDate);
  return { asOf, start, observed, projected };
}

/** Real date range of a budget month. */
export function monthRange(
  month: string,
  calendar: BudgetCalendar,
): MonthRange {
  const { observed, projected, asOf } = calendar;
  if (!observed.length) return civilMonth(month);
  const starts = [...observed, ...projected];
  const start = starts.find((p) => p.month === month);
  const next = starts.find((p) => p.month > month);
  const estimatedEnd = !next?.transactionIds.length;
  const flag = estimatedEnd ? { estimatedEnd } : {};
  if (start)
    return {
      from: start.date,
      to: next
        ? addDays(next.date, -1)
        : [civilMonth(month).to, asOf].sort().at(-1)!,
      ...flag,
    };
  // Missing income inside the recorded history does not fabricate a new month.
  if (month > observed[0].month)
    return {
      from: next?.date ?? addDays(asOf, 1),
      to: next ? addDays(next.date, -1) : asOf,
      ...flag,
    };
  const civil = civilMonth(month);
  if (month === shiftMonth(observed[0].month, -1))
    return {
      from: civil.from,
      to: addDays(observed[0].date, -1),
      partial: true,
    };
  return {
    from: civil.from,
    to: next ? [civil.to, addDays(next.date, -1)].sort()[0] : civil.to,
  };
}

/** Budget-month key `YYYY-MM` containing `date`. */
export function monthOf(date: IsoDate, calendar: BudgetCalendar): string {
  const month = date.slice(0, 7);
  if (!calendar.observed.length) return month;
  const starts =
    date > calendar.asOf
      ? [...calendar.observed, ...calendar.projected]
      : calendar.observed;
  const found = starts.findLast((p) => p.date <= date);
  return (
    found?.month ??
    [month, shiftMonth(calendar.observed[0].month, -1)].sort()[0]
  );
}

export const currentMonthKey = (calendar: BudgetCalendar, asOf: IsoDate) =>
  monthOf(asOf, calendar);

export function nextBoundary(
  calendar: BudgetCalendar,
): { date: IsoDate; estimated: boolean } | null {
  const next = calendar.projected[0];
  return next
    ? { date: next.date, estimated: !next.transactionIds.length }
    : null;
}

/** End of the current budget month; 35 days ahead when no next income is identified. */
export function currentMonthEnd(calendar: BudgetCalendar, asOf: IsoDate) {
  if (calendar.observed.length && !nextBoundary(calendar))
    return addDays(asOf, 35);
  return monthRange(currentMonthKey(calendar, asOf), calendar).to;
}

/** Forecast horizon of the balance chart: end of the following budget month. */
export function nextMonthEnd(calendar: BudgetCalendar, asOf: IsoDate) {
  if (calendar.observed.length && !nextBoundary(calendar))
    return addDays(asOf, 35);
  const next = shiftMonth(currentMonthKey(calendar, asOf), 1);
  return monthRange(next, calendar).to;
}

export function periodOptions(
  calendar: BudgetCalendar,
  asOf: IsoDate,
): PeriodOption[] {
  const year = asOf.slice(0, 4);
  const first = monthOf(calendar.start ?? asOf, calendar);
  const months: PeriodOption[] = [];
  for (
    let key = currentMonthKey(calendar, asOf);
    key >= first && months.length < 120;
    key = shiftMonth(key, -1)
  ) {
    const range = monthRange(key, calendar);
    if (range.from <= range.to)
      months.push({
        value: { kind: "month", key },
        label: formatMonth(key, year),
        range,
      });
  }
  const rolling: PeriodValue[] = [
    { kind: "rolling", days: 30 },
    { kind: "months", count: 3 },
    { kind: "months", count: 6 },
    { kind: "months", count: 12 },
    { kind: "all" },
  ];
  return [
    ...months,
    ...rolling.map((value) => {
      const { label, ...range } = resolvePeriod(value, calendar, asOf);
      return { value, label, range };
    }),
  ];
}

export function resolvePeriod(
  value: PeriodValue,
  calendar: BudgetCalendar,
  asOf: IsoDate,
): MonthRange & { label: string } {
  const current = currentMonthKey(calendar, asOf);
  const end = monthRange(current, calendar).to;
  switch (value.kind) {
    case "month":
      return {
        ...monthRange(value.key, calendar),
        label: formatMonth(value.key, asOf.slice(0, 4)),
      };
    case "rolling":
      return {
        from: addDays(asOf, 1 - value.days),
        to: asOf,
        label: "30 derniers jours",
      };
    case "months":
      return {
        from: monthRange(shiftMonth(current, 1 - value.count), calendar).from,
        to: end,
        label: `${value.count} mois`,
      };
    case "all":
      return {
        from: calendar.start ?? asOf,
        to: end,
        label: "Tout l’historique",
      };
  }
}
