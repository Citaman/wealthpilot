// Financial Month System - Dynamic salary-based month boundaries
import { db, Transaction, FinancialMonthSettings, DEFAULT_FINANCIAL_MONTH_SETTINGS } from './db';
import { startOfMonth, endOfMonth, subDays, subMonths, addMonths, format, parseISO, isBefore, isAfter, isSameDay } from 'date-fns';
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

export type FinancialAccountScope = number | "all" | number[];

function isAllAccounts(scope: FinancialAccountScope): boolean {
  return scope === "all" || (Array.isArray(scope) && scope.length === 0);
}

/** One household cycle per month: earliest salary opens the cycle, all salaries fund it. */
export function collapseHouseholdSalaryAnchors(salaries: Transaction[]): Transaction[] {
  const byMonth = new Map<string, Transaction[]>();
  for (const salary of salaries) {
    const month = salary.date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) || []), salary]);
  }
  return [...byMonth.values()].map((items) => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...sorted[0],
      amount: items.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      merchant: "Revenus du foyer",
      description: items.map((item) => item.merchant || item.description).join(" · "),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
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
  accountScope: FinancialAccountScope = 1,
  settings?: FinancialMonthSettings
): Promise<Transaction[]> {
  const effectiveSettings = settings || await getFinancialMonthSettings();
  const transactions = isAllAccounts(accountScope)
    ? await db.transactions.toArray()
    : Array.isArray(accountScope)
      ? await db.transactions.where("accountId").anyOf(accountScope).toArray()
      : await db.transactions.where('accountId').equals(accountScope).toArray();
  const salaries = transactions
    .filter(tx => tx.direction === 'credit' && Math.abs(tx.amount) >= effectiveSettings.minimumSalaryAmount)
    .filter(tx => isSalaryTransaction(tx, effectiveSettings))
    .sort((a, b) => a.date.localeCompare(b.date));
  return isAllAccounts(accountScope) || Array.isArray(accountScope)
    ? collapseHouseholdSalaryAnchors(salaries)
    : salaries;
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
  
  // Without the next observed salary, keep a full salary-to-salary cycle.
  // Ending at the salary's calendar month would leave the following days
  // uncovered (for example Aug 25-31, then nothing until September's salary).
  const endDate = nextSalary 
    ? subDays(parseISO(nextSalary.date), 1)
    : subDays(addMonths(startDate, 1), 1);
  
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
  fixedDay?: number,
  referenceDate: Date = new Date()
): FinancialMonth[] {
  if (mode !== 'auto') {
    const earliestDate = salaryTransactions.length > 0
      ? parseISO([...salaryTransactions].sort((a, b) => a.date.localeCompare(b.date))[0].date)
      : referenceDate;
    const byId = new Map<string, FinancialMonth>();
    let cursor = startOfMonth(earliestDate);
    const lastMonth = startOfMonth(referenceDate);
    while (!isAfter(cursor, lastMonth)) {
      const representativeDate = mode === 'fixed' && fixedDay
        ? new Date(cursor.getFullYear(), cursor.getMonth(), fixedDay)
        : cursor;
      const month = getFinancialMonth(representativeDate, [], mode, fixedDay);
      byId.set(month.id, month);
      cursor = addMonths(cursor, 1);
    }
    return [...byId.values()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  if (salaryTransactions.length === 0) {
    return [getFinancialMonth(referenceDate, [], mode, fixedDay)];
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
      : subDays(addMonths(startDate, 1), 1);
    
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
export async function syncDetectedSalaries(accountScope: FinancialAccountScope = 1): Promise<void> {
  const settings = await getFinancialMonthSettings();
  if (settings.mode !== 'auto') return;

  const rawScopes = isAllAccounts(accountScope)
    ? (await db.accounts.toArray()).flatMap((account) => account.id === undefined ? [] : [account.id])
    : Array.isArray(accountScope) ? accountScope : [accountScope];
  const salaryTransactions = (await Promise.all(rawScopes.map((scope) => detectSalaryTransactions(scope, settings)))).flat();
  const accountIds = salaryTransactions.map((salary) => salary.accountId);
  const existingSalaries = isAllAccounts(accountScope)
    ? await db.detectedSalaries.toArray()
    : accountIds.length > 0 ? await db.detectedSalaries.where('accountId').anyOf(accountIds).toArray() : [];
  
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
        accountId: tx.accountId,
        createdAt: now,
      });
    }
  }
}

// Get current financial month boundaries
export async function getCurrentFinancialMonth(accountScope: FinancialAccountScope = 1): Promise<FinancialMonth> {
  const settings = await getFinancialMonthSettings();
  const salaryTransactions = await detectSalaryTransactions(accountScope, settings);
  return getFinancialMonth(new Date(), salaryTransactions, settings.mode, settings.fixedDay);
}

// Get transactions within a financial month
export async function getTransactionsInFinancialMonth(
  financialMonth: FinancialMonth,
  accountScope: FinancialAccountScope = 1
): Promise<Transaction[]> {
  const startStr = format(financialMonth.startDate, 'yyyy-MM-dd');
  const endStr = format(financialMonth.endDate, 'yyyy-MM-dd');
  
  const transactions = await db.transactions
    .where('date')
    .between(startStr, endStr, true, true)
    .sortBy('date');
  if (isAllAccounts(accountScope)) return transactions;
  const ids = Array.isArray(accountScope) ? new Set(accountScope) : new Set([accountScope]);
  return transactions.filter((transaction) => ids.has(transaction.accountId));
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
