"use client";

import { useMemo, useState } from "react";
import { format, subMonths, differenceInDays } from "date-fns";
import { ChevronLeft, ChevronRight, Lightbulb, AlertTriangle, TrendingUp, TrendingDown, PiggyBank, Repeat, Target, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Transaction } from "@/lib/db";

interface PersonalInsightsProps {
  transactions: Transaction[];
  className?: string;
}

type InsightPriority = "high" | "medium" | "low";

interface Insight {
  id: string;
  title: string;
  description: string;
  priority: InsightPriority;
  icon: React.ReactNode;
  category: "spending" | "saving" | "trend" | "alert" | "achievement";
  actionText?: string;
}

export function PersonalInsights({ transactions, className }: PersonalInsightsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const insights = useMemo(() => {
    const generated: Insight[] = [];
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");

    // Filter transactions
    const thisMonthTx = transactions.filter((t) => t.date.startsWith(thisMonth));
    const lastMonthTx = transactions.filter((t) => t.date.startsWith(lastMonth));
    const expenses = transactions.filter((t) => t.direction === "debit");
    const thisMonthExpenses = thisMonthTx.filter((t) => t.direction === "debit");
    const lastMonthExpenses = lastMonthTx.filter((t) => t.direction === "debit");

    // Calculate totals
    const thisMonthTotal = thisMonthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const lastMonthTotal = lastMonthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const thisMonthIncome = thisMonthTx.filter((t) => t.direction === "credit").reduce((s, t) => s + t.amount, 0);

    // Category analysis
    const categorySpending = new Map<string, { thisMonth: number; lastMonth: number }>();
    thisMonthExpenses.forEach((t) => {
      const cat = categorySpending.get(t.category) || { thisMonth: 0, lastMonth: 0 };
      cat.thisMonth += Math.abs(t.amount);
      categorySpending.set(t.category, cat);
    });
    lastMonthExpenses.forEach((t) => {
      const cat = categorySpending.get(t.category) || { thisMonth: 0, lastMonth: 0 };
      cat.lastMonth += Math.abs(t.amount);
      categorySpending.set(t.category, cat);
    });

    // Merchant frequency
    const merchantFreq = new Map<string, number>();
    expenses.forEach((t) => {
      const m = t.merchant || "Unknown";
      merchantFreq.set(m, (merchantFreq.get(m) || 0) + 1);
    });
    const topMerchant = Array.from(merchantFreq.entries()).sort((a, b) => b[1] - a[1])[0];

    // Day of week analysis
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    expenses.forEach((t) => {
      const day = new Date(t.date).getDay();
      dayTotals[day] += Math.abs(t.amount);
    });
    const maxDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // === GENERATE INSIGHTS ===

    // 1. Month-over-month comparison (HIGH)
    if (lastMonthTotal > 0) {
      const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      if (change > 15) {
        generated.push({
          id: "mom-up",
          title: "Spending Spike Alert",
          description: `You've spent ${change.toFixed(0)}% more this month compared to last month. Review your recent purchases to stay on track.`,
          priority: "high",
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
          category: "alert",
          actionText: "Review transactions",
        });
      } else if (change < -10) {
        generated.push({
          id: "mom-down",
          title: "Great Progress!",
          description: `Your spending is down ${Math.abs(change).toFixed(0)}% compared to last month. You're on track to save more!`,
          priority: "medium",
          icon: <Award className="h-5 w-5 text-emerald-500" />,
          category: "achievement",
        });
      }
    }

    // 2. Savings rate (HIGH/MEDIUM)
    if (thisMonthIncome > 0) {
      const savingsRate = ((thisMonthIncome - thisMonthTotal) / thisMonthIncome) * 100;
      if (savingsRate < 10) {
        generated.push({
          id: "low-savings",
          title: "Low Savings Rate",
          description: `You're only saving ${savingsRate.toFixed(0)}% of your income this month. Aim for at least 20% to build financial security.`,
          priority: "high",
          icon: <PiggyBank className="h-5 w-5 text-amber-500" />,
          category: "saving",
          actionText: "Find savings opportunities",
        });
      } else if (savingsRate >= 30) {
        generated.push({
          id: "high-savings",
          title: "Excellent Saver!",
          description: `You're saving ${savingsRate.toFixed(0)}% of your income. Consider investing your surplus for long-term growth.`,
          priority: "low",
          icon: <Award className="h-5 w-5 text-emerald-500" />,
          category: "achievement",
        });
      }
    }

    // 3. Category spike detection (HIGH)
    categorySpending.forEach((data, category) => {
      if (data.lastMonth > 50 && data.thisMonth > data.lastMonth * 1.5) {
        const increase = ((data.thisMonth - data.lastMonth) / data.lastMonth) * 100;
        generated.push({
          id: `cat-spike-${category}`,
          title: `${category} Spending Up`,
          description: `Your ${category.toLowerCase()} spending increased by ${increase.toFixed(0)}% this month (€${data.thisMonth.toFixed(0)} vs €${data.lastMonth.toFixed(0)} last month).`,
          priority: "high",
          icon: <TrendingUp className="h-5 w-5 text-red-500" />,
          category: "trend",
        });
      }
    });

    // 4. Frequent merchant insight (MEDIUM)
    if (topMerchant && topMerchant[1] >= 5) {
      const merchantTotal = expenses
        .filter((t) => t.merchant === topMerchant[0])
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      generated.push({
        id: "top-merchant",
        title: "Frequent Spender",
        description: `You've made ${topMerchant[1]} purchases at ${topMerchant[0]}, totaling €${merchantTotal.toFixed(0)}. Consider if these are necessary expenses.`,
        priority: "medium",
        icon: <Repeat className="h-5 w-5 text-blue-500" />,
        category: "spending",
      });
    }

    // 5. Peak spending day (LOW)
    if (dayTotals[maxDayIndex] > 0) {
      generated.push({
        id: "peak-day",
        title: "Your Spending Pattern",
        description: `${dayNames[maxDayIndex]}s are your highest spending days. Plan ahead and set a budget for these days.`,
        priority: "low",
        icon: <Lightbulb className="h-5 w-5 text-amber-500" />,
        category: "trend",
      });
    }

    // 6. Large transactions (MEDIUM)
    const avgTransaction = thisMonthTotal / (thisMonthExpenses.length || 1);
    const largeTransactions = thisMonthExpenses.filter((t) => Math.abs(t.amount) > avgTransaction * 3);
    if (largeTransactions.length > 0) {
      const largest = largeTransactions.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
      generated.push({
        id: "large-tx",
        title: "Large Purchase Detected",
        description: `You made a €${Math.abs(largest.amount).toFixed(0)} purchase at ${largest.merchant || "Unknown"}. Make sure this was planned.`,
        priority: "medium",
        icon: <Target className="h-5 w-5 text-info" />,
        category: "spending",
      });
    }

    // 7. Subscription-like spending (LOW)
    const potentialSubs = new Map<string, number[]>();
    expenses.forEach((t) => {
      const key = `${t.merchant}-${Math.round(Math.abs(t.amount))}`;
      const dates = potentialSubs.get(key) || [];
      dates.push(new Date(t.date).getTime());
      potentialSubs.set(key, dates);
    });
    potentialSubs.forEach((dates, key) => {
      if (dates.length >= 2) {
        const sortedDates = dates.sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sortedDates.length; i++) {
          gaps.push(differenceInDays(sortedDates[i], sortedDates[i - 1]));
        }
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (avgGap >= 25 && avgGap <= 35 && gaps.length >= 2) {
          const [merchant] = key.split("-");
          generated.push({
            id: `sub-${key}`,
            title: "Possible Subscription",
            description: `${merchant} looks like a monthly subscription. Review if you still need this service.`,
            priority: "low",
            icon: <Repeat className="h-5 w-5 text-blue-500" />,
            category: "spending",
          });
        }
      }
    });

    // 8. Dining out pattern (MEDIUM)
    const diningCategories = ["Restaurants", "Food & Dining", "Fast Food"];
    const diningTotal = thisMonthExpenses
      .filter((t) => diningCategories.includes(t.category))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    if (diningTotal > thisMonthTotal * 0.2) {
      generated.push({
        id: "dining-high",
        title: "High Dining Expenses",
        description: `${((diningTotal / thisMonthTotal) * 100).toFixed(0)}% of your spending is on dining out (€${diningTotal.toFixed(0)}). Cooking at home could save you money.`,
        priority: "medium",
        icon: <TrendingDown className="h-5 w-5 text-amber-500" />,
        category: "saving",
        actionText: "See meal budget tips",
      });
    }

    // Sort by priority
    const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 };
    generated.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return generated.slice(0, 8); // Max 8 insights
  }, [transactions]);

  const goToPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goToNext = () => setCurrentIndex((i) => Math.min(insights.length - 1, i + 1));

  const currentInsight = insights[currentIndex];

  const priorityColors: Record<InsightPriority, string> = {
    high: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800",
    medium: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    low: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  };

  if (insights.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Personal Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[150px] text-muted-foreground">
            <Lightbulb className="h-8 w-8 mb-2 opacity-50" />
            <p>Not enough data to generate insights</p>
            <p className="text-sm">Keep tracking your expenses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Personal Insights
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentIndex + 1} / {insights.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNext}
              disabled={currentIndex === insights.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currentInsight && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                {currentInsight.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{currentInsight.title}</h4>
                  <Badge
                    variant="outline"
                    className={cn("text-xs capitalize", priorityColors[currentInsight.priority])}
                  >
                    {currentInsight.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentInsight.description}
                </p>
              </div>
            </div>
            {currentInsight.actionText && (
              <Button variant="outline" size="sm" className="w-full mt-2">
                {currentInsight.actionText}
              </Button>
            )}
          </div>
        )}

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {insights.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
