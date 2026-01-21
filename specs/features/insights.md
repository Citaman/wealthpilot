# Financial Insights Algorithm

**Version**: v0.1.0  
**Priority**: 🟡 MEDIUM  
**Status**: Specification Complete

---

## Overview

The Financial Insights system provides smart, actionable advice based on user's transaction data. Insights should be relevant, timely, and genuinely helpful—not just filler content.

## Core Principles

1. **Actionable**: Each insight should suggest a concrete action
2. **Timely**: Show insights when they're most relevant
3. **Personalized**: Based on user's actual spending patterns
4. **Non-repetitive**: Don't show the same insight twice in a row
5. **Prioritized**: Critical insights first

---

## Insight Types

### 1. Spending Spike Alert 🔴

**Trigger**: Category spending is 50%+ higher than average

```typescript
function detectSpendingSpike(
  transactions: Transaction[],
  currentMonth: FinancialMonth
): Insight | null {
  const categories = groupByCategory(transactions);
  
  for (const [category, txs] of categories) {
    const currentSpending = sumByMonth(txs, currentMonth);
    const avgSpending = averageMonthlySpending(txs, excludeCurrent: true);
    
    if (currentSpending > avgSpending * 1.5) {
      const increase = ((currentSpending - avgSpending) / avgSpending * 100).toFixed(0);
      
      return {
        type: 'spending_spike',
        priority: 'high',
        icon: 'TrendingUp',
        title: `${category} spending up ${increase}%`,
        description: `You've spent ${formatCurrency(currentSpending)} on ${category} this month, compared to your average of ${formatCurrency(avgSpending)}.`,
        action: {
          label: 'View transactions',
          href: `/transactions?category=${category}`
        }
      };
    }
  }
  
  return null;
}
```

---

### 2. Budget Warning ⚠️

**Trigger**: 80%+ of budget used with days remaining

```typescript
function detectBudgetWarning(
  spent: number,
  budget: number,
  daysRemaining: number,
  category: string
): Insight | null {
  const percentage = (spent / budget) * 100;
  const dailyRemaining = (budget - spent) / daysRemaining;
  
  if (percentage >= 80 && percentage < 100 && daysRemaining > 3) {
    return {
      type: 'budget_warning',
      priority: 'high',
      icon: 'AlertTriangle',
      title: `${category} budget at ${percentage.toFixed(0)}%`,
      description: `You have ${formatCurrency(budget - spent)} left for ${daysRemaining} days. That's ${formatCurrency(dailyRemaining)}/day.`,
      action: {
        label: 'Adjust budget',
        href: `/budgets`
      }
    };
  }
  
  return null;
}
```

---

### 3. Budget Exceeded 🔴

**Trigger**: Over 100% of budget

```typescript
function detectBudgetExceeded(
  spent: number,
  budget: number,
  category: string
): Insight | null {
  if (spent > budget) {
    const over = spent - budget;
    const percentage = ((spent / budget) * 100).toFixed(0);
    
    return {
      type: 'budget_exceeded',
      priority: 'critical',
      icon: 'XCircle',
      title: `${category} budget exceeded`,
      description: `You're ${formatCurrency(over)} over your ${formatCurrency(budget)} budget (${percentage}%).`,
      action: {
        label: 'Review spending',
        href: `/transactions?category=${category}`
      }
    };
  }
  
  return null;
}
```

---

### 4. Unusual Transaction 🔍

**Trigger**: Transaction amount is 3+ standard deviations from mean for merchant

```typescript
function detectUnusualTransaction(
  transactions: Transaction[]
): Insight | null {
  const merchantGroups = groupByMerchant(transactions);
  
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 3) continue; // Need history
    
    const amounts = txs.map(t => Math.abs(t.amount));
    const mean = average(amounts);
    const stdDev = standardDeviation(amounts);
    
    const latest = txs[0]; // Most recent
    const latestAmount = Math.abs(latest.amount);
    
    if (latestAmount > mean + (stdDev * 3)) {
      return {
        type: 'unusual_transaction',
        priority: 'medium',
        icon: 'AlertCircle',
        title: `Unusual ${merchant} charge`,
        description: `${formatCurrency(latestAmount)} is much higher than your usual ${formatCurrency(mean)} at ${merchant}.`,
        action: {
          label: 'Review',
          href: `/transactions/${latest.id}`
        }
      };
    }
  }
  
  return null;
}
```

---

### 5. Unused Subscription 💸

**Trigger**: Paying for service but no related transactions in 60+ days

```typescript
function detectUnusedSubscription(
  subscriptions: RecurringTransaction[],
  transactions: Transaction[]
): Insight | null {
  const usagePatterns: Record<string, string[]> = {
    'Netflix': ['Netflix'],
    'Spotify': ['Spotify'],
    'Amazon Prime': ['Amazon', 'Prime Video'],
    'Gym': ['Fitness', 'Sport', 'Gym'],
    // ... more mappings
  };
  
  for (const sub of subscriptions) {
    if (!sub.isActive) continue;
    
    const relatedKeywords = usagePatterns[sub.merchant] || [sub.merchant];
    const relatedTxs = transactions.filter(tx => 
      relatedKeywords.some(kw => 
        tx.description.toLowerCase().includes(kw.toLowerCase())
      ) &&
      tx.id !== sub.id // Exclude the subscription itself
    );
    
    const lastUsage = relatedTxs[0]?.date;
    const daysSinceUsage = lastUsage 
      ? differenceInDays(new Date(), new Date(lastUsage))
      : Infinity;
    
    if (daysSinceUsage > 60) {
      return {
        type: 'subscription_unused',
        priority: 'medium',
        icon: 'CreditCard',
        title: `Review ${sub.merchant} subscription`,
        description: `You're paying ${formatCurrency(Math.abs(sub.amount))}/month but haven't used it in ${daysSinceUsage === Infinity ? 'a while' : `${daysSinceUsage} days`}.`,
        action: {
          label: 'Manage subscription',
          href: `/subscriptions`
        }
      };
    }
  }
  
  return null;
}
```

---

### 6. Saving Opportunity 💰

**Trigger**: Frequent small purchases in same category

```typescript
function detectSavingOpportunity(
  transactions: Transaction[]
): Insight | null {
  // Check for frequent small purchases (coffee, snacks, etc.)
  const smallPurchases = transactions.filter(tx => 
    Math.abs(tx.amount) < 10 && 
    Math.abs(tx.amount) > 2 &&
    tx.category === 'Food & Dining'
  );
  
  const last30Days = smallPurchases.filter(tx =>
    differenceInDays(new Date(), new Date(tx.date)) <= 30
  );
  
  if (last30Days.length >= 15) {
    const total = sumAmounts(last30Days);
    const avgPerDay = total / 30;
    const projectedMonthly = avgPerDay * 30;
    const projectedYearly = projectedMonthly * 12;
    
    return {
      type: 'saving_opportunity',
      priority: 'low',
      icon: 'PiggyBank',
      title: `Small purchases add up`,
      description: `You made ${last30Days.length} small purchases totaling ${formatCurrency(total)} this month. That's ${formatCurrency(projectedYearly)}/year.`,
      action: {
        label: 'View details',
        href: `/analytics?filter=small-purchases`
      }
    };
  }
  
  return null;
}
```

---

### 7. Bill Reminder 📅

**Trigger**: Expected bill in next 3 days

```typescript
function detectUpcomingBill(
  recurring: RecurringTransaction[]
): Insight | null {
  const upcomingBills = recurring.filter(r => {
    if (!r.isActive) return false;
    const nextDate = new Date(r.nextExpectedDate);
    const daysUntil = differenceInDays(nextDate, new Date());
    return daysUntil >= 0 && daysUntil <= 3;
  });
  
  if (upcomingBills.length > 0) {
    const bill = upcomingBills[0];
    const daysUntil = differenceInDays(
      new Date(bill.nextExpectedDate), 
      new Date()
    );
    
    return {
      type: 'bill_reminder',
      priority: 'medium',
      icon: 'Bell',
      title: `${bill.merchant} due ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}`,
      description: `${formatCurrency(Math.abs(bill.amount))} will be charged ${format(new Date(bill.nextExpectedDate), 'EEEE, MMM d')}.`,
      action: {
        label: 'View calendar',
        href: `/calendar`
      }
    };
  }
  
  return null;
}
```

---

### 8. Goal Progress 🎯

**Trigger**: Goal milestone reached (25%, 50%, 75%, 100%)

```typescript
function detectGoalMilestone(
  goals: Goal[]
): Insight | null {
  const milestones = [25, 50, 75, 100];
  
  for (const goal of goals) {
    if (!goal.isActive) continue;
    
    const percentage = (goal.currentAmount / goal.targetAmount) * 100;
    
    for (const milestone of milestones) {
      const prevPercentage = getPreviousPercentage(goal); // From storage
      
      if (percentage >= milestone && prevPercentage < milestone) {
        return {
          type: 'goal_progress',
          priority: milestone === 100 ? 'high' : 'low',
          icon: milestone === 100 ? 'Trophy' : 'Target',
          title: milestone === 100 
            ? `🎉 ${goal.name} goal completed!`
            : `${goal.name} is ${milestone}% funded`,
          description: milestone === 100
            ? `Congratulations! You've saved ${formatCurrency(goal.currentAmount)}.`
            : `You've saved ${formatCurrency(goal.currentAmount)} of your ${formatCurrency(goal.targetAmount)} goal.`,
          action: {
            label: 'View goals',
            href: `/goals`
          }
        };
      }
    }
  }
  
  return null;
}
```

---

### 9. New Recurring Detected 🔄

**Trigger**: Algorithm detects a new recurring transaction pattern

```typescript
function detectNewRecurring(
  transactions: Transaction[],
  existingRecurring: RecurringTransaction[]
): Insight | null {
  // Group by merchant
  const merchantGroups = groupByMerchant(transactions);
  
  for (const [merchant, txs] of merchantGroups) {
    if (txs.length < 2) continue;
    
    // Check if already tracked
    if (existingRecurring.some(r => r.merchant === merchant)) continue;
    
    // Check for monthly pattern
    const dates = txs.map(t => new Date(t.date)).sort((a, b) => b - a);
    const intervals = [];
    
    for (let i = 0; i < dates.length - 1; i++) {
      intervals.push(differenceInDays(dates[i], dates[i + 1]));
    }
    
    const avgInterval = average(intervals);
    const isMonthly = avgInterval >= 28 && avgInterval <= 32;
    
    if (isMonthly && txs.length >= 2) {
      const avgAmount = average(txs.map(t => t.amount));
      
      return {
        type: 'recurring_detected',
        priority: 'low',
        icon: 'RefreshCw',
        title: `Recurring payment detected`,
        description: `${merchant} appears to be a monthly payment of ~${formatCurrency(Math.abs(avgAmount))}. Add it to subscriptions?`,
        action: {
          label: 'Add subscription',
          onClick: () => createRecurring(merchant, avgAmount)
        }
      };
    }
  }
  
  return null;
}
```

---

### 10. Low Balance Warning 💳

**Trigger**: Balance below threshold (default: 2x largest upcoming bill)

```typescript
function detectLowBalance(
  balance: number,
  upcomingBills: RecurringTransaction[]
): Insight | null {
  const next30DaysBills = upcomingBills.filter(b => {
    const daysUntil = differenceInDays(
      new Date(b.nextExpectedDate), 
      new Date()
    );
    return daysUntil >= 0 && daysUntil <= 30;
  });
  
  const totalUpcoming = sumAmounts(next30DaysBills);
  const threshold = Math.abs(totalUpcoming) * 2; // 2x cushion
  
  if (balance < threshold) {
    return {
      type: 'balance_low',
      priority: 'critical',
      icon: 'AlertTriangle',
      title: `Low balance warning`,
      description: `Your balance (${formatCurrency(balance)}) may not cover upcoming bills (${formatCurrency(Math.abs(totalUpcoming))}).`,
      action: {
        label: 'View upcoming',
        href: `/calendar`
      }
    };
  }
  
  return null;
}
```

---

### 11. Positive Trend 📈

**Trigger**: Spending decreased by 10%+ compared to last month

```typescript
function detectPositiveTrend(
  transactions: Transaction[],
  currentMonth: FinancialMonth,
  previousMonth: FinancialMonth
): Insight | null {
  const currentSpending = sumExpenses(transactions, currentMonth);
  const previousSpending = sumExpenses(transactions, previousMonth);
  
  const decrease = previousSpending - currentSpending;
  const percentDecrease = (decrease / previousSpending) * 100;
  
  if (percentDecrease >= 10) {
    return {
      type: 'positive_trend',
      priority: 'low',
      icon: 'TrendingDown',
      title: `Spending down ${percentDecrease.toFixed(0)}%`,
      description: `Great job! You spent ${formatCurrency(decrease)} less than last month.`,
      action: null // Informational only
    };
  }
  
  return null;
}
```

---

### 12. Month Comparison 📊

**Trigger**: Always show (informational)

```typescript
function generateMonthComparison(
  transactions: Transaction[],
  currentMonth: FinancialMonth,
  previousMonth: FinancialMonth
): Insight {
  const current = {
    income: sumIncome(transactions, currentMonth),
    expenses: sumExpenses(transactions, currentMonth),
  };
  
  const previous = {
    income: sumIncome(transactions, previousMonth),
    expenses: sumExpenses(transactions, previousMonth),
  };
  
  const incomeChange = ((current.income - previous.income) / previous.income * 100).toFixed(0);
  const expenseChange = ((current.expenses - previous.expenses) / previous.expenses * 100).toFixed(0);
  
  return {
    type: 'comparison',
    priority: 'info',
    icon: 'BarChart3',
    title: `Month at a glance`,
    description: `Income: ${formatCurrency(current.income)} (${incomeChange}%), Expenses: ${formatCurrency(Math.abs(current.expenses))} (${expenseChange}%)`,
    action: {
      label: 'Full comparison',
      href: `/analytics?compare=true`
    }
  };
}
```

---

### 13. Category Tips 💡

**Trigger**: Based on specific category spending

```typescript
const CATEGORY_TIPS: Record<string, (spent: number) => string> = {
  'Food & Dining': (spent) => 
    spent > 500 
      ? 'Consider meal prepping to reduce dining out expenses.'
      : 'You\'re keeping food costs reasonable!',
  
  'Transportation': (spent) =>
    spent > 200
      ? 'Could carpooling or public transit reduce your costs?'
      : 'Your transportation costs are well managed.',
  
  'Shopping': (spent) =>
    spent > 300
      ? 'Try the 24-hour rule: wait a day before non-essential purchases.'
      : 'Good shopping discipline this month!',
      
  // ... more categories
};

