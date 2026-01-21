# Dashboard Specifications

**Version**: v0.1.0  
**Priority**: 🟠 HIGH  
**Status**: Specification Complete

---

## Overview

The dashboard is the main entry point of the app. It should provide a quick, actionable overview of the user's financial health.

## Current Issues (v0.0.1)

1. ❌ Range selector dropdown doesn't work
2. ❌ Balance shows €0 (broken calculation)
3. ❌ Cash flow chart is a line chart (not useful)
4. ❌ Spending by category is random plot
5. ❌ No week calendar view
6. ❌ Financial Insights section is empty
7. ❌ Sidebar doesn't stick on scroll

---

## Component Specifications

### 1. Header Section

```tsx
<DashboardHeader>
  <div>
    <h1>Dashboard</h1>
    <p className="text-muted-foreground">
      Financial Month: Dec 24 - Jan 23
    </p>
  </div>
  
  {/* Remove global month selector - use per-component controls */}
</DashboardHeader>
```

**Changes:**
- Remove the non-functional month dropdown
- Display current financial month dates
- Each chart/component has its own date controls

---

### 2. Balance Card

```tsx
<BalanceCard>
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-muted-foreground">Current Balance</p>
      <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
      <p className="text-sm text-muted-foreground">
        As of {format(lastTransactionDate, 'MMM d')}
      </p>
    </div>
    <div className="text-right">
      <p className="text-sm text-muted-foreground">This Month</p>
      <p className="text-lg text-green-500">+{formatCurrency(income)}</p>
      <p className="text-lg text-red-500">-{formatCurrency(expenses)}</p>
    </div>
  </div>
  
  {/* Mini sparkline of balance over last 30 days */}
  <Sparkline data={balanceHistory} />
</BalanceCard>
```

**Requirements:**
- Balance calculated from transactions (see [balance-calculation.md](../architecture/balance-calculation.md))
- Shows income/expenses for current financial month
- Mini sparkline showing balance trend

---

### 3. Cash Flow Chart (Redesigned)

**Current:** Line chart showing cumulative values  
**Target:** Bar chart with income up, expenses down

```
Reference: image_2 from user feedback
```

```tsx
<CashFlowChart>
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold">Cash Flow</h3>
    <ToggleGroup value={period} onChange={setPeriod}>
      <ToggleGroupItem value="3m">3M</ToggleGroupItem>
      <ToggleGroupItem value="6m">6M</ToggleGroupItem>
      <ToggleGroupItem value="12m">12M</ToggleGroupItem>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
    </ToggleGroup>
  </div>
  
  <ResponsiveContainer>
    <BarChart data={monthlyData}>
      <XAxis dataKey="month" />
      <YAxis />
      <ReferenceLine y={0} stroke="#666" />
      <Bar 
        dataKey="income" 
        fill="#22c55e" 
        radius={[4, 4, 0, 0]}
        stackId="positive"
      />
      <Bar 
        dataKey="expenses" 
        fill="#ef4444" 
        radius={[0, 0, 4, 4]}
        stackId="negative"
      />
    </BarChart>
  </ResponsiveContainer>
  
  <div className="grid grid-cols-3 gap-4 mt-4 text-center">
    <div>
      <p className="text-sm text-muted-foreground">Avg Income</p>
      <p className="font-semibold text-green-500">{avgIncome}</p>
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Avg Expenses</p>
      <p className="font-semibold text-red-500">{avgExpenses}</p>
    </div>
    <div>
      <p className="text-sm text-muted-foreground">Net Flow</p>
      <p className="font-semibold">{netFlow}</p>
    </div>
  </div>
</CashFlowChart>
```

**Data Structure:**
```typescript
interface CashFlowData {
  month: string;           // "Jan", "Feb", etc.
  income: number;          // Positive value
  expenses: number;        // Negative value (shown below axis)
  net: number;             // income + expenses
}
```

---

### 4. Budget Progress Rings (Redesigned)

**Current:** Random pie/bar charts  
**Target:** Multiple concentric rings like image_1

```tsx
<BudgetProgress>
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold">Budget Status</h3>
    <Button variant="ghost" size="sm" asChild>
      <Link href="/budgets">View All</Link>
    </Button>
  </div>
  
  <div className="grid grid-cols-3 gap-4">
    {/* Needs Ring */}
    <BudgetRing
      label="Needs"
      spent={needsSpent}
      budget={needsBudget}
      percentage={needsPercentage}
      color="blue"
      allowOverflow={true}
    />
    
    {/* Wants Ring */}
    <BudgetRing
      label="Wants"
      spent={wantsSpent}
      budget={wantsBudget}
      percentage={wantsPercentage}
      color="purple"
      allowOverflow={true}
    />
    
    {/* Savings Ring */}
    <BudgetRing
      label="Savings"
      saved={savingsActual}
      target={savingsTarget}
      percentage={savingsPercentage}
      color="green"
      allowOverflow={true}
    />
  </div>
</BudgetProgress>
```

**BudgetRing Component:**
```tsx
interface BudgetRingProps {
  label: string;
  spent: number;
  budget: number;
  percentage: number;
  color: 'blue' | 'purple' | 'green' | 'red';
  allowOverflow: boolean;  // If true, >100% shows second ring
}

function BudgetRing({ percentage, allowOverflow, color }: BudgetRingProps) {
  const rings = [];
  let remaining = percentage;
  let ringIndex = 0;
  
  while (remaining > 0) {
    const ringPercent = Math.min(remaining, 100);
    rings.push({
      percent: ringPercent,
      opacity: 1 - (ringIndex * 0.3), // Darker for overflow
    });
    remaining -= 100;
    ringIndex++;
  }
  
  return (
    <div className="relative">
      {rings.map((ring, i) => (
        <svg key={i} className="absolute inset-0">
          <circle
            cx="50%"
            cy="50%"
            r={50 - i * 10}
            fill="none"
            stroke={color}
            strokeOpacity={ring.opacity}
            strokeDasharray={`${ring.percent * 3.14} 314`}
          />
        </svg>
      ))}
      <div className="text-center">
        <p className="text-2xl font-bold">{percentage}%</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
```

