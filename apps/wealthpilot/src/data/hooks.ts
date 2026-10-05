import { liveQuery } from "dexie";
import { useMemo, useSyncExternalStore } from "react";
import {
  buildLedger,
  financePrefs,
  type FinancePrefs,
  type Ledger,
} from "../domain/ledger";
import type {
  Account,
  Batch,
  Budget,
  Due,
  IsoDate,
  Preferences,
  Transaction,
} from "../domain/types";
import { db, readPreferences, withDefaults } from "./db";

// One live query per table, shared by every component: a table keeps its array
// identity until that table is written, so memoized selectors stay valid.
function liveTable<T>(query: () => Promise<T>) {
  let value: T | undefined;
  let error: unknown;
  let subscription: { unsubscribe(): void } | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    subscription ??= liveQuery(query).subscribe({
      next: (next) => {
        value = next;
        notify();
      },
      error: (e) => {
        error = e;
        notify();
      },
    });
    return () => {
      listeners.delete(listener);
      if (listeners.size) return;
      subscription?.unsubscribe();
      subscription = value = error = undefined;
    };
  };
  const get = () => {
    if (error) throw error;
    return value;
  };
  return () => useSyncExternalStore(subscribe, get);
}

const useTransactionsTable = liveTable(() => db.transactions.toArray());
const useAccountsTable = liveTable(() => db.accounts.toArray());
const useBudgetsTable = liveTable(() => db.budgets.toArray());
const useDuesTable = liveTable(() => db.dues.toArray());
const useBatchesTable = liveTable(() => db.batches.toArray());
const usePreferencesRow = liveTable(() => readPreferences());

const none: never[] = [];

export interface Tables {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  dues: Due[];
  batches: Batch[];
}

export function useTables(): Tables {
  const transactions = useTransactionsTable() ?? none;
  const accounts = useAccountsTable() ?? none;
  const budgets = useBudgetsTable() ?? none;
  const dues = useDuesTable() ?? none;
  const batches = useBatchesTable() ?? none;
  return useMemo(
    () => ({ transactions, accounts, budgets, dues, batches }),
    [transactions, accounts, budgets, dues, batches],
  );
}

const fallbackPreferences = withDefaults(undefined);

/** Stored preferences merged with defaults. Reading never writes the row. */
export const usePreferences = (): Preferences =>
  usePreferencesRow() ?? fallbackPreferences;

/** True once every table and the preferences have been read once. */
export function useLoaded(): boolean {
  const values = [
    useTransactionsTable(),
    useAccountsTable(),
    useBudgetsTable(),
    useDuesTable(),
    useBatchesTable(),
    usePreferencesRow(),
  ];
  return values.every((value) => value !== undefined);
}

export const useDashboardLayout = () => usePreferences().dashboard;

// Presentation writes (dashboard, aliases…) re-read the whole preferences row;
// the finance part keeps its identity unless its content changed.
let lastFinance: { key: string; value: FinancePrefs } | undefined;
const financeByRow = new WeakMap<Preferences, FinancePrefs>();
function stableFinancePrefs(preferences: Preferences): FinancePrefs {
  let finance = financeByRow.get(preferences);
  if (!finance) {
    const value = financePrefs(preferences);
    const key = JSON.stringify(value);
    if (lastFinance?.key !== key) lastFinance = { key, value };
    finance = lastFinance.value;
    financeByRow.set(preferences, finance);
  }
  return finance;
}

const ledgers = new Map<IsoDate, { inputs: unknown[]; ledger: Ledger }>();

/** One Ledger per asOf, shared by all components, rebuilt only when a financial input changes. */
export function useLedger(asOf: IsoDate): Ledger {
  const { transactions, accounts, budgets, dues, batches } = useTables();
  const prefs = stableFinancePrefs(usePreferences());
  const inputs = [transactions, accounts, budgets, dues, batches, prefs];
  const cached = ledgers.get(asOf);
  if (cached && cached.inputs.every((input, i) => input === inputs[i]))
    return cached.ledger;
  const ledger = buildLedger(
    { transactions, accounts, budgets, dues, batches, prefs },
    asOf,
  );
  ledgers.set(asOf, { inputs, ledger });
  return ledger;
}
