// Database schema and IndexedDB setup using Dexie
import Dexie, { type Table } from 'dexie';
import {
  Wallet,
  Home,
  Utensils,
  Car,
  ShoppingBag,
  FileText,
  Heart,
  Film,
  Users,
  Briefcase,
  ArrowRightLeft,
  Landmark,
  type LucideIcon
} from 'lucide-react';

// Types
export interface Transaction {
  id?: number;
  date: string;
  valueDate: string;
  direction: 'debit' | 'credit';
  amount: number;
  balanceAfter: number;
  category: string;
  subcategory: string;
  merchant: string;
  merchantOriginal: string;  // Original name from bank
  paymentMethod: string;
  description: string;
  isRecurring: boolean;
  notes?: string;
  tags?: string[];
  isExcluded?: boolean;  // Exclude from budgets/analytics
  accountId: number;
  linkedTransferId?: number; // Link to paired transfer transaction (v0.5.0)
  createdAt: string;
  updatedAt: string;
}

// Merchant mapping rules (v0.2.0)
export interface MerchantRule {
  id?: number;
  pattern: string;           // Regex pattern to match
  merchantName: string;      // Clean merchant name
  category?: string;         // Optional auto-category
  subcategory?: string;      // Optional auto-subcategory
  isActive: boolean;
  matchCount: number;        // How many times this rule matched
  createdAt: string;
  updatedAt: string;
}

// Import rules for auto-categorization (v0.2.0)
export interface ImportRule {
  id?: number;
  name: string;
  pattern: string;           // Regex to match description
  field: 'description' | 'merchant' | 'amount';
  category: string;
  subcategory: string;
  merchantName?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Custom categories (v0.2.0)
export interface CustomCategory {
  id?: number;
  name: string;
  icon: string;
  color: string;
  subcategories: string[];
  isSystem: boolean;         // Built-in categories
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id?: number;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  currency: string;
  institution: string;
  color: string;
  isActive: boolean;
  // Balance tracking for backward calculation
  initialBalance: number;
  initialBalanceDate: string;
  lastRecalculated?: string;
  createdAt: string;
  updatedAt: string;
}

// Balance checkpoint - a known balance at a specific date
export interface BalanceCheckpoint {
  id?: number;
  accountId: number;
  date: string;           // Date when this balance was known (e.g., bank statement date)
  balance: number;        // Known balance at this date
  note?: string;          // Optional note (e.g., "Bank statement Dec 2024")
  isActive: boolean;      // Only the most recent active checkpoint is used
  createdAt: string;
  updatedAt: string;
}

// Detected salary for financial month boundaries
export interface DetectedSalary {
  id?: number;
  transactionId: number;
  date: string;
  amount: number;
  isConfirmed: boolean;
  financialMonthId: string;  // e.g., "2025-12"
  accountId: number;
  createdAt: string;
}

// Financial month settings
export type FinancialMonthMode = 'auto' | 'fixed' | 'calendar';

export interface FinancialMonthSettings {
  mode: FinancialMonthMode;
  fixedDay?: number;
  minimumSalaryAmount: number;
  salaryPatterns: string[];
  salaryMerchants: string[];
}

export interface Budget {
  id?: number;
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  year: number;
  month?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  linkedAccountId?: number; // v0.13.0: Link goal to a real account
  createdAt: string;
  updatedAt: string;
}

// v0.10.0: Goal contribution events (history)
export interface GoalContribution {
  id?: number;
  goalId: number;
  date: string; // YYYY-MM-DD
  amount: number; // +deposit / -withdrawal
  note?: string;
  createdAt: string;
}

export interface CategoryRule {
  id?: number;
  pattern: string;
  category: string;
  subcategory: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

// v0.4.0: Recurring transaction types
export type RecurringType = 'subscription' | 'bill' | 'loan' | 'income';
export type RecurringStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export interface RecurringOccurrence {
  id: string;
  transactionId?: number;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'missed';
}

export interface LoanDetails {
  principalAmount: number;       // Original loan amount
  interestRate: number;          // Annual %
  termMonths: number;
  remainingBalance: number;
  totalPaid: number;
  totalInterestPaid: number;
  paymentsMade: number;
  paymentsRemaining: number;
}

export interface RecurringTransaction {
  id?: number;
  type: RecurringType;
  name: string;
  merchant?: string;
  description?: string;
  
  // Amount
  amount: number;
  isVariable?: boolean;
  averageAmount?: number;
  lastAmount?: number;
  
