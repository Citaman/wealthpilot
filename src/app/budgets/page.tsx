"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Calculator,
  PieChart,
  Wallet,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, addMonths, format, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBudgets, useTransactions } from "@/hooks/use-data";
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";
import { 
  BudgetVsActual, 
  BudgetPace, 
  BudgetAlerts, 
  CategoryBudgetCard,
  CategoryTypeOverrides,
} from "@/components/budgets";
import {
  useCategoryTypeOverrides,
  useTransactionTypeOverrides,
  getCategoryBudgetType,
  getTransactionBudgetType,
  BudgetType,
} from "@/lib/budget-types";
import { useSmartIncome } from "@/lib/financial-month";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { calculateFinancialMetrics, isRealExpense } from "@/lib/financial-metrics";
import { getBudgetPreferences, saveBudgetPreferences, type BudgetPreferences } from "@/lib/budgets";

// Budget rule presets
const BUDGET_PRESETS = [
  { id: "50-30-20", name: "Règle 50/30/20", needs: 50, wants: 30, savings: 20, description: "Répartition équilibrée classique" },
  { id: "60-20-20", name: "60/20/20 prudent", needs: 60, wants: 20, savings: 20, description: "Plus de marge pour les dépenses essentielles" },
  { id: "70-20-10", name: "70/20/10 flexible", needs: 70, wants: 20, savings: 10, description: "Pour un coût de la vie plus élevé" },
  { id: "custom", name: "Personnalisé", needs: 50, wants: 30, savings: 20, description: "Définissez vos propres pourcentages" },
];

