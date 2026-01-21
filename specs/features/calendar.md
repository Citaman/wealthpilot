# Calendar Views Specification

**Version**: v0.1.0+ (Bill Calendar), v0.3.0 (Daily Expense Calendar)  
**Priority**: 🟡 MEDIUM  
**Status**: Specification Complete

---

## Overview

Two calendar features:
1. **Bill Calendar** (v0.1.0) - Already implemented, improvements needed
2. **Daily Expense Calendar** (v0.3.0) - New feature for day-by-day tracking

---

## 1. Bill Calendar Improvements

### Current Issues

- Future bills not showing based on recurring pattern
- No integration with subscription expected dates
- Missing prediction based on historical patterns

### Enhanced Bill Calendar

```tsx
<BillCalendar>
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <Button variant="ghost" onClick={goToPreviousMonth}>
      <ChevronLeft className="w-4 h-4" />
    </Button>
    <h2 className="text-xl font-semibold">
      {format(currentMonth, 'MMMM yyyy')}
    </h2>
    <Button variant="ghost" onClick={goToNextMonth}>
      <ChevronRight className="w-4 h-4" />
    </Button>
  </div>
  
  {/* Calendar grid */}
  <div className="grid grid-cols-7 gap-1">
    {/* Day headers */}
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
      <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
        {day}
      </div>
    ))}
    
    {/* Day cells */}
    {calendarDays.map(day => (
      <BillDayCell
        key={day.date}
        date={day.date}
        bills={day.bills}
        isCurrentMonth={day.isCurrentMonth}
        isToday={day.isToday}
        isPast={day.isPast}
        onClick={() => openDayDetail(day)}
      />
    ))}
  </div>
  
  {/* Legend */}
  <div className="flex gap-4 mt-4 justify-center">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-green-500" />
      <span className="text-sm">Paid</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-yellow-500" />
      <span className="text-sm">Pending</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-red-500" />
      <span className="text-sm">Overdue</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full bg-blue-500 opacity-50" />
      <span className="text-sm">Expected</span>
    </div>
  </div>
</BillCalendar>
```

### Day Cell Component

```tsx
function BillDayCell({ 
  date, 
  bills, 
  isCurrentMonth, 
  isToday, 
  isPast,
  onClick 
}: BillDayCellProps) {
  const totalAmount = bills.reduce((sum, b) => sum + Math.abs(b.amount), 0);
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "min-h-24 p-2 border rounded-lg cursor-pointer transition-colors",
        !isCurrentMonth && "bg-muted/50 opacity-50",
        isToday && "border-primary border-2",
        "hover:bg-accent"
      )}
    >
      <div className="flex justify-between items-start">
        <span className={cn(
          "text-sm font-medium",
          isToday && "text-primary"
        )}>
          {format(date, 'd')}
        </span>
        
        {bills.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {formatCurrency(totalAmount)}
          </Badge>
        )}
      </div>
      
      {/* Bill indicators */}
      <div className="mt-2 space-y-1">
        {bills.slice(0, 3).map(bill => (
          <div
            key={bill.id}
            className={cn(
              "text-xs p-1 rounded truncate",
              bill.status === 'paid' && "bg-green-100 text-green-700",
              bill.status === 'pending' && "bg-yellow-100 text-yellow-700",
              bill.status === 'overdue' && "bg-red-100 text-red-700",
              bill.status === 'expected' && "bg-blue-100 text-blue-700 opacity-60"
            )}
          >
            {bill.merchant}
          </div>
        ))}
        
        {bills.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{bills.length - 3} more
          </div>
        )}
      </div>
    </div>
  );
}
```

### Future Bill Prediction

```typescript
function predictFutureBills(
  recurring: RecurringTransaction[],
  months: number = 3
): PredictedBill[] {
  const predictions: PredictedBill[] = [];
  const today = new Date();
  const endDate = addMonths(today, months);
  
  for (const r of recurring) {
    if (!r.isActive) continue;
    
    // Calculate expected dates
    let nextDate = new Date(r.nextExpectedDate);
    
    while (nextDate <= endDate) {
      predictions.push({
        id: `predicted_${r.id}_${nextDate.toISOString()}`,
        recurringId: r.id,
        merchant: r.merchant,
        amount: r.amount,
        date: nextDate.toISOString(),
        status: 'expected',
        confidence: calculateConfidence(r, nextDate)
      });
      
      // Move to next occurrence
      nextDate = getNextOccurrence(nextDate, r.frequency);
    }
  }
  
  return predictions;
}

function calculateConfidence(
  recurring: RecurringTransaction,
  predictedDate: Date
): number {
  // Base confidence on historical consistency
  const occurrences = recurring.occurrences;
  if (occurrences.length < 2) return 50;
  
  // Check date variance
  const dayVariances = occurrences.map(o => {
    const expected = recurring.expectedDay || new Date(o.date).getDate();
    const actual = new Date(o.date).getDate();
    return Math.abs(expected - actual);
  });
  
  const avgVariance = average(dayVariances);
  
  // Less variance = higher confidence
  if (avgVariance < 2) return 95;
  if (avgVariance < 5) return 80;
  if (avgVariance < 10) return 60;
  return 40;
}
```

