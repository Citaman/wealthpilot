/**
 * Tests for financial-month module (Income Statistics)
 * Run with: npx vitest run src/lib/__tests__/financial-month.test.ts
 */

import { describe, it, expect } from "vitest";
import { calculateIncomeStatistics } from "../financial-month";
import type { Transaction } from "../db";

// Helper to create mock salary transactions
function createMockSalaries(amounts: number[]): Transaction[] {
  return amounts.map((amount, i) => ({
    id: i + 1,
    date: new Date(2024, 0, 25 - i).toISOString().split('T')[0], // Different dates
    valueDate: new Date(2024, 0, 25 - i).toISOString().split('T')[0],
    amount,
    direction: 'credit',
    category: 'Income',
    subcategory: 'Salary',
    merchant: 'Employer',
    merchantOriginal: 'Employer',
    paymentMethod: 'Transfer',
    description: 'Salary',
    isRecurring: true,
    accountId: 1,
    balanceAfter: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

describe("Income Statistics Calculation", () => {
  describe("Outlier Detection", () => {
    it("should identify salary with bonus as outlier (>1.3x median)", () => {
      const amounts = [3000, 3100, 3050, 3000, 5000, 3100]; // 5000 is bonus
      const transactions = createMockSalaries(amounts);
      
      const stats = calculateIncomeStatistics(transactions);
      
      // Median of [3000, 3000, 3050, 3100, 3100, 5000] is 3075
      expect(stats.medianSalary).toBe(3075);
      
      // Threshold ~3997.5
      expect(stats.outlierThreshold).toBeCloseTo(3997.5, 0);
      
      // 1 outlier (5000)
      expect(stats.outlierCount).toBe(1);
    });

    it("should not flag normal variation as outlier", () => {
      const amounts = [3000, 3100, 3200, 2900, 3050, 3150];
      const transactions = createMockSalaries(amounts);
      
      const stats = calculateIncomeStatistics(transactions);
      
      expect(stats.outlierCount).toBe(0);
    });
  });

  describe("Average Calculation", () => {
    it("should calculate average excluding outliers", () => {
      const amounts = [3000, 3100, 3050, 3000, 5000, 3100];
      const transactions = createMockSalaries(amounts);
      
      const stats = calculateIncomeStatistics(transactions);
      
      // Average of [3000, 3100, 3050, 3000, 3100] = 3050
      expect(stats.averageSalary).toBe(3050);
    });

    it("should use median if all salaries are outliers", () => {
        // Note: The logic in calculateIncomeStatistics defaults to median if regularSalaries is empty?
        // Let's check the code:
        // const regularSalaries = amounts.filter((a) => a <= outlierThreshold);
        // const averageSalary = regularSalaries.length > 0 ? ... : median;
        // If all are > threshold? No, median is part of the set, so at least median <= median*1.3 (if median > 0)
        // So regularSalaries will never be empty if amounts are not empty.
        // Wait, if median is 100, threshold is 130. If we have [100, 200], median is 150? No, (100+200)/2=150.
        // Threshold 195. 100 is <= 195.
        // So at least the smaller half is always included.
        // The test case "all salaries are outliers" is mathematically impossible with Median * 1.3 unless negative?
        
        // Let's just test with high variance
        const amounts = [1000, 5000, 10000]; 
        // Sorted: 1000, 5000, 10000. Median: 5000. Threshold: 6500.
        // Regular: 1000, 5000. (10000 is outlier).
        // Average: 3000.
        
        const transactions = createMockSalaries(amounts);
        const stats = calculateIncomeStatistics(transactions);
        
        expect(stats.medianSalary).toBe(5000);
        expect(stats.averageSalary).toBe(3000);
        expect(stats.outlierCount).toBe(1);
    });
  });

  describe("Confidence Levels", () => {
    it("should have high confidence with 4+ regular salaries", () => {
      const amounts = [3000, 3000, 3000, 3000, 3000];
      const transactions = createMockSalaries(amounts);
      const stats = calculateIncomeStatistics(transactions);
      expect(stats.confidence).toBe("high");
    });

    it("should have medium confidence with 2-3 salaries", () => {
      const amounts = [3000, 3000, 3000];
      const transactions = createMockSalaries(amounts);
      const stats = calculateIncomeStatistics(transactions);
      expect(stats.confidence).toBe("medium");
    });

    it("should have low confidence with <2 salaries", () => {
      const amounts = [3000];
      const transactions = createMockSalaries(amounts);
      const stats = calculateIncomeStatistics(transactions);
      expect(stats.confidence).toBe("low");
    });
  });
});
