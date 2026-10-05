import { accountStatus } from "./balances";
import { isUncategorized } from "./categories";
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
  /** Unreconciled dues older than 31 days, out of every projection. */
  | { kind: "overdue"; ids: string[] };

/** Decisions waiting for the user, in display order; empty kinds are omitted. */
export const inbox = memo((ledger: Ledger, account: string): InboxItem[] => {
  const rows = rowsIn(ledger, account);
  const uncategorized = rows.filter(
    (t) => !t.internal && isUncategorized(t.category),
  );
  const future = rows.filter((t) => t.date > ledger.asOf);
  const stale = ledger.dues.filter(
    (d) =>
      !d.transactionId &&
      d.date < staleBefore(ledger.asOf) &&
      (!account || d.account === account),
  );
  return [
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
