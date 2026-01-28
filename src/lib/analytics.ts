// Analytics calculations and data aggregation
import { db, Transaction, CATEGORIES } from './db';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, startOfYear, endOfYear } from 'date-fns';

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  balance: number;
}

export interface CategoryStats {
  category: string;
  subcategory?: string;
  amount: number;
  total?: number;
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
  type: 'warning' | 'success' | 'info';
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
  
  // Subscription count
  const subscriptions = await db.recurringTransactions.where('isActive').equals(1).count();
  if (subscriptions > 0) {
    const totalRecurring = (await db.recurringTransactions.where('isActive').equals(1).toArray())
      .reduce((sum, s) => sum + s.amount, 0);
    
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
  const goals = await db.goals.where('isActive').equals(1).toArray();
  
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

// Anomaly detection types
export interface Anomaly {
  transaction: Transaction;
  reason: string;
  deviation: number;
}

// Detect anomalies in current month transactions compared to historical data
export function detectAnomalies(
  currentMonthTx: Transaction[],
  historyTx: Transaction[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (historyTx.length < 10) return anomalies;
  
  // Calculate historical averages by category
  const categoryStats = new Map<string, { total: number; count: number; amounts: number[] }>();
  
  for (const tx of historyTx) {
    if (tx.direction !== 'debit') continue;
    
    const key = tx.category || 'Uncategorized';
    const stats = categoryStats.get(key) || { total: 0, count: 0, amounts: [] };
    stats.total += Math.abs(tx.amount);
    stats.count += 1;
    stats.amounts.push(Math.abs(tx.amount));
    categoryStats.set(key, stats);
  }
  
  // Calculate historical averages by merchant
  const merchantStats = new Map<string, { total: number; count: number; amounts: number[] }>();
  
  for (const tx of historyTx) {
    if (tx.direction !== 'debit') continue;
    
    const key = tx.merchant || 'Unknown';
    const stats = merchantStats.get(key) || { total: 0, count: 0, amounts: [] };
    stats.total += Math.abs(tx.amount);
    stats.count += 1;
    stats.amounts.push(Math.abs(tx.amount));
    merchantStats.set(key, stats);
  }
  
  // Check current month transactions for anomalies
  for (const tx of currentMonthTx) {
    if (tx.direction !== 'debit') continue;
    
    const amount = Math.abs(tx.amount);
    const merchant = tx.merchant || 'Unknown';
    const category = tx.category || 'Uncategorized';
    
    // Check merchant-level anomaly
    const mStats = merchantStats.get(merchant);
    if (mStats && mStats.count >= 2) {
      const avg = mStats.total / mStats.count;
      const stdDev = calculateStdDev(mStats.amounts);
      const threshold = avg + 2 * stdDev;
      
      if (amount > threshold && amount > avg * 1.5) {
        const deviation = (amount - avg) / avg;
        anomalies.push({
          transaction: tx,
          reason: `Unusually high for ${merchant} (avg: ${Math.round(avg)})`,
          deviation,
        });
        continue;
      }
    }
    
    // Check category-level anomaly for large transactions
    const cStats = categoryStats.get(category);
    if (cStats && cStats.count >= 3) {
      const avg = cStats.total / cStats.count;
      const stdDev = calculateStdDev(cStats.amounts);
      const threshold = avg + 2.5 * stdDev;
      
      if (amount > threshold && amount > avg * 2) {
        const deviation = (amount - avg) / avg;
        anomalies.push({
          transaction: tx,
          reason: `Large ${category} expense (avg: ${Math.round(avg)})`,
          deviation,
        });
      }
    }
  }
  
  // Sort by deviation (highest first) and limit results
  return anomalies
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 5);
}

// Helper function to calculate standard deviation
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

// Advanced health metrics for financial health score
export interface AdvancedHealthMetrics {
  savingsRate: number;
  debtToIncomeRatio: number;
  expenseVolatility: number;
  emergencyFundMonths: number;
  budgetAdherence: number;
  incomeStability: number;
  recentIncome: number;
  avgMonthlyGrowth: number;
  totalDebt: number;
}

export function calculateAdvancedHealthMetrics(
  transactions?: Transaction[],
  accounts?: { balance: number }[],
  allTransactions?: Transaction[]
): AdvancedHealthMetrics {
  // If no transactions provided, return defaults
  if (!transactions || transactions.length === 0) {
    return {
      savingsRate: 0,
      debtToIncomeRatio: 0,
      expenseVolatility: 0,
      emergencyFundMonths: 0,
      budgetAdherence: 50,
      incomeStability: 0,
      recentIncome: 0,
      avgMonthlyGrowth: 0,
      totalDebt: 0,
    };
  }
  
  // Calculate metrics from provided transactions
  const incomeTransactions = transactions.filter(t => t.direction === 'credit');
  const expenseTransactions = transactions.filter(t => t.direction === 'debit');
  
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  // Monthly averages (assuming 3 months of data)
  const avgIncome = totalIncome / 3;
  const avgExpenses = totalExpenses / 3;
  
  // Savings rate
  const savingsRate = avgIncome > 0 ? ((avgIncome - avgExpenses) / avgIncome) * 100 : 0;
  
  // Expense volatility - group by month and calculate variance
  const monthlyExpenses = new Map<string, number>();
  expenseTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    monthlyExpenses.set(month, (monthlyExpenses.get(month) || 0) + Math.abs(t.amount));
  });
  const expenseValues = Array.from(monthlyExpenses.values());
  const expenseStdDev = calculateStdDev(expenseValues);
  const expenseVolatility = avgExpenses > 0 ? (expenseStdDev / avgExpenses) * 100 : 0;
  
