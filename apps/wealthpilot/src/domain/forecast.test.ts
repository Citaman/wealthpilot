import { describe, expect, it } from "vitest";
import { balanceSeries } from "./balances";
import { envelopes } from "./envelopes";
import { forecast } from "./forecast";
import {
  anchored,
  budget,
  due,
  ledgerOf,
  tx,
  type World,
} from "./test-fixtures";

const values = (w: World, asOf: string, end: string, account = "") =>
  forecast(ledgerOf(w, asOf), account, end).points.map((p) => p.value);

describe("brief fixture: Paris, 4 October 2026", () => {
  const brief = (salary = "2026-10-09"): World => ({
    accounts: [anchored("A", "2026-10-02", 100000)],
    dues: [
      due("charge", "2026-10-06", -30000),
      due("salary", salary, 50000),
      due("grocery", "2026-10-10", -10000, { category: "Courses" }),
    ],
    prefs: { safety: 20000 },
  });

  it("projects end-of-day balances 5–11 Oct without turning the reserve into a debit", () => {
    for (const account of ["", "A"]) {
      const f = forecast(
        ledgerOf(brief(), "2026-10-04"),
        account,
        "2026-10-11",
      );
      expect(f.points.slice(1).map((p) => p.value)).toEqual([
        100000, 70000, 70000, 70000, 120000, 110000, 110000,
      ]);
      expect(f.lowPoint).toMatchObject({ date: "2026-10-06", value: 70000 });
    }
    expect(
      forecast(ledgerOf(brief(), "2026-10-04"), "", "2026-10-11").reserve,
    ).toBe(20000);
  });

  it("does not credit a delayed salary on the 9th", () => {
    expect(values(brief("2026-10-12"), "2026-10-04", "2026-10-11").at(-1)).toBe(
      60000,
    );
  });

  it("marks 3–4 Oct as unknown coverage after the observed 2 Oct", () => {
    const series = balanceSeries(ledgerOf(brief(), "2026-10-04"), {
      account: "",
      range: { from: "2026-10-02", to: "2026-10-04" },
      asOf: "2026-10-04",
    });
    expect(series.points.map((p) => [p.date, p.observed, p.gap])).toEqual([
      ["2026-10-02", true, false],
      ["2026-10-03", false, true],
      ["2026-10-04", false, true],
    ]);
  });
});

describe("cash forecast", () => {
  const base = (): World => ({
    accounts: [anchored("A", "2026-10-04", 100000)],
  });

  it("credits the salary on the 26th before debiting the 28th", () => {
    const w = {
      ...base(),
      dues: [
        due("pay", "2026-10-26", 50000),
        due("rent", "2026-10-28", -30000),
      ],
    };
    const f = forecast(ledgerOf(w, "2026-10-04"), "A", "2026-10-31");
    expect(f.points.find((p) => p.date === "2026-10-25")?.value).toBe(100000);
    expect(f.points.find((p) => p.date === "2026-10-26")?.value).toBe(150000);
    expect(f.points.at(-1)?.value).toBe(120000);
  });

  it("keeps internal transfers cash-neutral for the household but real for each payer", () => {
    const w: World = {
      accounts: [
        anchored("A", "2026-10-04", 100000),
        anchored("B", "2026-10-04", 10000),
      ],
      transactions: [
        tx("out", "2026-10-06", -5000, { internal: true }),
        tx("in", "2026-10-06", 5000, { account: "B", internal: true }),
      ],
    };
    expect(values(w, "2026-10-04", "2026-10-07").at(-1)).toBe(110000);
    expect(values(w, "2026-10-04", "2026-10-07", "A").at(-1)).toBe(95000);
    const nested = {
      ...w,
      budgets: [
        budget("g", "2026-10", "Courses", 10000),
        budget("a", "2026-10", "Courses", 6000, "A"),
      ],
    };
    const household = forecast(
      ledgerOf(nested, "2026-10-04"),
      "",
      "2026-10-31",
    );
    expect(household.provisions["2026-10"]).toBe(10000);
    expect(household.points.at(-1)?.value).toBe(100000);
    const payer = forecast(ledgerOf(nested, "2026-10-04"), "A", "2026-10-31");
    expect(payer.provisions["2026-10"]).toBe(6000);
    expect(payer.points.at(-1)?.value).toBe(89000);
  });

  it("invents no dispersion for a confirmed fixed recurrence, but bands an unconfirmed one", () => {
    const rule = {
      id: "r",
      name: "Abonnement",
      account: "A",
      amount: -10000,
      category: "Bills",
      frequency: "monthly" as const,
      next: "2026-10-06",
    };
    const fixed = forecast(
      ledgerOf({ ...base(), prefs: { recurrenceRules: [rule] } }, "2026-10-04"),
      "A",
      "2026-10-07",
    );
    expect(fixed.points.at(-1)).toMatchObject({
      value: 90000,
      low: 90000,
      high: 90000,
    });
    const varying = ["07", "08", "09"].map((m, i) =>
      tx(`e${m}`, `2026-${m}-06`, -10000 - i * 1000, {
        merchant: "EDF",
        label: "EDF",
        category: "Energie",
      }),
    );
    const banded = forecast(
      ledgerOf({ ...base(), transactions: varying }, "2026-10-04"),
      "A",
      "2026-10-07",
    ).points.at(-1)!;
    expect(banded).toMatchObject({ value: 89000, low: 88000, high: 90000 });
  });

  it("applies unreconciled overdue and same-day dues at asOf, so the low point sees them", () => {
    const w = {
      ...base(),
      dues: [
        due("today", "2026-10-04", -80000),
        due("late", "2026-10-01", -5000),
      ],
    };
    const f = forecast(ledgerOf(w, "2026-10-04"), "A", "2026-10-10");
    expect(f.points[0].value).toBe(15000);
    expect(f.lowPoint?.value).toBe(15000);
    expect(f.events.find((e) => e.id === "late")?.overdue).toBe(true);
  });

  it("counts a known future operation once and drops its linked due", () => {
    const t = tx("bill", "2026-10-06", -10000);
    const w = {
      ...base(),
      transactions: [t],
      dues: [due("d", "2026-10-06", -10000, { transactionId: t.id })],
    };
    expect(values(w, "2026-10-04", "2026-10-07", "A").at(-1)).toBe(90000);
  });

  it("finds per-account shortfalls in chronological order, not totals", () => {
    const w = (income: string): World => ({
      accounts: [
        anchored("Commun", "2026-10-03", 100000),
        anchored("Perso", "2026-10-03", 100000),
      ],
      dues: [
        due("income", income, 50000, { account: "Commun" }),
        due("rent", "2026-10-06", -120000, { account: "Commun" }),
      ],
    });
    expect(
      forecast(ledgerOf(w("2026-10-04"), "2026-10-03"), "", "2026-10-31")
        .shortfalls,
    ).toEqual([]);
    expect(
      forecast(ledgerOf(w("2026-10-08"), "2026-10-03"), "", "2026-10-31")
        .shortfalls,
    ).toEqual([
      {
        account: "Commun",
        date: "2026-10-06",
        threshold: 0,
        low: { date: "2026-10-06", value: -20000, account: "Commun" },
        amount: 20000,
      },
    ]);
  });
});

