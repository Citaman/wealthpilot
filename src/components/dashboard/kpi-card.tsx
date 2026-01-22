"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  currencyCode?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon,
  iconColor = "text-primary",
  trend,
  currencyCode,
}: KpiCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "number") {
      return <Money amount={val} currency={currencyCode} />;
    }
    return val;
  };

  const getTrendIcon = () => {
    if (trend === "up") {
      return <TrendingUp className="h-4 w-4" />;
    } else if (trend === "down") {
      return <TrendingDown className="h-4 w-4" />;
    }
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-muted-foreground";
    if (trend === "up") return change >= 0 ? "text-emerald-600" : "text-red-500";
    if (trend === "down") return change >= 0 ? "text-red-500" : "text-emerald-600";
    return "text-muted-foreground";
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">
              {formatValue(value)}
            </p>
            {(change !== undefined || subtitle) && (
              <div className="flex items-center gap-2">
                {change !== undefined && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      getTrendColor()
                    )}
                  >
                    {getTrendIcon()}
                    {Math.abs(change).toFixed(1)}%
                  </span>
                )}
                {changeLabel && (
                  <span className="text-sm text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
                {subtitle && !changeLabel && (
                  <span className="text-sm text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10",
              iconColor
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
