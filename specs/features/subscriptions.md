# Subscriptions & Loans Specifications

**Version**: v0.4.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

Overhaul the subscriptions page to properly handle different types of recurring expenses: subscriptions, bills, and loans.

## Current Issues (v0.0.1)

1. ❌ All recurring lumped together
2. ❌ No loan tracking
3. ❌ Can't see payment history
4. ❌ Can't mark as ended/cancelled
5. ❌ Can't exclude false positives
6. ❌ Can't add from existing transactions

---

## Taxonomy

### Types of Recurring

```typescript
type RecurringType = 
  | 'subscription'    // Netflix, Spotify, gym - can cancel anytime
  | 'bill'            // Rent, utilities - necessary, variable
  | 'loan'            // Mortgage, car loan - fixed term, principal tracking
  | 'income';         // Salary, regular income

interface RecurringTransaction {
  id: string;
  type: RecurringType;
  
  // Identity
  name: string;
  merchant: string;
  description?: string;
  
  // Amount
  amount: number;
  isVariable: boolean;
  averageAmount?: number;
  lastAmount?: number;
  
  // Schedule
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  expectedDay?: number;          // Day of month (1-31)
  nextExpectedDate: string;
  
  // Status
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  startDate: string;
  endDate?: string;
  cancelledAt?: string;
  
  // Category
  category: string;
  subcategory?: string;
  
  // Tracking
  occurrences: RecurringOccurrence[];
  missedCount: number;
  
  // Loan-specific
  loan?: LoanDetails;
  
  // User flags
  isExcluded: boolean;          // False positive - not actually recurring
  isUserCreated: boolean;       // Manually added vs auto-detected
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface RecurringOccurrence {
  id: string;
  transactionId: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'missed';
}

interface LoanDetails {
  principalAmount: number;       // Original loan amount
  interestRate: number;          // Annual %
  termMonths: number;
  remainingBalance: number;
  totalPaid: number;
  totalInterestPaid: number;
  paymentsRemaining: number;
}
```

---

## Page Structure

```tsx
<SubscriptionsPage>
  {/* Tabs for different types */}
  <Tabs value={activeTab} onChange={setActiveTab}>
    <TabsList>
      <TabsTrigger value="subscriptions">
        Subscriptions
        <Badge>{subscriptionCount}</Badge>
      </TabsTrigger>
      <TabsTrigger value="bills">
        Bills
        <Badge>{billCount}</Badge>
      </TabsTrigger>
      <TabsTrigger value="loans">
        Loans
        <Badge>{loanCount}</Badge>
      </TabsTrigger>
      <TabsTrigger value="income">
        Income
        <Badge>{incomeCount}</Badge>
      </TabsTrigger>
      <TabsTrigger value="ended">
        Ended
        <Badge variant="outline">{endedCount}</Badge>
      </TabsTrigger>
    </TabsList>
    
    <TabsContent value="subscriptions">
      <SubscriptionsList />
    </TabsContent>
    
    <TabsContent value="bills">
      <BillsList />
    </TabsContent>
    
    <TabsContent value="loans">
      <LoansList />
    </TabsContent>
    
    <TabsContent value="income">
      <IncomeList />
    </TabsContent>
    
    <TabsContent value="ended">
      <EndedList />
    </TabsContent>
  </Tabs>
  
  {/* Summary cards */}
  <div className="grid grid-cols-4 gap-4 mb-6">
    <SummaryCard
      label="Monthly Subscriptions"
      amount={monthlySubscriptions}
      icon={<CreditCard />}
    />
    <SummaryCard
      label="Monthly Bills"
      amount={monthlyBills}
      icon={<Receipt />}
    />
    <SummaryCard
      label="Monthly Loan Payments"
      amount={monthlyLoans}
      icon={<Landmark />}
    />
    <SummaryCard
      label="Total Monthly Recurring"
      amount={totalMonthly}
      icon={<RefreshCw />}
      highlight
    />
  </div>
</SubscriptionsPage>
```

