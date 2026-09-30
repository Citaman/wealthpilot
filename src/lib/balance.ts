// Balance Calculation - Calculate running balance from transactions
import { db, Transaction, BalanceCheckpoint } from './db';
import { parseISO } from 'date-fns';
import { fromCents, toCents } from './money';

// Transaction with calculated running balance
export interface TransactionWithBalance extends Transaction {
  runningBalance: number;
}

// Get the signed amount (positive for credit, negative for debit)
export function getSignedAmount(tx: Transaction): number {
  return fromCents(tx.direction === 'credit' ? toCents(tx.amount) : -toCents(tx.amount));
}

/**
 * Calculate running balance for all transactions starting from an initial balance
 * Transactions should be sorted by date ASCENDING (oldest first)
 */
export function calculateRunningBalances(
  transactions: Transaction[],
  initialBalance: number
): TransactionWithBalance[] {
  // Sort by date ascending
  const sorted = [...transactions].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  let runningBalanceCents = toCents(initialBalance);
  
  return sorted.map(tx => {
    runningBalanceCents += toCents(getSignedAmount(tx));
    return {
      ...tx,
      runningBalance: fromCents(runningBalanceCents),
    };
  });
}

/**
 * Calculate the initial balance from transactions if we know the final balance
 * This is the "backward calculation" - work backward from the most recent known balance
 */
export function calculateInitialBalance(
  transactions: Transaction[],
  finalBalance: number,
  finalBalanceDate: Date
): number {
  // Get all transactions up to and including the final balance date
  const relevantTxs = transactions.filter(
    tx => parseISO(tx.date).getTime() <= finalBalanceDate.getTime()
  );
  
  // Calculate the total change from all transactions
  const totalChangeCents = relevantTxs.reduce(
    (sum, tx) => sum + toCents(getSignedAmount(tx)),
    0
  );
  
  // Initial balance = Final balance - total change
  return fromCents(toCents(finalBalance) - totalChangeCents);
}

/**
 * Get the current balance by summing all transactions from initial balance
 */
export async function getCurrentBalance(accountId: number = 1): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .toArray();
  
  const totalChangeCents = transactions.reduce(
    (sum, tx) => sum + toCents(getSignedAmount(tx)),
    0
  );
  
  return fromCents(toCents(account.initialBalance) + totalChangeCents);
}

/**
 * Get the most recent active checkpoint for an account
 */
export async function getActiveCheckpoint(accountId: number): Promise<BalanceCheckpoint | null> {
  const checkpoints = await db.balanceCheckpoints
    .where('accountId')
    .equals(accountId)
    .filter(cp => cp.isActive)
    .sortBy('date');
  
  // Return the most recent active checkpoint
  return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
}

/**
 * Calculate initial balance from a checkpoint
 * Works backward from the checkpoint to find the initial balance
 */
export async function calculateInitialBalanceFromCheckpoint(
  accountId: number,
  checkpoint: BalanceCheckpoint
): Promise<number> {
  // Get all transactions on or before the checkpoint date
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .filter(tx => tx.date <= checkpoint.date)
    .toArray();
  
  // Sum up all transactions
  const totalChangeCents = transactions.reduce(
    (sum, tx) => sum + toCents(getSignedAmount(tx)),
    0
  );
  
  // Initial balance = checkpoint balance - sum of all transactions up to checkpoint
  return fromCents(toCents(checkpoint.balance) - totalChangeCents);
}

/**
 * Recalculate all balances for an account and update the database
 * Uses checkpoints if available, otherwise uses initialBalance
 */
