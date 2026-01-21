"use client";

import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  // Core Analytics
  BalanceTimeline,
  SpendingTrends,
  MonthComparison,
  // v0.7.0 Overhaul
  SpendingCalendar,
  PersonalInsights,
  RecurringExpenses,
  SpendingForecast,
  CategoryTrends,
  SavingsPotential,
  FinancialHealthScore,
  SpendingVelocity,
  TopMerchants,
} from "@/components/analytics";
import { useTransactions } from "@/hooks/use-data";
import { useAccount } from "@/contexts/account-context";
import { cn } from "@/lib/utils";

type Period = "1m" | "3m" | "6m" | "12m" | "ytd";

export default function AnalyticsPage() {
  const { selectedAccountId } = useAccount();
  const [period, setPeriod] = useState<Period>("6m");
  const now = new Date();

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    switch (period) {
      case "1m":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "3m":
        return { start: subMonths(startOfMonth(now), 2), end: endOfMonth(now) };
      case "6m":
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
      case "12m":
        return { start: subMonths(startOfMonth(now), 11), end: endOfMonth(now) };
      case "ytd":
        return { start: startOfYear(now), end: endOfMonth(now) };
      default:
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
    }
  }, [period]);

  const { transactions, isLoading } = useTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: selectedAccountId,
    excludeExcluded: true,
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(
      transactions
        .filter((t) => t.direction === "debit")
        .reduce((sum, t) => sum + t.amount, 0)
    );

    // Get unique months
    const months = new Set(transactions.map((t) => format(new Date(t.date), "yyyy-MM")));
    const monthCount = months.size || 1;

    const avgIncome = totalIncome / monthCount;
    const avgExpenses = totalExpenses / monthCount;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    const netSavings = totalIncome - totalExpenses;

    // Calculate current balance from most recent transaction
    const sortedTx = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const currentBalance = sortedTx[0]?.balanceAfter || 0;

    // Calculate month-over-month change
    const thisMonthExpenses = transactions
      .filter(
        (t) =>
          t.direction === "debit" &&
          format(new Date(t.date), "yyyy-MM") === format(now, "yyyy-MM")
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastMonthExpenses = transactions
      .filter(
        (t) =>
          t.direction === "debit" &&
          format(new Date(t.date), "yyyy-MM") === format(subMonths(now, 1), "yyyy-MM")
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const momChange = lastMonthExpenses !== 0
      ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : 0;

    return {
      totalIncome,
      totalExpenses,
      avgIncome,
      avgExpenses,
      savingsRate,
      netSavings,
      currentBalance,
      transactionCount: transactions.length,
      momChange,
    };
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const periodLabels: Record<Period, string> = {
    "1m": "This Month",
    "3m": "Last 3 Months",
    "6m": "Last 6 Months",
    "12m": "Last 12 Months",
    ytd: "Year to Date",
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Deep insights into your financial patterns
            </p>
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="1m">1M</TabsTrigger>
              <TabsTrigger value="3m">3M</TabsTrigger>
              <TabsTrigger value="6m">6M</TabsTrigger>
              <TabsTrigger value="12m">1Y</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Stats - 5 cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalIncome)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  stats.netSavings >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                )}>
                  <PiggyBank className={cn(
                    "h-5 w-5",
                    stats.netSavings >= 0 ? "text-emerald-600" : "text-red-600"
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Savings</p>
                  <p className={cn(
                    "text-xl font-bold",
                    stats.netSavings >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>{formatCurrency(stats.netSavings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Monthly</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.avgExpenses)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    stats.momChange <= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                  )}
                >
                  {stats.momChange <= 0 ? (
                    <TrendingDown className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">vs Last Month</p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      stats.momChange <= 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {stats.momChange > 0 ? "+" : ""}{stats.momChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[400px] rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Personal Insights Carousel - Full width prominent */}
            <PersonalInsights transactions={transactions} />

            {/* Row 1: Financial Health Score + Spending Velocity + Top Merchants */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <FinancialHealthScore 
                transactions={transactions}
                currentBalance={stats.currentBalance}
              />
              <SpendingVelocity transactions={transactions} />
              <TopMerchants transactions={transactions} />
            </div>

            {/* Row 2: Spending Calendar (Large) - Full width for prominence */}
            <SpendingCalendar
              transactions={transactions}
              className="col-span-full"
            />

            {/* Row 3: Spending Forecast + Savings Potential */}
            <div className="grid gap-6 lg:grid-cols-2">
              <SpendingForecast
                transactions={transactions}
                currentBalance={stats.currentBalance}
              />
              <SavingsPotential transactions={transactions} />
            </div>

            {/* Row 4: Balance Timeline - Full width */}
            <BalanceTimeline
              transactions={transactions}
              startDate={dateRange.start}
              endDate={dateRange.end}
            />

            {/* Row 5: Month Analysis + Spending Trends + Category Trends */}
            <div className="grid gap-6 lg:grid-cols-3">
              <MonthComparison transactions={transactions} />
              <SpendingTrends
                transactions={transactions}
                startDate={dateRange.start}
                endDate={dateRange.end}
              />
              <CategoryTrends transactions={transactions} />
            </div>

            {/* Row 6: Recurring Expenses (Full width) */}
            <RecurringExpenses transactions={transactions} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
