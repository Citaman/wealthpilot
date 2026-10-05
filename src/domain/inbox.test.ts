import { expect, it } from "vitest";
import { demoSnapshot } from "../dev/demo";
import { inbox, unmarkedTransfers } from "./inbox";
import { buildLedger, financePrefs } from "./ledger";
import type { Transaction } from "./types";

const asOf = "2026-10-05";
const s = demoSnapshot(asOf);
const row = (
  id: string,
  account: string,
  date: string,
  amount: number,
): Transaction => ({
  id,
  batchId: "b",
  date,
  account,
  amount,
  merchant: "VIR",
  label: "VIR",
  category: "À catégoriser",
  internal: false,
  fingerprint: id,
  raw: {},
});

it("virements non marqués : un débit et un crédit identiques sur deux comptes à 3 jours près sont appariés", () => {
  // pairs an outflow and an inflow of the same amount on two accounts within 3 days
  {
    const transactions = [
      ...s.transactions,
      row("out", "Alex", "2026-10-01", -50522),
      row("in", "Commun", "2026-10-02", 50522),
      row("late", "Sam", "2026-10-02", -77700),
      row("tooLate", "Commun", "2026-10-07", 77700),
    ];
    const ledger = buildLedger(
      { ...s, transactions, prefs: financePrefs(s.preferences) },
      asOf,
    );
    expect(unmarkedTransfers(ledger)).toEqual([["out", "in"]]);
    expect(inbox(ledger, "").find((i) => i.kind === "transfers")).toMatchObject(
      { pairs: 1 },
    );
  }
});