  // Schedule
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  expectedDay?: number;          // Day of month (1-31)
  nextExpected: string;
  
  // Status
  status: RecurringStatus;
  startDate?: string;
  endDate?: string;
  cancelledAt?: string;
  
  // Category
  category: string;
  subcategory: string;
  
  // Tracking
  occurrences?: RecurringOccurrence[];
  missedCount?: number;
  lastDetected: string;
  
  // Loan-specific
  loan?: LoanDetails;
  
  // User flags
  isExcluded?: boolean;          // False positive - not actually recurring
  isUserCreated?: boolean;       // Manually added vs auto-detected
  
  // Legacy (for backward compat)
  isActive?: boolean;            // Deprecated: use status instead
  dayOfMonth?: number;           // Deprecated: use expectedDay instead
  
  accountId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  id?: number;
  key: string;
  value: string;
}

export type BudgetRule = {
  id: string;
  name: string;
  needs: number;
  wants: number;
  savings: number;
  isDefault: boolean;
  isCustom: boolean;
};

// Category hierarchy
export const CATEGORIES: Record<string, { icon: LucideIcon; color: string; subcategories: readonly string[] }> = {
  'Income': {
    icon: Wallet,
    color: '#22c55e',
    subcategories: ['Salary', 'Bonus', 'Refunds', 'Benefits', 'Investment', 'Other']
  },
  'Housing': {
    icon: Home,
    color: '#3b82f6',
    subcategories: ['Rent', 'Mortgage', 'Utilities', 'Insurance', 'Repairs', 'Furniture']
  },
  'Food': {
    icon: Utensils,
    color: '#f59e0b',
    subcategories: ['Groceries', 'Restaurants', 'Delivery', 'Fast Food', 'Coffee & Bakery']
  },
  'Transport': {
    icon: Car,
    color: '#8b5cf6',
    subcategories: ['Fuel', 'Public Transit', 'Ride-hailing', 'Parking', 'Car Service', 'Insurance']
  },
  'Shopping': {
    icon: ShoppingBag,
    color: '#ec4899',
    subcategories: ['Clothing', 'Electronics', 'Online', 'Retail', 'Beauty']
  },
  'Bills': {
    icon: FileText,
    color: '#06b6d4',
    subcategories: ['Phone', 'Internet', 'Subscriptions', 'Software', 'Insurance', 'Bank Fees']
  },
  'Health': {
    icon: Heart,
    color: '#ef4444',
    subcategories: ['Pharmacy', 'Doctor', 'Hospital', 'Insurance']
  },
  'Entertainment': {
    icon: Film,
    color: '#a855f7',
    subcategories: ['Cinema', 'Games', 'Events', 'Sports', 'Hobbies']
  },
  'Family': {
    icon: Users,
    color: '#14b8a6',
    subcategories: ['Childcare', 'Education', 'Activities', 'Clothing']
  },
  'Services': {
    icon: Briefcase,
    color: '#64748b',
    subcategories: ['Laundry', 'Cleaning', 'Professional', 'Other']
  },
  'Transfers': {
    icon: ArrowRightLeft,
    color: '#6b7280',
    subcategories: ['To Savings', 'To Investment', 'To Others', 'From Others']
  },
  'Taxes': {
    icon: Landmark,
    color: '#dc2626',
    subcategories: ['Income Tax', 'Property Tax', 'Fines', 'Other']
  }
};

// Default budget rules
export const DEFAULT_BUDGET_RULES: BudgetRule[] = [
  { id: '50-30-20', name: '50/30/20 Rule', needs: 50, wants: 30, savings: 20, isDefault: true, isCustom: false },
  { id: '60-20-20', name: '60/20/20 Rule', needs: 60, wants: 20, savings: 20, isDefault: false, isCustom: false },
  { id: '70-20-10', name: '70/20/10 Rule', needs: 70, wants: 20, savings: 10, isDefault: false, isCustom: false },
  { id: '80-20', name: '80/20 Rule', needs: 80, wants: 0, savings: 20, isDefault: false, isCustom: false },
];

// Default goals
export const DEFAULT_GOALS: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Emergency Fund',
    targetAmount: 3000,
    currentAmount: 0,
    icon: 'shield',
    color: '#ef4444',
    description: '3 months of expenses',
    isActive: true,
  },
  {
    name: 'Car Maintenance',
    targetAmount: 1500,
    currentAmount: 0,
    icon: 'car',
    color: '#f59e0b',
    description: 'Annual repairs & service (€1,500/year)',
    isActive: true,
  },
  {
    name: 'Family Vacation',
    targetAmount: 2500,
    currentAmount: 0,
    icon: 'plane',
    color: '#3b82f6',
    description: 'Summer 2026 trip (€2,500/year)',
    isActive: true,
  },
  {
    name: 'Big Plan (House/Car)',
    targetAmount: 2400,
    currentAmount: 0,
    icon: 'home',
    color: '#8b5cf6',
    description: 'Major purchase fund (€2,400/year)',
    isActive: true,
  },
  {
    name: 'Child 1 Savings',
    targetAmount: 1200,
    currentAmount: 0,
    icon: 'baby',
    color: '#ec4899',
    description: 'Education & future fund (€1,200/year)',
    isActive: true,
  },
  {
    name: 'Child 2 Savings',
    targetAmount: 1200,
    currentAmount: 0,
    icon: 'baby',
    color: '#14b8a6',
    description: 'Education & future fund (€1,200/year)',
    isActive: true,
  },
];