function generateCategoryTip(
  category: string,
  spent: number
): Insight | null {
  const tipGenerator = CATEGORY_TIPS[category];
  if (!tipGenerator) return null;
  
  return {
    type: 'category_tip',
    priority: 'info',
    icon: 'Lightbulb',
    title: `${category} tip`,
    description: tipGenerator(spent),
    action: null
  };
}
```

---

### 14. Biggest Expense 🏆

**Trigger**: Always (highlight largest transaction)

```typescript
function getBiggestExpense(
  transactions: Transaction[],
  currentMonth: FinancialMonth
): Insight {
  const monthTxs = filterByMonth(transactions, currentMonth);
  const expenses = monthTxs.filter(t => t.amount < 0);
  const biggest = expenses.sort((a, b) => a.amount - b.amount)[0];
  
  if (!biggest) return null;
  
  const percentOfTotal = (Math.abs(biggest.amount) / sumExpenses(monthTxs)) * 100;
  
  return {
    type: 'biggest_expense',
    priority: 'info',
    icon: 'Receipt',
    title: `Biggest expense: ${biggest.merchant}`,
    description: `${formatCurrency(Math.abs(biggest.amount))} (${percentOfTotal.toFixed(0)}% of monthly spending)`,
    action: {
      label: 'View transaction',
      href: `/transactions/${biggest.id}`
    }
  };
}
```

---

### 15. Savings Rate 📊

**Trigger**: Always (track savings progress)

```typescript
function calculateSavingsRate(
  transactions: Transaction[],
  currentMonth: FinancialMonth
): Insight {
  const monthTxs = filterByMonth(transactions, currentMonth);
  const income = sumIncome(monthTxs);
  const expenses = Math.abs(sumExpenses(monthTxs));
  const saved = income - expenses;
  const savingsRate = (saved / income) * 100;
  
  let message: string;
  let icon: string;
  
  if (savingsRate >= 20) {
    message = `Excellent! You're saving ${savingsRate.toFixed(0)}% of income.`;
    icon = 'Sparkles';
  } else if (savingsRate >= 10) {
    message = `Good progress. ${savingsRate.toFixed(0)}% savings rate.`;
    icon = 'ThumbsUp';
  } else if (savingsRate > 0) {
    message = `Saving ${savingsRate.toFixed(0)}%. Aim for 20% if possible.`;
    icon = 'Target';
  } else {
    message = `Spending exceeds income. Review your budget.`;
    icon = 'AlertTriangle';
  }
  
  return {
    type: 'savings_rate',
    priority: savingsRate < 0 ? 'high' : 'info',
    icon,
    title: `Savings Rate`,
    description: message,
    action: {
      label: 'Budget planning',
      href: `/budgets`
    }
  };
}
```

---

## Priority & Display Rules

```typescript
type InsightPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Display order by priority
const PRIORITY_ORDER: InsightPriority[] = [
  'critical',  // Always show first
  'high',      // Important actionables
  'medium',    // Worth noting
  'low',       // Nice to know
  'info'       // Always-on metrics
];

