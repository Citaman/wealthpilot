import { expect, it } from "vitest";
import { forecast, planningEnd } from "./forecast";
import type { Ledger } from "./ledger";
import { simulatePurchase } from "./simulate";
import {
  anchored,
  budget,
  due,
  ledgerOf,
  tx,
  type World,
} from "./test-fixtures";
import type { WeeklyPlan } from "./types";
import { weekPlan } from "./week";

const plan = (
  start: string,
  account: string,
  limits: Record<string, number>,
): WeeklyPlan => ({
  start,
  account,
  limits,
  reduction: 0,
  reserve: 0,
});
const week = (w: World, asOf: string, start = "2026-10-05", account = "A") =>
  weekPlan(ledgerOf(w, asOf), account, start);
const base = (amount = 100000): World => ({
  accounts: [anchored("A", "2026-10-04", amount)],
});
const forecastEnd = (ledger: Ledger, account: string) =>
  forecast(ledger, account, planningEnd(ledger, "2026-10-11")).points.at(-1)!
    .value;
const brief = (): World => ({
  accounts: [
    anchored("A", "2026-10-02", 100000),
    anchored("B", "2026-10-04", 900000),
  ],
  dues: [
    due("charge", "2026-10-06", -30000),
    due("pay", "2026-10-09", 50000),
    due("food", "2026-10-10", -10000, { category: "Courses" }),
  ],
  prefs: {
    weeklyPlans: [plan("2026-10-05", "A", { Courses: 60000, Shopping: 60000 })],
  },
});

it("plan de semaine : capacité partagée, point bas chronologique, plafond d’enveloppe, mois budgétaires", () => {
  // shares one cash capacity between category limits, limited by the payer's chronological low
  {
    const p = week(brief(), "2026-10-04");
    expect(p.assumptions.capacity).toBe(70000);
    expect(p.lowPoint).toEqual({ date: "2026-10-06", value: 70000 });
    expect(p.totals.possible).toBe(70000);
    expect(p.envelopes.find((e) => e.category === "Courses")).toMatchObject({
      limit: 60000,
      committed: 10000,
      saved: true,
    });
    expect(p.days.map((d) => d.endBalance)).toEqual([
      100000, 70000, 70000, 70000, 120000, 110000, 110000,
    ]);
    expect(p.days[1].charges.map((c) => c.id)).toEqual(["charge"]);
    expect(p.days[4].incomes.map((c) => c.id)).toEqual(["pay"]);
  }
  // uses the chronological low rather than subtracting charges funded by an earlier salary
  {
    const w = (pay: string): World => ({
      ...base(50000),
      dues: [due("pay", pay, 100000), due("rent", "2026-10-10", -70000)],
      prefs: { weeklyPlans: [plan("2026-10-05", "A", { Food: 20000 })] },
    });
    expect(week(w("2026-10-09"), "2026-10-04").assumptions.capacity).toBe(
      50000,
    );
    expect(week(w("2026-10-12"), "2026-10-04").assumptions.capacity).toBe(0);
  }
  // protects an overdue unpaid charge, ignores a charge beyond the horizon
  {
    const limits = {
      weeklyPlans: [plan("2026-10-05", "A", { Courses: 8000 })],
    };
    const overdue = {
      ...base(10000),
      dues: [due("late", "2026-10-02", -9000)],
      prefs: limits,
    };
    expect(week(overdue, "2026-10-04").totals.possible).toBeLessThanOrEqual(
      1000,
    );
    const far = {
      ...base(),
      dues: [due("far", "2028-01-01", -200000)],
      prefs: { weeklyPlans: [plan("2026-10-05", "A", { Courses: 10000 })] },
    };
    expect(week(far, "2026-10-04").totals.possible).toBe(10000);
  }
  // caps a category at its monthly envelope after every commitment, and under the shared envelope
  {
    const capped: World = {
      ...base(),
      transactions: [tx("paid", "2026-10-02", -8000, { category: "Food" })],
      budgets: [budget("b", "2026-10", "Food", 10000, "A")],
      dues: [due("booked", "2026-10-20", -500, { category: "Food" })],
      prefs: { weeklyPlans: [plan("2026-10-05", "A", { Food: 8000 })] },
    };
    expect(week(capped, "2026-10-04").envelopes[0].possible).toBe(1500);
    const nested: World = {
      accounts: [
        anchored("A", "2026-10-04", 100000),
        anchored("B", "2026-10-04", 50000),
      ],
      transactions: [
        tx("other payer", "2026-10-02", -9000, {
          account: "B",
          category: "Food",
        }),
      ],
      budgets: [
        budget("g", "2026-10", "Food", 10000),
        budget("a", "2026-10", "Food", 6000, "A"),
      ],
      prefs: { weeklyPlans: [plan("2026-10-05", "A", { Food: 5000 })] },
    };
    expect(week(nested, "2026-10-04").envelopes[0].possible).toBe(1000);
  }
  // splits a week crossing two budget months by days, never borrowing next month's envelope
  {
    const w: World = {
      ...base(),
      budgets: [
        budget("oct", "2026-10", "Food", 0, "A"),
        budget("nov", "2026-11", "Food", 10000, "A"),
      ],
      prefs: { weeklyPlans: [plan("2026-10-26", "A", { Food: 7000 })] },
    };
    const p = week(w, "2026-10-25", "2026-10-26");
    expect(p.assumptions.months).toEqual(["2026-10", "2026-11"]);
    expect(p.envelopes[0].possible).toBe(1000);
  }
  // follows income-anchored months across a week
  {
    const w: World = {
      accounts: [anchored("A", "2026-10-05", 200000)],
      transactions: [
        tx("Salaire Anthony", "2026-09-26", 250000),
        tx("Futur", "2026-10-26", 250000),
      ],
      budgets: [
        budget("oct", "2026-10", "Courses", 50000),
        budget("nov", "2026-11", "Courses", 50000),
      ],
    };
    expect(week(w, "2026-10-05", "2026-10-26", "").assumptions.months).toEqual([
      "2026-11",
    ]);
  }
});

