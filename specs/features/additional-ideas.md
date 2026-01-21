# Additional Improvements & Ideas

**Version**: Various  
**Priority**: Various  
**Status**: Ideas & Suggestions

---

## Overview

This document contains additional improvement ideas beyond the core feedback, categorized by priority and complexity.

---

## 🔴 High Impact Ideas

### 1. Smart Notification System

**Version**: v0.2.0  
**Complexity**: Medium

Create an in-app notification center for important events:

```typescript
interface Notification {
  id: string;
  type: 'bill_reminder' | 'budget_alert' | 'goal_milestone' | 
        'unusual_activity' | 'balance_low' | 'insight';
  title: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
}
```

**Features:**
- Notification bell in header with unread count
- Notification center drawer
- Mark as read/dismiss
- Configure which notifications to receive
- Browser notification support (optional)

---

### 2. Transaction Search & Filters

**Version**: v0.1.0  
**Complexity**: Medium

Enhanced search with multiple filters:

```tsx
<TransactionFilters>
  <div className="flex flex-wrap gap-2">
    {/* Quick filters */}
    <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm">
      All
    </Button>
    <Button variant={filter === 'income' ? 'default' : 'outline'} size="sm">
      Income
    </Button>
    <Button variant={filter === 'expense' ? 'default' : 'outline'} size="sm">
      Expenses
    </Button>
    <Button variant={filter === 'recurring' ? 'default' : 'outline'} size="sm">
      Recurring
    </Button>
  </div>
  
  {/* Advanced filters */}
  <Collapsible>
    <CollapsibleTrigger>Advanced Filters</CollapsibleTrigger>
    <CollapsibleContent>
      <div className="grid grid-cols-4 gap-4 mt-4">
        <DateRangePicker />
        <AmountRangePicker />
        <CategoryMultiSelect />
        <MerchantAutocomplete />
      </div>
    </CollapsibleContent>
  </Collapsible>
</TransactionFilters>
```

---

### 3. Data Export & Backup

**Version**: v0.1.0  
**Complexity**: Low

Export all data for backup or analysis:

```typescript
interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  includeTransactions: boolean;
  includeGoals: boolean;
  includeBudgets: boolean;
  includeSettings: boolean;
  dateRange?: DateRange;
}

async function exportData(options: ExportOptions): Promise<Blob> {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '0.1.0',
    transactions: options.includeTransactions 
      ? await db.transactions.toArray() 
      : undefined,
    // ... etc
  };
  
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}
```

**Features:**
- Export as JSON (complete backup)
- Export as CSV (transactions only)
- Export as Excel (formatted reports)
- Scheduled auto-backup reminder
- Import from backup

---

### 4. Transaction Split

**Version**: v0.2.0  
**Complexity**: Medium

Split a single transaction into multiple categories:

```typescript
interface TransactionSplit {
  originalTransactionId: string;
  splits: {
    amount: number;
    category: string;
    subcategory?: string;
    note?: string;
  }[];
}

// Example: €100 grocery receipt
// - €70 Groceries
// - €20 Household
// - €10 Personal Care
```

**UI:**
```tsx
<SplitTransactionDialog transaction={tx}>
  <h4>Split Transaction</h4>
  <p className="text-sm text-muted-foreground">
    Original: {tx.merchant} - {formatCurrency(tx.amount)}
  </p>
  
  {splits.map((split, i) => (
    <div key={i} className="flex gap-2 items-center">
      <Input
        type="number"
        value={split.amount}
        onChange={(e) => updateSplit(i, 'amount', e.target.value)}
        className="w-24"
      />
      <CategorySelect
        value={split.category}
        onChange={(cat) => updateSplit(i, 'category', cat)}
      />
      <Button variant="ghost" size="sm" onClick={() => removeSplit(i)}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  ))}
  
  <div className="flex justify-between mt-4">
    <Button variant="outline" size="sm" onClick={addSplit}>
      Add Split
    </Button>
    <span className={remaining !== 0 ? 'text-red-500' : 'text-green-500'}>
      Remaining: {formatCurrency(remaining)}
    </span>
  </div>
</SplitTransactionDialog>
```

