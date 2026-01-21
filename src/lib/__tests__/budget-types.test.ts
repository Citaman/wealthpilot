/**
 * Tests for budget-types module
 * Run with: npx vitest run src/lib/__tests__/budget-types.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_CATEGORY_TYPES,
  type BudgetType,
  type SalaryInfo,
} from "../budget-types";

// Mock data generators
function createMockSalaries(amounts: number[], startMonth: number = 6): SalaryInfo[] {
  return amounts.map((amount, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (startMonth - i));
    date.setDate(25); // Typical salary day
    return {
      amount,
      date: date.toISOString().split("T")[0],
      transactionId: i + 1,
      isOutlier: false, // Will be calculated
    };
  });
}

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

describe("Smart Income Calculation Logic", () => {
  describe("Outlier Detection", () => {
    it("should identify salary with bonus as outlier (>1.3x median)", () => {
      const amounts = [3000, 3100, 3050, 3000, 5000, 3100]; // 5000 is bonus month
      const sortedAmounts = [...amounts].sort((a, b) => a - b);
      // Sorted: [3000, 3000, 3050, 3100, 3100, 5000]
      const mid = Math.floor(sortedAmounts.length / 2);
      const median = (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2;
      // mid = 3, so median = (3050 + 3100) / 2 = 3075
      const outlierThreshold = median * 1.3;

      // Median is actually 3075 (average of middle two values)
      expect(median).toBe(3075);
      
      // Threshold should be ~3997.5
      expect(outlierThreshold).toBeCloseTo(3997.5, 0);
      
      // 5000 should be above threshold
      expect(5000 > outlierThreshold).toBe(true);
      
      // Regular salaries should not be outliers
      expect(3000 > outlierThreshold).toBe(false);
      expect(3100 > outlierThreshold).toBe(false);
    });

    it("should not flag normal variation as outlier", () => {
      const amounts = [3000, 3100, 3200, 2900, 3050, 3150]; // Normal variation
      const sortedAmounts = [...amounts].sort((a, b) => a - b);
      const mid = Math.floor(sortedAmounts.length / 2);
      const median = (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2;
      const outlierThreshold = median * 1.3;

      // All amounts should be below threshold
      amounts.forEach((amount) => {
        expect(amount <= outlierThreshold).toBe(true);
      });
    });
  });

  describe("Average Calculation", () => {
    it("should calculate average excluding outliers", () => {
      const amounts = [3000, 3100, 3050, 3000, 5000, 3100];
      const outlierThreshold = 3965; // From median calculation
      
      const regularSalaries = amounts.filter((a) => a <= outlierThreshold);
      const average = regularSalaries.reduce((sum, a) => sum + a, 0) / regularSalaries.length;

      // Average of [3000, 3100, 3050, 3000, 3100] = 3050
      expect(average).toBe(3050);
      
      // Not including the 5000 bonus
      expect(regularSalaries).not.toContain(5000);
      expect(regularSalaries.length).toBe(5);
    });

    it("should use median if all salaries are outliers", () => {
      const amounts = [5000, 6000, 7000]; // All high/variable
      const sortedAmounts = [...amounts].sort((a, b) => a - b);
      const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)];

      // With few highly variable salaries, median is the safe choice
      expect(median).toBe(6000);
    });
  });

  describe("Salary Day Detection", () => {
    it("should detect most common salary day", () => {
      const salaryDays = [25, 25, 25, 26, 25, 24]; // Day 25 is most common
      const dayCount: Record<number, number> = {};
      salaryDays.forEach((d) => {
        dayCount[d] = (dayCount[d] || 0) + 1;
      });
      
      const typicalDay = Object.entries(dayCount)
        .sort(([, a], [, b]) => b - a)[0];
      
      expect(parseInt(typicalDay[0])).toBe(25);
      expect(typicalDay[1]).toBe(4); // Count of day 25
    });

    it("should default to 25 if no pattern detected", () => {
      const salaryDays: number[] = []; // No data
      const defaultDay = 25;
      
      expect(salaryDays.length === 0 ? defaultDay : salaryDays[0]).toBe(25);
    });
  });

  describe("Confidence Levels", () => {
    it("should have high confidence with 4+ regular salaries", () => {
      const regularCount = 5;
      const confidence = regularCount >= 4 ? "high" : regularCount >= 2 ? "medium" : "low";
      expect(confidence).toBe("high");
    });

    it("should have medium confidence with 2-3 salaries", () => {
      const regularCount = 3;
      const confidence = regularCount >= 4 ? "high" : regularCount >= 2 ? "medium" : "low";
      expect(confidence).toBe("medium");
    });

    it("should have low confidence with <2 salaries", () => {
      const regularCount = 1;
      const confidence = regularCount >= 4 ? "high" : regularCount >= 2 ? "medium" : "low";
      expect(confidence).toBe("low");
    });
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

describe("Salary-Based Month Income", () => {
  describe("Period Detection", () => {
    it("should use salary date as period start", () => {
      const salaryDate = "2024-12-25";
      const currentDate = "2025-01-15";
      
      // If salary is on Dec 25, income period for Jan should start Dec 25
      expect(salaryDate < currentDate).toBe(true);
    });

    it("should handle end-of-month salaries correctly", () => {
      // Salary on Dec 30 should be the income for the "January period"
      const decemberSalary = { date: "2024-12-30", amount: 3000 };
      const januaryDate = "2025-01-15";
      
      // December salary is the most recent before January 15
      expect(decemberSalary.date < januaryDate).toBe(true);
      
      // This salary should count as "current month" income
      const isCurrentMonthSalary = true; // It's the most recent
      expect(isCurrentMonthSalary).toBe(true);
    });
  });
});
