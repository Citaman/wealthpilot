"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Calculator,
  PieChart,
  Wallet,
  Settings2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
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
  CollapsibleTrigger,
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
  DEFAULT_CATEGORY_TYPES,
  BudgetType,
} from "@/lib/budget-types";
import { useSmartIncome } from "@/lib/financial-month";

// Budget rule presets
const BUDGET_PRESETS = [
  { id: "50-30-20", name: "50/30/20 Rule", needs: 50, wants: 30, savings: 20, description: "Classic balanced approach" },
  { id: "60-20-20", name: "60/20/20 Conservative", needs: 60, wants: 20, savings: 20, description: "Higher essential allocation" },
  { id: "70-20-10", name: "70/20/10 Flexible", needs: 70, wants: 20, savings: 10, description: "For higher cost of living" },
  { id: "custom", name: "Custom", needs: 50, wants: 30, savings: 20, description: "Set your own percentages" },
];

export default function BudgetsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const { budgets, setBudget, isLoading: budgetsLoading } = useBudgets();
  
  // Current month transactions
  const { transactions, isLoading: txLoading } = useTransactions({
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
    excludeExcluded: true,
  });

  // Previous month transactions for comparison
  const lastMonth = subMonths(now, 1);
  const { transactions: prevTransactions } = useTransactions({
    startDate: startOfMonth(lastMonth),
    endDate: endOfMonth(lastMonth),
    excludeExcluded: true,
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

  // Helper to get category type with override support
  const getCategoryType = useCallback((category: string): BudgetType => {
    return getCategoryBudgetType(category, categoryOverrides || {});
  }, [categoryOverrides, overrideKey]);

  const getTransactionType = useCallback((t: Transaction): BudgetType => {
    return getTransactionBudgetType(t, categoryOverrides || {}, txOverrides || {});
  }, [categoryOverrides, txOverrides, overrideKey]);

  // Calculate actual income from transactions (simple sum)
  const actualIncome = useMemo(() => {
    return transactions
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

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
  const budgetAmounts = {
    needs: (incomeToUse * allocations.needs) / 100,
    wants: (incomeToUse * allocations.wants) / 100,
    savings: (incomeToUse * allocations.savings) / 100,
  };

  // Calculate spending by type (respects category overrides)
  const spendingByType = useMemo(() => {
    const result = { needs: 0, wants: 0, savings: 0 };
    transactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        const type = getTransactionType(t);
        if (type && type !== "income") {
          result[type] += Math.abs(t.amount);
        }
      });
    return result;
  }, [transactions, getTransactionType]);

  // Calculate spending by category
  const spendingByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + Math.abs(t.amount);
      });
    return result;
  }, [transactions]);

  // Previous month spending by category
  const prevSpendingByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    prevTransactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + Math.abs(t.amount);
      });
    return result;
  }, [prevTransactions]);

  // Get budget for a category
  const getCategoryBudget = useCallback((category: string) => {
    const existing = budgets.find(
      (b) => b.category === category && b.year === currentYear
    );
    if (existing) return existing.amount;

    // Calculate default based on type (respects overrides)
    const type = getCategoryType(category);
    if (!type || type === "income") return 0;

    // Distribute budget among categories of the same type
    const categoriesOfType = Object.keys(CATEGORIES).filter(
      (cat) => getCategoryType(cat) === type
    );
    return budgetAmounts[type] / categoriesOfType.length;
  }, [budgets, currentYear, getCategoryType, budgetAmounts]);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalBudget = budgetAmounts.needs + budgetAmounts.wants + budgetAmounts.savings;
  const totalSpent = spendingByType.needs + spendingByType.wants;
  const isLoading = budgetsLoading || txLoading;

  // Handle override changes - refresh the page calculations
  const handleOverridesChange = useCallback(() => {
    setOverrideKey((k) => k + 1);
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Budget Planner</h1>
            <p className="text-muted-foreground">
              {format(now, "MMMM yyyy")} • Track and manage your spending
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Settings
            {showSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Budget Settings (Collapsible) */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-5 w-5" />
                  Budget Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Monthly Income
                      </label>
                      <Input
                        type="number"
                        placeholder={smartIncomeValue > 0 ? `Smart income: ${formatCurrency(smartIncomeValue)}` : "Enter your monthly income"}
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                      />
                      {smartIncome && !monthlyIncome && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 cursor-help">
                                <TrendingUp className="h-3 w-3" />
                                <span>
                                  Using smart income: {formatCurrency(smartIncome.averageSalary)}
                                </span>
                                <Badge variant="outline" className="text-xs ml-1">
                                  {smartIncome.confidence}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">Smart Income Calculation</p>
                              <p className="text-xs mb-2">
                                Based on {smartIncome.salaryCount} salary transactions, excluding{" "}
                                {smartIncome.outlierCount} outlier(s) (likely bonuses).
                              </p>
                              <div className="text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span>Median salary:</span>
                                  <span>{formatCurrency(smartIncome.medianSalary)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Average (excl. bonuses):</span>
                                  <span>{formatCurrency(smartIncome.averageSalary)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Typical salary day:</span>
                                  <span>Day {smartIncome.salaryDay}</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {smartIncome && smartIncome.outlierCount > 0 && !monthlyIncome && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>
                            {smartIncome.outlierCount} bonus month(s) excluded from calculation
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Budget Rule
                      </label>
                      <Select value={selectedPreset} onValueChange={setSelectedPreset}>
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
                      <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                        {(["needs", "wants", "savings"] as const).map((type) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm capitalize">{type}</span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-20 h-8 text-sm"
                                value={customAllocations[type]}
                                onChange={(e) =>
                                  setCustomAllocations({
                                    ...customAllocations,
                                    [type]: parseInt(e.target.value) || 0,
                                  })
                                }
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))}
                        {allocations.needs + allocations.wants + allocations.savings !== 100 && (
                          <p className="text-xs text-amber-600">
                            Total should equal 100% (currently{" "}
                            {allocations.needs + allocations.wants + allocations.savings}%)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg bg-background p-4 border">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Monthly Allocation
                      </h4>
                      <div className="space-y-3">
                        {[
                          { type: "needs" as const, label: "Needs", color: "bg-blue-500" },
                          { type: "wants" as const, label: "Wants", color: "bg-purple-500" },
                          { type: "savings" as const, label: "Savings", color: "bg-emerald-500" },
                        ].map(({ type, label, color }) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-3 w-3 rounded-full", color)} />
                              <span className="text-sm">{label} ({allocations[type]}%)</span>
                            </div>
                            <span className="font-medium">{formatCurrency(budgetAmounts[type])}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex items-center justify-between font-semibold">
                          <span>Total Budget</span>
                          <span>{formatCurrency(totalBudget)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Type Overrides */}
            <div className="mt-4">
              <CategoryTypeOverrides onChange={handleOverridesChange} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Main Dashboard - 2 column layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Budget vs Actual */}
          <BudgetVsActual
            budgets={budgetAmounts}
            actuals={spendingByType}
            income={incomeToUse}
          />

          {/* Budget Pace */}
          <BudgetPace
            totalBudget={totalBudget}
            totalSpent={totalSpent}
          />
        </div>

        {/* Alerts */}
        <BudgetAlerts categoryData={categoryAlertData} />

        {/* Category Budgets by Type */}
        <div className="space-y-6">
          {(["needs", "wants", "savings"] as const).map((type) => {
            const typeConfig = {
              needs: { label: "Needs", color: "blue", description: "Essential expenses" },
              wants: { label: "Wants", color: "purple", description: "Discretionary spending" },
              savings: { label: "Savings", color: "emerald", description: "Future goals" },
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        `bg-${config.color}-500/10`
                      )}>
                        <PieChart className={cn("h-5 w-5", `text-${config.color}-500`)} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatCurrency(typeSpent)} <span className="text-sm font-normal text-muted-foreground">/ {formatCurrency(typeBudget)}</span>
                      </p>
                      <Badge 
                        variant={typePercent > 100 ? "destructive" : typePercent > 80 ? "secondary" : "default"}
                        className={cn(
                          typePercent <= 80 && "bg-emerald-500"
                        )}
                      >
                        {typePercent.toFixed(0)}% used
                      </Badge>
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
      </div>
    </AppLayout>
  );
}