---

## Subscription Card

```tsx
<SubscriptionCard subscription={sub}>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <MerchantLogo merchant={sub.merchant} />
      <div>
        <h4 className="font-semibold">{sub.name}</h4>
        <p className="text-sm text-muted-foreground">
          {sub.category}
        </p>
      </div>
    </div>
    
    <div className="text-right">
      <p className="text-xl font-bold">
        {formatCurrency(Math.abs(sub.amount))}
        <span className="text-sm font-normal text-muted-foreground">
          /{frequencyLabel(sub.frequency)}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        Next: {format(new Date(sub.nextExpectedDate), 'MMM d')}
      </p>
    </div>
  </div>
  
  {/* Detection basis */}
  <Collapsible>
    <CollapsibleTrigger className="text-xs text-muted-foreground">
      Detection basis: {sub.occurrences.length} occurrences
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="mt-2 space-y-1">
        {sub.occurrences.slice(0, 5).map(occ => (
          <div key={occ.id} className="flex justify-between text-xs">
            <span>{format(new Date(occ.date), 'MMM d, yyyy')}</span>
            <span>{formatCurrency(occ.amount)}</span>
          </div>
        ))}
      </div>
    </CollapsibleContent>
  </Collapsible>
  
  {/* Actions */}
  <div className="flex justify-end gap-2 mt-3">
    <Button variant="outline" size="sm" onClick={() => viewCalendar(sub)}>
      View Calendar
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => editSubscription(sub)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => pauseSubscription(sub)}>
          {sub.status === 'paused' ? 'Resume' : 'Pause'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => cancelSubscription(sub)}>
          Mark as Cancelled
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => excludeSubscription(sub)}
          className="text-red-500"
        >
          Not a Subscription
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</SubscriptionCard>
```

---

## Loan Card (Enhanced)

```tsx
<LoanCard loan={loan}>
  <div className="flex items-center justify-between mb-4">
    <div>
      <h4 className="font-semibold">{loan.name}</h4>
      <p className="text-sm text-muted-foreground">{loan.merchant}</p>
    </div>
    <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
      {loan.status}
    </Badge>
  </div>
  
  {/* Progress */}
  <div className="mb-4">
    <div className="flex justify-between text-sm mb-1">
      <span>Progress</span>
      <span>{loan.loan.paymentsMade} / {loan.loan.termMonths} payments</span>
    </div>
    <Progress 
      value={(loan.loan.totalPaid / loan.loan.principalAmount) * 100} 
      className="h-3"
    />
    <div className="flex justify-between text-xs text-muted-foreground mt-1">
      <span>Paid: {formatCurrency(loan.loan.totalPaid)}</span>
      <span>Remaining: {formatCurrency(loan.loan.remainingBalance)}</span>
    </div>
  </div>
  
  {/* Key stats */}
  <div className="grid grid-cols-3 gap-3 mb-4">
    <div className="text-center p-2 bg-muted rounded">
      <p className="text-xs text-muted-foreground">Monthly</p>
      <p className="font-semibold">{formatCurrency(Math.abs(loan.amount))}</p>
    </div>
    <div className="text-center p-2 bg-muted rounded">
      <p className="text-xs text-muted-foreground">Interest Rate</p>
      <p className="font-semibold">{loan.loan.interestRate}%</p>
    </div>
    <div className="text-center p-2 bg-muted rounded">
      <p className="text-xs text-muted-foreground">Months Left</p>
      <p className="font-semibold">{loan.loan.paymentsRemaining}</p>
    </div>
  </div>
  
  {/* Total paid breakdown */}
  <div className="p-3 bg-muted rounded-lg">
    <div className="flex justify-between mb-1">
      <span className="text-sm">Principal Paid</span>
      <span className="font-medium">
        {formatCurrency(loan.loan.totalPaid - loan.loan.totalInterestPaid)}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="text-sm">Interest Paid</span>
      <span className="font-medium text-orange-500">
        {formatCurrency(loan.loan.totalInterestPaid)}
      </span>
    </div>
  </div>
  
  {/* Actions */}
  <div className="flex justify-end gap-2 mt-4">
    <Button variant="outline" size="sm" onClick={() => viewLoanHistory(loan)}>
      Payment History
    </Button>
    <Button variant="outline" size="sm" onClick={() => editLoan(loan)}>
      Edit
    </Button>
  </div>
</LoanCard>
```

