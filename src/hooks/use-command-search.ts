"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Transaction, type Account, type Goal } from "@/lib/db";
import { useMemo } from "react";

export interface SearchResult {
  type: "transaction" | "account" | "goal" | "navigation";
  id: string | number;
  title: string;
  subtitle: string;
  amount?: number;
  href?: string;
  category?: string;
}

export function useCommandSearch(query: string) {
  const transactions = useLiveQuery(() => db.transactions.limit(1000).toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const goals = useLiveQuery(() => db.goals.toArray());

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];

    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 1. Natural Language Parsing (Simple)
    let amountFilter: { type: 'gt' | 'lt', val: number } | null = null;
    const amountMatch = query.match(/([><])\s*(\d+)/);
    if (amountMatch) {
      amountFilter = {
        type: amountMatch[1] === '>' ? 'gt' : 'lt',
        val: parseInt(amountMatch[2], 10)
      };
    }

    // 2. Search Accounts
    accounts?.forEach(acc => {
      if (acc.name.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: "account",
          id: acc.id!,
          title: acc.name,
          subtitle: `${acc.type} account`,
          amount: acc.balance,
          href: "/accounts"
        });
      }
    });

    // 3. Search Goals
    goals?.forEach(goal => {
      if (goal.name.toLowerCase().includes(lowerQuery)) {
        searchResults.push({
          type: "goal",
          id: goal.id!,
          title: goal.name,
          subtitle: "Savings Goal",
          amount: goal.currentAmount,
          href: `/goals/${goal.id}`
        });
      }
    });

    // 4. Search Transactions (with NL support)
    transactions?.forEach(tx => {
      const merchantMatch = tx.merchant.toLowerCase().includes(lowerQuery);
      const categoryMatch = tx.category.toLowerCase().includes(lowerQuery);
      
      let matches = merchantMatch || categoryMatch;

      // Apply NL amount filter if present
      if (amountFilter) {
        const absAmount = Math.abs(tx.amount);
        const amountCondition = amountFilter.type === 'gt' ? absAmount > amountFilter.val : absAmount < amountFilter.val;
        matches = amountCondition && (query.length < 5 || merchantMatch || categoryMatch);
      }

      if (matches) {
        searchResults.push({
          type: "transaction",
          id: tx.id!,
          title: tx.merchant,
          subtitle: `${tx.date} • ${tx.category}`,
          amount: tx.amount,
          href: "/transactions"
        });
      }
    });

    return searchResults.slice(0, 15); // Limit to top 15 results
  }, [query, transactions, accounts, goals]);

  return results;
}
