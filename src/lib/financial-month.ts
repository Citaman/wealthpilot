// Financial Month System - Dynamic salary-based month boundaries
import { db, Transaction, DetectedSalary, FinancialMonthSettings, DEFAULT_FINANCIAL_MONTH_SETTINGS } from './db';
import { startOfMonth, endOfMonth, subDays, addDays, format, parseISO, isBefore, isAfter, isSameDay, subMonths } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';

// Salary detection patterns (built-in)
const SALARY_PATTERNS = [
  /VIREMENT\s+(SEPA\s+)?RECU.*SALAIRE/i,
  /VIREMENT\s+DE\s+.*EMPLOYEUR/i,
  /VIR\s+SEPA\s+RECU\s+.*PAIE/i,
  /SALAIRE/i,
  /DIGITAL CLASSIFIEDS/i,  // User's employer
  /VIREMENT.*SALAIRE/i,
];

// Financial month representation
export interface FinancialMonth {
  id: string;                    // e.g., "2025-12" (year-month of salary)
  salaryDate: Date;              // When salary was received
  salaryAmount: number;          // Amount of salary
  startDate: Date;               // Same as salaryDate
  endDate: Date;                 // Day before next salaryDate or end of month
  salaryTransactionId?: number;  // Link to the transaction
}

export interface IncomeStatistics {
  averageSalary: number;          // Average excluding outliers
  medianSalary: number;           // Median salary
  lastSalary: number;             // Most recent salary
  salaryDay: number;              // Typical day of month salary arrives
  outlierThreshold: number;       // Amount above which is considered outlier
  confidence: "high" | "medium" | "low";  // Confidence in the calculation
  salaryCount: number;            // Total number of salaries detected
  outlierCount: number;           // Number of outliers (bonuses)
  salaries: Transaction[];        // The salary transactions used
}

/**
 * Calculate statistics from a list of salary transactions
 * Merged from budget-types.ts
 */
