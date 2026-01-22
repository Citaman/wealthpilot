"use client";

import { useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format, parseISO, eachDayOfInterval, isSameDay, subDays, subMonths, subYears } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { ClientOnly } from "@/components/ui/client-only";

interface BalanceTimelineProps {
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
  className?: string;
}

type ViewPeriod = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

interface BalanceDataPoint {
  date: string;
  displayDate: string;
  balance: number;
  isLow: boolean;
  isSalaryDay: boolean;
  dayBeforeSalary: boolean;
}

export function BalanceTimeline({
  transactions,
  startDate,
  endDate,
  className,
}: BalanceTimelineProps) {
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>("6m");

  // Calculate date range based on view period
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    switch (viewPeriod) {
      case "1w":
        return { start: subDays(now, 7), end: now };
      case "1m":
        return { start: subMonths(now, 1), end: now };
      case "3m":
        return { start: subMonths(now, 3), end: now };
      case "6m":
        return { start: subMonths(now, 6), end: now };
      case "1y":
        return { start: subYears(now, 1), end: now };
      case "all":
        return { start: startDate, end: endDate };
      default:
        return { start: subMonths(now, 6), end: now };
    }
  }, [viewPeriod, startDate, endDate]);

  // Detect salary days (large income, typically around same date each month)
  const salaryDays = useMemo(() => {
    const uniqueByDate = new Map<string, Date>();
    transactions
      .filter((t) => t.direction === "credit" && t.amount > 1000)
      .forEach((t) => {
        uniqueByDate.set(t.date, parseISO(t.date));
      });

    return Array.from(uniqueByDate.values()).sort((a, b) => a.getTime() - b.getTime());
  }, [transactions]);

  const balanceData = useMemo(() => {
    // Filter transactions in range
    const rangeTransactions = transactions.filter((t) => {
      const txDate = parseISO(t.date);
      return txDate >= effectiveDateRange.start && txDate <= effectiveDateRange.end;
    });

    if (rangeTransactions.length === 0) return [];

    // Sort transactions
    const sortedTx = [...rangeTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Generate all days in range
    const days = eachDayOfInterval({
      start: effectiveDateRange.start,
      end: effectiveDateRange.end,
    });

    // Build daily balance data
    const data: BalanceDataPoint[] = [];
    let runningBalance = 0;

    // Get initial balance from first transaction
    if (sortedTx.length > 0 && sortedTx[0].balanceAfter !== undefined) {
      const firstTx = sortedTx[0];
      runningBalance = firstTx.balanceAfter - (firstTx.direction === "credit" ? firstTx.amount : -firstTx.amount);
    }

    days.forEach((day) => {
      const dayTx = sortedTx.filter((tx) => isSameDay(parseISO(tx.date), day));
      
      // Apply transactions for this day
      dayTx.forEach((tx) => {
        if (tx.direction === "credit") {
          runningBalance += tx.amount;
        } else {
          runningBalance -= Math.abs(tx.amount);
        }
        // Use actual balance if available
        if (tx.balanceAfter !== undefined && tx.balanceAfter !== 0) {
          runningBalance = tx.balanceAfter;
        }
      });

      // Check if this is a salary day
      const isSalaryDay = salaryDays.some((sd) => isSameDay(sd, day));
      
      // Check if tomorrow is a salary day (this is the day before salary = potential low)
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const dayBeforeSalary = salaryDays.some((sd) => isSameDay(sd, nextDay));

      data.push({
        date: format(day, "yyyy-MM-dd"),
        displayDate: format(day, "MMM d"),
        balance: runningBalance,
        isLow: false, // Will be calculated below
        isSalaryDay,
        dayBeforeSalary,
      });
    });

    // Find monthly lows (balance just before salary)
    const monthlyLows = new Map<string, number>();
    data.forEach((point) => {
      if (point.dayBeforeSalary) {
        const monthKey = format(parseISO(point.date), "yyyy-MM");
        const currentLow = monthlyLows.get(monthKey);
        if (currentLow === undefined || point.balance < currentLow) {
          monthlyLows.set(monthKey, point.balance);
        }
      }
    });

    // Mark low points
    data.forEach((point) => {
      if (point.dayBeforeSalary) {
        const monthKey = format(parseISO(point.date), "yyyy-MM");
        point.isLow = point.balance === monthlyLows.get(monthKey);
      }
    });

    return data;
  }, [transactions, effectiveDateRange, salaryDays]);

  const stats = useMemo(() => {
    if (balanceData.length === 0) {
      return { min: 0, max: 0, avg: 0, current: 0, trend: 0, lowestBeforeSalary: 0 };
    }

    const balances = balanceData.map((d) => d.balance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const avg = balances.reduce((a, b) => a + b, 0) / balances.length;
    const current = balances[balances.length - 1];

    // Find lowest balance before salary (all-time low when funds are at their lowest)
    const lowsBeforeSalary = balanceData.filter((d) => d.dayBeforeSalary).map((d) => d.balance);
    const lowestBeforeSalary = lowsBeforeSalary.length > 0 ? Math.min(...lowsBeforeSalary) : min;

    // Calculate trend
    const midPoint = Math.floor(balances.length / 2);
    const firstHalf = balances.slice(0, midPoint);
    const secondHalf = balances.slice(midPoint);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
    const trend = firstAvg !== 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;

    return { min, max, avg, current, trend, lowestBeforeSalary };
  }, [balanceData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltip that follows cursor
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload as BalanceDataPoint;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg">
        <p className="font-medium mb-1">{format(parseISO(data.date), "EEEE, MMMM d, yyyy")}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-6">
            <span className="text-muted-foreground">Balance</span>
            <span className={cn(
              "font-bold text-lg",
              data.balance >= 0 ? "text-blue-500" : "text-red-500"
            )}>
              <PrivacyBlur>{formatCurrency(data.balance)}</PrivacyBlur>
            </span>
          </div>
          {data.isSalaryDay && (
            <div className="text-emerald-500 text-xs font-medium pt-1 border-t border-border">
              💰 Salary Day
            </div>
          )}
          {data.dayBeforeSalary && (
            <div className="text-amber-500 text-xs font-medium pt-1 border-t border-border">
              ⚠️ Day before salary (month low)
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom dot to highlight special days
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;

    // Show dot for salary days and days before salary
    if (payload.isSalaryDay) {
      return (
        <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#fff" strokeWidth={2} />
      );
    }
    if (payload.dayBeforeSalary && payload.isLow) {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
      );
    }
    return null;
  };

  const TrendIcon = stats.trend > 5 ? TrendingUp : stats.trend < -5 ? TrendingDown : Minus;
  const trendColor = stats.trend > 5 ? "text-emerald-500" : stats.trend < -5 ? "text-red-500" : "text-muted-foreground";

  // Format x-axis based on period
  const formatXAxis = useCallback((value: string) => {
    const date = parseISO(value);
    switch (viewPeriod) {
      case "1w":
        return format(date, "EEE");
      case "1m":
        return format(date, "d");
      case "3m":
      case "6m":
        return format(date, "MMM d");
      case "1y":
      case "all":
        return format(date, "MMM yy");
      default:
        return format(date, "MMM d");
    }
  }, [viewPeriod]);

  // Determine tick interval based on data length
  const tickInterval = useMemo(() => {
    const len = balanceData.length;
    if (len <= 7) return 0;
    if (len <= 31) return Math.floor(len / 8);
    if (len <= 90) return Math.floor(len / 10);
    return Math.floor(len / 12);
  }, [balanceData.length]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Balance Over Time</CardTitle>
          </div>
          <Tabs value={viewPeriod} onValueChange={(v) => setViewPeriod(v as ViewPeriod)}>
            <TabsList className="h-8">
              <TabsTrigger value="1w" className="text-xs px-2">1W</TabsTrigger>
              <TabsTrigger value="1m" className="text-xs px-2">1M</TabsTrigger>
              <TabsTrigger value="3m" className="text-xs px-2">3M</TabsTrigger>
              <TabsTrigger value="6m" className="text-xs px-2">6M</TabsTrigger>
              <TabsTrigger value="1y" className="text-xs px-2">1Y</TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {balanceData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-muted-foreground">
            No balance data available
          </div>
        ) : (
          <>
            <div className="h-[280px] relative">
              <ClientOnly>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={balanceData} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                    tickFormatter={formatXAxis}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                    className="fill-muted-foreground"
                    domain={['dataMin - 100', 'dataMax + 100']}
                  />
                  
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'currentColor', strokeOpacity: 0.2, strokeDasharray: '3 3' }}
                  />
                  
                  {/* Reference line at 0 */}
                  <ReferenceLine 
                    y={0} 
                    stroke="currentColor" 
                    strokeOpacity={0.3} 
                    strokeDasharray="3 3" 
                  />
                  
                  {/* Average line */}
                  <ReferenceLine 
                    y={stats.avg} 
                    stroke="#8b5cf6" 
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                  />

                  {/* Balance line with dots */}
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                  />
                  </LineChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Salary Day</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Low Before Salary</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }} />
                <span>Average</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lowest</p>
                <p className={cn("text-sm font-bold", stats.min < 0 ? "text-red-500" : "text-foreground")}>
                  <PrivacyBlur>{formatCurrency(stats.min)}</PrivacyBlur>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Highest</p>
                <p className="text-sm font-bold text-emerald-500">
                  <PrivacyBlur>{formatCurrency(stats.max)}</PrivacyBlur>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
                <p className="text-sm font-bold text-purple-500">
                  <PrivacyBlur>{formatCurrency(stats.avg)}</PrivacyBlur>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</p>
                <p className="text-sm font-bold text-blue-500">
                  <PrivacyBlur>{formatCurrency(stats.current)}</PrivacyBlur>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pre-Salary Low</p>
                <p className={cn("text-sm font-bold", stats.lowestBeforeSalary < 500 ? "text-amber-500" : "text-foreground")}>
                  <PrivacyBlur>{formatCurrency(stats.lowestBeforeSalary)}</PrivacyBlur>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trend</p>
                <div className={cn("flex items-center justify-center gap-0.5", trendColor)}>
                  <TrendIcon className="h-3 w-3" />
                  <span className="text-sm font-bold">
                    {stats.trend > 0 ? "+" : ""}{stats.trend.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
