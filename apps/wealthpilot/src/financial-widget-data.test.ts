import { describe, expect, it } from "vitest";
import { selectDashboard } from "./domain";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";
import { cycleComparison, unusualExpenses } from "./financialWidgetData";

const tx = (
  id: string,
  date: string,
  amount: number,
  account = "A",
): Transaction => ({
  id,
  date,
  amount,
  account,
  merchant: id,
  label: id,
  category: "Courses",
  internal: false,
  fingerprint: id,
  batchId: "synthetic",
  raw: {},
});
const fixture = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A", checkpoint: { date: "2026-10-05", amount: 200000 } }],
  transactions: [
    tx("paid", "2026-10-02", -1000),
    tx("future", "2026-10-20", -9000),
  ],
  budgets: [
    { id: "budget", month: "2026-10", category: "Courses", amount: 20000 },
  ],
});

describe("Contrats sémantiques des cartes financières", () => {
  it("compare les cycles du 26 au 25 avec les bornes choisies, sans revenus, virements ni données futures", () => {
    const s = fixture();
    s.preferences.cycleStartDay = 3; // obsolete preference is ignored
    s.transactions = [
      tx("old", "2026-08-20", -20000),
      tx("previous-last", "2026-09-25", -8000),
      tx("cycle-first", "2026-09-26", -16000),
      tx("today", "2026-10-05", -20000),
      tx("future", "2026-10-06", -18000),
      tx("next-cycle", "2026-10-26", -90000),
      tx("other-account", "2026-09-26", -200000, "B"),
      tx("salary", "2026-09-26", 200000),
      { ...tx("transfer", "2026-09-26", -50000), internal: true },
    ];
    const comparison = cycleComparison(
      s,
      "A",
      { from: "2026-09-26", to: "2026-10-25" },
      "2026-10-05",
    );
    expect(comparison.map((p) => [p.key, p.value])).toEqual([
      ["2026-08", 20000],
      ["2026-09", 8000],
      ["2026-10", 36000],
    ]);
    expect(comparison[2]).toMatchObject({
      from: "2026-09-26",
      to: "2026-10-05",
      partial: true,
      current: true,
    });
    const custom = cycleComparison(
      s,
      "A",
      { from: "2026-09-29", to: "2026-10-05" },
      "2026-10-30",
    );
    expect(custom[2]).toMatchObject({
      value: 20000,
      from: "2026-09-29",
      to: "2026-10-05",
      partial: true,
      current: true,
    });
    expect(
      cycleComparison(
        s,
        "A",
        { from: "2026-10-26", to: "2026-11-25" },
        "2026-10-05",
      ).at(-1),
    ).toMatchObject({ value: 0, future: true });
    const unusual = unusualExpenses(s, "A", "2026-10", "2026-10", "2026-10-05");
    expect(unusual.referenceBefore).toBe("2026-09-26");
    expect(unusual.history.months).toEqual(["2026-08", "2026-09"]);
    expect(unusual.rows.map((t) => t.id)).toEqual(["today", "cycle-first"]);
    const narrower = unusualExpenses(
      s,
      "A",
      "2026-10",
      "2026-10",
      "2026-10-05",
      { from: "2026-09-29", to: "2026-10-05" },
    );
    expect(narrower.rows.map((t) => t.id)).toEqual(["today"]);
    expect(narrower.history).toEqual(unusual.history);
  });

  it("agrège les enveloppes affectées sans consommer celle d’un autre compte ni soustraire deux fois le foyer", () => {
    const s = fixture();
    s.accounts.push({
      id: "B",
      checkpoint: { date: "2026-10-05", amount: 100000 },
    });
    s.transactions = [
      tx("A-paid", "2026-10-02", -8000),
      tx("B-paid", "2026-10-02", -5000, "B"),
    ];
    s.budgets = [
      {
        id: "a",
        month: "2026-10",
        category: "Courses",
        amount: 10000,
        account: "A",
      },
      {
        id: "b",
        month: "2026-10",
        category: "Courses",
        amount: 20000,
        account: "B",
      },
    ];
    let d = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(d.remainingEnvelopes).toBe(17000);
    expect(d.remainingEnvelopes).toBe(d.projection.variable.get("2026-10"));
    expect(d.budgets[0]).toMatchObject({
      amount: 30000,
      spent: 13000,
      committed: 0,
      remaining: 17000,
    });
    s.budgets = s.budgets.slice(0, 1);
    s.transactions = [
      tx("B-paid", "2026-10-02", -8000, "B"),
      tx("B-planned", "2026-10-20", -5000, "B"),
    ];
    d = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(d.remainingEnvelopes).toBe(10000);
    expect(d.budgets[0]).toMatchObject({
      spent: 0,
      committed: 0,
      remaining: 10000,
    });
    s.budgets.push({
      id: "global",
      month: "2026-10",
      category: "Courses",
      amount: 20000,
    });
    d = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(d.budgets[0]).toMatchObject({
      amount: 20000,
      spent: 8000,
      committed: 5000,
      remaining: 7000,
    });
    expect(d.remainingEnvelopes).toBe(7000);
  });
  it("sépare réalisé et engagé jusqu’au jour observé, puis reconnaît le paiement sans changer les centimes", () => {
    const s = fixture();
    const current = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(current.spending).toBe(1000);
    expect(current.rows.map((t) => t.id)).toEqual(["paid"]);
    expect(current.budgets[0]).toMatchObject({
      spent: 1000,
      committed: 9000,
      remaining: 10000,
    });
    expect(current.obligations).toBe(9000);
    expect(current.remainingEnvelopes).toBe(10000);
    expect(current.available).toBe(181000);
    expect(
      current.points
        .find((p) => p.date === "2026-10-20")
        ?.movements.some((m) => m.id === "known:future"),
    ).toBe(true);
    const paid = selectDashboard(s, "2026-10", "", "2026-10-21");
    expect(paid.budgets[0]).toMatchObject({
      spent: 10000,
      committed: 0,
      remaining: 10000,
    });
    expect(paid.balance).toBe(191000);
    expect(paid.available).toBe(current.available);
    s.transactions.push(tx("planned-income", "2026-11-20", 30000));
    const future = selectDashboard(s, "2026-11", "", "2026-10-05");
    expect(future.rows).toEqual([]);
    expect(future.income).toBe(0);
    expect(
      future.points.some((p) =>
        p.movements.some((m) => m.id === "known:planned-income"),
      ),
    ).toBe(true);
    const past = selectDashboard(s, "2026-10", "", "2026-11-05");
    expect(past.spending).toBe(10000);
  });
  it("compare une dépense au même compte et à l’historique antérieur, jamais aux autres comptes ou aux mois futurs", () => {
    const s = fixture();
    s.transactions = [
      tx("A-before", "2026-07-01", -20000),
      tx("B-before", "2026-07-01", -300000, "B"),
      tx("A-selected", "2026-08-03", -20000),
      tx("A-later", "2026-09-01", -900000),
      tx("A-future", "2026-10-20", -999999),
    ];
    const historical = unusualExpenses(
      s,
      "A",
      "2026-08",
      "2026-08",
      "2026-10-05",
    );
    expect(historical.rows.map((t) => t.id)).toEqual(["A-selected"]);
    expect(historical.history.months).toEqual(["2026-07"]);
    expect(historical.history.categories[0].average).toBe(20000);
    expect(
      unusualExpenses(s, "", "2026-08", "2026-08", "2026-10-05").rows,
    ).toEqual([]);
    expect(
      unusualExpenses(s, "A", "2026-11", "2026-11", "2026-10-05").rows,
    ).toEqual([]);
    const insufficient = unusualExpenses(
      s,
      "A",
      "2026-07",
      "2026-07",
      "2026-10-05",
    );
    expect(insufficient.history.months).toEqual([]);
    expect(insufficient.unassessedCount).toBe(1);
    expect(insufficient.rows).toEqual([]);
  });
});
