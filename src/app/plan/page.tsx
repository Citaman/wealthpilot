"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO, subDays, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, CalendarRange, CheckCircle2, Save, ShieldAlert, TrendingUp } from "lucide-react";
import { Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/layout/app-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccount } from "@/contexts/account-context";
import { useMoney } from "@/hooks/use-money";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CATEGORY_TYPES } from "@/lib/budget-types";
import {
  buildCashPlan,
  calculateSafeToSpendThisWeek,
  calculateWeekActual,
  getCashPlanConfigurationStatus,
  type CashPlanAssumptions,
  type CashPlanScenario,
  type MonthlyIncomeSource,
} from "@/lib/cash-plan";
import { db, type Transaction } from "@/lib/db";
import { isRealExpense } from "@/lib/financial-metrics";

const SETTINGS_KEY = "cashPlanAssumptionsV1";

const DEFAULT_INCOMES: MonthlyIncomeSource[] = [
  {
    id: "anthonny-salary",
    name: "Salaire Anthonny",
    dayOfMonth: 25,
    amounts: { cautious: 3690.24, realistic: 3750, recovery: 3888.92 },
    note: "Le scénario prudent reprend le net de septembre. Le bonus de juillet est exclu.",
  },
  {
    id: "mirane-salary",
    name: "Salaire Mirane - estimation nette",
    dayOfMonth: 28,
    startDate: "2026-09-02",
    amounts: { cautious: 1900, realistic: 1950, recovery: 2000 },
    note: "Estimation modifiable à partir de 2 465 € brut. À remplacer par le premier net réellement reçu.",
  },
  {
    id: "caf",
    name: "CAF observée",
    dayOfMonth: 5,
    amounts: { cautious: 711.03, realistic: 711.03, recovery: 711.03 },
    note: "Montant observé chaque mois d'avril à septembre.",
  },
];

interface PersistedPlan {
  scenario: CashPlanScenario;
  incomeSources: MonthlyIncomeSource[];
  weeklyNeeds: number;
  weeklyWants: number;
  monthlyFixedCosts: number;
  fixedCostDay: number;
  taxAdjustmentAmount: number;
  taxAdjustmentDay: number;
  taxPaymentsRemaining: number;
  targetEndBalance: number;
  safetyFloor: number;
  balanceConfirmed: boolean;
  targetConfirmed: boolean;
  floorConfirmed: boolean;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function PlanTrajectoryChart({
  data,
  safetyFloor,
  targetEndBalance,
  formatCurrency,
}: {
  data: Array<{ index: number; closingBalance: number }>;
  safetyFloor: number;
  targetEndBalance: number;
  formatCurrency: (value: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setSize((current) =>
        current.width === Math.floor(width) && current.height === Math.floor(height)
          ? current
          : { width: Math.floor(width), height: Math.floor(height) },
      );
    };
    updateSize(element.clientWidth, element.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-0 min-w-0" aria-label="Trajectoire du solde sur 13 semaines">
      {size.width > 0 && size.height > 0 ? (
        <LineChart width={size.width} height={size.height} data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <XAxis dataKey="index" tickFormatter={(value) => `S${value}`} />
          <YAxis tickFormatter={(value) => formatCurrency(Number(value))} width={70} />
          <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Solde de clôture"]} labelFormatter={(value) => `Semaine ${value}`} />
          <ReferenceLine y={safetyFloor} stroke="#f59e0b" strokeDasharray="4 4" />
          <ReferenceLine y={targetEndBalance} stroke="#10b981" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="closingBalance" stroke="#FF6B4A" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      ) : null}
    </div>
  );
}

function deriveSpendingDefaults(transactions: Transaction[], weeks: number): Pick<PersistedPlan, "weeklyNeeds" | "weeklyWants" | "monthlyFixedCosts"> {
  const debitTransactions = transactions.filter((transaction) => (
    isRealExpense(transaction) &&
    transaction.category !== "Taxes"
  ));
  const recurring = debitTransactions.filter((transaction) => transaction.isRecurring);
  const variable = debitTransactions.filter((transaction) => !transaction.isRecurring);
  const monthCount = Math.max(1, new Set(recurring.map((transaction) => transaction.date.slice(0, 7))).size);
  const monthlyFixedCosts = recurring.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0) / monthCount;
  const weeklyNeeds = variable
    .filter((transaction) => DEFAULT_CATEGORY_TYPES[transaction.category] === "needs")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0) / weeks;
  const weeklyWants = variable
    .filter((transaction) => DEFAULT_CATEGORY_TYPES[transaction.category] !== "needs")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0) / weeks;

  return {
    weeklyNeeds: round(weeklyNeeds),
    weeklyWants: round(weeklyWants),
    monthlyFixedCosts: round(monthlyFixedCosts),
  };
}

