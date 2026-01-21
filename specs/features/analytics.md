# Analytics Page Specifications

**Version**: v0.3.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

Complete redesign of the Analytics page to provide meaningful, actionable insights rather than decorative charts.

## Current Issues (v0.0.1)

1. ❌ Too similar to Dashboard
2. ❌ Line chart not informative
3. ❌ No useful functionality
4. ❌ No predictions
5. ❌ No trends analysis

---

## Design Philosophy

> "Every chart must answer a question the user actually has."

### Key Questions to Answer:
1. "How is my balance changing over time?"
2. "Where does my money go?"
3. "How does this month compare to previous months?"
4. "What are my spending trends?"
5. "What will my finances look like next month?"
6. "Which subscriptions cost me the most?"
7. "Am I spending more or less than usual?"

---

## Page Layout

```tsx
<AnalyticsPage>
  {/* Period Selector */}
  <AnalyticsHeader>
    <h1>Analytics</h1>
    <div className="flex gap-2">
      <ToggleGroup value={period} onChange={setPeriod}>
        <ToggleGroupItem value="1m">1M</ToggleGroupItem>
        <ToggleGroupItem value="3m">3M</ToggleGroupItem>
        <ToggleGroupItem value="6m">6M</ToggleGroupItem>
        <ToggleGroupItem value="12m">1Y</ToggleGroupItem>
        <ToggleGroupItem value="all">All</ToggleGroupItem>
      </ToggleGroup>
      
      <Select value={compareMode} onChange={setCompareMode}>
        <SelectItem value="none">No comparison</SelectItem>
        <SelectItem value="previous">vs Previous Period</SelectItem>
        <SelectItem value="average">vs Average</SelectItem>
      </Select>
    </div>
  </AnalyticsHeader>
  
  {/* Main Content */}
  <div className="grid grid-cols-12 gap-6">
    {/* Balance Timeline - Full width */}
    <BalanceTimeline className="col-span-12" />
    
    {/* Category Breakdown + Trends */}
    <CategoryBreakdown className="col-span-6" />
    <SpendingTrends className="col-span-6" />
    
    {/* Month Comparison */}
    <MonthComparison className="col-span-12" />
    
    {/* Recurring Analysis */}
    <RecurringAnalysis className="col-span-6" />
    
    {/* Predictions */}
    <Predictions className="col-span-6" />
    
    {/* Daily Spending Heatmap */}
    <DailyHeatmap className="col-span-12" />
  </div>
</AnalyticsPage>
```

---

## Component Specifications

### 1. Balance Timeline

**Question**: "How is my balance changing over time?"

```tsx
<BalanceTimeline>
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>Balance Over Time</CardTitle>
      <div className="flex gap-2">
        <Button 
          variant={showIncome ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setShowIncome(!showIncome)}
        >
          Income
        </Button>
        <Button 
          variant={showExpenses ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setShowExpenses(!showExpenses)}
        >
          Expenses
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer height={300}>
      <ComposedChart data={balanceData}>
        <XAxis dataKey="date" tickFormatter={formatDate} />
        <YAxis />
        <Tooltip content={<BalanceTooltip />} />
        
        {/* Balance line */}
        <Area 
          type="monotone"
          dataKey="balance"
          fill="url(#balanceGradient)"
          stroke="#3b82f6"
          strokeWidth={2}
        />
        
        {/* Optional: Income/Expense bars */}
        {showIncome && (
          <Bar dataKey="income" fill="#22c55e" opacity={0.6} />
        )}
        {showExpenses && (
          <Bar dataKey="expenses" fill="#ef4444" opacity={0.6} />
        )}
        
        {/* Reference lines */}
        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
        <ReferenceLine y={avgBalance} stroke="#8b5cf6" strokeDasharray="3 3" label="Avg" />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
      </ComposedChart>
    </ResponsiveContainer>
    
    {/* Stats row */}
    <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
      <Stat label="Lowest" value={minBalance} />
      <Stat label="Highest" value={maxBalance} />
      <Stat label="Average" value={avgBalance} />
      <Stat label="Current" value={currentBalance} />
    </div>
  </CardContent>
</BalanceTimeline>
```