---

### 5. Keyboard Shortcuts

**Version**: v0.2.0  
**Complexity**: Low

Add keyboard navigation for power users:

| Shortcut | Action |
|----------|--------|
| `g d` | Go to Dashboard |
| `g t` | Go to Transactions |
| `g a` | Go to Analytics |
| `g b` | Go to Budgets |
| `g s` | Go to Subscriptions |
| `/` | Focus search |
| `n t` | New transaction |
| `?` | Show shortcuts |
| `Esc` | Close dialog |

```typescript
// Use @tanstack/react-hotkeys or similar
useHotkeys('g d', () => router.push('/'));
useHotkeys('/', () => searchInput.current?.focus());
useHotkeys('?', () => setShowShortcuts(true));
```

---

## 🟡 Medium Impact Ideas

### 6. Currency Formatting Options

**Version**: v0.1.0  
**Complexity**: Low

User-configurable currency display:

```typescript
interface CurrencySettings {
  currency: string;           // EUR, USD, GBP
  locale: string;             // fr-FR, en-US
  decimalPlaces: number;      // 0, 2
  showCurrencySymbol: boolean;
  symbolPosition: 'before' | 'after';
}
```

---

### 7. Transaction Templates

**Version**: v0.3.0  
**Complexity**: Medium

Quick entry for common transactions:

```typescript
interface TransactionTemplate {
  id: string;
  name: string;
  merchant: string;
  category: string;
  amount?: number;            // Preset or leave blank
  isRecurring: boolean;
  notes?: string;
}

// Examples:
// - "Morning Coffee" - €3.50, Food & Dining
// - "Fuel" - [blank], Transportation
// - "Grocery Run" - [blank], Groceries
```

---

### 8. Receipt Image Attachment

**Version**: v0.4.0  
**Complexity**: High

Attach receipt images to transactions:

```typescript
interface TransactionAttachment {
  id: string;
  transactionId: string;
  type: 'receipt' | 'invoice' | 'other';
  filename: string;
  mimeType: string;
  data: Blob;                 // Store in IndexedDB
  createdAt: string;
}
```

**Features:**
- Drag & drop image upload
- Camera capture on mobile
- Image preview in transaction detail
- Optional OCR for receipt parsing (future)

---

### 9. Spending Challenges

**Version**: v0.4.0  
**Complexity**: Medium

Gamification to encourage savings:

```typescript
interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'no_spend' | 'budget_limit' | 'savings_boost';
  
  // Rules
  targetCategory?: string;
  targetAmount?: number;
  duration: number;           // days
  
  // Progress
  startDate: string;
  endDate: string;
  currentProgress: number;
  isCompleted: boolean;
  
  // Reward (just badges for now)
  badge?: string;
}

// Examples:
// - "No-Spend Weekend" - Don't spend on wants for 2 days
// - "Grocery Challenge" - Keep groceries under €150 this week
// - "Savings Sprint" - Save €200 extra this month
```

---

### 10. Comparison Mode

**Version**: v0.3.0  
**Complexity**: Medium

Compare any two time periods side-by-side:

```tsx
<ComparisonView>
  <div className="flex gap-4 mb-4">
    <DateRangePicker label="Period 1" onChange={setPeriod1} />
    <DateRangePicker label="Period 2" onChange={setPeriod2} />
  </div>
  
  <div className="grid grid-cols-2 gap-6">
    <PeriodSummary period={period1} />
    <PeriodSummary period={period2} />
  </div>
  
  <ComparisonChart data={comparisonData} />
  
  <DifferenceTable
    columns={['Category', 'Period 1', 'Period 2', 'Difference']}
    data={categoryComparison}
  />
</ComparisonView>
```

---

### 11. Budget Scenarios

**Version**: v0.4.0  
**Complexity**: High

"What if" budget planning:

