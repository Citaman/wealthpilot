"use client";

import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from "date-fns";
import { db, type Budget, type Transaction, type RecurringTransaction, type Notification } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";

const buildBudgetNotifications = (
  budgets: Budget[],
  transactions: Transaction[],
  convertFromAccount: (amount: number, accountId?: number) => number
): Notification[] => {
  const now = new Date();
  const monthKey = format(now, "yyyy-MM");

  const spendByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.isExcluded) continue;
    if (tx.direction !== "debit") continue;
    const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
    spendByCategory.set(tx.category, (spendByCategory.get(tx.category) || 0) + amount);
  }

  const notifications: Notification[] = [];
  for (const budget of budgets) {
    if (budget.year !== now.getFullYear()) continue;
    const budgetAmount = budget.period === "yearly" ? budget.amount / 12 : budget.amount;
    if (budgetAmount <= 0) continue;

    const spent = spendByCategory.get(budget.category) || 0;
    if (spent >= budgetAmount) {
      notifications.push({
        id: `budget-overrun-${budget.category}-${monthKey}`,
        type: "budget",
        title: `${budget.category} budget exceeded`,
        body: `You crossed your ${budget.category} limit for this month.`,
        createdAt: new Date().toISOString(),
        actionHref: "/budgets",
        payload: { category: budget.category, spent, budgetAmount },
      });
    } else if (spent >= budgetAmount * 0.9) {
      notifications.push({
        id: `budget-warning-${budget.category}-${monthKey}`,
        type: "budget",
        title: `${budget.category} budget near limit`,
        body: `You're at ${Math.round((spent / budgetAmount) * 100)}% of your ${budget.category} budget.`,
        createdAt: new Date().toISOString(),
        actionHref: "/budgets",
        payload: { category: budget.category, spent, budgetAmount },
      });
    }
  }

  return notifications;
};

const buildSubscriptionNotifications = (
  recurring: RecurringTransaction[]
): Notification[] => {
  const now = new Date();
  const notifications: Notification[] = [];

  for (const item of recurring) {
    if (item.status !== "active") continue;
    if (item.isExcluded) continue;
    if (!item.nextExpected) continue;

    const nextDate = parseISO(item.nextExpected);
    const daysAway = differenceInCalendarDays(nextDate, now);
    if (daysAway < 0 || daysAway > 7) continue;

    notifications.push({
      id: `subscription-due-${item.id}-${item.nextExpected}`,
      type: "subscription",
      title: `${item.name} due in ${daysAway} day${daysAway === 1 ? "" : "s"}`,
      body: `${item.category} payment scheduled soon.`,
      createdAt: new Date().toISOString(),
      actionHref: "/subscriptions",
      payload: { recurringId: item.id, nextExpected: item.nextExpected },
    });
  }

  return notifications;
};

export function useNotifications() {
  const { convertFromAccount } = useMoney();
  const now = new Date();
  const rangeStart = format(startOfMonth(now), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const transactions = useLiveQuery(
    () => db.transactions.where("date").between(rangeStart, rangeEnd, true, true).toArray(),
    [rangeStart, rangeEnd]
  );
  const recurring = useLiveQuery(() => db.recurringTransactions.toArray(), []);
  const storedNotifications = useLiveQuery(() => db.notifications.orderBy("createdAt").reverse().toArray(), []);

  useEffect(() => {
    if (!budgets || !transactions || !recurring) return;

    const sync = async () => {
      const incoming = [
        ...buildBudgetNotifications(budgets, transactions, convertFromAccount),
        ...buildSubscriptionNotifications(recurring),
      ];

      await db.transaction("rw", db.notifications, async () => {
        for (const notification of incoming) {
          const existing = await db.notifications.get(notification.id);
          await db.notifications.put({
            ...notification,
            createdAt: existing?.createdAt || notification.createdAt,
            readAt: existing?.readAt,
            dismissedAt: existing?.dismissedAt,
          });
        }
      });
    };

    void sync();
  }, [budgets, transactions, recurring, convertFromAccount]);

  const notifications = useMemo(() => {
    return (storedNotifications || []).filter((item) => !item.dismissedAt);
  }, [storedNotifications]);

  const markAllRead = async () => {
    const nowIso = new Date().toISOString();
    await db.notifications
      .filter((item) => !item.readAt && !item.dismissedAt)
      .modify({ readAt: nowIso });
  };

  const dismissNotification = async (id: string) => {
    await db.notifications.update(id, { dismissedAt: new Date().toISOString() });
  };

  return {
    notifications,
    markAllRead,
    markRead: async (id: string) => {
      await db.notifications.update(id, { readAt: new Date().toISOString() });
    },
    dismissNotification,
  };
}