---

## 2. Daily Expense Calendar (NEW)

### Purpose

View day-by-day spending patterns, see what was spent on each day, track daily trends.

### Calendar View

```tsx
<DailyExpenseCalendar>
  {/* View selector */}
  <div className="flex items-center justify-between mb-4">
    <Tabs value={view} onChange={setView}>
      <TabsList>
        <TabsTrigger value="month">Month</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
      </TabsList>
    </Tabs>
    
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={goToPrevious}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="font-medium">
        {view === 'month' 
          ? format(currentMonth, 'MMMM yyyy')
          : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
        }
      </span>
      <Button variant="ghost" size="sm" onClick={goToNext}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  </div>
  
  {/* Summary stats */}
  <div className="grid grid-cols-4 gap-4 mb-6">
    <StatCard
      label="Total Spent"
      value={formatCurrency(totalSpent)}
      icon={<TrendingDown />}
      color="red"
    />
    <StatCard
      label="Total Income"
      value={formatCurrency(totalIncome)}
      icon={<TrendingUp />}
      color="green"
    />
    <StatCard
      label="Daily Average"
      value={formatCurrency(dailyAverage)}
      icon={<Calculator />}
    />
    <StatCard
      label="Biggest Day"
      value={formatCurrency(biggestDay.amount)}
      description={format(biggestDay.date, 'MMM d')}
      icon={<Award />}
    />
  </div>
  
  {/* Calendar */}
  {view === 'month' ? (
    <MonthView days={monthDays} onDayClick={openDayDetail} />
  ) : (
    <WeekView days={weekDays} onDayClick={openDayDetail} />
  )}
  
  {/* Heatmap legend */}
  <div className="flex items-center justify-center gap-2 mt-4">
    <span className="text-sm text-muted-foreground">Low</span>
    {heatmapColors.map((color, i) => (
      <div key={i} className={cn("w-6 h-6 rounded", color)} />
    ))}
    <span className="text-sm text-muted-foreground">High</span>
  </div>
</DailyExpenseCalendar>
```

### Day Cell (Month View)

