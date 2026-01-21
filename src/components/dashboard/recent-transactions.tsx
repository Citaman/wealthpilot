"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpRight, ArrowDownRight, MoreHorizontal, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface RecentTransactionsProps {
  transactions: Transaction[];
  limit?: number;
  showViewAll?: boolean;
}

export function RecentTransactions({ 
  transactions, 
  limit = 5,
  showViewAll = true 
}: RecentTransactionsProps) {
  const displayTransactions = transactions.slice(0, limit);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES[category];
    if (cat?.icon) {
      const IconComponent = cat.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return null;
  };

  // Format time relative to now for today's transactions
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, "MMM d, h:mm a");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-medium">Recent Transactions</CardTitle>
        {showViewAll && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/transactions" className="text-xs">
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {displayTransactions.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground px-6">
            No transactions yet. Import your data to get started.
          </div>
        ) : (
          <div className="divide-y">
            {displayTransactions.map((tx) => {
              const isCredit = tx.direction === "credit";
              const categoryInfo = CATEGORIES[tx.category];
              
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/30"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full shrink-0",
                      isCredit ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"
                    )}
                    style={{
                      color: isCredit ? "#10b981" : categoryInfo?.color || "#6b7280",
                    }}
                  >
                    {getCategoryIcon(tx.category)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{tx.merchant}</p>
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: categoryInfo?.color || "#6b7280" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatTime(tx.date)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        isCredit ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {isCredit ? "+" : "-"}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

