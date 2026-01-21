"use client";

import { useMemo } from "react";
import { format, subMonths, startOfMonth, endOfMonth, getDate, getDaysInMonth } from "date-fns";
import { TrendingUp, TrendingDown, Gauge, PiggyBank, Zap, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

interface QuickStatsProps {
  className?: string;
}

export function QuickStats({ className }: QuickStatsProps) {
  // Fetch transactions for current and last month
  const now = new Date();
  const twoMonthsAgo = startOfMonth(subMonths(now, 1));
  
  const transactions = useLiveQuery(
    () => db.transactions
      .where("date")
      .aboveOrEqual(format(twoMonthsAgo, "yyyy-MM-dd"))
      .toArray(),
    []
  );

  const stats = useMemo(() => {
    if (!transactions) return null;
    
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    // This month's income and expenses
    const thisMonthTxns = transactions.filter(t => t.date.startsWith(thisMonth));
    const totalIncome = thisMonthTxns
      .filter(t => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = thisMonthTxns
      .filter(t => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Savings rate
    const savingsRate = totalIncome > 0 
      ? ((totalIncome - totalExpenses) / totalIncome) * 100 
      : 0;

    // Last month's expenses for comparison
    const lastMonthTotal = transactions
      .filter((t) => t.direction === "debit" && t.date.startsWith(lastMonth))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const expectedSpending = lastMonthTotal || totalExpenses * (daysInMonth / dayOfMonth);
    const spendingProgress = expectedSpending > 0 
      ? (totalExpenses / expectedSpending) * 100 
      : 0;

    // Velocity status
    let velocityStatus: "under" | "on-track" | "over" = "on-track";
    if (spendingProgress < monthProgress - 10) velocityStatus = "under";
    else if (spendingProgress > monthProgress + 10) velocityStatus = "over";

    // Daily average
    const dailyAvg = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;

    // Days until budget runs out (if continuing at this pace)
    const remainingDays = daysInMonth - dayOfMonth;
    const projectedTotal = dailyAvg * daysInMonth;

    return {
      savingsRate,
      thisMonthExpenses: totalExpenses,
      lastMonthTotal,
      spendingProgress,
      monthProgress,
      velocityStatus,
      dailyAvg,
      projectedTotal,
      dayOfMonth,
      daysInMonth,
      remainingDays,
    };
  }, [transactions, now]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const velocityConfig = {
    under: { color: "text-emerald-500", bg: "bg-emerald-500", label: "Under budget" },
    "on-track": { color: "text-blue-500", bg: "bg-blue-500", label: "On track" },
    over: { color: "text-red-500", bg: "bg-red-500", label: "Over budget" },
  };

  // Loading state
  if (!stats) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Savings Rate */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="h-4 w-4" />
              <span>Savings Rate</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-2xl font-bold",
                stats.savingsRate >= 20 ? "text-emerald-500" : 
                stats.savingsRate >= 10 ? "text-amber-500" : "text-red-500"
              )}>
                {stats.savingsRate.toFixed(0)}%
              </span>
              {stats.savingsRate >= 20 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.savingsRate >= 20 ? "Great job! 🎉" : "Try to save 20%+"}
            </p>
          </div>

          {/* Spending Velocity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="h-4 w-4" />
              <span>Spending Pace</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-2xl font-bold",
                velocityConfig[stats.velocityStatus].color
              )}>
                {formatCurrency(stats.dailyAvg)}
              </span>
              <span className="text-xs text-muted-foreground">/day</span>
            </div>
            <div className="space-y-1">
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
                  style={{ left: `${Math.min(stats.monthProgress, 100)}%` }}
                />
                <div
                  className={cn(
                    "absolute top-0 left-0 h-full rounded-full transition-all",
                    velocityConfig[stats.velocityStatus].bg
                  )}
                  style={{ width: `${Math.min(stats.spendingProgress, 100)}%` }}
                />
              </div>
              <p className={cn(
                "text-xs",
                velocityConfig[stats.velocityStatus].color
              )}>
                {velocityConfig[stats.velocityStatus].label}
              </p>
            </div>
          </div>

          {/* Month Progress */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Month Progress</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">
                {stats.dayOfMonth}
              </span>
              <span className="text-sm text-muted-foreground">/ {stats.daysInMonth} days</span>
            </div>
            <Progress value={stats.monthProgress} className="h-2" />
          </div>

          {/* Projected Total */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>Month Projection</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-2xl font-bold",
                stats.projectedTotal > stats.lastMonthTotal ? "text-red-500" : "text-emerald-500"
              )}>
                {formatCurrency(stats.projectedTotal)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.lastMonthTotal > 0 && (
                <>vs {formatCurrency(stats.lastMonthTotal)} last month</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
