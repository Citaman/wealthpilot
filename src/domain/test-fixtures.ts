import { buildLedger, financePrefs, type FinancePrefs } from "./ledger";
import {
  defaultPreferences,
  type Account,
  type Batch,
  type Budget,
  type Due,
  type IsoDate,
  type Transaction,
} from "./types";

export function tx(
  id: string,
  date: IsoDate,
  amount: number,
  patch: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    batchId: "fixture",
    date,
    amount,
    account: "A",
    merchant: id,
    label: id,
    category: amount > 0 ? "Revenus" : "Courses",
    internal: false,
    fingerprint: id,
    raw: {},
    ...patch,
  };
}

export const anchored = (
  id: string,
  date: IsoDate,
  amount: number,
): Account => ({
  id,
  checkpoint: { date, amount },
});

export const due = (
  id: string,
  date: IsoDate,
  amount: number,
  patch: Partial<Due> = {},
): Due => ({
  id,
  date,
  amount,
  account: "A",
  label: id,
  ...patch,
});

export interface World {
  transactions?: Transaction[];
  accounts?: Account[];
  budgets?: Budget[];
  dues?: Due[];
  batches?: Batch[];
  prefs?: Partial<FinancePrefs>;
}

export const ledgerOf = (w: World, asOf: IsoDate) =>
  buildLedger(
    {
      transactions: w.transactions ?? [],
      accounts: w.accounts ?? [],
      budgets: w.budgets ?? [],
      dues: w.dues ?? [],
      batches: w.batches ?? [],
      prefs: { ...financePrefs(defaultPreferences), ...w.prefs },
    },
    asOf,
  );

export const budget = (
  id: string,
  month: string,
  category: string,
  amount: number,
  account?: string,
): Budget => ({
  id,
  month,
  category,
  amount,
  ...(account && { account }),
});
