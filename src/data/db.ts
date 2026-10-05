import Dexie, { type Table } from "dexie";
import {
  defaultPreferences,
  type Account,
  type Batch,
  type Budget,
  type Due,
  type Preferences,
  type Snapshot,
  type Transaction,
} from "../domain/types";

export class WealthDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  accounts!: Table<Account, string>;
  batches!: Table<Batch, string>;
  budgets!: Table<Budget, string>;
  dues!: Table<Due, string>;
  preferences!: Table<Preferences, string>;
  constructor(name: string) {
    super(name);
    // Frozen schema: any change here would require version(2) on real browsers.
    this.version(1).stores({
      transactions: "id,batchId,date,account,category,fingerprint",
      accounts: "id",
      batches: "id,&hash,createdAt",
      budgets: "id,month",
      dues: "id,date,account",
      preferences: "id",
    });
  }
}

export const openDatabase = (name: string) => new WealthDatabase(name);

export const db = openDatabase("WealthPilotNext_v1");

export function withDefaults(stored: Preferences | undefined): Preferences {
  return { ...structuredClone(defaultPreferences), ...stored };
}

export const readPreferences = async (database = db) =>
  withDefaults(await database.preferences.get("main"));

export function readSnapshot(database = db): Promise<Snapshot> {
  return database.transaction("r", database.tables, async () => ({
    transactions: await database.transactions.toArray(),
    accounts: await database.accounts.toArray(),
    batches: await database.batches.toArray(),
    budgets: await database.budgets.toArray(),
    dues: await database.dues.toArray(),
    preferences: await readPreferences(database),
  }));
}