---

### 5. Week Calendar View (NEW)

Horizontal calendar showing 7 days with transactions.

```tsx
<WeekCalendar>
  <div className="flex items-center justify-between mb-4">
    <Button variant="ghost" onClick={goToPreviousWeek}>
      <ChevronLeft className="w-4 h-4" />
    </Button>
    <h3 className="font-semibold">
      {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
    </h3>
    <Button variant="ghost" onClick={goToNextWeek}>
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
  
  <div className="grid grid-cols-7 gap-2">
    {weekDays.map(day => (
      <DayCard
        key={day.date}
        date={day.date}
        isToday={day.isToday}
        isPast={day.isPast}
        transactions={day.transactions}
        totalSpent={day.totalSpent}
        onClick={() => openDayDetail(day.date)}
      />
    ))}
  </div>
</WeekCalendar>

function DayCard({ date, transactions, totalSpent, isPast, isToday }) {
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      isToday && "border-primary bg-primary/5",
      isPast && "opacity-75"
    )}>
      <p className="text-sm font-medium">{format(date, 'EEE')}</p>
      <p className="text-xs text-muted-foreground">{format(date, 'd')}</p>
      
      {transactions.length > 0 ? (
        <>
          <div className="mt-2 space-y-1">
            {transactions.slice(0, 2).map(tx => (
              <div key={tx.id} className="text-xs truncate">
                {tx.merchant}
              </div>
            ))}
            {transactions.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{transactions.length - 2} more
              </p>
            )}
          </div>
          <p className={cn(
            "mt-2 text-sm font-medium",
            totalSpent < 0 ? "text-red-500" : "text-green-500"
          )}>
            {formatCurrency(totalSpent)}
          </p>
        </>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No activity</p>
      )}
    </div>
  );
}
```

**Features:**
- Navigate week by week (forward/backward)
- Today highlighted
- Past days slightly dimmed
- Future days show expected bills
- Click day → opens detail dialog/drawer

---

### 6. Financial Insights (NEW)

AI-powered advice and observations.

```tsx
<FinancialInsights>
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold">Financial Insights</h3>
    <Button variant="ghost" size="sm" onClick={refreshInsights}>
      <RefreshCw className="w-4 h-4" />
    </Button>
  </div>
  
  <div className="space-y-3">
    {insights.map(insight => (
      <InsightCard
        key={insight.id}
        type={insight.type}
        icon={insight.icon}
        title={insight.title}
        description={insight.description}
        action={insight.action}
        priority={insight.priority}
      />
    ))}
  </div>
</FinancialInsights>
```

**Insight Types & Algorithms:**

See [insights.md](./insights.md) for full algorithm details.

Preview:
```typescript
type InsightType = 
  | 'spending_spike'        // Category spent 50%+ more than average
  | 'budget_warning'        // Approaching budget limit
  | 'budget_exceeded'       // Over budget
  | 'unusual_transaction'   // Outlier amount
  | 'subscription_unused'   // No activity but still paying
  | 'saving_opportunity'    // Could save based on patterns
  | 'bill_reminder'         // Upcoming bill in 3 days
  | 'goal_progress'         // Goal milestone reached
  | 'recurring_detected'    // New recurring expense found
  | 'balance_low'           // Balance below threshold
  | 'positive_trend'        // Spending decreased
  | 'comparison'            // Month vs last month
  | 'category_tip';         // Tips for specific category
```

---

### 7. Recent Transactions

Keep current design, but:
- Fix balance calculation
- Add quick category edit
- Link to full transactions page

```tsx
<RecentTransactions>
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold">Recent Transactions</h3>
    <Button variant="ghost" size="sm" asChild>
      <Link href="/transactions">View All</Link>
    </Button>
  </div>
  
  <div className="space-y-2">
    {transactions.slice(0, 5).map(tx => (
      <TransactionRow
        key={tx.id}
        transaction={tx}
        showBalance={true}
        compact={true}
      />
    ))}
  </div>
</RecentTransactions>
```

---

## Layout

```tsx
<DashboardPage>
  {/* Sticky Sidebar - see sidebar.md */}
  <Sidebar />
  
  <main className="flex-1 p-6 space-y-6">
    {/* Row 1: Balance + Cash Flow */}
    <div className="grid grid-cols-3 gap-6">
      <BalanceCard className="col-span-1" />
      <CashFlowChart className="col-span-2" />
    </div>
    
    {/* Row 2: Budget Rings + Week Calendar */}
    <div className="grid grid-cols-2 gap-6">
      <BudgetProgress />
      <WeekCalendar />
    </div>
    
    {/* Row 3: Insights + Recent Transactions */}
    <div className="grid grid-cols-2 gap-6">
      <FinancialInsights />
      <RecentTransactions />
    </div>
  </main>
</DashboardPage>
```

---

## Implementation Checklist

- [ ] Remove global month selector
- [ ] Fix balance calculation (use calculated value)
- [ ] Replace line chart with bar chart
- [ ] Create BudgetRing component with overflow support
- [ ] Build WeekCalendar component
- [ ] Implement insight algorithms (see insights.md)
- [ ] Add day detail dialog
- [ ] Make sidebar sticky

---

*Last updated: January 20, 2026*
