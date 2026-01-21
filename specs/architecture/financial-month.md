# Financial Month System

**Version**: v0.1.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

The financial month is a core concept that redefines how the app calculates budgets, savings, and spending. Instead of using calendar months (1st-31st), the financial month starts when the user's salary is deposited and ends when the next salary arrives.

## Problem Statement

Calendar months don't reflect real financial behavior:
- User gets paid on the 24th
- Rent is due on the 25th
- Budgeting from 1st-31st splits paycheck across two "months"
- Makes budget tracking confusing and inaccurate

## Solution: Dynamic Salary Detection

### Algorithm

```typescript
interface FinancialMonth {
  id: string;                    // e.g., "2025-12" (year-month of salary)
  salaryDate: Date;              // When salary was received
  salaryAmount: number;          // Amount of salary
  startDate: Date;               // Same as salaryDate
  endDate: Date;                 // Day before next salaryDate
  transactions: Transaction[];   // All transactions in this period
}
```

### Salary Detection Logic

1. **Primary Method**: Detect transactions matching salary patterns:
   ```typescript
   const SALARY_PATTERNS = [
     /VIREMENT\s+(SEPA\s+)?RECU.*SALAIRE/i,
     /VIREMENT\s+DE\s+.*EMPLOYEUR/i,
     /VIR\s+SEPA\s+RECU\s+.*PAIE/i,
     /SALAIRE/i,
     // Custom merchant names (user-defined)
   ];
   ```

2. **Secondary Method**: Large recurring income on similar dates:
   - Amount > €1000 (configurable threshold)
   - Recurring monthly within ±5 days
   - Categorized as "Income" > "Salary"

3. **Fallback**: User manually marks salary transactions

### Month Boundary Rules

```typescript
function getFinancialMonth(date: Date, salaryTransactions: Transaction[]): FinancialMonth {
  // Find most recent salary before or on this date
  const currentSalary = salaryTransactions
    .filter(s => s.date <= date)
    .sort((a, b) => b.date - a.date)[0];
  
  // Find next salary after this date
  const nextSalary = salaryTransactions
    .filter(s => s.date > currentSalary.date)
    .sort((a, b) => a.date - b.date)[0];
  
  return {
    startDate: currentSalary.date,
    endDate: nextSalary ? subDays(nextSalary.date, 1) : endOfMonth(date),
    salaryDate: currentSalary.date,
    salaryAmount: currentSalary.amount,
  };
}
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No salary found | Fall back to calendar month |
| Multiple salaries in month | Use largest as primary |
| Salary date varies by ±3 days | Group as same "expected date" |
| Bonus/13th month salary | Treat as income, not month boundary |
| First import (no history) | Use first salary found as starting point |
| Freelancer (irregular income) | Option to use calendar months |

## User Settings

```typescript
interface FinancialMonthSettings {
  enabled: boolean;              // Default: true
  mode: 'auto' | 'fixed' | 'calendar';
  fixedDay?: number;             // If mode === 'fixed', use this day
  salaryPatterns: string[];      // Custom patterns to detect salary
  minimumSalaryAmount: number;   // Threshold for auto-detection
  salaryMerchants: string[];     // Known salary payers (employer names)
}
```

### Settings UI

- **Toggle**: "Use financial month (salary-based)"
- **Mode Selector**: 
  - Auto-detect (recommended)
  - Fixed day (e.g., always 24th)
  - Calendar month (1st-31st)
- **Salary Detection Rules**: Custom patterns/merchants

## Impact on Other Features

### Dashboard
- "This month" = current financial month
- Budget progress = spending since last salary

### Budgets
- 50/30/20 calculated on financial month
- Resets when new salary detected

### Analytics
- Monthly comparisons use financial months
- "Average monthly spending" based on financial months

### Goals
- Monthly contributions calculated from financial month

### Calendar
- Financial month boundaries shown
- Salary day highlighted

## Database Schema Changes

```typescript
// New table for detected salaries
interface DetectedSalary {
  id: string;
  transactionId: string;         // Link to original transaction
  date: Date;
  amount: number;
  isConfirmed: boolean;          // User confirmed as salary
  financialMonthId: string;      // Which month this starts
}

// Add to settings
interface Settings {
  // ... existing fields
  financialMonthMode: 'auto' | 'fixed' | 'calendar';
  financialMonthFixedDay?: number;
  salaryMinAmount: number;
  salaryPatterns: string[];
}
```

## Implementation Steps

1. [ ] Add salary detection patterns to csv-parser
2. [ ] Create `DetectedSalary` table in database
3. [ ] Implement `getFinancialMonth()` utility
4. [ ] Create `useFinancialMonth()` hook
5. [ ] Update Dashboard to use financial month
6. [ ] Update Budgets calculations
7. [ ] Add settings UI for mode selection
8. [ ] Add salary transaction indicator in UI
9. [ ] Handle edge cases (no salary, multiple, etc.)

## Testing Scenarios

- [ ] User with consistent 24th salary
- [ ] Salary date varying by few days
- [ ] Months with bonus payments
- [ ] First-time user with no history
- [ ] Switch between modes
- [ ] Retroactive calculation for past months

---

*Last updated: January 20, 2026*
