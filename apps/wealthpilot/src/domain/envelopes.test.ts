import { describe, expect, it } from "vitest";
import { available } from "./available";
import { envelopes } from "./envelopes";
import { forecast } from "./forecast";
import { financePrefs } from "./ledger";
import {
  anchored,
  budget,
  due,
  ledgerOf,
  tx,
  type World,
} from "./test-fixtures";
import { defaultPreferences } from "./types";
import { weekPlan } from "./week";

const october = (w: World, asOf: string, account = "") =>
  envelopes(ledgerOf(w, asOf), account, "2026-10");

describe("envelopes: one paid/committed/free implementation", () => {
  it("100 € envelope, 20 paid, 30 committed leaves 50 free — and never an extra 30 week → month → forecast", () => {
    const w: World = {
      accounts: [anchored("A", "2026-10-02", 100000)],
      transactions: [tx("food", "2026-10-01", -2000)],
      budgets: [budget("b", "2026-10", "Courses", 10000)],
      dues: [due("planned", "2026-10-10", -3000, { category: "Courses" })],
      prefs: {
        weeklyPlans: [
          {
            start: "2026-10-05",
            account: "",
            limits: { Courses: 10000 },
            reduction: 0,
            reserve: 0,
          },
        ],
      },
    };
    const ledger = ledgerOf(w, "2026-10-04");
    expect(envelopes(ledger, "", "2026-10")[0]).toMatchObject({
      allocated: 10000,
      paid: 2000,
      committed: 3000,
      free: 5000,
      over: false,
    });
    const week = weekPlan(ledger, "", "2026-10-05").envelopes[0];
    expect(week).toMatchObject({ paid: 0, committed: 3000, possible: 5000 });
    const f = forecast(ledger, "", "2026-10-31");
    expect(f.provisions["2026-10"]).toBe(5000);
    expect(f.points.at(-1)?.value).toBe(92000);
    expect(available(ledger, "").free).toBe(92000);
    // Reconciling the due moves 30 from committed to paid, nothing else.
    const paid = ledgerOf(
      {
        ...w,
        transactions: [...w.transactions!, tx("paid", "2026-10-03", -3000)],
        dues: [{ ...w.dues![0], transactionId: "paid" }],
      },
      "2026-10-04",
    );
    expect(envelopes(paid, "", "2026-10")[0]).toMatchObject({
      paid: 5000,
      committed: 0,
      free: 5000,
    });
    expect(forecast(paid, "", "2026-10-31").points.at(-1)?.value).toBe(92000);
  });

  it("separates paid up to asOf from committed future-dated operations, then recognises the payment", () => {
    const w: World = {
      accounts: [anchored("A", "2026-10-05", 200000)],
      transactions: [
        tx("paid", "2026-10-02", -1000),
        tx("future", "2026-10-20", -9000),
      ],
      budgets: [budget("b", "2026-10", "Courses", 20000)],
    };
    expect(october(w, "2026-10-05")[0]).toMatchObject({
      paid: 1000,
      committed: 9000,
      free: 10000,
    });
    const now = available(ledgerOf(w, "2026-10-05"), "");
    expect(now).toMatchObject({
      chargesTotal: 9000,
      envelopesFree: 10000,
      free: 181000,
    });
    expect(now.charges.map((c) => c.id)).toEqual(["known:future"]);
    expect(october(w, "2026-10-21")[0]).toMatchObject({
      paid: 10000,
      committed: 0,
      free: 10000,
    });
    expect(available(ledgerOf(w, "2026-10-21"), "")).toMatchObject({
      cash: 191000,
      free: 181000,
    });
  });

  it("aggregates account envelopes without consuming another account's, nor subtracting a shared one twice", () => {
    const accounts = [
      anchored("A", "2026-10-05", 200000),
      anchored("B", "2026-10-05", 100000),
    ];
    const both: World = {
      accounts,
      transactions: [
        tx("A-paid", "2026-10-02", -8000),
        tx("B-paid", "2026-10-02", -5000, { account: "B" }),
      ],
      budgets: [
        budget("a", "2026-10", "Courses", 10000, "A"),
        budget("b", "2026-10", "Courses", 20000, "B"),
      ],
    };
    expect(october(both, "2026-10-05")[0]).toMatchObject({
      allocated: 30000,
      paid: 13000,
      committed: 0,
      free: 17000,
    });
    expect(
      forecast(ledgerOf(both, "2026-10-05"), "", "2026-10-31").provisions[
        "2026-10"
      ],
    ).toBe(17000);
    const onlyA: World = {
      accounts,
      transactions: [
        tx("B-paid", "2026-10-02", -8000, { account: "B" }),
        tx("B-planned", "2026-10-20", -5000, { account: "B" }),
      ],
      budgets: [budget("a", "2026-10", "Courses", 10000, "A")],
    };
    expect(october(onlyA, "2026-10-05")[0]).toMatchObject({
      paid: 0,
      committed: 0,
      free: 10000,
    });
    const shared = {
      ...onlyA,
      budgets: [...onlyA.budgets!, budget("g", "2026-10", "Courses", 20000)],
    };
    expect(october(shared, "2026-10-05")[0]).toMatchObject({
      allocated: 20000,
      paid: 8000,
      committed: 5000,
      free: 7000,
    });
    expect(october(shared, "2026-10-05", "A")[0]).toMatchObject({
      allocated: 10000,
      free: 10000,
    });
  });

  it("keeps another account and internal transfers out of an account's envelopes", () => {
    const w: World = {
      accounts: [
        anchored("A", "2026-10-05", 100000),
        anchored("B", "2026-10-05", 100000),
      ],
      transactions: [
        tx("A-sept", "2026-09-15", -1200),
        tx("B-sept", "2026-09-15", -9900, { account: "B" }),
        tx("A-oct", "2026-10-02", -1700),
        tx("A-future", "2026-10-20", -800),
        tx("A-internal", "2026-10-21", -3300, { internal: true }),
        tx("B-future", "2026-10-20", -8700, { account: "B" }),
      ],
      budgets: [
        budget("sept", "2026-09", "Courses", 3000, "A"),
        budget("oct", "2026-10", "Courses", 6000, "A"),
      ],
    };
    for (const account of ["", "A"]) {
      expect(october(w, "2026-10-05", account)[0]).toMatchObject({
        allocated: 6000,
        paid: 1700,
        committed: 800,
        free: 3500,
      });
      const ledger = ledgerOf(w, "2026-10-05");
      expect(envelopes(ledger, account, "2026-09")[0]).toMatchObject({
        paid: 1200,
        free: 1800,
      });
      expect(
        forecast(ledger, account, "2026-10-31").provisions["2026-10"],
      ).toBe(3500);
    }
  });

  it("flags an envelope over when paid + committed exceed the allocation, and follows the saved order", () => {
    const w: World = {
      transactions: [
        tx("x", "2026-10-02", -12000),
        tx("y", "2026-10-02", -100, { category: "Bars" }),
      ],
      budgets: [
        budget("c", "2026-10", "Courses", 10000),
        budget("b", "2026-10", "Bars", 500),
      ],
      prefs: { budgetOrder: ["Courses"] },
    };
    expect(
      october(w, "2026-10-05").map((e) => [e.category, e.free, e.over]),
    ).toEqual([
      ["Courses", 0, true],
      ["Bars", 400, false],
    ]);
  });
});

