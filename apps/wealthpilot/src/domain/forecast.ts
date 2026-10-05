import { addDays, daysBetween, maxDate, weekStart } from "./dates";
import { householdBalance } from "./balances";
import { envelopes } from "./envelopes";
import { effectiveDate, upcoming, type Occurrence } from "./events";
import { memo, type Ledger } from "./ledger";
import { currentMonthKey, monthOf, monthRange } from "./periods";
import type { IsoDate } from "./types";

// Central: dated events plus the remaining free envelopes spread evenly over
// their budget month. Prudent/favourable: dispersion of unconfirmed recurring
// amounts and ±20 % of the envelope provision. Scenarios, not probabilities.

export interface ForecastPoint {
  date: IsoDate;
  value: number;
  low: number;
  high: number;
}

export interface LowPoint {
  date: IsoDate;
  value: number;
  account?: string;
}

export interface Shortfall {
  account: string;
  /** First day below the threshold. */
  date: IsoDate;
  /** Reserve of the account, 0 when none. */
  threshold: number;
  low: LowPoint;
  /** Money to bring before `date` so the account never goes under its threshold. */
  amount: number;
}

export interface Forecast {
  start: number | null;
  points: ForecastPoint[];
  events: Occurrence[];
  lowPoint: LowPoint | null;
  /** Lowest prudent balance from dated events only (no envelope provision), never above `start`. */
  committedLow: number | null;
  /** Free envelope money provisioned per budget month. */
  provisions: Record<string, number>;
  reserve: number;
  shortfalls: Shortfall[];
}

/** Reserves are protected capacity, never bank debits. */
export function reserveFor(ledger: Ledger, account: string) {
  const { prefs, asOf } = ledger;
  if (!account) return prefs.safety + prefs.projectsReserve;
  return (
    prefs.weeklyPlans.find(
      (p) => p.account === account && p.start === weekStart(asOf),
    )?.reserve ?? 0
  );
}

export interface Schedule {
  first: IsoDate;
  days: number;
}

/** Days over which a month's provision is consumed: from today for the current month. */
export function schedule(ledger: Ledger, month: string): Schedule {
  const range = monthRange(month, ledger.calendar);
  const first =
    month === currentMonthKey(ledger.calendar, ledger.asOf)
      ? ledger.asOf
      : addDays(range.from, -1);
  return { first, days: Math.max(1, daysBetween(first, range.to)) };
}

/** Part of `amount` consumed by the end of `date`. */
export const consumed = (amount: number, s: Schedule, date: IsoDate) =>
  Math.floor(
    (amount * Math.max(0, Math.min(s.days, daysBetween(s.first, date)))) /
      s.days,
  );

/** Horizon long enough for weekly capacity: past the following charges and the next pay. */
export const planningEnd = (ledger: Ledger, date: IsoDate) =>
  maxDate(addDays(date, 14), addDays(ledger.asOf, 45));

export const forecast = memo(
  (ledger: Ledger, account: string, end: IsoDate): Forecast => {
    const { asOf, calendar } = ledger;
    const start = householdBalance(ledger, account, asOf);
    const events = upcoming(ledger, account, end);
    const reserve = reserveFor(ledger, account);
    const shortfalls = account
      ? []
      : ledger.accounts.flatMap((a) => forecast(ledger, a.id, end).shortfalls);
    if (start === null)
      return {
        start,
        points: [],
        events,
        lowPoint: null,
        committedLow: null,
        provisions: {},
        reserve,
        shortfalls,
      };
    const byDay = new Map<IsoDate, Occurrence[]>();
    for (const o of events) {
      const day = effectiveDate(o, asOf);
      const list = byDay.get(day);
      if (list) list.push(o);
      else byDay.set(day, [o]);
    }
    const provisions: Record<string, number> = {};
    const schedules = new Map<string, Schedule>();
    const provision = (month: string) => {
      if (!(month in provisions)) {
        provisions[month] = envelopes(ledger, account, month).reduce(
          (n, e) => n + e.free,
          0,
        );
        schedules.set(month, schedule(ledger, month));
      }
      return { amount: provisions[month], schedule: schedules.get(month)! };
    };
    const points: ForecastPoint[] = [];
    let value = start,
      low = start,
      high = start,
      fixed = start,
      committedLow = start;
    for (let date = asOf; date <= end; date = addDays(date, 1)) {
      const day = byDay.get(date) ?? [];
      const delta = day.reduce((n, o) => n + o.amount, 0);
      let spend = 0,
        spread = 0;
      if (date > asOf) {
        spread = day.reduce((n, o) => n + o.spread, 0);
        const p = provision(monthOf(date, calendar));
        spend =
          consumed(p.amount, p.schedule, date) -
          consumed(p.amount, p.schedule, addDays(date, -1));
      }
      value += delta - spend;
      low += delta - spread - Math.ceil(spend * 1.2);
      high += delta + spread - Math.floor(spend * 0.8);
      fixed += delta - spread;
      committedLow = Math.min(committedLow, fixed);
      points.push({ date, value, low, high });
    }
    const lowest = points.reduce(
      (a, p) => (p.value < a.value ? p : a),
      points[0],
    );
    const lowPoint: LowPoint = account
      ? { date: lowest.date, value: lowest.value, account }
      : { date: lowest.date, value: lowest.value };
    const breach = account ? points.find((p) => p.value < reserve) : undefined;
    return {
      start,
      points,
      events,
      lowPoint,
      committedLow,
      provisions,
      reserve,
      shortfalls: breach
        ? [
            {
              account,
              date: breach.date,
              threshold: reserve,
              low: lowPoint,
              amount: reserve - lowPoint.value,
            },
          ]
        : shortfalls,
    };
  },
);
