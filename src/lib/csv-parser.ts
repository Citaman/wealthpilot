// CSV Parser and Transaction Mapper
import Papa from 'papaparse';
import { db, Transaction, CATEGORIES, RecurringTransaction } from './db';

// Type for parse results
export interface ParseResult {
  transactions: (Omit<Transaction, 'id'> & { isDuplicate?: boolean })[];
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  dateRange?: {
    start: string;
    end: string;
  };
  stats: {
    total: number;
    income: number;
    expenses: number;
    duplicates: number;
  };
}

// Type for sync results
export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  transactionsLinked?: number;
  recurringUpdated?: number;
  newRecurringCreated?: number;
  errors?: string[];
}

interface RawCSVRow {
  date: string;
  value_date: string;
  direction: string;
  amount: string;
  balance_after: string;
  category: string;
  subcategory: string;
  merchant: string;
  payment_method: string;
  description: string;
  is_recurring_guess: string;
  [key: string]: string;
}

// Map CSV categories to our simplified structure
const CATEGORY_MAP: Record<string, { category: string; subcategory: string }> = {
  // Income
  'Income|Salary': { category: 'Income', subcategory: 'Salary' },
  'Income|Meal allowance': { category: 'Income', subcategory: 'Benefits' },
  'Income|Refunds': { category: 'Income', subcategory: 'Refunds' },
  'Income|Insurance reimbursement': { category: 'Income', subcategory: 'Refunds' },
  'Income|Tax refund': { category: 'Income', subcategory: 'Refunds' },
  'Income|Other income': { category: 'Income', subcategory: 'Other' },
  
  // Housing
  'Housing|Utilities': { category: 'Housing', subcategory: 'Utilities' },
  'Housing|Repairs & maintenance': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Home goods / Furniture / Electronics': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Furniture & home goods': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Home improvement': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Furniture & appliances': { category: 'Housing', subcategory: 'Furniture' },
  
  // Food
  'Food|Delivery': { category: 'Food', subcategory: 'Delivery' },
  'Food|Groceries (local/ethnic)': { category: 'Food', subcategory: 'Groceries' },
  'Food|Fast food': { category: 'Food', subcategory: 'Fast Food' },
  'Food|Restaurant': { category: 'Food', subcategory: 'Restaurants' },
  'Food|Restaurants': { category: 'Food', subcategory: 'Restaurants' },
  'Food|Bakery & coffee': { category: 'Food', subcategory: 'Coffee & Bakery' },
  'Food|Groceries': { category: 'Food', subcategory: 'Groceries' },
  'Food|Convenience & snacks': { category: 'Food', subcategory: 'Groceries' },
  'Food|Delivery & meal prep': { category: 'Food', subcategory: 'Delivery' },
  'Food|Snacks & convenience': { category: 'Food', subcategory: 'Groceries' },
  'Food|Bakery / Convenience': { category: 'Food', subcategory: 'Coffee & Bakery' },
  
  // Transport
  'Transport|Ride-hailing': { category: 'Transport', subcategory: 'Ride-hailing' },
  'Transport|Fuel': { category: 'Transport', subcategory: 'Fuel' },
  'Transport|Parking & tolls': { category: 'Transport', subcategory: 'Parking' },
  'Transport|Car services': { category: 'Transport', subcategory: 'Car Service' },
  'Transport|Car admin': { category: 'Transport', subcategory: 'Insurance' },
  
  // Shopping
  'Shopping|Online shopping': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Clothing & accessories': { category: 'Shopping', subcategory: 'Clothing' },
  'Shopping|Local retail': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Electronics & media': { category: 'Shopping', subcategory: 'Electronics' },
  'Shopping|BNPL (Klarna)': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Beauty': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Jewelry': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Beauty & personal items': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Toys': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Sports': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Printing & photos': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Home goods': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Electronics accessories': { category: 'Shopping', subcategory: 'Electronics' },
  'Shopping|Clothing': { category: 'Shopping', subcategory: 'Clothing' },
  
  // Bills & Subscriptions
  'Bills & Subscriptions|Direct debit': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Insurance': { category: 'Bills', subcategory: 'Insurance' },
  'Bills & Subscriptions|App store & Apple': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Mobile': { category: 'Bills', subcategory: 'Phone' },
  'Bills & Subscriptions|Streaming & music': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Digital subscriptions': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Software': { category: 'Bills', subcategory: 'Software' },
  'Bills & Subscriptions|Bank fees & interest': { category: 'Bills', subcategory: 'Bank Fees' },
  
  // Health
  'Health|Pharmacy': { category: 'Health', subcategory: 'Pharmacy' },
  'Health|Doctor': { category: 'Health', subcategory: 'Doctor' },
  'Health|Doctor & medical': { category: 'Health', subcategory: 'Doctor' },
  'Health|Optical': { category: 'Health', subcategory: 'Doctor' },
  
  // Entertainment
  'Entertainment|Cinema': { category: 'Entertainment', subcategory: 'Cinema' },
  'Entertainment|Attractions / Cinema': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Theme park': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Leisure activities': { category: 'Entertainment', subcategory: 'Hobbies' },
  'Entertainment|Games': { category: 'Entertainment', subcategory: 'Games' },
  'Entertainment|Attractions': { category: 'Entertainment', subcategory: 'Events' },
  
  // Services
  'Services|General services': { category: 'Services', subcategory: 'Other' },
  'Services|Laundry / Dry cleaning': { category: 'Services', subcategory: 'Laundry' },
  'Services|Postage & shipping': { category: 'Services', subcategory: 'Other' },
  'Services|Card payment (merchant unclear)': { category: 'Services', subcategory: 'Other' },
  'Personal Care|Hair & grooming': { category: 'Services', subcategory: 'Other' },
  'Lifestyle|Fitness': { category: 'Entertainment', subcategory: 'Sports' },
  'Education|Training': { category: 'Family', subcategory: 'Education' },
  
  // Transfers
  'Transfers|Transfer out': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Transfer in': { category: 'Transfers', subcategory: 'From Others' },
  'Transfers|Transfer out (reimbursement)': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Car fund transfer': { category: 'Transfers', subcategory: 'To Savings' },
  'Transfers|Cheque payment': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Savings transfer': { category: 'Transfers', subcategory: 'To Savings' },
  
  // Other
  'Taxes & Government|Fines': { category: 'Taxes', subcategory: 'Fines' },
  'Cash|ATM withdrawal': { category: 'Transfers', subcategory: 'To Others' },
  'Finance|Installments / BNPL': { category: 'Bills', subcategory: 'Subscriptions' },
  'Travel|Tours & activities': { category: 'Entertainment', subcategory: 'Events' },
};