export function calculateIncomeStatistics(salaryTransactions: Transaction[]): IncomeStatistics {
  if (salaryTransactions.length === 0) {
    return {
      averageSalary: 0,
      medianSalary: 0,
      lastSalary: 0,
      salaryDay: 25,
      outlierThreshold: 0,
      confidence: "low",
      salaryCount: 0,
      outlierCount: 0,
      salaries: [],
    };
  }

  // Sort by date descending (newest first)
  const sortedSalaries = [...salaryTransactions].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );

  // Get amounts for calculation
  const amounts = sortedSalaries.map((t) => t.amount);

  // Calculate median
  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const mid = Math.floor(sortedAmounts.length / 2);
  const median = sortedAmounts.length % 2 !== 0
    ? sortedAmounts[mid]
    : (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2;

  // Outlier threshold: 1.3x median (30% more likely has bonus)
  const outlierThreshold = median * 1.3;

  // Calculate average excluding outliers
  const regularSalaries = amounts.filter((a) => a <= outlierThreshold);
  const averageSalary = regularSalaries.length > 0
    ? regularSalaries.reduce((sum, a) => sum + a, 0) / regularSalaries.length
    : median;

  // Detect typical salary day
  const salaryDays = sortedSalaries.map((t) => parseISO(t.date).getDate());
  const dayCount: Record<number, number> = {};
  salaryDays.forEach((d) => {
    dayCount[d] = (dayCount[d] || 0) + 1;
  });
  const typicalDayEntry = Object.entries(dayCount)
    .sort(([, a], [, b]) => b - a)[0];
  const salaryDay = typicalDayEntry ? parseInt(typicalDayEntry[0]) : 25;

  // Determine confidence
  let confidence: "high" | "medium" | "low";
  if (regularSalaries.length >= 4) {
    confidence = "high";
  } else if (regularSalaries.length >= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Count outliers
  const outlierCount = amounts.filter((a) => a > outlierThreshold).length;

  return {
    averageSalary: Math.round(averageSalary),
    medianSalary: Math.round(median),
    lastSalary: amounts[0] || 0,
    salaryDay,
    outlierThreshold,
    confidence,
    salaryCount: sortedSalaries.length,
    outlierCount,
    salaries: sortedSalaries,
  };
}

// Check if a transaction looks like a salary
export function isSalaryTransaction(
  tx: Transaction, 
  settings: FinancialMonthSettings = DEFAULT_FINANCIAL_MONTH_SETTINGS
): boolean {
  // Must be income
  if (tx.direction !== 'credit') return false;
  
  // Must be above minimum threshold
  if (tx.amount < settings.minimumSalaryAmount) return false;
  
  // Check category
  if (tx.category === 'Income' && tx.subcategory === 'Salary') return true;
  
  // Check built-in patterns
  const description = `${tx.description} ${tx.merchant}`.toUpperCase();
  for (const pattern of SALARY_PATTERNS) {
    if (pattern.test(description)) return true;
  }
  
  // Check custom patterns from settings
  for (const patternStr of settings.salaryPatterns) {
    try {
      const pattern = new RegExp(patternStr, 'i');
      if (pattern.test(description)) return true;
    } catch {
      // Invalid regex, skip
    }
  }
  
  // Check custom merchants
  const merchantLower = tx.merchant.toLowerCase();
  for (const merchant of settings.salaryMerchants) {
    if (merchantLower.includes(merchant.toLowerCase())) return true;
  }
  
  return false;
}

// Detect all salary transactions from the database
export async function detectSalaryTransactions(
  accountId: number = 1,
  settings?: FinancialMonthSettings
): Promise<Transaction[]> {
  const effectiveSettings = settings || await getFinancialMonthSettings();
  
  const transactions = await db.transactions
    .where('accountId')
    .equals(accountId)
    .filter(tx => tx.direction === 'credit' && tx.amount >= effectiveSettings.minimumSalaryAmount)
    .sortBy('date');
  
  return transactions.filter(tx => isSalaryTransaction(tx, effectiveSettings));
}

// Get financial month settings from database
export async function getFinancialMonthSettings(): Promise<FinancialMonthSettings> {
  const setting = await db.settings.where('key').equals('financialMonthSettings').first();
  if (setting) {
    try {
      return JSON.parse(setting.value);
    } catch {
      return DEFAULT_FINANCIAL_MONTH_SETTINGS;
    }
  }
  return DEFAULT_FINANCIAL_MONTH_SETTINGS;
}

// Save financial month settings to database
export async function saveFinancialMonthSettings(settings: FinancialMonthSettings): Promise<void> {
  const existing = await db.settings.where('key').equals('financialMonthSettings').first();
  if (existing) {
    await db.settings.update(existing.id!, { value: JSON.stringify(settings) });
  } else {
    await db.settings.add({ key: 'financialMonthSettings', value: JSON.stringify(settings) });
  }
}

// Get the financial month for a given date
export function getFinancialMonth(
  date: Date,
  salaryTransactions: Transaction[],
  mode: FinancialMonthSettings['mode'] = 'auto',
  fixedDay?: number
): FinancialMonth {
  // Calendar mode: simple month boundaries
  if (mode === 'calendar') {
    return {
      id: format(date, 'yyyy-MM'),
      salaryDate: startOfMonth(date),
      salaryAmount: 0,
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    };
  }
  
  // Fixed day mode: use fixed day of month
  if (mode === 'fixed' && fixedDay) {
    const currentMonth = new Date(date.getFullYear(), date.getMonth(), fixedDay);
    const isBeforeFixedDay = date.getDate() < fixedDay;
    
    const startDate = isBeforeFixedDay 
      ? new Date(date.getFullYear(), date.getMonth() - 1, fixedDay)
      : currentMonth;
    
    const endDate = isBeforeFixedDay
      ? subDays(currentMonth, 1)
      : subDays(new Date(date.getFullYear(), date.getMonth() + 1, fixedDay), 1);
    
    return {
      id: format(startDate, 'yyyy-MM'),
      salaryDate: startDate,
      salaryAmount: 0,
      startDate,
      endDate,
    };
  }
  
  // Auto mode: detect from salary transactions
  if (salaryTransactions.length === 0) {
    // Fallback to calendar month if no salaries found
    return {
      id: format(date, 'yyyy-MM'),
      salaryDate: startOfMonth(date),
      salaryAmount: 0,
      startDate: startOfMonth(date),
      endDate: endOfMonth(date),
    };
  }
  
  // Sort salaries by date ascending
  const sortedSalaries = [...salaryTransactions].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  // Find the most recent salary before or on this date
  let currentSalary: Transaction | null = null;
  for (let i = sortedSalaries.length - 1; i >= 0; i--) {
    const salaryDate = parseISO(sortedSalaries[i].date);
    if (isBefore(salaryDate, date) || isSameDay(salaryDate, date)) {
      currentSalary = sortedSalaries[i];
      break;
    }
  }
  
  // If no salary found before this date, use the first salary
  if (!currentSalary) {
    currentSalary = sortedSalaries[0];
  }
  
  const startDate = parseISO(currentSalary.date);
  
  // Find the next salary after the current one
  let nextSalary: Transaction | null = null;
  for (const salary of sortedSalaries) {
    const salaryDate = parseISO(salary.date);
    if (isAfter(salaryDate, startDate)) {
      nextSalary = salary;
      break;
    }
  }
  
  // End date is day before next salary, or end of month if no next salary
  const endDate = nextSalary 
    ? subDays(parseISO(nextSalary.date), 1)
    : endOfMonth(startDate);
  
  return {
    id: format(startDate, 'yyyy-MM'),
    salaryDate: startDate,
    salaryAmount: currentSalary.amount,
    startDate,
    endDate,
    salaryTransactionId: currentSalary.id,
  };
}

// Get all financial months for a given period
export function getAllFinancialMonths(
  salaryTransactions: Transaction[],
  mode: FinancialMonthSettings['mode'] = 'auto',
  fixedDay?: number
): FinancialMonth[] {
  if (salaryTransactions.length === 0) {
    return [];
  }
  
  const months: FinancialMonth[] = [];
  const sortedSalaries = [...salaryTransactions].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );
  
  for (let i = 0; i < sortedSalaries.length; i++) {
    const salary = sortedSalaries[i];
    const nextSalary = sortedSalaries[i + 1];
    const startDate = parseISO(salary.date);
    
    const endDate = nextSalary 
      ? subDays(parseISO(nextSalary.date), 1)
      : endOfMonth(startDate);
    
    months.push({
      id: format(startDate, 'yyyy-MM'),
      salaryDate: startDate,
      salaryAmount: salary.amount,
      startDate,
      endDate,
      salaryTransactionId: salary.id,
    });
  }
  
  return months;
}