const scene = (samDay = "2026-10-16"): World => ({
  accounts: [
    anchored("Joint", "2026-10-14", 107000),
    anchored("Alex", "2026-10-14", 88000),
    anchored("Sam", "2026-10-14", 49000),
  ],
  transactions: [
    // Paydays on the 19th: the October budget month ends on Sunday the 18th.
    tx("Salaire Alex", "2026-08-19", 200000, { account: "Alex" }),
    tx("Salaire Alex", "2026-09-19", 200000, { account: "Alex" }),
    tx("courses", "2026-10-12", -7000, { account: "Joint" }),
    tx("resto", "2026-10-13", -2000, {
      account: "Alex",
      category: "Restaurants",
    }),
    tx("bus", "2026-10-13", -1000, { account: "Sam", category: "Transport" }),
  ],
  budgets: [
    budget("c", "2026-10", "Courses", 20000),
    budget("r", "2026-10", "Restaurants", 9000),
    budget("t", "2026-10", "Transport", 6000),
  ],
  dues: [
    due("drive", "2026-10-15", -6000, {
      account: "Joint",
      category: "Courses",
    }),
    due("navigo", "2026-10-17", -2000, {
      account: "Sam",
      category: "Transport",
    }),
    due("internet", "2026-10-15", -3000, { account: "Joint" }),
    due("school", "2026-10-16", -8000, { account: "Joint" }),
    due("insurance", "2026-10-17", -9000, { account: "Alex" }),
    due("Salaire Sam", samDay, 120000, { account: "Sam" }),
  ],
  prefs: {
    safety: 120000,
    weeklyPlans: [
      plan("2026-10-12", "", {
        Courses: 20000,
        Restaurants: 9000,
        Transport: 6000,
      }),
    ],
  },
});

