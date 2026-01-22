"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  addWeeks,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { db, type RecurringTransaction, type Transaction, CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface BillEvent {
  id: string;
  recurringId?: number;
  transactionId?: number;
  name: string;
  amount: number;
  date: Date;
  category: string;
  type: "upcoming" | "paid" | "overdue";
  isRecurring: boolean;
  frequency?: string;
  recurringType?: string;
}

export default function CalendarPage() {
  const { convertFromAccount } = useMoney();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBills, setSelectedBills] = useState<BillEvent[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Live query for recurring transactions - auto-updates when data changes
  const recurring = useLiveQuery(
    async () => {
      return db.recurringTransactions
        .filter((r) => r.status === "active" && !r.isExcluded)
        .toArray();
    },
    [], // dependencies - empty means it updates on any change to the table
    [] // default value
  );

  // Live query for transactions in this month - auto-updates when data changes
  const transactions = useLiveQuery(
    async () => {
      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");
      return db.transactions
        .where("date")
        .between(startStr, endStr, true, true)
        .filter((tx) => !tx.isExcluded)
        .toArray();
    },
    [currentMonth.getMonth(), currentMonth.getFullYear()], // re-run when month changes
    [] // default value
  );

  // Compute bill events from recurring and transactions
  const bills = useMemo(() => {
    if (!recurring || !transactions) return [];

    const billEvents: BillEvent[] = [];

    // Helper to check if a transaction matches a recurring item
    const findMatchingTransaction = (rec: RecurringTransaction, targetDate: Date) => {
      const recName = rec.name.toLowerCase();
      const recMerchant = (rec.merchant || "").toLowerCase();
      const recAmount = Math.abs(convertFromAccount(rec.amount, rec.accountId));
      
      return transactions.find((tx) => {
        const txDate = new Date(tx.date);
        const txMerchant = tx.merchant.toLowerCase();
        
        // Check if within 5 days of expected date
        const dateDiff = Math.abs(txDate.getTime() - targetDate.getTime());
        if (dateDiff > 5 * 24 * 60 * 60 * 1000) return false;
        
        // Check merchant match (partial)
        const nameMatch = txMerchant.includes(recName) || recName.includes(txMerchant);
        const merchantMatch = recMerchant && (txMerchant.includes(recMerchant) || recMerchant.includes(txMerchant));
        
        // Check amount match (within 20%)
        const txAmount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
        const amountMatch = Math.abs(txAmount - recAmount) / Math.abs(recAmount) < 0.2;
        
        return (nameMatch || merchantMatch) && amountMatch;
      });
    };

    // Process each recurring item
    recurring.forEach((rec) => {
      // Skip income for calendar display (they're not "bills")
      if (rec.type === "income") return;

      const expectedDates: Date[] = [];

      // Calculate expected dates based on frequency
      if (rec.frequency === "monthly") {
        const day = rec.expectedDay || rec.dayOfMonth || new Date(rec.startDate || rec.nextExpected).getDate();
        const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(day, lastDayOfMonth);
        const expectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), actualDay);
        
        if (expectedDate >= monthStart && expectedDate <= monthEnd) {
          expectedDates.push(expectedDate);
        }
      } else if (rec.frequency === "weekly") {
        // Calculate all weekly occurrences in the month
        let checkDate = new Date(rec.startDate || rec.nextExpected);
        // Align to the first occurrence in or before the month
        while (checkDate > monthEnd) {
          checkDate = addWeeks(checkDate, -1);
        }
        while (checkDate < monthStart) {
          checkDate = addWeeks(checkDate, 1);
        }
        
        while (checkDate <= monthEnd) {
          if (checkDate >= monthStart) {
            expectedDates.push(new Date(checkDate));
          }
          checkDate = addWeeks(checkDate, 1);
        }
      } else if (rec.frequency === "biweekly") {
        let checkDate = new Date(rec.startDate || rec.nextExpected);
        while (checkDate > monthEnd) {
          checkDate = addWeeks(checkDate, -2);
        }
        while (checkDate < monthStart) {
          checkDate = addWeeks(checkDate, 2);
        }
        
        while (checkDate <= monthEnd) {
          if (checkDate >= monthStart) {
            expectedDates.push(new Date(checkDate));
          }
          checkDate = addWeeks(checkDate, 2);
        }
      } else if (rec.frequency === "quarterly") {
        const startDate = new Date(rec.startDate || rec.nextExpected);
        const checkDate = new Date(startDate);
        
        // Find quarterly dates that fall in this month
        for (let i = 0; i < 12; i++) {
          const quarterDate = new Date(checkDate.getFullYear(), checkDate.getMonth() + (i * 3), checkDate.getDate());
          if (quarterDate >= monthStart && quarterDate <= monthEnd) {
            expectedDates.push(quarterDate);
          }
        }
      } else if (rec.frequency === "yearly") {
        const startDate = new Date(rec.startDate || rec.nextExpected);
        if (startDate.getMonth() === currentMonth.getMonth()) {
          const yearlyDate = new Date(currentMonth.getFullYear(), startDate.getMonth(), startDate.getDate());
          if (yearlyDate >= monthStart && yearlyDate <= monthEnd) {
            expectedDates.push(yearlyDate);
          }
        }
      }

      // Create bill events for each expected date
      expectedDates.forEach((expectedDate, idx) => {
        const matchingTx = findMatchingTransaction(rec, expectedDate);
        const isPaid = !!matchingTx;
        const isOverdue = !isPaid && expectedDate < today;
        
        billEvents.push({
          id: `rec-${rec.id}-${idx}`,
          recurringId: rec.id,
          transactionId: matchingTx?.id,
          name: rec.name,
          amount: Math.abs(convertFromAccount(rec.amount, rec.accountId)),
          date: matchingTx ? new Date(matchingTx.date) : expectedDate,
          category: rec.category,
          type: isPaid ? "paid" : isOverdue ? "overdue" : "upcoming",
          isRecurring: true,
          frequency: rec.frequency,
          recurringType: rec.type,
        });
      });
    });

    // Also add transactions marked as recurring that don't match any recurring item
    // This catches one-off recurring transactions or those not yet linked
    transactions.forEach((tx) => {
      if (!tx.isRecurring) return;
      
      const txDate = new Date(tx.date);
      const alreadyTracked = billEvents.some(
        (b) => b.transactionId === tx.id || 
              (isSameDay(b.date, txDate) && b.name.toLowerCase() === tx.merchant.toLowerCase())
      );
      
      if (!alreadyTracked) {
        billEvents.push({
          id: `tx-${tx.id}`,
          transactionId: tx.id,
          name: tx.merchant,
          amount: Math.abs(convertFromAccount(tx.amount, tx.accountId)),
          date: txDate,
          category: tx.category,
          type: "paid",
          isRecurring: true,
        });
      }
    });

    return billEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [recurring, transactions, currentMonth, monthStart, monthEnd, today, convertFromAccount]);

  const isLoading = recurring === undefined || transactions === undefined;

  const getBillsForDate = (date: Date) => {
    return bills.filter((bill) => isSameDay(bill.date, date));
  };

  const handleDayClick = (date: Date) => {
    const dayBills = getBillsForDate(date);
    if (dayBills.length > 0) {
      setSelectedDate(date);
      setSelectedBills(dayBills);
    }
  };

  const upcomingBills = useMemo(() => {
    return bills
      .filter((b) => b.type === "upcoming" && b.date >= today)
      .slice(0, 5);
  }, [bills, today]);

  const overdueBills = useMemo(() => {
    return bills.filter((b) => b.type === "overdue");
  }, [bills]);

  const monthTotal = useMemo(() => {
    return bills.reduce((sum, b) => sum + b.amount, 0);
  }, [bills]);

  const paidTotal = useMemo(() => {
    return bills.filter((b) => b.type === "paid").reduce((sum, b) => sum + b.amount, 0);
  }, [bills]);

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES[category as keyof typeof CATEGORIES];
    if (cat?.icon) {
      const IconComponent = cat.icon;
      return <IconComponent className="h-3 w-3" />;
    }
    return null;
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case "subscription": return "Subscription";
      case "bill": return "Bill";
      case "loan": return "Loan";
      default: return "Recurring";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Track upcoming bills and recurring payments
          </p>
          {isLoading && (
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10">
                  <CalendarIcon className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-xl font-bold"><Money amount={monthTotal} /></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-xl font-semibold text-success"><Money amount={paidTotal} /></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-xl font-semibold text-warning">
                    <Money amount={monthTotal - paidTotal} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  overdueBills.length > 0 ? "bg-destructive/10" : "bg-muted"
                )}>
                  <AlertCircle className={cn(
                    "h-5 w-5",
                    overdueBills.length > 0 ? "text-destructive" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className={cn(
                    "text-xl font-semibold",
                    overdueBills.length > 0 ? "text-destructive" : ""
                  )}>
                    {overdueBills.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month start */}
                {Array.from({ length: startDayOfWeek }).map((_, index) => (
                  <div key={`empty-${index}`} className="p-2 min-h-[80px]" />
                ))}

                {/* Days */}
                {days.map((day) => {
                  const dayBills = getBillsForDate(day);
                  const hasBills = dayBills.length > 0;

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "p-2 min-h-[80px] rounded-lg border text-left transition-colors hover:bg-muted/50",
                        isToday(day) && "border-primary bg-primary/5",
                        hasBills && "cursor-pointer",
                        !hasBills && "cursor-default"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium mb-1",
                          isToday(day) && "text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      {hasBills && (
                        <div className="space-y-1">
                          {dayBills.slice(0, 2).map((bill) => (
                            <div
                              key={bill.id}
                              className={cn(
                                "text-xs px-1.5 py-0.5 rounded truncate",
                                bill.type === "paid" && "bg-success/10 text-success",
                                bill.type === "upcoming" && "bg-info/10 text-info",
                                bill.type === "overdue" && "bg-destructive/10 text-destructive"
                              )}
                            >
                              {bill.name}
                            </div>
                          ))}
                          {dayBills.length > 2 && (
                            <div className="text-xs text-muted-foreground px-1.5">
                              +{dayBills.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-success/10 border border-success/30" />
                  <span>Paid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-info/10 border border-info/30" />
                  <span>Upcoming</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/30" />
                  <span>Overdue</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Bills Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Bills</CardTitle>
                <CardDescription>Next 5 payments due</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : upcomingBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming bills this month
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: `${CATEGORIES[bill.category as keyof typeof CATEGORIES]?.color}20`,
                              color: CATEGORIES[bill.category as keyof typeof CATEGORIES]?.color,
                            }}
                          >
                            {getCategoryIcon(bill.category)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{bill.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(bill.date, "MMM d")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            <Money amount={bill.amount} />
                          </p>
                          {bill.frequency && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {bill.frequency}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {overdueBills.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Overdue Bills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/80 p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{bill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {format(bill.date, "MMM d")}
                          </p>
                        </div>
                        <p className="font-semibold text-destructive">
                          <Money amount={bill.amount} />
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Day Detail Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")}
              </DialogTitle>
              <DialogDescription>
                {selectedBills.length} bill{selectedBills.length !== 1 ? "s" : ""} on this day
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {selectedBills.map((bill) => (
                <div
                  key={bill.id}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border p-4",
                    bill.type === "paid" && "bg-success/5 border-success/20",
                    bill.type === "upcoming" && "bg-info/5 border-info/20",
                    bill.type === "overdue" && "bg-destructive/5 border-destructive/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${CATEGORIES[bill.category as keyof typeof CATEGORIES]?.color}20`,
                        color: CATEGORIES[bill.category as keyof typeof CATEGORIES]?.color,
                      }}
                    >
                      {getCategoryIcon(bill.category)}
                    </div>
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{bill.category}</span>
                        {bill.recurringType && (
                          <>
                            <span>•</span>
                            <span>{getTypeLabel(bill.recurringType)}</span>
                          </>
                        )}
                        {bill.frequency && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{bill.frequency}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg"><Money amount={bill.amount} /></p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        bill.type === "paid" && "bg-success/15 text-success",
                        bill.type === "upcoming" && "bg-info/15 text-info",
                        bill.type === "overdue" && "bg-destructive/15 text-destructive"
                      )}
                    >
                      {bill.type === "paid" ? "Paid" : bill.type === "upcoming" ? "Upcoming" : "Overdue"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