// Sync detected salaries to the database
export async function syncDetectedSalaries(accountId: number = 1): Promise<void> {
  const settings = await getFinancialMonthSettings();
  if (settings.mode !== 'auto') return;
  
  const salaryTransactions = await detectSalaryTransactions(accountId, settings);
  const existingSalaries = await db.detectedSalaries
    .where('accountId')
    .equals(accountId)
    .toArray();
  
  const existingTxIds = new Set(existingSalaries.map(s => s.transactionId));
  const now = new Date().toISOString();
  
  for (const tx of salaryTransactions) {
    if (!existingTxIds.has(tx.id!)) {
      await db.detectedSalaries.add({
        transactionId: tx.id!,
        date: tx.date,
        amount: tx.amount,
        isConfirmed: false,
        financialMonthId: format(parseISO(tx.date), 'yyyy-MM'),
        accountId,
        createdAt: now,
      });
    }
  }
}

// Get current financial month boundaries
export async function getCurrentFinancialMonth(accountId: number = 1): Promise<FinancialMonth> {
  const settings = await getFinancialMonthSettings();
  const salaryTransactions = await detectSalaryTransactions(accountId, settings);
  return getFinancialMonth(new Date(), salaryTransactions, settings.mode, settings.fixedDay);
}

// Get transactions within a financial month
export async function getTransactionsInFinancialMonth(
  financialMonth: FinancialMonth,
  accountId: number = 1
): Promise<Transaction[]> {
  const startStr = format(financialMonth.startDate, 'yyyy-MM-dd');
  const endStr = format(financialMonth.endDate, 'yyyy-MM-dd');
  
  return db.transactions
    .where('date')
    .between(startStr, endStr, true, true)
    .filter(tx => tx.accountId === accountId)
    .sortBy('date');
}

/**
 * Hook to get smart income data reactively
 * Uses detecting logic from financial-month to ensure consistency
 */
export function useSmartIncome(lookbackMonths: number = 6) {
  return useLiveQuery(async () => {
    const now = new Date();
    
    const settings = await getFinancialMonthSettings();
    const startDate = format(subMonths(now, lookbackMonths), "yyyy-MM-dd");
    
    // Get potential salary transactions (credits > min amount)
    // We scan all accounts to get a global view of income, as the budget is often global
    const candidates = await db.transactions
      .where("date")
      .aboveOrEqual(startDate)
      .and((t) => t.direction === 'credit' && t.amount >= settings.minimumSalaryAmount)
      .toArray();
      
    // Filter using the central logic
    const salaries = candidates.filter(tx => isSalaryTransaction(tx, settings));
    
    return calculateIncomeStatistics(salaries);
  }, [lookbackMonths]);
}
