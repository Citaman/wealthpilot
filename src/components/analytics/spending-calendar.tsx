"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";

interface SpendingCalendarProps {
  transactions: Transaction[];
  className?: string;
}

interface DayData {
  date: Date;
  income: number;
  expenses: number;
  transactions: Transaction[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SpendingCalendar({ transactions, className }: SpendingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get all days including padding for complete weeks
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Create day map
    const dayMap = new Map<string, DayData>();
    days.forEach((date) => {
      dayMap.set(format(date, "yyyy-MM-dd"), {
        date,
        income: 0,
        expenses: 0,
        transactions: [],
      });
    });

    // Aggregate transactions
    transactions.forEach((tx) => {
      const dayData = dayMap.get(tx.date);
      if (dayData) {
        dayData.transactions.push(tx);
        if (tx.direction === "credit") {
          dayData.income += Math.abs(tx.amount);
        } else {
          dayData.expenses += Math.abs(tx.amount);
        }
      }
    });

    // Calculate max for intensity
    let maxExpense = 0;
    dayMap.forEach((data) => {
      if (data.expenses > maxExpense) maxExpense = data.expenses;
    });

    // Monthly totals
    const monthlyIncome = Array.from(dayMap.values())
      .filter((d) => isSameMonth(d.date, currentMonth))
      .reduce((sum, d) => sum + d.income, 0);
    const monthlyExpenses = Array.from(dayMap.values())
      .filter((d) => isSameMonth(d.date, currentMonth))
      .reduce((sum, d) => sum + d.expenses, 0);

    return {
      days: Array.from(dayMap.values()),
      maxExpense,
      monthlyIncome,
      monthlyExpenses,
    };
  }, [transactions, currentMonth]);

  const formatCurrency = (value: number, compact = false) => {
    if (compact && value >= 1000) {
      return `€${(value / 1000).toFixed(1)}k`;
    }
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getIntensityClass = (expenses: number) => {
    if (expenses === 0) return "";
    const ratio = calendarData.maxExpense > 0 ? expenses / calendarData.maxExpense : 0;
    if (ratio < 0.2) return "bg-red-100 dark:bg-red-950/30";
    if (ratio < 0.4) return "bg-red-200 dark:bg-red-900/40";
    if (ratio < 0.6) return "bg-red-300 dark:bg-red-800/50";
    if (ratio < 0.8) return "bg-red-400 dark:bg-red-700/60";
    return "bg-red-500 dark:bg-red-600/70";
  };

  const selectedDayData = selectedDay
    ? calendarData.days.find((d) => isSameDay(d.date, selectedDay))
    : null;

  return (
    <Card className={cn("col-span-2", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Spending Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Monthly summary */}
        <div className="flex gap-4 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Income:</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(calendarData.monthlyIncome)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Expenses:</span>
            <span className="font-semibold text-red-600">{formatCurrency(calendarData.monthlyExpenses)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Net:</span>
            <span className={cn(
              "font-semibold",
              calendarData.monthlyIncome - calendarData.monthlyExpenses >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {formatCurrency(calendarData.monthlyIncome - calendarData.monthlyExpenses)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Weekday headers */}
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarData.days.map((dayData) => {
            const isCurrentMonth = isSameMonth(dayData.date, currentMonth);
            const isSelected = selectedDay && isSameDay(dayData.date, selectedDay);
            const hasIncome = dayData.income > 0;
            const hasExpenses = dayData.expenses > 0;

            return (
              <button
                key={format(dayData.date, "yyyy-MM-dd")}
                onClick={() => setSelectedDay(isSelected ? null : dayData.date)}
                className={cn(
                  "relative h-16 p-1 rounded-lg border transition-all text-left",
                  isCurrentMonth ? "bg-card" : "bg-muted/30 opacity-50",
                  isSelected && "ring-2 ring-primary",
                  isToday(dayData.date) && "border-primary",
                  !isSelected && "hover:bg-accent/50",
                  hasExpenses && getIntensityClass(dayData.expenses)
                )}
              >
                <div className={cn(
                  "text-xs font-medium",
                  isToday(dayData.date) && "text-primary"
                )}>
                  {format(dayData.date, "d")}
                </div>
                {isCurrentMonth && (hasIncome || hasExpenses) && (
                  <div className="mt-0.5 space-y-0.5">
                    {hasIncome && (
                      <div className="text-[10px] text-emerald-600 font-medium truncate">
                        +{formatCurrency(dayData.income, true)}
                      </div>
                    )}
                    {hasExpenses && (
                      <div className="text-[10px] text-red-600 font-medium truncate">
                        -{formatCurrency(dayData.expenses, true)}
                      </div>
                    )}
                  </div>
                )}
                {dayData.transactions.length > 0 && (
                  <div className="absolute bottom-1 right-1 text-[9px] text-muted-foreground">
                    {dayData.transactions.length}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDayData && selectedDayData.transactions.length > 0 && (
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{format(selectedDayData.date, "EEEE, MMMM d")}</h4>
              <div className="flex gap-3 text-sm">
                {selectedDayData.income > 0 && (
                  <span className="text-emerald-600">+{formatCurrency(selectedDayData.income)}</span>
                )}
                {selectedDayData.expenses > 0 && (
                  <span className="text-red-600">-{formatCurrency(selectedDayData.expenses)}</span>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {selectedDayData.transactions
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-background"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.merchant || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{tx.category}</p>
                    </div>
                    <span className={cn(
                      "font-semibold",
                      tx.direction === "credit" ? "text-emerald-600" : "text-red-600"
                    )}>
                      {tx.direction === "credit" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Spending intensity:</span>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-red-100 dark:bg-red-950/30" />
            <div className="h-3 w-3 rounded bg-red-200 dark:bg-red-900/40" />
            <div className="h-3 w-3 rounded bg-red-300 dark:bg-red-800/50" />
            <div className="h-3 w-3 rounded bg-red-400 dark:bg-red-700/60" />
            <div className="h-3 w-3 rounded bg-red-500 dark:bg-red-600/70" />
            <span className="ml-1">High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
