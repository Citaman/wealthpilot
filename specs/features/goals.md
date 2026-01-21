# Savings Goals Specifications

**Version**: v0.2.0  
**Priority**: 🟡 MEDIUM  
**Status**: Specification Complete

---

## Overview

Enhanced savings goals with automatic contribution tracking and integration with financial month system.

## Current Goals (User-Defined)

| Goal | Target | Timeline |
|------|--------|----------|
| Emergency Fund | €3,000 | - |
| Car Maintenance | €1,500/year | Yearly |
| Family Vacation | €2,500/year | Yearly |
| Big Plan | €2,400/year | Yearly |
| Child 1 | €1,200/year | Yearly |
| Child 2 | €1,200/year | Yearly |

**Total Annual Savings Target**: €11,800/year = ~€983/month

---

## Features

### 1. Goal Types

```typescript
type GoalType = 
  | 'one_time'              // Emergency fund - fixed target
  | 'recurring_yearly'      // Vacation - resets yearly
  | 'recurring_monthly'     // Regular savings
  | 'sinking_fund';         // Car maintenance - builds up then depletes

interface Goal {
  id: string;
  name: string;
  type: GoalType;
  
  // Target
  targetAmount: number;
  currentAmount: number;
  
  // Timeline
  deadline?: string;
  resetDate?: string;         // For recurring goals
  
  // Contribution
  monthlyContribution?: number;
  autoDetectContributions: boolean;
  contributionCategory?: string;  // Link to a category
  
  // Display
  color: string;
  icon: string;
  priority: number;
  
  // State
  isActive: boolean;
  completedAt?: string;
}
```

### 2. Auto-Detect Contributions

Link goals to savings categories/accounts:

```tsx
<GoalContributionSettings goal={goal}>
  <h4 className="font-semibold">Contribution Tracking</h4>
  
  <RadioGroup value={trackingMode} onChange={setTrackingMode}>
    <RadioGroupItem value="manual">
      Manual - I'll update progress myself
    </RadioGroupItem>
    <RadioGroupItem value="category">
      Auto-detect from category
    </RadioGroupItem>
    <RadioGroupItem value="transfer">
      Track specific transfers
    </RadioGroupItem>
  </RadioGroup>
  
  {trackingMode === 'category' && (
    <div className="mt-4">
      <Label>Link to Category</Label>
      <CategorySelect
        value={linkedCategory}
        onChange={setLinkedCategory}
        filter={cat => cat.budgetType === 'saving'}
      />
      <p className="text-xs text-muted-foreground">
        Transactions in this category will count as contributions
      </p>
    </div>
  )}
  
  {trackingMode === 'transfer' && (
    <div className="mt-4">
      <Label>Track Transfers To</Label>
      <Input
        placeholder="e.g., Savings Account, Livret A"
        value={transferPattern}
        onChange={(e) => setTransferPattern(e.target.value)}
      />
    </div>
  )}
</GoalContributionSettings>
```

### 3. Goal Progress Visualization

```tsx
<GoalCard goal={goal}>
  <div className="flex items-center gap-4">
    <div 
      className="w-12 h-12 rounded-full flex items-center justify-center"
      style={{ backgroundColor: goal.color + '20' }}
    >
      <GoalIcon name={goal.icon} className="w-6 h-6" style={{ color: goal.color }} />
    </div>
    
    <div className="flex-1">
      <h4 className="font-semibold">{goal.name}</h4>
      <p className="text-sm text-muted-foreground">
        {goal.type === 'recurring_yearly' && `Resets ${format(new Date(goal.resetDate), 'MMM d')}`}
        {goal.deadline && `Due ${format(new Date(goal.deadline), 'MMM d, yyyy')}`}
      </p>
    </div>
  </div>
  
  {/* Progress */}
  <div className="mt-4">
    <div className="flex justify-between text-sm mb-1">
      <span>{formatCurrency(goal.currentAmount)}</span>
      <span>{formatCurrency(goal.targetAmount)}</span>
    </div>
    <Progress 
      value={(goal.currentAmount / goal.targetAmount) * 100}
      className="h-3"
      style={{ '--progress-color': goal.color } as any}
    />
    <p className="text-xs text-muted-foreground mt-1">
      {((goal.currentAmount / goal.targetAmount) * 100).toFixed(0)}% complete
      {goal.monthlyContribution && ` • ${formatCurrency(goal.monthlyContribution)}/month`}
    </p>
  </div>
  
  {/* Projection */}
  {goal.monthlyContribution && goal.deadline && (
    <div className="mt-3 p-2 bg-muted rounded-lg">
      <p className="text-sm">
        At current rate, you'll reach your goal{' '}
        <span className={projectedDate <= deadline ? 'text-green-600' : 'text-red-600'}>
          {format(projectedDate, 'MMM yyyy')}
        </span>
        {projectedDate > deadline && ' (behind schedule)'}
      </p>
    </div>
  )}
  
  {/* Quick add */}
  <div className="flex gap-2 mt-4">
    <Button variant="outline" size="sm" onClick={() => addContribution(50)}>
      +€50
    </Button>
    <Button variant="outline" size="sm" onClick={() => addContribution(100)}>
      +€100
    </Button>
    <Button variant="outline" size="sm" onClick={() => openAddDialog()}>
      Custom
    </Button>
  </div>
</GoalCard>
```

### 4. Goals Dashboard Widget

```tsx
<GoalsSummaryWidget>
  <h4 className="font-semibold mb-3">Savings Goals</h4>
  
  {/* Overall progress */}
  <div className="mb-4">
    <div className="flex justify-between text-sm mb-1">
      <span>Monthly Target</span>
      <span>{formatCurrency(totalMonthlyTarget)}</span>
    </div>
    <div className="flex justify-between text-sm mb-1">
      <span>Saved This Month</span>
      <span className={savedThisMonth >= targetThisMonth ? 'text-green-600' : ''}>
        {formatCurrency(savedThisMonth)}
      </span>
    </div>
    <Progress 
      value={(savedThisMonth / targetThisMonth) * 100}
      className="h-2"
    />
  </div>
  
  {/* Individual goals mini view */}
  <div className="space-y-2">
    {goals.slice(0, 3).map(goal => (
      <div key={goal.id} className="flex items-center gap-2">
        <div 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: goal.color }}
        />
        <span className="text-sm flex-1 truncate">{goal.name}</span>
        <span className="text-sm font-medium">
          {((goal.currentAmount / goal.targetAmount) * 100).toFixed(0)}%
        </span>
      </div>
    ))}
  </div>
  
  <Button variant="link" size="sm" asChild className="mt-2 p-0">
    <Link href="/goals">View All Goals</Link>
  </Button>
</GoalsSummaryWidget>
```

---

## Implementation Checklist

- [ ] Add GoalType taxonomy
- [ ] Implement auto-detect contributions
- [ ] Create recurring goal reset logic
- [ ] Build sinking fund tracking
- [ ] Add goal projection algorithm
- [ ] Create goals dashboard widget
- [ ] Implement quick-add contributions

---

*Last updated: January 20, 2026*
