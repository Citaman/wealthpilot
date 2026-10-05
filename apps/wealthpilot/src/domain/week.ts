import { householdBalance } from "./balances";
import { addDays, eachDay, maxDate, weekStart } from "./dates";
import { byBudgetOrder, envelopes } from "./envelopes";
import { effectiveDate, type Occurrence } from "./events";
import { forecast, planningEnd } from "./forecast";
import { accountsIn, memo, rowsIn, type Ledger } from "./ledger";
import { median } from "./money";
import { monthOf } from "./periods";
import type { IsoDate } from "./types";

export interface WeekDay {
  date: IsoDate;
  /** Real external spending (past and today). */
  spent: number;
  charges: Occurrence[];
  incomes: Occurrence[];
  /** Real closing balance before today, projected from today. */
  endBalance: number | null;
}

export interface WeekEnvelope {
  category: string;
  /** Saved weekly limit, else the proposal. */
  limit: number;
  /** Median of comparable full weeks (count in `assumptions.weeks`). */
  proposed: number;
  saved: boolean;
  paid: number;
  committed: number;
  /** Still spendable: limit − paid − committed, capped by the monthly envelopes and by cash. */
  possible: number;
}

export interface WeekPlan {
  start: IsoDate;
  end: IsoDate;
  account: string;
  days: WeekDay[];
  envelopes: WeekEnvelope[];
  totals: { limit: number; paid: number; committed: number; possible: number };
  lowPoint: { date: IsoDate; value: number } | null;
  assumptions: {
    status: "confirmed" | "estimated" | "unconfigured";
    weeks: number;
    verifiedWeeks: number;
    /** Prudent low from dated events minus the reserve; null when the balance is unknown. */
    capacity: number | null;
    reserve: number;
    /** Budget months crossed by the remaining days. */
    months: string[];
  };
}

const spending = (t: { internal?: boolean; amount: number }) =>
  !t.internal && t.amount < 0;

/** Weekly spending per category over the 12 weeks before this one, and which weeks compare. */
function history(ledger: Ledger, account: string) {
  const thisWeek = weekStart(ledger.asOf);
  const from = addDays(thisWeek, -84);
  const samples = new Map<string, Map<IsoDate, number>>();
  let first: IsoDate | undefined;
  for (const t of rowsIn(ledger, account)) {
    if (!first || t.date < first) first = t.date;
    if (!spending(t) || t.date < from || t.date >= thisWeek) continue;
    const byWeek = samples.get(t.category) ?? new Map<IsoDate, number>();
    const w = weekStart(t.date);
    byWeek.set(w, (byWeek.get(w) ?? 0) - t.amount);
    samples.set(t.category, byWeek);
  }
  const past: IsoDate[] = [];
  for (let w = from; w < thisWeek; w = addDays(w, 7)) past.push(w);
  const accounts = accountsIn(ledger, account);
  const verified = past.filter(
    (w) =>
      accounts.length > 0 &&
      accounts.every((a) =>
        a.coverage?.some(
          (c) => c.complete && c.from <= w && c.through >= addDays(w, 6),
        ),
      ),
  );
  // Imported activity alone does not prove a complete statement.
  const weeks = verified.length
    ? verified
    : past.filter((w) => first && w >= first);
  const proposal = (category: string) =>
    median(weeks.map((w) => samples.get(category)?.get(w) ?? 0));
  return { samples, weeks, verified, proposal };
}

/** Free money of the month's envelope; a payer's allocation also stays under the shared one. */
function monthCeiling(
  ledger: Ledger,
  account: string,
  month: string,
  category: string,
) {
  const own = envelopes(ledger, account, month).find(
    (e) => e.category === category,
  );
  const shared = account
    ? envelopes(ledger, "", month).find(
        (e) => e.category === category && e.budgets.some((b) => !b.account),
      )
    : undefined;
  const ceilings = [own, shared].flatMap((e) => (e ? [e.free] : []));
  return ceilings.length ? Math.min(...ceilings) : Infinity;
}

/** Each budget month funds only its own days of the week. */
function monthlyShare(
  ledger: Ledger,
  account: string,
  category: string,
  requested: number,
  days: IsoDate[],
) {
  let allocated = 0,
    total = 0;
  for (const month of new Set(days.map((d) => monthOf(d, ledger.calendar)))) {
    const count = days.filter(
      (d) => monthOf(d, ledger.calendar) === month,
    ).length;
    const portion =
      Math.floor((requested * (allocated + count)) / days.length) -
      Math.floor((requested * allocated) / days.length);
    allocated += count;
    total += Math.min(portion, monthCeiling(ledger, account, month, category));
  }
  return total;
}

