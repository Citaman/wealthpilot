// « Notre plan »: how the couple shares bills (by income) and climbs back
// above zero month after month. Settings live in `preferences.plan`.
import { householdBalance } from "./balances";
import {
  addDays,
  daysBetween,
  shiftMonth,
  weekStart,
  within,
  type DateRange,
} from "./dates";
import { forecast } from "./forecast";
import type { Ledger } from "./ledger";
import { median, sumBy } from "./money";
import { currentMonthEnd, currentMonthKey, monthRange } from "./periods";
import { activeRecurrences } from "./recurring";
import { normalizedText } from "./text";
import type { Cents, IsoDate, Transaction } from "./types";

export type ShareMode =
  | "income"
  | "half"
  | "custom"
  | "me"
  | "partner"
  | "personal";

export interface PlanSettings {
  me?: string;
  partner?: string;
  /** Global override of my share (0–1); absent = latest salaries. */
  share?: number;
  modes?: Record<string, ShareMode>;
  /** My share for groups in "custom" mode. */
  custom?: Record<string, number>;
  /** Amount asked from the partner, per budget month. */
  caps?: Record<string, Cents>;
  /** Extra saving per week across the household. */
  effort?: Cents;
  /** Last budget month of a temporary charge (e.g. taxes), by recurrence key. */
  ends?: Record<string, string>;
  allowances?: Record<string, Record<string, Cents>>;
}

const WEEKS_PER_MONTH = 52 / 12;
const spent = (t: Transaction) => t.amount < 0 && !t.internal;
const text = (t: Transaction) =>
  normalizedText(
    `${t.category} ${t.subcategory ?? ""} ${t.merchant} ${t.label}`,
  );

export const groupOf = (t: Transaction) =>
  t.subcategory ? `${t.category} · ${t.subcategory}` : t.category;

// Household-type costs are shared by default; car loan, taxes and personal
// spending stay with whoever pays them.
const SHARED =
  /loyer|logement|electric|energie|\beau\b|internet|box|habitation|creche|garde|cantine|ecole|enfant|courses|supermarche|carburant|essence|assurance auto/;
export function defaultMode(group: string): ShareMode {
  const g = normalizedText(group);
  return /credit|pret|impot/.test(g)
    ? "personal"
    : SHARED.test(g)
      ? "income"
      : "personal";
}

function latestSalary(ledger: Ledger, account: string): Cents {
  const since = addDays(ledger.asOf, -62);
  const rows = (ledger.byAccount.get(account) ?? []).filter(
    (t) =>
      t.amount > 0 && !t.internal && t.date >= since && t.date <= ledger.asOf,
  );
  const salaries = rows.filter((t) => text(t).includes("salaire"));
  return (
    (salaries.at(-1) ?? rows.toSorted((a, b) => b.amount - a.amount)[0])
      ?.amount ?? 0
  );
}

export interface People {
  me: string;
  partner: string;
  joint: string[];
  meIncome: Cents;
  partnerIncome: Cents;
  /** My share of shared costs, 0–1. */
  share: number;
  incomeShare: number;
}

export function people(ledger: Ledger, s: PlanSettings): People | null {
  const byIncome = ledger.accounts
    .map((a) => ({ id: a.id, income: latestSalary(ledger, a.id) }))
    .sort((a, b) => b.income - a.income);
  const me = s.me ?? byIncome[0]?.id;
  const partner = s.partner ?? byIncome.find((a) => a.id !== me)?.id;
  if (!me || !partner) return null;
  const meIncome = latestSalary(ledger, me);
  const partnerIncome = latestSalary(ledger, partner);
  const incomeShare =
    meIncome + partnerIncome ? meIncome / (meIncome + partnerIncome) : 0.5;
  return {
    me,
    partner,
    joint: ledger.accounts
      .map((a) => a.id)
      .filter((id) => id !== me && id !== partner),
    meIncome,
    partnerIncome,
    incomeShare,
    share: s.share ?? incomeShare,
  };
}

/** My share for a mode, or null when each pays their own. */
export function myShare(
  mode: ShareMode,
  p: People,
  custom = 0.5,
): number | null {
  return {
    income: p.share,
    half: 0.5,
    custom,
    me: 1,
    partner: 0,
    personal: null,
  }[mode];
}