**Data Structure:**
```typescript
interface BalanceDataPoint {
  date: string;
  balance: number;
  income: number;
  expenses: number;
}
```

---

### 2. Category Breakdown

**Question**: "Where does my money go?"

```tsx
<CategoryBreakdown>
  <CardHeader>
    <CardTitle>Spending by Category</CardTitle>
    <Tabs value={view} onChange={setView}>
      <TabsList>
        <TabsTrigger value="pie">Pie</TabsTrigger>
        <TabsTrigger value="treemap">Treemap</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
      </TabsList>
    </Tabs>
  </CardHeader>
  <CardContent>
    {view === 'pie' && (
      <ResponsiveContainer height={300}>
        <PieChart>
          <Pie
            data={categoryData}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {categoryData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )}
    
    {view === 'treemap' && (
      <ResponsiveContainer height={300}>
        <Treemap
          data={categoryTreeData}
          dataKey="amount"
          aspectRatio={4/3}
          stroke="#fff"
          content={<TreemapContent />}
        />
      </ResponsiveContainer>
    )}
    
    {view === 'list' && (
      <div className="space-y-2">
        {categoryData.map(cat => (
          <CategoryBar 
            key={cat.category}
            category={cat}
            maxAmount={maxCategoryAmount}
          />
        ))}
      </div>
    )}
  </CardContent>
</CategoryBreakdown>
```

---

### 3. Spending Trends

**Question**: "What are my spending patterns?"

```tsx
<SpendingTrends>
  <CardHeader>
    <CardTitle>Spending Trends</CardTitle>
    <Select value={selectedCategory} onChange={setSelectedCategory}>
      <SelectItem value="all">All Categories</SelectItem>
      {categories.map(cat => (
        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
      ))}
    </Select>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer height={300}>
      <AreaChart data={trendData}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        
        {/* Current period area */}
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.2}
        />
        
        {/* Moving average line */}
        <Line
          type="monotone"
          dataKey="movingAvg"
          stroke="#8b5cf6"
          strokeDasharray="5 5"
          dot={false}
        />
        
        {/* Trend direction indicator */}
        {trendDirection === 'up' && (
          <ReferenceLine stroke="#ef4444" />
        )}
        {trendDirection === 'down' && (
          <ReferenceLine stroke="#22c55e" />
        )}
      </AreaChart>
    </ResponsiveContainer>
    
    {/* Trend summary */}
    <div className="mt-4 p-3 rounded-lg bg-muted">
      <div className="flex items-center gap-2">
        {trendDirection === 'up' ? (
          <TrendingUp className="w-5 h-5 text-red-500" />
        ) : (
          <TrendingDown className="w-5 h-5 text-green-500" />
        )}
        <span>
          {selectedCategory || 'Overall'} spending is 
          <strong> {trendDirection === 'up' ? 'increasing' : 'decreasing'}</strong>
          {' '}by {Math.abs(trendPercentage).toFixed(0)}% over the last 3 months
        </span>
      </div>
    </div>
  </CardContent>
</SpendingTrends>
```

---

### 4. Month Comparison

**Question**: "How does this month compare?"

```tsx
<MonthComparison>
  <CardHeader>
    <CardTitle>Month Comparison</CardTitle>
    <div className="flex gap-2">
      <Select value={month1} onChange={setMonth1}>
        {availableMonths.map(m => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </Select>
      <span className="text-muted-foreground">vs</span>
      <Select value={month2} onChange={setMonth2}>
        {availableMonths.map(m => (
          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
        ))}
      </Select>
    </div>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer height={400}>
      <BarChart 
        data={comparisonData} 
        layout="vertical"
        margin={{ left: 100 }}
      >
        <XAxis type="number" />
        <YAxis type="category" dataKey="category" />
        <Tooltip />
        <Legend />
        
        <Bar dataKey="month1" fill="#3b82f6" name={month1Label} />
        <Bar dataKey="month2" fill="#8b5cf6" name={month2Label} />
      </BarChart>
    </ResponsiveContainer>
    
    {/* Summary stats */}
    <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="p-4 rounded-lg bg-blue-50">
        <p className="text-sm text-muted-foreground">{month1Label}</p>
        <p className="text-2xl font-bold">{formatCurrency(month1Total)}</p>
      </div>
      <div className="p-4 rounded-lg bg-purple-50">
        <p className="text-sm text-muted-foreground">{month2Label}</p>
        <p className="text-2xl font-bold">{formatCurrency(month2Total)}</p>
        <p className={cn(
          "text-sm",
          diff > 0 ? "text-red-500" : "text-green-500"
        )}>
          {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({diffPercent.toFixed(0)}%)
        </p>
      </div>
    </div>
  </CardContent>
</MonthComparison>
```

