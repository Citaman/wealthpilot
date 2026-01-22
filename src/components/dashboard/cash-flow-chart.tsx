"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, CATEGORIES } from "@/lib/db";
import { ClientOnly } from "@/components/ui/client-only";
import { Money } from "@/components/ui/money";
import {
  format,
  subMonths,
  addMonths,
  subWeeks,
  addWeeks,
  subDays,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfYear,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
} from "date-fns";
import { useMoney } from "@/hooks/use-money";

// Period options
type PeriodType = "6M" | "1Y" | "YTD" | "3M" | "weekly" | "daily";

interface PeriodOption {
  label: string;
  value: PeriodType;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "This Year", value: "YTD" },
  { label: "Last 12 Months", value: "1Y" },
  { label: "Last 6 Months", value: "6M" },
  { label: "Last 3 Months", value: "3M" },
  { label: "Weekly View", value: "weekly" },
  { label: "Daily View", value: "daily" },
];

// Category colors for stacked bars
const INCOME_COLORS = [
  "#3b82f6", // blue - Salary
  "#8b5cf6", // purple - Other income
  "#06b6d4", // cyan - Transfers in
];

const EXPENSE_COLORS = [
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f97316", // orange
];

interface ChartDataPoint {
  name: string;
  fullDate: string;
  incomeSalary: number;
  incomeTransfers: number;
  incomeOther: number;
  totalIncome: number;
  totalExpenses: number;
  [key: string]: number | string;
}