export interface GroupSplit {
  group: string;
  mode: ShareMode;
  share: number | null;
  paidMe: Cents;
  paidPartner: Cents;
  total: Cents;
  /** Positive: the partner owes me for this group. */
  balance: Cents;
}

function split(
  ledger: Ledger,
  s: PlanSettings,
  p: People,
  rows: Transaction[],
  months: number,
) {
  const groups = new Map<string, { me: number; partner: number }>();
  for (const t of rows) {
    if (!spent(t)) continue;
    const payer = t.account === p.partner ? "partner" : "me"; // joint accounts are funded by me
    const g = groups.get(groupOf(t)) ?? { me: 0, partner: 0 };
    g[payer] -= t.amount;
    groups.set(groupOf(t), g);
  }
  return [...groups]
    .map(([group, paid]): GroupSplit => {
      const mode = s.modes?.[group] ?? defaultMode(group);
      const share = myShare(mode, p, s.custom?.[group]);
      const paidMe = Math.round(paid.me / months);
      const paidPartner = Math.round(paid.partner / months);
      const total = paidMe + paidPartner;
      return {
        group,
        mode,
        share,
        paidMe,
        paidPartner,
        total,
        balance: share === null ? 0 : Math.round(paidMe - total * share),
      };
    })
    .sort((a, b) => b.total - a.total);
}

const rowsBetween = (ledger: Ledger, range: DateRange) =>
  ledger.transactions.filter(
    (t) => within(t.date, range) && t.date <= ledger.asOf,
  );

const completeMonths = (ledger: Ledger, count: number) => {
  const current = currentMonthKey(ledger.calendar, ledger.asOf);
  return Array.from({ length: count }, (_, i) =>
    monthRange(shiftMonth(current, -1 - i), ledger.calendar),
  ).filter((r) => r.from <= r.to);
};

export interface Settlement {
  month: string;
  groups: GroupSplit[];
  /** Usual monthly amounts (3 complete months) and the transfer they imply. */
  usual: GroupSplit[];
  usualOwed: Cents;
  owed: Cents;
  /** Internal transfers sent by the partner this month. */
  received: Cents;
  asked: Cents | null;
  /** Part of the fair share I keep advancing this month. */
  advanced: Cents;
}

export function settlement(
  ledger: Ledger,
  s: PlanSettings,
  p: People,
): Settlement {
  const month = currentMonthKey(ledger.calendar, ledger.asOf);
  const range = monthRange(month, ledger.calendar);
  const monthRows = rowsBetween(ledger, range);
  const groups = split(ledger, s, p, monthRows, 1);
  const past = completeMonths(ledger, 3);
  const usual = split(
    ledger,
    s,
    p,
    past.flatMap((r) => rowsBetween(ledger, r)),
    Math.max(1, past.length),
  );
  const owed = sumBy(groups, (g) => g.balance);
  const received = -sumBy(
    monthRows.filter(
      (t) => t.account === p.partner && t.internal && t.amount < 0,
    ),
    (t) => t.amount,
  );
  const asked = s.caps?.[month] ?? null;
  const usualOwed = sumBy(usual, (g) => g.balance);
  const due = Math.max(owed, usualOwed);
  return {
    month,
    groups,
    usual,
    usualOwed,
    owed,
    received,
    asked,
    advanced: Math.max(0, due - Math.max(asked ?? 0, received)),
  };
}

export interface FixedCharge {
  key: string;
  name: string;
  account: string;
  monthly: Cents;
  end?: string;
}

export interface Trajectory {
  months: { key: string; end: Cents; withEffort: Cents }[];
  income: Cents;
  fixed: FixedCharge[];
  variable: Cents;
  weeklyVariable: Cents;
  start: Cents | null;
}

