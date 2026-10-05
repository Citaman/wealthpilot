import { householdBalance } from "./balances";
import { envelopes } from "./envelopes";
import { upcoming, type Occurrence } from "./events";
import { memo, type Ledger } from "./ledger";
import { currentMonthEnd, currentMonthKey } from "./periods";
import type { IsoDate } from "./types";

export interface Available {
  cash: number | null;
  until: IsoDate;
  /** Unpaid charges until `until`, overdue included. */
  charges: Occurrence[];
  chargesTotal: number;
  envelopesFree: number;
  safety: number;
  /** Saved money of retired goals; a visible line only when > 0. */
  projects: number;
  /** Negative is kept: it is money missing, not zero. */
  free: number | null;
  /** Shown, never counted. */
  expectedIncome: Occurrence[];
  unknownBalance: boolean;
  /** Account filter: household reserves are not split, so they are not subtracted. */
  sharedReserveNote: boolean;
}

/** Free money until the end of the current budget month, independent of the dock period. */
export const available = memo((ledger: Ledger, account: string): Available => {
  const { asOf, calendar, prefs } = ledger;
  const until = currentMonthEnd(calendar, asOf);
  const cash = householdBalance(ledger, account, asOf);
  // Household transfers cancel out; for one account they are real outflows.
  const events = upcoming(ledger, account, until).filter(
    (o) => account || !o.internal,
  );
  const charges = events.filter((o) => o.amount < 0);
  const chargesTotal = charges.reduce((n, o) => n - o.amount, 0);
  const envelopesFree = envelopes(
    ledger,
    account,
    currentMonthKey(calendar, asOf),
  ).reduce((n, e) => n + e.free, 0);
  const safety = account ? 0 : prefs.safety;
  const projects = account ? 0 : prefs.projectsReserve;
  return {
    cash,
    until,
    charges,
    chargesTotal,
    envelopesFree,
    safety,
    projects,
    free:
      cash === null
        ? null
        : cash - chargesTotal - envelopesFree - safety - projects,
    expectedIncome: events.filter((o) => o.amount > 0),
    unknownBalance: cash === null,
    sharedReserveNote:
      Boolean(account) && prefs.safety + prefs.projectsReserve > 0,
  };
});