```tsx
function ExpenseDayCell({ 
  date, 
  transactions, 
  isCurrentMonth,
  onClick 
}: ExpenseDayCellProps) {
  const totalSpent = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const heatLevel = getHeatLevel(totalSpent);
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "aspect-square p-1 rounded cursor-pointer transition-all",
        !isCurrentMonth && "opacity-40",
        heatmapColors[heatLevel],
        "hover:ring-2 hover:ring-primary"
      )}
    >
      <div className="h-full flex flex-col">
        <span className="text-xs">{format(date, 'd')}</span>
        
        {transactions.length > 0 && (
          <div className="mt-auto">
            {totalSpent > 0 && (
              <p className="text-xs font-medium text-red-700">
                -{formatCurrencyCompact(totalSpent)}
              </p>
            )}
            {totalIncome > 0 && (
              <p className="text-xs font-medium text-green-700">
                +{formatCurrencyCompact(totalIncome)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Week View (Expanded)

```tsx
function WeekView({ days, onDayClick }: WeekViewProps) {
  return (
    <div className="grid grid-cols-7 gap-4">
      {days.map(day => (
        <div
          key={day.date}
          onClick={() => onDayClick(day)}
          className={cn(
            "p-4 rounded-lg border cursor-pointer transition-colors",
            day.isToday && "border-primary border-2",
            "hover:bg-accent"
          )}
        >
          <div className="text-center mb-3">
            <p className="text-sm text-muted-foreground">
              {format(day.date, 'EEE')}
            </p>
            <p className={cn(
              "text-2xl font-bold",
              day.isToday && "text-primary"
            )}>
              {format(day.date, 'd')}
            </p>
          </div>
          
          {/* Transactions list */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {day.transactions.map(tx => (
              <div
                key={tx.id}
                className="flex justify-between items-center text-sm"
              >
                <span className="truncate flex-1">{tx.merchant}</span>
                <span className={cn(
                  "font-medium ml-2",
                  tx.amount < 0 ? "text-red-500" : "text-green-500"
                )}>
                  {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
          
          {/* Daily total */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Net</span>
              <span className={cn(
                "font-semibold",
                day.netAmount < 0 ? "text-red-500" : "text-green-500"
              )}>
                {formatCurrency(day.netAmount)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Day Detail Dialog

```tsx
<DayDetailDialog date={selectedDate}>
  <DialogHeader>
    <DialogTitle>
      {format(selectedDate, 'EEEE, MMMM d, yyyy')}
    </DialogTitle>
  </DialogHeader>
  
  <DialogContent>
    {/* Summary */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="text-center p-3 bg-red-50 rounded-lg">
        <p className="text-sm text-muted-foreground">Spent</p>
        <p className="text-xl font-bold text-red-600">
          {formatCurrency(dayStats.spent)}
        </p>
      </div>
      <div className="text-center p-3 bg-green-50 rounded-lg">
        <p className="text-sm text-muted-foreground">Income</p>
        <p className="text-xl font-bold text-green-600">
          {formatCurrency(dayStats.income)}
        </p>
      </div>
      <div className="text-center p-3 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Net</p>
        <p className={cn(
          "text-xl font-bold",
          dayStats.net < 0 ? "text-red-600" : "text-green-600"
        )}>
          {formatCurrency(dayStats.net)}
        </p>
      </div>
    </div>
    
    {/* Comparison */}
    <div className="p-3 bg-muted rounded-lg mb-4">
      <p className="text-sm">
        {dayStats.spent > avgDailySpend ? (
          <>
            <span className="text-red-600 font-medium">
              {formatCurrency(dayStats.spent - avgDailySpend)} more
            </span>
            {' '}than your daily average
          </>
        ) : (
          <>
            <span className="text-green-600 font-medium">
              {formatCurrency(avgDailySpend - dayStats.spent)} less
            </span>
            {' '}than your daily average
          </>
        )}
      </p>
    </div>
    
    {/* Transactions */}
    <div className="space-y-2">
      <h4 className="font-semibold">Transactions</h4>
      {dayTransactions.map(tx => (
        <TransactionRow
          key={tx.id}
          transaction={tx}
          compact={true}
          onClick={() => openTransaction(tx)}
        />
      ))}
      
      {dayTransactions.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No transactions on this day
        </p>
      )}
    </div>
  </DialogContent>
</DayDetailDialog>
```

### Spending Patterns Analysis

```tsx
<SpendingPatterns>
  <h3 className="font-semibold mb-4">Spending Patterns</h3>
  
  {/* Day of week analysis */}
  <div className="mb-6">
    <h4 className="text-sm text-muted-foreground mb-2">By Day of Week</h4>
    <div className="grid grid-cols-7 gap-2">
      {dayOfWeekStats.map(day => (
        <div key={day.name} className="text-center">
          <p className="text-xs text-muted-foreground">{day.name}</p>
          <p className="font-semibold">{formatCurrencyCompact(day.average)}</p>
          <div 
            className="h-16 bg-primary/20 rounded mt-1"
            style={{ 
              height: `${(day.average / maxDayAverage) * 64}px`,
              backgroundColor: day.average === maxDayAverage 
                ? 'rgb(239 68 68)' 
                : undefined
            }}
          />
        </div>
      ))}
    </div>
  </div>
  
  {/* Week of month analysis */}
  <div className="mb-6">
    <h4 className="text-sm text-muted-foreground mb-2">By Week of Month</h4>
    <div className="space-y-2">
      {weekOfMonthStats.map((week, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm w-16">Week {i + 1}</span>
          <Progress value={(week.average / maxWeekAverage) * 100} className="flex-1" />
          <span className="text-sm font-medium w-20 text-right">
            {formatCurrency(week.average)}
          </span>
        </div>
      ))}
    </div>
    <p className="text-xs text-muted-foreground mt-2">
      Highest spending in Week {highestWeek + 1} 
      (typically {highestWeekReason})
    </p>
  </div>
</SpendingPatterns>
```

---

## Implementation Checklist

### v0.1.0 (Bill Calendar Improvements)

- [ ] Add future bill predictions from recurring
- [ ] Implement confidence display
- [ ] Add "expected" status styling
- [ ] Connect to subscription expected dates
- [ ] Add legend for bill statuses

### v0.3.0 (Daily Expense Calendar)

- [ ] Create DailyExpenseCalendar component
- [ ] Implement month view with heatmap
- [ ] Implement week view with details
- [ ] Build day detail dialog
- [ ] Add spending patterns analysis
- [ ] Create view toggle (month/week)
- [ ] Implement navigation (prev/next)

---

*Last updated: January 20, 2026*
