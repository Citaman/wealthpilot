import { describe, it, expect } from "vitest";
import { selectDashboard } from "./domain";
import { emptySnapshot, type Transaction } from "./types";

const tx = (
  id: string,
  account: string,
  date: string,
  amount: number,
  internal = false,
): Transaction => ({
  id,
  account,
  date,
  amount,
  internal,
  label: id,
  merchant: id,
  category: "Courses",
  raw: {},
  fingerprint: id,
  batchId: "test",
});

describe("Contre-revue indépendante des agrégats dashboard", () => {
  it("ne propage ni compte B ni virement interne dans les enveloppes A sur deux mois", () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = ["A", "B"].map((id) => ({
      id,
      checkpoint: { date: "2026-10-05", amount: 100000 },
    }));
    s.transactions = [
      tx("A-sept", "A", "2026-09-15", -1200),
      tx("B-sept", "B", "2026-09-15", -9900),
      tx("A-oct", "A", "2026-10-02", -1700),
      tx("A-future", "A", "2026-10-20", -800),
      tx("A-internal", "A", "2026-10-21", -3300, true),
      tx("B-future", "B", "2026-10-20", -8700),
    ];
    s.budgets = [
      {
        id: "sept",
        month: "2026-09",
        category: "Courses",
        account: "A",
        amount: 3000,
      },
      {
        id: "oct",
        month: "2026-10",
        category: "Courses",
        account: "A",
        amount: 6000,
      },
    ];
    const household = selectDashboard(
      s,
      "2026-10",
      "",
      "2026-10-05",
      "2026-09",
    );
    const account = selectDashboard(s, "2026-10", "A", "2026-10-05", "2026-09");
    for (const d of [household, account]) {
      expect(d.budgets[0]).toMatchObject({
        amount: 9000,
        spent: 2900,
        committed: 800,
        remaining: 5300,
      });
      expect(d.remainingEnvelopes).toBe(3500);
      expect(d.remainingEnvelopes).toBe(d.projection.variable.get("2026-10"));
    }
    expect(account.rows.map((t) => t.id)).toEqual(["A-sept", "A-oct"]);
    expect(account.obligations).toBe(800);
  });
  it("un mois historique ne devient pas une fenêtre de transactions futures lorsque la date actuelle avance", () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "A", checkpoint: { date: "2026-10-05", amount: 100000 } },
    ];
    s.transactions = [
      tx("September", "A", "2026-09-30", -1000),
      tx("October", "A", "2026-10-01", -2000),
    ];
    const before = selectDashboard(s, "2026-09", "A", "2026-10-05");
    const after = selectDashboard(s, "2026-09", "A", "2026-11-05");
    expect(after.cutoff).toBe("2026-09-30");
    expect(after.rows.map((t) => t.id)).toEqual(["September"]);
    expect(after.spending).toBe(before.spending);
    expect(after.balance).toBe(before.balance);
    expect(after.projection.events).toEqual(before.projection.events);
  });
});
