import { addDays, clampDay, daysBetween, shiftMonth } from "./dates";
import type { Occurrence } from "./events";
import { memo, type Ledger } from "./ledger";
import { upperMedian } from "./money";
import { normalizedText, recurrenceIdentity } from "./text";
import type { IsoDate, Transaction } from "./types";

export interface Recurrence {
  /** Frozen format: JSON.stringify([account, identity, sign]). */
  key: string;
  aliases: string[];
  name: string;
  account: string;
  amount: number;
  category: string;
  frequency: "monthly" | "weekly";
  confidence: number;
  count: number;
  last: IsoDate | "";
  next: IsoDate;
  day: number;
  minimum: number;
  maximum: number;
  sourceIds: string[];
  confirmed: boolean;
  /** Paused rule or dismissed suggestion. */
  paused: boolean;
  ruleId?: string;
  end?: IsoDate;
}

export const recurrenceKey = (t: Transaction) =>
  JSON.stringify([t.account, recurrenceIdentity(t), Math.sign(t.amount)]);
const aliasKey = (account: string, name: string, sign: number) =>
  JSON.stringify([account, normalizedText(name), sign]);

interface Payment {
  date: IsoDate;
  amount: number;
  rows: Transaction[];
}

/** Two payments of a series on the same day count as one occurrence. */
function paymentDays(rows: Transaction[]): Payment[] {
  const days = new Map<IsoDate, Payment>();
  for (const t of rows) {
    const day = days.get(t.date) ?? { date: t.date, amount: 0, rows: [] };
    day.amount += t.amount;
    day.rows.push(t);
    days.set(t.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function detect(transactions: Transaction[], asOf: IsoDate): Recurrence[] {
  const groups = new Map<string, Transaction[]>();
  const earliest = addDays(asOf, -370);
  for (const t of transactions) {
    if (t.internal || !t.amount || t.date > asOf || t.date < earliest) continue;
    const identity = recurrenceIdentity(t);
    if (identity.length < 3) continue;
    const key = JSON.stringify([t.account, identity, Math.sign(t.amount)]);
    const group = groups.get(key);
    if (group) group.push(t);
    else groups.set(key, [t]);
  }
  const result: Recurrence[] = [];
  for (const [key, rows] of groups) {
    const recent = paymentDays(rows).slice(-8);
    if (recent.length < 3) continue;
    const amounts = recent.map((p) => p.amount);
    const amount = upperMedian(amounts);
    // One exceptional positive payment (e.g. a bonus) must not erase an otherwise
    // repeated income. Never extrapolate a single payment or an irregular sender.
    const stable = amounts.filter(
      (n) => Math.abs(n - amount) <= Math.max(150, Math.abs(amount) * 0.15),
    );
    const robustIncome =
      amount > 0 &&
      stable.length >= 3 &&
      stable.length / amounts.length >= 0.75;
    if (stable.length !== amounts.length && !robustIncome) continue;
    const gaps = recent
      .slice(1)
      .map((p, i) => daysBetween(recent[i].date, p.date));
    // Rent or bills paid by hand drift by a few days; one late month must not drop the series.
    const usualGap = gaps.length ? upperMedian(gaps) : 0;
    const monthly =
      usualGap >= 25 && usualGap <= 35 && gaps.every((g) => g >= 20 && g <= 42);
    const weekly = gaps.every((g) => g >= 5 && g <= 9);
    if (!monthly && !weekly) continue;
    const lastDay = recent.at(-1)!;
    if (daysBetween(lastDay.date, asOf) > (monthly ? 45 : 12)) continue;
    const last = lastDay.rows.at(-1)!;
    const day = upperMedian(recent.map((p) => Number(p.date.slice(8))));
    result.push({
      key,
      aliases: [
        ...new Set(
          rows.map((t) =>
            aliasKey(t.account, t.merchant || t.label, Math.sign(t.amount)),
          ),
        ),
      ],
      name: last.merchant || last.label,
      account: last.account,
      category: last.category,
      // A new salary or allowance (CAF 700 → 1 000) applies from its first payment.
      amount: amount > 0 ? lastDay.amount : amount,
      frequency: monthly ? "monthly" : "weekly",
      count: recent.length,
      last: lastDay.date,
      next: monthly
        ? clampDay(shiftMonth(lastDay.date.slice(0, 7), 1), day)
        : addDays(lastDay.date, 7),
      day,
      minimum: Math.min(...amounts),
      maximum: Math.max(...amounts),
      sourceIds: recent.flatMap((p) => p.rows.map((t) => t.id)),
      confidence:
        stable.length !== amounts.length ? 65 : recent.length >= 5 ? 90 : 70,
      confirmed: false,
      paused: false,
    });
  }
  return result.sort((a, b) => a.next.localeCompare(b.next));
}

const detected = new WeakMap<Transaction[], Map<IsoDate, Recurrence[]>>();

export function detectRecurrences(transactions: Transaction[], asOf: IsoDate) {
  const cache = detected.get(transactions) ?? new Map<IsoDate, Recurrence[]>();
  detected.set(transactions, cache);
  if (!cache.has(asOf)) {
    cache.set(asOf, detect(transactions, asOf));
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
  }
  return cache.get(asOf)!;
}

/** Confirmed rules replace their detected source; dismissed suggestions are paused. */
export const activeRecurrences = memo((ledger: Ledger): Recurrence[] => {
  const found = detectRecurrences(ledger.transactions, ledger.asOf);
  const { recurrenceRules, dismissedRecurrences } = ledger.prefs;
  const configured = recurrenceRules.map((rule): Recurrence => {
    const source = found.find(
      (r) =>
        r.key === rule.sourceKey ||
        r.aliases.includes(rule.sourceKey ?? "") ||
        (r.account === rule.account &&
          normalizedText(r.name) === normalizedText(rule.name) &&
          Math.sign(r.amount) === Math.sign(rule.amount)),
    );
    return {
      key: source?.key ?? rule.sourceKey ?? "rule:" + rule.id,
      aliases: [
        ...new Set([
          ...(source?.aliases ?? []),
          ...(rule.sourceKey ? [rule.sourceKey] : []),
        ]),
      ],
      ruleId: rule.id,
      name: rule.name,
      account: rule.account,
      amount: rule.amount,
      category: rule.category,
      frequency: rule.frequency,
      next: rule.next,
      day: Number(rule.next.slice(8)),
      last: source?.last ?? "",
      minimum: source?.minimum ?? rule.amount,
      maximum: source?.maximum ?? rule.amount,
      sourceIds: source?.sourceIds ?? [],
      count: source?.count ?? 0,
      confidence: 100,
      confirmed: true,
      paused: rule.paused ?? false,
      end: rule.end,
    };
  });
  const dismissed = new Set(dismissedRecurrences);
  return [
    ...configured,
    ...found
      .filter((r) => !configured.some((c) => c.key === r.key))
      .map((r) => ({
        ...r,
        paused: [r.key, ...r.aliases].some((k) => dismissed.has(k)),
      })),
  ].sort((a, b) => a.next.localeCompare(b.next));
});

/** Transactions by series key and by display-name alias, for occurrence matching. */
const paymentIndex = memo((ledger: Ledger) => {
  const index = new Map<string, Transaction[]>();
  const add = (key: string, t: Transaction) => {
    const rows = index.get(key);
    if (rows) rows.push(t);
    else index.set(key, [t]);
  };
  for (const t of ledger.transactions) {
    if (t.internal) continue;
    add(recurrenceKey(t), t);
    add(
      "name:" +
        JSON.stringify([t.account, normalizedText(t.merchant || t.label)]),
      t,
    );
  }
  return index;
});

function scheduleDates(r: Recurrence, earliest: IsoDate, end: IsoDate) {
  const step = (date: IsoDate) =>
    r.frequency === "weekly"
      ? addDays(date, 7)
      : clampDay(shiftMonth(date.slice(0, 7), 1), r.day);
  let date = r.next;
  if (r.frequency === "weekly" && date < earliest)
    date = addDays(date, Math.ceil(daysBetween(date, earliest) / 7) * 7);
  if (r.frequency === "monthly" && date.slice(0, 7) < earliest.slice(0, 7))
    date = clampDay(earliest.slice(0, 7), r.day);
  const dates: IsoDate[] = [];
  for (let i = 0; date <= end && (!r.end || date <= r.end) && i < 130; i++) {
    if (date >= earliest) dates.push(date);
    date = step(date);
  }
  return dates;
}

/** Unmatched expected occurrences from five days ago to `end`. Never persisted. */
export const estimates = memo((ledger: Ledger, end: IsoDate): Occurrence[] => {
  const { asOf, dues, prefs } = ledger;
  const earliest = addDays(asOf, -5);
  const replaced = new Set([
    ...prefs.ignoredOccurrences,
    ...dues.flatMap((d) =>
      d.originOccurrenceId ? [d.originOccurrenceId] : [],
    ),
  ]);
  const index = paymentIndex(ledger);
  const events: Occurrence[] = [];
  for (const r of activeRecurrences(ledger)) {
    if (r.paused) continue;
    const dates = scheduleDates(r, earliest, end);
    if (!dates.length) continue;
    const keys = [r.key, ...r.aliases];
    const byName =
      index.get(
        "name:" + JSON.stringify([r.account, normalizedText(r.name)]),
      ) ?? [];
    const payments = new Set([...(index.get(r.key) ?? []), ...byName]);
    // One payment (or its linked manual due) can cover only one occurrence.
    // A ±4-day tolerance otherwise consumes two adjacent weekly occurrences.
    const resources = [
      ...[...payments].map((t) => ({
        key: "transaction:" + t.id,
        date: t.date,
        amount: t.amount,
      })),
      ...dues
        .filter(
          (d) =>
            !d.originOccurrenceId &&
            d.account === r.account &&
            (keys.includes(d.recurrenceKey ?? "") ||
              normalizedText(d.label) === normalizedText(r.name)),
        )
        .map((d) => ({
          key: d.transactionId
            ? "transaction:" + d.transactionId
            : "due:" + d.id,
          date: d.date,
          amount: d.amount,
        })),
    ].filter(
      (v) =>
        Math.sign(v.amount) === Math.sign(r.amount) &&
        Math.abs(v.amount - r.amount) <=
          Math.max(150, Math.abs(r.amount) * 0.2),
    );
    const matches = dates
      .flatMap((date) =>
        resources
          .map((v) => ({
            date,
            key: v.key,
            gap: Math.abs(daysBetween(v.date, date)),
          }))
          .filter((m) => m.gap <= 4),
      )
      .sort(
        (a, b) =>
          a.gap - b.gap ||
          a.date.localeCompare(b.date) ||
          a.key.localeCompare(b.key),
      );
    const covered = new Set<IsoDate>();
    const used = new Set<string>();
    for (const m of matches) {
      if (covered.has(m.date) || used.has(m.key)) continue;
      covered.add(m.date);
      used.add(m.key);
    }
    const spread = r.confirmed
      ? 0
      : Math.max(
          Math.abs(r.amount - r.minimum),
          Math.abs(r.amount - r.maximum),
        );
    for (const date of dates)
      if (
        !covered.has(date) &&
        !keys.some((k) => replaced.has(`estimate:${k}:${date}`))
      )
        events.push({
          id: `estimate:${r.key}:${date}`,
          kind: "estimate",
          date,
          amount: r.amount,
          label: r.name,
          account: r.account,
          category: r.category,
          overdue: date < asOf,
          recurrenceKey: r.key,
          confirmed: r.confirmed,
          confidence: r.confidence,
          spread,
        });
  }
  return events;
});
