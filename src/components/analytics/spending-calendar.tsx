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
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import {
  calculateFinancialMetrics,
  classifyFinancialTransaction,
} from "@/lib/financial-metrics";

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

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function SpendingCalendar({ transactions, className }: SpendingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { convertFromAccount, formatCompactCurrency } = useMoney();

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
        const kind = classifyFinancialTransaction(tx);
        if (kind === "income") {
          dayData.income += Math.abs(convertFromAccount(tx.amount, tx.accountId));
        } else if (kind === "expense") {
          dayData.expenses += Math.abs(convertFromAccount(tx.amount, tx.accountId));
        }
      }
    });

    // Calculate max for intensity
    let maxExpense = 0;
    dayMap.forEach((data) => {
      if (data.expenses > maxExpense) maxExpense = data.expenses;
    });

    // Monthly totals
    const monthlyTransactions = transactions.filter((transaction) =>
      transaction.date.startsWith(format(currentMonth, "yyyy-MM"))
    );
    const monthlyMetrics = calculateFinancialMetrics(
      monthlyTransactions,
      convertFromAccount
    );

    return {
      days: Array.from(dayMap.values()),
      maxExpense,
      monthlyIncome: monthlyMetrics.income,
      monthlyExpenses: monthlyMetrics.expenses,
    };
  }, [transactions, currentMonth, convertFromAccount]);

  const getIntensityClass = (expenses: number) => {
    if (expenses === 0) return "";
    const ratio = calendarData.maxExpense > 0 ? expenses / calendarData.maxExpense : 0;
    if (ratio < 0.2) return "bg-[#FFCBBC]/40";
    if (ratio < 0.4) return "bg-[#FFAB96]/50";
    if (ratio < 0.6) return "bg-[#FF8B70]/50";
    if (ratio < 0.8) return "bg-[#FF6B4A]/50";
    return "bg-[#FF6B4A]/70";
  };

  const selectedDayData = selectedDay
    ? calendarData.days.find((d) => isSameDay(d.date, selectedDay))
    : null;

  return (
    <Card className={cn("col-span-2", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendrier des dépenses
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy", { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Monthly summary */}
        <div className="grid gap-2 mt-2 text-sm sm:grid-cols-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Revenus :</span>
            <span className="font-semibold text-foreground"><Money amount={calendarData.monthlyIncome} /></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#FF6B4A" }} />
            <span className="text-muted-foreground">Dépenses :</span>
            <span className="font-semibold text-foreground"><Money amount={calendarData.monthlyExpenses} /></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Net :</span>
            <span className="font-semibold text-foreground">
              <Money amount={calendarData.monthlyIncome - calendarData.monthlyExpenses} />
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
                aria-label={`${format(dayData.date, "EEEE d MMMM", { locale: fr })} : ${dayData.transactions.length} transaction(s), ${formatCompactCurrency(dayData.expenses)} dépensés`}
                aria-pressed={Boolean(isSelected)}
                className={cn(
                  "relative h-16 p-1 rounded-lg border transition-all text-left",
                  isCurrentMonth ? "bg-card" : "bg-muted/50 opacity-50",
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
                      <div className="text-[10px] text-muted-foreground font-medium truncate">
                        +{formatCompactCurrency(dayData.income)}
                      </div>
                    )}
                    {hasExpenses && (
                      <div className="text-[10px] text-foreground font-medium truncate">
                        -{formatCompactCurrency(dayData.expenses)}
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
          <div className="mt-4 p-4 rounded-lg bg-muted border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{format(selectedDayData.date, "EEEE d MMMM", { locale: fr })}</h4>
              <div className="flex gap-3 text-sm">
                {selectedDayData.income > 0 && (
                  <span className="text-foreground">+<Money amount={selectedDayData.income} /></span>
                )}
                {selectedDayData.expenses > 0 && (
                  <span className="text-foreground">-<Money amount={selectedDayData.expenses} /></span>
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
                      <p className="text-sm font-medium">{tx.merchant || "Inconnu"}</p>
                      <p className="text-xs text-muted-foreground">{tx.category}</p>
                    </div>
                    <span className="font-semibold text-foreground">
                      {tx.direction === "credit" ? "+" : "-"}
                      <Money amount={Math.abs(convertFromAccount(tx.amount, tx.accountId))} />
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Intensité des dépenses :</span>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-[#FFCBBC]/40" />
            <div className="h-3 w-3 rounded bg-[#FFAB96]/50" />
            <div className="h-3 w-3 rounded bg-[#FF8B70]/50" />
            <div className="h-3 w-3 rounded bg-[#FF6B4A]/50" />
            <div className="h-3 w-3 rounded bg-[#FF6B4A]/70" />
            <span className="ml-1">Élevée</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
