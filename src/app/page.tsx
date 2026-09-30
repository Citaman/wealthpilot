"use client";

import Link from "next/link";
import { Upload, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { DashboardSkeleton } from "@/components/ui/skeleton-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { useDashboard } from "@/hooks/use-data";
import { useAccount } from "@/contexts/account-context";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { accounts, selectedAccountId } = useAccount();
  const data = useDashboard(selectedAccountId);

  if (data.isLoading) return <AppLayout><DashboardSkeleton /></AppLayout>;
  if (!data.hasData) {
    return <AppLayout><div className="flex min-h-[70vh] items-center justify-center"><EmptyState title="Construisez la situation du foyer" description="Importez un premier relevé, puis le second compte. Les données restent sur cet appareil." primaryAction={{ label: "Importer des transactions", onClick: () => router.push("/import") }} icon={<Upload className="h-6 w-6 text-primary" />} /></div></AppLayout>;
  }

  const scope = selectedAccountId === "all" ? "Foyer · tous les comptes" : accounts.find((account) => account.id === selectedAccountId)?.name || "Compte sélectionné";
  const net = data.totalIncome - data.totalExpenses;
  const today = new Date();
  const remainingWeeks = Math.max(1, Math.ceil((new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1) / 7));
  const weeklyMargin = Math.max(0, net / remainingWeeks);
  const atRisk = data.balance < 0 || net < 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <header><h1 className="text-2xl font-semibold">Situation du foyer aujourd’hui</h1><p className="text-sm text-muted-foreground">{scope} · mois en cours · transferts internes neutralisés</p></header>

        <Card className={atRisk ? "border-destructive/50" : "border-emerald-500/40"}>
          <CardContent className="grid gap-5 pt-6 md:grid-cols-[1fr_auto] md:items-center">
            <div><p className="flex items-center gap-2 text-sm font-medium">{atRisk ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}{atRisk ? "Trajectoire à corriger" : "Trajectoire positive"}</p><p className="mt-2 text-3xl font-semibold tabular-nums"><Money amount={data.balance} /></p><p className="mt-1 text-sm text-muted-foreground">Solde du périmètre sélectionné. Flux net du mois : <Money amount={net} />.</p></div>
            <Button asChild><Link href={atRisk ? "/plan" : "/transactions"}>{atRisk ? "Construire le plan de retour à zéro" : "Vérifier les opérations"}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>

        <section aria-labelledby="month-summary" className="space-y-3"><h2 id="month-summary" className="text-lg font-semibold">Ce mois</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Revenus reconnus" amount={data.totalIncome} detail={`${data.incomeChange >= 0 ? "+" : ""}${data.incomeChange.toFixed(0)} % vs mois précédent`} />
          <Metric label="Dépenses réelles" amount={data.totalExpenses} detail={`${data.expenseChange >= 0 ? "+" : ""}${data.expenseChange.toFixed(0)} % vs mois précédent`} />
          <Metric label="Flux net" amount={net} detail="Revenus moins dépenses, remboursements déduits" />
          <Metric label="Marge hebdomadaire" amount={weeklyMargin} detail={net < 0 ? "Aucune marge : arbitrage nécessaire" : `Répartie sur ${remainingWeeks} semaine(s) restante(s)`} />
        </div></section>

        <section className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><CashFlowChart accountId={selectedAccountId} /></div><UpcomingBills accountId={selectedAccountId} /></section>

        <section aria-labelledby="week-actions" className="space-y-3"><div className="flex items-center justify-between"><h2 id="week-actions" className="text-lg font-semibold">Actions de la semaine</h2><Link href="/transactions" className="text-sm font-medium text-primary hover:underline">Tout vérifier</Link></div><div className="grid gap-3 md:grid-cols-3">
          <Action href="/transactions?category=Unknown" title="Classer les inconnues" description="Fiabiliser les catégories avant toute décision." />
          <Action href="/budgets" title="Arbitrer le budget" description="Voir le disponible et la projection de fin de mois." />
          <Action href="/plan" title="Préparer les 13 semaines" description="Transformer le risque en décisions semaine par semaine." />
        </div></section>

        <RecentTransactions transactions={data.recentTransactions} limit={7} />
      </div>
    </AppLayout>
  );
}

function Metric({ label, amount, detail }: { label: string; amount: number; detail: string }) {
  return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums"><Money amount={amount} /></p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function Action({ href, title, description }: { href: string; title: string; description: string }) {
  return <Card className="relative transition-colors hover:border-primary/50"><CardHeader><CardTitle className="text-base"><Link href={href} className="after:absolute after:inset-0">{title}</Link></CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}
