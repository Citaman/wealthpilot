import { addDays, addMonths, addWeeks, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth } from "date-fns";
import type { RecurringTransaction, Transaction } from "./db";
import { detectRecurringTransactions } from "./csv-parser";

export type RecurringTimelineStatus = "paid" | "upcoming" | "overdue";

export interface RecurringTimelineEvent {
  id: string;
  recurringId?: number;
  transactionId?: number;
  accountId: number;
  name: string;
  amount: number;
  date: string;
  category: string;
  recurringType: RecurringTransaction["type"];
  direction: "income" | "expense";
  status: RecurringTimelineStatus;
  confidence: "linked" | "matched" | "scheduled";
}

const DAY = 86_400_000;

function clampDay(date: Date, day: number): Date {
  const last = endOfMonth(date).getDate();
  return new Date(date.getFullYear(), date.getMonth(), Math.min(Math.max(1, day), last));
}

export function getRecurringDates(item: RecurringTransaction, rangeStart: Date, rangeEnd: Date): Date[] {
  const anchor = parseISO(item.startDate || item.nextExpected);
  const dates: Date[] = [];
  if (item.frequency === "monthly") {
    let cursor = startOfMonth(rangeStart);
    while (!isAfter(cursor, rangeEnd)) {
      const occurrence = clampDay(cursor, item.expectedDay || item.dayOfMonth || anchor.getDate());
      if (!isBefore(occurrence, rangeStart) && !isAfter(occurrence, rangeEnd) && !isBefore(occurrence, anchor)) dates.push(occurrence);
      cursor = addMonths(cursor, 1);
    }
    return dates;
  }

  const stepWeeks = item.frequency === "weekly" ? 1 : item.frequency === "biweekly" ? 2 : 0;
  if (stepWeeks) {
    let cursor = anchor;
    while (isAfter(cursor, rangeEnd)) cursor = addWeeks(cursor, -stepWeeks);
    while (isBefore(cursor, rangeStart)) cursor = addWeeks(cursor, stepWeeks);
    while (!isAfter(cursor, rangeEnd)) {
      dates.push(cursor);
      cursor = addWeeks(cursor, stepWeeks);
    }
    return dates;
  }

  const stepMonths = item.frequency === "quarterly" ? 3 : 12;
  let cursor = anchor;
  while (isAfter(cursor, rangeEnd)) cursor = addMonths(cursor, -stepMonths);
  while (isBefore(cursor, rangeStart)) cursor = addMonths(cursor, stepMonths);
  while (!isAfter(cursor, rangeEnd)) {
    dates.push(cursor);
    cursor = addMonths(cursor, stepMonths);
  }
  return dates;
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findRecurringMatch(
  item: RecurringTransaction,
  expectedDate: Date,
  transactions: Transaction[]
): Transaction | undefined {
  const itemNames = [item.name, item.merchant].filter(Boolean).map((value) => normalized(value!));
  const expectedAmount = Math.abs(item.amount);
  return transactions.find((transaction) => {
    if (transaction.accountId !== item.accountId || transaction.isExcluded) return false;
    if (item.type === "income" ? transaction.direction !== "credit" : transaction.direction !== "debit") return false;
    const dateDistance = Math.abs(parseISO(transaction.date).getTime() - expectedDate.getTime()) / DAY;
    if (dateDistance > 5) return false;
    const merchant = normalized(transaction.merchant || transaction.description || "");
    const nameMatches = itemNames.some((name) => name.length > 2 && (merchant.includes(name) || name.includes(merchant)));
    const amountMatches = expectedAmount === 0
      ? Math.abs(transaction.amount) === 0
      : Math.abs(Math.abs(transaction.amount) - expectedAmount) / expectedAmount <= 0.2;
    return nameMatches && amountMatches;
  });
}

export function buildRecurringTimeline(input: {
  recurring: RecurringTransaction[];
  transactions: Transaction[];
  rangeStart: Date;
  rangeEnd: Date;
  today?: Date;
}): RecurringTimelineEvent[] {
  const today = input.today || new Date();
  const start = new Date(input.rangeStart.getFullYear(), input.rangeStart.getMonth(), input.rangeStart.getDate());
  const end = addDays(new Date(input.rangeEnd.getFullYear(), input.rangeEnd.getMonth(), input.rangeEnd.getDate()), 0);
  const events: RecurringTimelineEvent[] = [];

  for (const item of input.recurring.filter((candidate) => candidate.status === "active" && !candidate.isExcluded)) {
    for (const expectedDate of getRecurringDates(item, start, end)) {
      const linked = item.occurrences?.find((occurrence) => occurrence.transactionId && Math.abs(parseISO(occurrence.date).getTime() - expectedDate.getTime()) <= 5 * DAY);
      const match = linked?.transactionId
        ? input.transactions.find((transaction) => transaction.id === linked.transactionId)
        : findRecurringMatch(item, expectedDate, input.transactions);
      const eventDate = match ? parseISO(match.date) : expectedDate;
      events.push({
        id: `rec-${item.id ?? item.name}-${format(expectedDate, "yyyy-MM-dd")}`,
        recurringId: item.id,
        transactionId: match?.id,
        accountId: item.accountId,
        name: item.name,
        amount: Math.abs(match?.amount ?? item.amount),
        date: format(eventDate, "yyyy-MM-dd"),
        category: item.category,
        recurringType: item.type,
        direction: item.type === "income" ? "income" : "expense",
        status: match ? "paid" : isBefore(expectedDate, today) ? "overdue" : "upcoming",
        confidence: linked ? "linked" : match ? "matched" : "scheduled",
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function toMonthlyRecurringAmount(item: RecurringTransaction): number {
  const amount = Math.abs(item.amount);
  if (item.frequency === "weekly") return amount * 52 / 12;
  if (item.frequency === "biweekly") return amount * 26 / 12;
  if (item.frequency === "quarterly") return amount / 3;
  if (item.frequency === "yearly") return amount / 12;
  return amount;
}

export async function detectRecurringForAccounts(accountIds: number[]): Promise<{ created: number; byAccount: Record<number, number> }> {
  const byAccount: Record<number, number> = {};
  let created = 0;
  for (const accountId of [...new Set(accountIds)]) {
    const count = await detectRecurringTransactions(accountId);
    byAccount[accountId] = count;
    created += count;
  }
  return { created, byAccount };
}