function mapCategory(rawCategory: string, rawSubcategory: string): { category: string; subcategory: string } {
  const key = `${rawCategory}|${rawSubcategory}`;
  if (CATEGORY_MAP[key]) {
    return CATEGORY_MAP[key];
  }
  
  // Fallback: try to match just category
  const categoryKey = Object.keys(CATEGORIES).find(c => 
    rawCategory.toLowerCase().includes(c.toLowerCase())
  );
  
  if (categoryKey) {
    return { 
      category: categoryKey, 
      subcategory: CATEGORIES[categoryKey as keyof typeof CATEGORIES].subcategories[0] 
    };
  }
  
  return { category: 'Services', subcategory: 'Other' };
}

export async function parseCSV(file: File, accountId?: number): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const targetAccountId = accountId || (await db.accounts.where('isActive').equals(1).first())?.id || 1;
          const existingTransactions = await db.transactions.toArray();
          
          // Create a set of existing transaction signatures for duplicate detection
          const existingSignatures = new Set(
            existingTransactions.map(t => `${t.date}|${t.amount}|${t.balanceAfter}|${t.description.substring(0, 50)}`)
          );
          
          const now = new Date().toISOString();
          const allTransactions: (Omit<Transaction, 'id'> & { isDuplicate?: boolean })[] = [];
          let duplicates = 0;
          let income = 0;
          let expenses = 0;
          let minDate = '';
          let maxDate = '';
          
          for (const row of results.data) {
            if (!row.date || !row.amount) continue;
            
            const amount = parseFloat(row.amount.replace(',', '.'));
            const balanceAfter = parseFloat(row.balance_after?.replace(',', '.') || '0');
            const description = row.description || '';
            
            // Track date range
            if (!minDate || row.date < minDate) minDate = row.date;
            if (!maxDate || row.date > maxDate) maxDate = row.date;
            
            // Track income/expenses
            if (row.direction === 'credit') {
              income += Math.abs(amount);
            } else {
              expenses += Math.abs(amount);
            }
            
            // Check for duplicate
            const signature = `${row.date}|${amount}|${balanceAfter}|${description.substring(0, 50)}`;
            const isDuplicate = existingSignatures.has(signature);
            
            if (isDuplicate) {
              duplicates++;
            }
            
            const { category, subcategory } = mapCategory(row.category || '', row.subcategory || '');
            
            const merchantName = row.merchant || 'Unknown';
            
            allTransactions.push({
              date: row.date,
              valueDate: row.value_date || row.date,
              direction: row.direction === 'credit' ? 'credit' : 'debit',
              amount,
              balanceAfter,
              category,
              subcategory,
              merchant: merchantName,
              merchantOriginal: merchantName,
              paymentMethod: row.payment_method || 'other',
              description,
              isRecurring: row.is_recurring_guess === 'True',
              accountId: targetAccountId,
              createdAt: now,
              updatedAt: now,
              isDuplicate,
            });
            
            if (!isDuplicate) {
              existingSignatures.add(signature);
            }
          }
          
          const newCount = allTransactions.filter(t => !t.isDuplicate).length;
          
          resolve({
            transactions: allTransactions,
            totalRows: results.data.length,
            newCount,
            duplicateCount: duplicates,
            dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : undefined,
            stats: {
              total: allTransactions.length,
              income,
              expenses,
              duplicates,
            },
          });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function importTransactions(transactions: Omit<Transaction, 'id'>[]): Promise<number> {
  const ids = await db.transactions.bulkAdd(transactions as Transaction[]);
  return Array.isArray(ids) ? ids.length : 1;
}

