"use client";

import { useMemo } from "react";
import { format, parseISO, addMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { TrendingUp, Target, AlertTriangle, Calculator } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";

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
}

export function Predictions({ transactions, currentBalance, className }: PredictionsProps) {
  const prediction = useMemo((): PredictionResult => {
    const now = new Date();
    const nextMonth = addMonths(now, 1);

    // Find recurring transactions
    const recurringTx = transactions.filter((tx) => tx.isRecurring && tx.direction === "debit");
    const expectedRecurring = recurringTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / 
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
      monthlyVariable.push(monthTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0));
    }

    // Use last 3 months for average
    const recentMonths = monthlyVariable.slice(0, 3).filter((v) => v > 0);
    const predictedVariable = recentMonths.length > 0
      ? recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length
      : 0;

    // Calculate standard deviation for confidence interval
    const mean = predictedVariable;
    const variance = recentMonths.length > 0
      ? recentMonths.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentMonths.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // 95% confidence interval
    const margin = 1.96 * stdDev;
    const predictedLow = Math.max(0, predictedVariable - margin);
    const predictedHigh = predictedVariable + margin;

    // Total prediction
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
      monthlyIncome.push(monthTx.reduce((sum, tx) => sum + tx.amount, 0));
    }
    const expectedIncome = monthlyIncome.length > 0
      ? monthlyIncome.reduce((a, b) => a + b, 0) / monthlyIncome.length
      : 0;

    // Predicted end-of-month balance
    const predictedBalance = currentBalance + expectedIncome - totalPredicted;

    // Confidence score based on data availability
    const dataMonths = new Set(transactions.map((tx) => format(parseISO(tx.date), "yyyy-MM"))).size;
    const confidence = Math.min(95, Math.max(50, 50 + dataMonths * 5));

    return {
      expectedRecurring,
      recurringCount: new Set(recurringTx.map((tx) => tx.merchant)).size,
      predictedVariable,
      totalPredicted,
      predictedLow: expectedRecurring + predictedLow,
      predictedHigh: expectedRecurring + predictedHigh,
      predictedBalance,
      confidence,
    };
  }, [transactions, currentBalance]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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
                {formatCurrency(prediction.expectedRecurring)}
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
                {formatCurrency(prediction.predictedVariable)}
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
          <p className="text-3xl font-bold">{formatCurrency(prediction.totalPredicted)}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Range: {formatCurrency(prediction.predictedLow)} – {formatCurrency(prediction.predictedHigh)}
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
              <h4 className="text-sm font-medium text-muted-foreground">Predicted End-of-Month Balance</h4>
              <p
                className={cn(
                  "text-3xl font-bold",
                  prediction.predictedBalance >= 0 ? "text-emerald-600" : "text-red-600"
                )}
              >
                {formatCurrency(prediction.predictedBalance)}
              </p>
            </div>
            {prediction.predictedBalance < 0 && (
              <AlertTriangle className="h-6 w-6 text-red-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Current: {formatCurrency(currentBalance)} → Predicted: {formatCurrency(prediction.predictedBalance)}
          </p>
        </div>

        {/* Warning if negative */}
        {prediction.predictedBalance < 0 && (
          <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-sm">
            ⚠️ Your balance may go negative. Consider reducing variable spending by{" "}
            <strong>{formatCurrency(Math.abs(prediction.predictedBalance))}</strong>.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
