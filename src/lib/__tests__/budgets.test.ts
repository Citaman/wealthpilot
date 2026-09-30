import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  DEFAULT_BUDGET_PREFERENCES,
  getBudgetPreferences,
  saveBudgetAmount,
  saveBudgetPreferences,
} from "../budgets";

describe("budget period persistence", () => {
  beforeEach(async () => {
    await db.open();
    await db.budgets.clear();
    await db.settings.clear();
  });

  it("keeps monthly budgets independent and updates only the selected month", async () => {
    await saveBudgetAmount("Food", 500, 2026, 8);
    await saveBudgetAmount("Food", 650, 2026, 9);
    await saveBudgetAmount("Food", 525, 2026, 8);

    const budgets = await db.budgets.where("category").equals("Food").sortBy("month");

    expect(budgets).toHaveLength(2);
    expect(budgets.map(({ month, amount }) => ({ month, amount }))).toEqual([
      { month: 8, amount: 525 },
      { month: 9, amount: 650 },
    ]);
  });

  it("does not mix a yearly budget with a monthly budget", async () => {
    await saveBudgetAmount("Housing", 12_000, 2026);
    await saveBudgetAmount("Housing", 1_000, 2026, 0);

    const budgets = await db.budgets.where("category").equals("Housing").toArray();
    expect(budgets).toHaveLength(2);
    expect(budgets.find((budget) => budget.period === "yearly")?.amount).toBe(12_000);
    expect(budgets.find((budget) => budget.month === 0)?.amount).toBe(1_000);
  });

  it("persists the household budget preferences", async () => {
    await saveBudgetPreferences({
      preset: "custom",
      monthlyIncome: "4200",
      customAllocations: { needs: 65, wants: 20, savings: 15 },
    });

    await expect(getBudgetPreferences()).resolves.toEqual({
      preset: "custom",
      monthlyIncome: "4200",
      customAllocations: { needs: 65, wants: 20, savings: 15 },
    });
  });

  it("falls back to safe defaults when preferences are absent", async () => {
    await expect(getBudgetPreferences()).resolves.toEqual(DEFAULT_BUDGET_PREFERENCES);
  });
});
