"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth, eachMonthOfInterval } from "date-fns";
import { LineChart as LineChartIcon, Eye, EyeOff } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { ClientOnly } from "@/components/ui/client-only";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface CategoryTrendsProps {
  transactions: Transaction[];
  className?: string;
}

interface CategoryData {
  category: string;
  color: string;
  visible: boolean;
  total: number;
  monthlyData: number[];
}

const CATEGORY_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#f97316", "#ef4444", "#6366f1", "#84cc16",
];

export function CategoryTrends({ transactions, className }: CategoryTrendsProps) {
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const { convertFromAccount, formatCompactCurrency } = useMoney();

  const { chartData, categories, months } = useMemo(() => {
    const now = new Date();
    const monthsToShow = 6;
    const monthStart = subMonths(startOfMonth(now), monthsToShow - 1);
    const monthsInterval = eachMonthOfInterval({ start: monthStart, end: now });
    const monthLabels = monthsInterval.map((m) => format(m, "MMM"));
    const monthKeys = monthsInterval.map((m) => format(m, "yyyy-MM"));

    // Get expense transactions only
    const expenses = transactions.filter((t) => t.direction === "debit");

    // Collect unique categories with spending
    const categoryMap = new Map<string, number[]>();
    const categoryTotals = new Map<string, number>();

    expenses.forEach((tx) => {
      if (!categoryMap.has(tx.category)) {
        categoryMap.set(tx.category, new Array(monthsToShow).fill(0));
        categoryTotals.set(tx.category, 0);
      }
      const monthKey = tx.date.slice(0, 7);
      const monthIdx = monthKeys.indexOf(monthKey);
      if (monthIdx >= 0) {
        const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
        categoryMap.get(tx.category)![monthIdx] += amount;
        categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + amount);
      }
    });

    // Build categories list sorted by total
    const cats: CategoryData[] = Array.from(categoryMap.entries())
      .map(([category, monthlyData], idx) => ({
        category,
        color: CATEGORIES[category]?.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        visible: true,
        total: categoryTotals.get(category) || 0,
        monthlyData,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);

    // Build chart data
    const data = monthLabels.map((month, idx) => {
      const point: Record<string, number | string> = { month };
      cats.forEach((cat) => {
        point[cat.category] = cat.monthlyData[idx];
      });
      return point;
    });

    return { chartData: data, categories: cats, months: monthLabels };
  }, [transactions, convertFromAccount]);

  // Initialize visible categories to top 5
  useEffect(() => {
    if (!initialized && categories.length > 0) {
      const topFive = categories.slice(0, 5).map((c) => c.category);
      setVisibleCategories(new Set(topFive));
      setInitialized(true);
    }
  }, [categories, initialized]);

  const toggleCategory = (category: string) => {
    const newSet = new Set(visibleCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setVisibleCategories(newSet);
  };

  const showAll = () => setVisibleCategories(new Set(categories.map((c) => c.category)));
  const hideAll = () => setVisibleCategories(new Set());

  const formatYAxis = (value: number) => formatCompactCurrency(value);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);

    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg max-w-[200px]">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1.5">
          {sorted.map((item: any) => (
            <div key={item.dataKey} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate max-w-[100px]">{item.dataKey}</span>
              </div>
              <Money amount={item.value} className="font-medium" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn("col-span-2", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Category Trends
            </CardTitle>
            <CardDescription>Track spending by category over time</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={showAll} className="text-xs">
              <Eye className="h-3 w-3 mr-1" /> All
            </Button>
            <Button variant="ghost" size="sm" onClick={hideAll} className="text-xs">
              <EyeOff className="h-3 w-3 mr-1" /> None
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No expense data available
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Chart */}
            <div className="flex-1 h-[280px]">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatYAxis}
                      className="fill-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {categories.map((cat) => (
                      visibleCategories.has(cat.category) && (
                        <Line
                          key={cat.category}
                          type="monotone"
                          dataKey={cat.category}
                          stroke={cat.color}
                          strokeWidth={2}
                          dot={{ fill: cat.color, strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>

            {/* Category selector */}
            <ScrollArea className="w-[180px] h-[280px] border-l pl-4">
              <div className="space-y-2 pr-2">
                {categories.map((cat) => (
                  <label
                    key={cat.category}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <Checkbox
                      checked={visibleCategories.has(cat.category)}
                      onCheckedChange={() => toggleCategory(cat.category)}
                      className="h-4 w-4"
                    />
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-foreground">
                        {cat.category}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        <Money amount={cat.total} />
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