// Dexie Database
class WealthPilotDB extends Dexie {
  transactions!: Table<Transaction>;
  accounts!: Table<Account>;
  budgets!: Table<Budget>;
  goals!: Table<Goal>;
  goalContributions!: Table<GoalContribution>;
  categoryRules!: Table<CategoryRule>;
  recurringTransactions!: Table<RecurringTransaction>;
  detectedSalaries!: Table<DetectedSalary>;
  settings!: Table<Settings>;
  merchantRules!: Table<MerchantRule>;
  importRules!: Table<ImportRule>;
  customCategories!: Table<CustomCategory>;
  balanceCheckpoints!: Table<BalanceCheckpoint>;

  constructor() {
    super('WealthPilotDB');
    
    // Version 1: Original schema
    this.version(1).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, accountId, [date+accountId], [category+date]',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, category, accountId, isActive',
      settings: '++id, key'
    });

    // Version 2: Add detected salaries and update accounts
    this.version(2).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, accountId, [date+accountId], [category+date]',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, category, accountId, isActive',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key'
    }).upgrade(async (tx) => {
      // Migrate accounts to include new balance fields
      const accounts = await tx.table('accounts').toArray();
      for (const account of accounts) {
        await tx.table('accounts').update(account.id, {
          initialBalance: account.balance || 0,
          initialBalanceDate: new Date().toISOString().split('T')[0],
        });
      }
    });

    // Version 3: Add merchant rules, import rules, custom categories (v0.2.0)
    this.version(3).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, merchantOriginal, accountId, [date+accountId], [category+date], *tags',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, category, accountId, isActive',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key',
      merchantRules: '++id, pattern, merchantName, category, isActive',
      importRules: '++id, name, pattern, category, priority, isActive',
      customCategories: '++id, name, isSystem'
    }).upgrade(async (tx) => {
      // Migrate transactions to include merchantOriginal
      const transactions = await tx.table('transactions').toArray();
      for (const t of transactions) {
        if (!t.merchantOriginal) {
          await tx.table('transactions').update(t.id, {
            merchantOriginal: t.merchant,
            tags: t.tags || [],
            isExcluded: false,
          });
        }
      }
    });

    // Version 4: Enhanced recurring transactions (v0.4.0)
    this.version(4).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, merchantOriginal, accountId, [date+accountId], [category+date], *tags',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, type, status, category, accountId, merchant',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key',
      merchantRules: '++id, pattern, merchantName, category, isActive',
      importRules: '++id, name, pattern, category, priority, isActive',
      customCategories: '++id, name, isSystem'
    }).upgrade(async (tx) => {
      // Migrate recurring transactions to new schema
      const recurring = await tx.table('recurringTransactions').toArray();
      for (const r of recurring) {
        const updates: Record<string, unknown> = {};
        // Add type field (default to subscription)
        if (!r.type) {
          updates.type = 'subscription';
        }
        // Convert isActive to status
        if (r.status === undefined) {
          updates.status = r.isActive !== false ? 'active' : 'paused';
        }
        // Add missing fields
        if (r.occurrences === undefined) {
          updates.occurrences = [];
        }
        if (r.isExcluded === undefined) {
          updates.isExcluded = false;
        }
        if (r.isUserCreated === undefined) {
          updates.isUserCreated = false;
        }
        if (Object.keys(updates).length > 0) {
          await tx.table('recurringTransactions').update(r.id, updates);
        }
      }
    });

    // Version 5: Add balance checkpoints (v0.6.0)
    this.version(5).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, merchantOriginal, accountId, [date+accountId], [category+date], *tags',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, type, status, category, accountId, merchant',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key',
      merchantRules: '++id, pattern, merchantName, category, isActive',
      importRules: '++id, name, pattern, category, priority, isActive',
      customCategories: '++id, name, isSystem',
      balanceCheckpoints: '++id, accountId, date, isActive, [accountId+date]'
    });

    // Version 6: Add goal contribution history (v0.10.0)
    this.version(6).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, merchantOriginal, accountId, [date+accountId], [category+date], *tags',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive',
      goalContributions: '++id, goalId, date, [goalId+date]',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, type, status, category, accountId, merchant',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key',
      merchantRules: '++id, pattern, merchantName, category, isActive',
      importRules: '++id, name, pattern, category, priority, isActive',
      customCategories: '++id, name, isSystem',
      balanceCheckpoints: '++id, accountId, date, isActive, [accountId+date]'
    }).upgrade(async (tx) => {
      // Backfill an initial contribution so history matches existing balances.
      const goals = await tx.table('goals').toArray();
      const now = new Date().toISOString();

      for (const goal of goals) {
        const currentAmount = typeof goal.currentAmount === 'number' ? goal.currentAmount : 0;
        if (!currentAmount) continue;

        const createdAt = typeof goal.createdAt === 'string' ? goal.createdAt : now;
        const date = createdAt.split('T')[0];

        await tx.table('goalContributions').add({
          goalId: goal.id,
          date,
          amount: currentAmount,
          note: 'Imported starting balance',
          createdAt: now,
        });
      }
    });

    // Version 7: Add linkedAccountId to goals (v0.13.0)
    this.version(7).stores({
      transactions: '++id, date, valueDate, category, subcategory, merchant, merchantOriginal, accountId, [date+accountId], [category+date], *tags',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year, [year+month], [category+year]',
      goals: '++id, name, isActive, linkedAccountId',
      goalContributions: '++id, goalId, date, [goalId+date]',
      categoryRules: '++id, pattern, category, priority',
      recurringTransactions: '++id, name, type, status, category, accountId, merchant',
      detectedSalaries: '++id, transactionId, date, accountId, financialMonthId, [date+accountId]',
      settings: '++id, key',
      merchantRules: '++id, pattern, merchantName, category, isActive',
      importRules: '++id, name, pattern, category, priority, isActive',
      customCategories: '++id, name, isSystem',
      balanceCheckpoints: '++id, accountId, date, isActive, [accountId+date]'
    });
  }
}

