import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, type Account, type Goal } from "../db";
import { deleteAccountSafely, getAccountDependencies } from "../accounts";
import { deleteGoalWithHistory } from "../goals";

const now = "2026-09-29T10:00:00.000Z";

async function createAccount(name: string): Promise<number> {
  return db.accounts.add({
    name,
    type: "checking",
    balance: 0,
    currency: "EUR",
    institution: "Test",
    color: "#000000",
    isActive: true,
    initialBalance: 0,
    initialBalanceDate: "2026-09-29",
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<Account, "id">);
}

describe("multi-account data integrity", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("blocks account deletion while data still references it", async () => {
    const accountId = await createAccount("Household account");
    await db.transactions.add({
      date: "2026-09-29",
      valueDate: "2026-09-29",
      direction: "debit",
      amount: 10,
      balanceAfter: -10,
      category: "Food",
      subcategory: "Groceries",
      merchant: "Shop",
      merchantOriginal: "SHOP",
      paymentMethod: "Card",
      description: "Test",
      isRecurring: false,
      accountId,
      createdAt: now,
      updatedAt: now,
    });

    expect(await getAccountDependencies(accountId)).toMatchObject({ transactions: 1, total: 1 });
    await expect(deleteAccountSafely(accountId)).rejects.toThrow("1 linked record");
    expect(await db.accounts.get(accountId)).toBeDefined();

    await db.transactions.where("accountId").equals(accountId).delete();
    await deleteAccountSafely(accountId);
    expect(await db.accounts.get(accountId)).toBeUndefined();
  });

  it("deletes goal contributions atomically with their goal", async () => {
    const goalId = await db.goals.add({
      name: "Emergency fund",
      targetAmount: 1000,
      currentAmount: 100,
      icon: "target",
      color: "#000000",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } satisfies Omit<Goal, "id">);
    await db.goalContributions.add({ goalId, date: "2026-09-29", amount: 100, createdAt: now });

    await deleteGoalWithHistory(goalId);

    expect(await db.goals.get(goalId)).toBeUndefined();
    expect(await db.goalContributions.where("goalId").equals(goalId).count()).toBe(0);
  });
});
