"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { ClientOnly } from "@/components/ui/client-only";
import { format, parseISO, subMonths, isSameMonth } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown, ChevronDown, LayoutGrid, PieChartIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface MonthComparisonProps {
  transactions: Transaction[];
  className?: string;
}

type ViewMode = "overview" | "breakdown";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  prevAmount: number;
  change: number;
  [key: string]: string | number;
}

export function MonthComparison({ transactions, className }: MonthComparisonProps) {
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const { convertFromAccount } = useMoney();
  
  // Generate available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((tx) => {
      months.add(format(parseISO(tx.date), "yyyy-MM"));
    });
    return Array.from(months)
      .sort()
      .reverse()
      .slice(0, 12)
      .map((m) => ({
        value: m,
        label: format(new Date(m + "-01"), "MMMM yyyy"),
      }));
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0]?.value || format(now, "yyyy-MM"));

  // Calculate data for selected month and previous month
  const monthData = useMemo(() => {
    const selectedDate = new Date(selectedMonth + "-01");
    const prevDate = subMonths(selectedDate, 1);
    const prevMonth = format(prevDate, "yyyy-MM");

    const selectedTx = transactions.filter(
      (tx) => tx.direction === "debit" && isSameMonth(parseISO(tx.date), selectedDate)
    );
    const prevTx = transactions.filter(
      (tx) => tx.direction === "debit" && isSameMonth(parseISO(tx.date), prevDate)
    );

    // Income
    const selectedIncome = transactions
      .filter((tx) => tx.direction === "credit" && isSameMonth(parseISO(tx.date), selectedDate))
      .reduce((sum, tx) => sum + convertFromAccount(tx.amount, tx.accountId), 0);
    const prevIncome = transactions
      .filter((tx) => tx.direction === "credit" && isSameMonth(parseISO(tx.date), prevDate))
      .reduce((sum, tx) => sum + convertFromAccount(tx.amount, tx.accountId), 0);

    // Total expenses
    const selectedTotal = selectedTx.reduce((sum, tx) => sum + Math.abs(convertFromAccount(tx.amount, tx.accountId)), 0);
    const prevTotal = prevTx.reduce((sum, tx) => sum + Math.abs(convertFromAccount(tx.amount, tx.accountId)), 0);

    // Net
    const selectedNet = selectedIncome - selectedTotal;
    const prevNet = prevIncome - prevTotal;

    // By category
    const categoryMap = new Map<string, { amount: number; prevAmount: number }>();

    selectedTx.forEach((tx) => {
      const current = categoryMap.get(tx.category) || { amount: 0, prevAmount: 0 };
      current.amount += Math.abs(convertFromAccount(tx.amount, tx.accountId));
      categoryMap.set(tx.category, current);
    });

    prevTx.forEach((tx) => {
      const current = categoryMap.get(tx.category) || { amount: 0, prevAmount: 0 };
      current.prevAmount += Math.abs(convertFromAccount(tx.amount, tx.accountId));
      categoryMap.set(tx.category, current);
    });

    const categories: CategoryData[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: selectedTotal > 0 ? (data.amount / selectedTotal) * 100 : 0,
        color: CATEGORIES[category]?.color || "#6b7280",
        prevAmount: data.prevAmount,
        change: data.prevAmount > 0 ? ((data.amount - data.prevAmount) / data.prevAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    const expenseChange = prevTotal > 0 ? ((selectedTotal - prevTotal) / prevTotal) * 100 : 0;
    const incomeChange = prevIncome > 0 ? ((selectedIncome - prevIncome) / prevIncome) * 100 : 0;

    return {
      selectedMonth,
      prevMonth,
      selectedLabel: format(selectedDate, "MMMM yyyy"),
      prevLabel: format(prevDate, "MMM"),
      income: selectedIncome,
      prevIncome,
      expenses: selectedTotal,
      prevExpenses: prevTotal,
      net: selectedNet,
      prevNet,
      expenseChange,
      incomeChange,
      categories,
    };
  }, [transactions, selectedMonth, convertFromAccount]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload as CategoryData;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg">
        <p className="font-medium mb-2">{data.category}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">This month</span>
            <span className="font-bold">
              <Money amount={data.amount} />
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Last month</span>
            <span className="font-medium">
              <Money amount={data.prevAmount} />
            </span>
          </div>
          {data.prevAmount > 0 && (
            <div className={cn(
              "flex justify-between gap-4 pt-1 border-t border-border",
              data.change > 0 ? "text-red-500" : "text-emerald-500"
            )}>
              <span>Change</span>
              <span className="font-medium">
                {data.change > 0 ? "+" : ""}{data.change.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ChangeIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const color = isPositive ? "text-emerald-500" : value === 0 ? "text-muted-foreground" : "text-red-500";
    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

    return (
      <div className={cn("flex items-center gap-0.5 text-sm font-medium", color)}>
        <Icon className="h-4 w-4" />
        {Math.abs(value).toFixed(0)}%
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Month Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "overview" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2"
                onClick={() => setViewMode("overview")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "breakdown" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-2"
                onClick={() => setViewMode("breakdown")}
              >
                <PieChartIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "overview" ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-muted-foreground mb-1">Income</p>
                <p className="text-lg font-bold text-emerald-500">
                  <Money amount={monthData.income} />
                </p>
                <ChangeIndicator value={monthData.incomeChange} />
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-muted-foreground mb-1">Expenses</p>
                <p className="text-lg font-bold text-red-500">
                  <Money amount={monthData.expenses} />
                </p>
                <ChangeIndicator value={monthData.expenseChange} inverse />
              </div>
              <div className={cn(
                "p-3 rounded-lg border",
                monthData.net >= 0 
                  ? "bg-blue-500/10 border-blue-500/20" 
                  : "bg-amber-500/10 border-amber-500/20"
              )}>
                <p className="text-xs text-muted-foreground mb-1">Net</p>
                <p className={cn(
                  "text-lg font-bold",
                  monthData.net >= 0 ? "text-blue-500" : "text-amber-500"
                )}>
                  <Money amount={monthData.net} />
                </p>
                <p className="text-xs text-muted-foreground">
                  vs <Money amount={monthData.prevNet} />
                </p>
              </div>
            </div>

            {/* Top Categories Bar Chart */}
            <div>
              <p className="text-sm font-medium mb-3">Top Categories</p>
              <div className="h-[140px]">
                  <ClientOnly>
                    <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={monthData.categories.slice(0, 5)} 
                    layout="vertical"
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="category" 
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      className="fill-muted-foreground"
                      width={80}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {monthData.categories.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                  </ClientOnly>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Donut Chart + Category List */}
            <div className="flex gap-4">
              <div className="w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={monthData.categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="amount"
                    >
                      {monthData.categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {monthData.categories.slice(0, 6).map((cat) => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs flex-1 truncate">{cat.category}</span>
                    <span className="text-xs font-medium">
                      <Money amount={cat.amount} />
                    </span>
                    <span className={cn(
                      "text-[10px] w-10 text-right",
                      cat.change > 0 ? "text-red-500" : "text-emerald-500"
                    )}>
                      {cat.prevAmount > 0 ? (cat.change > 0 ? "+" : "") + cat.change.toFixed(0) + "%" : "new"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Progress Bars */}
            <div className="pt-3 border-t space-y-2">
              <p className="text-xs text-muted-foreground mb-2">vs Previous Month</p>
              {monthData.categories.slice(0, 4).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{cat.category}</span>
                    <span className={cn(
                      "font-medium",
                      cat.change > 0 ? "text-red-500" : cat.change < 0 ? "text-emerald-500" : ""
                    )}>
                      {cat.change > 0 ? "+" : ""}{cat.change.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div 
                      className="bg-muted-foreground/30 rounded-full h-full"
                      style={{ 
                        width: `${Math.min(100, (cat.prevAmount / Math.max(cat.amount, cat.prevAmount)) * 100)}%` 
                      }}
                    />
                    <div 
                      className="rounded-full h-full"
                      style={{ 
                        backgroundColor: cat.color,
                        width: `${Math.min(100, (cat.amount / Math.max(cat.amount, cat.prevAmount)) * 100)}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