---

## Individual Subscription Calendar

```tsx
<SubscriptionCalendarDialog subscription={sub}>
  <DialogHeader>
    <DialogTitle>{sub.name} - Payment History</DialogTitle>
  </DialogHeader>
  <DialogContent>
    {/* Timeline view */}
    <div className="space-y-4">
      {sub.occurrences.map((occ, index) => (
        <div key={occ.id} className="flex items-center gap-4">
          <div className={cn(
            "w-3 h-3 rounded-full",
            occ.status === 'paid' && "bg-green-500",
            occ.status === 'pending' && "bg-yellow-500",
            occ.status === 'missed' && "bg-red-500"
          )} />
          
          <div className="flex-1">
            <p className="font-medium">
              {format(new Date(occ.date), 'MMMM d, yyyy')}
            </p>
            <p className="text-sm text-muted-foreground">
              {occ.status === 'paid' ? 'Paid' : occ.status}
            </p>
          </div>
          
          <p className={cn(
            "font-semibold",
            occ.amount < 0 ? "text-red-500" : "text-green-500"
          )}>
            {formatCurrency(occ.amount)}
          </p>
          
          {/* Variance indicator */}
          {sub.averageAmount && Math.abs(occ.amount - sub.averageAmount) > 1 && (
            <Badge variant="outline" className="text-xs">
              {occ.amount > sub.averageAmount ? '+' : ''}
              {((occ.amount - sub.averageAmount) / sub.averageAmount * 100).toFixed(0)}%
            </Badge>
          )}
        </div>
      ))}
      
      {/* Upcoming (predicted) */}
      {upcomingDates.map(date => (
        <div key={date.toISOString()} className="flex items-center gap-4 opacity-50">
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-gray-400" />
          <div className="flex-1">
            <p className="font-medium">
              {format(date, 'MMMM d, yyyy')}
            </p>
            <p className="text-sm text-muted-foreground">Expected</p>
          </div>
          <p className="font-semibold text-muted-foreground">
            ~{formatCurrency(sub.averageAmount || sub.amount)}
          </p>
        </div>
      ))}
    </div>
    
    {/* Calendar view toggle */}
    <div className="mt-6">
      <Button variant="outline" onClick={() => setView('calendar')}>
        View as Calendar
      </Button>
    </div>
  </DialogContent>
</SubscriptionCalendarDialog>
```

---

## Add Subscription from Transactions

```tsx
<AddFromTransactionsDialog>
  <DialogHeader>
    <DialogTitle>Create Recurring from Transactions</DialogTitle>
    <DialogDescription>
      Select transactions that belong to the same recurring expense.
    </DialogDescription>
  </DialogHeader>
  <DialogContent>
    {/* Step 1: Search/Select transactions */}
    <div className="space-y-4">
      <Input
        placeholder="Search transactions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="max-h-60 overflow-y-auto space-y-2">
        {filteredTransactions.map(tx => (
          <div
            key={tx.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded border cursor-pointer",
              selectedTxIds.includes(tx.id) && "border-primary bg-primary/5"
            )}
            onClick={() => toggleSelect(tx.id)}
          >
            <Checkbox checked={selectedTxIds.includes(tx.id)} />
            <div className="flex-1">
              <p className="font-medium">{tx.merchant}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.date), 'MMM d, yyyy')}
              </p>
            </div>
            <p className="font-semibold">
              {formatCurrency(tx.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
    
    {/* Step 2: Configure recurring */}
    {selectedTxIds.length >= 2 && (
      <div className="mt-6 p-4 bg-muted rounded-lg space-y-4">
        <h4 className="font-semibold">Detected Pattern</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <Input
              value={recurringName}
              onChange={(e) => setRecurringName(e.target.value)}
              placeholder={detectedMerchant}
            />
          </div>
          
          <div>
            <Label>Type</Label>
            <Select value={recurringType} onChange={setRecurringType}>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
            </Select>
          </div>
          
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onChange={setFrequency}>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </Select>
          </div>
          
          <div>
            <Label>Expected Day</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={expectedDay}
              onChange={(e) => setExpectedDay(parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Detected: {detectedFrequency} on day ~{detectedDay}, 
          avg amount: {formatCurrency(detectedAverage)}
        </div>
      </div>
    )}
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button 
      onClick={createRecurring}
      disabled={selectedTxIds.length < 2}
    >
      Create Recurring
    </Button>
  </DialogFooter>
</AddFromTransactionsDialog>
```

