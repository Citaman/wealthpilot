import type { DateRange } from "./dates";
import { budgetCalendar, type BudgetCalendar } from "./periods";
import type {
  Account,
  Batch,
  Budget,
  CategoryDefinition,
  CategoryRule,
  Due,
  IsoDate,
  Preferences,
  RecurrenceRule,
  Transaction,
  WeeklyPlan,
} from "./types";

export interface FinancePrefs {
  safety: number;
  projectsReserve: number;
  budgetOrder: string[];
  weeklyPlans: WeeklyPlan[];
  recurrenceRules: RecurrenceRule[];
  ignoredOccurrences: string[];
  dismissedRecurrences: string[];
  categoryDefinitions: CategoryDefinition[];
  categoryRules: CategoryRule[];
  accountAliases: Record<string, string>;
}

export interface Ledger {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  dues: Due[];
  batches: Batch[];
  prefs: FinancePrefs;
  asOf: IsoDate;
  /** Date-sorted. */
  byAccount: Map<string, Transaction[]>;
  calendar: BudgetCalendar;
}

/** `account: ""` is the household. Selectors read `asOf` from the ledger. */
export interface Scope {
  account: string;
  range: DateRange;
  asOf: IsoDate;
}

export function financePrefs(p: Preferences): FinancePrefs {
  // Retired goals keep their saved money reserved (brief §25). Restored legacy
  // goals are kept verbatim, so a malformed amount reserves nothing.
  const goals = [...(p.goal ? [p.goal] : []), ...(p.extraGoals ?? [])];
  return {
    safety: p.safety,
    projectsReserve: goals.reduce(
      (total, g) => total + (Number.isSafeInteger(g?.saved) ? g.saved : 0),
      0,
    ),
    budgetOrder: p.budgetOrder ?? [],
    weeklyPlans: p.weeklyPlans ?? [],
    recurrenceRules: p.recurrenceRules ?? [],
    ignoredOccurrences: p.ignoredOccurrences ?? [],
    dismissedRecurrences: p.dismissedRecurrences ?? [],
    categoryDefinitions: p.categoryDefinitions ?? [],
    categoryRules: p.categoryRules ?? [],
    accountAliases: p.accountAliases ?? {},
  };
}

export function buildLedger(
  input: {
    transactions: Transaction[];
    accounts: Account[];
    budgets: Budget[];
    dues: Due[];
    batches: Batch[];
    prefs: FinancePrefs;
  },
  asOf: IsoDate,
): Ledger {
  const byAccount = new Map<string, Transaction[]>();
  for (const t of input.transactions) {
    const rows = byAccount.get(t.account);
    if (rows) rows.push(t);
    else byAccount.set(t.account, [t]);
  }
  for (const rows of byAccount.values())
    rows.sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...input,
    asOf,
    byAccount,
    calendar: budgetCalendar(input.transactions, asOf),
  };
}

/** Memoize a selector per ledger identity + JSON key of args (small bounded cache). */
export function memo<A extends unknown[], R>(
  fn: (ledger: Ledger, ...args: A) => R,
): (ledger: Ledger, ...args: A) => R {
  const caches = new WeakMap<Ledger, Map<string, R>>();
  return (ledger, ...args) => {
    let cache = caches.get(ledger);
    if (!cache) caches.set(ledger, (cache = new Map()));
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const value = fn(ledger, ...args);
    cache.set(key, value);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
    return value;
  };
}

export const accountsIn = (ledger: Ledger, account: string) =>
  ledger.accounts.filter((a) => !account || a.id === account);

/** Transactions of the scope; date-sorted only for a single account. */
export const rowsIn = (ledger: Ledger, account: string) =>
  account ? (ledger.byAccount.get(account) ?? []) : ledger.transactions;

export const accountName = (ledger: Ledger, id: string) =>
  ledger.prefs.accountAliases[id] ?? id;
