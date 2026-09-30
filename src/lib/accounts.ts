import { db, type Account } from "./db";

export async function getPrimaryAccount(): Promise<Account | undefined> {
  const accounts = await db.accounts.toArray();
  const activeAccounts = accounts.filter((account) => account.isActive !== false);
  activeAccounts.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return activeAccounts[0];
}

export interface AccountDependencies {
  transactions: number;
  recurringTransactions: number;
  balanceCheckpoints: number;
  detectedSalaries: number;
  linkedGoals: number;
  total: number;
}

export async function getAccountDependencies(accountId: number): Promise<AccountDependencies> {
  const [transactions, recurringTransactions, balanceCheckpoints, detectedSalaries, linkedGoals] = await Promise.all([
    db.transactions.where("accountId").equals(accountId).count(),
    db.recurringTransactions.where("accountId").equals(accountId).count(),
    db.balanceCheckpoints.where("accountId").equals(accountId).count(),
    db.detectedSalaries.where("accountId").equals(accountId).count(),
    db.goals.where("linkedAccountId").equals(accountId).count(),
  ]);
  return {
    transactions,
    recurringTransactions,
    balanceCheckpoints,
    detectedSalaries,
    linkedGoals,
    total: transactions + recurringTransactions + balanceCheckpoints + detectedSalaries + linkedGoals,
  };
}

/** Refuse deletion while records still reference the account. */
export async function deleteAccountSafely(accountId: number): Promise<void> {
  const dependencies = await getAccountDependencies(accountId);
  if (dependencies.total > 0) {
    throw new Error(
      `Cannot delete this account: ${dependencies.total} linked record${dependencies.total === 1 ? "" : "s"} must be removed or reassigned first.`
    );
  }
  await db.accounts.delete(accountId);
}

export interface AccountTrust {
  status: "fresh" | "stale" | "unconfigured";
  asOf: string | null;
  label: string;
}

export function getAccountTrust(account: Account, now = new Date(), staleAfterDays = 7): AccountTrust {
  const asOf = account.lastRecalculated?.slice(0, 10) || account.updatedAt?.slice(0, 10) || account.initialBalanceDate || null;
  if (!asOf) return { status: "unconfigured", asOf: null, label: "Solde non daté" };
  const age = Math.floor((now.getTime() - new Date(`${asOf}T00:00:00`).getTime()) / 86_400_000);
  if (age > staleAfterDays) return { status: "stale", asOf, label: `À actualiser · ${asOf}` };
  return { status: "fresh", asOf, label: `Fiable au ${asOf}` };
}
