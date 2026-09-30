"use client";

import { useMemo } from "react";
import { AlertTriangle, Bell, CheckCircle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface BudgetAlert {
  category: string;
  type: "needs" | "wants" | "savings";
  budget: number;
  spent: number;
  threshold: 80 | 90 | 100 | "over";
  severity: "warning" | "danger" | "critical";
}

interface BudgetAlertsProps {
  categoryData: Array<{
    category: string;
    type: "needs" | "wants" | "savings";
    budget: number;
    spent: number;
    color: string;
  }>;
  className?: string;
}

export function BudgetAlerts({ categoryData, className }: BudgetAlertsProps) {
  const alerts = useMemo(() => {
    const result: BudgetAlert[] = [];

    categoryData.forEach(({ category, type, budget, spent }) => {
      if (budget <= 0) return;

      const percent = (spent / budget) * 100;

      if (percent >= 100) {
        result.push({
          category,
          type,
          budget,
          spent,
          threshold: "over",
          severity: "critical",
        });
      } else if (percent >= 90) {
        result.push({
          category,
          type,
          budget,
          spent,
          threshold: 90,
          severity: "danger",
        });
      } else if (percent >= 80) {
        result.push({
          category,
          type,
          budget,
          spent,
          threshold: 80,
          severity: "warning",
        });
      }
    });

    // Sort by severity (critical first)
    return result.sort((a, b) => {
      const order = { critical: 0, danger: 1, warning: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [categoryData]);

  const severityConfig = {
    warning: {
      bg: "bg-muted/30",
      border: "border-muted",
      icon: AlertTriangle,
      iconColor: "text-muted-foreground",
      label: "À surveiller",
      labelBg: "bg-muted text-foreground",
    },
    danger: {
      bg: "bg-muted/30",
      border: "border-muted",
      icon: AlertTriangle,
      iconColor: "text-foreground",
      label: "Proche de la limite",
      labelBg: "bg-muted text-foreground",
    },
    critical: {
      bg: "bg-muted/30",
      border: "border-[#FF6B4A]/30",
      icon: XCircle,
      iconColor: "text-foreground",
      label: "Budget dépassé",
      labelBg: "bg-[#FF6B4A]/10 text-foreground",
    },
  };

  const typeLabels = {
    needs: "Besoins",
    wants: "Envies",
    savings: "Épargne",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" />
            Alertes budget
          </CardTitle>
          {alerts.length > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {alerts.length} alerte{alerts.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Aucune alerte</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-3">
              <CheckCircle className="h-6 w-6 text-foreground" />
            </div>
            <p className="font-medium text-foreground">
              Tous les budgets sont dans les limites
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Aucune catégorie n’approche de sa limite
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert, idx) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              const percent = (alert.spent / alert.budget) * 100;
              const overBy = alert.spent - alert.budget;

              return (
                <div
                  key={`${alert.category}-${idx}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    config.bg,
                    config.border
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{alert.category}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {typeLabels[alert.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Money amount={alert.spent} /> sur <Money amount={alert.budget} />
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={cn("text-xs", config.labelBg)}>
                      {alert.threshold === "over" ? (
                        <>+<Money amount={overBy} /></>
                      ) : (
                        <>{percent.toFixed(0)}%</>
                      )}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {config.label}
                    </p>
                  </div>
                </div>
              );
            })}
            {alerts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{alerts.length - 5} autre{alerts.length - 5 > 1 ? "s" : ""} alerte{alerts.length - 5 > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
