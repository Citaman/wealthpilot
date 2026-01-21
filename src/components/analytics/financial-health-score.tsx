"use client";

import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { Activity, TrendingUp, TrendingDown, Minus, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";

interface FinancialHealthScoreProps {
  transactions: Transaction[];
  currentBalance: number;
  className?: string;
}

interface ScoreBreakdown {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  status: "good" | "warning" | "bad";
}

export function FinancialHealthScore({
  transactions,
  currentBalance,
  className,
}: FinancialHealthScoreProps) {
  const { overallScore, breakdown, tips } = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const threeMonthsAgo = format(subMonths(now, 3), "yyyy-MM");

    // Filter transactions
    const thisMonthTx = transactions.filter((t) => t.date.startsWith(thisMonth));
    const last3MonthsTx = transactions.filter((t) => t.date >= threeMonthsAgo);

    // Calculate metrics
    const thisMonthIncome = thisMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const thisMonthExpenses = thisMonthTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const last3MonthsIncome = last3MonthsTx
      .filter((t) => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0) / 3;
    const last3MonthsExpenses = last3MonthsTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0) / 3;

    const avgMonthlyIncome = last3MonthsIncome || thisMonthIncome || 1;
    const avgMonthlyExpenses = last3MonthsExpenses || thisMonthExpenses;

    // Score calculations (out of 100)
    const scores: ScoreBreakdown[] = [];

    // 1. Savings Rate (0-25 points)
    // 30%+ = 25, 20-30% = 20, 10-20% = 15, 0-10% = 10, negative = 0
    const savingsRate = avgMonthlyIncome > 0 
      ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100 
      : 0;
    let savingsScore = 0;
    let savingsStatus: "good" | "warning" | "bad" = "bad";
    if (savingsRate >= 30) { savingsScore = 25; savingsStatus = "good"; }
    else if (savingsRate >= 20) { savingsScore = 20; savingsStatus = "good"; }
    else if (savingsRate >= 10) { savingsScore = 15; savingsStatus = "warning"; }
    else if (savingsRate >= 0) { savingsScore = 10; savingsStatus = "warning"; }
    scores.push({
      name: "Savings Rate",
      score: savingsScore,
      maxScore: 25,
      description: `${savingsRate.toFixed(0)}% of income saved`,
      status: savingsStatus,
    });

    // 2. Emergency Fund (0-25 points)
    // 6+ months = 25, 3-6 = 20, 1-3 = 10, <1 = 0
    const monthsOfExpenses = avgMonthlyExpenses > 0 
      ? currentBalance / avgMonthlyExpenses 
      : 0;
    let emergencyScore = 0;
    let emergencyStatus: "good" | "warning" | "bad" = "bad";
    if (monthsOfExpenses >= 6) { emergencyScore = 25; emergencyStatus = "good"; }
    else if (monthsOfExpenses >= 3) { emergencyScore = 20; emergencyStatus = "good"; }
    else if (monthsOfExpenses >= 1) { emergencyScore = 10; emergencyStatus = "warning"; }
    scores.push({
      name: "Emergency Fund",
      score: emergencyScore,
      maxScore: 25,
      description: `${monthsOfExpenses.toFixed(1)} months of expenses covered`,
      status: emergencyStatus,
    });

    // 3. Spending Consistency (0-25 points)
    // Compare this month to avg - within 10% = 25, 10-20% = 20, 20-30% = 15, >30% = 5
    const spendingVariance = avgMonthlyExpenses > 0
      ? Math.abs(thisMonthExpenses - avgMonthlyExpenses) / avgMonthlyExpenses * 100
      : 0;
    let consistencyScore = 0;
    let consistencyStatus: "good" | "warning" | "bad" = "bad";
    if (spendingVariance <= 10) { consistencyScore = 25; consistencyStatus = "good"; }
    else if (spendingVariance <= 20) { consistencyScore = 20; consistencyStatus = "good"; }
    else if (spendingVariance <= 30) { consistencyScore = 15; consistencyStatus = "warning"; }
    else { consistencyScore = 5; }
    scores.push({
      name: "Spending Consistency",
      score: consistencyScore,
      maxScore: 25,
      description: spendingVariance <= 20 ? "Stable spending patterns" : "Spending varies significantly",
      status: consistencyStatus,
    });

    // 4. Expense Diversification (0-25 points)
    // Not too concentrated in any single category
    const categorySpending = new Map<string, number>();
    thisMonthTx
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        categorySpending.set(t.category, (categorySpending.get(t.category) || 0) + Math.abs(t.amount));
      });
    const categoryTotals = Array.from(categorySpending.values());
    const maxCategoryPct = thisMonthExpenses > 0
      ? Math.max(...categoryTotals, 0) / thisMonthExpenses * 100
      : 0;
    let diversificationScore = 0;
    let diversificationStatus: "good" | "warning" | "bad" = "bad";
    if (maxCategoryPct <= 30) { diversificationScore = 25; diversificationStatus = "good"; }
    else if (maxCategoryPct <= 40) { diversificationScore = 20; diversificationStatus = "good"; }
    else if (maxCategoryPct <= 50) { diversificationScore = 15; diversificationStatus = "warning"; }
    else { diversificationScore = 10; }
    scores.push({
      name: "Balanced Spending",
      score: diversificationScore,
      maxScore: 25,
      description: maxCategoryPct <= 40 ? "Well-diversified expenses" : "Some categories dominate spending",
      status: diversificationStatus,
    });

    const total = scores.reduce((s, b) => s + b.score, 0);

    // Generate tips based on lowest scores
    const sortedScores = [...scores].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));
    const generatedTips: string[] = [];
    
    sortedScores.forEach((s) => {
      if (s.status !== "good") {
        switch (s.name) {
          case "Savings Rate":
            generatedTips.push("Try to save at least 20% of your income each month");
            break;
          case "Emergency Fund":
            generatedTips.push("Build an emergency fund covering 3-6 months of expenses");
            break;
          case "Spending Consistency":
            generatedTips.push("Create a monthly budget to stabilize spending");
            break;
          case "Balanced Spending":
            generatedTips.push("Review your largest expense categories for savings opportunities");
            break;
        }
      }
    });

    return { overallScore: total, breakdown: scores, tips: generatedTips.slice(0, 2) };
  }, [transactions, currentBalance]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (score >= 60) return <ShieldCheck className="h-5 w-5 text-blue-500" />;
    if (score >= 40) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  const statusColors = {
    good: "text-emerald-500",
    warning: "text-amber-500",
    bad: "text-red-500",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Financial Health Score
        </CardTitle>
        <CardDescription>Overall assessment of your finances</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main Score */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-muted stroke-current"
                strokeWidth="8"
                fill="none"
                r="42"
                cx="50"
                cy="50"
              />
              <circle
                className={cn("stroke-current", getScoreColor(overallScore))}
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                r="42"
                cx="50"
                cy="50"
                strokeDasharray={`${overallScore * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold", getScoreColor(overallScore))}>
                {overallScore}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getScoreIcon(overallScore)}
              <span className={cn("text-lg font-semibold", getScoreColor(overallScore))}>
                {getScoreLabel(overallScore)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on your last 3 months
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3 mt-4">
          {breakdown.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.name}</span>
                <span className={cn("font-semibold", statusColors[item.status])}>
                  {item.score}/{item.maxScore}
                </span>
              </div>
              <Progress
                value={(item.score / item.maxScore) * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
              💡 Improvement Tips
            </h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {tips.map((tip, idx) => (
                <li key={idx}>• {tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