/** Category limits share one cash capacity; they are not independent maxima. */
function shareCapacity(wanted: number[], capacity: number) {
  const desired = wanted.reduce((n, w) => n + w, 0);
  const pool = Math.min(desired, capacity);
  const shares = wanted.map((w) =>
    desired ? Math.floor((w / desired) * pool) : 0,
  );
  let remainder = pool - shares.reduce((n, s) => n + s, 0);
  for (let i = 0; i < shares.length && remainder > 0; i++)
    if (shares[i] < wanted[i]) {
      shares[i]++;
      remainder--;
    }
  return shares;
}

export const weekPlan = memo(
  (ledger: Ledger, account: string, start: IsoDate): WeekPlan => {
    const { asOf, calendar, prefs } = ledger;
    const end = addDays(start, 6);
    const saved = prefs.weeklyPlans.find(
      (p) => p.start === start && p.account === account,
    );
    const past = history(ledger, account);
    const f = forecast(ledger, account, planningEnd(ledger, end));
    const inWeek = (date: IsoDate) => date >= start && date <= end;
    const planned = f.events.filter((o) => inWeek(effectiveDate(o, asOf)));
    const spent = rowsIn(ledger, account).filter(
      (t) => spending(t) && inWeek(t.date) && t.date <= asOf,
    );
    const reserve = Math.max(saved?.reserve ?? 0, f.reserve);
    // The chronological prudent low protects charges in date order, rather than
    // subtracting every charge while ignoring the salary that funds them in between.
    const capacity =
      f.committedLow === null ? null : Math.max(0, f.committedLow - reserve);
    const remaining =
      end >= asOf ? eachDay({ from: maxDate(start, asOf), to: end }) : [];
    const total = <T extends { amount: number; category?: string }>(
      list: T[],
      category: string,
    ) =>
      list
        .filter((x) => x.category === category)
        .reduce((n, x) => n - x.amount, 0);

    const categories = [
      ...new Set([
        ...past.samples.keys(),
        ...ledger.budgets.map((b) => b.category),
        ...Object.keys(saved?.limits ?? {}),
      ]),
    ].sort();
    const rows = categories.map((category): WeekEnvelope => {
      const proposed = past.proposal(category);
      return {
        category,
        limit: saved?.limits[category] ?? proposed,
        proposed,
        saved: saved?.limits[category] !== undefined,
        paid: total(spent, category),
        committed: total(planned.filter(spending), category),
        possible: 0,
      };
    });
    const wanted = rows.map((r) =>
      monthlyShare(
        ledger,
        account,
        r.category,
        Math.max(0, r.limit - r.paid - r.committed),
        remaining,
      ),
    );
    shareCapacity(wanted, capacity ?? 0).forEach(
      (s, i) => (rows[i].possible = s),
    );
    rows.sort(byBudgetOrder(prefs.budgetOrder));

    const projected = new Map(f.points.map((p) => [p.date, p.value]));
    const on = (date: IsoDate, sign: number) =>
      planned.filter(
        (o) => Math.sign(o.amount) === sign && effectiveDate(o, asOf) === date,
      );
    const days = eachDay({ from: start, to: end }).map(
      (date): WeekDay => ({
        date,
        spent: spent
          .filter((t) => t.date === date)
          .reduce((n, t) => n - t.amount, 0),
        charges: on(date, -1),
        incomes: on(date, 1),
        endBalance:
          date < asOf
            ? householdBalance(ledger, account, date)
            : (projected.get(date) ?? null),
      }),
    );
    const lowPoint = days.reduce<WeekPlan["lowPoint"]>(
      (low, d) =>
        d.date >= asOf &&
        d.endBalance !== null &&
        (!low || d.endBalance < low.value)
          ? { date: d.date, value: d.endBalance }
          : low,
      null,
    );
    const sum = (k: "limit" | "paid" | "committed" | "possible") =>
      rows.reduce((n, e) => n + e[k], 0);
    return {
      start,
      end,
      account,
      days,
      envelopes: rows,
      totals: {
        limit: sum("limit"),
        paid: sum("paid"),
        committed: sum("committed"),
        possible: sum("possible"),
      },
      lowPoint,
      assumptions: {
        status: saved
          ? "confirmed"
          : past.weeks.length && past.samples.size
            ? "estimated"
            : "unconfigured",
        weeks: past.weeks.length,
        verifiedWeeks: past.verified.length,
        capacity,
        reserve,
        months: [...new Set(remaining.map((d) => monthOf(d, calendar)))],
      },
    };
  },
);
