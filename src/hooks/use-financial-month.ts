"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { db, Transaction, FinancialMonthSettings, DEFAULT_FINANCIAL_MONTH_SETTINGS } from "@/lib/db";
import {
  FinancialMonth,
  getFinancialMonth,
  getAllFinancialMonths,
  detectSalaryTransactions,
  getFinancialMonthSettings,
  saveFinancialMonthSettings,
  getTransactionsInFinancialMonth,
  syncDetectedSalaries,
} from "@/lib/financial-month";
import { subMonths, addMonths, format, parseISO } from "date-fns";

export interface UseFinancialMonthResult {
  isLoading: boolean;
  currentMonth: FinancialMonth | null;
  allMonths: FinancialMonth[];
  settings: FinancialMonthSettings;
  salaryTransactions: Transaction[];
  
  // Navigation
  selectedMonth: FinancialMonth | null;
  setSelectedMonth: (month: FinancialMonth | null) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  
  // Actions
  updateSettings: (settings: FinancialMonthSettings) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFinancialMonth(accountId: number = 1): UseFinancialMonthResult {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<FinancialMonthSettings>(DEFAULT_FINANCIAL_MONTH_SETTINGS);
  const [salaryTransactions, setSalaryTransactions] = useState<Transaction[]>([]);
  const [allMonths, setAllMonths] = useState<FinancialMonth[]>([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  // Calculate current month based on settings and salary transactions
  const currentMonth = useMemo(() => {
    if (salaryTransactions.length === 0 && settings.mode === 'auto') {
      return null;
    }
    return getFinancialMonth(new Date(), salaryTransactions, settings.mode, settings.fixedDay);
  }, [salaryTransactions, settings]);

  // Get selected month
  const selectedMonth = useMemo(() => {
    if (selectedMonthIndex === null) return currentMonth;
    return allMonths[selectedMonthIndex] || currentMonth;
  }, [selectedMonthIndex, allMonths, currentMonth]);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load settings
      const loadedSettings = await getFinancialMonthSettings();
      setSettings(loadedSettings);

      // Detect salary transactions
      const salaries = await detectSalaryTransactions(accountId, loadedSettings);
      setSalaryTransactions(salaries);

      // Get all financial months
      const months = getAllFinancialMonths(salaries, loadedSettings.mode, loadedSettings.fixedDay);
      setAllMonths(months);

      // Sync to database
      await syncDetectedSalaries(accountId);

      // Reset selection to current month
      setSelectedMonthIndex(null);
    } catch (error) {
      console.error("Error loading financial month data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigation functions
  const setSelectedMonth = useCallback((month: FinancialMonth | null) => {
    if (!month) {
      setSelectedMonthIndex(null);
      return;
    }
    const index = allMonths.findIndex(m => m.id === month.id);
    setSelectedMonthIndex(index >= 0 ? index : null);
  }, [allMonths]);

  const goToPreviousMonth = useCallback(() => {
    if (selectedMonthIndex === null) {
      // Currently at current month, go to second-to-last
      if (allMonths.length > 1) {
        setSelectedMonthIndex(allMonths.length - 2);
      }
    } else if (selectedMonthIndex > 0) {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  }, [selectedMonthIndex, allMonths.length]);

  const goToNextMonth = useCallback(() => {
    if (selectedMonthIndex === null) return; // Already at current
    
    if (selectedMonthIndex < allMonths.length - 1) {
      setSelectedMonthIndex(selectedMonthIndex + 1);
    } else {
      // At the last month, go to current
      setSelectedMonthIndex(null);
    }
  }, [selectedMonthIndex, allMonths.length]);

  const goToCurrentMonth = useCallback(() => {
    setSelectedMonthIndex(null);
  }, []);

  // Update settings
  const updateSettings = useCallback(async (newSettings: FinancialMonthSettings) => {
    await saveFinancialMonthSettings(newSettings);
    setSettings(newSettings);
    
    // Recalculate with new settings
    const salaries = await detectSalaryTransactions(accountId, newSettings);
    setSalaryTransactions(salaries);
    
    const months = getAllFinancialMonths(salaries, newSettings.mode, newSettings.fixedDay);
    setAllMonths(months);
    
    // Reset to current month
    setSelectedMonthIndex(null);
  }, [accountId]);

  return {
    isLoading,
    currentMonth,
    allMonths,
    settings,
    salaryTransactions,
    selectedMonth,
    setSelectedMonth,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    updateSettings,
    refresh: loadData,
  };
}

/**
 * Hook to get transactions for a specific financial month
 */
export function useFinancialMonthTransactions(
  financialMonth: FinancialMonth | null,
  accountId: number = 1
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      if (!financialMonth) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const txs = await getTransactionsInFinancialMonth(financialMonth, accountId);
        setTransactions(txs);
      } catch (error) {
        console.error("Error loading financial month transactions:", error);
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadTransactions();
  }, [financialMonth, accountId]);

  // Calculate totals
  const totals = useMemo(() => {
    const income = transactions
      .filter(t => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = Math.abs(
      transactions
        .filter(t => t.direction === "debit")
        .reduce((sum, t) => sum + t.amount, 0)
    );
    
    return {
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    };
  }, [transactions]);

  return {
    transactions,
    isLoading,
    ...totals,
  };
}
