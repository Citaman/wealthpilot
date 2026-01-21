# Multi-Account Architecture

**Version**: v0.5.0  
**Priority**: 🟠 HIGH  
**Status**: Specification Complete (Preparation in v0.1.0)

---

## Overview

Prepare the application to support multiple bank accounts. This includes database schema changes, UI adaptations, and data model considerations.

## Problem Statement

Users often have:
- Multiple checking accounts
- Savings accounts
- Credit cards
- Accounts at different banks

Current implementation assumes single account.

## Solution: Account-Based Data Model

### Database Schema

```typescript
interface Account {
  id: string;
  name: string;                  // User-friendly name: "Société Générale Main"
  type: AccountType;
  bankName: string;              // "Société Générale", "BNP", etc.
  
  // Identification
  accountNumber?: string;        // Last 4 digits only for display
  iban?: string;                 // Masked: FR76 **** **** **** 1234
  
  // Balance
  initialBalance: number;
  initialBalanceDate: Date;
  currentBalance: number;
  
  // Settings
  currency: string;              // EUR, USD, etc.
  color: string;                 // For UI distinction
  icon: string;                  // Lucide icon name
  isDefault: boolean;            // Primary account
  isActive: boolean;             // Hidden but not deleted
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

type AccountType = 
  | 'checking'                   // Current account
  | 'savings'                    // Savings account
  | 'credit'                     // Credit card
  | 'loan'                       // Loan account
  | 'investment'                 // Brokerage
  | 'cash';                      // Cash tracking

interface Transaction {
  id: string;
  accountId: string;             // NEW: Link to account
  // ... rest unchanged
}

interface RecurringTransaction {
  id: string;
  accountId: string;             // NEW: Link to account
  // ... rest unchanged
}
```

### Account Selector UI

```tsx
// Global account selector in sidebar
<Select value={selectedAccountId} onChange={setSelectedAccountId}>
  <SelectTrigger>
    <div className="flex items-center gap-2">
      <div 
        className="w-3 h-3 rounded-full" 
        style={{ backgroundColor: account.color }} 
      />
      <span>{account.name}</span>
    </div>
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Accounts</SelectItem>
    <SelectSeparator />
    {accounts.map(account => (
      <SelectItem key={account.id} value={account.id}>
        <div className="flex items-center justify-between w-full">
          <span>{account.name}</span>
          <span className="text-muted-foreground">
            {formatCurrency(account.currentBalance)}
          </span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Multi-Account Dashboard

```tsx
// Combined view
<div className="grid grid-cols-3 gap-4">
  {accounts.map(account => (
    <AccountCard 
      key={account.id}
      account={account}
      onClick={() => setSelectedAccount(account.id)}
    />
  ))}
</div>

// Total across all accounts
<Card>
  <CardHeader>Net Worth</CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">
      {formatCurrency(totalBalance)}
    </div>
    <div className="space-y-1">
      {accounts.map(acc => (
        <div key={acc.id} className="flex justify-between text-sm">
          <span>{acc.name}</span>
          <span>{formatCurrency(acc.currentBalance)}</span>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

### Import Flow Changes

```tsx
// Step 1: Select or create account
<ImportStep1>
  <h3>Which account is this for?</h3>
  
  <RadioGroup value={accountId} onChange={setAccountId}>
    {accounts.map(account => (
      <RadioGroupItem key={account.id} value={account.id}>
        {account.name}
      </RadioGroupItem>
    ))}
    <RadioGroupItem value="new">
      + Add new account
    </RadioGroupItem>
  </RadioGroup>
  
  {accountId === 'new' && (
    <NewAccountForm onSubmit={handleCreateAccount} />
  )}
</ImportStep1>

// Step 2: Upload CSV (unchanged)
// Step 3: Preview with account indicator
// Step 4: Import to selected account
```

### Transfer Detection

Detect transfers between owned accounts:

```typescript
interface TransferLink {
  id: string;
  fromTransactionId: string;
  toTransactionId: string;
  amount: number;
  date: Date;
  isConfirmed: boolean;
}

function detectTransfers(transactions: Transaction[]): TransferLink[] {
  const transfers: TransferLink[] = [];
  
  // Group by absolute amount and similar dates
  const candidates = transactions.filter(tx => 
    tx.category === 'Transfer' || 
    tx.description.match(/virement|transfer/i)
  );
  
  for (const outgoing of candidates.filter(t => t.amount < 0)) {
    const incoming = candidates.find(t => 
      t.amount === Math.abs(outgoing.amount) &&
      t.accountId !== outgoing.accountId &&
      Math.abs(dateDiff(t.date, outgoing.date)) <= 3
    );
    
    if (incoming) {
      transfers.push({
        fromTransactionId: outgoing.id,
        toTransactionId: incoming.id,
        amount: Math.abs(outgoing.amount),
        date: outgoing.date
      });
    }
  }
  
  return transfers;
}
```

### Analytics per Account

```typescript
// Filter hook update
function useTransactions(filters: TransactionFilters) {
  const { accountId = 'all', ...rest } = filters;
  
  return useLiveQuery(() => {
    let query = db.transactions;
    
    if (accountId !== 'all') {
      query = query.where('accountId').equals(accountId);
    }
    
    // ... rest of filtering
  }, [accountId, ...deps]);
}
```

## UI Adaptations

### Sidebar Account List

```tsx
<SidebarSection title="Accounts">
  {accounts.map(account => (
    <SidebarItem
      key={account.id}
      icon={<Wallet />}
      label={account.name}
      badge={formatCurrency(account.currentBalance)}
      isActive={selectedAccount === account.id}
      color={account.color}
    />
  ))}
  <SidebarItem
    icon={<Plus />}
    label="Add Account"
    onClick={openAddAccountDialog}
  />
</SidebarSection>
```

### Account Settings Page

```tsx
<AccountsPage>
  <AccountList>
    {accounts.map(account => (
      <AccountRow
        key={account.id}
        account={account}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />
    ))}
  </AccountList>
  
  <Button onClick={openAddDialog}>
    <Plus className="w-4 h-4 mr-2" />
    Add Account
  </Button>
</AccountsPage>
```

## Migration Strategy

### v0.1.0 Preparation

1. Add `accountId` field to transactions (default: 'default')
2. Create default account record
3. Update hooks to accept `accountId` filter
4. Make UI account-aware but single-account

### v0.5.0 Full Implementation

1. Add account selector UI
2. Implement multi-account import
3. Add transfer detection
4. Build account management page
5. Update all analytics for multi-account

## Implementation Steps

### v0.1.0 (Preparation)

- [ ] Add Account schema to database
- [ ] Add accountId to Transaction
- [ ] Create default account on first run
- [ ] Update hooks with accountId support
- [ ] Associate imports with default account

### v0.5.0 (Full Support)

- [ ] Account selector in sidebar
- [ ] Account management page
- [ ] Multi-account import flow
- [ ] Transfer detection algorithm
- [ ] Combined net worth view
- [ ] Per-account analytics
- [ ] Account colors and icons

---

*Last updated: January 20, 2026*
