// Analytics calculations and data aggregation
import { db, Transaction, CATEGORIES } from './db';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, startOfYear, endOfYear } from 'date-fns';

export interface MonthlyStats {
  month: string;
  monthLabel: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  balance: number;
}

export interface CategoryStats {
  category: string;
  subcategory?: string;
  total: number;
  amount: number;
  count: number;
  percentage: number;
  trend: number; // vs previous period
  color: string;
}

export interface MerchantStats {
  merchant: string;
  category: string;
  amount: number;
  count: number;
  avgAmount: number;
}

export interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info' | 'tip';
  title: string;
  description: string;
  icon: string;
  value?: string;
  trend?: number;
  action?: {
    label: string;
    href: string;
  };
}

// Get transactions for a date range
export async function getTransactionsInRange(
  startDate: Date,
  endDate: Date
): Promise<Transaction[]> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');
  
  return db.transactions
    .where('date')
    .between(start, end, true, true)
    .toArray();
}

// Get monthly statistics for the last N months
export async function getMonthlyStats(months: number = 12): Promise<MonthlyStats[]> {
  const stats: MonthlyStats[] = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    const transactions = await getTransactionsInRange(start, end);
    
    const income = transactions
      .filter(t => t.direction === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = Math.abs(
      transactions
        .filter(t => t.direction === 'debit')
        .reduce((sum, t) => sum + t.amount, 0)
    );
    
    const savings = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    
    // Get end of month balance
    const lastTx = transactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    
    stats.push({
      month: format(date, 'yyyy-MM'),
      monthLabel: format(date, 'MMM yyyy'),
      income,
      expenses,
      savings,
      savingsRate,
      balance: lastTx?.balanceAfter || 0,
    });
  }
  
  return stats;
}