export async function recalculateBalances(accountId: number = 1): Promise<void> {
  const account = await db.accounts.get(accountId);
  if (!account) return;
  
  // Check for active checkpoint first
  const checkpoint = await getActiveCheckpoint(accountId);
  let startingBalance = account.initialBalance;
  
  if (checkpoint) {
    // Calculate initial balance from checkpoint
    startingBalance = await calculateInitialBalanceFromCheckpoint(accountId, checkpoint);
    // Update account's initial balance and date
    await db.accounts.update(accountId, {
      initialBalance: startingBalance,
      initialBalanceDate: checkpoint.date,
    });
  }
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .sortBy('date');
  
  let runningBalanceCents = toCents(startingBalance);
  const updates: Transaction[] = [];
  
  // Update each transaction's balanceAfter
  for (const tx of transactions) {
    runningBalanceCents += toCents(getSignedAmount(tx));
    const runningBalance = fromCents(runningBalanceCents);
    
    // Only update if different to avoid unnecessary writes
    if (tx.balanceAfter !== runningBalance) {
      updates.push({ ...tx, balanceAfter: runningBalance, updatedAt: new Date().toISOString() });
    }
  }

  if (updates.length > 0) {
    await db.transactions.bulkPut(updates);
  }
  
  // Update account's current balance
  await db.accounts.update(accountId, {
    balance: fromCents(runningBalanceCents),
    lastRecalculated: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

/**
 * Recalculate balances for ALL accounts
 * Call this on app startup
 */
export async function recalculateAllBalances(): Promise<void> {
  const accounts = await db.accounts.toArray();
  for (const account of accounts) {
    if (account.id) {
      await recalculateBalances(account.id);
    }
  }
}

/**
 * Add a balance checkpoint (known balance at a specific date)
 * This will recalculate all balances using this checkpoint
 */
export async function addBalanceCheckpoint(
  accountId: number,
  date: string,
  balance: number,
  note?: string
): Promise<number> {
  const now = new Date().toISOString();
  
  // Deactivate all other checkpoints for this account (keep only the latest active)
  // Actually, we can have multiple but only use the most recent one for calculation
  
  const id = await db.balanceCheckpoints.add({
    accountId,
    date,
    balance,
    note,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  
  // Recalculate balances with the new checkpoint
  await recalculateBalances(accountId);
  
  return id;
}

/**
 * Get all checkpoints for an account
 */
export async function getBalanceCheckpoints(accountId: number): Promise<BalanceCheckpoint[]> {
  return db.balanceCheckpoints
    .where('accountId')
    .equals(accountId)
    .sortBy('date');
}

/**
 * Delete a checkpoint
 */
export async function deleteBalanceCheckpoint(checkpointId: number, accountId: number): Promise<void> {
  await db.balanceCheckpoints.delete(checkpointId);
  await recalculateBalances(accountId);
}

/**
 * Set the initial balance for an account (from user input or CSV)
 * This will recalculate all running balances
 */
export async function setInitialBalance(
  accountId: number,
  initialBalance: number,
  initialBalanceDate: string
): Promise<void> {
  await db.accounts.update(accountId, {
    initialBalance,
    initialBalanceDate,
    updatedAt: new Date().toISOString()
  });
  
  await recalculateBalances(accountId);
}

/**
 * Calculate initial balance from the first transaction's balanceAfter field
 * Useful when importing from CSV that has balance information
 */
export async function calculateInitialBalanceFromCsv(
  accountId: number = 1
): Promise<{ balance: number; date: string } | null> {
  // Get the first transaction (oldest)
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .sortBy('date');
  
  if (transactions.length === 0) return null;
  
  const firstTx = transactions[0];
  
  // If we have balanceAfter, calculate initial balance
  if (firstTx.balanceAfter !== undefined && firstTx.balanceAfter !== 0) {
    const initialBalance = firstTx.balanceAfter - getSignedAmount(firstTx);
    return {
      balance: initialBalance,
      date: firstTx.date
    };
  }
  
  return null;
}

/**
 * Verify balance consistency - check if running balances match stored values
 */
export async function verifyBalanceConsistency(
  accountId: number = 1
): Promise<{ isConsistent: boolean; discrepancies: number[] }> {
  const account = await db.accounts.get(accountId);
  if (!account) return { isConsistent: true, discrepancies: [] };
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .sortBy('date');
  
  let runningBalance = account.initialBalance;
  const discrepancies: number[] = [];
  
  for (const tx of transactions) {
    runningBalance += getSignedAmount(tx);
    
    if (Math.abs(tx.balanceAfter - runningBalance) > 0.01) {
      discrepancies.push(tx.id!);
    }
  }
  
  return {
    isConsistent: discrepancies.length === 0,
    discrepancies
  };
}

/**
 * Get balance at a specific date
 */
export async function getBalanceAtDate(
  date: Date,
  accountId: number = 1
): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;
  
  const dateStr = date.toISOString().split('T')[0];
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .filter(tx => tx.date <= dateStr)
    .toArray();
  
  const totalChangeCents = transactions.reduce(
    (sum, tx) => sum + toCents(getSignedAmount(tx)),
    0
  );
  
  return fromCents(toCents(account.initialBalance) + totalChangeCents);
}

/**
 * Get balance history (daily snapshots)
 */
export async function getBalanceHistory(
  startDate: Date,
  endDate: Date,
  accountId: number = 1
): Promise<Array<{ date: string; balance: number }>> {
  const account = await db.accounts.get(accountId);
  if (!account) return [];
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  
  // Get all transactions in range plus before
  const allTxs = await db.transactions
    .where('accountId')
    .equals(accountId)
    .filter(tx => tx.date <= endStr)
    .sortBy('date');
  
  // Calculate balance before start date
  let balanceBeforeStartCents = toCents(account.initialBalance);
  const txsBeforeStart = allTxs.filter(tx => tx.date < startStr);
  balanceBeforeStartCents += txsBeforeStart.reduce(
    (sum, tx) => sum + toCents(getSignedAmount(tx)),
    0
  );
  
  // Group transactions by date
  const txsByDate = new Map<string, Transaction[]>();
  for (const tx of allTxs) {
    if (tx.date >= startStr && tx.date <= endStr) {
      const existing = txsByDate.get(tx.date) || [];
      existing.push(tx);
      txsByDate.set(tx.date, existing);
    }
  }
  
  // Build history
  const history: Array<{ date: string; balance: number }> = [];
  let currentBalanceCents = balanceBeforeStartCents;
  
  // Iterate through each day
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dayTxs = txsByDate.get(dateStr) || [];
    
    // Add day's transactions
    for (const tx of dayTxs) {
      currentBalanceCents += toCents(getSignedAmount(tx));
    }
    
    history.push({
      date: dateStr,
      balance: fromCents(currentBalanceCents)
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  return history;
}
