"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account } from "@/lib/db";
import { useMemo, useEffect, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { useMoney } from "@/hooks/use-money";

export interface SearchResult {
  type: "transaction" | "account" | "goal" | "navigation" | "merchant" | "category";
  id: string | number;
  title: string;
  subtitle: string;
  amount?: number;
  href?: string;
  category?: string;
  accountId?: number;
}

const NAV_ITEMS = [
  {
    id: "dashboard",
    title: "Dashboard",
    subtitle: "Go to dashboard",
    href: "/",
    keywords: ["home", "overview"],
  },
  {
    id: "transactions",
    title: "Transactions",
    subtitle: "Review activity",
    href: "/transactions",
    keywords: ["payments", "spend", "income"],
  },
  {
    id: "budgets",
    title: "Budgets",
    subtitle: "Plan spending",
    href: "/budgets",
    keywords: ["plan", "limits", "allocations"],
  },
  {
    id: "analytics",
    title: "Analytics",
    subtitle: "Insights and trends",
    href: "/analytics",
    keywords: ["reports", "insights", "trends"],
  },
  {
    id: "goals",
    title: "Goals",
    subtitle: "Track savings",
    href: "/goals",
    keywords: ["targets", "savings"],
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    subtitle: "Recurring payments",
    href: "/subscriptions",
    keywords: ["recurring", "bills"],
  },
  {
    id: "accounts",
    title: "Accounts",
    subtitle: "Manage accounts",
    href: "/accounts",
    keywords: ["banks", "cards"],
  },
  {
    id: "import",
    title: "Import",
    subtitle: "Upload CSV",
    href: "/import",
    keywords: ["csv", "upload"],
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Preferences",
    href: "/settings",
    keywords: ["preferences", "config"],
  },
];

const DEBOUNCE_MS = 200;

type AmountFilter = {
  op: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
};

const parseAmount = (raw: string) => {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;

  let multiplier = 1;
  let numeric = cleaned;
  const suffix = cleaned[cleaned.length - 1].toLowerCase();
  if (suffix === "k") {
    multiplier = 1_000;
    numeric = cleaned.slice(0, -1);
  } else if (suffix === "m") {
    multiplier = 1_000_000;
    numeric = cleaned.slice(0, -1);
  }

  const value = Number.parseFloat(numeric);
  if (!Number.isFinite(value)) return null;
  return value * multiplier;
};

const scoreMatch = (value: string, term: string) => {
  if (!value) return 0;
  if (value === term) return 5;
  if (value.startsWith(term)) return 3;
  if (value.includes(term)) return 1;
  return 0;
};

const scoreForTerms = (value: string, terms: string[]) => {
  if (!value) return 0;
  const lower = value.toLowerCase();
  return terms.reduce((sum, term) => sum + scoreMatch(lower, term), 0);
};

export function useCommandSearch(query: string) {
  const { convertFromAccount } = useMoney();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy("date").reverse().limit(2000).toArray()
  );
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const goals = useLiveQuery(() => db.goals.toArray());

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const results = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized || normalized.length < 2) return [];

    const now = new Date();

    const filters: {
      amount: AmountFilter | null;
      account: string | null;
      category: string | null;
      merchant: string | null;
      tags: string[];
      direction: "credit" | "debit" | null;
      dateRange: { start: Date; end: Date } | null;
    } = {
      amount: null,
      account: null,
      category: null,
      merchant: null,
      tags: [],
      direction: null,
      dateRange: null,
    };

    let textQuery = normalized;

    const tokenRegex = /\b(account|acct|category|cat|merchant|tag|type):(?:"([^"]+)"|([^\s]+))/gi;
    for (const match of normalized.matchAll(tokenRegex)) {
      const key = match[1];
      const value = (match[2] || match[3] || "").toLowerCase();
      if (!value) continue;

      if (key === "account" || key === "acct") filters.account = value;
      if (key === "category" || key === "cat") filters.category = value;
      if (key === "merchant") filters.merchant = value;
      if (key === "tag") filters.tags.push(value);
      if (key === "type") {
        if (value.startsWith("inc") || value.startsWith("cred")) filters.direction = "credit";
        if (value.startsWith("exp") || value.startsWith("deb")) filters.direction = "debit";
      }

      textQuery = textQuery.replace(match[0], " ");
    }

    const hashTagRegex = /#([a-z0-9_-]+)/gi;
    for (const match of normalized.matchAll(hashTagRegex)) {
      if (match[1]) filters.tags.push(match[1].toLowerCase());
      textQuery = textQuery.replace(match[0], " ");
    }

    const amountRegex = /(?:^|\s)(<=|>=|<|>|=)\s*([0-9][0-9.,kKmM]*)/;
    const amountMatch = normalized.match(amountRegex);
    if (amountMatch) {
      const value = parseAmount(amountMatch[2]);
      if (value !== null) {
        const op = amountMatch[1] as "<" | ">" | "<=" | ">=" | "=";
        const opMap: Record<typeof op, AmountFilter["op"]> = {
          ">": "gt",
          ">=": "gte",
          "<": "lt",
          "<=": "lte",
          "=": "eq",
        };
        filters.amount = { op: opMap[op], value };
      }
      textQuery = textQuery.replace(amountMatch[0], " ");
    }

    if (!filters.amount) {
      const overMatch = normalized.match(/\b(over|above|greater than|more than)\s+([0-9][0-9.,kKmM]*)/);
      if (overMatch) {
        const value = parseAmount(overMatch[2]);
        if (value !== null) filters.amount = { op: "gt", value };
      }
      const underMatch = normalized.match(/\b(under|below|less than)\s+([0-9][0-9.,kKmM]*)/);
      if (underMatch) {
        const value = parseAmount(underMatch[2]);
        if (value !== null) filters.amount = { op: "lt", value };
      }
    }

    if (!filters.direction) {
      if (/\b(income|salary|refund|credit)\b/.test(normalized)) filters.direction = "credit";
      if (/\b(expense|spend|spent|debit|purchase)\b/.test(normalized)) filters.direction = "debit";
    }

    if (/\btoday\b/.test(normalized)) {
      filters.dateRange = { start: startOfDay(now), end: endOfDay(now) };
    } else if (/\byesterday\b/.test(normalized)) {
      const day = subDays(now, 1);
      filters.dateRange = { start: startOfDay(day), end: endOfDay(day) };
    } else if (/\bthis month\b/.test(normalized)) {
      filters.dateRange = { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (/\blast month\b/.test(normalized)) {
      const month = subMonths(now, 1);
      filters.dateRange = { start: startOfMonth(month), end: endOfMonth(month) };
    } else if (/\bthis week\b/.test(normalized)) {
      filters.dateRange = {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    } else if (/\blast week\b/.test(normalized)) {
      const week = subWeeks(now, 1);
      filters.dateRange = {
        start: startOfWeek(week, { weekStartsOn: 1 }),
        end: endOfWeek(week, { weekStartsOn: 1 }),
      };
    } else {
      const rangeMatch = normalized.match(/\b(last|past)\s+(\d+)\s+(day|days|week|weeks|month|months)\b/);
      if (rangeMatch) {
        const count = parseInt(rangeMatch[2], 10);
        if (Number.isFinite(count) && count > 0) {
          let start: Date;
          if (rangeMatch[3].startsWith("day")) {
            start = subDays(now, count);
          } else if (rangeMatch[3].startsWith("week")) {
            start = subWeeks(now, count);
          } else {
            start = subMonths(now, count);
          }
          filters.dateRange = { start, end: now };
        }
      }
    }

    const terms = textQuery.split(/\s+/).filter(Boolean);
    const accountsById = new Map<number, Account>();
    accounts?.forEach((acc) => {
      if (acc.id !== undefined) accountsById.set(acc.id, acc);
    });

    const scoredResults: Array<SearchResult & { score: number }> = [];

    const accountQuery = (filters.account || textQuery || normalized).trim();
    const accountTerms = accountQuery.split(/\s+/).filter(Boolean);
    if (accounts && accountTerms.length > 0) {
      accounts.forEach((acc) => {
        const haystack = `${acc.name} ${acc.institution} ${acc.type}`.toLowerCase();
        const score = scoreForTerms(haystack, accountTerms);
        if (score > 0) {
          scoredResults.push({
            type: "account",
            id: acc.id || acc.name,
            title: acc.name,
            subtitle: `${acc.type} account`,
            amount: acc.balance,
            href: "/accounts",
            accountId: acc.id,
            score: score + 0.5,
          });
        }
      });
    }

    const goalTerms = (terms.length > 0 ? terms : normalized.split(/\s+/)).filter(Boolean);
    if (goals && goalTerms.length > 0) {
      goals.forEach((goal) => {
        const score = scoreForTerms(goal.name, goalTerms);
        if (score > 0) {
          scoredResults.push({
            type: "goal",
            id: goal.id || goal.name,
            title: goal.name,
            subtitle: "Savings goal",
            amount: goal.currentAmount,
            href: `/goals/${goal.id}`,
            score: score + 0.2,
          });
        }
      });
    }

    const navTerms = (terms.length > 0 ? terms : normalized.split(/\s+/)).filter(Boolean);
    if (navTerms.length > 0) {
      NAV_ITEMS.forEach((item) => {
        const titleScore = scoreForTerms(item.title, navTerms);
        const keywordScore = item.keywords.reduce((sum, keyword) => sum + scoreForTerms(keyword, navTerms), 0);
        const score = titleScore * 1.5 + keywordScore;
        if (score > 0) {
          scoredResults.push({
            type: "navigation",
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            href: item.href,
            score: score + 0.1,
          });
        }
      });
    }

    if (transactions) {
      transactions.forEach((tx) => {
        const account = accountsById.get(tx.accountId);
        const accountName = account?.name?.toLowerCase() || "";

        if (filters.account && !accountName.includes(filters.account)) return;
        if (filters.category && !tx.category.toLowerCase().includes(filters.category)) return;
        if (filters.merchant && !tx.merchant.toLowerCase().includes(filters.merchant)) return;
        if (filters.tags.length > 0) {
          const tags = (tx.tags || []).map((tag) => tag.toLowerCase());
          const hasTag = filters.tags.some((tag) => tags.includes(tag));
          if (!hasTag) return;
        }
        if (filters.direction) {
          if (filters.direction === "credit" && tx.amount < 0) return;
          if (filters.direction === "debit" && tx.amount > 0) return;
        }
        if (filters.dateRange) {
          const date = new Date(tx.date);
          if (date < filters.dateRange.start || date > filters.dateRange.end) return;
        }
        if (filters.amount) {
          const baseAmount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
          const compare = filters.amount.op;
          if (compare === "gt" && !(baseAmount > filters.amount.value)) return;
          if (compare === "gte" && !(baseAmount >= filters.amount.value)) return;
          if (compare === "lt" && !(baseAmount < filters.amount.value)) return;
          if (compare === "lte" && !(baseAmount <= filters.amount.value)) return;
          if (compare === "eq" && !(Math.abs(baseAmount - filters.amount.value) < 0.01)) return;
        }

        const fieldValues = [
          tx.merchant,
          tx.description,
          tx.category,
          tx.subcategory,
          tx.notes || "",
          account?.name || "",
          account?.institution || "",
          ...(tx.tags || []),
        ].map((field) => field.toLowerCase());

        let textScore = 0;
        if (terms.length === 0) {
          textScore = 1;
        } else {
          textScore = terms.reduce((sum, term) => {
            const best = fieldValues.reduce((max, field) => Math.max(max, scoreMatch(field, term)), 0);
            return sum + best;
          }, 0);
        }

        if (terms.length > 0 && textScore === 0) return;

        const txDate = new Date(tx.date);
        const daysAgo = Math.max(0, (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
        const recencyBoost = Math.max(0, 30 - daysAgo) / 30;

        const score = textScore + recencyBoost;

        scoredResults.push({
          type: "transaction",
          id: tx.id || `${tx.merchant}-${tx.date}`,
          title: tx.merchant,
          subtitle: `${tx.date} • ${tx.category}${account?.name ? ` • ${account.name}` : ""}`,
          amount: tx.amount,
          href: "/transactions",
          accountId: tx.accountId,
          score,
        });
      });

      const suggestionQuery = textQuery.trim();
      if (suggestionQuery.length >= 2) {
        const merchantMap = new Map<string, { score: number; count: number }>();
        const categoryMap = new Map<string, { score: number; count: number }>();

        transactions.forEach((tx) => {
          const merchant = tx.merchant?.trim();
          if (merchant) {
            const score = scoreMatch(merchant.toLowerCase(), suggestionQuery);
            if (score > 0) {
              const existing = merchantMap.get(merchant) || { score, count: 0 };
              merchantMap.set(merchant, {
                score: Math.max(existing.score, score),
                count: existing.count + 1,
              });
            }
          }

          const category = tx.category?.trim();
          if (category) {
            const score = scoreMatch(category.toLowerCase(), suggestionQuery);
            if (score > 0) {
              const existing = categoryMap.get(category) || { score, count: 0 };
              categoryMap.set(category, {
                score: Math.max(existing.score, score),
                count: existing.count + 1,
              });
            }
          }
        });

        merchantMap.forEach((meta, merchant) => {
          scoredResults.push({
            type: "merchant",
            id: `merchant-${merchant}`,
            title: merchant,
            subtitle: "Merchant",
            href: `/transactions?q=${encodeURIComponent(merchant)}`,
            score: meta.score + meta.count / 10,
          });
        });

        categoryMap.forEach((meta, category) => {
          scoredResults.push({
            type: "category",
            id: `category-${category}`,
            title: category,
            subtitle: "Category",
            href: `/transactions?q=${encodeURIComponent(category)}`,
            score: meta.score + meta.count / 10,
          });
        });
      }
    }

    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ score, ...rest }) => rest);
  }, [debouncedQuery, transactions, accounts, goals, convertFromAccount]);

  return results;
}
