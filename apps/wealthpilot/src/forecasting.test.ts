import { describe, expect, it } from "vitest";
import { forecastCash, weeklyPlan, simulatePurchase } from "./forecasting";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";
import { selectDashboard } from "./domain";
import { withEstimates } from "./intelligence";

const fixture = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A", checkpoint: { date: "2026-10-02", amount: 100000 } }],
  dues: [
    {
      id: "charge",
      account: "A",
      label: "Charge",
      date: "2026-10-06",
      amount: -30000,
    },
    {
      id: "pay",
      account: "A",
      label: "Salaire",
      date: "2026-10-09",
      amount: 50000,
    },
    {
      id: "food",
      account: "A",
      label: "Courses",
      date: "2026-10-10",
      amount: -10000,
      category: "Courses",
    },
  ],
});
const tx = (
  id: string,
  date: string,
  amount: number,
  category = "Courses",
): Transaction => ({
  id,
  date,
  amount,
  category,
  merchant: category,
  label: category,
  account: "A",
  batchId: "fixture",
  fingerprint: id,
  internal: false,
  raw: {},
});
describe("cash forecast contracts", () => {
  it("reproduces the dated daily fixture without turning a reserve into a debit", () => {
    const s = fixture();
    s.preferences.safety = 20000;
    const f = forecastCash(s, "2026-10-11", "", "2026-10-04");
    expect(f.points.slice(1).map((p) => p.value)).toEqual([
      100000, 70000, 70000, 70000, 120000, 110000, 110000,
    ]);
    expect(f.low).toMatchObject({ date: "2026-10-06", value: 70000 });
    expect(f.reserve).toBe(20000);
    expect(f.warnings.join()).toContain("2026-10-02");
    s.dues[1].date = "2026-10-12";
    expect(
      forecastCash(s, "2026-10-11", "", "2026-10-04").points.at(-1)?.value,
    ).toBe(60000);
  });
  it("credits salary on 26 then debits 28, not before the salary", () => {
    const s = fixture();
    s.dues = [
      { ...s.dues[1], date: "2026-10-26" },
      { ...s.dues[0], date: "2026-10-28" },
    ];
    const f = forecastCash(s, "2026-10-31", "A", "2026-10-04");
    expect(f.points.find((p) => p.date === "2026-10-25")?.value).toBe(100000);
    expect(f.points.find((p) => p.date === "2026-10-26")?.value).toBe(150000);
    expect(f.points.at(-1)?.value).toBe(120000);
  });
  it("100 budget minus 20 spent minus 30 committed leaves 50 free, counted once", () => {
    const s = fixture();
    s.transactions = [tx("food", "2026-10-01", -2000)];
    s.budgets = [
      { id: "b", month: "2026-10", category: "Courses", amount: 10000 },
    ];
    s.dues = [{ ...s.dues[2], amount: -3000 }];
    const f = forecastCash(s, "2026-10-31", "", "2026-10-04");
    expect(f.variable.get("2026-10")).toBe(5000);
    expect(f.points.at(-1)?.value).toBe(92000);
    s.dues[0].transactionId = "paid";
    s.transactions.push(tx("paid", "2026-10-03", -3000));
    expect(
      forecastCash(s, "2026-10-31", "", "2026-10-04").points.at(-1)?.value,
    ).toBe(92000);
  });
  it("known balances do not change when the chart window changes", () => {
    const s = fixture();
    s.transactions = [
      tx("t1", "2026-09-20", -2000),
      tx("t2", "2026-10-01", -5000),
    ];
    const a = selectDashboard(s, "2026-10", "A", "2026-10-04", "2026-10");
    const b = selectDashboard(s, "2026-10", "A", "2026-10-04", "2026-08");
    expect(a.points[0].value).toBe(
      b.points.find((p) => p.date === "2026-10-01")?.value,
    );
  });
  it("estimated occurrences remain unique even when projections are passed twice", () => {
    const s = fixture();
    s.transactions = ["07", "08", "09"].map((m, i) =>
      tx(String(i), `2026-${m}-26`, 250000, "Salaire"),
    );
    const once = withEstimates(s, "2026-10-31", "2026-10-04"),
      twice = withEstimates(once, "2026-10-31", "2026-10-04");
    expect(twice.dues).toEqual(once.dues);
    expect(
      once.dues.some(
        (d) => d.estimated && d.amount > 0 && d.date === "2026-10-26",
      ),
    ).toBe(true);
  });
  it("weekly category caps share one capacity, under individual account scope", () => {
    const s = fixture();
    s.accounts.push({
      id: "B",
      checkpoint: { date: "2026-10-04", amount: 900000 },
    });
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        reserve: 0,
        reduction: 0,
        limits: { Courses: 60000, Shopping: 60000 },
      },
    ];
    const plan = weeklyPlan(s, "2026-10-05", "A", "2026-10-04");
    expect(plan.remaining).toBeLessThanOrEqual(plan.capacity!);
    // 1000 -> 700 after the charge, then 1200 salary and 1100 after food.
    // The chronological low is 700; B's 9000 never funds account A's cap.
    expect(plan.capacity).toBe(70000);
    expect(plan.forecast.low).toMatchObject({
      date: "2026-10-06",
      value: 70000,
    });
    expect(plan.rows.reduce((n, r) => n + r.limit, 0)).toBe(plan.remaining);
  });
  it("today's simulated purchase changes today, writes nothing", () => {
    const s = fixture(),
      copy = structuredClone(s);
    const r = simulatePurchase(
      s,
      {
        amount: 3500,
        date: "2026-10-04",
        category: "Courses",
        account: "A",
        included: false,
      },
      "2026-10-04",
    );
    expect(r.after.points[0].value).toBe(96500);
    expect(s).toEqual(copy);
  });
  it("cross-month weeks retain seven dates and scope unknown balances explicitly", () => {
    const s = fixture();
    expect(weeklyPlan(s, "2026-09-28", "A", "2026-10-04").end).toBe(
      "2026-10-04",
    );
    s.accounts[0].checkpoint = undefined;
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").capacity).toBeNull();
  });
});
