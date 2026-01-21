# Data Model & Database Schema

**Version**: v0.1.0+  
**Priority**: 🔴 CRITICAL  
**Status**: Living Document

---

## Overview

Complete database schema using Dexie.js (IndexedDB wrapper) for offline-first storage.

## Current Schema (v0.0.1)

```typescript
class WealthPilotDB extends Dexie {
  transactions!: Table<Transaction>;
  goals!: Table<Goal>;
  settings!: Table<Settings>;
  recurringTransactions!: Table<RecurringTransaction>;

  constructor() {
    super('wealthpilot');
    this.version(1).stores({
      transactions: '++id, date, category, merchant, amount',
      goals: '++id, name',
      settings: 'id',
      recurringTransactions: '++id, name, category',
    });
  }
}
```

## Target Schema (v0.5.0)

```typescript
class WealthPilotDB extends Dexie {
  // Core tables
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  
  // Financial planning
  goals!: Table<Goal>;
  budgets!: Table<Budget>;
  
  // Recurring & subscriptions
  recurringTransactions!: Table<RecurringTransaction>;
  loans!: Table<Loan>;
  
  // User data
  settings!: Table<Settings>;
  categories!: Table<Category>;
  merchantMappings!: Table<MerchantMapping>;
  importRules!: Table<ImportRule>;
  
  // System
  salaryDetections!: Table<SalaryDetection>;
  importHistory!: Table<ImportHistory>;

  constructor() {
    super('wealthpilot');
    
    this.version(2).stores({
      accounts: '++id, name, type, isDefault',
      transactions: '++id, accountId, date, category, merchant, amount, [accountId+date]',
      goals: '++id, name, isActive',
      budgets: '++id, category, period',
      recurringTransactions: '++id, accountId, name, category, isActive',
      loans: '++id, accountId, name, isActive',
      settings: 'id',
      categories: '++id, name, parentId',
      merchantMappings: '++id, originalName, displayName',
      importRules: '++id, pattern, category',
      salaryDetections: '++id, transactionId, date',
      importHistory: '++id, accountId, importDate, filename'
    });
  }
}
```

## Entity Definitions

### Account

```typescript
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'cash';
  bankName: string;
  accountNumber?: string;        // Masked
  iban?: string;                 // Masked
  
  // Balance
  initialBalance: number;
  initialBalanceDate: string;    // ISO date
  currentBalance: number;
  lastRecalculated: string;      // ISO datetime
  
  // Display
  color: string;                 // Hex color
  icon: string;                  // Lucide icon name
  currency: string;              // ISO currency code
  
  // State
  isDefault: boolean;
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### Transaction

```typescript
interface Transaction {
  id: string;
  accountId: string;
  
  // Core data
  date: string;                  // ISO date YYYY-MM-DD
  valueDate?: string;            // Bank value date
  amount: number;                // Positive = income, Negative = expense
  balanceAfter: number;          // Calculated
  
  // Categorization
  category: string;              // "Food & Dining"
  subcategory?: string;          // "Groceries"
  
  // Description
  description: string;           // Full bank description
  merchant: string;              // Clean merchant name
  merchantOriginal?: string;     // Original from bank
  
  // Payment
  paymentMethod: 'card' | 'transfer' | 'direct_debit' | 'check' | 'cash' | 'other';
  reference?: string;            // Bank reference number
  
  // Flags
  isRecurring: boolean;
  recurringTransactionId?: string;
  isTransfer: boolean;
  linkedTransactionId?: string;  // For transfers
  isExcludedFromBudget: boolean;
  
  // User modifications
  isEdited: boolean;
  editedFields?: string[];       // Which fields were manually changed
  notes?: string;                // User notes
  tags?: string[];               // Custom tags
  
  // Import tracking
  importId?: string;             // Link to import history
  importHash?: string;           // For duplicate detection
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### Goal

```typescript
interface Goal {
  id: string;
  name: string;
  description?: string;
  
  // Target
  targetAmount: number;
  currentAmount: number;
  
  // Timeline
  deadline?: string;             // ISO date
  createdAt: string;
  
  // Recurring contribution
  monthlyContribution?: number;
  contributionDay?: number;      // Day of month
  
  // Display
  color: string;
  icon: string;
  
  // State
  isActive: boolean;
  completedAt?: string;
  
  // Category link
  budgetCategory?: string;       // Link to savings category
}
```

### Budget

```typescript
interface Budget {
  id: string;
  
  // Category
  category: string;
  subcategory?: string;
  
  // Limits
  amount: number;                // Budget limit
  period: 'weekly' | 'monthly' | 'yearly';
  
  // Classification (50/30/20)
  type: 'need' | 'want' | 'saving';
  
  // State
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### RecurringTransaction

```typescript
interface RecurringTransaction {
  id: string;
  accountId: string;
  
  // Identity
  name: string;
  description?: string;
  merchant: string;
  
  // Amount
  amount: number;
  isVariable: boolean;           // Amount varies each time
  averageAmount?: number;        // If variable
  
