import { describe, expect, it } from "vitest";
import type { RecurringTransaction, Transaction } from "../db";
import { buildRecurringTimeline, getRecurringDates, toMonthlyRecurringAmount } from "../recurring";

const recurring: RecurringTransaction = {
  id: 1, type: "income", name: "Salaire", amount: 2000, frequency: "monthly",
  expectedDay: 31, nextExpected: "2026-01-31", status: "active", category: "Income",
  subcategory: "Salary", lastDetected: "2026-01-01", accountId: 2,
};

describe("moteur récurrent partagé", () => {
  it("borne le jour mensuel au dernier jour du mois", () => {
    expect(getRecurringDates(recurring, new Date(2026, 1, 1), new Date(2026, 1, 28))[0].getDate()).toBe(28);
  });

  it("inclut les revenus et ne matche jamais un autre compte", () => {
    const transactions = [{
      id: 10, accountId: 1, date: "2026-02-27", valueDate: "2026-02-27", direction: "credit",
      amount: 2000, balanceAfter: 0, category: "Income", subcategory: "Salary", merchant: "Salaire",
      merchantOriginal: "Salaire", paymentMethod: "Transfer", description: "Salaire", isRecurring: true,
      createdAt: "", updatedAt: "",
    }] as Transaction[];
    const [event] = buildRecurringTimeline({ recurring: [recurring], transactions, rangeStart: new Date(2026, 1, 1), rangeEnd: new Date(2026, 1, 28), today: new Date(2026, 1, 1) });
    expect(event.direction).toBe("income");
    expect(event.status).toBe("upcoming");
  });

  it("normalise correctement les fréquences", () => {
    expect(toMonthlyRecurringAmount({ ...recurring, frequency: "yearly", amount: 1200 })).toBe(100);
  });
});
