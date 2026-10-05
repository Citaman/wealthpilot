import { addDays } from "./dates";
import { memo, rowsIn, type Ledger } from "./ledger";
import { estimates } from "./recurring";
import type { IsoDate } from "./types";

export interface Occurrence {
  /** Due id, `estimate:<key>:<date>` or `known:<transactionId>`. */
  id: string;
  /** Manual due, detected/confirmed estimate, or imported future-dated transaction. */
  kind: "due" | "estimate" | "known";
  date: IsoDate;
  amount: number;
  label: string;
  account: string;
  category?: string;
  internal?: boolean;
  /** Dated before `asOf`, not reconciled: a charge is applied on `asOf`, an income waits until received. */
  overdue: boolean;
  recurrenceKey?: string;
  confirmed?: boolean;
  confidence?: number;
  /** Amount dispersion used by the prudent/favourable band. */
  spread: number;
}

// An unreconciled due older than this is no longer assumed pending: it leaves the
// projection and waits in the inbox for a decision.
export const staleBefore = (asOf: IsoDate) => addDays(asOf, -31);

/** Expected movements up to `until`, recent overdue first, each counted once. */
export const upcoming = memo(
  (ledger: Ledger, account: string, until: IsoDate): Occurrence[] => {
    const { asOf } = ledger;
    const inScope = (id: string) => !account || id === account;
    const dues: Occurrence[] = ledger.dues
      .filter(
        (d) =>
          !d.transactionId &&
          d.date >= staleBefore(asOf) &&
          d.date <= until &&
          inScope(d.account),
      )
      .map((d) => ({
        id: d.id,
        kind: "due",
        date: d.date,
        amount: d.amount,
        label: d.label,
        account: d.account,
        category: d.category,
        internal: d.internal,
        overdue: d.date < asOf,
        recurrenceKey: d.recurrenceKey,
        confirmed: d.recurrenceConfirmed,
        spread: 0,
      }));
    const known: Occurrence[] = rowsIn(ledger, account)
      .filter((t) => t.date > asOf && t.date <= until)
      .map((t) => ({
        id: "known:" + t.id,
        kind: "known",
        date: t.date,
        amount: t.amount,
        label: t.merchantName || t.merchant || t.label,
        account: t.account,
        category: t.category,
        internal: t.internal,
        overdue: false,
        spread: 0,
      }));
    return [
      ...dues,
      ...estimates(ledger, until).filter((o) => inScope(o.account)),
      ...known,
    ].sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  },
);

/** A late income is not cash: it stays listed as expected but out of the projection. */
export const movesCash = (o: Occurrence) => !(o.overdue && o.amount > 0);

/** Date on which an occurrence moves cash: overdue items land on `asOf`. */
export const effectiveDate = (o: Occurrence, asOf: IsoDate) =>
  o.date < asOf ? asOf : o.date;

export const nextIncome = memo(
  (ledger: Ledger, account: string) =>
    upcoming(ledger, account, addDays(ledger.asOf, 62)).find(
      (o) => o.amount > 0 && !o.internal && !o.overdue,
    ) ?? null,
);
