"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Money } from "@/components/ui/money";
import { MeasuredChart } from "@/components/ui/measured-chart";
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
import { classifyFinancialTransaction } from "@/lib/financial-metrics";
import { fr } from "date-fns/locale";

// Period options
type PeriodType = "6M" | "1Y" | "YTD" | "3M" | "weekly" | "daily";

interface PeriodOption {
  label: string;
  value: PeriodType;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "Cette année", value: "YTD" },
  { label: "12 derniers mois", value: "1Y" },
  { label: "6 derniers mois", value: "6M" },
  { label: "3 derniers mois", value: "3M" },
  { label: "Vue hebdomadaire", value: "weekly" },
  { label: "Vue quotidienne", value: "daily" },
];

interface ChartDataPoint {
  name: string;
  fullDate: string;
  totalIncome: number;
  totalExpenses: number;
  [key: string]: number | string;
}

export function CashFlowChart({ accountId = "all" }: { accountId?: number | "all" }) {
  const [period, setPeriod] = useState<PeriodType>("3M");
  const [offset, setOffset] = useState(0);
  const { convertFromAccount, formatCompactCurrency } = useMoney();

  // Calculate date range based on period and offset
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case "YTD": {
        const yearDate = subMonths(now, offset * 12);
        start = startOfYear(yearDate);
        end = offset === 0 ? endOfDay(now) : endOfMonth(subMonths(addMonths(start, 11), 0));
        break;
      }
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
        start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 3 + offset * 4);
        end = offset === 0 ? endOfDay(now) : endOfWeek(addWeeks(start, 3), { weekStartsOn: 1 });
        break;
      case "daily":
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
        .toArray()
        .then((txs) => accountId === "all" ? txs : txs.filter((tx) => tx.accountId === accountId)),
    [dateRange.startStr, dateRange.endStr, accountId]
  );

  // Process data for chart
  const { chartData, maxValue } = useMemo(() => {
    if (!transactions) {
      return { chartData: [], maxValue: 1000 };
    }

    // Determine time buckets based on period
    let intervals: Date[];
    let formatLabel: (d: Date) => string;
    let formatFull: (d: Date) => string;
    let getBucket: (dateStr: string) => string;

    if (period === "daily") {
      intervals = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      formatLabel = (d) => format(d, "EEE", { locale: fr });
      formatFull = (d) => format(d, "EEEE d MMMM yyyy", { locale: fr });
      getBucket = (dateStr) => dateStr;
    } else if (period === "weekly") {
      intervals = eachWeekOfInterval(
        { start: dateRange.start, end: dateRange.end },
        { weekStartsOn: 1 }
      );
      formatLabel = (d) => format(d, "d MMM", { locale: fr });
      formatFull = (d) => `Semaine du ${format(d, "d MMMM yyyy", { locale: fr })}`;
      getBucket = (dateStr) => {
        const d = new Date(dateStr);
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        return format(weekStart, "yyyy-MM-dd");
      };
    } else {
      intervals = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
      formatLabel = (d) => format(d, "MMM", { locale: fr });
      formatFull = (d) => format(d, "MMMM yyyy", { locale: fr });
      getBucket = (dateStr) => {
        const d = new Date(dateStr);
        return format(startOfMonth(d), "yyyy-MM-dd");
      };
    }

    // Initialize data structure
    const dataMap = new Map<
      string,
      {
        name: string;
        fullDate: string;
        totalIncome: number;
        totalExpenses: number;
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
        totalIncome: 0,
        totalExpenses: 0,
      });
    });

    // Aggregate transactions
    transactions.forEach((tx) => {
      const bucketKey = getBucket(tx.date);
      const bucket = dataMap.get(bucketKey);
      if (!bucket) return;

      const kind = classifyFinancialTransaction(tx);
      if (kind === "income") {
        bucket.totalIncome += Math.abs(convertFromAccount(tx.amount, tx.accountId));
      } else if (kind === "expense") {
        bucket.totalExpenses += Math.abs(convertFromAccount(tx.amount, tx.accountId));
      } else if (kind === "refund") {
        bucket.totalExpenses -= Math.abs(convertFromAccount(tx.amount, tx.accountId));
      }
    });

    // Convert to chart data format
    const data: ChartDataPoint[] = [];
    let maxIncome = 0;
    let maxExpense = 0;

    dataMap.forEach((bucket) => {
      maxIncome = Math.max(maxIncome, bucket.totalIncome);
      const expenses = Math.max(0, bucket.totalExpenses);
      maxExpense = Math.max(maxExpense, expenses);

      data.push({
        name: bucket.name,
        fullDate: bucket.fullDate,
        totalIncome: bucket.totalIncome,
        totalExpenses: -expenses,
      });
    });

    const max = Math.max(maxIncome, maxExpense, 100) * 1.15;

    return {
      chartData: data,
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

    return (
      <div className="rounded-xl border border-border bg-popover text-popover-foreground p-4 shadow-xl min-w-[200px]">
        <p className="mb-3 font-semibold text-sm">{data.fullDate}</p>
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Revenus</span>
            <span className="font-semibold text-sm">
              <Money amount={totalIncome} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Dépenses</span>
            <span className="font-semibold text-sm">
              <Money amount={totalExpenses} />
            </span>
          </div>
        </div>
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="font-medium text-sm">Solde net</span>
          <span className="font-semibold text-sm">
            {net >= 0 ? "+" : "-"}<Money amount={Math.abs(net)} />
          </span>
        </div>
      </div>
    );
  };

  const selectedPeriodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label || "3 derniers mois";

  // Get display range label
  const rangeLabel = useMemo(() => {
    if (period === "daily") {
      return `${format(dateRange.start, "d MMM", { locale: fr })} – ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
    } else if (period === "weekly") {
      return `${format(dateRange.start, "d MMM", { locale: fr })} – ${format(dateRange.end, "d MMM yyyy", { locale: fr })}`;
    } else {
      return `${format(dateRange.start, "MMM yyyy", { locale: fr })} – ${format(dateRange.end, "MMM yyyy", { locale: fr })}`;
    }
  }, [dateRange, period]);

  const handlePrevious = () => setOffset((o) => o + 1);
  const handleNext = () => setOffset((o) => Math.max(0, o - 1));
  const canGoNext = offset > 0;
  const hasActivity = chartData.some((point) => point.totalIncome !== 0 || point.totalExpenses !== 0);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-3 pb-2 sm:flex-row sm:items-center">
        <div>
          <CardTitle className="text-lg font-semibold">Entrées et sorties d’argent</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{rangeLabel}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {/* Navigation arrows */}
          <div className="flex items-center gap-1">
            <Button aria-label="Période précédente" variant="ghost" size="icon" className="h-10 w-10" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Période suivante"
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
        </div>
      </CardHeader>
      <CardContent>
        {!transactions || !hasActivity ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground">
            Aucune donnée disponible sur cette période.
          </div>
        ) : (
          <MeasuredChart className="h-80" ariaLabel="Revenus et dépenses par période">
            {({ width, height }) => (
                <ComposedChart
                  width={width}
                  height={height}
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                  barGap={0}
                  barCategoryGap="25%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgb(var(--border))"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "rgb(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgb(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatYAxis}
                    domain={[-maxValue, maxValue]}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "currentColor", opacity: 0.05 }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="currentColor"
                    strokeOpacity={0.15}
                    strokeWidth={1}
                  />

                  {/* Income bars - coral solid */}
                  <Bar
                    dataKey="totalIncome"
                    stackId="a"
                    fill="rgb(var(--income))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                  {/* Expense bars - coral at 20% opacity */}
                  <Bar
                    dataKey="totalExpenses"
                    stackId="a"
                    fill="rgb(var(--expense))"
                    radius={[0, 0, 4, 4]}
                    maxBarSize={50}
                  />
                </ComposedChart>
            )}
          </MeasuredChart>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-income" />
            <span className="text-muted-foreground">Revenus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-expense" />
            <span className="text-muted-foreground">Dépenses</span>
          </div>
        </div>
        {hasActivity && (
          <details className="mt-4 rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">Afficher les données du graphique</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] tabular-nums">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Période</th><th className="text-right">Revenus</th><th className="text-right">Dépenses</th><th className="text-right">Net</th></tr></thead>
                <tbody>{chartData.map((point) => <tr key={point.fullDate} className="border-b last:border-0"><th scope="row" className="py-2 text-left font-medium">{point.fullDate}</th><td className="text-right"><Money amount={point.totalIncome} /></td><td className="text-right"><Money amount={Math.abs(point.totalExpenses)} /></td><td className="text-right"><Money amount={point.totalIncome - Math.abs(point.totalExpenses)} /></td></tr>)}</tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
