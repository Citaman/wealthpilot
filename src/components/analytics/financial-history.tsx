"use client";

import { cloneElement, isValidElement, useMemo } from "react";
import Link from "next/link";
import { BarChart3, BriefcaseBusiness, Layers3, Scale } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { MeasuredChart } from "@/components/ui/measured-chart";
import { useMoney } from "@/hooks/use-money";
import { CATEGORIES, type Account } from "@/lib/db";
import {
  getTopExpenseCategories,
  summarizeFinancialHistory,
  type MonthlyFinancialPoint,
} from "@/lib/monthly-analysis";

interface FinancialHistoryProps {
  history: MonthlyFinancialPoint[];
  accounts: Account[];
}

interface TooltipEntry {
  dataKey?: string;
  name?: string;
  value?: number;
  color?: string;
}

interface HistoryTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}

const FALLBACK_COLORS = ["rgb(var(--chart-1))", "rgb(var(--chart-2))", "rgb(var(--chart-4))", "rgb(var(--chart-3))", "rgb(var(--chart-5))"];

function HistoryTooltip({ active, label, payload }: HistoryTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-lg border bg-popover p-3 text-sm shadow-lg">
      <p className="mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={`${entry.dataKey}-${entry.name}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <Money amount={Number(entry.value || 0)} className="font-medium" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <MeasuredChart className="h-[280px] min-h-[280px]" ariaLabel="Graphique financier">
      {({ width, height }) => isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ width?: number; height?: number }>, { width, height })
        : null}
    </MeasuredChart>
  );
}

export function FinancialHistory({ history, accounts }: FinancialHistoryProps) {
  const { formatCompactCurrency } = useMoney();
  const summary = useMemo(() => summarizeFinancialHistory(history), [history]);
  const topCategories = useMemo(() => getTopExpenseCategories(history, 5), [history]);
  const accountNames = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const categoryData = useMemo(() => history.map((point) => {
    const row: Record<string, string | number | boolean> = {
      label: point.label,
      isPartial: point.isPartial,
    };
    let other = 0;
    for (const [category, amount] of Object.entries(point.categories)) {
      if (topCategories.includes(category)) row[category] = amount;
      else other += amount;
    }
    if (other > 0) row.Other = other;
    return row;
  }), [history, topCategories]);
  const hasOther = categoryData.some((row) => Number(row.Other || 0) > 0);
  const salaryHistory = history.filter((point) => point.salary > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" />Revenus et dépenses</CardTitle>
            <CardDescription>Les virements entre comptes liés sont neutralisés et les remboursements déduits.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartFrame>
              <ComposedChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip content={<HistoryTooltip />} />
                <Legend />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="income" name="Revenus" fill="rgb(var(--income))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Dépenses" fill="rgb(var(--expense))" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net" stroke="rgb(var(--chart-2))" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartFrame>
            {history.some((point) => point.isPartial) && <p className="mt-2 text-xs text-muted-foreground">Le mois le plus récent est incomplet et exclu des moyennes.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5" />Dépenses fixes et variables</CardTitle>
            <CardDescription>Le fixe inclut les récurrents, le logement, les factures et la garde d’enfants.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartFrame>
              <ComposedChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip content={<HistoryTooltip />} />
                <Legend />
                <Bar dataKey="fixedExpenses" name="Fixes" stackId="spending" fill="rgb(var(--chart-2))" />
                <Bar dataKey="variableExpenses" name="Variables" stackId="spending" fill="rgb(var(--expense))" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ChartFrame>
            <details className="mt-3 rounded-lg border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Données fixes et variables</summary>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] tabular-nums"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Mois</th><th className="text-right">Fixes</th><th className="text-right">Variables</th></tr></thead><tbody>{history.map((point) => <tr key={point.month} className="border-b last:border-0"><th scope="row" className="py-2 text-left font-medium">{point.label}</th><td className="text-right"><Money amount={point.fixedExpenses} /></td><td className="text-right"><Money amount={point.variableExpenses} /></td></tr>)}</tbody></table></div>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Dépenses mensuelles par catégorie</CardTitle>
          <CardDescription>Les cinq premières catégories sont séparées ; les autres sont regroupées.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartFrame>
            <ComposedChart data={categoryData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<HistoryTooltip />} />
              <Legend />
              {topCategories.map((category, index) => (
                <Bar
                  key={category}
                  dataKey={category}
                  name={category}
                  stackId="category"
                  fill={CATEGORIES[category]?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                />
              ))}
              {hasOther && <Bar dataKey="Other" name="Autres" stackId="category" fill="rgb(var(--muted-foreground))" radius={[4, 4, 0, 0]} />}
            </ComposedChart>
          </ChartFrame>
          <details className="mt-3 rounded-lg border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">Données des catégories</summary>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] tabular-nums"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Mois</th>{topCategories.map((category) => <th key={category} className="px-2 text-right">{category}</th>)}{hasOther && <th className="text-right">Autres</th>}</tr></thead><tbody>{categoryData.map((row) => <tr key={String(row.label)} className="border-b last:border-0"><th scope="row" className="py-2 text-left font-medium">{String(row.label)}</th>{topCategories.map((category) => <td key={category} className="px-2 text-right"><Money amount={Number(row[category] || 0)} /></td>)}{hasOther && <td className="text-right"><Money amount={Number(row.Other || 0)} /></td>}</tr>)}</tbody></table></div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5" />Évolution des salaires</CardTitle>
          <CardDescription>Salaires uniquement : bonus visibles, CAF, remboursements et virements exclus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><p className="text-xs uppercase text-muted-foreground">Dernier salaire</p><p className="mt-1 text-xl font-semibold"><Money amount={summary.latestSalary} /></p></div>
            <div className="rounded-lg border p-3"><p className="text-xs uppercase text-muted-foreground">Salaire médian</p><p className="mt-1 text-xl font-semibold"><Money amount={summary.medianSalary} /></p></div>
            <div className="rounded-lg border p-3"><p className="text-xs uppercase text-muted-foreground">Dernier vs médiane</p><p className={`mt-1 text-xl font-semibold ${summary.salaryVariance >= 0 ? "text-emerald-600" : "text-destructive"}`}><Money amount={summary.salaryVariance} /></p></div>
          </div>
          {salaryHistory.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Aucun salaire détecté sur cette période.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Mois</th><th className="px-3">Compte</th><th className="py-2 pl-3 text-right">Salaire reçu</th><th className="py-2 pl-3 text-right">Détail</th></tr></thead>
                <tbody>
                  {salaryHistory.map((point) => (
                    <tr key={point.month} className="border-b last:border-0">
                      <td className="py-3 pr-3 font-medium">{point.label}{point.isPartial ? " (en cours)" : ""}</td>
                      <td className="px-3 text-muted-foreground">
                        {Object.entries(point.salaryByAccount).map(([accountId, amount]) => `${accountNames.get(Number(accountId)) || `Compte ${accountId}`} : ${formatCompactCurrency(amount)}`).join(" · ")}
                      </td>
                      <td className="py-3 pl-3 text-right font-semibold"><Money amount={point.salary} /></td>
                      <td className="py-3 pl-3 text-right"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/transactions?start=${point.month}-01&end=${point.month}-${new Date(Number(point.month.slice(0, 4)), Number(point.month.slice(5, 7)), 0).getDate()}&direction=credit`}>Voir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
