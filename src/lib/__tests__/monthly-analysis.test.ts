import { describe, expect, it } from "vitest";
import type { Transaction } from "../db";
import {
  buildMonthlyFinancialHistory,
  isFixedExpense,
  isHouseholdIncome,
  isSalaryTransaction,
  summarizeFinancialHistory,
} from "../monthly-analysis";
import { applyMerchantRules } from "../migration";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    date: "2026-09-25",
    valueDate: "2026-09-25",
    direction: "debit",
    amount: 100,
    balanceAfter: 0,
    category: "Food",
    subcategory: "Groceries",
    merchant: "Merchant",
    merchantOriginal: "Merchant",
    paymentMethod: "card",
    description: "",
    isRecurring: false,
    accountId: 1,
    createdAt: "2026-09-25T00:00:00Z",
    updatedAt: "2026-09-25T00:00:00Z",
    ...overrides,
  };
}

describe("monthly household analysis", () => {
  it("recognizes salaries and benefits without treating refunds as revenue", () => {
    const salary = transaction({ direction: "credit", category: "Transfers", description: "VIR DIGITAL CLASSIFIEDS", amount: 3_690.24 });
    const caf = transaction({ direction: "credit", category: "Transfers", description: "VIR CAF ALLOCATIONS FAMILIALES", amount: 711.03 });
    const refund = transaction({ direction: "credit", category: "Income", subcategory: "Refunds", amount: 80 });

    expect(isSalaryTransaction(salary)).toBe(true);
    expect(isHouseholdIncome(salary)).toBe(true);
    expect(isHouseholdIncome(caf)).toBe(true);
    expect(isHouseholdIncome(refund)).toBe(false);
    expect(applyMerchantRules("VIR RECU BABILOU", "credit")?.subcategory).toBe("Salary");
    expect(applyMerchantRules("VIR CAF ALLOCATIONS FAMILIALES", "credit")?.subcategory).toBe("Benefits");
  });

  it("excludes paired internal transfers but keeps external cash outflows", () => {
    const history = buildMonthlyFinancialHistory([
      transaction({ id: 1, category: "Transfers", linkedTransferId: 2, amount: 500 }),
      transaction({ id: 2, direction: "credit", category: "Transfers", linkedTransferId: 1, amount: 500 }),
      transaction({ id: 3, category: "Transfers", merchant: "ATM Withdrawal", amount: 90 }),
    ], new Date(2026, 8, 1), new Date(2026, 8, 30), undefined, new Date(2026, 9, 15));

    expect(history[0].income).toBe(0);
    expect(history[0].expenses).toBe(90);
  });

  it("separates fixed and variable expenses and keeps cents exact", () => {
    const fixed = transaction({ category: "Bills", amount: 29.99 });
    const variable = transaction({ id: 2, category: "Food", amount: 70.02 });
    const history = buildMonthlyFinancialHistory([fixed, variable], new Date(2026, 8, 1), new Date(2026, 8, 30), undefined, new Date(2026, 9, 15));

    expect(isFixedExpense(fixed)).toBe(true);
    expect(history[0].fixedExpenses).toBe(29.99);
    expect(history[0].variableExpenses).toBe(70.02);
    expect(history[0].expenses).toBe(100.01);
  });

  it("fills empty months and excludes a partial month from the average", () => {
    const history = buildMonthlyFinancialHistory([
      transaction({ date: "2026-07-25", direction: "credit", category: "Income", subcategory: "Salary", amount: 4_000 }),
      transaction({ date: "2026-09-25", direction: "credit", category: "Income", subcategory: "Salary", amount: 3_600 }),
    ], new Date(2026, 6, 1), new Date(2026, 8, 30), undefined, new Date(2026, 8, 29));
    const summary = summarizeFinancialHistory(history);

    expect(history).toHaveLength(3);
    expect(history[1].income).toBe(0);
    expect(history[2].isPartial).toBe(true);
    expect(summary.averageMonthlyIncome).toBe(2_000);
    expect(summary.medianSalary).toBe(3_800);
    expect(summary.salaryVariance).toBe(-200);
  });

  it("does not dilute averages with empty months before the first imported transaction", () => {
    const history = buildMonthlyFinancialHistory([
      transaction({ date: "2026-04-10", amount: 1_000 }),
      transaction({ date: "2026-05-10", amount: 500 }),
    ], new Date(2026, 0, 1), new Date(2026, 4, 31), undefined, new Date(2026, 5, 15));

    expect(summarizeFinancialHistory(history).averageMonthlyExpenses).toBe(750);
  });
});
