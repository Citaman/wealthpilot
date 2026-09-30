"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
} from "recharts";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { MeasuredChart } from "@/components/ui/measured-chart";
import { useMoney } from "@/hooks/use-money";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string; dataKey?: string; payload?: Record<string, unknown> }>;
  label?: string;
}

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
  className?: string;
}

export function BudgetVsActual({
  budgets,
  actuals,
  className,
}: BudgetVsActualProps) {
  const { formatCompactCurrency } = useMoney();
  const data = useMemo(() => {
    return [
      {
        name: "Besoins",
        budget: budgets.needs,
        actual: actuals.needs,
        color: "rgb(var(--chart-1))",
        budgetColor: "rgb(var(--muted-foreground))",
      },
      {
        name: "Envies",
        budget: budgets.wants,
        actual: actuals.wants,
        color: "rgb(var(--chart-2))",
        budgetColor: "rgb(var(--muted-foreground))",
      },
      {
        name: "Épargne",
        budget: budgets.savings,
        actual: actuals.savings,
        color: "rgb(var(--chart-4))",
        budgetColor: "rgb(var(--muted-foreground))",
      },
    ];
  }, [budgets, actuals]);

  // Calculate overall budget health
  const totalBudget = budgets.needs + budgets.wants + budgets.savings;
  const totalSpent = actuals.needs + actuals.wants;
  const overallStatus = totalSpent <= totalBudget * 0.8 ? "good" : totalSpent <= totalBudget ? "warning" : "danger";

  const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (!active || !payload) return null;

    const item = payload[0]?.payload as unknown as { name: string; budget: number; actual: number; color: string; budgetColor: string } | undefined;
    if (!item) return null;

    const diff = item.budget - item.actual;
    const percent = item.budget > 0 ? ((item.actual / item.budget) * 100).toFixed(0) : 0;

    return (
      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Budget :</span>
            <span className="font-medium"><Money amount={item.budget} /></span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Réalisé :</span>
            <span className="font-medium"><Money amount={item.actual} /></span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t text-foreground">
            <span>{diff >= 0 ? "Reste :" : "Dépassement :"}</span>
            <span className="font-bold"><Money amount={Math.abs(diff)} /></span>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-1">
            {percent} % du budget utilisé
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Budget et réalisé</CardTitle>
          <Badge
            variant={overallStatus === "good" ? "default" : "secondary"}
          >
            {overallStatus === "good" && (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Dans les limites
              </>
            )}
            {overallStatus === "warning" && (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                À surveiller
              </>
            )}
            {overallStatus === "danger" && (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Dépassé
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <MeasuredChart className="h-[200px]" ariaLabel="Budget prévu et réalisé">
          {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                barGap={-20}
              >
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatCompactCurrency(value)}
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
                  fill="rgb(var(--muted-foreground))"
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
                      fill={entry.color}
                    />
                  ))}
                </Bar>
              </BarChart>
          )}
        </MeasuredChart>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-muted-foreground opacity-40" />
            <span className="text-muted-foreground">Budget</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded" style={{ backgroundColor: "rgb(var(--chart-1))" }} />
            <span className="text-muted-foreground">Réalisé</span>
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
                <p className="text-sm font-semibold text-foreground">
                  {isOver ? "-" : "+"}<Money amount={Math.abs(diff)} />
                </p>
              </div>
            );
          })}
        </div>
        <details className="mt-4 rounded-lg border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Données du budget</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] tabular-nums">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Type</th><th className="text-right">Budget</th><th className="text-right">Réalisé</th><th className="text-right">Écart</th></tr></thead>
              <tbody>{data.map((item) => <tr key={item.name} className="border-b last:border-0"><th scope="row" className="py-2 text-left font-medium">{item.name}</th><td className="text-right"><Money amount={item.budget} /></td><td className="text-right"><Money amount={item.actual} /></td><td className="text-right">{item.budget - item.actual >= 0 ? "+" : "−"}<Money amount={Math.abs(item.budget - item.actual)} /></td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
