import { eachMonthOfInterval, endOfMonth, format, isSameMonth, startOfMonth } from "date-fns";
import type { Transaction } from "./db";
import { fromCents, toCents } from "./money";
import {
  classifyFinancialTransaction,
  isPairedInternalTransfer,
  isRecognizedIncome,
  isSalary,
} from "./financial-metrics";

export interface MonthlyFinancialPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  fixedExpenses: number;
  variableExpenses: number;
  salary: number;
  salaryByAccount: Record<number, number>;
  categories: Record<string, number>;
  isPartial: boolean;
}

export interface FinancialHistorySummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  latestSalary: number;
  medianSalary: number;
  salaryVariance: number;
}

export function isSalaryTransaction(transaction: Transaction): boolean {
  return isSalary(transaction);
}

export function isHouseholdIncome(transaction: Transaction): boolean {
  return isRecognizedIncome(transaction);
}

export function isFixedExpense(transaction: Transaction): boolean {
  if (transaction.direction !== "debit") return false;
  if (transaction.isRecurring) return true;
  if (transaction.category === "Housing" || transaction.category === "Bills") return true;
  return transaction.category === "Family" && transaction.subcategory === "Childcare";
}

export function isInternalTransfer(transaction: Transaction): boolean {
  return isPairedInternalTransfer(transaction);
}

export function isCashFlowExpense(transaction: Transaction): boolean {
  return classifyFinancialTransaction(transaction) === "expense";
}

export function buildMonthlyFinancialHistory(
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  convertAmount: (amount: number, accountId: number) => number = (amount) => amount,
  today: Date = new Date()
): MonthlyFinancialPoint[] {
  const months = eachMonthOfInterval({ start: startOfMonth(startDate), end: endOfMonth(endDate) });
  const points = new Map<string, {
    income: number;
    expenses: number;
    refunds: number;
    fixedExpenses: number;
    variableExpenses: number;
    salary: number;
    salaryByAccount: Map<number, number>;
    categories: Map<string, number>;
  }>();

  for (const month of months) {
    points.set(format(month, "yyyy-MM"), {
      income: 0,
      expenses: 0,
      refunds: 0,
      fixedExpenses: 0,
      variableExpenses: 0,
      salary: 0,
      salaryByAccount: new Map(),
      categories: new Map(),
    });
  }

  for (const transaction of transactions) {
    const point = points.get(transaction.date.slice(0, 7));
    if (!point) continue;
    const cents = Math.abs(toCents(convertAmount(transaction.amount, transaction.accountId)));
    const kind = classifyFinancialTransaction(transaction);

    if (kind === "excluded" || kind === "transfer" || kind === "unrecognized-credit") continue;

    if (kind === "income") {
      point.income += cents;
      if (isSalaryTransaction(transaction)) {
        point.salary += cents;
        point.salaryByAccount.set(
          transaction.accountId,
          (point.salaryByAccount.get(transaction.accountId) || 0) + cents
        );
      }
      continue;
    }

    if (kind === "refund") {
      point.refunds += cents;
      continue;
    }

    point.expenses += cents;
    if (isFixedExpense(transaction)) point.fixedExpenses += cents;
    else point.variableExpenses += cents;
    point.categories.set(transaction.category, (point.categories.get(transaction.category) || 0) + cents);
  }

  return months.map((monthDate) => {
    const month = format(monthDate, "yyyy-MM");
    const point = points.get(month)!;
    const income = fromCents(point.income);
    const expensesCents = Math.max(0, point.expenses - point.refunds);
    const expenses = fromCents(expensesCents);
    return {
      month,
      label: format(monthDate, "MMM yy"),
      income,
      expenses,
      net: fromCents(point.income - expensesCents),
      fixedExpenses: fromCents(Math.min(point.fixedExpenses, expensesCents)),
      variableExpenses: fromCents(Math.max(0, expensesCents - Math.min(point.fixedExpenses, expensesCents))),
      salary: fromCents(point.salary),
      salaryByAccount: Object.fromEntries(
        [...point.salaryByAccount.entries()].map(([accountId, cents]) => [accountId, fromCents(cents)])
      ),
      categories: Object.fromEntries(
        [...point.categories.entries()].map(([category, cents]) => [category, fromCents(cents)])
      ),
      isPartial: isSameMonth(monthDate, today) && today < endOfMonth(today),
    };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function summarizeFinancialHistory(history: MonthlyFinancialPoint[]): FinancialHistorySummary {
  const firstActiveMonth = history.findIndex((point) => point.income > 0 || point.expenses > 0);
  const coveredHistory = firstActiveMonth >= 0 ? history.slice(firstActiveMonth) : history;
  const completedMonths = coveredHistory.filter((point) => !point.isPartial);
  const averageBase = completedMonths.length > 0 ? completedMonths : coveredHistory;
  const salaryValues = history.filter((point) => point.salary > 0).map((point) => point.salary);
  const latestSalary = salaryValues.at(-1) || 0;
  const medianSalary = median(salaryValues);

  return {
    totalIncome: fromCents(history.reduce((sum, point) => sum + toCents(point.income), 0)),
    totalExpenses: fromCents(history.reduce((sum, point) => sum + toCents(point.expenses), 0)),
    net: fromCents(history.reduce((sum, point) => sum + toCents(point.net), 0)),
    averageMonthlyIncome: fromCents(Math.round(averageBase.reduce((sum, point) => sum + toCents(point.income), 0) / Math.max(1, averageBase.length))),
    averageMonthlyExpenses: fromCents(Math.round(averageBase.reduce((sum, point) => sum + toCents(point.expenses), 0) / Math.max(1, averageBase.length))),
    latestSalary,
    medianSalary,
    salaryVariance: fromCents(toCents(latestSalary) - toCents(medianSalary)),
  };
}

export function getTopExpenseCategories(history: MonthlyFinancialPoint[], limit = 5): string[] {
  const totals = new Map<string, number>();
  for (const point of history) {
    for (const [category, amount] of Object.entries(point.categories)) {
      totals.set(category, (totals.get(category) || 0) + amount);
    }
  }
  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([category]) => category);
}
