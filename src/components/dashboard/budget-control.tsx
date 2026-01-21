"use client";

import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BudgetControlProps {
  budgetLimit: number;
  spent: number;
  onViewDetails?: () => void;
}

export function BudgetControl({
  budgetLimit,
  spent,
  onViewDetails,
}: BudgetControlProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const remaining = budgetLimit - spent;
  const percentage = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0;
  const isOverBudget = remaining < 0;
  const isNearLimit = !isOverBudget && percentage >= 80;
  const isHealthy = !isOverBudget && percentage < 80;

  // Determine status
  let statusIcon = CheckCircle2;
  let statusColor = "text-emerald-600";
  let statusBg = "bg-emerald-100 dark:bg-emerald-900/30";
  let statusText = "On Track";
  let progressColor = "#10b981"; // emerald

  if (isOverBudget) {
    statusIcon = AlertTriangle;
    statusColor = "text-red-600";
    statusBg = "bg-red-100 dark:bg-red-900/30";
    statusText = "Over Budget";
    progressColor = "#ef4444"; // red
  } else if (isNearLimit) {
    statusIcon = AlertTriangle;
    statusColor = "text-amber-600";
    statusBg = "bg-amber-100 dark:bg-amber-900/30";
    statusText = "Near Limit";
    progressColor = "#f59e0b"; // amber
  }

  const StatusIcon = statusIcon;

  // Calculate arc for gauge
  const gaugeAngle = Math.min(percentage, 100) * 1.8; // 180 degrees max

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", statusBg)}>
              <StatusIcon className={cn("h-4 w-4", statusColor)} />
            </div>
            Budget Control
          </CardTitle>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              statusBg,
              statusColor
            )}
          >
            {statusText}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge */}
        <div className="relative mx-auto" style={{ width: "180px", height: "100px" }}>
          <svg viewBox="0 0 180 100" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 90 A 80 80 0 0 1 170 90"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              className="text-muted/20"
            />
            {/* Progress arc */}
            <path
              d="M 10 90 A 80 80 0 0 1 170 90"
              fill="none"
              stroke={progressColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${gaugeAngle * 2.8}, 1000`}
              className="transition-all duration-500"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <p className={cn("text-2xl font-bold", isOverBudget && "text-red-600")}>
              {percentage.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">of budget used</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Monthly Limit</p>
            <p className="text-lg font-semibold">{formatCurrency(budgetLimit)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isOverBudget ? "Over by" : "Remaining"}
            </p>
            <p
              className={cn(
                "text-lg font-semibold",
                isOverBudget ? "text-red-600" : "text-emerald-600"
              )}
            >
              {formatCurrency(Math.abs(remaining))}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/budgets">
            View Budget Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
