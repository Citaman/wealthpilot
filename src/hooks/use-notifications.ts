"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, parseISO } from "date-fns";
import { db, type Budget, type Transaction, type RecurringTransaction, type Notification } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { isRealExpense } from "@/lib/financial-metrics";
import { getBudgetAlertThreshold, SETTINGS_PREFERENCE_EVENT } from "@/components/settings/preferences";

export const buildBudgetNotifications = (
  budgets: Budget[],
  transactions: Transaction[],
  convertFromAccount: (amount: number, accountId?: number) => number,
  warningThreshold = 0.8
): Notification[] => {
  const now = new Date();
  const monthKey = format(now, "yyyy-MM");

  const spendByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!isRealExpense(tx)) continue;
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
        title: `Budget ${budget.category} dépassé`,
        body: `La limite mensuelle de la catégorie ${budget.category} est dépassée.`,
        createdAt: new Date().toISOString(),
        actionHref: "/budgets",
        payload: { category: budget.category, spent, budgetAmount },
      });
    } else if (spent >= budgetAmount * warningThreshold) {
      notifications.push({
        id: `budget-warning-${budget.category}-${monthKey}`,
        type: "budget",
        title: `Budget ${budget.category} presque atteint`,
        body: `${Math.round((spent / budgetAmount) * 100)} % du budget ${budget.category} est déjà utilisé.`,
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
      title: daysAway === 0 ? `${item.name} est prévu aujourd’hui` : `${item.name} est prévu dans ${daysAway} jour${daysAway === 1 ? "" : "s"}`,
      body: `Paiement ${item.category} programmé prochainement.`,
      createdAt: new Date().toISOString(),
      actionHref: "/subscriptions",
      payload: { recurringId: item.id, nextExpected: item.nextExpected },
    });
  }

  return notifications;
};

export function useNotifications() {
  const { convertFromAccount } = useMoney();
  const [budgetAlertThreshold, setBudgetAlertThreshold] = useState(0.8);
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
    const refresh = () => getBudgetAlertThreshold().then((value) => setBudgetAlertThreshold(value / 100)).catch(() => undefined);
    void refresh();
    window.addEventListener(SETTINGS_PREFERENCE_EVENT, refresh);
    return () => window.removeEventListener(SETTINGS_PREFERENCE_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!budgets || !transactions || !recurring) return;

    const sync = async () => {
      const incoming = [
        ...buildBudgetNotifications(budgets, transactions, convertFromAccount, budgetAlertThreshold),
        ...buildSubscriptionNotifications(recurring),
      ];

      await db.transaction("rw", db.notifications, async () => {
        const incomingIds = new Set(incoming.map((notification) => notification.id));
        await db.notifications
          .filter((notification) => notification.id.startsWith("budget-") && !incomingIds.has(notification.id))
          .delete();
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
  }, [budgets, transactions, recurring, convertFromAccount, budgetAlertThreshold]);

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
