import { describe, expect, it } from "vitest";
import type { Transaction } from "../db";
import { calculateFinancialMetrics, classifyFinancialTransaction } from "../financial-metrics";
import { buildMonthlyFinancialHistory } from "../monthly-analysis";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2026-09-15",
    valueDate: "2026-09-15",
    direction: "debit",
    amount: -10,
    balanceAfter: 0,
    category: "Shopping",
    subcategory: "Other",
    merchant: "Test",
    merchantOriginal: "Test",
    paymentMethod: "card",
    description: "Test",
    isRecurring: false,
    accountId: 1,
    createdAt: "2026-09-15T00:00:00Z",
    updatedAt: "2026-09-15T00:00:00Z",
    ...overrides,
  };
}

describe("financial metrics contract", () => {
  const fixture = [
    tx({ id: 1, direction: "credit", amount: 4_000, category: "Income", subcategory: "Salary", merchant: "SALAIRE" }),
    tx({ id: 2, direction: "credit", amount: 400, category: "Income", subcategory: "Benefits", merchant: "CAF" }),
    tx({ id: 3, direction: "credit", amount: 50, category: "Shopping", subcategory: "Refunds", merchant: "REMBOURSEMENT" }),
    tx({ id: 4, amount: -1_000, category: "Housing" }),
    tx({ id: 5, amount: -300, category: "Shopping" }),
    tx({ id: 6, amount: -500, category: "Transfers", linkedTransferId: 7 }),
    tx({ id: 7, direction: "credit", amount: 500, category: "Transfers", linkedTransferId: 6 }),
    tx({ id: 8, amount: -90, isExcluded: true }),
    tx({ id: 9, direction: "credit", amount: 20, category: "Other", subcategory: "Other" }),
  ];

  it("separates income, real expenses, refunds and neutral transfers", () => {
    expect(calculateFinancialMetrics(fixture)).toEqual({
      income: 4_400,
      grossExpenses: 1_300,
      refunds: 50,
      expenses: 1_250,
      net: 3_150,
      transfers: 1_000,
      excluded: 90,
      unrecognizedCredits: 20,
      transactionCount: 9,
    });
    expect(classifyFinancialTransaction(fixture[5])).toBe("transfer");
    expect(classifyFinancialTransaction(fixture[2])).toBe("refund");
  });

  it("returns the same income, expense and net contract as monthly analytics", () => {
    const metrics = calculateFinancialMetrics(fixture);
    const [month] = buildMonthlyFinancialHistory(
      fixture,
      new Date("2026-09-01T12:00:00"),
      new Date("2026-09-30T12:00:00"),
      undefined,
      new Date("2026-10-01T12:00:00")
    );
    expect({ income: month.income, expenses: month.expenses, net: month.net }).toEqual({
      income: metrics.income,
      expenses: metrics.expenses,
      net: metrics.net,
    });
  });
});
