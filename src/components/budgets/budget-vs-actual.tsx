"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BudgetVsActualProps {
  budgets: {
    needs: number;
    wants: number;
    savings: number;
  };
  actuals: {
    needs: number;
    wants: number;
    savings: number;
  };
  income: number;
  className?: string;
}

export function BudgetVsActual({
  budgets,
  actuals,
  income,
  className,
}: BudgetVsActualProps) {
  const data = useMemo(() => {
    return [
      {
        name: "Needs",
        budget: budgets.needs,
        actual: actuals.needs,
        color: "#3b82f6",
        budgetColor: "#93c5fd",
      },
      {
        name: "Wants",
        budget: budgets.wants,
        actual: actuals.wants,
        color: "#8b5cf6",
        budgetColor: "#c4b5fd",
      },
      {
        name: "Savings",
        budget: budgets.savings,
        actual: actuals.savings,
        color: "#10b981",
        budgetColor: "#6ee7b7",
      },
    ];
  }, [budgets, actuals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate overall budget health
  const totalBudget = budgets.needs + budgets.wants + budgets.savings;
  const totalSpent = actuals.needs + actuals.wants;
  const overallStatus = totalSpent <= totalBudget * 0.8 ? "good" : totalSpent <= totalBudget ? "warning" : "danger";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

    const diff = item.budget - item.actual;
    const percent = item.budget > 0 ? ((item.actual / item.budget) * 100).toFixed(0) : 0;

    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Budget:</span>
            <span className="font-medium">{formatCurrency(item.budget)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Actual:</span>
            <span className="font-medium">{formatCurrency(item.actual)}</span>
          </div>
          <div className={cn(
            "flex justify-between gap-4 pt-1 border-t",
            diff >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            <span>{diff >= 0 ? "Under by:" : "Over by:"}</span>
            <span className="font-bold">{formatCurrency(Math.abs(diff))}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-1">
            {percent}% of budget used
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Budget vs Actual</CardTitle>
          <Badge 
            variant={overallStatus === "good" ? "default" : overallStatus === "warning" ? "secondary" : "destructive"}
            className={cn(
              overallStatus === "good" && "bg-emerald-500",
              overallStatus === "warning" && "bg-amber-500 text-white"
            )}
          >
            {overallStatus === "good" && (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                On Track
              </>
            )}
            {overallStatus === "warning" && (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Caution
              </>
            )}
            {overallStatus === "danger" && (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Over Budget
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              barGap={-20}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => formatCurrency(v)}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              {/* Budget bar (background) */}
              <Bar
                dataKey="budget"
                radius={[0, 4, 4, 0]}
                barSize={24}
                fill="#e5e7eb"
              >
                {data.map((entry, index) => (
                  <Cell key={`budget-${index}`} fill={entry.budgetColor} opacity={0.4} />
                ))}
              </Bar>
              {/* Actual bar (foreground) */}
              <Bar
                dataKey="actual"
                radius={[0, 4, 4, 0]}
                barSize={24}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`actual-${index}`} 
                    fill={entry.actual > entry.budget ? "#ef4444" : entry.color} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-300 opacity-60" />
            <span className="text-muted-foreground">Budget</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-muted-foreground">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-muted-foreground">Over</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
          {data.map((item) => {
            const diff = item.budget - item.actual;
            const isOver = diff < 0;
            return (
              <div key={item.name} className="text-center">
                <p className="text-xs text-muted-foreground">{item.name}</p>
                <p className={cn(
                  "text-sm font-semibold",
                  isOver ? "text-red-500" : "text-emerald-500"
                )}>
                  {isOver ? "-" : "+"}{formatCurrency(Math.abs(diff))}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
