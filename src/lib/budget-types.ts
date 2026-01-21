// Budget type utilities for needs/wants/savings classification
// This module provides smart income calculation and type override management

import { db, type Transaction } from "./db";
import { useLiveQuery } from "dexie-react-hooks";
import { subMonths, format, parseISO, differenceInDays, getDate } from "date-fns";

// Types
export type BudgetType = "needs" | "wants" | "savings" | "income";

export interface CategoryTypeOverride {
  id?: number;
  category: string;
  budgetType: BudgetType;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionTypeOverride {
  id?: number;
  transactionId: number;
  budgetType: BudgetType;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryInfo {
  amount: number;
  date: string;
  transactionId: number;
  isOutlier: boolean; // True if has bonus (significantly higher than median)
}

export interface SmartIncomeResult {
  averageSalary: number;          // Average excluding outliers
  medianSalary: number;           // Median salary
  lastSalary: number;             // Most recent salary
  salaryDay: number;              // Typical day of month salary arrives
  salaries: SalaryInfo[];         // All detected salaries
  outlierThreshold: number;       // Amount above which is considered outlier
  confidence: "high" | "medium" | "low";  // Confidence in the calculation
  salaryCount: number;            // Total number of salaries detected
  outlierCount: number;           // Number of outliers (bonuses)
}

// Default category types (fallback when no override exists)
export const DEFAULT_CATEGORY_TYPES: Record<string, BudgetType> = {
  Income: "income",
  Housing: "needs",
  Food: "needs",
  Transport: "needs",
  Bills: "needs",
  Health: "needs",
  Shopping: "wants",
  Entertainment: "wants",
  Services: "wants",
  Family: "needs",
  Transfers: "savings",
  Taxes: "needs",
};

/**
 * Calculate smart income based on salary history
 * - Uses median to detect typical salary
 * - Identifies outliers (bonuses) as amounts > 1.3x median
 * - Calculates average excluding outliers
 * - Detects typical salary day
 */
export async function calculateSmartIncome(
  lookbackMonths: number = 6
): Promise<SmartIncomeResult> {
  const now = new Date();
  const startDate = format(subMonths(now, lookbackMonths), "yyyy-MM-dd");
  
  // Get all income transactions (credits) that look like salary
  const incomeTransactions = await db.transactions
    .where("date")
    .aboveOrEqual(startDate)
    .and((t) => t.direction === "credit")
    .toArray();
  
  // Filter to likely salary payments (larger amounts, typically monthly)
  // A salary is typically: > €1000, category is Income, subcategory is Salary
  const salaryTransactions = incomeTransactions.filter((t) => 
    t.amount >= 1000 && 
    (t.category === "Income" || 
     t.subcategory?.toLowerCase().includes("salar") ||
     t.merchant.toLowerCase().includes("salar") ||
     t.description.toLowerCase().includes("salar"))
  );
  
  if (salaryTransactions.length === 0) {
    // Fallback: use all income transactions > 1000
    const fallbackSalaries = incomeTransactions
      .filter((t) => t.amount >= 1000)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, lookbackMonths); // Assume max 1 per month
    
    if (fallbackSalaries.length === 0) {
      return {
        averageSalary: 0,
        medianSalary: 0,
        lastSalary: 0,
        salaryDay: 25,
        salaries: [],
        outlierThreshold: 0,
        confidence: "low",
        salaryCount: 0,
        outlierCount: 0,
      };
    }
    
    salaryTransactions.push(...fallbackSalaries);
  }
  
  // Sort by date
  const sortedSalaries = salaryTransactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Get amounts for calculation
  const amounts = sortedSalaries.map((t) => t.amount);
  
  // Calculate median
  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sortedAmounts.length / 2);
  const median = sortedAmounts.length % 2 !== 0
    ? sortedAmounts[mid]
    : (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2;
  
  // Outlier threshold: 1.3x median (30% more likely has bonus)
  const outlierThreshold = median * 1.3;
  
  // Build salary info with outlier detection
  const salaryInfos: SalaryInfo[] = sortedSalaries.map((t) => ({
    amount: t.amount,
    date: t.date,
    transactionId: t.id!,
    isOutlier: t.amount > outlierThreshold,
  }));
  
  // Calculate average excluding outliers
  const regularSalaries = amounts.filter((a) => a <= outlierThreshold);
  const averageSalary = regularSalaries.length > 0
    ? regularSalaries.reduce((sum, a) => sum + a, 0) / regularSalaries.length
    : median;
  
  // Detect typical salary day
  const salaryDays = sortedSalaries.map((t) => getDate(parseISO(t.date)));
  const dayCount: Record<number, number> = {};
  salaryDays.forEach((d) => {
    dayCount[d] = (dayCount[d] || 0) + 1;
  });
  const typicalDay = Object.entries(dayCount)
    .sort(([, a], [, b]) => b - a)[0];
  const salaryDay = typicalDay ? parseInt(typicalDay[0]) : 25;
  
  // Determine confidence
  let confidence: "high" | "medium" | "low";
  if (regularSalaries.length >= 4) {
    confidence = "high";
  } else if (regularSalaries.length >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }
  
  // Count outliers
  const outlierCount = salaryInfos.filter((s) => s.isOutlier).length;
  
  return {
    averageSalary: Math.round(averageSalary),
    medianSalary: Math.round(median),
    lastSalary: amounts[0] || 0,
    salaryDay,
    salaries: salaryInfos,
    outlierThreshold: Math.round(outlierThreshold),
    confidence,
    salaryCount: salaryInfos.length,
    outlierCount,
  };
}

/**
 * Get the effective budget type for a category (synchronous)
 * Use this when you already have the overrides from useCategoryTypeOverrides()
 */
export function getCategoryBudgetType(
  category: string,
  categoryOverrides: Record<string, BudgetType>
): BudgetType {
  const override = categoryOverrides[category];
  if (override) {
    return override;
  }
  return DEFAULT_CATEGORY_TYPES[category] || "wants";
}

/**
 * Get the effective budget type for a category (async)
 * Checks for user override first, then falls back to default
 */
export async function getCategoryBudgetTypeAsync(category: string): Promise<BudgetType> {
  // Check for override in settings
  const overrides = await getCategoryTypeOverrides();
  const override = overrides[category];
  
  if (override) {
    return override;
  }
  
  return DEFAULT_CATEGORY_TYPES[category] || "wants";
}

/**
 * Get the effective budget type for a transaction (synchronous)
 * Priority: Transaction override > Category override > Default
 */
export function getTransactionBudgetType(
  transaction: Transaction,
  categoryOverrides: Record<string, BudgetType>,
  txOverrides: Record<number, BudgetType>
): BudgetType {
  // 1. Check for transaction-specific override
  const txOverride = txOverrides[transaction.id!];
  if (txOverride) {
    return txOverride;
  }
  
  // 2. Check for category override or default
  return getCategoryBudgetType(transaction.category, categoryOverrides);
}

/**
 * Get the effective budget type for a transaction (async)
 * Priority: Transaction override > Category override > Default
 */
export async function getTransactionBudgetTypeAsync(
  transaction: Transaction
): Promise<BudgetType> {
  // 1. Check for transaction-specific override
  const txOverrides = await getTransactionTypeOverrides();
  const txOverride = txOverrides[transaction.id!];
  if (txOverride) {
    return txOverride;
  }
  
  // 2. Check for category override
  const catType = await getCategoryBudgetTypeAsync(transaction.category);
  return catType;
}

/**
 * Get all category type overrides from settings
 */
export async function getCategoryTypeOverrides(): Promise<Record<string, BudgetType>> {
  const setting = await db.settings.where("key").equals("categoryTypeOverrides").first();
  if (setting) {
    try {
      return JSON.parse(setting.value);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Get all transaction type overrides from settings
 */
export async function getTransactionTypeOverrides(): Promise<Record<number, BudgetType>> {
  const setting = await db.settings.where("key").equals("transactionTypeOverrides").first();
  if (setting) {
    try {
      return JSON.parse(setting.value);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Set category type override
 */
export async function setCategoryTypeOverride(
  category: string,
  budgetType: BudgetType | null // null to remove override
): Promise<void> {
  const overrides = await getCategoryTypeOverrides();
  
  if (budgetType === null) {
    delete overrides[category];
  } else {
    overrides[category] = budgetType;
  }
  
  const existing = await db.settings.where("key").equals("categoryTypeOverrides").first();
  if (existing) {
    await db.settings.update(existing.id!, { value: JSON.stringify(overrides) });
  } else {
    await db.settings.add({ key: "categoryTypeOverrides", value: JSON.stringify(overrides) });
  }
}

/**
 * Set transaction type override
 */
export async function setTransactionTypeOverride(
  transactionId: number,
  budgetType: BudgetType | null // null to remove override
): Promise<void> {
  const overrides = await getTransactionTypeOverrides();
  
  if (budgetType === null) {
    delete overrides[transactionId];
  } else {
    overrides[transactionId] = budgetType;
  }
  
  const existing = await db.settings.where("key").equals("transactionTypeOverrides").first();
  if (existing) {
    await db.settings.update(existing.id!, { value: JSON.stringify(overrides) });
  } else {
    await db.settings.add({ key: "transactionTypeOverrides", value: JSON.stringify(overrides) });
  }
}

/**
 * Calculate spending by type, respecting all overrides
 */
export async function calculateSpendingByType(
  transactions: Transaction[]
): Promise<{ needs: number; wants: number; savings: number }> {
  const categoryOverrides = await getCategoryTypeOverrides();
  const txOverrides = await getTransactionTypeOverrides();
  
  const result = { needs: 0, wants: 0, savings: 0 };
  
  for (const t of transactions) {
    if (t.direction !== "debit") continue;
    
    // Get effective type
    let type: BudgetType;
    
    if (txOverrides[t.id!]) {
      type = txOverrides[t.id!];
    } else if (categoryOverrides[t.category]) {
      type = categoryOverrides[t.category];
    } else {
      type = DEFAULT_CATEGORY_TYPES[t.category] || "wants";
    }
    
    if (type !== "income" && type in result) {
      result[type] += Math.abs(t.amount);
    }
  }
  
  return result;
}

/**
 * Get income for a "salary month" (from last salary to now or current salary)
 * This handles the case where salary comes at end of month
 */
export async function getSalaryMonthIncome(targetDate: Date = new Date()): Promise<{
  income: number;
  periodStart: string;
  periodEnd: string;
  salaryTransaction?: Transaction;
}> {
  const smartIncome = await calculateSmartIncome(6);
  
  if (smartIncome.salaries.length === 0) {
    // No salary detected, fall back to calendar month
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    
    const transactions = await db.transactions
      .where("date")
      .between(
        format(startOfMonth, "yyyy-MM-dd"),
        format(endOfMonth, "yyyy-MM-dd"),
        true,
        true
      )
      .and((t) => t.direction === "credit")
      .toArray();
    
    const income = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      income,
      periodStart: format(startOfMonth, "yyyy-MM-dd"),
      periodEnd: format(endOfMonth, "yyyy-MM-dd"),
    };
  }
  
  // Find the most recent salary before or on target date
  const targetStr = format(targetDate, "yyyy-MM-dd");
  const salariesBeforeTarget = smartIncome.salaries
    .filter((s) => s.date <= targetStr)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (salariesBeforeTarget.length === 0) {
    // Target is before first salary, use first salary as period end
    const firstSalary = smartIncome.salaries[smartIncome.salaries.length - 1];
    return {
      income: firstSalary.amount,
      periodStart: firstSalary.date,
      periodEnd: targetStr,
    };
  }
  
  const currentSalary = salariesBeforeTarget[0];
  const salaryTx = await db.transactions.get(currentSalary.transactionId);
  
  // Period is from this salary to either next salary or end of month
  const nextSalary = smartIncome.salaries.find(
    (s) => s.date > currentSalary.date && s.date <= targetStr
  );
  
  const periodStart = currentSalary.date;
  const periodEnd = nextSalary ? nextSalary.date : targetStr;
  
  return {
    income: currentSalary.amount,
    periodStart,
    periodEnd,
    salaryTransaction: salaryTx,
  };
}

/**
 * Hook to get smart income data reactively
 */
export function useSmartIncome(lookbackMonths: number = 6) {
  return useLiveQuery(
    () => calculateSmartIncome(lookbackMonths),
    [lookbackMonths]
  );
}

/**
 * Hook to get category type overrides reactively
 */
export function useCategoryTypeOverrides() {
  return useLiveQuery(() => getCategoryTypeOverrides(), []);
}

/**
 * Hook to get transaction type overrides reactively  
 */
export function useTransactionTypeOverrides() {
  return useLiveQuery(() => getTransactionTypeOverrides(), []);
}
