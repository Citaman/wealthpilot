import { describe, it, expect } from "vitest";
import { balanceAt, selectDashboard, weekStart, monthEnd } from "./domain";
import { emptySnapshot, type Transaction, type Snapshot } from "./types";
const tx = (patch: Partial<Transaction>): Transaction => ({
  id: "t",
  date: "2026-10-02",
  amount: -1000,
  account: "a",
  batchId: "b",
  category: "Courses",
  merchant: "Shop",
  label: "Shop",
  internal: false,
  fingerprint: "",
  raw: {},
  ...patch,
});
const state = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "a", checkpoint: { date: "2026-10-01", amount: 100000 } }],
});
describe("Parcours financiers du foyer", () => {
  it("passe de soldes inconnus à un ancrage daté, reconstruit les deux directions et refuse un foyer incomplet", () => {
    const rows = [
      tx({ date: "2026-10-02", amount: -2000 }),
      tx({ id: "credit", date: "2026-10-03", amount: 500 }),
    ];
    expect(balanceAt({ id: "a" }, rows, "2026-10-02")).toBeNull();
    const account = {
      id: "a",
      checkpoint: { date: "2026-10-02", amount: 10000 },
    };
    expect(
      ["2026-10-01", "2026-10-02", "2026-10-03"].map((d) =>
        balanceAt(account, rows, d),
      ),
    ).toEqual([12000, 10000, 10500]);
    const s = state();
    s.accounts = [account];
    s.transactions = rows;
    expect(selectDashboard(s, "2026-10", "", "2026-10-03").balance).toBe(10500);
    s.accounts.push({ id: "b" });
    expect(selectDashboard(s, "2026-10", "", "2026-10-03").balance).toBeNull();
    expect(selectDashboard(s, "2026-10", "a", "2026-10-03").balance).toBe(
      10500,
    );
  });
  it("sépare cash, virements, charges, réserves puis rapproche un paiement sans déduction double", () => {
    const s = state();
    s.preferences = {
      ...s.preferences,
      safety: 10000,
      essentials: 5000,
      goal: { name: "Projet", target: 50000, saved: 20000 },
    };
    s.transactions = [
      tx({ id: "transfer", internal: true, amount: -20000 }),
      tx({ amount: -5000 }),
    ];
    s.dues = [
      {
        id: "rent",
        date: "2026-10-18",
        amount: -15000,
        account: "a",
        label: "Loyer",
      },
    ];
    let d = selectDashboard(s, "2026-10", "", "2026-10-02");
    expect({
      cash: d.balance,
      spending: d.spending,
      available: d.available,
      low: d.low?.value,
    }).toEqual({ cash: 75000, spending: 5000, available: 25000, low: 55000 });
    s.transactions.push(
      tx({ id: "rent-paid", date: "2026-10-18", amount: -15000 }),
    );
    s.dues[0].transactionId = "rent-paid";
    d = selectDashboard(s, "2026-10", "", "2026-10-18");
    expect({
      cash: d.balance,
      obligations: d.obligations,
      available: d.available,
    }).toEqual({ cash: 60000, obligations: 0, available: 25000 });
    expect(d.spending).toBe(20000);
  });
  it("gère semaine réelle, salaire attendu et impayé sans transformer prévisions en cash", () => {
    const s = state();
    s.preferences.weekly = 40000;
    s.transactions = [tx({ amount: -11000 })];
    s.dues = [
      {
        id: "salary",
        date: "2026-10-15",
        amount: 250000,
        account: "a",
        label: "Salaire",
      },
      {
        id: "late",
        date: "2026-09-30",
        amount: -2000,
        account: "a",
        label: "Retard",
      },
    ];
    const d = selectDashboard(s, "2026-10", "", "2026-10-02");
    expect(d.balance).toBe(89000);
    expect(d.available).toBe(87000);
    expect(d.weekly).toBe(27000);
    expect(d.overdue.map((v) => v.id)).toEqual(["late"]);
    expect(d.points.at(-1)?.value).toBe(339000);
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(monthEnd("2024-02")).toBe("2024-02-29");
  });
});
