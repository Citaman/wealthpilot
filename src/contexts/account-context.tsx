"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account } from "@/lib/db";
import { recalculateAllBalances } from "@/lib/balance";
import { useCurrency } from "./currency-context";

interface AccountContextValue {
  accounts: Account[];
  selectedAccountId: number | "all";
  selectedAccount: Account | null;
  setSelectedAccountId: (id: number | "all") => void;
  isLoading: boolean;
  totalBalance: number;
  refreshAccounts: () => Promise<void>;
  recalculateBalances: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | "all">("all");
  const hasRecalculated = useRef(false);
  const { convert } = useCurrency();

  // Live query for accounts - auto-updates when accounts change
  const accounts = useLiveQuery(
    () => db.accounts.filter((a) => a.isActive !== false).toArray(),
    [],
    []
  );

  const isLoading = accounts === undefined;

  // Get selected account object
  const selectedAccount = selectedAccountId === "all" 
    ? null 
    : accounts?.find((a) => a.id === selectedAccountId) || null;

  // Calculate total balance across all accounts (with currency conversion)
  const totalBalance = accounts?.reduce((sum, acc) => {
    const balanceInBase = convert(acc.balance, acc.currency || "EUR");
    // For credit accounts, balance is a liability (negative)
    if (acc.type === "credit") {
      return sum - Math.abs(balanceInBase);
    }
    return sum + balanceInBase;
  }, 0) || 0;

  // Load saved selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedAccountId");
    if (saved) {
      const parsed = saved === "all" ? "all" : parseInt(saved, 10);
      setSelectedAccountId(parsed);
    }
  }, []);

  // Auto-recalculate balances on app load (once)
  useEffect(() => {
    const autoRecalculate = async () => {
      if (hasRecalculated.current) return;
      if (!accounts || accounts.length === 0) return;
      
      // Check if there are transactions
      const txCount = await db.transactions.count();
      if (txCount === 0) return;
      
      hasRecalculated.current = true;
      console.log("[WealthPilot] Auto-recalculating balances on app load...");
      await recalculateAllBalances();
      console.log("[WealthPilot] Balance recalculation complete");
    };

    autoRecalculate();
  }, [accounts]);

  // Save selection to localStorage
  const handleSetSelectedAccountId = useCallback((id: number | "all") => {
    setSelectedAccountId(id);
    localStorage.setItem("selectedAccountId", String(id));
  }, []);

  // Ensure default account exists
  useEffect(() => {
    const ensureDefaultAccount = async () => {
      if (!accounts || accounts.length > 0) return;
      
      // Create default account if none exist
      const now = new Date().toISOString();
      await db.accounts.add({
        name: "Main Account",
        type: "checking",
        balance: 0,
        currency: "EUR",
        institution: "",
        color: "#3b82f6",
        isActive: true,
        initialBalance: 0,
        initialBalanceDate: now,
        createdAt: now,
        updatedAt: now,
      });
    };

    ensureDefaultAccount();
  }, [accounts]);

  const refreshAccounts = useCallback(async () => {
    // With useLiveQuery, this is automatic, but keep for API compatibility
  }, []);

  const recalculateBalancesCallback = useCallback(async () => {
    await recalculateAllBalances();
  }, []);

  return (
    <AccountContext.Provider
      value={{
        accounts: accounts || [],
        selectedAccountId,
        selectedAccount,
        setSelectedAccountId: handleSetSelectedAccountId,
        isLoading,
        totalBalance,
        refreshAccounts,
        recalculateBalances: recalculateBalancesCallback,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
