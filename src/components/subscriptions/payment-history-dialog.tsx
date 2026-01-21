"use client";

import { useMemo } from "react";
import { format, addMonths, addWeeks, addYears, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type RecurringTransaction, type RecurringOccurrence } from "@/lib/db";
import { cn } from "@/lib/utils";

interface PaymentHistoryDialogProps {
  subscription: RecurringTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentHistoryDialog({
  subscription,
  open,
  onOpenChange,
}: PaymentHistoryDialogProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  // Generate upcoming predicted payments
  const upcomingPayments = useMemo(() => {
    if (!subscription || subscription.status !== "active") return [];
    
    const upcoming: { date: Date; amount: number }[] = [];
    const startDate = subscription.nextExpected 
      ? new Date(subscription.nextExpected) 
      : new Date();
    
    const expectedAmount = subscription.averageAmount || subscription.amount;
    
    for (let i = 0; i < 3; i++) {
      let nextDate: Date;
      
      switch (subscription.frequency) {
        case "weekly":
          nextDate = addWeeks(startDate, i);
          break;
        case "biweekly":
          nextDate = addDays(startDate, i * 14);
          break;
        case "monthly":
          nextDate = addMonths(startDate, i);
          break;
        case "quarterly":
          nextDate = addMonths(startDate, i * 3);
          break;
        case "yearly":
          nextDate = addYears(startDate, i);
          break;
        default:
          nextDate = addMonths(startDate, i);
      }
      
      if (nextDate > new Date()) {
        upcoming.push({ date: nextDate, amount: expectedAmount });
      }
    }
    
    return upcoming;
  }, [subscription]);

  // Calculate variance from average
  const getVariance = (amount: number, averageAmount?: number) => {
    if (!averageAmount || averageAmount === 0) return null;
    const variance = ((amount - averageAmount) / averageAmount) * 100;
    if (Math.abs(variance) < 1) return null;
    return variance;
  };

  if (!subscription) return null;

  const occurrences = subscription.occurrences || [];
  const sortedOccurrences = [...occurrences].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{subscription.name} - Payment History</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Upcoming payments (predicted) */}
            {upcomingPayments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Upcoming
                </h4>
                {upcomingPayments.map((payment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 opacity-50"
                  >
                    <div className="w-3 h-3 rounded-full border-2 border-dashed border-gray-400" />

                    <div className="flex-1">
                      <p className="font-medium">
                        {format(payment.date, "MMMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">Expected</p>
                    </div>

                    <p className="font-semibold text-muted-foreground">
                      ~{formatCurrency(payment.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            {upcomingPayments.length > 0 && occurrences.length > 0 && (
              <div className="border-t my-4" />
            )}

            {/* Past payments */}
            {occurrences.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Past Payments
                </h4>
                {sortedOccurrences.map((occ, index) => {
                  const variance = getVariance(occ.amount, subscription.averageAmount);

                  return (
                    <div key={occ.id || index} className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full flex-shrink-0",
                          occ.status === "paid" && "bg-green-500",
                          occ.status === "pending" && "bg-yellow-500",
                          occ.status === "missed" && "bg-red-500"
                        )}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {format(new Date(occ.date), "MMMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {occ.status === "paid" ? "Paid" : occ.status}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "font-semibold",
                            occ.amount < 0 ? "text-red-500" : "text-green-500"
                          )}
                        >
                          {formatCurrency(occ.amount)}
                        </p>

                        {/* Variance indicator */}
                        {variance !== null && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              variance > 0 ? "text-red-500" : "text-green-500"
                            )}
                          >
                            {variance > 0 ? "+" : ""}
                            {variance.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payment history recorded yet.
              </div>
            )}

            {/* Summary Stats */}
            {occurrences.length > 0 && (
              <>
                <div className="border-t my-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Total Payments
                    </p>
                    <p className="font-semibold text-lg">
                      {occurrences.filter((o) => o.status === "paid").length}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="font-semibold text-lg">
                      {formatCurrency(
                        occurrences
                          .filter((o) => o.status === "paid")
                          .reduce((sum, o) => sum + Math.abs(o.amount), 0)
                      )}
                    </p>
                  </div>
                  {subscription.averageAmount && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        Average Payment
                      </p>
                      <p className="font-semibold text-lg">
                        {formatCurrency(subscription.averageAmount)}
                      </p>
                    </div>
                  )}
                  {subscription.missedCount && subscription.missedCount > 0 && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-600">Missed Payments</p>
                      <p className="font-semibold text-lg text-red-600">
                        {subscription.missedCount}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
