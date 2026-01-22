"use client";

import { useMemo, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  Transaction,
  Goal,
  GoalContribution,
  Budget,
  Account,
  MerchantRule,
  ImportRule,
} from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { recalculateBalances } from "@/lib/balance";

// Simple category stats type for dashboard
export interface SimpleCategoryStats {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

// =============================================================================
// DASHBOARD HOOK - Reactive with useLiveQuery
// =============================================================================

export interface DashboardData {
  isLoading: boolean;
  hasData: boolean;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  monthlyStats: { month: string; income: number; expenses: number }[];
  categoryStats: SimpleCategoryStats[];
  recentTransactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  accounts: Account[];
  insights: { type: string; message: string }[];
  incomeChange: number;
  expenseChange: number;
}

export function useDashboard() {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  // Previous month for comparison
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const prevStartStr = format(prevStart, 'yyyy-MM-dd');
  const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

  // Last 6 months for cash flow chart
  const sixMonthsAgo = startOfMonth(subMonths(now, 5));
  const sixMonthsAgoStr = format(sixMonthsAgo, 'yyyy-MM-dd');

  // Live queries - these automatically update when data changes
  const currentMonthTx = useLiveQuery(
    () => db.transactions
      .where("date")
      .between(startStr, endStr, true, true)
      .toArray(),
    [startStr, endStr]
  );

  const prevMonthTx = useLiveQuery(
    () => db.transactions
      .where("date")
      .between(prevStartStr, prevEndStr, true, true)
      .toArray(),
    [prevStartStr, prevEndStr]
  );

  // Last 6 months transactions for cash flow chart
  const last6MonthsTx = useLiveQuery(
    () => db.transactions
      .where("date")
      .between(sixMonthsAgoStr, endStr, true, true)
      .toArray(),
    [sixMonthsAgoStr, endStr]
  );

  const recentTransactions = useLiveQuery(
    () => db.transactions.orderBy("date").reverse().limit(10).toArray()
  );

  const goals = useLiveQuery(() => db.goals.toArray());
  const budgets = useLiveQuery(() => db.budgets.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());

  // Compute derived values
  const data = useMemo((): DashboardData => {
    if (!currentMonthTx || !prevMonthTx || !recentTransactions || !accounts || !last6MonthsTx) {
      return {
        isLoading: true,
        hasData: false,
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        savingsRate: 0,
        monthlyStats: [],
        categoryStats: [],
        recentTransactions: [],
        goals: goals || [],
        budgets: budgets || [],
        accounts: accounts || [],
        insights: [],
        incomeChange: 0,
        expenseChange: 0,
      };
    }

    // Calculate totals for current month
    const totalIncome = currentMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(
      currentMonthTx
        .filter((t) => t.direction === "debit")
        .reduce((sum, t) => sum + t.amount, 0)
    );

    // Calculate totals for previous month
    const prevIncome = prevMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const prevExpenses = Math.abs(
      prevMonthTx
        .filter((t) => t.direction === "debit")
        .reduce((sum, t) => sum + t.amount, 0)
    );

    // Calculate changes
    const incomeChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0;
    const expenseChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Total balance from all accounts
    const balance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Monthly stats for last 6 months (for cash flow chart)
    const monthlyStats: { month: string; income: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM');
      
      const monthTxs = last6MonthsTx.filter((tx) => {
        const txDate = new Date(tx.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });
      
      const monthIncome = monthTxs
        .filter((t) => t.direction === "credit")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthExpenses = Math.abs(
        monthTxs
          .filter((t) => t.direction === "debit")
          .reduce((sum, t) => sum + t.amount, 0)
      );
      
      monthlyStats.push({
        month: monthLabel,
        income: monthIncome,
        expenses: monthExpenses,
      });
    }

    // Category stats for current month
    const categoryStats: SimpleCategoryStats[] = [];
    const categoryMap = new Map<string, { amount: number; count: number }>();
    currentMonthTx
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        const existing = categoryMap.get(t.category) || { amount: 0, count: 0 };
        categoryMap.set(t.category, { 
          amount: existing.amount + Math.abs(t.amount), 
          count: existing.count + 1 
        });
      });
    categoryMap.forEach((data, category) => {
      categoryStats.push({ category, amount: data.amount, percentage: 0, count: data.count });
    });
    const totalCat = categoryStats.reduce((s, c) => s + c.amount, 0);
    categoryStats.forEach((c) => {
      c.percentage = totalCat > 0 ? (c.amount / totalCat) * 100 : 0;
    });
    categoryStats.sort((a, b) => b.amount - a.amount);

    return {
      isLoading: false,
      hasData: recentTransactions.length > 0,
      totalIncome,
      totalExpenses,
      balance,
      savingsRate,
      monthlyStats,
      categoryStats,
      recentTransactions,
      goals: goals || [],
      budgets: budgets || [],
      accounts,
      insights: [],
      incomeChange,
      expenseChange,
    };
  }, [currentMonthTx, prevMonthTx, last6MonthsTx, recentTransactions, goals, budgets, accounts]);

