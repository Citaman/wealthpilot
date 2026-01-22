"use client";

import { useMemo, useState } from "react";
import { format, subMonths, addMonths, eachMonthOfInterval, endOfMonth, startOfMonth } from "date-fns";
import { TrendingUp, Calculator, Sliders } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { ClientOnly } from "@/components/ui/client-only";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";

interface SpendingForecastProps {
  transactions: Transaction[];
  currentBalance: number;
  className?: string;
}

interface ForecastPoint {
  month: string;
  fullDate: string;
  actual?: number;
  forecast?: number;
  optimistic?: number;
  pessimistic?: number;
  isProjection: boolean;
}

export function SpendingForecast({
  transactions,
  currentBalance,
  className,
}: SpendingForecastProps) {
  const [showScenarios, setShowScenarios] = useState(true);
  const [savingsAdjustment, setSavingsAdjustment] = useState(0); // % change in spending
  const { convertFromAccount, formatCompactCurrency } = useMoney();

  const forecastData = useMemo(() => {
    const now = new Date();
    const historicalMonths = 6;
    const forecastMonths = 6;

    // Get historical data
    const histStart = subMonths(startOfMonth(now), historicalMonths - 1);
    const histEnd = endOfMonth(now);
    const histInterval = eachMonthOfInterval({ start: histStart, end: histEnd });

    // Calculate monthly spending
    const monthlyData = new Map<string, { income: number; expenses: number; net: number }>();
    
    histInterval.forEach((m) => {
      monthlyData.set(format(m, "yyyy-MM"), { income: 0, expenses: 0, net: 0 });
    });

    transactions.forEach((tx) => {
      const monthKey = tx.date.slice(0, 7);
      const data = monthlyData.get(monthKey);
      if (data) {
        if (tx.direction === "credit") {
          data.income += convertFromAccount(tx.amount, tx.accountId);
        } else {
          data.expenses += Math.abs(convertFromAccount(tx.amount, tx.accountId));
        }
        data.net = data.income - data.expenses;
      }
    });

    // Calculate averages for forecasting
    const historicalNets = Array.from(monthlyData.values()).map((d) => d.net);
    const avgNet = historicalNets.length > 0 
      ? historicalNets.reduce((a, b) => a + b, 0) / historicalNets.length 
      : 0;

    // Calculate standard deviation for confidence bands
    const variance = historicalNets.reduce((sum, val) => sum + Math.pow(val - avgNet, 2), 0) / historicalNets.length;
    const stdDev = Math.sqrt(variance);

    // Build data points
    const data: ForecastPoint[] = [];
    let runningBalance = currentBalance;

    // Historical points
    histInterval.forEach((m) => {
      const key = format(m, "yyyy-MM");
      const monthData = monthlyData.get(key);
      data.push({
        month: format(m, "MMM"),
        fullDate: format(m, "MMM yyyy"),
        actual: monthData ? monthData.net : undefined,
        isProjection: false,
      });
    });

    // Apply savings adjustment to forecast
    const adjustedNet = avgNet * (1 + savingsAdjustment / 100);

    // Forecast points
    const forecastStart = addMonths(startOfMonth(now), 1);
    const forecastEnd = addMonths(forecastStart, forecastMonths - 1);
    const forecastInterval = eachMonthOfInterval({ start: forecastStart, end: forecastEnd });

    forecastInterval.forEach((m, idx) => {
      runningBalance += adjustedNet;
      const uncertainty = stdDev * (1 + idx * 0.2); // Growing uncertainty
      
      data.push({
        month: format(m, "MMM"),
        fullDate: format(m, "MMM yyyy"),
        forecast: adjustedNet,
        optimistic: adjustedNet + uncertainty,
        pessimistic: adjustedNet - uncertainty,
        isProjection: true,
      });
    });

    // Calculate projection summary
    const projectedSavings = adjustedNet * forecastMonths;
    const projectedBalance = currentBalance + projectedSavings;
    const monthsToTarget = adjustedNet > 0 ? Math.ceil((10000 - currentBalance) / adjustedNet) : null;

    return {
      data,
      avgNet,
      adjustedNet,
      projectedSavings,
      projectedBalance,
      monthsToTarget,
      stdDev,
    };
  }, [transactions, currentBalance, savingsAdjustment, convertFromAccount]);

  const formatYAxis = (value: number) => formatCompactCurrency(value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as ForecastPoint;

    return (
      <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-lg">
        <p className="font-semibold mb-2">{data.fullDate}</p>
        {data.actual !== undefined && (
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Actual Net</span>
            <span className={cn("font-medium", data.actual >= 0 ? "text-emerald-500" : "text-red-500")}>
              <Money amount={data.actual} />
            </span>
          </div>
        )}
        {data.forecast !== undefined && (
          <>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Forecast</span>
              <span className={cn("font-medium", data.forecast >= 0 ? "text-emerald-500" : "text-red-500")}>
                <Money amount={data.forecast} />
              </span>
            </div>
            {showScenarios && (
              <>
                <div className="flex justify-between gap-4 text-xs mt-1">
                  <span className="text-muted-foreground">Best case</span>
                  <span className="text-emerald-400">
                    <Money amount={data.optimistic!} />
                  </span>
                </div>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted-foreground">Worst case</span>
                  <span className="text-red-400">
                    <Money amount={data.pessimistic!} />
                  </span>
                </div>
              </>
            )}
          </>
        )}
        {data.isProjection && (
          <p className="text-xs text-muted-foreground mt-2 italic">Projected value</p>
        )}
      </div>
    );
  };

  return (
    <Card className={cn("col-span-2", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Spending Forecast
            </CardTitle>
            <CardDescription>6-month projection based on your spending patterns</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Sliders className="h-4 w-4" />
                  What-If
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Spending Adjustment</Label>
                    <p className="text-xs text-muted-foreground">
                      Simulate what happens if you change your spending
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Reduce by 20%</span>
                      <span>Increase by 20%</span>
                    </div>
                    <Slider
                      value={[savingsAdjustment]}
                      onValueChange={(v) => setSavingsAdjustment(v[0])}
                      min={-20}
                      max={20}
                      step={5}
                    />
                    <div className="text-center">
                      <span className={cn(
                        "text-lg font-semibold",
                        savingsAdjustment < 0 ? "text-emerald-500" : savingsAdjustment > 0 ? "text-red-500" : ""
                      )}>
                        {savingsAdjustment > 0 ? "+" : ""}{savingsAdjustment}%
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monthly net</span>
                      <span className="font-medium">
                        <Money amount={forecastData.adjustedNet} />
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">6-month savings</span>
                      <span className={cn(
                        "font-medium",
                        forecastData.projectedSavings >= 0 ? "text-emerald-500" : "text-red-500"
                      )}>
                        <Money amount={forecastData.projectedSavings} />
                      </span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant={showScenarios ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowScenarios(!showScenarios)}
            >
              Scenarios
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
            <ClientOnly>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>

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
              <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />

              {/* Confidence band for projections */}
              {showScenarios && (
                <Area
                  dataKey="optimistic"
                  stroke="none"
                  fill="#10b981"
                  fillOpacity={0.1}
                  connectNulls={false}
                />
              )}
              {showScenarios && (
                <Area
                  dataKey="pessimistic"
                  stroke="none"
                  fill="#ef4444"
                  fillOpacity={0.1}
                  connectNulls={false}
                />
              )}

              {/* Actual line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }}
                connectNulls={false}
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#8b5cf6", strokeWidth: 0, r: 4 }}
                connectNulls={false}
              />
              </ComposedChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Avg Monthly Net</p>
            <p className={cn(
              "text-lg font-bold",
              forecastData.avgNet >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              <Money amount={forecastData.avgNet} />
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Projected Balance (6mo)</p>
            <p className={cn(
              "text-lg font-bold",
              forecastData.projectedBalance >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              <Money amount={forecastData.projectedBalance} />
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Months to €10k</p>
            <p className="text-lg font-bold">
              {forecastData.monthsToTarget !== null
                ? forecastData.monthsToTarget <= 0
                  ? "✓ Reached"
                  : `${forecastData.monthsToTarget} mo`
                : "—"}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-blue-500 rounded" />
            <span className="text-muted-foreground">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-purple-500 rounded" style={{ backgroundImage: "repeating-linear-gradient(90deg, #8b5cf6, #8b5cf6 4px, transparent 4px, transparent 8px)" }} />
            <span className="text-muted-foreground">Forecast</span>
          </div>
          {showScenarios && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-4 bg-gradient-to-b from-emerald-500/20 to-red-500/20 rounded" />
              <span className="text-muted-foreground">Confidence Band</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
