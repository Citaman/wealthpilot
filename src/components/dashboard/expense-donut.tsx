"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface ExpenseCategory {
  name: string;
  amount: number;
  color: string;
}

interface ExpenseDonutProps {
  totalExpenses: number;
  categories: ExpenseCategory[];
  change?: number;
  changeLabel?: string;
}

export function ExpenseDonut({
  totalExpenses,
  categories,
  change,
  changeLabel = "vs last month",
}: ExpenseDonutProps) {
  const isHigher = change !== undefined && change > 0;

  // Calculate donut segments
  const segments = useMemo(() => {
    if (totalExpenses === 0) return [];

    let currentAngle = 0;
    return categories
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5) // Top 5 categories
      .map((category) => {
        const percentage = (category.amount / totalExpenses) * 100;
        const angle = (percentage / 100) * 360;
        const segment = {
          ...category,
          percentage,
          startAngle: currentAngle,
          endAngle: currentAngle + angle,
        };
        currentAngle += angle;
        return segment;
      });
  }, [categories, totalExpenses]);

  // Create SVG arc path
  const createArc = (
    startAngle: number,
    endAngle: number,
    innerRadius: number,
    outerRadius: number
  ) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 50 + outerRadius * Math.cos(startRad);
    const y1 = 50 + outerRadius * Math.sin(startRad);
    const x2 = 50 + outerRadius * Math.cos(endRad);
    const y2 = 50 + outerRadius * Math.sin(endRad);
    const x3 = 50 + innerRadius * Math.cos(endRad);
    const y3 = 50 + innerRadius * Math.sin(endRad);
    const x4 = 50 + innerRadius * Math.cos(startRad);
    const y4 = 50 + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </div>
          Expense Recap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donut Chart */}
        <div className="relative aspect-square max-w-[200px] mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="16"
              className="text-muted/20"
            />
            {/* Segments */}
            {segments.map((segment, i) => (
              <path
                key={segment.name}
                d={createArc(segment.startAngle, segment.endAngle, 32, 48)}
                fill={segment.color}
                className="transition-all duration-300 hover:opacity-80"
              />
            ))}
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-bold"><Money amount={totalExpenses} /></p>
            {change !== undefined && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-1",
                  isHigher ? "text-red-500" : "text-emerald-500"
                )}
              >
                {isHigher ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change).toFixed(0)}% {isHigher ? "Higher" : "Lower"}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-muted-foreground truncate">{segment.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium"><Money amount={segment.amount} /></span>
                <span className="text-muted-foreground text-xs w-10 text-right">
                  {segment.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