export function CashFlowChart() {
  const [period, setPeriod] = useState<PeriodType>("3M");
  const [showCategories, setShowCategories] = useState(false);
  const [offset, setOffset] = useState(0); // For navigation (0 = current, 1 = previous period, etc.)
  const { convertFromAccount, formatCompactCurrency } = useMoney();

  // Calculate date range based on period and offset
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case "YTD":
        // Offset by years
        const yearDate = subMonths(now, offset * 12);
        start = startOfYear(yearDate);
        end = offset === 0 ? endOfDay(now) : endOfMonth(subMonths(addMonths(start, 11), 0));
        break;
      case "1Y":
        start = subMonths(now, 11 + offset * 12);
        start = startOfMonth(start);
        end = offset === 0 ? endOfDay(now) : endOfMonth(addMonths(start, 11));
        break;
      case "6M":
        start = subMonths(now, 5 + offset * 6);
        start = startOfMonth(start);
        end = offset === 0 ? endOfDay(now) : endOfMonth(addMonths(start, 5));
        break;
      case "3M":
        start = subMonths(now, 2 + offset * 3);
        start = startOfMonth(start);
        end = offset === 0 ? endOfDay(now) : endOfMonth(addMonths(start, 2));
        break;
      case "weekly":
        // Show 4 weeks at a time, offset by 4 weeks
        start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 3 + offset * 4);
        end = offset === 0 ? endOfDay(now) : endOfWeek(addWeeks(start, 3), { weekStartsOn: 1 });
        break;
      case "daily":
        // Show 7 days at a time, offset by 7 days
        start = subDays(startOfDay(now), 6 + offset * 7);
        end = offset === 0 ? endOfDay(now) : endOfDay(addDays(start, 6));
        break;
      default:
        start = subMonths(now, 5);
        start = startOfMonth(start);
        end = endOfDay(now);
    }

    return {
      start,
      end,
      startStr: format(start, "yyyy-MM-dd"),
      endStr: format(end, "yyyy-MM-dd"),
    };
  }, [period, offset]);

  // Fetch transactions for the date range
  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("date")
        .between(dateRange.startStr, dateRange.endStr, true, true)
        .toArray(),
    [dateRange.startStr, dateRange.endStr]
  );

  // Process data for chart
  const { chartData, expenseCategories, maxValue } = useMemo(() => {
    if (!transactions) {
      return { chartData: [], incomeCategories: [], expenseCategories: [], maxValue: 1000 };
    }

    // Determine time buckets based on period
    let intervals: Date[];
    let formatLabel: (d: Date) => string;
    let formatFull: (d: Date) => string;
    let getBucket: (dateStr: string) => string;

    if (period === "daily") {
      intervals = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      formatLabel = (d) => format(d, "EEE");
      formatFull = (d) => format(d, "EEEE, MMM d, yyyy");
      getBucket = (dateStr) => dateStr;
    } else if (period === "weekly") {
      intervals = eachWeekOfInterval(
        { start: dateRange.start, end: dateRange.end },
        { weekStartsOn: 1 }
      );
      formatLabel = (d) => format(d, "MMM d");
      formatFull = (d) => `Week of ${format(d, "MMM d, yyyy")}`;
      getBucket = (dateStr) => {
        const d = new Date(dateStr);
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        return format(weekStart, "yyyy-MM-dd");
      };
    } else {
      intervals = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
      formatLabel = (d) => format(d, "MMM");
      formatFull = (d) => format(d, "MMMM yyyy");
      getBucket = (dateStr) => {
        const d = new Date(dateStr);
        return format(startOfMonth(d), "yyyy-MM-dd");
      };
    }

    // Collect all expense categories
    const expenseCatSet = new Set<string>();
    transactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => expenseCatSet.add(t.category));
    const expenseCats = Array.from(expenseCatSet).sort();

    // Initialize data structure
    const dataMap = new Map<
      string,
      {
        name: string;
        fullDate: string;
        incomeSalary: number;
        incomeTransfers: number;
        incomeOther: number;
        totalIncome: number;
        totalExpenses: number;
        expensesByCategory: Record<string, number>;
      }
    >();

    intervals.forEach((interval) => {
      const key =
        period === "daily"
          ? format(interval, "yyyy-MM-dd")
          : period === "weekly"
          ? format(startOfWeek(interval, { weekStartsOn: 1 }), "yyyy-MM-dd")
          : format(startOfMonth(interval), "yyyy-MM-dd");

      dataMap.set(key, {
        name: formatLabel(interval),
        fullDate: formatFull(interval),
        incomeSalary: 0,
        incomeTransfers: 0,
        incomeOther: 0,
        totalIncome: 0,
        totalExpenses: 0,
        expensesByCategory: Object.fromEntries(expenseCats.map((c) => [c, 0])),
      });
    });

    // Aggregate transactions
    transactions.forEach((tx) => {
      const bucketKey = getBucket(tx.date);
      const bucket = dataMap.get(bucketKey);
      if (!bucket) return;

      if (tx.direction === "credit") {
        const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
        bucket.totalIncome += amount;

        if (tx.category === "Income" || tx.merchant?.toLowerCase().includes("salaire")) {
          bucket.incomeSalary += amount;
        } else if (tx.category === "Transfers") {
          bucket.incomeTransfers += amount;
        } else {
          bucket.incomeOther += amount;
        }
      } else {
        const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
        bucket.totalExpenses += amount;
        if (bucket.expensesByCategory[tx.category] !== undefined) {
          bucket.expensesByCategory[tx.category] += amount;
        }
      }
    });

    // Convert to chart data format
    const data: ChartDataPoint[] = [];
    let maxIncome = 0;
    let maxExpense = 0;

    dataMap.forEach((bucket) => {
      maxIncome = Math.max(maxIncome, bucket.totalIncome);
      maxExpense = Math.max(maxExpense, bucket.totalExpenses);

      const point: ChartDataPoint = {
        name: bucket.name,
        fullDate: bucket.fullDate,
        incomeSalary: bucket.incomeSalary,
        incomeTransfers: bucket.incomeTransfers,
        incomeOther: bucket.incomeOther,
        totalIncome: bucket.totalIncome,
        totalExpenses: -bucket.totalExpenses,
      };

      expenseCats.forEach((cat) => {
        point[`expense_${cat}`] = -bucket.expensesByCategory[cat];
      });

      data.push(point);
    });

    const max = Math.max(maxIncome, maxExpense, 100) * 1.15;

    return {
      chartData: data,
      incomeCategories: ["incomeSalary", "incomeTransfers", "incomeOther"].filter(
        (key) => data.some((d) => (d[key] as number) > 0)
      ),
      expenseCategories: expenseCats.filter((cat) =>
        data.some((d) => (d[`expense_${cat}`] as number) < 0)
      ),
      maxValue: max,
    };
  }, [transactions, period, dateRange, convertFromAccount]);

  const formatYAxis = (value: number) => formatCompactCurrency(value);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const totalIncome = data.totalIncome || 0;
    const totalExpenses = Math.abs(data.totalExpenses || 0);
    const net = totalIncome - totalExpenses;

    const incomeBreakdown = [
      { name: "Salary", value: data.incomeSalary || 0, color: INCOME_COLORS[0] },
      { name: "Transfers", value: data.incomeTransfers || 0, color: INCOME_COLORS[2] },
      { name: "Other", value: data.incomeOther || 0, color: INCOME_COLORS[1] },
    ].filter((i) => i.value > 0);

    const expenseBreakdown = expenseCategories
      .map((cat, idx) => ({
        name: cat,
        value: Math.abs((data[`expense_${cat}`] as number) || 0),
        color: CATEGORIES[cat]?.color || EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
      }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return (
      <div className="rounded-xl border border-border bg-popover text-popover-foreground p-4 shadow-xl min-w-[220px]">
        <p className="mb-3 font-semibold text-sm">{data.fullDate}</p>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="font-medium">In</span>
            </div>
            <span className="font-bold text-blue-500">
              <Money amount={totalIncome} />
            </span>
          </div>
          {showCategories && incomeBreakdown.length > 0 && (
            <div className="pl-5 space-y-0.5">
              {incomeBreakdown.map((item) => (
                <div key={item.name} className="flex justify-between text-xs opacity-70">
                  <span>{item.name}</span>
                  <span><Money amount={item.value} /></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-violet-500" />
              <span className="font-medium">Out</span>
            </div>
            <span className="font-bold text-violet-500">
              <Money amount={totalExpenses} />
            </span>
          </div>
          {showCategories && expenseBreakdown.length > 0 && (
            <div className="pl-5 space-y-0.5">
              {expenseBreakdown.map((item) => (
                <div key={item.name} className="flex justify-between text-xs opacity-70">
                  <span>{item.name}</span>
                  <span><Money amount={item.value} /></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="font-medium">Net</span>
          <span className={`font-bold ${net >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {net >= 0 ? "+" : "-"}<Money amount={Math.abs(net)} />
          </span>
        </div>
      </div>
    );
  };

  const selectedPeriodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label || "3 Months";

  // Get display range label
  const rangeLabel = useMemo(() => {
    if (period === "daily") {
      return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`;
    } else if (period === "weekly") {
      return `${format(dateRange.start, "MMM d")} - ${format(dateRange.end, "MMM d, yyyy")}`;
    } else {
      return `${format(dateRange.start, "MMM yyyy")} - ${format(dateRange.end, "MMM yyyy")}`;
    }
  }, [dateRange, period]);

  const handlePrevious = () => setOffset((o) => o + 1);
  const handleNext = () => setOffset((o) => Math.max(0, o - 1));
  const canGoNext = offset > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">Total Cash In and Cash Out</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleNext}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                {selectedPeriodLabel}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PERIOD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    setPeriod(option.value);
                    setOffset(0);
                  }}
                  className={period === option.value ? "bg-accent" : ""}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCategories(!showCategories)}>
                {showCategories ? "Hide" : "Show"} category breakdown
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {!transactions || chartData.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            No data available for this period.
          </div>
        ) : (
          <div className="h-80">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  barGap={0}
                  barCategoryGap="25%"
                >
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatYAxis}
                  domain={[-maxValue, maxValue]}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "currentColor", opacity: 0.1 }}
                />
                <ReferenceLine
                  y={0}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                />

                {/* Single stacked bar for both income and expenses on same column */}
                {showCategories ? (
                  <>
                    {/* Income categories (positive, stacked) */}
                    <Bar
                      dataKey="incomeSalary"
                      stackId="a"
                      fill={INCOME_COLORS[0]}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar
                      dataKey="incomeTransfers"
                      stackId="a"
                      fill={INCOME_COLORS[2]}
                      radius={[0, 0, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar
                      dataKey="incomeOther"
                      stackId="a"
                      fill={INCOME_COLORS[1]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    {/* Expense categories (negative, stacked on same bar) */}
                    {expenseCategories.map((cat, idx) => (
                      <Bar
                        key={cat}
                        dataKey={`expense_${cat}`}
                        stackId="a"
                        fill={CATEGORIES[cat]?.color || EXPENSE_COLORS[idx % EXPENSE_COLORS.length]}
                        radius={idx === expenseCategories.length - 1 ? [0, 0, 4, 4] : [0, 0, 0, 0]}
                        maxBarSize={50}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    {/* Simple view: income and expenses as single bars, same stackId */}
                    <Bar
                      dataKey="totalIncome"
                      stackId="a"
                      fill="url(#incomeGradient)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                    <Bar
                      dataKey="totalExpenses"
                      stackId="a"
                      fill="url(#expenseGradient)"
                      radius={[0, 0, 4, 4]}
                      maxBarSize={50}
                    />
                  </>
                )}
                </ComposedChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Cash In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-violet-500" />
            <span className="text-muted-foreground">Cash Out</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
