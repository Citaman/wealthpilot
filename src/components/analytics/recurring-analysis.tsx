"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { format, parseISO, isSameMonth, startOfMonth, eachMonthOfInterval } from "date-fns";
import { Repeat, TrendingUp, Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { ClientOnly } from "@/components/ui/client-only";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

interface RecurringAnalysisProps {
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
  className?: string;
}

interface RecurringItem {
  merchant: string;
  category: string;
  amount: number;
  frequency: number;
  color: string;
}

export function RecurringAnalysis({
  transactions,
  startDate,
  endDate,
  className,
}: RecurringAnalysisProps) {
  const recurringStats = useMemo(() => {
    // Filter recurring transactions
    const recurringTx = transactions.filter(
      (tx) => tx.isRecurring && tx.direction === "debit"
    );

    // Count months in range
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const monthCount = months.length || 1;

    // Group by merchant and calculate monthly average
    const merchantMap = new Map<string, { amount: number; count: number; category: string }>();

    recurringTx.forEach((tx) => {
      const current = merchantMap.get(tx.merchant) || { amount: 0, count: 0, category: tx.category };
      current.amount += Math.abs(tx.amount);
      current.count += 1;
      merchantMap.set(tx.merchant, current);
    });

    const items: RecurringItem[] = Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({
        merchant,
        category: data.category,
        amount: data.amount / monthCount, // Monthly average
        frequency: data.count / monthCount, // Times per month
        color: CATEGORIES[data.category]?.color || "#6b7280",
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate totals
    const monthlyTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const yearlyTotal = monthlyTotal * 12;

    // Group by category for chart
    const categoryMap = new Map<string, number>();
    items.forEach((item) => {
      const current = categoryMap.get(item.category) || 0;
      categoryMap.set(item.category, current + item.amount);
    });

    const categoryData = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        color: CATEGORIES[category]?.color || "#6b7280",
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      items,
      monthlyTotal,
      yearlyTotal,
      categoryData,
      count: items.length,
    };
  }, [transactions, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-sm">
          <span className="font-medium">{formatCurrency(payload[0]?.value || 0)}</span>
          <span className="text-muted-foreground"> / month</span>
        </p>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Recurring Expenses
            </CardTitle>
            <CardDescription>
              {recurringStats.count} subscriptions & bills detected
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {recurringStats.items.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No recurring expenses detected
          </div>
        ) : (
          <>
            {/* Monthly Total */}
            <div className="text-center mb-6 p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Monthly Recurring</p>
              <p className="text-4xl font-bold">{formatCurrency(recurringStats.monthlyTotal)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                = {formatCurrency(recurringStats.yearlyTotal)} / year
              </p>
            </div>

            {/* Category Breakdown Chart */}
            <div className="h-[200px] mb-6">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={recurringStats.categoryData}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 70, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `€${(v / 1).toFixed(0)}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {recurringStats.categoryData.map((entry, index) => (
                        <Bar key={index} dataKey="amount" fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>

            {/* Top Recurring Items */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Largest Recurring</h4>
              {recurringStats.items.slice(0, 5).map((item) => (
                <div
                  key={item.merchant}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <p className="font-medium text-sm">{item.merchant}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Yearly Impact */}
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span className="text-sm">
                  Your recurring expenses cost you{" "}
                  <strong className="text-amber-700 dark:text-amber-400">
                    {formatCurrency(recurringStats.yearlyTotal)}
                  </strong>{" "}
                  per year
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