function parseStoredPlan(value?: string): PersistedPlan | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as PersistedPlan;
  } catch {
    return null;
  }
}

export default function CashPlanPage() {
  const { accounts, totalBalance } = useAccount();
  const { formatCompactCurrency } = useMoney();
  const { toast } = useToast();
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const historyStart = useMemo(() => format(subWeeks(parseISO(today), 12), "yyyy-MM-dd"), [today]);
  const initialized = useRef(false);

  const recentTransactions = useLiveQuery(
    () => db.transactions.where("date").between(historyStart, today, true, true).toArray(),
    [historyStart, today]
  );
  const checkpoints = useLiveQuery(() => db.balanceCheckpoints.toArray(), [], []);
  const storedSetting = useLiveQuery(
    async () => parseStoredPlan((await db.settings.where("key").equals(SETTINGS_KEY).first())?.value),
    [],
    undefined
  );

  const [plan, setPlan] = useState<PersistedPlan>({
    scenario: "cautious",
    incomeSources: DEFAULT_INCOMES,
    weeklyNeeds: 0,
    weeklyWants: 0,
    monthlyFixedCosts: 0,
    fixedCostDay: 1,
    taxAdjustmentAmount: 854,
    taxAdjustmentDay: 25,
    taxPaymentsRemaining: 3,
    targetEndBalance: 0,
    safetyFloor: -800,
    balanceConfirmed: false,
    targetConfirmed: false,
    floorConfirmed: false,
  });

  useEffect(() => {
    if (initialized.current || recentTransactions === undefined || storedSetting === undefined) return;
    initialized.current = true;
    const defaults = deriveSpendingDefaults(recentTransactions, 12);
    if (storedSetting) {
      const shouldBackfill = !storedSetting.balanceConfirmed && !storedSetting.targetConfirmed &&
        storedSetting.weeklyNeeds === 0 && storedSetting.weeklyWants === 0 && storedSetting.monthlyFixedCosts === 0;
      setPlan({
        ...storedSetting,
        incomeSources: storedSetting.incomeSources?.length ? storedSetting.incomeSources : DEFAULT_INCOMES,
        balanceConfirmed: storedSetting.balanceConfirmed === true,
        targetConfirmed: storedSetting.targetConfirmed === true,
        floorConfirmed: storedSetting.floorConfirmed === true,
        ...(shouldBackfill ? defaults : {}),
      });
      return;
    }
    setPlan((current) => ({ ...current, ...defaults }));
  }, [recentTransactions, storedSetting]);

  const assumptions = useMemo<CashPlanAssumptions>(() => ({
    ...plan,
    startDate: today,
    weeks: 13,
    startingBalance: totalBalance,
  }), [plan, today, totalBalance]);
  const result = useMemo(() => buildCashPlan(assumptions), [assumptions]);
  const configuration = getCashPlanConfigurationStatus(plan);
  const actualsByWeek = useMemo(() => new Map(result.weeks.map((week) => {
    const weekTransactions = (recentTransactions || []).filter((transaction) => transaction.date >= week.startDate && transaction.date <= week.endDate);
    return [week.index, calculateWeekActual(week, weekTransactions)];
  })), [result.weeks, recentTransactions]);
  const safeToSpend = result.weeks[0] ? calculateSafeToSpendThisWeek(result.weeks[0], plan.safetyFloor) : 0;
  const scenarioResults = useMemo(() => (["cautious", "realistic", "recovery"] as const).map((scenario) => ({
    scenario,
    result: buildCashPlan({ ...assumptions, scenario }),
  })), [assumptions]);

  const latestCheckpointByAccount = useMemo(() => {
    const map = new Map<number, string>();
    for (const checkpoint of checkpoints || []) {
      if (!checkpoint.isActive) continue;
      const current = map.get(checkpoint.accountId);
      if (!current || checkpoint.date > current) map.set(checkpoint.accountId, checkpoint.date);
    }
    return map;
  }, [checkpoints]);
  const staleCutoff = format(subDays(parseISO(today), 3), "yyyy-MM-dd");
  const staleAccounts = accounts.filter((account) => {
    if (!account.id) return false;
    const date = latestCheckpointByAccount.get(account.id) || account.initialBalanceDate;
    return date < staleCutoff;
  });

  const setNumber = (key: keyof PersistedPlan, value: string) => {
    setPlan((current) => ({ ...current, [key]: Number(value) || 0 }));
  };
  const setIncomeAmount = (sourceId: string, value: string) => {
    setPlan((current) => ({
      ...current,
      incomeSources: current.incomeSources.map((source) => source.id === sourceId
        ? { ...source, amounts: { ...source.amounts, [current.scenario]: Number(value) || 0 } }
        : source),
    }));
  };
  const setIncomeDay = (sourceId: string, value: string) => {
    const dayOfMonth = Math.min(31, Math.max(1, Math.floor(Number(value) || 1)));
    setPlan((current) => ({
      ...current,
      incomeSources: current.incomeSources.map((source) => source.id === sourceId
        ? { ...source, dayOfMonth }
        : source),
    }));
  };

  const handleSave = async () => {
    const existing = await db.settings.where("key").equals(SETTINGS_KEY).first();
    const value = JSON.stringify(plan);
    if (existing?.id) await db.settings.update(existing.id, { value });
    else await db.settings.add({ key: SETTINGS_KEY, value });
    toast({ variant: "success", title: "Plan enregistré", description: "Les hypothèses du foyer sont enregistrées localement." });
  };

  const room = result.endingBalance - plan.targetEndBalance;
  const finalTaxWeek = [...result.weeks].reverse().find((week) => week.tax > 0)?.index ?? null;
  const hasExpenseAssumptions = plan.weeklyNeeds > 0 || plan.weeklyWants > 0 || plan.monthlyFixedCosts > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">13 semaines</Badge>
              <Badge variant="outline">Foyer</Badge>
              <Badge
                variant={configuration.isReady && result.targetGap === 0 ? "default" : "outline"}
                className={!configuration.isReady || result.targetGap > 0 ? "border-destructive/30 bg-destructive/10 text-destructive" : undefined}
              >
                {!configuration.isReady ? "Configuration à confirmer" : result.targetGap === 0 ? "Objectif couvert" : "Action requise"}
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Le plan part du solde consolidé des comptes et place chaque revenu ou dépense dans sa semaine réelle.
            </p>
          </div>
          <Button onClick={handleSave} disabled={!configuration.isReady} className="gap-2"><Save className="h-4 w-4" />Enregistrer le plan</Button>
        </div>

        {staleAccounts.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Les soldes doivent être actualisés</AlertTitle>
            <AlertDescription>
              {staleAccounts.map((account) => `${account.name} : ${latestCheckpointByAccount.get(account.id!) || account.initialBalanceDate}`).join(" · ")}. Ajoutez un checkpoint récent avant de considérer cette projection comme fiable.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Solde de départ</p><p className="mt-2 text-2xl font-semibold"><Money amount={totalBalance} /></p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Point le plus bas</p><p className="mt-2 text-2xl font-semibold"><Money amount={result.lowestBalance} /></p><p className="text-sm text-muted-foreground">{result.weeks.find((week) => week.lowestBalance === result.lowestBalance) ? format(parseISO(result.weeks.find((week) => week.lowestBalance === result.lowestBalance)!.startDate), "dd/MM") : "—"}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Disponible cette semaine</p><p className="mt-2 text-2xl font-semibold"><Money amount={configuration.isReady ? safeToSpend : 0} /></p><p className="text-sm text-muted-foreground">sans franchir le plancher</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Écart à l’objectif</p><p className={`mt-2 text-2xl font-semibold ${configuration.isReady && room >= 0 ? "text-emerald-600" : "text-destructive"}`}><Money amount={configuration.isReady ? room : 0} /></p></CardContent></Card>
        </div>

        <Card className={!configuration.isReady ? "border-destructive/40" : undefined}>
          <CardHeader>
            <CardTitle>Conditions de confiance</CardTitle>
            <CardDescription>Le résultat ne sera jamais présenté comme un surplus tant que le solde, l’objectif et le plancher ne sont pas confirmés.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={plan.balanceConfirmed} onCheckedChange={(checked) => setPlan((current) => ({ ...current, balanceConfirmed: checked === true }))} />
              <span><span className="block font-medium">Soldes confirmés</span><span className="text-sm text-muted-foreground"><Money amount={totalBalance} /> aujourd’hui</span></span>
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={plan.targetConfirmed} onCheckedChange={(checked) => setPlan((current) => ({ ...current, targetConfirmed: checked === true }))} />
              <span><span className="block font-medium">Objectif confirmé</span><span className="text-sm text-muted-foreground"><Money amount={plan.targetEndBalance} /> à 13 semaines</span></span>
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={plan.floorConfirmed} onCheckedChange={(checked) => setPlan((current) => ({ ...current, floorConfirmed: checked === true }))} />
              <span><span className="block font-medium">Plancher confirmé</span><span className="text-sm text-muted-foreground"><Money amount={plan.safetyFloor} /> minimum</span></span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scénario</CardTitle>
            <CardDescription>Comparez les hypothèses sans modifier le solde réel de départ.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {scenarioResults.map(({ scenario, result: scenarioResult }) => (
              <button
                key={scenario}
                type="button"
                className={`rounded-lg border p-4 text-left transition-colors ${plan.scenario === scenario ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                onClick={() => setPlan((current) => ({ ...current, scenario }))}
              >
                <span className="text-sm font-medium">{scenario === "cautious" ? "Prudent" : scenario === "realistic" ? "Réaliste" : "Reprise"}</span>
                <span className="mt-2 block text-xl font-semibold">{configuration.isReady && hasExpenseAssumptions ? <Money amount={scenarioResult.endingBalance} /> : "À confirmer"}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{configuration.isReady && hasExpenseAssumptions ? <>point bas <Money amount={scenarioResult.lowestBalance} /></> : "Renseignez puis confirmez les hypothèses"}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {!hasExpenseAssumptions && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dépenses non renseignées</AlertTitle>
            <AlertDescription>
              La trajectoire ci-dessous ne retranche encore aucune dépense courante. Renseignez les enveloppes et coûts fixes avant d’utiliser le solde projeté pour décider.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader><CardTitle>Hypothèses du foyer</CardTitle><CardDescription>Chaque montant est modifiable et reste stocké dans ce navigateur.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              {plan.incomeSources.map((source) => (
                <div key={source.id} className="space-y-2 rounded-lg border p-3">
                  <Label>{source.name}</Label>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <Input aria-label={`${source.name} amount`} type="number" step="0.01" value={source.amounts[plan.scenario]} onChange={(event) => setIncomeAmount(source.id, event.target.value)} />
                    <Input aria-label={`${source.name} payment day`} type="number" min="1" max="31" value={source.dayOfMonth} onChange={(event) => setIncomeDay(source.id, event.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">Montant et jour de versement ({source.dayOfMonth})</p>
                  {source.note && <p className="text-xs text-muted-foreground">{source.note}</p>}
                </div>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Enveloppe essentielle par semaine</Label><Input type="number" step="0.01" value={plan.weeklyNeeds} onChange={(event) => setNumber("weeklyNeeds", event.target.value)} /></div>
                <div className="space-y-2"><Label>Enveloppe flexible par semaine</Label><Input type="number" step="0.01" value={plan.weeklyWants} onChange={(event) => setNumber("weeklyWants", event.target.value)} /></div>
                <div className="space-y-2"><Label>Coûts fixes mensuels</Label><Input type="number" step="0.01" value={plan.monthlyFixedCosts} onChange={(event) => setNumber("monthlyFixedCosts", event.target.value)} /></div>
                <div className="space-y-2"><Label>Prélèvement fiscal temporaire</Label><Input type="number" step="0.01" value={plan.taxAdjustmentAmount} onChange={(event) => setNumber("taxAdjustmentAmount", event.target.value)} /></div>
                <div className="space-y-2"><Label>Prélèvements fiscaux restants</Label><Input type="number" min="0" max="12" value={plan.taxPaymentsRemaining} onChange={(event) => setNumber("taxPaymentsRemaining", event.target.value)} /></div>
                <div className="space-y-2"><Label>Objectif à 13 semaines</Label><Input type="number" step="0.01" value={plan.targetEndBalance} onChange={(event) => setPlan((current) => ({ ...current, targetEndBalance: Number(event.target.value) || 0, targetConfirmed: false }))} /></div>
                <div className="space-y-2"><Label>Plancher de sécurité</Label><Input type="number" step="0.01" value={plan.safetyFloor} onChange={(event) => setPlan((current) => ({ ...current, safetyFloor: Number(event.target.value) || 0, floorConfirmed: false }))} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Trajectoire hebdomadaire</CardTitle><CardDescription>Solde de clôture après enveloppes et mouvements datés.</CardDescription></CardHeader>
              <CardContent className="h-[320px]">
                <PlanTrajectoryChart
                  data={result.weeks}
                  safetyFloor={plan.safetyFloor}
                  targetEndBalance={plan.targetEndBalance}
                  formatCurrency={formatCompactCurrency}
                />
              </CardContent>
            </Card>

            <Alert variant={!configuration.isReady || result.targetGap > 0 ? "destructive" : "default"}>
              {!configuration.isReady || result.targetGap > 0 ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertTitle>{!configuration.isReady ? "Projection non validée" : result.targetGap > 0 ? "Plan de reprise nécessaire" : "L’objectif est couvert"}</AlertTitle>
              <AlertDescription className="space-y-1">
                {!configuration.isReady ? (
                  <p>Confirmez les trois conditions ci-dessus. Les montants calculés restent indicatifs jusque-là.</p>
                ) : result.targetGap > 0 ? (
                  <>
                    <p>Il faut combler <Money amount={result.targetGap} />, soit <Money amount={result.requiredWeeklyImprovement} /> par semaine.</p>
                    <p>Réduisez d’abord l’enveloppe flexible; le reste doit venir d’un revenu supplémentaire ou d’un coût fixe réduit.</p>
                  </>
                ) : (
                  <p>Le plan conserve <Money amount={room} /> au-dessus de l’objectif. Gardez cette marge disponible tant que les soldes ne sont pas actualisés.</p>
                )}
                {result.firstBelowFloorWeek && <p>Le plancher est franchi pendant la semaine {result.firstBelowFloorWeek}.</p>}
                {finalTaxWeek && <p>Le prélèvement temporaire de <Money amount={plan.taxAdjustmentAmount} /> s’arrête après la semaine {finalTaxWeek}.</p>}
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />Plan semaine par semaine</CardTitle><CardDescription>Le prévu et le réalisé sont séparés pour rendre chaque décision vérifiable.</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-3 md:hidden">
              {result.weeks.map((week) => {
                const actual = actualsByWeek.get(week.index)!;
                return <article key={week.index} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Semaine {week.index}</p><p className="text-sm text-muted-foreground">{format(parseISO(week.startDate), "dd/MM")} – {format(parseISO(week.endDate), "dd/MM")}</p></div><p className="font-semibold"><Money amount={week.closingBalance} /></p></div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Prévu à dépenser</dt><dd><Money amount={week.needs + week.wants} /></dd></div><div><dt className="text-muted-foreground">Réalisé</dt><dd><Money amount={actual.spending} /></dd></div><div><dt className="text-muted-foreground">Reste enveloppe</dt><dd><Money amount={actual.remainingEnvelope} /></dd></div><div><dt className="text-muted-foreground">Point bas</dt><dd><Money amount={week.lowestBalance} /></dd></div></dl>
                </article>;
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-3 pr-3">Semaine</th><th className="px-3 text-right">Ouverture</th><th className="px-3 text-right">Revenus</th><th className="px-3 text-right">Fixes + impôts</th><th className="px-3 text-right">Prévu</th><th className="px-3 text-right">Réalisé</th><th className="px-3 text-right">Reste</th><th className="pl-3 text-right">Clôture</th></tr></thead>
              <tbody>
                {result.weeks.map((week) => (
                  <tr key={week.index} className="border-b last:border-0">
                    <td className="py-3 pr-3"><p className="font-medium">Semaine {week.index}</p><p className="text-xs text-muted-foreground">{format(parseISO(week.startDate), "dd MMM", { locale: fr })} - {format(parseISO(week.endDate), "dd MMM", { locale: fr })}</p></td>
                    <td className="px-3 text-right"><Money amount={week.openingBalance} /></td>
                    <td className="px-3 text-right text-emerald-600"><Money amount={week.income} /></td>
                    <td className="px-3 text-right"><Money amount={week.fixedCosts + week.tax} /></td>
                    <td className="px-3 text-right"><Money amount={week.needs + week.wants} /></td>
                    <td className="px-3 text-right"><Money amount={actualsByWeek.get(week.index)?.spending || 0} /></td>
                    <td className={`px-3 text-right ${(actualsByWeek.get(week.index)?.remainingEnvelope || 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}><Money amount={actualsByWeek.get(week.index)?.remainingEnvelope || 0} /></td>
                    <td className="pl-3 text-right font-semibold"><Money amount={week.closingBalance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
