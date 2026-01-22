import { db, type Account } from "./db";

export async function getPrimaryAccount(): Promise<Account | undefined> {
  const accounts = await db.accounts.toArray();
  const activeAccounts = accounts.filter((account) => account.isActive !== false);
  activeAccounts.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return activeAccounts[0];
}
