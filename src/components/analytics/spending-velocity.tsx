"use client";

import { useMemo } from "react";
import { format, subMonths, getDaysInMonth, getDate } from "date-fns";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";

interface SpendingVelocityProps {
  transactions: Transaction[];
  monthlyBudget?: number;
  className?: string;
}

export function SpendingVelocity({
  transactions,
  monthlyBudget,
  className,
}: SpendingVelocityProps) {
  const velocityData = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const monthProgress = (dayOfMonth / daysInMonth) * 100;

    // This month expenses
    const thisMonthExpenses = transactions
      .filter((t) => t.direction === "debit" && t.date.startsWith(thisMonth))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Last month total expenses
    const lastMonthTotal = transactions
      .filter((t) => t.direction === "debit" && t.date.startsWith(lastMonth))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Last month expenses up to same day
    const lastMonthSameDay = transactions
      .filter((t) => {
        if (t.direction !== "debit" || !t.date.startsWith(lastMonth)) return false;
        const txDay = parseInt(t.date.split("-")[2], 10);
        return txDay <= dayOfMonth;
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Calculate velocity
    const budget = monthlyBudget || lastMonthTotal || thisMonthExpenses * 2;
    const spendingProgress = budget > 0 ? (thisMonthExpenses / budget) * 100 : 0;
    
    // Velocity comparison (this month vs last month same period)
    const velocityChange = lastMonthSameDay > 0
      ? ((thisMonthExpenses - lastMonthSameDay) / lastMonthSameDay) * 100
      : 0;

    // Determine status
    let status: "under" | "on-track" | "over" = "on-track";
    if (spendingProgress < monthProgress - 10) status = "under";
    else if (spendingProgress > monthProgress + 10) status = "over";

    // Daily average and projection
    const dailyAvg = dayOfMonth > 0 ? thisMonthExpenses / dayOfMonth : 0;
    const projectedTotal = dailyAvg * daysInMonth;
    const projectedDiff = projectedTotal - budget;

    // Days remaining
    const daysRemaining = daysInMonth - dayOfMonth;
    const remainingBudget = Math.max(0, budget - thisMonthExpenses);
    const dailyBudgetRemaining = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

    return {
      thisMonthExpenses,
      lastMonthTotal,
      lastMonthSameDay,
      budget,
      monthProgress,
      spendingProgress,
      velocityChange,
      status,
      dailyAvg,
      projectedTotal,
      projectedDiff,
      daysRemaining,
      dailyBudgetRemaining,
      dayOfMonth,
      daysInMonth,
    };
  }, [transactions, monthlyBudget]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statusConfig = {
    under: {
      color: "text-emerald-500",
      bgColor: "bg-emerald-500",
      label: "Under Budget",
      icon: <TrendingDown className="h-4 w-4" />,
    },
    "on-track": {
      color: "text-blue-500",
      bgColor: "bg-blue-500",
      label: "On Track",
      icon: <Minus className="h-4 w-4" />,
    },
    over: {
      color: "text-red-500",
      bgColor: "bg-red-500",
      label: "Over Budget",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  };

  const config = statusConfig[velocityData.status];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Spending Velocity
            </CardTitle>
            <CardDescription>How fast you're spending this month</CardDescription>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium",
            config.color,
            velocityData.status === "under" && "bg-emerald-500/10",
            velocityData.status === "on-track" && "bg-blue-500/10",
            velocityData.status === "over" && "bg-red-500/10"
          )}>
            {config.icon}
            {config.label}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress visualization */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Used</span>
              <span className="font-medium">
                {formatCurrency(velocityData.thisMonthExpenses)} / {formatCurrency(velocityData.budget)}
              </span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              {/* Expected progress marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
                style={{ left: `${Math.min(velocityData.monthProgress, 100)}%` }}
              />
              {/* Actual spending bar */}
              <div
                className={cn(
                  "absolute top-0 left-0 h-full rounded-full transition-all",
                  config.bgColor
                )}
                style={{ width: `${Math.min(velocityData.spendingProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Day {velocityData.dayOfMonth} of {velocityData.daysInMonth}</span>
              <span>{velocityData.spendingProgress.toFixed(0)}% spent</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Daily Average</p>
              <p className="text-lg font-bold">{formatCurrency(velocityData.dailyAvg)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Daily Budget Left</p>
              <p className={cn(
                "text-lg font-bold",
                velocityData.dailyBudgetRemaining < velocityData.dailyAvg && "text-amber-500"
              )}>
                {formatCurrency(velocityData.dailyBudgetRemaining)}
              </p>
            </div>
          </div>

          {/* Projection */}
          <div className={cn(
            "p-3 rounded-lg border",
            velocityData.projectedDiff > 0 ? "bg-red-500/5 border-red-500/20" : "bg-emerald-500/5 border-emerald-500/20"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Month-End Projection</p>
                <p className="text-lg font-bold">
                  {formatCurrency(velocityData.projectedTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">vs Budget</p>
                <p className={cn(
                  "text-lg font-bold",
                  velocityData.projectedDiff > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {velocityData.projectedDiff > 0 ? "+" : ""}{formatCurrency(velocityData.projectedDiff)}
                </p>
              </div>
            </div>
          </div>

          {/* vs Last Month */}
          <div className="flex items-center justify-between pt-2 text-sm">
            <span className="text-muted-foreground">vs Last Month (same period)</span>
            <span className={cn(
              "font-medium flex items-center gap-1",
              velocityData.velocityChange > 0 ? "text-red-500" : "text-emerald-500"
            )}>
              {velocityData.velocityChange > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {velocityData.velocityChange > 0 ? "+" : ""}{velocityData.velocityChange.toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