  // Income stability
  const monthlyIncome = new Map<string, number>();
  incomeTransactions.forEach(t => {
    const month = t.date.substring(0, 7);
    monthlyIncome.set(month, (monthlyIncome.get(month) || 0) + t.amount);
  });
  const incomeValues = Array.from(monthlyIncome.values());
  const incomeStdDev = calculateStdDev(incomeValues);
  const incomeStability = avgIncome > 0 ? Math.max(0, 100 - (incomeStdDev / avgIncome) * 100) : 0;
  
  // Emergency fund months - use account balances if available
  const totalBalance = accounts?.reduce((sum, a) => sum + (a.balance || 0), 0) || 0;
  const emergencyFundMonths = avgExpenses > 0 ? totalBalance / avgExpenses : 0;
  
  // Budget adherence (simplified)
  const budgetAdherence = savingsRate > 0 ? Math.min(100, savingsRate * 5) : 50;
  
  // Average monthly growth
  const monthlyBalances = new Map<string, number>();
  if (allTransactions) {
    allTransactions.forEach(t => {
      const month = t.date.substring(0, 7);
      const dateKey = month + '_date';
      const existingDate = monthlyBalances.get(dateKey);
      if (!monthlyBalances.has(month) || t.date > (typeof existingDate === 'number' ? '' : existingDate || '')) {
        monthlyBalances.set(month, t.balanceAfter);
        monthlyBalances.set(dateKey, 0); // Just a marker, we use t.date comparison above
      }
    });
  }
  const balanceValues = Array.from(monthlyBalances.entries())
    .filter(([k]) => !k.endsWith('_date'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
  
  let avgMonthlyGrowth = 0;
  if (balanceValues.length >= 2) {
    const growths = [];
    for (let i = 1; i < balanceValues.length; i++) {
      growths.push(balanceValues[i] - balanceValues[i - 1]);
    }
    avgMonthlyGrowth = growths.reduce((a, b) => a + b, 0) / growths.length;
  }
  
  return {
    savingsRate: Math.round(savingsRate * 10) / 10,
    debtToIncomeRatio: 0, // Would need debt data
    expenseVolatility: Math.round(expenseVolatility * 10) / 10,
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    budgetAdherence: Math.round(budgetAdherence),
    incomeStability: Math.round(incomeStability),
    recentIncome: Math.round(avgIncome),
    avgMonthlyGrowth: Math.round(avgMonthlyGrowth),
    totalDebt: 0, // Would need debt data
  };
}
