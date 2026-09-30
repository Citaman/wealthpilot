import { describe, expect, it } from "vitest";
import type { Budget, Transaction } from "@/lib/db";
import { buildBudgetNotifications } from "../use-notifications";

const budget: Budget = { id: 1, category: "Shopping", amount: 100, period: "monthly", year: new Date().getFullYear(), month: new Date().getMonth(), createdAt: "", updatedAt: "" };
const transaction = (amount: number, overrides: Partial<Transaction> = {}): Transaction => ({ id: 1, date: new Date().toISOString().slice(0, 10), valueDate: "", direction: "debit", amount: -amount, balanceAfter: 0, category: "Shopping", subcategory: "Other", merchant: "Test", merchantOriginal: "Test", paymentMethod: "card", description: "Test", isRecurring: false, accountId: 1, createdAt: "", updatedAt: "", ...overrides });

describe("budget notification threshold", () => {
  it("uses the configured threshold", () => {
    expect(buildBudgetNotifications([budget], [transaction(75)], (amount) => amount, 0.8)).toHaveLength(0);
    expect(buildBudgetNotifications([budget], [transaction(75)], (amount) => amount, 0.7)[0]?.id).toContain("budget-warning");
  });

  it("does not count paired internal transfers", () => {
    const transfer = transaction(150, { category: "Transfers", linkedTransferId: 99 });
    expect(buildBudgetNotifications([{ ...budget, category: "Transfers" }], [transfer], (amount) => amount, 0.5)).toHaveLength(0);
  });
});