export async function detectRecurringTransactions(): Promise<void> {
  const transactions = await db.transactions.orderBy('date').toArray();
  
  // Group by merchant and approximate amount
  const merchantGroups: Record<string, Transaction[]> = {};
  
  for (const tx of transactions) {
    if (tx.direction === 'debit' && tx.amount < 0) {
      const key = `${tx.merchant}|${Math.round(Math.abs(tx.amount))}`;
      if (!merchantGroups[key]) {
        merchantGroups[key] = [];
      }
      merchantGroups[key].push(tx);
    }
  }
  
  // Find recurring patterns (at least 3 occurrences with ~30 day gaps)
  for (const [key, txs] of Object.entries(merchantGroups)) {
    if (txs.length >= 3) {
      const dates = txs.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
      const gaps = [];
      
      for (let i = 1; i < dates.length; i++) {
        gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      
      // Monthly recurring (25-35 days average gap)
      if (avgGap >= 25 && avgGap <= 35) {
        const existing = await db.recurringTransactions.where('name').equals(txs[0].merchant).first();
        
        if (!existing) {
          const lastTx = txs[txs.length - 1];
          const nextDate = new Date(lastTx.date);
          nextDate.setMonth(nextDate.getMonth() + 1);
          
          await db.recurringTransactions.add({
            type: 'subscription',
            status: 'active',
            name: txs[0].merchant,
            amount: Math.abs(txs[0].amount),
            category: txs[0].category,
            subcategory: txs[0].subcategory,
            frequency: 'monthly',
            expectedDay: new Date(lastTx.date).getDate(),
            isActive: true,
            lastDetected: lastTx.date,
            nextExpected: nextDate.toISOString().split('T')[0],
            accountId: txs[0].accountId,
          } as RecurringTransaction);
        }
      }
    }
  }
}

// Merge duplicate recurring items
export async function mergeRecurringItems(targetId?: number, sourceId?: number): Promise<SyncResult> {
  // This is a placeholder - implement actual merge logic
  return { added: 0, updated: 0, removed: 0, transactionsLinked: 0, recurringUpdated: 0, errors: [] };
}

// Sync recurring items with transactions
export async function syncRecurringWithTransactions(): Promise<SyncResult> {
  // This is a placeholder - implement actual sync logic
  await detectRecurringTransactions();
  return { added: 0, updated: 0, removed: 0, transactionsLinked: 0, recurringUpdated: 0, errors: [] };
}

// Full repair of recurring items
export async function fullRepairRecurring(): Promise<SyncResult> {
  // This is a placeholder - implement actual repair logic
  await detectRecurringTransactions();
  return { added: 0, updated: 0, removed: 0, transactionsLinked: 0, recurringUpdated: 0, errors: [] };
}

// Link a transaction to a recurring item
export async function linkTransactionToRecurring(
  transactionId: number,
  recurringId: number
): Promise<void> {
  await db.transactions.update(transactionId, { isRecurring: true });
  const recurring = await db.recurringTransactions.get(recurringId);
  if (recurring) {
    const tx = await db.transactions.get(transactionId);
    if (tx) {
      await db.recurringTransactions.update(recurringId, {
        lastDetected: tx.date,
      });
    }
  }
}
