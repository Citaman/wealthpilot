"use client";

import { useMemo } from "react";
import { getDate, getDaysInMonth } from "date-fns";
import { Gauge, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface BudgetPaceProps {
  totalBudget: number;
  totalSpent: number;
  asOfDate?: Date;
  className?: string;
}

export function BudgetPace({ totalBudget, totalSpent, asOfDate, className }: BudgetPaceProps) {
  const paceData = useMemo(() => {
    const now = asOfDate || new Date();
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
      statusMessage = "Dépenses nettement sous le budget";
    } else if (paceRatio < 1.0) {
      status = "good";
      statusMessage = "Trajectoire compatible avec le budget";
    } else if (paceRatio < 1.15) {
      status = "warning";
      statusMessage = "Rythme légèrement trop élevé : à surveiller";
    } else {
      status = "danger";
      statusMessage = "Risque de dépassement du budget";
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
  }, [totalBudget, totalSpent, asOfDate]);

  const statusConfig = {
    excellent: {
      color: "text-foreground",
      bg: "bg-[#FF6B4A]",
      Icon: CheckCircle,
      progressColor: "bg-[#FF6B4A]",
    },
    good: {
      color: "text-foreground",
      bg: "bg-[#FF6B4A]",
      Icon: CheckCircle,
      progressColor: "bg-[#FF6B4A]",
    },
    warning: {
      color: "text-foreground",
      bg: "bg-[#FF8B70]",
      Icon: AlertTriangle,
      progressColor: "bg-[#FF8B70]",
    },
    danger: {
      color: "text-foreground",
      bg: "bg-[#FFAB96]",
      Icon: XCircle,
      progressColor: "bg-[#FFAB96]",
    },
  };

  const config = statusConfig[paceData.status];
  const StatusIcon = config.Icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-5 w-5" />
          Rythme des dépenses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main pace indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-16 w-16 rounded-full shrink-0 bg-muted/50">
            <StatusIcon className={cn("h-8 w-8", config.color)} />
          </div>
          <div className="flex-1">
            <p className={cn("font-semibold", config.color)}>{paceData.statusMessage}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Jour {paceData.dayOfMonth} sur {paceData.daysInMonth} · {paceData.remainingDays} jour(s) restant(s)
            </p>
          </div>
        </div>

        {/* Progress comparison */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Avancement du mois</span>
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
              <span>Budget utilisé</span>
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
              Le repère vertical indique la position attendue aujourd’hui.
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Budget quotidien</p>
            <p className="text-lg font-bold"><Money amount={paceData.dailyBudget} /></p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Moyenne quotidienne</p>
            <p className="text-lg font-bold text-foreground">
              <Money amount={paceData.dailyAvg} />
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Disponible par jour</p>
            <p className="text-lg font-bold text-foreground">
              <Money amount={Math.max(0, paceData.dailyRemaining)} />
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Total projeté</p>
            <p className="text-lg font-bold text-foreground">
              <Money amount={paceData.projectedTotal} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
