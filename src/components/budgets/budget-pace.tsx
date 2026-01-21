"use client";

import { useMemo } from "react";
import { getDate, getDaysInMonth } from "date-fns";
import { Gauge, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BudgetPaceProps {
  totalBudget: number;
  totalSpent: number;
  className?: string;
}

export function BudgetPace({ totalBudget, totalSpent, className }: BudgetPaceProps) {
  const paceData = useMemo(() => {
    const now = new Date();
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const monthProgress = (dayOfMonth / daysInMonth) * 100;
    
    // Expected spend at this point
    const expectedSpent = (totalBudget * dayOfMonth) / daysInMonth;
    const spendingProgress = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    
    // Daily metrics
    const dailyBudget = totalBudget / daysInMonth;
    const dailyAvg = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
    const remainingDays = daysInMonth - dayOfMonth;
    const remainingBudget = totalBudget - totalSpent;
    const dailyRemaining = remainingDays > 0 ? remainingBudget / remainingDays : 0;
    
    // Projected total if continuing at current pace
    const projectedTotal = dailyAvg * daysInMonth;
    
    // Status determination
    let status: "excellent" | "good" | "warning" | "danger";
    let statusMessage: string;
    
    const paceRatio = spendingProgress / monthProgress;
    
    if (paceRatio < 0.8) {
      status = "excellent";
      statusMessage = "Well under budget! Great job!";
    } else if (paceRatio < 1.0) {
      status = "good";
      statusMessage = "On track to stay within budget";
    } else if (paceRatio < 1.15) {
      status = "warning";
      statusMessage = "Slightly ahead of pace - watch spending";
    } else {
      status = "danger";
      statusMessage = "At risk of exceeding budget";
    }
    
    return {
      dayOfMonth,
      daysInMonth,
      monthProgress,
      spendingProgress,
      expectedSpent,
      dailyBudget,
      dailyAvg,
      dailyRemaining,
      remainingDays,
      remainingBudget,
      projectedTotal,
      status,
      statusMessage,
    };
  }, [totalBudget, totalSpent]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const statusConfig = {
    excellent: { 
      color: "text-emerald-500", 
      bg: "bg-emerald-500", 
      Icon: CheckCircle,
      progressColor: "bg-emerald-500",
    },
    good: { 
      color: "text-blue-500", 
      bg: "bg-blue-500", 
      Icon: CheckCircle,
      progressColor: "bg-blue-500",
    },
    warning: { 
      color: "text-amber-500", 
      bg: "bg-amber-500", 
      Icon: AlertTriangle,
      progressColor: "bg-amber-500",
    },
    danger: { 
      color: "text-red-500", 
      bg: "bg-red-500", 
      Icon: XCircle,
      progressColor: "bg-red-500",
    },
  };

  const config = statusConfig[paceData.status];
  const StatusIcon = config.Icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-5 w-5" />
          Spending Pace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main pace indicator */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center justify-center h-16 w-16 rounded-full shrink-0",
            config.bg + "/10"
          )}>
            <StatusIcon className={cn("h-8 w-8", config.color)} />
          </div>
          <div className="flex-1">
            <p className={cn("font-semibold", config.color)}>{paceData.statusMessage}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Day {paceData.dayOfMonth} of {paceData.daysInMonth} • {paceData.remainingDays} days left
            </p>
          </div>
        </div>

        {/* Progress comparison */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Month Progress</span>
              <span className="text-muted-foreground">{paceData.monthProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-400 transition-all"
                style={{ width: `${paceData.monthProgress}%` }}
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Budget Used</span>
              <span className={cn("font-medium", config.color)}>
                {Math.min(paceData.spendingProgress, 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden relative">
              {/* Month progress marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                style={{ left: `${paceData.monthProgress}%` }}
              />
              <div
                className={cn("h-full transition-all", config.progressColor)}
                style={{ width: `${Math.min(paceData.spendingProgress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vertical line = expected position based on day of month
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Daily Budget</p>
            <p className="text-lg font-bold">{formatCurrency(paceData.dailyBudget)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Daily Average</p>
            <p className={cn(
              "text-lg font-bold",
              paceData.dailyAvg > paceData.dailyBudget ? "text-red-500" : "text-emerald-500"
            )}>
              {formatCurrency(paceData.dailyAvg)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Can Spend/Day</p>
            <p className={cn(
              "text-lg font-bold",
              paceData.dailyRemaining < 0 ? "text-red-500" : "text-emerald-500"
            )}>
              {formatCurrency(Math.max(0, paceData.dailyRemaining))}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Projected Total</p>
            <p className={cn(
              "text-lg font-bold",
              paceData.projectedTotal > totalBudget ? "text-red-500" : "text-emerald-500"
            )}>
              {formatCurrency(paceData.projectedTotal)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
