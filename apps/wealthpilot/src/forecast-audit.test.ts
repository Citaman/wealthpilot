import { describe, it, expect } from "vitest";
import { forecastCash, weeklyPlan, simulatePurchase } from "./forecasting";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";
const base = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } }],
});
const tx = (date: string, amount: number, category = "Food"): Transaction => ({
  id: date + amount,
  batchId: "b",
  date,
  amount,
  account: "A",
  category,
  label: "Fixture",
  merchant: "Fixture",
  internal: false,
  raw: {},
  fingerprint: "test",
});
describe("Independent financial forecast acceptance", () => {
  it("does not invent amount dispersion for an explicitly confirmed fixed recurrence", () => {
    const s = base();
    s.preferences.recurrenceRules = [
      {
        id: "fixed",
        name: "Fixed subscription",
        account: "A",
        amount: -10000,
        category: "Bills",
        frequency: "monthly",
        next: "2026-10-06",
      },
    ];
    const run = forecastCash(s, "2026-10-07", "A", "2026-10-04");
    expect(run.points.at(-1)).toMatchObject({
      value: 90000,
      lower: 90000,
      upper: 90000,
    });
  });
  it("keeps future internal transfers in cash but out of monthly and weekly consumption", () => {
    const s = base();
    s.accounts.push({
      id: "B",
      checkpoint: { date: "2026-10-04", amount: 10000 },
    });
    s.transactions = [
      { ...tx("2026-10-06", -5000), internal: true },
      { ...tx("2026-10-06", 5000), account: "B", internal: true },
    ];
    s.budgets = [
      { id: "g", month: "2026-10", category: "Food", amount: 10000 },
      {
        id: "a",
        month: "2026-10",
        category: "Food",
        amount: 6000,
        account: "A",
      },
    ];
    const household = forecastCash(s, "2026-10-31", "", "2026-10-04");
    expect(household.variable.get("2026-10")).toBe(10000);
    expect(household.points.at(-1)!.value).toBe(100000);
    const payer = forecastCash(s, "2026-10-31", "A", "2026-10-04");
    expect(payer.variable.get("2026-10")).toBe(6000);
    expect(payer.points.at(-1)!.value).toBe(89000);
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").committed).toBe(0);
  });
  it("keeps a scoped allocation under the shared envelope after another payer spends", () => {
    const s = base();
    s.accounts.push({
      id: "B",
      checkpoint: { date: "2026-10-04", amount: 50000 },
    });
    s.budgets = [
      { id: "g", month: "2026-10", category: "Food", amount: 10000 },
      {
        id: "a",
        month: "2026-10",
        category: "Food",
        amount: 6000,
        account: "A",
      },
    ];
    s.transactions = [{ ...tx("2026-10-02", -9000), account: "B" }];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 5000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").rows[0].limit).toBe(
      1000,
    );
  });
  it("never allocates rounding residue into an explicitly zero category", () => {
    const s = base();
    s.accounts[0].checkpoint!.amount = 1;
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { A: 1, B: 1, Z: 0 },
        reserve: 0,
        reduction: 0,
      },
    ];
    const plan = weeklyPlan(s, "2026-10-05", "A", "2026-10-04");
    expect(plan.remaining).toBe(1);
    expect(plan.rows.find((r) => r.category === "Z")!.limit).toBe(0);
    expect(plan.rows.every((r) => r.limit <= r.desired)).toBe(true);
  });
  it("caps weekly proposals at the remaining monthly envelope after all commitments", () => {
    const s = base();
    s.budgets = [
      {
        id: "b",
        month: "2026-10",
        category: "Food",
        account: "A",
        amount: 10000,
      },
    ];
    s.transactions = [tx("2026-10-02", -8000)];
    s.dues = [
      {
        id: "future",
        account: "A",
        date: "2026-10-20",
        amount: -500,
        label: "Booked food",
        category: "Food",
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 8000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").rows[0].limit).toBe(
      1500,
    );
  });
  it("does not borrow a November envelope for the October part of an intermonth week", () => {
    const s = base();
    s.budgets = [
      {
        id: "oct",
        month: "2026-10",
        category: "Food",
        account: "A",
        amount: 0,
      },
      {
        id: "nov",
        month: "2026-11",
        category: "Food",
        account: "A",
        amount: 10000,
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-26",
        account: "A",
        limits: { Food: 7000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    expect(weeklyPlan(s, "2026-10-26", "A", "2026-10-25").rows[0].limit).toBe(
      1000,
    );
  });
  it("uses the chronological low instead of subtracting charges occurring after funded salary", () => {
    const s = base();
    s.accounts[0].checkpoint!.amount = 50000;
    s.dues = [
      {
        id: "pay",
        account: "A",
        date: "2026-10-09",
        amount: 100000,
        label: "Pay",
      },
      {
        id: "rent",
        account: "A",
        date: "2026-10-10",
        amount: -70000,
        label: "Rent",
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 20000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").capacity).toBe(50000);
    s.dues[0].date = "2026-10-12";
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").capacity).toBe(0);
  });
  it("consumes nested account and household provision once for an included purchase", () => {
    const s = base();
    s.budgets = [
      { id: "g", month: "2026-10", category: "Food", amount: 10000 },
      {
        id: "a",
        month: "2026-10",
        category: "Food",
        amount: 6000,
        account: "A",
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 5000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    const run = simulatePurchase(
      s,
      {
        date: "2026-10-06",
        account: "A",
        amount: 5000,
        category: "Food",
        included: true,
      },
      "2026-10-04",
    );
    expect(run.after.points.at(-1)!.value).toBe(
      run.before.points.at(-1)!.value,
    );
    expect(run.householdAfter.points.at(-1)!.value).toBe(
      run.householdBefore.points.at(-1)!.value,
    );
  });
  it("computes the frozen October5–11 path, positive salary and delayed salary", () => {
    const s = base();
    s.dues = [
      {
        id: "rent",
        account: "A",
        date: "2026-10-06",
        amount: -30000,
        label: "Charge",
      },
      {
        id: "pay",
        account: "A",
        date: "2026-10-09",
        amount: 50000,
        label: "Salary",
      },
      {
        id: "shop",
        account: "A",
        date: "2026-10-10",
        amount: -10000,
        label: "Food",
      },
    ];
    const run = forecastCash(s, "2026-10-11", "A", "2026-10-04");
    expect(
      run.points.filter((p) => p.date >= "2026-10-05").map((p) => p.value),
    ).toEqual([100000, 70000, 70000, 70000, 120000, 110000, 110000]);
    s.dues[1].date = "2026-10-12";
    expect(
      forecastCash(s, "2026-10-11", "A", "2026-10-04").points.at(-1)?.value,
    ).toBe(60000);
  });
  it("counts known future transactions exactly once and suppresses linked due", () => {
    const s = base();
    s.transactions = [tx("2026-10-06", -10000)];
    s.dues = [
      {
        id: "d",
        account: "A",
        date: "2026-10-06",
        amount: -10000,
        label: "already imported",
        transactionId: s.transactions[0].id,
      },
    ];
    expect(
      forecastCash(s, "2026-10-07", "A", "2026-10-04").points.at(-1)?.value,
    ).toBe(90000);
  });
  it("uses global category ceiling instead of adding nested account allocations", () => {
    const s = base();
    s.budgets = [
      { id: "g", month: "2026-10", category: "Food", amount: 10000 },
      {
        id: "a",
        month: "2026-10",
        category: "Food",
        amount: 6000,
        account: "A",
      },
    ];
    expect(
      forecastCash(s, "2026-10-31", "", "2026-10-04").variable.get("2026-10"),
    ).toBe(10000);
    expect(
      forecastCash(s, "2026-10-31", "A", "2026-10-04").variable.get("2026-10"),
    ).toBe(6000);
  });
  it("treats reserves as protected capacity, not bank debits", () => {
    const s = base();
    s.preferences.safety = 20000;
    s.preferences.goal = { name: "Goal", target: 30000, saved: 10000 };
    const out = forecastCash(s, "2026-10-11", "", "2026-10-04");
    expect(out.points.at(-1)?.value).toBe(100000);
    expect(out.reserve).toBe(30000);
  });
  it("distinguishes unconfigured, inferred and intentionally confirmed zero plans", () => {
    const s = base();
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").status).toBe(
      "unconfigured",
    );
    s.transactions = [tx("2026-08-03", -3000), tx("2026-08-10", -4000)];
    const inferred = weeklyPlan(s, "2026-10-05", "A", "2026-10-04");
    expect(inferred.status).toBe("estimated");
    expect(inferred.verifiedWeeks).toBe(0);
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 0 },
        reserve: 0,
        reduction: 0,
      },
    ];
    const confirmed = weeklyPlan(s, "2026-10-05", "A", "2026-10-04");
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.remaining).toBe(0);
  });
  it("does not call a hole in statement coverage a verified week", () => {
    const s = base();
    s.transactions = [tx("2026-09-01", -1000), tx("2026-09-25", -1000)];
    s.accounts[0].coverage = [
      {
        from: "2026-09-01",
        through: "2026-09-10",
        sourceHash: "one",
        batchId: "one",
        complete: true,
      },
      {
        from: "2026-09-20",
        through: "2026-10-04",
        sourceHash: "two",
        batchId: "two",
        complete: true,
      },
    ];
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").verifiedWeeks).toBe(
      1,
    );
  });
  it("makes internal transfers cash-neutral for household, but real for each payer", () => {
    const s = base();
    s.accounts.push({
      id: "B",
      checkpoint: { date: "2026-10-04", amount: 10000 },
    });
    s.transactions = [
      { ...tx("2026-10-06", -5000), internal: true },
      { ...tx("2026-10-06", 5000), account: "B", internal: true },
    ];
    expect(
      forecastCash(s, "2026-10-07", "", "2026-10-04").points.at(-1)?.value,
    ).toBe(110000);
    expect(
      forecastCash(s, "2026-10-07", "A", "2026-10-04").points.at(-1)?.value,
    ).toBe(95000);
  });
  it("included shopping replaces only available monthly provision; excess remains a cash reduction", () => {
    const s = base();
    s.transactions = [tx("2026-10-02", -8000)];
    s.budgets = [
      {
        id: "b",
        category: "Food",
        month: "2026-10",
        amount: 10000,
        account: "A",
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Food: 5000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    const run = simulatePurchase(
      s,
      {
        date: "2026-10-06",
        account: "A",
        amount: 5000,
        category: "Food",
        included: true,
      },
      "2026-10-04",
    );
    expect(
      run.after.points.at(-1)!.value - run.before.points.at(-1)!.value,
    ).toBe(-3000);
    const extra = simulatePurchase(
      s,
      {
        date: "2026-10-06",
        account: "A",
        amount: 5000,
        category: "Food",
        included: false,
      },
      "2026-10-04",
    );
    expect(
      extra.after.points.at(-1)!.value - extra.before.points.at(-1)!.value,
    ).toBe(-5000);
  });
});