  // Schedule
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth?: number;           // For monthly
  dayOfWeek?: number;            // For weekly
  nextExpectedDate: string;
  
  // Classification
  category: string;
  subcategory?: string;
  type: 'subscription' | 'bill' | 'income' | 'transfer';
  
  // State
  isActive: boolean;
  isPaused: boolean;
  endDate?: string;
  cancelledAt?: string;
  
  // History
  lastOccurrence?: string;
  occurrenceCount: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

### Loan

```typescript
interface Loan {
  id: string;
  accountId: string;
  
  // Identity
  name: string;
  lender: string;
  
  // Terms
  principalAmount: number;       // Original loan amount
  interestRate: number;          // Annual percentage
  termMonths: number;            // Total duration
  
  // Payments
  monthlyPayment: number;
  paymentDay: number;
  firstPaymentDate: string;
  lastPaymentDate: string;       // Expected end
  
  // Progress
  remainingBalance: number;
  totalPaid: number;
  totalInterestPaid: number;
  paymentsRemaining: number;
  paymentsMade: number;
  
  // State
  status: 'active' | 'paid_off' | 'defaulted';
  paidOffDate?: string;
  
  // Link to transactions
  recurringTransactionId: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
```

### Category

```typescript
interface Category {
  id: string;
  name: string;
  parentId?: string;             // For subcategories
  
  // Display
  icon: string;
  color: string;
  
  // Budget classification
  defaultType: 'need' | 'want' | 'saving';
  
  // System
  isSystem: boolean;             // Default categories
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### MerchantMapping

```typescript
interface MerchantMapping {
  id: string;
  
  // Matching
  originalName: string;          // Raw bank description
  pattern: string;               // Regex pattern
  
  // Display
  displayName: string;           // User-friendly name
  
  // Auto-categorization
  category?: string;
  subcategory?: string;
  
  // Flags
  isRecurring?: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### ImportRule

```typescript
interface ImportRule {
  id: string;
  
  // Matching
  field: 'description' | 'merchant' | 'amount' | 'any';
  pattern: string;               // Regex or exact match
  isRegex: boolean;
  
  // Actions
  setCategory?: string;
  setSubcategory?: string;
  setMerchant?: string;
  setIsRecurring?: boolean;
  setTags?: string[];
  excludeFromBudget?: boolean;
  
  // Priority
  priority: number;              // Higher = processed first
  
  // State
  isActive: boolean;
  
  // Stats
  timesApplied: number;
  lastApplied?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

### SalaryDetection

```typescript
interface SalaryDetection {
  id: string;
  transactionId: string;
  
  // Detection
  date: string;
  amount: number;
  confidence: number;            // 0-1 detection confidence
  detectionMethod: 'pattern' | 'recurring' | 'manual';
  
  // State
  isConfirmed: boolean;          // User confirmed
  isIgnored: boolean;            // User said "not salary"
  
  // Financial month
  financialMonthStart: string;   // Date this month starts
  financialMonthEnd?: string;    // Date this month ends
  
  // Timestamps
  createdAt: string;
}
```

### ImportHistory

```typescript
interface ImportHistory {
  id: string;
  accountId: string;
  
  // File info
  filename: string;
  format: 'bank_csv' | 'llm_csv' | 'manual';
  fileSize: number;
  
  // Results
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  
  // Date range
  dateRangeStart: string;
  dateRangeEnd: string;
  
  // Errors
  errors?: ImportError[];
  
  // Timestamps
  importedAt: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
  originalValue: string;
}
```

### Settings

```typescript
interface Settings {
  id: 'global';                  // Singleton
  
  // Financial month
  financialMonthMode: 'auto' | 'fixed' | 'calendar';
  financialMonthFixedDay?: number;
  salaryMinAmount: number;
  salaryPatterns: string[];
  
  // Display
  currency: string;
  locale: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'system';
  
  // Budgets
  defaultBudgetPeriod: 'weekly' | 'monthly';
  budgetCategories: {
    needs: string[];
    wants: string[];
    savings: string[];
  };
  
  // Predictions
  predictionModel: 'simple' | 'advanced';
  showPredictions: boolean;
  
  // Privacy
  maskAmounts: boolean;
  
  // Timestamps
  updatedAt: string;
}
```

## Indexes

```typescript
// Compound indexes for common queries
transactions: '[accountId+date], [accountId+category], [date+category]'
recurringTransactions: '[accountId+isActive], [category+isActive]'
```

## Migration Path

### v0.0.1 → v0.1.0

```typescript
this.version(2).stores({
  // Add new tables
  accounts: '++id, name, type, isDefault',
  categories: '++id, name, parentId',
  merchantMappings: '++id, originalName',
  salaryDetections: '++id, transactionId, date',
  importHistory: '++id, accountId, importDate',
  
  // Update existing
  transactions: '++id, accountId, date, category, merchant, amount, [accountId+date]',
}).upgrade(tx => {
  // Add default account
  // Add accountId to all transactions
  // Migrate category data
});
```

---

*Last updated: January 20, 2026*