---

### 5. Predictions

**Question**: "What will my finances look like next month?"

```tsx
<Predictions>
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>Predictions</CardTitle>
      <Select value={predictionModel} onChange={setPredictionModel}>
        <SelectItem value="simple">Simple (Moving Average)</SelectItem>
        <SelectItem value="advanced">Advanced (SARIMA)</SelectItem>
      </Select>
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Expected recurring */}
      <div className="p-4 rounded-lg border">
        <h4 className="font-semibold mb-2">Expected Recurring</h4>
        <p className="text-2xl font-bold text-red-500">
          {formatCurrency(expectedRecurring)}
        </p>
        <p className="text-sm text-muted-foreground">
          Based on {recurringCount} subscriptions/bills
        </p>
      </div>
      
      {/* Predicted variable */}
      <div className="p-4 rounded-lg border">
        <h4 className="font-semibold mb-2">Predicted Variable Spending</h4>
        <p className="text-2xl font-bold text-orange-500">
          {formatCurrency(predictedVariable)}
        </p>
        <p className="text-sm text-muted-foreground">
          Based on {predictionModel === 'simple' ? '3-month average' : 'seasonal patterns'}
        </p>
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">
            Confidence: {confidence}%
          </span>
          <Progress value={confidence} className="h-1 mt-1" />
        </div>
      </div>
      
      {/* Total predicted */}
      <div className="p-4 rounded-lg bg-muted">
        <h4 className="font-semibold mb-2">Total Predicted Expenses</h4>
        <p className="text-3xl font-bold">
          {formatCurrency(totalPredicted)}
        </p>
        <p className="text-sm text-muted-foreground">
          Range: {formatCurrency(predictedLow)} - {formatCurrency(predictedHigh)}
        </p>
      </div>
      
      {/* Predicted balance */}
      <div className="p-4 rounded-lg border-2 border-primary">
        <h4 className="font-semibold mb-2">Predicted End-of-Month Balance</h4>
        <p className={cn(
          "text-3xl font-bold",
          predictedBalance < 0 ? "text-red-500" : "text-green-500"
        )}>
          {formatCurrency(predictedBalance)}
        </p>
        <p className="text-sm text-muted-foreground">
          Current: {formatCurrency(currentBalance)} → Predicted: {formatCurrency(predictedBalance)}
        </p>
      </div>
    </div>
  </CardContent>
</Predictions>
```

**Prediction Algorithms:**

```typescript
// Simple: Moving Average
function simplePrediction(transactions: Transaction[], months: number = 3): number {
  const monthlyTotals = groupByMonth(transactions)
    .slice(0, months)
    .map(m => sumExpenses(m.transactions));
  
  return average(monthlyTotals);
}

// Advanced: SARIMA-like (simplified for browser)
function advancedPrediction(
  transactions: Transaction[],
  options: { seasonality: number; confidence: boolean }
): PredictionResult {
  const monthlyData = groupByMonth(transactions);
  
  // Detect seasonality (monthly patterns)
  const seasonalFactors = calculateSeasonalFactors(monthlyData);
  
  // Calculate trend
  const trend = calculateTrend(monthlyData);
  
  // Base prediction
  const nextMonthIndex = new Date().getMonth();
  const seasonalFactor = seasonalFactors[nextMonthIndex];
  const basePrediction = trend.intercept + trend.slope * (monthlyData.length + 1);
  const prediction = basePrediction * seasonalFactor;
  
  // Confidence interval
  const stdDev = calculateStdDev(monthlyData.map(m => m.total));
  const confidence95 = 1.96 * stdDev;
  
  return {
    predicted: prediction,
    low: prediction - confidence95,
    high: prediction + confidence95,
    confidence: calculateConfidence(monthlyData.length, stdDev)
  };
}
```

