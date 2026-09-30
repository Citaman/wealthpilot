import { describe, expect, it } from "vitest";
import {
  buildCashPlan,
  calculateSafeToSpendThisWeek,
  calculateWeekActual,
  getCashPlanConfigurationStatus,
  type CashPlanAssumptions,
} from "../cash-plan";

const base: CashPlanAssumptions = {
  startDate: "2026-09-29",
  weeks: 13,
  startingBalance: 1521.11,
  scenario: "cautious",
  incomeSources: [
    {
      id: "anthonny",
      name: "Anthonny salary",
      dayOfMonth: 25,
      amounts: { cautious: 3690.24, realistic: 3750, recovery: 3888.92 },
    },
    {
      id: "mirane",
      name: "Mirane salary estimate",
      dayOfMonth: 28,
      startDate: "2026-09-02",
      amounts: { cautious: 1900, realistic: 1950, recovery: 2000 },
    },
    {
      id: "caf",
      name: "CAF",
      dayOfMonth: 5,
      amounts: { cautious: 711.03, realistic: 711.03, recovery: 711.03 },
    },
  ],
  weeklyNeeds: 500,
  weeklyWants: 100,
  monthlyFixedCosts: 800,
  fixedCostDay: 1,
  taxAdjustmentAmount: 854,
  taxAdjustmentDay: 25,
  taxPaymentsRemaining: 3,
  targetEndBalance: 0,
  safetyFloor: -800,
};

describe("13-week household cash plan", () => {
  it("uses three remaining tax adjustments and monthly household income", () => {
    const result = buildCashPlan(base);

    expect(result.weeks).toHaveLength(13);
    expect(result.weeks.reduce((sum, week) => sum + week.tax, 0)).toBe(2562);
    expect(result.weeks.reduce((sum, week) => sum + week.income, 0)).toBeCloseTo(
      3 * (3690.24 + 1900 + 711.03),
      2
    );
    expect(result.weeks[0].openingBalance).toBe(1521.11);
    expect(result.weeks.at(-1)?.closingBalance).toBe(result.endingBalance);
  });

  it("keeps monetary arithmetic exact and exposes the weekly recovery gap", () => {
    const result = buildCashPlan({ ...base, startingBalance: -1900, targetEndBalance: 0 });

    expect(Number.isInteger(Math.round(result.endingBalance * 100))).toBe(true);
    expect(result.requiredWeeklyImprovement).toBe(
      Math.ceil(Math.max(0, -result.endingBalance * 100) / 13) / 100
    );
  });

  it("changes salary assumptions by scenario without changing the starting balance", () => {
    const cautious = buildCashPlan(base);
    const realistic = buildCashPlan({ ...base, scenario: "realistic" });

    expect(realistic.weeks[0].openingBalance).toBe(cautious.weeks[0].openingBalance);
    expect(realistic.endingBalance).toBeGreaterThan(cautious.endingBalance);
  });

  it("detects an intra-week overdraft even when a later salary makes the week positive", () => {
    const result = buildCashPlan({
      ...base,
      startDate: "2026-10-19",
      weeks: 1,
      startingBalance: 100,
      weeklyNeeds: 0,
      weeklyWants: 0,
      monthlyFixedCosts: 0,
      taxAdjustmentAmount: 854,
      taxAdjustmentDay: 20,
      taxPaymentsRemaining: 1,
      incomeSources: [{
        id: "salary",
        name: "Salary",
        dayOfMonth: 25,
        amounts: { cautious: 1_000, realistic: 1_000, recovery: 1_000 },
      }],
    });

    expect(result.endingBalance).toBe(246);
    expect(result.lowestBalance).toBe(-754);
    expect(result.firstBelowFloorWeek).toBeNull();
    expect(result.weeks[0].lowestBalance).toBe(-754);
  });

  it("refuses to call an unconfirmed zero target a successful plan", () => {
    expect(getCashPlanConfigurationStatus({ balanceConfirmed: true, targetConfirmed: false, floorConfirmed: true }))
      .toEqual({ isReady: false, missing: ["target"] });
  });

  it("compares planned envelopes with actual spending without counting transfers", () => {
    expect(calculateWeekActual({ needs: 300, wants: 100 }, [
      { direction: "debit", amount: 125, category: "Food" },
      { direction: "debit", amount: 500, category: "Transfers" },
      { direction: "credit", amount: 200, category: "Income" },
    ])).toEqual({ income: 200, spending: 125, net: 75, remainingEnvelope: 275 });
  });

  it("caps the weekly safe-to-spend at the envelope and protects the floor", () => {
    expect(calculateSafeToSpendThisWeek({
      openingBalance: -700,
      income: 0,
      fixedCosts: 50,
      tax: 0,
      needs: 300,
      wants: 100,
    }, -800)).toBe(50);
  });
});
