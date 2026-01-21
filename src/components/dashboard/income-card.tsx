"use client";

import {
  TrendingUp,
  TrendingDown,
  Plus,
  Briefcase,
  Gift,
  DollarSign,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface IncomeSource {
  name: string;
  amount: number;
  icon: "salary" | "bonus" | "gift" | "other";
  color: string;
}

interface IncomeCardProps {
  totalIncome: number;
  change?: number;
  changeLabel?: string;
  sources?: IncomeSource[];
  onAddIncome?: () => void;
}

const iconMap = {
  salary: Briefcase,
  bonus: DollarSign,
  gift: Gift,
  other: MoreHorizontal,
};

const defaultSources: IncomeSource[] = [
  { name: "Salary", amount: 0, icon: "salary", color: "#10b981" },
  { name: "Part-Time", amount: 0, icon: "bonus", color: "#3b82f6" },
  { name: "Other", amount: 0, icon: "other", color: "#8b5cf6" },
];

export function IncomeCard({
  totalIncome,
  change,
  changeLabel = "vs last month",
  sources = defaultSources,
  onAddIncome,
}: IncomeCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxAmount = Math.max(...sources.map((s) => s.amount), 1);
  const isPositiveChange = change !== undefined && change > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            Income Management
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onAddIncome}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Income */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Monthly Recap
            </p>
            <p className="text-3xl font-bold text-emerald-600">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          {change !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                isPositiveChange
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {isPositiveChange ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Income Sources Breakdown */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Income Breakdown</p>
          {sources
            .filter((s) => s.amount > 0)
            .map((source) => {
              const IconComponent = iconMap[source.icon];
              const percentage = (source.amount / maxAmount) * 100;

              return (
                <div key={source.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${source.color}15` }}
                      >
                        <IconComponent
                          className="h-3 w-3"
                          style={{ color: source.color }}
                        />
                      </div>
                      <span className="text-muted-foreground">{source.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(source.amount)}</span>
                  </div>
                  <Progress
                    value={percentage}
                    className="h-1.5"
                    style={
                      {
                        "--progress-color": source.color,
                      } as React.CSSProperties
                    }
                  />
                </div>
              );
            })}
          {sources.every((s) => s.amount === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No income recorded this month
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
