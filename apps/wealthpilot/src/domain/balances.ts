import {
  addDays,
  daysBetween,
  eachDay,
  minDate,
  weekStart,
  type DateRange,
} from "./dates";
import {
  accountName,
  accountsIn,
  memo,
  rowsIn,
  type Ledger,
  type Scope,
} from "./ledger";
import type { Account, BalanceCheckpoint, IsoDate, Transaction } from "./types";

/** Accepted anchors, observations first; the legacy `checkpoint` wins date ties. */
function anchors(account: Account): BalanceCheckpoint[] {
  const history = [...(account.checkpoints ?? [])];
  if (account.checkpoint) history.push(account.checkpoint);
  const accepted = history.filter((c) => c.accepted !== false);
  const observations = accepted.filter((c) => c.status !== "derived");
  const candidates = observations.length ? observations : accepted;
  const byDate = new Map(candidates.map((c) => [c.date, c]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const pick = (sorted: BalanceCheckpoint[], date: IsoDate) =>
  sorted.findLast((c) => c.date <= date) ?? sorted[0];

/** No time-window input: the same account/date always selects the same anchor. */
export const checkpointForDate = (account: Account, date: IsoDate) =>
  pick(anchors(account), date) as BalanceCheckpoint | undefined;

export type CoverageStatus =
  | "observed"
  | "covered"
  | "derived"
  | "incomplete"
  | "unknown";

export function coverageStatus(
  account: Account,
  date: IsoDate,
): CoverageStatus {
  const checkpoint = checkpointForDate(account, date);
  if (!checkpoint) return "unknown";
  if (checkpoint.status === "derived") return "derived";
  if (date === checkpoint.date) return "observed";
  if (!account.coverage?.length) return "unknown";
  const from = minDate(date, checkpoint.date);
  const through = date > checkpoint.date ? date : checkpoint.date;
  let coveredThrough = from;
  for (const range of account.coverage
    .filter((c) => c.complete)
    .sort((a, b) => a.from.localeCompare(b.from))) {
    if (range.through < coveredThrough) continue;
    if (range.from > addDays(coveredThrough, 1)) continue;
    // The first observation date itself needs no imported transaction.
    if (
      coveredThrough === from &&
      range.from > from &&
      from !== checkpoint.date
    )
      continue;
    coveredThrough = range.through;
    if (coveredThrough >= through) return "covered";
  }
  return "incomplete";
}

/** End-of-day balance reader: anchor ± movements between anchor and date. */
function balanceReader(account: Account, rows: Transaction[]) {
  const sorted = anchors(account);
  const own = rows
    .filter((t) => t.account === account.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = own.map((t) => t.date);
  const totals: number[] = [];
  own.reduce((total, t, i) => (totals[i] = total + t.amount), 0);
  const through = (date: IsoDate) => {
    let lo = 0,
      hi = dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= date) lo = mid + 1;
      else hi = mid;
    }
    return lo ? totals[lo - 1] : 0;
  };
  return (date: IsoDate): number | null => {
    const anchor = sorted.length ? pick(sorted, date) : undefined;
    return anchor ? anchor.amount + through(date) - through(anchor.date) : null;
  };
}

export const balanceAt = (
  account: Account,
  rows: Transaction[],
  date: IsoDate,
) => balanceReader(account, rows)(date);

const reader = memo((ledger: Ledger, id: string) =>
  balanceReader(
    ledger.accounts.find((a) => a.id === id)!,
    ledger.byAccount.get(id) ?? [],
  ),
);

/** Sum over the scope; null when any account lacks an anchor. */
export function householdBalance(
  ledger: Ledger,
  account: string,
  date: IsoDate,
) {
  const accounts = accountsIn(ledger, account);
  let total = 0;
  for (const a of accounts) {
    const value = reader(ledger, a.id)(date);
    if (value === null) return null;
    total += value;
  }
  return accounts.length ? total : null;
}

export type Granularity = "day" | "week" | "month";

export interface SeriesPoint {
  /** Last day of the bucket. */
  date: IsoDate;
  value: number | null;
  /** Some account in scope has no complete statement coverage that day. */
  gap: boolean;
  /** A bank observation anchors this day. */
  observed: boolean;
  count: number;
  net: number;
}

const bucket = (date: IsoDate, granularity: Granularity) =>
  granularity === "month"
    ? date.slice(0, 7)
    : granularity === "week"
      ? weekStart(date)
      : date;

/** Daily closing balances, anchored on checkpoints, up to `asOf`. */
export const balanceSeries = memo((ledger: Ledger, scope: Scope) => {
  const range: DateRange = {
    from: scope.range.from,
    to: minDate(scope.range.to, ledger.asOf),
  };
  const accounts = accountsIn(ledger, scope.account);
  const days = range.from <= range.to ? eachDay(range) : [];
  const moves = new Map<IsoDate, { count: number; net: number }>();
  for (const t of rowsIn(ledger, scope.account)) {
    if (t.date < range.from || t.date > range.to) continue;
    const day = moves.get(t.date) ?? { count: 0, net: 0 };
    day.count++;
    day.net += t.amount;
    moves.set(t.date, day);
  }
  const perAccount = accounts.map((a) => ({
    account: a.id,
    name: accountName(ledger, a.id),
    values: days.map((d) => reader(ledger, a.id)(d)),
  }));
  const daily: SeriesPoint[] = days.map((date, i) => {
    const values = perAccount.map((p) => p.values[i]);
    const statuses = accounts.map((a) => coverageStatus(a, date));
    return {
      date,
      value:
        accounts.length && values.every((v) => v !== null)
          ? values.reduce<number>((total, v) => total + v!, 0)
          : null,
      gap: statuses.some((s) => s !== "observed" && s !== "covered"),
      observed: statuses.includes("observed"),
      count: moves.get(date)?.count ?? 0,
      net: moves.get(date)?.net ?? 0,
    };
  });
  const span = days.length;
  const granularity: Granularity =
    span <= 120 ? "day" : span <= 731 ? "week" : "month";
  if (granularity === "day") return { granularity, points: daily, perAccount };
  // Buckets keep closing balances, never their sum; the first anchor stays visible.
  const kept = [0];
  const points: SeriesPoint[] = daily.length ? [daily[0]] : [];
  for (let i = 1; i < daily.length; i++) {
    const p = daily[i];
    const last = points.at(-1)!;
    if (
      points.length > 1 &&
      bucket(last.date, granularity) === bucket(p.date, granularity)
    ) {
      points[points.length - 1] = {
        ...p,
        gap: p.gap || last.gap,
        observed: p.observed || last.observed,
        count: last.count + p.count,
        net: last.net + p.net,
      };
      kept[kept.length - 1] = i;
    } else {
      points.push(p);
      kept.push(i);
    }
  }
  return {
    granularity,
    points,
    perAccount: perAccount.map((p) => ({
      ...p,
      values: kept.map((i) => p.values[i]),
    })),
  };
});

export interface AccountStatus {
  id: string;
  name: string;
  balance: number | null;
  /** Anchor used today (latest observation on or before `asOf`). */
  checkpoint: BalanceCheckpoint | null;
  ageDays: number | null;
  freshness: "ok" | "stale" | "unknown";
  /** ISO timestamp of the latest batch that brought transactions to this account. */
  lastImport: string | null;
  /** Merged complete statement ranges. */
  coverage: DateRange[];
}

function mergedCoverage(account: Account): DateRange[] {
  const ranges = (account.coverage ?? [])
    .filter((c) => c.complete)
    .sort((a, b) => a.from.localeCompare(b.from));
  const merged: DateRange[] = [];
  for (const c of ranges) {
    const last = merged.at(-1);
    if (last && c.from <= addDays(last.to, 1)) {
      if (c.through > last.to) last.to = c.through;
    } else merged.push({ from: c.from, to: c.through });
  }
  return merged;
}

export const accountStatus = memo((ledger: Ledger): AccountStatus[] => {
  const imported = new Map(ledger.batches.map((b) => [b.id, b.createdAt]));
  return ledger.accounts.map((a) => {
    const checkpoint = checkpointForDate(a, ledger.asOf) ?? null;
    const ageDays = checkpoint && daysBetween(checkpoint.date, ledger.asOf);
    let lastImport: string | null = null;
    for (const t of ledger.byAccount.get(a.id) ?? []) {
      const at = imported.get(t.batchId);
      if (at && (!lastImport || at > lastImport)) lastImport = at;
    }
    return {
      id: a.id,
      name: accountName(ledger, a.id),
      balance: householdBalance(ledger, a.id, ledger.asOf),
      checkpoint,
      ageDays,
      freshness: ageDays === null ? "unknown" : ageDays > 7 ? "stale" : "ok",
      lastImport,
      coverage: mergedCoverage(a),
    };
  });
});