  return data;
}

// =============================================================================
// TRANSACTIONS HOOK - Reactive with useLiveQuery
// =============================================================================

export function useTransactions(filters?: {
  category?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  accountId?: number | "all";
  excludeExcluded?: boolean;
}) {
  const startDateStr = filters?.startDate ? format(filters.startDate, 'yyyy-MM-dd') : undefined;
  const endDateStr = filters?.endDate ? format(filters.endDate, 'yyyy-MM-dd') : undefined;
  const category = filters?.category;
  const search = filters?.search?.toLowerCase();
  const accountId = filters?.accountId;
  const excludeExcluded = filters?.excludeExcluded;

  // Live query with filters applied
  const transactions = useLiveQuery(
    async () => {
      let txs: Transaction[];

      if (startDateStr && endDateStr) {
        txs = await db.transactions
          .where("date")
          .between(startDateStr, endDateStr, true, true)
          .toArray();
      } else {
        txs = await db.transactions.orderBy("date").reverse().toArray();
      }

      // Apply filters
      let filtered = txs;

      if (accountId && accountId !== "all") {
        filtered = filtered.filter((t) => t.accountId === accountId);
      }

      if (category) {
        filtered = filtered.filter((t) => t.category === category);
      }

      if (search) {
        filtered = filtered.filter(
          (t) =>
            t.merchant.toLowerCase().includes(search) ||
            t.description.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search)
        );
      }

      if (excludeExcluded) {
        filtered = filtered.filter((t) => !t.isExcluded);
      }

      return filtered.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    [startDateStr, endDateStr, category, search, accountId, excludeExcluded]
  );

  // Transaction mutations
  const updateTransaction = useCallback(async (id: number, updates: Partial<Transaction>) => {
    const tx = await db.transactions.get(id);
    await db.transactions.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    if (tx) {
      await recalculateBalances(tx.accountId);
    }
  }, []);

  const updateTransactions = useCallback(async (ids: number[], updates: Partial<Transaction>) => {
    const now = new Date().toISOString();
    const txs = await db.transactions.where('id').anyOf(ids).toArray();
    const accountIds = new Set(txs.map(t => t.accountId));

    await db.transactions.bulkUpdate(
      ids.map((id) => ({
        key: id,
        changes: { ...updates, updatedAt: now },
      }))
    );

    for (const accId of accountIds) {
      await recalculateBalances(accId);
    }
  }, []);

  const deleteTransaction = useCallback(async (id: number) => {
    const tx = await db.transactions.get(id);
    await db.transactions.delete(id);
    if (tx) {
      await recalculateBalances(tx.accountId);
    }
  }, []);

  const deleteTransactions = useCallback(async (ids: number[]) => {
    const txs = await db.transactions.where('id').anyOf(ids).toArray();
    const accountIds = new Set(txs.map(t => t.accountId));

    await db.transactions.bulkDelete(ids);

    for (const accId of accountIds) {
      await recalculateBalances(accId);
    }
  }, []);

  const findSimilarTransactions = useCallback(async (merchantOriginal: string): Promise<Transaction[]> => {
    return db.transactions
      .filter((t) => t.merchantOriginal === merchantOriginal || t.merchant === merchantOriginal)
      .toArray();
  }, []);

  return {
    transactions: transactions || [],
    isLoading: transactions === undefined,
    updateTransaction,
    updateTransactions,
    deleteTransaction,
    deleteTransactions,
    findSimilarTransactions,
  };
}

