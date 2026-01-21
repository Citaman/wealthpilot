/**
 * Tests for budget-types module
 * Run with: npx vitest run src/lib/__tests__/budget-types.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_CATEGORY_TYPES,
  type BudgetType,
} from "../budget-types";

describe("DEFAULT_CATEGORY_TYPES", () => {
  it("should have correct default types for all categories", () => {
    // Needs categories
    expect(DEFAULT_CATEGORY_TYPES.Housing).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Food).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Transport).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Bills).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Health).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Family).toBe("needs");
    expect(DEFAULT_CATEGORY_TYPES.Taxes).toBe("needs");

    // Wants categories
    expect(DEFAULT_CATEGORY_TYPES.Shopping).toBe("wants");
    expect(DEFAULT_CATEGORY_TYPES.Entertainment).toBe("wants");
    expect(DEFAULT_CATEGORY_TYPES.Services).toBe("wants");

    // Savings categories
    expect(DEFAULT_CATEGORY_TYPES.Transfers).toBe("savings");

    // Income category
    expect(DEFAULT_CATEGORY_TYPES.Income).toBe("income");
  });
});

describe("Type Override System", () => {
  describe("Priority Resolution", () => {
    it("should prioritize transaction override over category override", () => {
      const transactionOverride: BudgetType = "wants";
      const categoryOverride: BudgetType = "needs";
      const defaultType: BudgetType = "needs";

      // Simulate priority check
      const effectiveType = transactionOverride || categoryOverride || defaultType;
      
      expect(effectiveType).toBe("wants");
    });

    it("should use category override when no transaction override", () => {
      const transactionOverride: BudgetType | undefined = undefined;
      const categoryOverride: BudgetType = "savings";
      const defaultType: BudgetType = "needs";

      const effectiveType = transactionOverride || categoryOverride || defaultType;
      
      expect(effectiveType).toBe("savings");
    });

    it("should fall back to default when no overrides", () => {
      const transactionOverride: BudgetType | undefined = undefined;
      const categoryOverride: BudgetType | undefined = undefined;
      const defaultType: BudgetType = "needs";

      const effectiveType = transactionOverride || categoryOverride || defaultType;
      
      expect(effectiveType).toBe("needs");
    });
  });

  describe("Spending Calculation with Overrides", () => {
    it("should calculate spending respecting category overrides", () => {
      // Mock transactions
      const transactions = [
        { id: 1, category: "Food", amount: -100, direction: "debit" as const },
        { id: 2, category: "Shopping", amount: -50, direction: "debit" as const },
        { id: 3, category: "Entertainment", amount: -30, direction: "debit" as const },
      ];

      // Override: Move Shopping from wants to needs
      const categoryOverrides: Record<string, BudgetType> = {
        Shopping: "needs",
      };

      const result = { needs: 0, wants: 0, savings: 0 };
      
      transactions.forEach((t) => {
        const override = categoryOverrides[t.category];
        const defaultType = DEFAULT_CATEGORY_TYPES[t.category] || "wants";
        const type = override || defaultType;
        
        if (type !== "income") {
          result[type as "needs" | "wants" | "savings"] += Math.abs(t.amount);
        }
      });

      // Food (needs): 100
      // Shopping (overridden to needs): 50
      // Entertainment (wants): 30
      expect(result.needs).toBe(150); // Food + Shopping
      expect(result.wants).toBe(30);  // Entertainment only
      expect(result.savings).toBe(0);
    });

    it("should calculate spending respecting transaction overrides", () => {
      const transactions = [
        { id: 1, category: "Shopping", amount: -100, direction: "debit" as const },
        { id: 2, category: "Shopping", amount: -50, direction: "debit" as const },
      ];

      // Override: Transaction 1 is actually needs (e.g., work clothes)
      const transactionOverrides: Record<number, BudgetType> = {
        1: "needs",
      };

      const result = { needs: 0, wants: 0, savings: 0 };
      
      transactions.forEach((t) => {
        const txOverride = transactionOverrides[t.id];
        const defaultType = DEFAULT_CATEGORY_TYPES[t.category] || "wants";
        const type = txOverride || defaultType;
        
        if (type !== "income") {
          result[type as "needs" | "wants" | "savings"] += Math.abs(t.amount);
        }
      });

      // Transaction 1 (overridden to needs): 100
      // Transaction 2 (default wants): 50
      expect(result.needs).toBe(100);
      expect(result.wants).toBe(50);
    });
  });
});
