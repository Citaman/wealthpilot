"use client";

import { useMemo } from "react";
import { format, parseISO, addDays, subMonths, getDate } from "date-fns";
import { Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CATEGORIES, db, type Transaction } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

interface UpcomingBillsProps {
  className?: string;
}

interface PredictedBill {
  merchant: string;
  amount: number;
  expectedDate: Date;
  daysUntil: number;
  category: string;
  color: string;
  confidence: "high" | "medium";
}

export function UpcomingBills({ className }: UpcomingBillsProps) {
  // Fetch last 6 months of transactions for recurring pattern detection
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);
  
  const transactions = useLiveQuery(
    () => db.transactions
      .where("date")
      .aboveOrEqual(format(sixMonthsAgo, "yyyy-MM-dd"))
      .toArray(),
    []
  );

  const upcomingBills = useMemo(() => {
    if (!transactions) return null;
    
    const sevenDaysFromNow = addDays(now, 7);
    const currentDay = getDate(now);

    // Find recurring transactions (same merchant, similar amount, monthly pattern)
    const merchantHistory = new Map<string, Transaction[]>();
    
    transactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        const existing = merchantHistory.get(t.merchant) || [];
        existing.push(t);
        merchantHistory.set(t.merchant, existing);
      });

    const predictions: PredictedBill[] = [];

    merchantHistory.forEach((txs, merchant) => {
      if (txs.length < 2) return;

      // Sort by date
      const sorted = txs.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Check if it's recurring (similar day of month)
      const days = sorted.map((t) => getDate(parseISO(t.date)));
      const avgDay = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
      const dayVariance = days.reduce((sum, d) => sum + Math.abs(d - avgDay), 0) / days.length;

      // Check amount consistency
      const amounts = sorted.map((t) => Math.abs(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const amountVariance = amounts.reduce((sum, a) => sum + Math.abs(a - avgAmount), 0) / amounts.length;
      const isConsistentAmount = amountVariance / avgAmount < 0.1; // Less than 10% variance

      // If day variance is low (recurring around same day) and we haven't seen it this month
      if (dayVariance < 5) {
        const lastTx = sorted[sorted.length - 1];
        const lastTxDate = parseISO(lastTx.date);
        const lastTxMonth = format(lastTxDate, "yyyy-MM");
        const currentMonth = format(now, "yyyy-MM");

        // Skip if already paid this month
        if (lastTxMonth === currentMonth) return;

        // Predict next occurrence
        let expectedDay = avgDay;
        if (expectedDay > 28) expectedDay = 28; // Handle month end edge cases

        const expectedDate = new Date(now.getFullYear(), now.getMonth(), expectedDay);
        
        // If expected date is in the past this month, skip
        if (expectedDate < now) return;

        const daysUntil = Math.ceil((expectedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Only include if within next 7 days
        if (daysUntil <= 7 && daysUntil >= 0) {
          predictions.push({
            merchant,
            amount: avgAmount,
            expectedDate,
            daysUntil,
            category: lastTx.category,
            color: CATEGORIES[lastTx.category]?.color || "#6b7280",
            confidence: isConsistentAmount && dayVariance < 2 ? "high" : "medium",
          });
        }
      }
    });

    return predictions.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5);
  }, [transactions, now]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Loading state
  if (!upcomingBills) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            Upcoming Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-1 h-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalUpcoming = upcomingBills.reduce((sum, b) => sum + b.amount, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            Upcoming Bills
          </CardTitle>
          {upcomingBills.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {formatCurrency(totalUpcoming)} due
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {upcomingBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
            <p className="text-sm font-medium">No bills due this week</p>
            <p className="text-xs text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBills.map((bill, idx) => (
              <div
                key={`${bill.merchant}-${idx}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ backgroundColor: bill.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{bill.merchant}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{bill.category}</span>
                    {bill.confidence === "high" && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        Recurring
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{formatCurrency(bill.amount)}</p>
                  <p className={cn(
                    "text-xs",
                    bill.daysUntil === 0 ? "text-red-500 font-medium" :
                    bill.daysUntil <= 2 ? "text-amber-500" : "text-muted-foreground"
                  )}>
                    {bill.daysUntil === 0 ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Today
                      </span>
                    ) : bill.daysUntil === 1 ? (
                      "Tomorrow"
                    ) : (
                      `In ${bill.daysUntil} days`
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