```typescript
interface BudgetScenario {
  id: string;
  name: string;
  description?: string;
  
  // Changes from current
  incomeAdjustment: number;
  categoryAdjustments: Record<string, number>;
  
  // Calculated results
  projectedBalance: number;
  savingsRate: number;
  feasibility: 'sustainable' | 'tight' | 'deficit';
}

// Examples:
// - "If I cancel Netflix" - +€15/month
// - "If I get a raise" - +€300/month income
// - "If I move to cheaper apartment" - -€200/month rent
```

---

### 12. Auto-Tagging Rules

**Version**: v0.2.0  
**Complexity**: Low

Automatically apply tags based on rules:

```typescript
interface AutoTagRule {
  id: string;
  name: string;
  condition: {
    field: 'merchant' | 'description' | 'category' | 'amount';
    operator: 'contains' | 'equals' | 'greater' | 'less';
    value: string | number;
  };
  tag: string;
}

// Examples:
// - If merchant contains "Amazon" → tag "Online Shopping"
// - If amount > 100 → tag "Large Purchase"
// - If category = "Food & Dining" → tag "Deductible" (for business)
```

---

## 🟢 Nice-to-Have Ideas

### 13. Dark Mode

**Version**: v0.2.0  
**Complexity**: Low

Theme toggle with system preference detection:

```typescript
type Theme = 'light' | 'dark' | 'system';

// Already supported by Tailwind, just need:
// - Theme toggle in settings
// - Persist preference
// - Respect prefers-color-scheme
```

---

### 14. Dashboard Customization

**Version**: v0.5.0  
**Complexity**: High

Drag-and-drop dashboard widgets:

```typescript
interface DashboardLayout {
  widgets: {
    id: string;
    type: WidgetType;
    position: { x: number; y: number };
    size: { w: number; h: number };
    config?: Record<string, any>;
  }[];
}

type WidgetType = 
  | 'balance'
  | 'cashflow'
  | 'budgets'
  | 'goals'
  | 'recent_transactions'
  | 'insights'
  | 'calendar'
  | 'category_breakdown';
```

---

### 15. Financial Reports

**Version**: v0.5.0  
**Complexity**: Medium

Generate PDF reports:

- Monthly summary report
- Annual financial review
- Tax-ready expense report
- Category deep-dive report

---

### 16. Merchant Logos

**Version**: v0.3.0  
**Complexity**: Low

Show merchant logos for recognized merchants:

```typescript
// Use Clearbit or similar logo API
const getMerchantLogo = (merchant: string): string | null => {
  const domain = MERCHANT_DOMAINS[merchant];
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
};

// Fallback to first letter avatar
<MerchantAvatar merchant={tx.merchant} />
```

---

## Implementation Priority Matrix

| Impact | Effort | Ideas |
|--------|--------|-------|
| High | Low | #3 Data Export, #6 Currency, #13 Dark Mode |
| High | Medium | #1 Notifications, #2 Search, #5 Shortcuts |
| High | High | #4 Split Transactions |
| Medium | Low | #12 Auto-Tags |
| Medium | Medium | #7 Templates, #10 Comparison |
| Medium | High | #8 Receipts, #9 Challenges, #11 Scenarios |
| Low | Low | #16 Logos |
| Low | Medium | #15 Reports |
| Low | High | #14 Dashboard Customize |

---

## Backlog Priority

For v0.2.0-v0.5.0:

1. **#2 Transaction Search** - Essential for usability
2. **#3 Data Export** - Users need backup capability
3. **#1 Notifications** - Drive engagement
4. **#5 Keyboard Shortcuts** - Power user feature
5. **#4 Split Transactions** - Common use case
6. **#12 Auto-Tags** - Productivity improvement
7. **#13 Dark Mode** - User expectation
8. **#10 Comparison Mode** - Analytics enhancement
9. **#7 Templates** - Convenience
10. **#16 Merchant Logos** - Polish

---

*Last updated: January 20, 2026*
