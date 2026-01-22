"use client";

import { useMemo, useState } from "react";
import { format, subMonths, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { Repeat, ChevronDown, TrendingUp, TrendingDown, Calendar, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { ClientOnly } from "@/components/ui/client-only";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface RecurringExpensesProps {
  transactions: Transaction[];
  className?: string;
}

interface RecurringPattern {
  merchant: string;
  category: string;
  frequency: number; // times per month on average
  avgAmount: number;
  totalSpent: number;
  occurrences: number;
  monthlyData: { month: string; count: number; total: number }[];
  trend: number; // % change recent vs older
}

type ViewMode = "list" | "chart";
type SortBy = "frequency" | "amount" | "total";

export function RecurringExpenses({ transactions, className }: RecurringExpensesProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("frequency");
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const { convertFromAccount } = useMoney();

  const patterns = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
    const monthCount = months.length;

    // Filter to expenses in last 6 months
    const expenses = transactions.filter(
      (t) => t.direction === "debit" && new Date(t.date) >= sixMonthsAgo
    );

    // Group by merchant
    const merchantMap = new Map<
      string,
      {
        transactions: Transaction[];
        monthlyMap: Map<string, Transaction[]>;
      }
    >();

    expenses.forEach((tx) => {
      const merchant = tx.merchant || "Unknown";
      if (!merchantMap.has(merchant)) {
        merchantMap.set(merchant, { transactions: [], monthlyMap: new Map() });
      }
      const data = merchantMap.get(merchant)!;
      data.transactions.push(tx);

      const monthKey = format(parseISO(tx.date), "yyyy-MM");
      if (!data.monthlyMap.has(monthKey)) {
        data.monthlyMap.set(monthKey, []);
      }
      data.monthlyMap.get(monthKey)!.push(tx);
    });

    // Identify recurring patterns (appears in 3+ months OR 5+ times total)
    const recurring: RecurringPattern[] = [];

    merchantMap.forEach((data, merchant) => {
      const monthsWithActivity = data.monthlyMap.size;
      const totalOccurrences = data.transactions.length;

      // Must appear in at least 3 different months OR have 5+ occurrences
      if (monthsWithActivity >= 3 || totalOccurrences >= 5) {
        const totalSpent = data.transactions.reduce((s, t) => s + Math.abs(convertFromAccount(t.amount, t.accountId)), 0);
        const avgAmount = totalSpent / totalOccurrences;
        const frequency = totalOccurrences / monthCount;

        // Build monthly data for chart
        const monthlyData = months.map((m) => {
          const key = format(m, "yyyy-MM");
          const monthTx = data.monthlyMap.get(key) || [];
          return {
            month: format(m, "MMM"),
            count: monthTx.length,
            total: monthTx.reduce((s, t) => s + Math.abs(convertFromAccount(t.amount, t.accountId)), 0),
          };
        });

        // Calculate trend (last 3 months vs first 3 months)
        const recentTotal = monthlyData.slice(-3).reduce((s, m) => s + m.total, 0);
        const olderTotal = monthlyData.slice(0, 3).reduce((s, m) => s + m.total, 0);
        const trend = olderTotal > 0 ? ((recentTotal - olderTotal) / olderTotal) * 100 : 0;

        // Get category from most recent transaction
        const category = data.transactions.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0].category;

        recurring.push({
          merchant,
          category,
          frequency,
          avgAmount,
          totalSpent,
          occurrences: totalOccurrences,
          monthlyData,
          trend,
        });
      }
    });

    // Sort
    switch (sortBy) {
      case "frequency":
        recurring.sort((a, b) => b.frequency - a.frequency);
        break;
      case "amount":
        recurring.sort((a, b) => b.avgAmount - a.avgAmount);
        break;
      case "total":
        recurring.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
    }

    return recurring.slice(0, 15);
  }, [transactions, sortBy, convertFromAccount]);

  const totalRecurring = patterns.reduce((s, p) => s + p.totalSpent, 0);
  const selectedPattern = selectedMerchant ? patterns.find((p) => p.merchant === selectedMerchant) : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-2 shadow-lg">
        <p className="font-medium">{data.month}</p>
        <p className="text-sm">{data.count} visits</p>
        <p className="text-sm font-semibold"><Money amount={data.total} /></p>
      </div>
    );
  };

  return (
    <Card className={cn("col-span-1", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Recurring Expenses
            </CardTitle>
            <CardDescription>Non-subscription spending habits</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Sort by
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy("frequency")}>
                  Frequency {sortBy === "frequency" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("amount")}>
                  Avg Amount {sortBy === "amount" && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("total")}>
                  Total Spent {sortBy === "total" && "✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          Total: <span className="font-semibold text-foreground"><Money amount={totalRecurring} /></span> over 6 months
        </div>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Repeat className="h-8 w-8 mb-2 opacity-50" />
            <p>No recurring patterns detected</p>
            <p className="text-sm">Keep tracking for insights</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.slice(0, 8).map((pattern) => (
              <button
                key={pattern.merchant}
                onClick={() =>
                  setSelectedMerchant(
                    selectedMerchant === pattern.merchant ? null : pattern.merchant
                  )
                }
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-all hover:bg-accent/50",
                  selectedMerchant === pattern.merchant && "ring-2 ring-primary bg-accent/30"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium truncate max-w-[180px]">{pattern.merchant}</p>
                    <p className="text-xs text-muted-foreground">{pattern.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold"><Money amount={pattern.avgAmount} /></p>
                    <div className="flex items-center gap-1 text-xs">
                      {pattern.trend > 10 ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : pattern.trend < -10 ? (
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
                      ) : null}
                      <span className="text-muted-foreground">
                        {pattern.frequency.toFixed(1)}x/month
                      </span>
                    </div>
                  </div>
                </div>
                <Progress
                  value={(pattern.totalSpent / totalRecurring) * 100}
                  className="h-1"
                />
              </button>
            ))}

            {/* Selected merchant chart */}
            {selectedPattern && (
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-semibold mb-2">{selectedPattern.merchant} - Last 6 Months</h4>
                <div className="h-[120px]">
                    <ClientOnly>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedPattern.monthlyData}>
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        className="fill-muted-foreground"
                      />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {selectedPattern.monthlyData.map((_, index) => (
                          <Cell key={index} fill={index === selectedPattern.monthlyData.length - 1 ? "#3b82f6" : "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                    </ClientOnly>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>{selectedPattern.occurrences} total visits</span>
                  <span>Total: <Money amount={selectedPattern.totalSpent} /></span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