// Max insights to show per priority
const MAX_INSIGHTS = {
  critical: 3,
  high: 2,
  medium: 2,
  low: 1,
  info: 2
};

function selectInsightsToShow(allInsights: Insight[]): Insight[] {
  const shown: Insight[] = [];
  
  for (const priority of PRIORITY_ORDER) {
    const ofPriority = allInsights.filter(i => i.priority === priority);
    const max = MAX_INSIGHTS[priority];
    shown.push(...ofPriority.slice(0, max));
  }
  
  return shown.slice(0, 6); // Max 6 total
}
```

---

## Insight Data Structure

```typescript
interface Insight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  icon: string;                  // Lucide icon name
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  data?: Record<string, any>;    // Additional data for rendering
  generatedAt: Date;
  expiresAt?: Date;              // Auto-dismiss after
  isDismissed?: boolean;
}
```

---

## Caching & Performance

```typescript
// Cache insights for 1 hour
const INSIGHT_CACHE_TTL = 60 * 60 * 1000;

async function getInsights(): Promise<Insight[]> {
  const cached = await db.insightCache.get('current');
  
  if (cached && Date.now() - cached.generatedAt < INSIGHT_CACHE_TTL) {
    return cached.insights.filter(i => !i.isDismissed);
  }
  
  // Generate fresh insights
  const fresh = await generateAllInsights();
  
  await db.insightCache.put({
    id: 'current',
    insights: fresh,
    generatedAt: Date.now()
  });
  
  return fresh;
}
```

---

## UI Component

```tsx
function InsightCard({ insight }: { insight: Insight }) {
  const Icon = Icons[insight.icon];
  
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border",
      insight.priority === 'critical' && "border-red-500 bg-red-50",
      insight.priority === 'high' && "border-orange-500 bg-orange-50",
    )}>
      <div className={cn(
        "p-2 rounded-full",
        insight.priority === 'critical' && "bg-red-100 text-red-600",
        insight.priority === 'high' && "bg-orange-100 text-orange-600",
        insight.priority === 'medium' && "bg-yellow-100 text-yellow-600",
        insight.priority === 'low' && "bg-blue-100 text-blue-600",
        insight.priority === 'info' && "bg-gray-100 text-gray-600",
      )}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium">{insight.title}</p>
        <p className="text-sm text-muted-foreground">{insight.description}</p>
        
        {insight.action && (
          <Button 
            variant="link" 
            size="sm" 
            className="p-0 h-auto mt-1"
            onClick={insight.action.onClick}
            asChild={!!insight.action.href}
          >
            {insight.action.href ? (
              <Link href={insight.action.href}>{insight.action.label}</Link>
            ) : (
              insight.action.label
            )}
          </Button>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => dismissInsight(insight.id)}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
```

---

## Implementation Checklist

- [ ] Create Insight type and interfaces
- [ ] Implement each detection algorithm
- [ ] Build insight generation pipeline
- [ ] Add caching layer
- [ ] Create InsightCard component
- [ ] Add dismiss functionality
- [ ] Implement refresh mechanism
- [ ] Add insight history tracking

---

*Last updated: January 20, 2026*