---

## Exclusion System

When user marks a detected recurring as "not a subscription":

```typescript
interface ExclusionRule {
  id: string;
  pattern: string;           // Regex or exact match
  merchant?: string;
  reason?: string;
  createdAt: string;
}

// On future imports, check exclusions
async function isExcludedFromRecurring(transaction: Transaction): Promise<boolean> {
  const exclusions = await db.exclusionRules.toArray();
  
  return exclusions.some(rule => {
    const regex = new RegExp(rule.pattern, 'i');
    return regex.test(transaction.description) || 
           regex.test(transaction.merchant);
  });
}
```

---

## Ended/Cancelled Section

```tsx
<EndedList>
  <div className="space-y-3">
    {endedRecurring.map(item => (
      <div 
        key={item.id}
        className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full",
            item.status === 'cancelled' && "bg-red-100",
            item.status === 'completed' && "bg-green-100"
          )}>
            {item.status === 'cancelled' ? (
              <XCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
          </div>
          
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {item.status === 'cancelled' ? 'Cancelled' : 'Completed'}{' '}
              {format(new Date(item.endDate || item.cancelledAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="font-semibold">
            {formatCurrency(Math.abs(item.amount))}/{frequencyLabel(item.frequency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.occurrences.length} total payments
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => reactivate(item)}>
              Reactivate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => viewHistory(item)}>
              View History
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => deleteRecurring(item)}
              className="text-red-500"
            >
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ))}
  </div>
</EndedList>
```

---

## Dashboard Widget

Add loan progress to dashboard sidebar:

```tsx
<DashboardLoanWidget>
  <h4 className="font-semibold mb-3">Loan Progress</h4>
  
  {activeLoans.map(loan => (
    <div key={loan.id} className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span>{loan.name}</span>
        <span>{Math.round((loan.loan.totalPaid / loan.loan.principalAmount) * 100)}%</span>
      </div>
      <Progress 
        value={(loan.loan.totalPaid / loan.loan.principalAmount) * 100}
        className="h-2"
      />
      <p className="text-xs text-muted-foreground mt-1">
        {loan.loan.paymentsRemaining} months left
      </p>
    </div>
  ))}
  
  <Button variant="link" size="sm" asChild className="p-0">
    <Link href="/subscriptions?tab=loans">View All Loans</Link>
  </Button>
</DashboardLoanWidget>
```

---

## Implementation Checklist

### v0.4.0

- [ ] Add RecurringType taxonomy
- [ ] Create tabbed page structure
- [ ] Build SubscriptionCard component
- [ ] Build enhanced LoanCard with progress
- [ ] Create individual subscription calendar dialog
- [ ] Implement "Add from transactions" flow
- [ ] Build exclusion rule system
- [ ] Create ended/cancelled section
- [ ] Add reactivate functionality
- [ ] Create dashboard loan widget
- [ ] Update recurring detection to respect exclusions

---

*Last updated: January 20, 2026*
