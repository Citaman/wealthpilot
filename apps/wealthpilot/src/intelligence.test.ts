import { describe, it, expect } from "vitest";
import {
  detectRecurrences,
  estimatedDues,
  withEstimates,
  suggestBudgets,
  readLegacyPlan,
  allGoals,
  monthRange,
  sizesFor,
} from "./intelligence";
import { selectDashboard } from "./domain";
import { emptySnapshot, widgetNames, type Transaction } from "./types";
const tx = (
  date: string,
  amount = -5000,
  patch: Partial<Transaction> = {},
): Transaction => ({
  id: date,
  batchId: "b",
  date,
  amount,
  merchant: "Spotify",
  label: "Prélèvement Spotify",
  account: "A",
  category: "Abonnements",
  internal: false,
  raw: {},
  fingerprint: "",
  ...patch,
});
const s = () => structuredClone(emptySnapshot);
const monthly = () => [tx("2026-07-15"), tx("2026-08-15"), tx("2026-09-15")];
describe("Récurrences et prévisions", () => {
  it("détecte une cadence mensuelle avec montant signé et niveau de signal", () => {
    const r = detectRecurrences(monthly(), "2026-10-03");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      next: "2026-10-15",
      amount: -5000,
      count: 3,
      frequency: "monthly",
      confidence: 70,
    });
  });
  it("refuse un magasin irrégulier, un virement interne et deux occurrences seulement", () => {
    expect(
      detectRecurrences(
        [tx("2026-07-02"), tx("2026-08-15"), tx("2026-09-22")],
        "2026-10-03",
      ),
    ).toEqual([]);
    expect(
      detectRecurrences(
        monthly().map((t) => ({ ...t, internal: true })),
        "2026-10-03",
      ),
    ).toEqual([]);
    expect(detectRecurrences(monthly().slice(1), "2026-10-03")).toEqual([]);
  });
  it("ne mélange pas les comptes ni les débits et crédits", () => {
    expect(
      detectRecurrences(
        [
          tx("2026-07-15"),
          tx("2026-08-15", 5000),
          tx("2026-09-15", -5000, { account: "B" }),
        ],
        "2026-10-03",
      ),
    ).toEqual([]);
  });
  it("abandonne les abonnements anciens et les montants trop variables", () => {
    expect(detectRecurrences(monthly(), "2027-03-03")).toEqual([]);
    expect(
      detectRecurrences(
        [tx("2026-07-15"), tx("2026-08-15", -25000), tx("2026-09-15")],
        "2026-10-03",
      ),
    ).toEqual([]);
  });
  it("ajuste les fins de mois et déroule plusieurs occurrences futures", () => {
    const a = s();
    a.transactions = [tx("2026-07-31"), tx("2026-08-31"), tx("2026-09-30")];
    const events = estimatedDues(a, "2026-12-31", "2026-10-03");
    expect(events.map((e) => e.date)).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });
  it("déroule une cadence hebdomadaire", () => {
    const a = s();
    a.transactions = [tx("2026-09-17"), tx("2026-09-24"), tx("2026-10-01")];
    expect(
      estimatedDues(a, "2026-10-22", "2026-10-03").map((e) => e.date),
    ).toEqual(["2026-10-08", "2026-10-15", "2026-10-22"]);
  });
  it("ne double pas une échéance manuelle et garde une exclusion persistante", () => {
    const a = s();
    a.transactions = monthly();
    a.dues = [
      {
        id: "d",
        account: "A",
        date: "2026-10-15",
        label: "Spotify",
        amount: -5000,
      },
    ];
    expect(estimatedDues(a, "2026-10-31", "2026-10-03")).toEqual([]);
    a.dues = [];
    a.preferences.dismissedRecurrences = [
      detectRecurrences(a.transactions, "2026-10-03")[0].key,
    ];
    expect(estimatedDues(a, "2026-10-31", "2026-10-03")).toEqual([]);
  });
  it("remplace le prévu par un réalisé et conserve les opérations originales", () => {
    const a = s();
    a.transactions = monthly();
    const first = withEstimates(a, "2026-10-31", "2026-10-03");
    expect(first.dues).toHaveLength(1);
    expect(a.dues).toEqual([]);
    a.transactions.push(tx("2026-10-15"));
    expect(estimatedDues(a, "2026-10-31", "2026-10-16")).toEqual([]);
  });
});
describe("Plan et périodes", () => {
  it("exclut le mois incomplet et propose une répartition en centimes limitée par la capacité", () => {
    const a = s();
    a.transactions = [
      tx("2026-09-01", 100000, { merchant: "Salaire" }),
      tx("2026-09-05", -80000, { category: "Courses" }),
      tx("2026-09-08", -40000, { category: "Sorties" }),
      tx("2026-10-01", 100000, { merchant: "Salaire" }),
      tx("2026-10-01", -999900),
    ];
    a.preferences.goal = {
      name: "iPhone",
      target: 150000,
      saved: 0,
      monthly: 20000,
    };
    const plan = suggestBudgets(a, 50000, "2026-10-03");
    expect(plan.months).toEqual(["2026-09"]);
    expect(plan.income).toBe(100000);
    expect(plan.categories.reduce((n, c) => n + c.proposed, 0)).toBe(80000);
    expect(plan.known).toBe(false);
  });
  it("compte tous les projets comme réserves, sans modifier le cash", () => {
    const a = s();
    a.accounts = [
      { id: "A", checkpoint: { date: "2026-10-03", amount: 200000 } },
    ];
    a.preferences.goal = { name: "iPhone", target: 100000, saved: 20000 };
    a.preferences.extraGoals = [
      { name: "Maison", target: 10000000, saved: 50000 },
    ];
    const d = selectDashboard(a, "2026-10", "", "2026-10-03");
    expect(d.balance).toBe(200000);
    expect(d.available).toBe(130000);
    expect(allGoals(a)).toHaveLength(2);
  });
  it("cumule les flux et les budgets sur plusieurs mois sans additionner les soldes", () => {
    const a = s();
    a.accounts = [
      { id: "A", checkpoint: { date: "2026-10-03", amount: 200000 } },
    ];
    a.transactions = [
      tx("2026-08-05", -10000, { category: "Courses" }),
      tx("2026-09-05", -20000, { category: "Courses" }),
    ];
    a.budgets = [
      { id: "b1", month: "2026-08", category: "Courses", amount: 30000 },
      { id: "b2", month: "2026-09", category: "Courses", amount: 30000 },
    ];
    const d = selectDashboard(a, "2026-09", "", "2026-10-03", "2026-08");
    expect(d.spending).toBe(30000);
    expect(d.budgets[0]).toMatchObject({ amount: 60000, spent: 30000 });
    expect(d.balance).toBe(200000);
    expect(d.points).toHaveLength(61);
  });
  it("ne compare pas des dépenses sans enveloppe à un autre mois budgété", () => {
    const a = s();
    a.transactions = [
      tx("2026-08-05", -10000, { category: "Courses" }),
      tx("2026-09-05", -20000, { category: "Courses" }),
    ];
    a.budgets = [
      { id: "b", month: "2026-09", category: "Courses", amount: 30000 },
    ];
    const d = selectDashboard(a, "2026-09", "", "2026-10-03", "2026-08");
    expect(d.spending).toBe(30000);
    expect(d.budgets[0]).toMatchObject({ amount: 30000, spent: 20000 });
  });
  it("protège les enveloppes restantes, sans compter deux fois les récurrences", () => {
    const a = s();
    a.accounts = [
      { id: "A", checkpoint: { date: "2026-10-03", amount: 200000 } },
    ];
    a.transactions = [tx("2026-10-02", -10000, { category: "Courses" })];
    a.budgets = [
      { id: "b", month: "2026-10", category: "Courses", amount: 60000 },
    ];
    a.dues = [
      {
        id: "d",
        account: "A",
        date: "2026-10-15",
        label: "Courses régulières",
        amount: -20000,
        category: "Courses",
      },
    ];
    const d = selectDashboard(a, "2026-10", "", "2026-10-03");
    expect(d.essentials).toBe(30000);
    expect(d.obligations).toBe(20000);
    expect(d.available).toBe(150000);
    expect(d.points.at(-1)?.value).toBe(150000);
    expect(d.weekly).not.toBeNull();
  });
  it("importe les euros historiques et refuse les montants invalides", () => {
    const v = {
      meta: { formatVersion: 1 },
      tables: {
        goals: [
          {
            name: "Maison",
            targetAmount: 5000,
            currentAmount: 1000,
            isActive: true,
          },
        ],
        budgets: [
          {
            category: "Courses",
            amount: 700,
            period: "monthly",
            year: 2026,
            month: 10,
          },
        ],
      },
    };
    expect(readLegacyPlan(v)).toMatchObject({
      goals: [{ target: 500000, saved: 100000 }],
      budgets: [{ amount: 70000, month: "2026-10" }],
    });
    expect(() =>
      readLegacyPlan({
        ...v,
        tables: { ...v.tables, goals: [{ name: "X", targetAmount: NaN }] },
      }),
    ).toThrow();
  });
  it("propose exactement trente blocs avec des tailles explicites et des périodes bornées", () => {
    expect(Object.keys(widgetNames)).toHaveLength(30);
    expect(sizesFor("chart")).toEqual(["medium", "large", "xlarge"]);
    expect(monthRange("2026-08", "2026-10")).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });
});