export default function BudgetsPage() {
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(today));
  const currentYear = selectedMonth.getFullYear();
  const currentMonth = selectedMonth.getMonth();
  const isCurrentMonth = isSameMonth(selectedMonth, today);
  const { convertFromAccount, formatBase } = useMoney();

  const { budgets, setBudget } = useBudgets();
  
  // Current month transactions
  const { transactions } = useTransactions({
    startDate: startOfMonth(selectedMonth),
    endDate: endOfMonth(selectedMonth),
    excludeExcluded: true,
    accountId: "all",
  });

  // Previous month transactions for comparison
  const lastMonth = subMonths(selectedMonth, 1);
  const { transactions: prevTransactions } = useTransactions({
    startDate: startOfMonth(lastMonth),
    endDate: endOfMonth(lastMonth),
    excludeExcluded: true,
    accountId: "all",
  });

  // Smart income calculation (excludes outliers/bonuses)
  const smartIncome = useSmartIncome(6); // Look at last 6 months
  
  // Category type overrides
  const categoryOverrides = useCategoryTypeOverrides();
  const txOverrides = useTransactionTypeOverrides();
  const [overrideKey, setOverrideKey] = useState(0); // Force refresh when overrides change

  const [selectedPreset, setSelectedPreset] = useState("50-30-20");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [customAllocations, setCustomAllocations] = useState({
    needs: 50,
    wants: 30,
    savings: 20,
  });
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBudgetPreferences()
      .then((preferences) => {
        if (!active) return;
        setSelectedPreset(preferences.preset);
        setMonthlyIncome(preferences.monthlyIncome);
        setCustomAllocations(preferences.customAllocations);
        setPreferencesLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setPreferenceError("Impossible de charger les paramètres enregistrés.");
        setPreferencesLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const persistPreferences = useCallback(async (next: BudgetPreferences) => {
    setPreferenceStatus("Enregistrement…");
    setPreferenceError(null);
    try {
      await saveBudgetPreferences(next);
      setPreferenceStatus("Enregistré");
    } catch {
      setPreferenceStatus(null);
      setPreferenceError("Échec de l’enregistrement. Réessayez.");
    }
  }, []);

  // Helper to get category type with override support
  const getCategoryType = useCallback((category: string): BudgetType => {
    void overrideKey;
    return getCategoryBudgetType(category, categoryOverrides || {});
  }, [categoryOverrides, overrideKey]);

  const getTransactionType = useCallback((t: Transaction): BudgetType => {
    void overrideKey;
    return getTransactionBudgetType(t, categoryOverrides || {}, txOverrides || {});
  }, [categoryOverrides, txOverrides, overrideKey]);

  // Calculate actual income from transactions (simple sum)
  const currentMetrics = useMemo(() => calculateFinancialMetrics(transactions, convertFromAccount), [transactions, convertFromAccount]);
  const actualIncome = currentMetrics.income;

  // Use smart income average if available, otherwise actual income
  // Smart income excludes bonuses/outliers for more stable budgeting
  const smartIncomeValue = smartIncome?.averageSalary || actualIncome;

  // Use manual input if provided, otherwise use smart income
  const incomeToUse = monthlyIncome ? parseFloat(monthlyIncome) : smartIncomeValue;

  // Get current preset allocations
  const currentPreset = BUDGET_PRESETS.find((p) => p.id === selectedPreset);
  const allocations =
    selectedPreset === "custom"
      ? customAllocations
      : { needs: currentPreset?.needs || 50, wants: currentPreset?.wants || 30, savings: currentPreset?.savings || 20 };

  // Calculate budget amounts based on allocations
  const budgetAmounts = useMemo(() => ({
    needs: (incomeToUse * allocations.needs) / 100,
    wants: (incomeToUse * allocations.wants) / 100,
    savings: (incomeToUse * allocations.savings) / 100,
  }), [incomeToUse, allocations.needs, allocations.wants, allocations.savings]);

  // Calculate spending by type (respects category overrides)
  const spendingByType = useMemo(() => {
    const result = { needs: 0, wants: 0, savings: 0 };
    transactions
      .filter(isRealExpense)
      .forEach((t) => {
        const type = getTransactionType(t);
        if (type && type !== "income") {
          result[type] += Math.abs(convertFromAccount(t.amount, t.accountId));
        }
      });
    return result;
  }, [transactions, getTransactionType, convertFromAccount]);

  // Calculate spending by category
  const spendingByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(isRealExpense)
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + Math.abs(convertFromAccount(t.amount, t.accountId));
      });
    return result;
  }, [transactions, convertFromAccount]);

  // Previous month spending by category
  const prevSpendingByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    prevTransactions
      .filter(isRealExpense)
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + Math.abs(convertFromAccount(t.amount, t.accountId));
      });
    return result;
  }, [prevTransactions, convertFromAccount]);

  // Get budget for a category
  const getCategoryBudget = useCallback((category: string) => {
    const existing = budgets.find(
      (b) => b.category === category && b.year === currentYear && b.period === "monthly" && b.month === currentMonth
    ) || budgets.find((b) => b.category === category && b.year === currentYear && b.period === "yearly");
    if (existing) return existing.period === "yearly" ? existing.amount / 12 : existing.amount;

    // Calculate default based on type (respects overrides)
    const type = getCategoryType(category);
    if (!type || type === "income") return 0;

    // Distribute budget among categories of the same type
    const categoriesOfType = Object.keys(CATEGORIES).filter(
      (cat) => getCategoryType(cat) === type
    );
    return budgetAmounts[type] / categoriesOfType.length;
  }, [budgets, currentYear, currentMonth, getCategoryType, budgetAmounts]);

  // Prepare category data for alerts
  const categoryAlertData = useMemo(() => {
    return Object.entries(CATEGORIES)
      .filter(([cat]) => {
        const type = getCategoryType(cat);
        return type && type !== "income";
      })
      .map(([category, info]) => ({
        category,
        type: getCategoryType(category) as "needs" | "wants" | "savings",
        budget: getCategoryBudget(category),
        spent: spendingByCategory[category] || 0,
        color: info.color,
      }));
  }, [getCategoryType, getCategoryBudget, spendingByCategory]);

  const totalBudget = budgetAmounts.needs + budgetAmounts.wants + budgetAmounts.savings;
  const totalSpent = currentMetrics.expenses;
  const daysInMonth = endOfMonth(selectedMonth).getDate();
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth;
  const projectedSpent = elapsedDays > 0 ? (totalSpent / elapsedDays) * daysInMonth : totalSpent;
  const available = incomeToUse - totalSpent;
  const projectedAvailable = incomeToUse - projectedSpent;
  // Handle override changes - refresh the page calculations
  const handleOverridesChange = useCallback(() => {
    setOverrideKey((k) => k + 1);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Budget du foyer</h1>
            <p className="text-sm text-muted-foreground">{format(selectedMonth, "MMMM yyyy", { locale: fr })} · tous les comptes · transferts internes neutralisés</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex w-full items-center rounded-lg border bg-card sm:w-auto" aria-label="Choisir le mois du budget">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedMonth((month) => subMonths(month, 1))} aria-label="Mois précédent"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-0 flex-1 px-2 text-center text-sm font-medium capitalize sm:min-w-32">{format(selectedMonth, "MMMM yyyy", { locale: fr })}</span>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedMonth((month) => addMonths(month, 1))} disabled={isCurrentMonth} aria-label="Mois suivant"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            {!isCurrentMonth && (
              <Button variant="outline" onClick={() => setSelectedMonth(startOfMonth(today))}>
                Ce mois
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="w-full gap-2 sm:w-auto"
              aria-expanded={showSettings}
            >
              <Settings2 className="h-4 w-4" />
              Paramètres du budget
              {showSettings ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Disponible maintenant</p><p className={cn("mt-1 text-2xl font-semibold", available < 0 && "text-destructive")}><Money amount={available} /></p><p className="mt-1 text-xs text-muted-foreground">Revenus reconnus moins dépenses réelles</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{isCurrentMonth ? "Projection fin de mois" : "Disponible en fin de mois"}</p><p className={cn("mt-1 text-2xl font-semibold", incomeToUse > 0 && projectedAvailable < 0 && "text-destructive")}>{incomeToUse > 0 ? <Money amount={projectedAvailable} /> : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{incomeToUse > 0 ? (isCurrentMonth ? `Au rythme observé sur ${elapsedDays} jours` : "Calculé sur le mois complet") : "En attente d’un revenu de référence"}</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Arbitrage conseillé</p><p className="mt-1 text-lg font-semibold">{incomeToUse <= 0 ? "Base à définir" : projectedAvailable < 0 ? `Réduire de ${formatBase(Math.abs(projectedAvailable))}` : "Trajectoire couverte"}</p><p className="mt-1 text-xs text-muted-foreground">Les remboursements réduisent les dépenses ; les virements liés sont neutres.</p></CardContent></Card>
        </div>

        {/* Budget Settings (Collapsible) */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5 text-muted-foreground" />
                  Paramètres du budget
                </CardTitle>
                <CardDescription>Les modifications sont enregistrées automatiquement.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Revenu mensuel de référence
                      </label>
                      <Input
                        type="number"
                        aria-label="Revenu mensuel de référence"
                        min="0"
                        inputMode="decimal"
                        placeholder={smartIncomeValue > 0 ? `Revenu estimé : ${formatBase(smartIncomeValue)}` : "Saisissez votre revenu mensuel"}
                        value={monthlyIncome}
                        onChange={(e) => {
                          const value = e.target.value;
                          setMonthlyIncome(value);
                          if (preferencesLoaded) void persistPreferences({ preset: selectedPreset, monthlyIncome: value, customAllocations });
                        }}
                      />
                      {smartIncome && !monthlyIncome && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 cursor-help">
                                <TrendingUp className="h-3 w-3" />
                                <span>
                                  Revenu estimé utilisé : <Money amount={smartIncome.averageSalary} />
                                </span>
                                <Badge variant="outline" className="text-xs ml-1">
                                  {{ low: "faible", medium: "moyenne", high: "élevée" }[smartIncome.confidence] || smartIncome.confidence}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">Calcul du revenu de référence</p>
                              <p className="text-xs mb-2">
                                Basé sur {smartIncome.salaryCount} salaire(s), hors{" "}
                                {smartIncome.outlierCount} valeur(s) atypique(s), probablement des primes.
                              </p>
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>Salaire médian :</span>
                                  <span><Money amount={smartIncome.medianSalary} /></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Moyenne hors primes :</span>
                                  <span><Money amount={smartIncome.averageSalary} /></span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Jour habituel du salaire :</span>
                                  <span>Jour {smartIncome.salaryDay}</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {smartIncome && smartIncome.outlierCount > 0 && !monthlyIncome && (
                        <div className="flex items-center gap-1 text-xs text-warning mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>
                            {smartIncome.outlierCount} mois avec prime exclu(s) du calcul
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Règle de répartition
                      </label>
                      <Select value={selectedPreset} onValueChange={(value) => {
                        setSelectedPreset(value);
                        if (preferencesLoaded) void persistPreferences({ preset: value, monthlyIncome, customAllocations });
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_PRESETS.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>
                              <div className="flex flex-col">
                                <span>{preset.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {preset.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedPreset === "custom" && (
                      <div className="space-y-3 p-3 rounded-lg bg-muted">
                        {(["needs", "wants", "savings"] as const).map((type) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm">{{ needs: "Besoins", wants: "Envies", savings: "Épargne" }[type]}</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                aria-label={`Pourcentage ${{ needs: "besoins", wants: "envies", savings: "épargne" }[type]}`}
                                className="w-20 h-8 text-sm"
                                value={customAllocations[type]}
                                onChange={(e) => {
                                  const next = {
                                    ...customAllocations,
                                    [type]: parseInt(e.target.value) || 0,
                                  };
                                  setCustomAllocations(next);
                                  if (preferencesLoaded) void persistPreferences({ preset: selectedPreset, monthlyIncome, customAllocations: next });
                                }}
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))}
                        {allocations.needs + allocations.wants + allocations.savings !== 100 && (
                          <p className="text-xs text-warning">
                            Le total doit être égal à 100 % (actuellement{" "}
                            {allocations.needs + allocations.wants + allocations.savings} %).
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg bg-background p-4 border">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Répartition mensuelle
                      </h4>
                      <div className="space-y-3">
                        {[
                          { type: "needs" as const, label: "Besoins" },
                          { type: "wants" as const, label: "Envies" },
                          { type: "savings" as const, label: "Épargne" },
                        ].map(({ type, label }) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full bg-primary" />
                              <span className="text-sm">{label} ({allocations[type]}%)</span>
                            </div>
                            <span className="font-medium"><Money amount={budgetAmounts[type]} /></span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex items-center justify-between font-semibold">
                          <span>Budget total</span>
                          <span><Money amount={totalBudget} /></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 min-h-5 text-sm" aria-live="polite">
                  {preferenceError ? <p role="alert" className="text-destructive">{preferenceError}</p> : <p className="text-muted-foreground">{preferenceStatus}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Category Type Overrides */}
            <div className="mt-4">
              <CategoryTypeOverrides onChange={handleOverridesChange} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {incomeToUse <= 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <h2 className="font-semibold">Définissez une base de revenu</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Importez des transactions contenant un salaire ou ouvrez les paramètres du budget pour saisir un revenu mensuel. Aucune trajectoire n’est affichée tant que cette base est inconnue.</p>
              <Button className="mt-4" variant="outline" onClick={() => setShowSettings(true)}>Saisir un revenu</Button>
            </CardContent>
          </Card>
        ) : (<>
        {/* Main Dashboard - 2 column layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Budget vs Actual */}
          <BudgetVsActual
            budgets={budgetAmounts}
            actuals={spendingByType}
          />

          {/* Budget Pace */}
          <BudgetPace
            totalBudget={totalBudget}
            totalSpent={totalSpent}
            asOfDate={isCurrentMonth ? today : endOfMonth(selectedMonth)}
          />
        </div>

        {/* Alerts */}
        <BudgetAlerts categoryData={categoryAlertData} />

        {/* Category Budgets by Type */}
        <div className="space-y-6">
          {(["needs", "wants", "savings"] as const).map((type) => {
            const typeConfig = {
              needs: { label: "Besoins", description: "Dépenses essentielles" },
              wants: { label: "Envies", description: "Dépenses discrétionnaires" },
              savings: { label: "Épargne", description: "Objectifs futurs" },
            };
            const config = typeConfig[type];

            // Filter categories by their effective type (respecting overrides)
            const categories = Object.entries(CATEGORIES).filter(
              ([cat]) => getCategoryType(cat) === type
            );

            if (categories.length === 0) return null;

            const typeSpent = spendingByType[type];
            const typeBudget = budgetAmounts[type];
            const typePercent = typeBudget > 0 ? (typeSpent / typeBudget) * 100 : 0;

            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted/50">
                        <PieChart className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-lg font-bold">
                        <Money amount={typeSpent} /> <span className="text-sm font-normal text-muted-foreground">/ <Money amount={typeBudget} /></span>
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {typePercent.toFixed(0)} % utilisé
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categories.map(([category]) => (
                      <CategoryBudgetCard
                        key={category}
                        category={category}
                        budget={getCategoryBudget(category)}
                        spent={spendingByCategory[category] || 0}
                        previousSpent={prevSpendingByCategory[category]}
                        onBudgetChange={async (cat, amount) => {
                          await setBudget(cat, amount, currentYear, currentMonth);
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        </>)}
      </div>
    </AppLayout>
  );
}
