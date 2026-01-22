"use client";

import { useMemo } from "react";
import { format, parseISO, getDay, getWeek, startOfWeek, eachWeekOfInterval, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DailyHeatmapProps {
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
  className?: string;
}

interface DayData {
  date: Date;
  amount: number;
  count: number;
  intensity: number; // 0-4 for color levels
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DailyHeatmap({
  transactions,
  startDate,
  endDate,
  className,
}: DailyHeatmapProps) {
  const { convertFromAccount } = useMoney();

  const heatmapData = useMemo(() => {
    // Create a map of date -> spending
    const dayMap = new Map<string, { amount: number; count: number }>();

    transactions
      .filter((tx) => tx.direction === "debit")
      .forEach((tx) => {
        const dateKey = tx.date;
        const current = dayMap.get(dateKey) || { amount: 0, count: 0 };
        current.amount += Math.abs(convertFromAccount(tx.amount, tx.accountId));
        current.count += 1;
        dayMap.set(dateKey, current);
      });

    // Get all days in range
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Calculate max for intensity scaling
    const amounts = Array.from(dayMap.values()).map((d) => d.amount);
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;

    // Build day data
    const dayData: DayData[] = days.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const data = dayMap.get(dateKey) || { amount: 0, count: 0 };
      
      // Calculate intensity (0-4 levels)
      let intensity = 0;
      if (data.amount > 0 && maxAmount > 0) {
        const ratio = data.amount / maxAmount;
        if (ratio < 0.15) intensity = 1;
        else if (ratio < 0.35) intensity = 2;
        else if (ratio < 0.6) intensity = 3;
        else intensity = 4;
      }

      return {
        date,
        amount: data.amount,
        count: data.count,
        intensity,
      };
    });

    // Group by weeks for display
    const weeks = eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 0 });
    const weeklyData: DayData[][] = weeks.map((weekStart) => {
      const weekDays: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dayInfo = dayData.find((d) => isSameDay(d.date, day));
        if (dayInfo) {
          weekDays.push(dayInfo);
        }
      }
      return weekDays;
    });

    // Calculate day of week totals
    const dayOfWeekTotals = DAYS.map((_, index) => {
      const dayTxs = dayData.filter((d) => getDay(d.date) === index);
      return {
        day: DAYS[index],
        total: dayTxs.reduce((sum, d) => sum + d.amount, 0),
        count: dayTxs.reduce((sum, d) => sum + d.count, 0),
        avgPerDay: dayTxs.length > 0
          ? dayTxs.reduce((sum, d) => sum + d.amount, 0) / dayTxs.filter(d => d.amount > 0).length || 0
          : 0,
      };
    });

    // Find peak spending day
    const peakDay = [...dayOfWeekTotals].sort((a, b) => b.total - a.total)[0];

    return {
      weeklyData,
      dayOfWeekTotals,
      peakDay,
      maxAmount,
      totalSpending: dayData.reduce((sum, d) => sum + d.amount, 0),
    };
  }, [transactions, startDate, endDate, convertFromAccount]);

  const getIntensityClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-muted";
      case 1:
        return "bg-blue-100 dark:bg-blue-900";
      case 2:
        return "bg-blue-300 dark:bg-blue-700";
      case 3:
        return "bg-blue-500 dark:bg-blue-500";
      case 4:
        return "bg-blue-700 dark:bg-blue-300";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Spending
            </CardTitle>
            <CardDescription>When you spend the most</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Peak day</p>
            <p className="text-sm font-semibold">{heatmapData.peakDay?.day}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Heatmap Grid */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-1">
              {/* Day labels */}
              <div className="flex flex-col gap-1 mr-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="h-4 text-[10px] text-muted-foreground flex items-center"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <TooltipProvider>
                {heatmapData.weeklyData.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day, dayIndex) => (
                      <Tooltip key={`${weekIndex}-${dayIndex}`}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "w-4 h-4 rounded-sm cursor-pointer transition-colors",
                              getIntensityClass(day.intensity),
                              "hover:ring-2 hover:ring-primary hover:ring-offset-1"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <div className="space-y-1">
                            <p className="font-medium">{format(day.date, "MMM d, yyyy")}</p>
                            <p>
                              <Money amount={day.amount} /> ({day.count} transactions)
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={cn("w-4 h-4 rounded-sm", getIntensityClass(level))}
                />
              ))}
            </div>
            <span>More</span>
          </div>

          {/* Day of Week Summary */}
          <div className="grid grid-cols-7 gap-2 pt-4 border-t">
            {heatmapData.dayOfWeekTotals.map((day) => (
              <div
                key={day.day}
                className={cn(
                  "text-center p-2 rounded-lg",
                  day.day === heatmapData.peakDay?.day
                    ? "bg-blue-100 dark:bg-blue-900"
                    : "bg-muted/50"
                )}
              >
                <p className="text-xs font-medium">{day.day}</p>
                <p className="text-sm font-bold mt-1">
                  <Money amount={day.total} />
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {day.count} txn
                </p>
              </div>
            ))}
          </div>

          {/* Insight */}
          <div className="p-3 rounded-lg bg-muted text-sm">
            💡 You spend the most on <strong>{heatmapData.peakDay?.day}s</strong>, averaging{" "}
            <strong><Money amount={heatmapData.peakDay?.avgPerDay || 0} /></strong> per {heatmapData.peakDay?.day}.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