// =============================================================================
// GOALS HOOK - Reactive with useLiveQuery
// =============================================================================

export function useGoals() {
  const goals = useLiveQuery(() => db.goals.toArray());

  const addGoal = useCallback(async (goal: Omit<Goal, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    await db.goals.add({
      ...goal,
      createdAt: now,
      updatedAt: now,
    } as Goal);
  }, []);

  const updateGoal = useCallback(async (id: number, updates: Partial<Goal>) => {
    await db.goals.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteGoal = useCallback(async (id: number) => {
    await db.goals.delete(id);
  }, []);

  return {
    goals: goals || [],
    isLoading: goals === undefined,
    addGoal,
    updateGoal,
    deleteGoal,
  };
}

// =============================================================================
// GOAL CONTRIBUTIONS - History + atomic updates (v0.10.0)
// =============================================================================

export function useGoalContributions(goalId?: number) {
  const contributions = useLiveQuery(async () => {
    if (goalId === undefined) {
      return db.goalContributions.toArray();
    }
    return db.goalContributions.where("goalId").equals(goalId).toArray();
  }, [goalId]);

  return {
    contributions: contributions || [],
    isLoading: contributions === undefined,
  };
}

export function useGoalContributionActions() {
  const addContribution = useCallback(
    async (params: {
      goalId: number;
      amount: number;
      date?: string;
      note?: string;
    }) => {
      const { goalId, amount } = params;
      const date = params.date || new Date().toISOString().split("T")[0];
      const note = params.note?.trim() || undefined;

      if (!Number.isFinite(amount) || amount === 0) {
        throw new Error("Invalid contribution amount");
      }

      await db.transaction("rw", db.goalContributions, db.goals, async () => {
        const goal = await db.goals.get(goalId);
        if (!goal) throw new Error("Goal not found");

        const newAmount = goal.currentAmount + amount;
        if (newAmount < 0) {
          throw new Error("Contribution would make goal balance negative");
        }

        const now = new Date().toISOString();
        await db.goalContributions.add({
          goalId,
          date,
          amount,
          note,
          createdAt: now,
        } as GoalContribution);

        await db.goals.update(goalId, {
          currentAmount: newAmount,
          isActive: newAmount < goal.targetAmount,
          updatedAt: now,
        });
      });
    },
    []
  );

  const deleteContribution = useCallback(async (contributionId: number) => {
    await db.transaction("rw", db.goalContributions, db.goals, async () => {
      const contribution = await db.goalContributions.get(contributionId);
      if (!contribution) return;

      const goal = await db.goals.get(contribution.goalId);
      if (!goal) {
        await db.goalContributions.delete(contributionId);
        return;
      }

      const newAmount = goal.currentAmount - contribution.amount;
      if (newAmount < 0) {
        throw new Error("Delete would make goal balance negative");
      }

      const now = new Date().toISOString();
      await db.goals.update(goal.id!, {
        currentAmount: newAmount,
        isActive: newAmount < goal.targetAmount,
        updatedAt: now,
      });
      await db.goalContributions.delete(contributionId);
    });
  }, []);

  return {
    addContribution,
    deleteContribution,
  };
}

// =============================================================================
// BUDGETS HOOK - Reactive with useLiveQuery
// =============================================================================

export function useBudgets() {
  const budgets = useLiveQuery(() => db.budgets.toArray());

  const setBudget = useCallback(async (category: string, amount: number, year: number, month?: number) => {
    const existing = await db.budgets
      .where("[category+year]")
      .equals([category, year])
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await db.budgets.update(existing.id!, {
        amount,
        updatedAt: now,
      });
    } else {
      await db.budgets.add({
        category,
        amount,
        period: month ? "monthly" : "yearly",
        year,
        month,
        createdAt: now,
        updatedAt: now,
      } as Budget);
    }
  }, []);

  return {
    budgets: budgets || [],
    isLoading: budgets === undefined,
    setBudget,
  };
}

// =============================================================================
// ACCOUNTS HOOK - Reactive with useLiveQuery
// =============================================================================

export function useAccounts() {
  const accounts = useLiveQuery(() => db.accounts.toArray());

  const createAccount = useCallback(async (accountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> => {
    const now = new Date().toISOString();
    const id = await db.accounts.add({
      ...accountData,
      createdAt: now,
      updatedAt: now,
    } as Account);
    return id;
  }, []);

  const updateAccount = useCallback(async (id: number, updates: Partial<Account>) => {
    await db.accounts.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteAccount = useCallback(async (id: number) => {
    await db.accounts.delete(id);
  }, []);

  return {
    accounts: accounts || [],
    isLoading: accounts === undefined,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}

// =============================================================================
// MERCHANT RULES HOOK - Reactive with useLiveQuery
// =============================================================================

export function useMerchantRules() {
  const rules = useLiveQuery(() => db.merchantRules.toArray());

  const addRule = useCallback(async (rule: Omit<MerchantRule, 'id' | 'createdAt' | 'updatedAt' | 'matchCount'>) => {
    const now = new Date().toISOString();
    await db.merchantRules.add({
      ...rule,
      matchCount: 0,
      createdAt: now,
      updatedAt: now,
    } as MerchantRule);
  }, []);

  const updateRule = useCallback(async (id: number, updates: Partial<MerchantRule>) => {
    await db.merchantRules.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteRule = useCallback(async (id: number) => {
    await db.merchantRules.delete(id);
  }, []);

  const applyRules = useCallback((description: string): { merchantName?: string; category?: string; subcategory?: string } | null => {
    if (!rules) return null;
    for (const rule of rules.filter(r => r.isActive)) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(description)) {
          return {
            merchantName: rule.merchantName,
            category: rule.category,
            subcategory: rule.subcategory,
          };
        }
      } catch {
        // Invalid regex, skip
      }
    }
    return null;
  }, [rules]);

  const createRuleFromTransaction = useCallback(async (
    originalMerchant: string,
    newMerchant: string,
    category?: string,
    subcategory?: string
  ) => {
    const pattern = originalMerchant
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s*');

    await addRule({
      pattern,
      merchantName: newMerchant,
      category,
      subcategory,
      isActive: true,
    });
  }, [addRule]);

  return {
    rules: rules || [],
    isLoading: rules === undefined,
    addRule,
    updateRule,
    deleteRule,
    applyRules,
    createRuleFromTransaction,
  };
}

// =============================================================================
// IMPORT RULES HOOK - Reactive with useLiveQuery
// =============================================================================

export function useImportRules() {
  const rules = useLiveQuery(() => db.importRules.orderBy('priority').toArray());

  const addRule = useCallback(async (rule: Omit<ImportRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    await db.importRules.add({
      ...rule,
      createdAt: now,
      updatedAt: now,
    } as ImportRule);
  }, []);

  const updateRule = useCallback(async (id: number, updates: Partial<ImportRule>) => {
    await db.importRules.update(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteRule = useCallback(async (id: number) => {
    await db.importRules.delete(id);
  }, []);

  const applyRules = useCallback((
    description: string,
    merchant: string,
    amount: number
  ): { category?: string; subcategory?: string; merchantName?: string } | null => {
    if (!rules) return null;
    for (const rule of rules.filter(r => r.isActive)) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        let textToMatch = '';

        switch (rule.field) {
          case 'description':
            textToMatch = description;
            break;
          case 'merchant':
            textToMatch = merchant;
            break;
          case 'amount':
            textToMatch = amount.toString();
            break;
        }

        if (regex.test(textToMatch)) {
          return {
            category: rule.category,
            subcategory: rule.subcategory,
            merchantName: rule.merchantName,
          };
        }
      } catch {
        // Invalid regex, skip
      }
    }
    return null;
  }, [rules]);

  return {
    rules: rules || [],
    isLoading: rules === undefined,
    addRule,
    updateRule,
    deleteRule,
    applyRules,
  };
}

// =============================================================================
// TAGS HOOK - Reactive with useLiveQuery
// =============================================================================

export function useAllTags() {
  const transactions = useLiveQuery(() => db.transactions.toArray());

  const tags = useMemo(() => {
    if (!transactions) return [];
    const allTags = new Set<string>();
    transactions.forEach(t => {
      t.tags?.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }, [transactions]);

  return tags;
}
