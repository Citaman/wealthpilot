// Budget type utilities for needs/wants/savings classification
// This module provides smart income calculation and type override management

import { db, type Transaction } from "./db";
import { useLiveQuery } from "dexie-react-hooks";

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