describe("available until the end of the budget month", () => {
  const base = (): World => ({
    accounts: [anchored("A", "2026-10-01", 100000)],
  });

  it("separates cash, transfers, charges and reserves, then reconciles a payment without double deduction", () => {
    const w: World = {
      ...base(),
      transactions: [
        tx("transfer", "2026-10-02", -20000, { internal: true }),
        tx("shop", "2026-10-02", -5000),
      ],
      dues: [due("rent", "2026-10-18", -15000, { label: "Loyer" })],
      prefs: { safety: 10000, projectsReserve: 20000 },
    };
    expect(available(ledgerOf(w, "2026-10-02"), "")).toMatchObject({
      cash: 75000,
      chargesTotal: 15000,
      free: 30000,
    });
    const paid = {
      ...w,
      transactions: [...w.transactions!, tx("rent-paid", "2026-10-18", -15000)],
      dues: [{ ...w.dues![0], transactionId: "rent-paid" }],
    };
    expect(available(ledgerOf(paid, "2026-10-18"), "")).toMatchObject({
      cash: 60000,
      chargesTotal: 0,
      free: 30000,
    });
  });

  it("counts an overdue due, never an expected salary", () => {
    const w: World = {
      ...base(),
      transactions: [tx("shop", "2026-10-02", -11000)],
      dues: [
        due("salary", "2026-10-15", 250000),
        due("late", "2026-09-30", -2000),
      ],
    };
    const a = available(ledgerOf(w, "2026-10-02"), "");
    expect(a).toMatchObject({ cash: 89000, free: 87000 });
    expect(a.charges.map((c) => [c.id, c.overdue])).toEqual([["late", true]]);
    expect(a.expectedIncome.map((c) => c.id)).toEqual(["salary"]);
  });

  it("reserves every retired goal's saved money as a visible projects line", () => {
    const prefs = financePrefs({
      ...defaultPreferences,
      goal: { name: "iPhone", target: 100000, saved: 20000 },
      extraGoals: [
        { name: "Maison", target: 10000000, saved: 50000 },
        { name: "Restauré abîmé", target: 1, saved: NaN },
        { name: "Centimes", target: 1, saved: 1.5 },
      ],
    });
    const a = available(
      ledgerOf(
        { accounts: [anchored("A", "2026-10-03", 200000)], prefs },
        "2026-10-03",
      ),
      "",
    );
    expect(a).toMatchObject({ cash: 200000, projects: 70000, free: 130000 });
  });

  it("protects remaining envelopes without counting a same-category bill twice", () => {
    const w: World = {
      accounts: [anchored("A", "2026-10-03", 200000)],
      transactions: [tx("shop", "2026-10-02", -10000)],
      budgets: [budget("b", "2026-10", "Courses", 60000)],
      dues: [due("d", "2026-10-15", -20000, { category: "Courses" })],
    };
    const ledger = ledgerOf(w, "2026-10-03");
    expect(available(ledger, "")).toMatchObject({
      envelopesFree: 30000,
      chargesTotal: 20000,
      free: 150000,
    });
    expect(forecast(ledger, "", "2026-10-31").points.at(-1)?.value).toBe(
      150000,
    );
    const rent: World = {
      accounts: [anchored("A", "2026-10-03", 200000)],
      budgets: [budget("b", "2026-10", "Logement", 90000)],
      dues: [due("d", "2026-10-10", -90000, { category: "Logement" })],
    };
    expect(available(ledgerOf(rent, "2026-10-03"), "")).toMatchObject({
      envelopesFree: 0,
      free: 110000,
    });
  });

  it("subtracts reserves from free money but never from projected bank cash", () => {
    const w: World = {
      accounts: [
        anchored("A", "2026-10-03", 100000),
        anchored("B", "2026-10-03", 100000),
      ],
    };
    const plain = ledgerOf(w, "2026-10-03");
    const reserved = ledgerOf(
      { ...w, prefs: { safety: 20000, projectsReserve: 30000 } },
      "2026-10-03",
    );
    expect(forecast(reserved, "", "2026-10-31").points).toEqual(
      forecast(plain, "", "2026-10-31").points,
    );
    expect(available(reserved, "").free).toBe(
      available(plain, "").free! - 50000,
    );
  });

  it("does not invent an account's share of household reserves", () => {
    const w: World = {
      accounts: [
        anchored("A", "2026-10-03", 100000),
        anchored("B", "2026-10-03", 100000),
      ],
      dues: [due("d", "2026-10-02", -1000, { transactionId: "t" })],
      prefs: { safety: 20000 },
    };
    expect(available(ledgerOf(w, "2026-10-03"), "A")).toMatchObject({
      safety: 0,
      chargesTotal: 0,
      free: 100000,
      sharedReserveNote: true,
    });
    expect(
      available(ledgerOf({ accounts: [{ id: "A" }] }, "2026-10-03"), ""),
    ).toMatchObject({ free: null, unknownBalance: true });
  });
});
