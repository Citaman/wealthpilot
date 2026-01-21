# Balance Calculation Strategy

**Version**: v0.1.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

The account balance must be calculated from transactions, not read from CSV files. This ensures consistency and allows for transaction editing without data corruption.

## Problem Statement

Current issues:
1. Balance from CSV can be stale or incorrect
2. Different CSV formats have different balance fields
3. Historical CSV has `balance_after`, import CSV has none
4. When transactions are edited/deleted, balance doesn't update
5. Duplicate detection is broken due to balance reliance

## Solution: Backward Calculation

### Core Principle

**Calculate the running balance backward from the most recent known point.**

### Algorithm

```typescript
interface BalanceState {
  currentBalance: number;        // Latest calculated balance
  lastKnownDate: Date;           // Date of last transaction
  calculatedAt: Date;            // When balance was calculated
}

function calculateBalance(transactions: Transaction[]): BalanceState {
  // Sort transactions by date DESC (newest first)
  const sorted = [...transactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Start with most recent transaction
  let balance = 0;
  
  // Calculate running balance going backward
  sorted.forEach(tx => {
    balance += tx.amount; // amount is positive for income, negative for expense
  });
  
  // This gives us the "starting balance" before all transactions
  return {
    currentBalance: balance,
    lastKnownDate: sorted[0]?.date,
    calculatedAt: new Date()
  };
}
```

### Initial Balance Setup

For first-time users or when starting fresh:

```typescript
interface AccountSetup {
  initialBalance: number;        // User enters starting balance
  initialDate: Date;             // Date of this balance
  source: 'manual' | 'csv' | 'calculated';
}
```

**Options for initial balance**:

1. **Manual Entry** (recommended for accuracy):
   - User enters their account balance on a specific date
   - All calculations work from this anchor point

2. **From CSV** (if available):
   - Use `balance_after` from first transaction
   - Calculate backward: `initialBalance = balance_after - amount`

3. **Calculated** (default):
   - Assume balance was €0 before first transaction
   - User can adjust later

### Running Balance Calculation

```typescript
function getTransactionsWithBalance(
  transactions: Transaction[],
  initialBalance: number,
  initialDate: Date
): TransactionWithBalance[] {
  // Sort by date ASC (oldest first)
  const sorted = [...transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  let runningBalance = initialBalance;
  
  return sorted.map(tx => {
    runningBalance += tx.amount;
    return {
      ...tx,
      balanceAfter: runningBalance
    };
  });
}
```

### Handling Edits

When a transaction is edited or deleted:

```typescript
async function recalculateBalances(accountId: string): Promise<void> {
  const account = await db.accounts.get(accountId);
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .sortBy('date');
  
  let balance = account.initialBalance;
  
  for (const tx of transactions) {
    balance += tx.amount;
    await db.transactions.update(tx.id, { balanceAfter: balance });
  }
  
  await db.accounts.update(accountId, { 
    currentBalance: balance,
    lastRecalculated: new Date()
  });
}
```

## Database Schema

```typescript
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  
  // Balance tracking
  initialBalance: number;        // User-provided or calculated
  initialBalanceDate: Date;      // When this balance was valid
  currentBalance: number;        // Latest calculated balance
  lastRecalculated: Date;        // Audit field
  
  // Metadata
  currency: string;              // EUR
  bankName?: string;
  accountNumber?: string;        // Masked
}

interface Transaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;                // Positive = income, Negative = expense
  balanceAfter: number;          // Calculated, not from CSV
  
  // ... other fields
}
```

## UI Components

### Balance Display (Dashboard)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Current Balance</CardTitle>
    <CardDescription>
      Calculated from {transactions.length} transactions
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">
      {formatCurrency(balance.currentBalance)}
    </div>
    <div className="text-sm text-muted-foreground">
      As of {format(balance.lastKnownDate, 'MMM d, yyyy')}
    </div>
  </CardContent>
</Card>
```

### Initial Balance Setup (Import/Settings)

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Set Initial Balance</DialogTitle>
    <DialogDescription>
      Enter your account balance on the date of your first transaction.
      This helps us calculate accurate running balances.
    </DialogDescription>
  </DialogHeader>
  <DialogContent>
    <Input 
      type="number" 
      label="Balance (€)"
      placeholder="e.g., 1500.00"
    />
    <DatePicker 
      label="As of date"
      defaultValue={firstTransactionDate}
    />
  </DialogContent>
</Dialog>
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No transactions | Show initial balance or €0 |
| Future dated transactions | Include in calculation |
| Transaction deleted | Trigger recalculation |
| Bulk import | Batch recalculation at end |
| Multiple accounts | Calculate per account |
| Transfer between accounts | Both accounts recalculate |

## Performance Considerations

- **Incremental updates**: Only recalculate from changed transaction date forward
- **Caching**: Store `currentBalance` in account record
- **Batch operations**: For imports, calculate once after all inserts
- **Debouncing**: Don't recalculate on every keystroke during edits

## Migration from v0.0.1

```typescript
async function migrateBalanceCalculation(): Promise<void> {
  // 1. Get all transactions
  const allTransactions = await db.transactions.toArray();
  
  // 2. For default account, find initial balance
  const sorted = allTransactions.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const firstTx = sorted[0];
  let initialBalance = 0;
  
  // If first transaction had balance_after, calculate initial
  if (firstTx?.balanceAfter !== undefined) {
    initialBalance = firstTx.balanceAfter - firstTx.amount;
  }
  
  // 3. Create default account with initial balance
  await db.accounts.add({
    id: 'default',
    name: 'Main Account',
    initialBalance,
    initialBalanceDate: firstTx?.date || new Date().toISOString(),
    currentBalance: 0, // Will be calculated
    lastRecalculated: new Date()
  });
  
  // 4. Recalculate all balances
  await recalculateBalances('default');
}
```

## Implementation Steps

1. [ ] Add Account schema with balance fields
2. [ ] Create `calculateBalance()` utility
3. [ ] Create `recalculateBalances()` function
4. [ ] Add initial balance setup dialog
5. [ ] Update Dashboard balance display
6. [ ] Update Transactions table with calculated balance
7. [ ] Add recalculation trigger on edits
8. [ ] Implement performance optimizations
9. [ ] Run migration for existing data

---

*Last updated: January 20, 2026*
