import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, type Account, type RecurringTransaction, type Transaction } from "../db";
import { detectRecurringTransactions, mergeRecurringItems } from "../csv-parser";

const now = "2026-09-29T10:00:00.000Z";

async function createAccount(): Promise<number> {
  return db.accounts.add({
    name: "Test",
    type: "checking",
    balance: 0,
    currency: "EUR",
    institution: "Test",
    color: "#000000",
    isActive: true,
    initialBalance: 0,
    initialBalanceDate: "2026-07-01",
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<Account, "id">);
}

function debit(accountId: number, date: string): Omit<Transaction, "id"> {
  return {
    date,
    valueDate: date,
    direction: "debit",
    amount: 19.99,
    balanceAfter: 0,
    category: "Bills",
    subcategory: "Subscriptions",
    merchant: "Example Streaming",
    merchantOriginal: "EXAMPLE STREAMING",
    paymentMethod: "Card",
    description: "Monthly subscription",
    isRecurring: false,
    accountId,
    createdAt: now,
    updatedAt: now,
  };
}

describe("recurring transaction integrity", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("detects positive stored debit amounts and stays idempotent", async () => {
    const accountId = await createAccount();
    await db.transactions.bulkAdd([
      debit(accountId, "2026-07-01"),
      debit(accountId, "2026-08-01"),
      debit(accountId, "2026-09-01"),
    ]);

    expect(await detectRecurringTransactions(accountId)).toBe(1);
    expect(await detectRecurringTransactions(accountId)).toBe(0);

    const detected = await db.recurringTransactions.toArray();
    expect(detected).toHaveLength(1);
    expect(detected[0]).toMatchObject({
      accountId,
      name: "Example Streaming",
      amount: 19.99,
      type: "subscription",
    });
    expect(detected[0].occurrences).toHaveLength(3);
  });

  it("merges occurrences and deletes the source item atomically", async () => {
    const accountId = await createAccount();
    const base = {
      type: "subscription",
      status: "active",
      amount: 10,
      frequency: "monthly",
      nextExpected: "2026-10-01",
      category: "Bills",
      subcategory: "Subscriptions",
      lastDetected: "2026-09-01",
      accountId,
    } satisfies Partial<RecurringTransaction>;
    const targetId = await db.recurringTransactions.add({
      ...base,
      name: "Target",
      occurrences: [{ id: "one", date: "2026-08-01", amount: 10, status: "paid" }],
    } as RecurringTransaction);
    const sourceId = await db.recurringTransactions.add({
      ...base,
      name: "Source",
      occurrences: [{ id: "two", date: "2026-09-01", amount: 10, status: "paid" }],
    } as RecurringTransaction);

    expect(await mergeRecurringItems(targetId, sourceId)).toMatchObject({ updated: 1, removed: 1, errors: [] });
    expect((await db.recurringTransactions.get(targetId))?.occurrences).toHaveLength(2);
    expect(await db.recurringTransactions.get(sourceId)).toBeUndefined();
  });
});
