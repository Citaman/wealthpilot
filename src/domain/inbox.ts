import { accountStatus } from "./balances";
import { isUncategorized } from "./categories";
import { daysBetween } from "./dates";
import { staleBefore } from "./events";
import { memo, rowsIn, type Ledger } from "./ledger";
import { activeRecurrences, type Recurrence } from "./recurring";

export type InboxItem =
  | { kind: "uncategorized"; ids: string[] }
  | { kind: "recurrence"; recurrence: Recurrence }
  | {
      kind: "balance";
      account: string;
      freshness: "stale" | "unknown";
      ageDays: number | null;
    }
  | { kind: "future"; ids: string[] }
  /** Same amount out of one account and into another: probably a transfer. */
  | { kind: "transfers"; ids: string[]; pairs: number }
  /** Unreconciled dues older than 31 days, out of every projection. */
  | { kind: "overdue"; ids: string[] };

/**
 * Unmarked transfers between the household's own accounts: an outflow and an
 * inflow of the same amount on two accounts, at most 3 days apart. Each row is
 * used once; the closest date wins.
 */
export const unmarkedTransfers = memo((ledger: Ledger): [string, string][] => {
  const candidates = ledger.transactions.filter(
    (t) => !t.internal && t.date <= ledger.asOf,
  );
  const inflows = new Map<number, typeof candidates>();
  for (const t of candidates)
    if (t.amount > 0)
      inflows.set(t.amount, [...(inflows.get(t.amount) ?? []), t]);
  const used = new Set<string>();
  const pairs: [string, string][] = [];
  for (const out of candidates) {
    if (out.amount >= 0) continue;
    const match = (inflows.get(-out.amount) ?? [])
      .filter(
        (i) =>
          i.account !== out.account &&
          !used.has(i.id) &&
          Math.abs(daysBetween(out.date, i.date)) <= 3,
      )
      .sort(
        (a, b) =>
          Math.abs(daysBetween(out.date, a.date)) -
          Math.abs(daysBetween(out.date, b.date)),
      )[0];
    if (!match) continue;
    used.add(match.id);
    pairs.push([out.id, match.id]);
  }
  return pairs;
});

/** Decisions waiting for the user, in display order; empty kinds are omitted. */
export const inbox = memo((ledger: Ledger, account: string): InboxItem[] => {
  const rows = rowsIn(ledger, account);
  const uncategorized = rows.filter(
    (t) => !t.internal && isUncategorized(t.category),
  );
  const future = rows.filter((t) => t.date > ledger.asOf);
  const scoped = new Set(rows.map((t) => t.id));
  const transfers = unmarkedTransfers(ledger).filter(
    ([a, b]) => scoped.has(a) || scoped.has(b),
  );
  const stale = ledger.dues.filter(
    (d) =>
      !d.transactionId &&
      d.date < staleBefore(ledger.asOf) &&
      (!account || d.account === account),
  );
  return [
    ...(transfers.length
      ? [
          {
            kind: "transfers" as const,
            ids: transfers.flat(),
            pairs: transfers.length,
          },
        ]
      : []),
    ...(uncategorized.length
      ? [
          {
            kind: "uncategorized" as const,
            ids: uncategorized.map((t) => t.id),
          },
        ]
      : []),
    ...activeRecurrences(ledger)
      .filter(
        (r) => !r.confirmed && !r.paused && (!account || r.account === account),
      )
      .map((recurrence) => ({ kind: "recurrence" as const, recurrence })),
    ...accountStatus(ledger).flatMap((s) =>
      s.freshness !== "ok" && (!account || s.id === account)
        ? [
            {
              kind: "balance" as const,
              account: s.id,
              freshness: s.freshness,
              ageDays: s.ageDays,
            },
          ]
        : [],
    ),
    ...(stale.length
      ? [{ kind: "overdue" as const, ids: stale.map((d) => d.id) }]
      : []),
    ...(future.length
      ? [{ kind: "future" as const, ids: future.map((t) => t.id) }]
      : []),
  ];
});
