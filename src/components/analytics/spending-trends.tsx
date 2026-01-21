"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { format, parseISO, startOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

interface SpendingTrendsProps {
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
  className?: string;
}

interface TrendDataPoint {
  month: string;
  amount: number;
  isCurrentMonth: boolean;
  isBelowAvg: boolean;
}

export function SpendingTrends({
  transactions,
  startDate,
  endDate,
  className,
}: SpendingTrendsProps) {
  const trendData = useMemo(() => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const now = new Date();
    
    const data: TrendDataPoint[] = months.map((monthStart) => {
      const monthTx = transactions.filter(
        (tx) =>
          tx.direction === "debit" &&
          isSameMonth(parseISO(tx.date), monthStart)
      );

      const amount = monthTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const isCurrentMonth = isSameMonth(monthStart, now);

      return {
        month: format(monthStart, "MMM"),
        amount,
        isCurrentMonth,
        isBelowAvg: false, // Will be set below
      };
    });

    // Calculate average and mark below average months
    const avg = data.reduce((sum, d) => sum + d.amount, 0) / data.length;
    data.forEach((d) => {
      d.isBelowAvg = d.amount < avg;
    });

    return { data, avg };
  }, [transactions, startDate, endDate]);

  const stats = useMemo(() => {
    const { data, avg } = trendData;
    if (data.length < 2) {
      return { 
        trend: "flat" as const, 
        percentage: 0, 
        description: "Not enough data",
        min: 0,
        max: 0,
        avg: 0,
        current: 0,
      };
    }

    const recent = data.slice(-3);
    const older = data.slice(-6, -3);

    const recentAvg = recent.reduce((sum, d) => sum + d.amount, 0) / recent.length;
    const olderAvg = older.length > 0
      ? older.reduce((sum, d) => sum + d.amount, 0) / older.length
      : recentAvg;

    const change = olderAvg !== 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    let trend: "up" | "down" | "flat";
    if (change > 5) trend = "up";
    else if (change < -5) trend = "down";
    else trend = "flat";

    const min = Math.min(...data.map((d) => d.amount));
    const max = Math.max(...data.map((d) => d.amount));
    const current = data[data.length - 1]?.amount || 0;

    return {
      trend,
      percentage: Math.abs(change),
      min,
      max,
      avg,
      current,
      description: trend === "up"
        ? `Up ${Math.abs(change).toFixed(0)}% vs prior period`
        : trend === "down"
        ? `Down ${Math.abs(change).toFixed(0)}% vs prior period`
        : "Stable spending pattern",
    };
  }, [trendData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload as TrendDataPoint;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg">
        <p className="font-medium mb-2">{label}</p>
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">Spent</span>
          <span className="font-bold">{formatCurrency(data.amount)}</span>
        </div>
        {data.isBelowAvg && (
          <p className="text-xs text-emerald-500 mt-1">✓ Below average</p>
        )}
        {data.isCurrentMonth && (
          <p className="text-xs text-blue-500 mt-1">Current month (partial)</p>
        )}
      </div>
    );
  };

  const TrendIcon = stats.trend === "up" ? TrendingUp : stats.trend === "down" ? TrendingDown : Minus;
  const trendConfig = {
    up: { color: "text-red-500", bg: "bg-red-500/10", label: "Increasing" },
    down: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Decreasing" },
    flat: { color: "text-muted-foreground", bg: "bg-muted", label: "Stable" },
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Spending Trends
            </CardTitle>
            <CardDescription>Monthly spending pattern</CardDescription>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium",
            trendConfig[stats.trend].color,
            trendConfig[stats.trend].bg
          )}>
            <TrendIcon className="h-4 w-4" />
            {trendConfig[stats.trend].label}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData.data} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
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
                tickFormatter={formatCompact}
                className="fill-muted-foreground"
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
              
              {/* Average reference line */}
              <ReferenceLine 
                y={trendData.avg} 
                stroke="#8b5cf6" 
                strokeDasharray="4 4" 
                strokeOpacity={0.6}
              />
              
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {trendData.data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isCurrentMonth 
                      ? "#3b82f6" 
                      : entry.isBelowAvg 
                      ? "#22c55e" 
                      : "#ef4444"
                    }
                    fillOpacity={entry.isCurrentMonth ? 0.7 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Min</p>
            <p className="text-sm font-semibold text-emerald-500">{formatCurrency(stats.min)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Avg</p>
            <p className="text-sm font-semibold text-purple-500">{formatCurrency(stats.avg)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Max</p>
            <p className="text-sm font-semibold text-red-500">{formatCurrency(stats.max)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Now</p>
            <p className="text-sm font-semibold text-blue-500">{formatCurrency(stats.current)}</p>
          </div>
        </div>

        {/* Trend insight */}
        <div className={cn(
          "mt-3 p-2.5 rounded-lg text-sm",
          trendConfig[stats.trend].bg
        )}>
          <div className="flex items-center gap-2">
            <TrendIcon className={cn("h-4 w-4", trendConfig[stats.trend].color)} />
            <span className={trendConfig[stats.trend].color}>
              {stats.description}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