it("semaine du 12–18 oct 2026 : 350 / 100 / 80 / 170, fin de semaine 3 190 € (1 990 € si le salaire de Sam glisse), restaurant de 35 € dans l’enveloppe sans effet sur la fin de semaine", () => {
  // reads 350 / 100 / 80 / 170 and ends the week at 3 190 €, or 1 990 € if Sam's pay slips
  {
    const p = week(scene(), "2026-10-14", "2026-10-12", "");
    expect(p.totals).toEqual({
      limit: 35000,
      paid: 10000,
      committed: 8000,
      possible: 17000,
    });
    expect(p.envelopes.map((e) => [e.category, e.possible])).toEqual([
      ["Courses", 7000],
      ["Restaurants", 7000],
      ["Transport", 3000],
    ]);
    expect(p.days.at(-1)?.endBalance).toBe(319000);
    expect(
      week(scene("2026-10-19"), "2026-10-14", "2026-10-12", "").days.at(-1)
        ?.endBalance,
    ).toBe(199000);
  }
  // a 35 € restaurant inside the envelope leaves 135 € of envelopes and the same end of week
  {
    const ledger = ledgerOf(scene(), "2026-10-14");
    const input = { amount: 3500, category: "Restaurants", date: "2026-10-14" };
    const household = simulatePurchase(ledger, { ...input, account: "" });
    expect(household).toMatchObject({
      inEnvelope: true,
      verdict: "ok",
      envelope: { before: 7000, after: 3500 },
    });
    expect(household.free.after).toBe(household.free.before);
    expect(
      household.projection.find((p) => p.date === "2026-10-18")?.value,
    ).toBe(319000);
    expect(weekPlan(ledger, "", "2026-10-12").totals.possible - 3500).toBe(
      13500,
    );
    const byAlex = simulatePurchase(ledger, { ...input, account: "Alex" });
    expect(byAlex).toMatchObject({
      inEnvelope: true,
      verdict: "ok",
      envelope: { before: 7000, after: 3500 },
    });
    expect(byAlex.low.after).toMatchObject({
      account: "Alex",
      value: 88000 - 9000 - 3500,
    });
  }
});

it("simulation d’achat : hors enveloppe baisse le cash sans rien écrire, provision imbriquée consommée une fois, seul l’excédent d’enveloppe baisse le cash", () => {
  // lowers today's cash for an outside purchase and writes nothing
  {
    const w: World = { ...base(), dues: [due("charge", "2026-10-06", -30000)] };
    const ledger = ledgerOf(w, "2026-10-04");
    const copy = structuredClone(w);
    const r = simulatePurchase(ledger, {
      amount: 3500,
      category: "Courses",
      date: "2026-10-04",
      account: "A",
    });
    expect(r.projection[0]).toEqual({ date: "2026-10-04", value: 96500 });
    expect(r).toMatchObject({
      verdict: "outside",
      inEnvelope: false,
      envelope: null,
      low: { after: { date: "2026-10-06", value: 66500 } },
    });
    expect(w).toEqual(copy);
  }
  // consumes nested provision once for the payer and for the household
  {
    const w: World = {
      ...base(),
      budgets: [
        budget("g", "2026-10", "Food", 10000),
        budget("a", "2026-10", "Food", 6000, "A"),
      ],
    };
    const ledger = ledgerOf(w, "2026-10-04");
    for (const account of ["A", ""]) {
      const r = simulatePurchase(ledger, {
        amount: 5000,
        category: "Food",
        date: "2026-10-06",
        account,
      });
      const before = forecastEnd(ledger, account);
      expect(r.projection.at(-1)?.value).toBe(before);
      expect(r.free.after).toBe(r.free.before);
    }
  }
  // only the uncovered excess of an envelope purchase lowers cash
  {
    const w: World = {
      ...base(),
      transactions: [tx("food", "2026-10-02", -8000, { category: "Food" })],
      budgets: [budget("b", "2026-10", "Food", 10000, "A")],
    };
    const ledger = ledgerOf(w, "2026-10-04");
    const end = forecastEnd(ledger, "A");
    const run = (category: string) =>
      simulatePurchase(ledger, {
        amount: 5000,
        category,
        date: "2026-10-06",
        account: "A",
      });
    expect(run("Food").projection.at(-1)!.value - end).toBe(-3000);
    expect(run("Food")).toMatchObject({
      verdict: "outside",
      envelope: { before: 2000, after: -3000 },
    });
    expect(run("Loisirs").projection.at(-1)!.value - end).toBe(-5000);
  }
});
