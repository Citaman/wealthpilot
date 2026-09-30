import type { Transaction } from "./db";
import { fromCents, toCents } from "./money";

export type FinancialTransactionKind =
  | "income"
  | "expense"
  | "refund"
  | "transfer"
  | "excluded"
  | "unrecognized-credit";

export interface FinancialMetrics {
  income: number;
  grossExpenses: number;
  refunds: number;
  expenses: number;
  net: number;
  transfers: number;
  excluded: number;
  unrecognizedCredits: number;
  transactionCount: number;
}

const SALARY_PATTERN = /\bSALAIRE\b|DIGITAL\s+CLASSIFIEDS|BABILOU/i;
const BENEFIT_PATTERN = /\bCAF\b|ALLOCATIONS?\s+FAMILIALES?/i;
const REFUND_PATTERN = /REMBOURS|REFUND|REVERSAL|ANNULATION/i;

function transactionText(transaction: Transaction): string {
  return `${transaction.merchant || ""} ${transaction.description || ""}`;
}

export function isSalary(transaction: Transaction): boolean {
  return transaction.direction === "credit" && (
    (transaction.category === "Income" && transaction.subcategory === "Salary") ||
    SALARY_PATTERN.test(transactionText(transaction))
  );
}

export function isRecognizedIncome(transaction: Transaction): boolean {
  if (transaction.direction !== "credit") return false;
  if (isSalary(transaction) || BENEFIT_PATTERN.test(transactionText(transaction))) return true;
  return transaction.category === "Income" && transaction.subcategory !== "Refunds";
}

export function isRefund(transaction: Transaction): boolean {
  return transaction.direction === "credit" && (
    transaction.subcategory === "Refunds" ||
    REFUND_PATTERN.test(transactionText(transaction))
  );
}

export function isPairedInternalTransfer(transaction: Transaction): boolean {
  return transaction.category === "Transfers" && transaction.linkedTransferId !== undefined;
}

export function classifyFinancialTransaction(transaction: Transaction): FinancialTransactionKind {
  if (transaction.isExcluded) return "excluded";
  if (isPairedInternalTransfer(transaction)) return "transfer";
  if (isRefund(transaction)) return "refund";
  if (isRecognizedIncome(transaction)) return "income";
  if (transaction.direction === "debit") return "expense";
  return "unrecognized-credit";
}

export function calculateFinancialMetrics(
  transactions: Transaction[],
  convertAmount: (amount: number, accountId: number) => number = (amount) => amount
): FinancialMetrics {
  const cents = {
    income: 0,
    grossExpenses: 0,
    refunds: 0,
    transfers: 0,
    excluded: 0,
    unrecognizedCredits: 0,
  };

  for (const transaction of transactions) {
    const amount = Math.abs(toCents(convertAmount(transaction.amount, transaction.accountId)));
    switch (classifyFinancialTransaction(transaction)) {
      case "income": cents.income += amount; break;
      case "expense": cents.grossExpenses += amount; break;
      case "refund": cents.refunds += amount; break;
      case "transfer": cents.transfers += amount; break;
      case "excluded": cents.excluded += amount; break;
      case "unrecognized-credit": cents.unrecognizedCredits += amount; break;
    }
  }

  const expenseCents = Math.max(0, cents.grossExpenses - cents.refunds);
  return {
    income: fromCents(cents.income),
    grossExpenses: fromCents(cents.grossExpenses),
    refunds: fromCents(cents.refunds),
    expenses: fromCents(expenseCents),
    net: fromCents(cents.income - expenseCents),
    transfers: fromCents(cents.transfers),
    excluded: fromCents(cents.excluded),
    unrecognizedCredits: fromCents(cents.unrecognizedCredits),
    transactionCount: transactions.length,
  };
}

export function isRealExpense(transaction: Transaction): boolean {
  return classifyFinancialTransaction(transaction) === "expense";
}