// Get category breakdown for a period
export async function getCategoryStats(
  startDate: Date,
  endDate: Date,
  type: 'income' | 'expense' = 'expense'
): Promise<CategoryStats[]> {
  const transactions = await getTransactionsInRange(startDate, endDate);
  
  // Previous period for trend calculation
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(startDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevEnd = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevTransactions = await getTransactionsInRange(prevStart, prevEnd);
  
  const filtered = transactions.filter(t => 
    type === 'income' ? t.direction === 'credit' : t.direction === 'debit'
  );
  
  const prevFiltered = prevTransactions.filter(t => 
    type === 'income' ? t.direction === 'credit' : t.direction === 'debit'
  );
  
  // Group by category
  const categoryGroups: Record<string, Transaction[]> = {};
  const prevCategoryGroups: Record<string, Transaction[]> = {};
  
  for (const tx of filtered) {
    if (!categoryGroups[tx.category]) {
      categoryGroups[tx.category] = [];
    }
    categoryGroups[tx.category].push(tx);
  }
  
  for (const tx of prevFiltered) {
    if (!prevCategoryGroups[tx.category]) {
      prevCategoryGroups[tx.category] = [];
    }
    prevCategoryGroups[tx.category].push(tx);
  }
  
  const totalAmount = Math.abs(filtered.reduce((sum, t) => sum + t.amount, 0));
  
  const stats: CategoryStats[] = [];
  
  for (const [category, txs] of Object.entries(categoryGroups)) {
    const amount = Math.abs(txs.reduce((sum, t) => sum + t.amount, 0));
    const prevAmount = Math.abs(
      (prevCategoryGroups[category] || []).reduce((sum, t) => sum + t.amount, 0)
    );
    
    const trend = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : 0;
    
    stats.push({
      category,
      total: amount,
      amount,
      count: txs.length,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      trend,
      color: CATEGORIES[category as keyof typeof CATEGORIES]?.color || '#64748b',
    });
  }
  
  return stats.sort((a, b) => b.amount - a.amount);
}

// Get subcategory breakdown for a category
export async function getSubcategoryStats(
  category: string,
  startDate: Date,
  endDate: Date
): Promise<CategoryStats[]> {
  const transactions = await getTransactionsInRange(startDate, endDate);
  
  const filtered = transactions.filter(t => t.category === category && t.direction === 'debit');
  const totalAmount = Math.abs(filtered.reduce((sum, t) => sum + t.amount, 0));
  
  const subcategoryGroups: Record<string, Transaction[]> = {};
  
  for (const tx of filtered) {
    if (!subcategoryGroups[tx.subcategory]) {
      subcategoryGroups[tx.subcategory] = [];
    }
    subcategoryGroups[tx.subcategory].push(tx);
  }
  
  const stats: CategoryStats[] = [];
  
  for (const [subcategory, txs] of Object.entries(subcategoryGroups)) {
    const amount = Math.abs(txs.reduce((sum, t) => sum + t.amount, 0));
    
    stats.push({
      category,
      subcategory,
      total: amount,
      amount,
      count: txs.length,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      trend: 0,
      color: CATEGORIES[category as keyof typeof CATEGORIES]?.color || '#64748b',
    });
  }
  
  return stats.sort((a, b) => b.amount - a.amount);
}

// Get top merchants
export async function getTopMerchants(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<MerchantStats[]> {
  const transactions = await getTransactionsInRange(startDate, endDate);
  
  const merchantGroups: Record<string, Transaction[]> = {};
  
  for (const tx of transactions.filter(t => t.direction === 'debit')) {
    if (!merchantGroups[tx.merchant]) {
      merchantGroups[tx.merchant] = [];
    }
    merchantGroups[tx.merchant].push(tx);
  }
  
  const stats: MerchantStats[] = [];
  
  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    const amount = Math.abs(txs.reduce((sum, t) => sum + t.amount, 0));
    
    stats.push({
      merchant,
      category: txs[0].category,
      amount,
      count: txs.length,
      avgAmount: amount / txs.length,
    });
  }
  
  return stats.sort((a, b) => b.amount - a.amount).slice(0, limit);
}

// Generate insights
export async function generateInsights(): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const lastMonth = startOfMonth(subMonths(now, 1));
  
  const currentMonthTx = await getTransactionsInRange(currentMonth, endOfMonth(now));
  const lastMonthTx = await getTransactionsInRange(lastMonth, endOfMonth(lastMonth));
  
  // Calculate totals
  const currentExpenses = Math.abs(
    currentMonthTx.filter(t => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0)
  );
  const lastExpenses = Math.abs(
    lastMonthTx.filter(t => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0)
  );
  
  const currentIncome = currentMonthTx.filter(t => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0);
  const lastIncome = lastMonthTx.filter(t => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0);
  
  // Savings rate insight
  const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : 0;
  const lastSavingsRate = lastIncome > 0 ? ((lastIncome - lastExpenses) / lastIncome) * 100 : 0;
  
  if (savingsRate > lastSavingsRate && savingsRate > 0) {
    insights.push({
      id: 'savings-improved',
      type: 'success',
      title: 'Savings Rate Improved!',
      description: `Your savings rate increased from ${lastSavingsRate.toFixed(1)}% to ${savingsRate.toFixed(1)}%`,
      icon: 'trending-up',
      value: `${savingsRate.toFixed(1)}%`,
      trend: savingsRate - lastSavingsRate,
    });
  }
  
  // Food delivery spending
  const deliverySpend = Math.abs(
    currentMonthTx
      .filter(t => t.category === 'Food' && (t.subcategory === 'Delivery' || t.subcategory === 'Fast Food'))
      .reduce((sum, t) => sum + t.amount, 0)
  );
  
  const lastDeliverySpend = Math.abs(
    lastMonthTx
      .filter(t => t.category === 'Food' && (t.subcategory === 'Delivery' || t.subcategory === 'Fast Food'))
      .reduce((sum, t) => sum + t.amount, 0)
  );
  
  if (deliverySpend < lastDeliverySpend && lastDeliverySpend > 0) {
    const reduction = ((lastDeliverySpend - deliverySpend) / lastDeliverySpend) * 100;
    insights.push({
      id: 'delivery-down',
      type: 'success',
      title: 'Food Delivery Down',
      description: `You spent €${deliverySpend.toFixed(0)} on delivery vs €${lastDeliverySpend.toFixed(0)} last month`,
      icon: 'utensils',
      value: `-${reduction.toFixed(0)}%`,
      trend: -reduction,
    });
  } else if (deliverySpend > 300) {
    insights.push({
      id: 'delivery-high',
      type: 'warning',
      title: 'High Food Delivery Spending',
      description: `You've spent €${deliverySpend.toFixed(0)} on delivery this month. Consider cooking more!`,
      icon: 'alert-triangle',
      value: `€${deliverySpend.toFixed(0)}`,
    });
  }
  
  // Check overdraft
  const lastBalance = currentMonthTx.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0]?.balanceAfter || 0;
  
  if (lastBalance < 0) {
    insights.push({
      id: 'overdraft',
      type: 'warning',
      title: 'Account in Overdraft',
      description: `Your balance is €${lastBalance.toFixed(2)}. Interest charges may apply.`,
      icon: 'alert-circle',
      value: `€${lastBalance.toFixed(2)}`,
    });
  } else if (lastBalance > 0) {
    insights.push({
      id: 'positive-balance',
      type: 'success',
      title: 'Positive Balance',
      description: `Great! Your account is in positive territory with €${lastBalance.toFixed(2)}`,
      icon: 'check-circle',
      value: `€${lastBalance.toFixed(2)}`,
    });
  }
  
  // Subscription count - use status instead of isActive (v0.4.0 schema change)
  const allRecurring = await db.recurringTransactions.where('status').equals('active').toArray();
  const subscriptions = allRecurring.length;
  if (subscriptions > 0) {
    const totalRecurring = allRecurring.reduce((sum, s) => sum + Math.abs(s.amount), 0);
    
    insights.push({
      id: 'subscriptions',
      type: 'info',
      title: `${subscriptions} Active Subscriptions`,
      description: `You're spending €${totalRecurring.toFixed(0)}/month on recurring expenses`,
      icon: 'repeat',
      value: `€${totalRecurring.toFixed(0)}/mo`,
    });
  }
  
  return insights;
}

