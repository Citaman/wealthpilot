import { expect, it } from "vitest";
import { available } from "./available";
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
import { weekPlan } from "./week";

it("enveloppe 100 € / 20 payés / 30 engagés : 50 libres, jamais 30 de plus semaine → mois → prévision ; disponible sans double déduction, retard compté, salaire attendu jamais", () => {
  // 100 € envelope, 20 paid, 30 committed leaves 50 free — and never an extra 30 week → month → forecast
  {
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
  }
  // separates cash, transfers, charges and reserves, then reconciles a payment without double deduction
  {
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
  }
  // counts an overdue due, never an expected salary
  {
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
  }
});

const base = (): World => ({
  accounts: [anchored("A", "2026-10-01", 100000)],
});