export function trajectory(
  ledger: Ledger,
  s: PlanSettings,
  count = 6,
): Trajectory {
  const monthly = (r: { amount: number; frequency: string }) =>
    Math.round(
      r.frequency === "weekly" ? r.amount * WEEKS_PER_MONTH : r.amount,
    );
  const recurrences = activeRecurrences(ledger).filter((r) => !r.paused);
  const income = sumBy(
    recurrences.filter((r) => r.amount > 0),
    monthly,
  );
  const fixed = recurrences
    .filter((r) => r.amount < 0)
    .map((r) => ({
      key: r.key,
      name: r.name,
      account: r.account,
      monthly: -monthly(r),
      end: s.ends?.[r.key],
    }))
    .sort((a, b) => b.monthly - a.monthly);
  const totals = completeMonths(ledger, 3).map(
    (r) => -sumBy(rowsBetween(ledger, r).filter(spent), (t) => t.amount),
  );
  const fixedNow = sumBy(fixed, (f) => f.monthly);
  const variable = Math.max(0, median(totals) - fixedNow);
  const weeklyVariable = Math.round(variable / WEEKS_PER_MONTH);

  const current = currentMonthKey(ledger.calendar, ledger.asOf);
  const end = currentMonthEnd(ledger.calendar, ledger.asOf);
  const projected = forecast(ledger, "", end).points.at(-1)?.value ?? null;
  const effort = s.effort ?? 0;
  const weeksLeft = Math.max(0, daysBetween(ledger.asOf, end)) / 7;
  const months: Trajectory["months"] = [];
  if (projected !== null) {
    let base = projected;
    let saved = Math.round(effort * weeksLeft);
    months.push({ key: current, end: base, withEffort: base + saved });
    for (let i = 1; i < count; i++) {
      const key = shiftMonth(current, i);
      const charges = sumBy(
        fixed.filter((f) => !f.end || f.end >= key),
        (f) => f.monthly,
      );
      base += income - charges - variable;
      saved += Math.round(effort * WEEKS_PER_MONTH);
      months.push({ key, end: base, withEffort: base + saved });
    }
  }
  return {
    months,
    income,
    fixed,
    variable,
    weeklyVariable,
    start: householdBalance(ledger, "", ledger.asOf),
  };
}

export type Pressure = "none" | "low" | "medium" | "high" | "impossible";
export interface Scenario {
  key: string;
  weekly: Cents;
  pressure: Pressure;
}

/** Weekly saving needed so that every month from `key` on ends ≥ 0. */
export function scenarios(t: Trajectory): Scenario[] {
  const weeksUntil = (i: number) => Math.max(1, (i + 0.5) * WEEKS_PER_MONTH);
  return t.months.map((m, i) => {
    const weekly = Math.max(
      0,
      ...t.months
        .slice(i)
        .map((later, j) => Math.ceil(-later.end / weeksUntil(i + j))),
    );
    const ratio = t.weeklyVariable
      ? weekly / t.weeklyVariable
      : weekly
        ? Infinity
        : 0;
    const pressure: Pressure =
      weekly === 0
        ? "none"
        : ratio < 0.1
          ? "low"
          : ratio < 0.25
            ? "medium"
            : ratio < 0.5
              ? "high"
              : "impossible";
    return { key: m.key, weekly, pressure };
  });
}

export interface Allowance {
  category: string;
  usual: Cents;
  suggested: Cents;
  limit: Cents;
  ticket: Cents;
  spent: Cents;
}

/** Weekly personal limits per category, suggested from the last 8 full weeks. */
export function allowances(
  ledger: Ledger,
  s: PlanSettings,
  account: string,
  weeklyVariable: Cents,
): Allowance[] {
  const thisWeek = weekStart(ledger.asOf);
  const from = addDays(thisWeek, -56);
  const cut = weeklyVariable
    ? Math.min(0.6, (s.effort ?? 0) / weeklyVariable)
    : 0;
  const byCategory = new Map<string, Transaction[]>();
  for (const t of ledger.byAccount.get(account) ?? []) {
    if (!spent(t) || t.date < from || t.date > ledger.asOf) continue;
    if ((s.modes?.[groupOf(t)] ?? defaultMode(groupOf(t))) !== "personal")
      continue;
    byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
  }
  return [...byCategory]
    .map(([category, rows]) => {
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const start = addDays(from, i * 7);
        return -sumBy(
          rows.filter((t) => t.date >= start && t.date < addDays(start, 7)),
          (t) => t.amount,
        );
      });
      const usual = Math.round(weeks.reduce((a, b) => a + b, 0) / weeks.length);
      const suggested = Math.round((usual * (1 - cut)) / 500) * 500;
      return {
        category,
        usual,
        suggested,
        limit: s.allowances?.[account]?.[category] ?? suggested,
        ticket: median(rows.map((t) => -t.amount)),
        spent: -sumBy(
          rows.filter((t) => t.date >= thisWeek),
          (t) => t.amount,
        ),
      };
    })
    .filter((a) => a.usual > 0 || a.spent > 0)
    .sort((a, b) => b.usual - a.usual);
}