---

### 6. Recurring Analysis

**Question**: "How much do my subscriptions cost?"

```tsx
<RecurringAnalysis>
  <CardHeader>
    <CardTitle>Recurring Expenses</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Monthly total */}
    <div className="text-center mb-6">
      <p className="text-sm text-muted-foreground">Monthly Recurring</p>
      <p className="text-4xl font-bold">{formatCurrency(monthlyRecurring)}</p>
      <p className="text-sm text-muted-foreground">
        = {formatCurrency(monthlyRecurring * 12)}/year
      </p>
    </div>
    
    {/* Breakdown chart */}
    <ResponsiveContainer height={200}>
      <BarChart data={recurringByCategory} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="category" width={100} />
        <Tooltip />
        <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
    
    {/* Top subscriptions */}
    <div className="mt-4 space-y-2">
      <h4 className="font-semibold">Largest Recurring</h4>
      {topRecurring.map(r => (
        <div key={r.id} className="flex justify-between items-center">
          <span>{r.merchant}</span>
          <span className="font-medium">{formatCurrency(Math.abs(r.amount))}</span>
        </div>
      ))}
    </div>
  </CardContent>
</RecurringAnalysis>
```

---

### 7. Daily Spending Heatmap

**Question**: "When do I spend the most?"

```tsx
<DailyHeatmap>
  <CardHeader>
    <CardTitle>Spending Heatmap</CardTitle>
    <Select value={heatmapPeriod} onChange={setHeatmapPeriod}>
      <SelectItem value="3m">Last 3 Months</SelectItem>
      <SelectItem value="6m">Last 6 Months</SelectItem>
      <SelectItem value="12m">Last Year</SelectItem>
    </Select>
  </CardHeader>
  <CardContent>
    {/* GitHub-style contribution graph */}
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day, dayIndex) => (
              <Tooltip key={dayIndex} content={<DayTooltip day={day} />}>
                <div
                  className={cn(
                    "w-3 h-3 rounded-sm",
                    getHeatmapColor(day.amount)
                  )}
                />
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
    
    {/* Legend */}
    <div className="flex items-center justify-end gap-2 mt-4">
      <span className="text-sm text-muted-foreground">Less</span>
      {heatmapColors.map((color, i) => (
        <div key={i} className={cn("w-3 h-3 rounded-sm", color)} />
      ))}
      <span className="text-sm text-muted-foreground">More</span>
    </div>
    
    {/* Day of week analysis */}
    <div className="mt-4 grid grid-cols-7 gap-2">
      {dayOfWeekStats.map(day => (
        <div key={day.name} className="text-center">
          <p className="text-xs text-muted-foreground">{day.name}</p>
          <p className="font-medium">{formatCurrency(day.average)}</p>
        </div>
      ))}
    </div>
  </CardContent>
</DailyHeatmap>
```

---

## Implementation Checklist

### v0.3.0

- [ ] Create Balance Timeline component
- [ ] Build Category Breakdown with 3 views
- [ ] Implement Spending Trends with moving average
- [ ] Add Month Comparison selector
- [ ] Create Predictions component
- [ ] Implement simple prediction (moving average)
- [ ] Build Recurring Analysis
- [ ] Create Daily Heatmap
- [ ] Add period selector (1M/3M/6M/1Y/All)
- [ ] Implement compare mode

### v0.4.0

- [ ] Add SARIMA prediction model
- [ ] Add Prophet-style prediction option
- [ ] Confidence intervals on predictions
- [ ] Export analytics as PDF/image

---

*Last updated: January 20, 2026*
