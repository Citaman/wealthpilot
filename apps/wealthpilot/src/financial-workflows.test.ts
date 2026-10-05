import { budgetCalendar, budgetCycle } from "./periods";
import { describe, it, expect } from "vitest";
import { financialView } from "./financialView";
import { selectDashboard } from "./domain";
import { withEstimates } from "./intelligence";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";

function fixture(): Snapshot {
  const transaction = (
    id: string,
    date: string,
    amount: number,
    account: string,
    merchant: string,
  ): Transaction => ({
    id,
    date,
    amount,
    account,
    merchant,
    label: merchant,
    category: amount > 0 ? "Revenus" : "Courses",
    internal: false,
    batchId: "fixture",
    fingerprint: id,
    raw: {},
  });
  return {
    ...structuredClone(emptySnapshot),
    accounts: [
      { id: "A", checkpoint: { date: "2026-10-04", amount: 200000 } },
      { id: "B", checkpoint: { date: "2026-10-04", amount: 100000 } },
    ],
    transactions: [
      ...["07", "08", "09"].flatMap((m) => [
        transaction(
          "salary" + m,
          `2026-${m}-26`,
          200000,
          "A",
          "Employeur Alpha",
        ),
        transaction("aid" + m, `2026-${m}-05`, 40000, "B", "Caisse Beta"),
      ]),
      transaction("purchase", "2026-10-02", -1200, "A", "Épicerie"),
    ],
    budgets: [
      { id: "food", month: "2026-10", category: "Courses", amount: 20000 },
      { id: "fun", month: "2026-10", category: "Loisirs", amount: 10000 },
    ],
    dues: [
      {
        id: "rent",
        date: "2026-10-12",
        amount: -80000,
        account: "A",
        label: "Loyer",
        category: "Logement",
      },
    ],
  };
}
describe("Contrat du calcul partagé entre cartes", () => {
  it("réutilise les mêmes calculs après présentation, mais propage ordre, préférences et lots actuels", () => {
    const s = fixture(),
      first = financialView(s, "2026-10", "", "2026-08", "2026-10-04");
    const edited = {
      ...s,
      batches: [
        {
          id: "new",
          name: "Latest",
          hash: "h",
          createdAt: "2026-10-04",
          count: 0,
          minDate: "",
          maxDate: "",
        },
      ],
      preferences: {
        ...s.preferences,
        tones: { chart: "ink" as const },
        budgetOrder: ["Loisirs", "Courses"],
        budgetLimit: 1,
        widgetViews: { budgets: "rings" as const },
      },
    };
    const next = financialView(edited, "2026-10", "", "2026-08", "2026-10-04");
    expect(next.dashboard.points).toBe(first.dashboard.points);
    expect(next.projected.dues).toBe(first.projected.dues);
    expect(next.projected.preferences).toBe(edited.preferences);
    expect(next.projected.batches).toBe(edited.batches);
    expect(next.dashboard.budgets.map((b) => b.category)).toEqual([
      "Loisirs",
      "Courses",
    ]);
    expect(first.dashboard.budgets.map((b) => b.category)).toEqual([
      "Courses",
      "Loisirs",
    ]);
    const scoped = financialView(
      edited,
      "2026-10",
      "B",
      "2026-08",
      "2026-10-04",
    );
    expect(scoped.dashboard.balance).toBe(100000);
    expect(scoped.dashboard.tx.every((t) => t.account === "B")).toBe(true);
    expect(scoped.dashboard.available).toBeNull();
    expect(
      financialView(edited, "2026-10", "", "2026-08", "2026-10-04").dashboard
        .points,
    ).toBe(first.dashboard.points);
  });
  it("invalide chaque fait financier au fil des corrections et reste identique au calcul sans cache", () => {
    let s = fixture();
    const verify = (
      next: Snapshot,
      asOf = "2026-10-04",
      from = "2026-08",
      account = "",
    ) => {
      const actual = financialView(next, "2026-10", account, from, asOf);
      const projected = withEstimates(
        next,
        budgetCycle("2026-10", budgetCalendar(next.transactions, asOf)).to,
        asOf,
      );
      expect(actual.dashboard).toEqual(
        selectDashboard(projected, "2026-10", account, asOf, from),
      );
      expect(actual.projected.dues).toEqual(projected.dues);
      s = next;
      return actual;
    };
    verify(s);
    // Each immutable update retains all unrelated identities: omitting that field
    // from the cache contract would produce a stale value in this same workflow.
    verify({ ...s, preferences: { ...s.preferences, safety: 15000 } });
    verify({ ...s, preferences: { ...s.preferences, essentials: 9000 } });
    verify({ ...s, preferences: { ...s.preferences, weekly: 12000 } });
    verify({
      ...s,
      preferences: {
        ...s.preferences,
        goal: { name: "Maison", target: 500000, saved: 25000 },
      },
    });
    verify({
      ...s,
      preferences: {
        ...s.preferences,
        extraGoals: [
          { name: "Ordinateur", target: 120000, saved: 5000, account: "B" },
        ],
      },
    });
    verify(s, "2026-10-04", "2026-08", "B");
    verify(
      {
        ...s,
        preferences: {
          ...s.preferences,
          weeklyPlans: [
            {
              start: "2026-09-28",
              account: "B",
              reserve: 3000,
              reduction: 0,
              limits: { Courses: 4000 },
            },
          ],
        },
      },
      "2026-10-04",
      "2026-08",
      "B",
    );
    verify({
      ...s,
      transactions: s.transactions.map((t) =>
        t.id === "purchase" ? { ...t, amount: -7500, category: "Loisirs" } : t,
      ),
    });
    verify({
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === "A"
          ? { ...a, checkpoint: { date: "2026-10-04", amount: 250000 } }
          : a,
      ),
    });
    verify({
      ...s,
      accounts: s.accounts.map((a) => ({
        ...a,
        coverage: [
          {
            from: "2026-07-01",
            through: "2026-10-04",
            complete: true,
            batchId: "fixture",
            sourceHash: "fixture",
          },
        ],
      })),
    });
    verify({
      ...s,
      budgets: s.budgets.map((b) =>
        b.id === "food" ? { ...b, amount: 30000 } : b,
      ),
    });
    verify({
      ...s,
      dues: s.dues.map((d) => ({ ...d, amount: -75000, date: "2026-10-10" })),
    });
    verify({
      ...s,
      preferences: {
        ...s.preferences,
        recurrenceRules: [
          {
            id: "manual",
            name: "Revenu confirmé",
            account: "B",
            amount: 10000,
            category: "Revenus",
            frequency: "monthly",
            next: "2026-10-15",
          },
        ],
      },
    });
    const estimate = withEstimates(s, "2026-10-31", "2026-10-04").dues.find(
      (d) => d.estimated,
    )!;
    verify({
      ...s,
      preferences: { ...s.preferences, ignoredOccurrences: [estimate.id] },
    });
    const remaining = withEstimates(s, "2026-10-31", "2026-10-04").dues.find(
      (d) => d.estimated && !d.recurrenceConfirmed,
    )!;
    verify({
      ...s,
      preferences: {
        ...s.preferences,
        dismissedRecurrences: [remaining.recurrenceKey!],
      },
    });
    verify(s, "2026-10-05");
    verify(s, "2026-10-05", "2026-10", "B");
  });
});
