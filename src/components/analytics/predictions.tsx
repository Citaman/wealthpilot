"use client";

import { useMemo } from "react";
import { format, parseISO, addMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { TrendingUp, Target, AlertTriangle, Calculator, AlertCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";

interface PredictionsProps {
  transactions: Transaction[];
  currentBalance: number;
  className?: string;
}

interface PredictionResult {
  expectedRecurring: number;
  recurringCount: number;
  predictedVariable: number;
  totalPredicted: number;
  predictedLow: number;
  predictedHigh: number;
  predictedBalance: number;
  confidence: number;
  threeMonthOutlook: { month: string; balance: number }[];
}

export function Predictions({ transactions, currentBalance, className }: PredictionsProps) {
  const { convertFromAccount, formatCompact } = useMoney();

  const prediction = useMemo((): PredictionResult => {
    const now = new Date();

    // Find recurring transactions
    const recurringTx = transactions.filter((tx) => tx.isRecurring && tx.direction === "debit");
    const expectedRecurring = recurringTx.reduce((sum, tx) => sum + Math.abs(convertFromAccount(tx.amount, tx.accountId)), 0) / 
      Math.max(1, new Set(recurringTx.map(tx => format(parseISO(tx.date), "yyyy-MM"))).size);

    // Calculate variable spending (3-month moving average)
    const monthlyVariable: number[] = [];
    for (let i = 0; i < 6; i++) {
      const monthStart = startOfMonth(addMonths(now, -i - 1));
      const monthTx = transactions.filter(
        (tx) =>
          tx.direction === "debit" &&
          !tx.isRecurring &&
          isSameMonth(parseISO(tx.date), monthStart)
      );
      monthlyVariable.push(monthTx.reduce((sum, tx) => sum + Math.abs(convertFromAccount(tx.amount, tx.accountId)), 0));
    }

    const recentMonths = monthlyVariable.slice(0, 3).filter((v) => v > 0);
    const predictedVariable = recentMonths.length > 0
      ? recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length
      : 0;

    const mean = predictedVariable;
    const variance = recentMonths.length > 0
      ? recentMonths.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentMonths.length
      : 0;
    const stdDev = Math.sqrt(variance);

    const margin = 1.96 * stdDev;
    const totalPredicted = expectedRecurring + predictedVariable;

    // Calculate expected income
    const monthlyIncome: number[] = [];
    for (let i = 0; i < 3; i++) {
      const monthStart = startOfMonth(addMonths(now, -i - 1));
      const monthTx = transactions.filter(
        (tx) =>
          tx.direction === "credit" &&
          isSameMonth(parseISO(tx.date), monthStart)
      );
      monthlyIncome.push(monthTx.reduce((sum, tx) => sum + convertFromAccount(tx.amount, tx.accountId), 0));
    }
    const expectedIncome = monthlyIncome.length > 0
      ? monthlyIncome.reduce((a, b) => a + b, 0) / monthlyIncome.length
      : 0;

    const predictedBalance = currentBalance + expectedIncome - totalPredicted;

    // 3-Month Outlook
    const outlook: { month: string; balance: number }[] = [];
    let runningBalance = currentBalance;
    const monthlyNet = expectedIncome - totalPredicted;

    for (let i = 1; i <= 3; i++) {
      runningBalance += monthlyNet;
      outlook.push({
        month: format(addMonths(now, i), "MMM"),
        balance: runningBalance,
      });
    }

    const dataMonths = new Set(transactions.map((tx) => format(parseISO(tx.date), "yyyy-MM"))).size;
    const confidence = Math.min(95, Math.max(50, 50 + dataMonths * 5));

    return {
      expectedRecurring,
      recurringCount: new Set(recurringTx.map((tx) => tx.merchant)).size,
      predictedVariable,
      totalPredicted,
      predictedLow: totalPredicted - margin,
      predictedHigh: totalPredicted + margin,
      predictedBalance,
      confidence,
      threeMonthOutlook: outlook,
    };
  }, [transactions, currentBalance, convertFromAccount]);

  const nextMonthName = format(addMonths(new Date(), 1), "MMMM");

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {nextMonthName} Predictions
            </CardTitle>
            <CardDescription>Based on your spending patterns</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-sm font-medium">{prediction.confidence}%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expected Recurring */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Expected Recurring</h4>
              <p className="text-2xl font-bold text-orange-600">
                <Money amount={prediction.expectedRecurring} />
              </p>
            </div>
            <Target className="h-5 w-5 text-orange-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {prediction.recurringCount} subscriptions & bills
          </p>
        </div>

        {/* Predicted Variable */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Predicted Variable</h4>
              <p className="text-2xl font-bold text-blue-600">
                <Money amount={prediction.predictedVariable} />
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            3-month moving average
          </p>
          <div className="mt-2">
            <Progress value={prediction.confidence} className="h-1.5" />
          </div>
        </div>

        {/* Total Predicted */}
        <div className="p-4 rounded-lg bg-muted">
          <h4 className="text-sm font-medium text-muted-foreground">Total Predicted Expenses</h4>
          <p className="text-3xl font-bold">
            <Money amount={prediction.totalPredicted} />
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Range: <Money amount={prediction.predictedLow} /> – <Money amount={prediction.predictedHigh} />
          </p>
        </div>

        {/* Predicted Balance */}
        <div
          className={cn(
            "p-4 rounded-lg border-2",
            prediction.predictedBalance >= 0 ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950" : "border-red-500 bg-red-50 dark:bg-red-950"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Next Month Outlook</h4>
              <p
                className={cn(
                  "text-3xl font-bold",
                  prediction.predictedBalance >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                <Money amount={prediction.predictedBalance} />
              </p>
            </div>
            {prediction.predictedBalance < 0 && (
              <AlertCircle className="h-6 w-6 text-red-500" />
            )}
          </div>
          
          {/* 3-Month Trajectory */}
          <div className="mt-4 pt-4 border-t border-dashed">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">3-Month Trajectory</p>
            <div className="flex items-end justify-between gap-2 h-16">
              {prediction.threeMonthOutlook.map((item, idx) => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={cn(
                      "w-full rounded-t-sm transition-all duration-500",
                      item.balance >= 0 ? "bg-emerald-500/40" : "bg-red-500/40"
                    )}
                    style={{ height: `${Math.min(100, Math.max(10, (item.balance / Math.max(currentBalance, 1)) * 50))}%` }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">{item.month}</span>
                  <span className="text-[10px] font-bold">
                    <PrivacyBlur>{formatCompact(item.balance)}</PrivacyBlur>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warning if negative */}
        {prediction.predictedBalance < 0 && (
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm">
            ⚠️ Your balance may go negative. Consider reducing variable spending by{" "}
            <Money as="strong" amount={Math.abs(prediction.predictedBalance)} />
            .
          </div>
        )}
      </CardContent>
    </Card>
  );
}
