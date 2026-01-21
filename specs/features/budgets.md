# Budget Management Specifications

**Version**: v0.2.0  
**Priority**: 🟡 MEDIUM  
**Status**: Specification Complete

---

## Overview

Enhanced budget management with customizable 50/30/20 allocation and real financial tracking.

## Current Issues (v0.0.1)

1. ❌ Cannot customize needs/wants/savings categories
2. ❌ Fixed category assignments
3. ❌ No rollover budget option
4. ❌ No budget history tracking

---

## Features

### 1. Customizable Category Classification

Allow users to define which categories are Needs, Wants, or Savings:

```tsx
<BudgetCategorySettings>
  <h3 className="font-semibold mb-4">Customize Your Budget Split</h3>
  
  {/* Income section */}
  <div className="mb-6 p-4 bg-muted rounded-lg">
    <Label>Monthly Income (for calculations)</Label>
    <Input
      type="number"
      value={monthlyIncome}
      onChange={(e) => setMonthlyIncome(parseFloat(e.target.value))}
      placeholder="e.g., 3000"
    />
    <p className="text-xs text-muted-foreground mt-1">
      Based on your salary: {formatCurrency(detectedSalary)} (auto-detected)
    </p>
  </div>
  
  {/* Split percentages */}
  <div className="grid grid-cols-3 gap-4 mb-6">
    <div className="p-4 border rounded-lg">
      <Label>Needs</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={needsPercent}
          onChange={(e) => setNeedsPercent(parseInt(e.target.value))}
          className="w-20"
        />
        <span>%</span>
      </div>
      <p className="text-lg font-semibold mt-2">
        {formatCurrency(monthlyIncome * needsPercent / 100)}
      </p>
    </div>
    
    <div className="p-4 border rounded-lg">
      <Label>Wants</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={wantsPercent}
          onChange={(e) => setWantsPercent(parseInt(e.target.value))}
          className="w-20"
        />
        <span>%</span>
      </div>
      <p className="text-lg font-semibold mt-2">
        {formatCurrency(monthlyIncome * wantsPercent / 100)}
      </p>
    </div>
    
    <div className="p-4 border rounded-lg">
      <Label>Savings</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={savingsPercent}
          onChange={(e) => setSavingsPercent(parseInt(e.target.value))}
          className="w-20"
        />
        <span>%</span>
      </div>
      <p className="text-lg font-semibold mt-2">
        {formatCurrency(monthlyIncome * savingsPercent / 100)}
      </p>
    </div>
  </div>
  
  {/* Total validation */}
  {needsPercent + wantsPercent + savingsPercent !== 100 && (
    <Alert variant="warning">
      <AlertDescription>
        Total must equal 100%. Current: {needsPercent + wantsPercent + savingsPercent}%
      </AlertDescription>
    </Alert>
  )}
  
  {/* Category classification */}
  <div className="space-y-4">
    <h4 className="font-semibold">Category Classification</h4>
    
    {categories.map(category => (
      <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          <CategoryIcon category={category} />
          <span>{category.name}</span>
        </div>
        
        <Select
          value={category.budgetType}
          onChange={(type) => updateCategoryType(category.id, type)}
        >
          <SelectItem value="need">
            <Badge variant="blue">Need</Badge>
          </SelectItem>
          <SelectItem value="want">
            <Badge variant="purple">Want</Badge>
          </SelectItem>
          <SelectItem value="saving">
            <Badge variant="green">Saving</Badge>
          </SelectItem>
          <SelectItem value="exclude">
            <Badge variant="outline">Exclude</Badge>
          </SelectItem>
        </Select>
      </div>
    ))}
  </div>
</BudgetCategorySettings>
```

### 2. Per-Category Budget Limits

```typescript
interface CategoryBudget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'weekly' | 'monthly';
  rollover: boolean;          // Unspent budget rolls to next period
  alertThreshold: number;     // Alert at X% spent (default 80)
}
```

### 3. Budget History

```tsx
<BudgetHistory>
  <h3 className="font-semibold mb-4">Budget Performance</h3>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Month</TableHead>
        <TableHead>Needs</TableHead>
        <TableHead>Wants</TableHead>
        <TableHead>Savings</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {budgetHistory.map(month => (
        <TableRow key={month.id}>
          <TableCell>{month.label}</TableCell>
          <TableCell>
            <BudgetCell
              spent={month.needsSpent}
              budget={month.needsBudget}
            />
          </TableCell>
          <TableCell>
            <BudgetCell
              spent={month.wantsSpent}
              budget={month.wantsBudget}
            />
          </TableCell>
          <TableCell>
            <BudgetCell
              spent={month.savingsActual}
              budget={month.savingsTarget}
            />
          </TableCell>
          <TableCell>
            {month.withinBudget ? (
              <Badge variant="success">On Track</Badge>
            ) : (
              <Badge variant="destructive">Over Budget</Badge>
            )}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</BudgetHistory>
```

---

## Data Model

```typescript
interface BudgetSettings {
  monthlyIncome: number;
  needsPercent: number;         // Default 50
  wantsPercent: number;         // Default 30
  savingsPercent: number;       // Default 20
  categoryClassifications: Record<string, 'need' | 'want' | 'saving' | 'exclude'>;
}

interface BudgetPeriod {
  id: string;
  startDate: string;
  endDate: string;
  
  needsBudget: number;
  needsSpent: number;
  
  wantsBudget: number;
  wantsSpent: number;
  
  savingsTarget: number;
  savingsActual: number;
  
  categoryBreakdown: CategoryBudgetResult[];
}
```

---

## Implementation Checklist

- [ ] Add budget settings schema
- [ ] Create category classification UI
- [ ] Implement per-category budgets
- [ ] Add budget history tracking
- [ ] Create budget rollover logic
- [ ] Add budget alerts

---

*Last updated: January 20, 2026*