describe("envelope provisions and budget months", () => {
  const family = (): World => ({
    accounts: [
      anchored("A", "2026-10-05", 200000),
      anchored("Y", "2026-10-05", 100000),
    ],
    transactions: [
      tx("Salaire Anthony", "2026-09-26", 250000),
      tx("Salaire Yaren", "2026-09-27", 180000, { account: "Y" }),
      tx("Loyer", "2026-10-01", -90000, { category: "Logement" }),
      tx("Courses", "2026-10-03", -10000),
      tx("Futur", "2026-10-26", 250000),
    ],
  });

  it("provisions the envelope until the 25th without recounting spending or dues", () => {
    const w: World = {
      ...family(),
      budgets: [budget("food", "2026-10", "Courses", 40000)],
      dues: [due("delivery", "2026-10-10", -5000, { category: "Courses" })],
    };
    const ledger = ledgerOf(w, "2026-10-05");
    expect(envelopes(ledger, "", "2026-10")[0]).toMatchObject({
      paid: 10000,
      committed: 5000,
      free: 25000,
    });
    const f = forecast(ledger, "", "2026-10-26");
    expect(f.points.find((p) => p.date === "2026-10-25")?.value).toBe(270000);
    expect(f.points.at(-1)?.value).toBe(520000);
  });

  it("keeps the same cash for a date when the horizon shortens", () => {
    const w: World = {
      ...family(),
      budgets: [budget("oct", "2026-10", "Courses", 30000)],
      dues: [due("engaged", "2026-10-20", -10000, { category: "Courses" })],
    };
    const short = forecast(ledgerOf(w, "2026-10-05"), "", "2026-10-10");
    const long = forecast(ledgerOf(w, "2026-10-05"), "", "2026-10-25");
    expect(short.points).toEqual(
      long.points.filter((p) => p.date <= "2026-10-10"),
    );
    expect(short.events.map((e) => e.id)).not.toContain("engaged");
    expect(short.provisions).toEqual(long.provisions);
  });

  it("caps an open-ended month: a far commitment is not this month's envelope", () => {
    const w: World = {
      accounts: [anchored("A", "2026-11-05", 100000)],
      transactions: [
        tx("CAF", "2026-10-05", 20000),
        tx("Courses prévues", "2026-11-07", -5000),
      ],
      budgets: [budget("food", "2026-10", "Courses", 10000)],
    };
    const f = forecast(ledgerOf(w, "2026-11-05"), "", "2026-11-08");
    expect(f.provisions["2026-10"]).toBe(10000);
    expect(f.points.at(-1)?.value).toBe(85000);
    expect(f.events.some((e) => e.date === "2026-11-07")).toBe(true);
    expect(
      forecast(ledgerOf(w, "2026-11-05"), "", "2026-11-06").points,
    ).toEqual(f.points.slice(0, 2));
  });
});