export const db = new WealthPilotDB();

// Default financial month settings
export const DEFAULT_FINANCIAL_MONTH_SETTINGS: FinancialMonthSettings = {
  mode: 'auto',
  minimumSalaryAmount: 1000,
  salaryPatterns: [
    'VIREMENT.*SALAIRE',
    'VIR.*PAIE',
    'DIGITAL CLASSIFIEDS',
  ],
  salaryMerchants: [],
};

// Initialize default data
export async function initializeDatabase() {
  const accountCount = await db.accounts.count();
  
  if (accountCount === 0) {
    // Create default account with balance tracking
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    await db.accounts.add({
      name: 'Société Générale',
      type: 'checking',
      balance: 0,
      currency: 'EUR',
      institution: 'Société Générale',
      color: '#e11d48',
      isActive: true,
      initialBalance: 0,
      initialBalanceDate: today,
      createdAt: now,
      updatedAt: now,
    });
  }

  const goalsCount = await db.goals.count();
  
  if (goalsCount === 0) {
    // Create default goals
    const now = new Date().toISOString();
    for (const goal of DEFAULT_GOALS) {
      await db.goals.add({
        ...goal,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Set default budget rule
  const budgetRule = await db.settings.where('key').equals('budgetRule').first();
  if (!budgetRule) {
    await db.settings.add({
      key: 'budgetRule',
      value: '50-30-20'
    });
  }

  // Set default financial month settings
  const fmSettings = await db.settings.where('key').equals('financialMonthSettings').first();
  if (!fmSettings) {
    await db.settings.add({
      key: 'financialMonthSettings',
      value: JSON.stringify(DEFAULT_FINANCIAL_MONTH_SETTINGS)
    });
  }
}