// Get budget vs actual spending
export async function getBudgetComparison(year: number, month: number): Promise<{
  category: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
}[]> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = endOfMonth(startDate);
  
  const transactions = await getTransactionsInRange(startDate, endDate);
  const budgets = await db.budgets.where({ year, month }).toArray();
  
  // Get actual spending by category
  const actualByCategory: Record<string, number> = {};
  
  for (const tx of transactions.filter(t => t.direction === 'debit')) {
    if (!actualByCategory[tx.category]) {
      actualByCategory[tx.category] = 0;
    }
    actualByCategory[tx.category] += Math.abs(tx.amount);
  }
  
  const comparison = [];
  
  for (const budget of budgets) {
    const actual = actualByCategory[budget.category] || 0;
    comparison.push({
      category: budget.category,
      budgeted: budget.amount,
      actual,
      remaining: budget.amount - actual,
      percentage: budget.amount > 0 ? (actual / budget.amount) * 100 : 0,
    });
  }
  
  // Add categories that have spending but no budget
  for (const [category, actual] of Object.entries(actualByCategory)) {
    if (!comparison.find(c => c.category === category)) {
      comparison.push({
        category,
        budgeted: 0,
        actual,
        remaining: -actual,
        percentage: 100,
      });
    }
  }
  
  return comparison.sort((a, b) => b.actual - a.actual);
}

// Calculate goal progress
export async function calculateGoalProgress(): Promise<{
  goalId: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  percentage: number;
  monthlyContribution: number;
  monthsToGoal: number;
}[]> {
  const goals = await db.goals.where('isActive').equals(1 as number).toArray();
  
  return goals.map(goal => {
    const percentage = goal.targetAmount > 0 
      ? (goal.currentAmount / goal.targetAmount) * 100 
      : 0;
    
    const remaining = goal.targetAmount - goal.currentAmount;
    const monthlyContribution = remaining > 0 ? remaining / 12 : 0; // Assume 12 months target
    const monthsToGoal = monthlyContribution > 0 ? Math.ceil(remaining / monthlyContribution) : 0;
    
    return {
      goalId: goal.id!,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      percentage,
      monthlyContribution,
      monthsToGoal,
    };
  });
}

