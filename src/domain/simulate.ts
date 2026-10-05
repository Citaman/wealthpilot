import { addDays, weekStart } from "./dates";
import { available } from "./available";
import { envelopes } from "./envelopes";
import {
  consumed,
  forecast,
  planningEnd,
  schedule,
  type LowPoint,
} from "./forecast";
import { memo, type Ledger } from "./ledger";
import { monthOf } from "./periods";
import type { IsoDate } from "./types";

export interface PurchaseInput {
  amount: number;
  category: string;
  date: IsoDate;
  /** "" = paid from household cash. */
  account: string;
}

export interface Simulation {
  inEnvelope: boolean;
  /** Payer's envelope, else the shared household one; negative after means overspent. */
  envelope: { category: string; before: number; after: number } | null;
  /** Available money of the payer's scope. */
  free: { before: number | null; after: number | null };
  low: { before: LowPoint | null; after: LowPoint | null };
  /** Payer's projected closing balances after the purchase (same dates as its forecast). */
  projection: { date: IsoDate; value: number }[];
  verdict: "ok" | "outside" | "risk";
  /** First day the payer goes under its reserve (or 0) after the purchase. */
  riskDate?: IsoDate;
}

/** Writes nothing. Money already provisioned by an envelope is not deducted twice. */
export const simulatePurchase = memo(
  (ledger: Ledger, input: PurchaseInput): Simulation => {
    const { asOf, calendar } = ledger;
    const { amount, category, account } = input;
    const month = monthOf(input.date, calendar);
    const find = (scope: string) =>
      envelopes(ledger, scope, month).find((e) => e.category === category);
    const own = find(account);
    const shared = account ? find("") : undefined;
    const envelope =
      own ?? (shared?.budgets.some((b) => !b.account) ? shared : undefined);
    const fits =
      envelope !== undefined && amount > 0 && amount <= envelope.free;
    // Only the payer's own envelope is provisioned in the payer's cash and available money.
    const covered = Math.min(amount, own?.free ?? 0);
    const f = forecast(
      ledger,
      account,
      planningEnd(ledger, addDays(weekStart(input.date), 6)),
    );
    const provision = f.provisions[month];
    const s = schedule(ledger, month);
    const released = (date: IsoDate) =>
      provision === undefined
        ? 0
        : consumed(provision, s, date) - consumed(provision - covered, s, date);
    const paidOn = input.date < asOf ? asOf : input.date;
    const projection = f.points.map((p) => ({
      date: p.date,
      value: p.value - (p.date >= paidOn ? amount : 0) + released(p.date),
    }));
    const lowest = projection.reduce<LowPoint | null>(
      (low, p) => (!low || p.value < low.value ? p : low),
      null,
    );
    const risk = projection.find((p) => p.value < f.reserve);
    const av = available(ledger, account);
    return {
      inEnvelope: fits,
      envelope: envelope
        ? { category, before: envelope.free, after: envelope.free - amount }
        : null,
      free: {
        before: av.free,
        after:
          av.free === null
            ? null
            : av.free - (input.date <= av.until ? amount - covered : 0),
      },
      low: {
        before: f.lowPoint,
        after: lowest && account ? { ...lowest, account } : lowest,
      },
      projection,
      verdict: risk ? "risk" : fits ? "ok" : "outside",
      ...(risk && { riskDate: risk.date }),
    };
  },
);
