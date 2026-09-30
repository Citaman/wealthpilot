"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, PiggyBank } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/ui/money";
import {
  RecurringExpenses,
  SpendingCalendar,
  TopMerchants,
} from "@/components/analytics";
import { FinancialHistory } from "@/components/analytics/financial-history";
import { useTransactions } from "@/hooks/use-data";
import { useAccount } from "@/contexts/account-context";
import { useMoney } from "@/hooks/use-money";
import { buildMonthlyFinancialHistory, summarizeFinancialHistory } from "@/lib/monthly-analysis";
import { calculateFinancialMetrics } from "@/lib/financial-metrics";
import Link from "next/link";

type Period = "1m" | "3m" | "6m" | "12m" | "ytd";

export default function AnalyticsPage() {
  const { selectedAccountId, accounts } = useAccount();
  const { convertFromAccount } = useMoney();
  const [period, setPeriod] = useState<Period>("ytd");
  const now = useMemo(() => new Date(), []);

  const dateRange = useMemo(() => {
    switch (period) {
      case "1m":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "3m":
        return { start: subMonths(startOfMonth(now), 2), end: endOfMonth(now) };
      case "6m":
        return { start: subMonths(startOfMonth(now), 5), end: endOfMonth(now) };
      case "12m":
        return { start: subMonths(startOfMonth(now), 11), end: endOfMonth(now) };
      case "ytd":
        return { start: startOfYear(now), end: endOfMonth(now) };
    }
  }, [period, now]);

  const { transactions, isLoading } = useTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: selectedAccountId,
    excludeExcluded: true,
  });
  const history = useMemo(
    () => buildMonthlyFinancialHistory(transactions, dateRange.start, dateRange.end, convertFromAccount, now),
    [transactions, dateRange, convertFromAccount, now]
  );
  const stats = useMemo(() => summarizeFinancialHistory(history), [history]);
  const quality = useMemo(() => calculateFinancialMetrics(transactions, convertFromAccount), [transactions, convertFromAccount]);
  const scopeLabel = selectedAccountId === "all"
    ? "Foyer · tous les comptes"
    : accounts.find((account) => account.id === selectedAccountId)?.name || "Compte sélectionné";
  const periodLabel = `${format(dateRange.start, "dd MMM yyyy", { locale: fr })} – ${format(dateRange.end, "dd MMM yyyy", { locale: fr })}`;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Analyse financière</h1>
            <p className="text-sm text-muted-foreground">{scopeLabel} · {periodLabel}</p>
            <p className="text-xs text-muted-foreground">Remboursements déduits · transferts internes appariés neutralisés · mois en cours exclu des moyennes</p>
          </div>
          <Tabs value={period} onValueChange={(value) => setPeriod(value as Period)} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-5 sm:w-auto">
              <TabsTrigger className="min-h-11" value="1m">1M</TabsTrigger>
              <TabsTrigger className="min-h-11" value="3m">3M</TabsTrigger>
              <TabsTrigger className="min-h-11" value="6m">6M</TabsTrigger>
              <TabsTrigger className="min-h-11" value="12m">12M</TabsTrigger>
              <TabsTrigger className="min-h-11" value="ytd">Année</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <SummaryCard label="Revenus reconnus" amount={stats.totalIncome} detail="Total sur la période" icon={<ArrowUpRight className="h-5 w-5" />} />
          <SummaryCard label="Dépenses réelles" amount={stats.totalExpenses} detail="Total net des remboursements" icon={<ArrowDownRight className="h-5 w-5" />} />
          <SummaryCard label="Flux net" amount={stats.net} detail={stats.net >= 0 ? "Excédent sur la période" : "Déficit sur la période"} icon={<PiggyBank className="h-5 w-5" />} />
          <SummaryCard label="Dépenses mensuelles moyennes" amount={stats.averageMonthlyExpenses} detail="Mois complets uniquement" icon={<BarChart3 className="h-5 w-5" />} />
          <SummaryCard label="Revenus mensuels moyens" amount={stats.averageMonthlyIncome} detail="Mois complets uniquement" icon={<CircleDollarSign className="h-5 w-5" />} />
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((index) => <div key={index} className="h-[360px] animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : transactions.length === 0 ? (
          <Card><CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 py-8 text-center"><p className="text-sm text-muted-foreground">Aucune transaction sur cette période.</p><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => setPeriod("12m")}>Voir les 12 derniers mois</Button><Button asChild><Link href="/import">Importer un relevé</Link></Button></div></CardContent></Card>
        ) : (
          <>
            <FinancialHistory history={history} accounts={accounts} />

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div><h2 className="font-semibold">Détail mensuel accessible</h2><p className="text-sm text-muted-foreground">Chaque ligne ouvre les transactions de la période.</p></div>
                  <p className="text-sm text-muted-foreground">Qualité : {quality.unrecognizedCredits ? `${quality.unrecognizedCredits.toFixed(2)} € de crédits à vérifier` : "aucun crédit non reconnu"}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Mois</th><th className="text-right">Revenus</th><th className="text-right">Dépenses</th><th className="text-right">Net</th><th className="text-right">Détail</th></tr></thead>
                    <tbody>{history.map((point) => <tr key={point.month} className="border-b last:border-0"><th scope="row" className="py-3 text-left font-medium">{point.label}{point.isPartial ? " (en cours)" : ""}</th><td className="text-right"><Money amount={point.income} /></td><td className="text-right"><Money amount={point.expenses} /></td><td className="text-right font-semibold"><Money amount={point.net} /></td><td className="text-right"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/transactions?start=${point.month}-01&end=${point.month}-${new Date(Number(point.month.slice(0,4)), Number(point.month.slice(5,7)), 0).getDate()}`}>Voir</Link></td></tr>)}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <TopMerchants transactions={transactions} />
              <RecurringExpenses transactions={transactions} />
            </div>

            <SpendingCalendar transactions={transactions} className="col-span-full" />
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, amount, detail, icon }: { label: string; amount: number; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold"><Money amount={amount} /></p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