// Alias for generateInsights
export async function getInsights(startDate?: Date, endDate?: Date): Promise<Insight[]> {
  return generateInsights();
}

/**
 * Detects anomalous transactions in the given set based on 6-month historical averages
 */
export function detectAnomalies(transactions: Transaction[], history: Transaction[]) {
  const anomalies: Array<{ transaction: Transaction; reason: string; deviation: number }> = [];
  
  // Group history by merchant to calculate averages
  const merchantHistory = new Map<string, number[]>();
  history
    .filter(t => t.direction === 'debit')
    .forEach(t => {
      const amounts = merchantHistory.get(t.merchant) || [];
      amounts.push(Math.abs(t.amount));
      merchantHistory.set(t.merchant, amounts);
    });

  // Calculate merchant stats
  const merchantStats = new Map<string, { avg: number; stdDev: number; count: number }>();
  merchantHistory.forEach((amounts, merchant) => {
    if (amounts.length < 3) return; // Need at least 3 samples
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length;
    merchantStats.set(merchant, { avg, stdDev: Math.sqrt(variance), count: amounts.length });
  });

  // Check current transactions
  transactions.forEach(t => {
    if (t.direction !== 'debit') return;
    const stats = merchantStats.get(t.merchant);
    if (!stats) return;

    const amount = Math.abs(t.amount);
    // Anomaly if amount is > 2.5 std deviations from mean OR > 50% different from avg for low variance
    const deviation = stats.stdDev > 0 ? (amount - stats.avg) / stats.stdDev : 0;
    const percentageDiff = (amount - stats.avg) / stats.avg;

    if (amount > stats.avg * 1.5 && (deviation > 2.5 || stats.stdDev === 0)) {
      anomalies.push({
        transaction: t,
        reason: `Spending at ${t.merchant} is ${Math.round(percentageDiff * 100)}% higher than usual`,
        deviation: percentageDiff
      });
    }
  });

  return anomalies;
}

/**
 * Calculates advanced health metrics like Debt-to-Income and Net Worth Trend
 */
export function calculateAdvancedHealthMetrics(
  transactions: Transaction[], 
  accounts: any[],
  history: Transaction[],
  referenceDate: Date = new Date()
) {
  const now = referenceDate;
  const threeMonthsAgo = subMonths(now, 3);
  const sixMonthsAgo = subMonths(now, 6);

  // 1. Debt-to-Income Ratio
  // Monthly debt payments / Gross monthly income
  const recentIncome = transactions
    .filter(t => t.direction === 'credit' && t.date >= format(threeMonthsAgo, 'yyyy-MM-dd'))
    .reduce((s, t) => s + t.amount, 0) / 3;

  const totalDebt = accounts
    .filter(a => a.type === 'credit')
    .reduce((s, a) => s + Math.abs(a.balance), 0);

  const dti = recentIncome > 0 ? (totalDebt / recentIncome) * 100 : 0;

  // 2. Net Worth Trend (6-month)
  const monthlyStats = new Map<string, number>(); // month -> net flow
  history.forEach(t => {
    const month = t.date.slice(0, 7);
    const flow = t.direction === 'credit' ? t.amount : -Math.abs(t.amount);
    monthlyStats.set(month, (monthlyStats.get(month) || 0) + flow);
  });

  const last6Months = Array.from({ length: 6 }, (_, i) => format(subMonths(now, i), 'yyyy-MM'))
    .reverse();
  
  const flows = last6Months.map(m => monthlyStats.get(m) || 0);
  const avgMonthlyGrowth = flows.reduce((a, b) => a + b, 0) / 6;

  return {
    debtToIncomeRatio: dti,
    avgMonthlyGrowth,
    recentIncome,
    totalDebt
  };
}
