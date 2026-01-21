"use client";

import { useMemo } from "react";
import { format, subMonths, getDate, getDaysInMonth } from "date-fns";
import { Calendar, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";

interface MonthlySummaryProps {
  className?: string;
}

export function MonthlySummary({ className }: MonthlySummaryProps) {
  // Fetch current and last month transactions
  const now = new Date();
  const twoMonthsAgo = subMonths(now, 1);
  
  const transactions = useLiveQuery(
    () => db.transactions
      .where("date")
      .aboveOrEqual(format(twoMonthsAgo, "yyyy-MM") + "-01")
      .toArray(),
    []
  );

  const summary = useMemo(() => {
    if (!transactions) return null;
    
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);

    // This month data
    const thisMonthTx = transactions.filter((t) => t.date.startsWith(thisMonth));
    const income = thisMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = thisMonthTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = income - expenses;
    const txCount = thisMonthTx.length;

    // Last month data for comparison
    const lastMonthTx = transactions.filter((t) => t.date.startsWith(lastMonth));
    const lastIncome = lastMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const lastExpenses = lastMonthTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Changes
    const incomeChange = lastIncome > 0 ? ((income - lastIncome) / lastIncome) * 100 : 0;
    const expenseChange = lastExpenses > 0 ? ((expenses - lastExpenses) / lastExpenses) * 100 : 0;

    // Top category
    const categoryTotals = new Map<string, number>();
    thisMonthTx
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + Math.abs(t.amount));
      });
    
    let topCategory = { name: "None", amount: 0 };
    categoryTotals.forEach((amount, name) => {
      if (amount > topCategory.amount) {
        topCategory = { name, amount };
      }
    });

    return {
      monthName: format(now, "MMMM"),
      income,
      expenses,
      net,
      txCount,
      incomeChange,
      expenseChange,
      topCategory,
      dayOfMonth,
      daysInMonth,
      daysRemaining: daysInMonth - dayOfMonth,
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

  const ChangeIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const color = isPositive ? "text-emerald-500" : value === 0 ? "text-muted-foreground" : "text-red-500";
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;

    return (
      <span className={cn("flex items-center gap-0.5 text-xs", color)}>
        <Icon className="h-3 w-3" />
        {Math.abs(value).toFixed(0)}%
      </span>
    );
  };

  // Loading state
  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-1.5 w-full" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            {summary.monthName} Summary
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Day {summary.dayOfMonth} of {summary.daysInMonth}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={(summary.dayOfMonth / summary.daysInMonth) * 100} className="h-1.5" />
          <p className="text-xs text-muted-foreground text-right">
            {summary.daysRemaining} days remaining
          </p>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-emerald-500/10">
            <p className="text-xs text-muted-foreground mb-0.5">Income</p>
            <p className="text-sm font-bold text-emerald-500">{formatCurrency(summary.income)}</p>
            <ChangeIndicator value={summary.incomeChange} />
          </div>
          <div className="text-center p-2 rounded-lg bg-red-500/10">
            <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(summary.expenses)}</p>
            <ChangeIndicator value={summary.expenseChange} inverse />
          </div>
          <div className={cn(
            "text-center p-2 rounded-lg",
            summary.net >= 0 ? "bg-blue-500/10" : "bg-amber-500/10"
          )}>
            <p className="text-xs text-muted-foreground mb-0.5">Net</p>
            <p className={cn(
              "text-sm font-bold",
              summary.net >= 0 ? "text-blue-500" : "text-amber-500"
            )}>
              {formatCurrency(summary.net)}
            </p>
            <span className="text-xs text-muted-foreground">
              {summary.txCount} tx
            </span>
          </div>
        </div>

        {/* Top category */}
        {summary.topCategory.amount > 0 && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">Top Spending</p>
              <p className="text-sm font-medium">{summary.topCategory.name}</p>
            </div>
            <p className="text-sm font-bold">{formatCurrency(summary.topCategory.amount)}</p>
          </div>
        )}

        {/* Link to analytics */}
        <Link 
          href="/analytics" 
          className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
        >
          View detailed analytics
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
