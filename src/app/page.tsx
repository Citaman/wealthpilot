"use client";

import { useMemo } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { WelcomeHeader } from "@/components/dashboard/welcome-header";
import { IncomeCard } from "@/components/dashboard/income-card";
import { ExpenseDonut } from "@/components/dashboard/expense-donut";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { BudgetControl } from "@/components/dashboard/budget-control";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { GoalsProgress } from "@/components/dashboard/goals-progress";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { UpcomingBills } from "@/components/dashboard/upcoming-bills";
import { MonthlySummary } from "@/components/dashboard/monthly-summary";
import { AnomalyDetection } from "@/components/dashboard/anomaly-detection";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useDashboard, useTransactions, useBudgets } from "@/hooks/use-data";
import { useAccount } from "@/contexts/account-context";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/db";
import Link from "next/link";
import { useMoney } from "@/hooks/use-money";

export default function DashboardPage() {
  const router = useRouter();
  const { accounts, selectedAccountId, totalBalance, setSelectedAccountId } = useAccount();
  const { convertFromAccount } = useMoney();
  const {
    isLoading,
    hasData,
    totalIncome,
    totalExpenses,
    recentTransactions,
    goals,
    incomeChange,
    expenseChange,
  } = useDashboard();

  // Get current month's transactions for detailed breakdown
  const now = new Date();
  const { transactions: monthTransactions } = useTransactions({
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
  });

  const { budgets } = useBudgets();
  const { transactions: allTransactions } = useTransactions();

  // Calculate income sources breakdown
  const incomeSources = useMemo(() => {
    const sources: Record<string, number> = {};
    
    monthTransactions
      .filter((t) => t.direction === "credit")
      .forEach((t) => {
        const source = t.category === "Income" ? "Salary" : t.category;
        sources[source] = (sources[source] || 0) + convertFromAccount(t.amount, t.accountId);
      });

    return [
      { name: "Salary", amount: sources["Salary"] || 0, icon: "salary" as const, color: "#10b981" },
      { name: "Transfers", amount: sources["Transfers"] || 0, icon: "other" as const, color: "#3b82f6" },
      { name: "Other", amount: Object.entries(sources)
        .filter(([k]) => k !== "Salary" && k !== "Transfers")
        .reduce((sum, [, v]) => sum + v, 0), 
        icon: "other" as const, color: "#8b5cf6" },
    ].filter((s) => s.amount > 0);
  }, [monthTransactions, convertFromAccount]);

  // Calculate expense categories for donut
  const expenseCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    
    monthTransactions
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        cats[t.category] = (cats[t.category] || 0) + Math.abs(convertFromAccount(t.amount, t.accountId));
      });

    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({
        name,
        amount,
        color: CATEGORIES[name]?.color || "#6b7280",
      }));
  }, [monthTransactions, convertFromAccount]);

  // Calculate monthly budget
  const monthlyBudget = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    return totalBudget > 0 ? totalBudget : totalIncome * 0.8;
  }, [budgets, totalIncome]);

  if (isLoading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  if (!hasData) {
    return (
      <AppLayout>
        <div className="flex min-h-[80vh] flex-col items-center justify-center">
          <EmptyState
            title="Welcome to WealthPilot"
            description="Import a CSV to unlock your dashboard, track spending, and plan your budget. Your data stays on this device."
            primaryAction={{
              label: "Import transactions",
              onClick: () => router.push("/import"),
            }}
            icon={<Upload className="h-6 w-6 text-primary" />}
          />
          <div className="mt-4 text-xs text-muted-foreground">
            Nothing is uploaded to any server.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <WelcomeHeader userName="there" />

        {/* Quick Stats Row - Full Width on top */}
        <QuickStats />

        {/* Main Grid - 3 columns on desktop */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column - Income & Budget */}
          <div className="lg:col-span-4 space-y-6">
            <IncomeCard
              totalIncome={totalIncome}
              change={incomeChange}
              sources={incomeSources}
              onAddIncome={() => router.push("/transactions")}
            />
            <BudgetControl
              budgetLimit={monthlyBudget}
              spent={totalExpenses}
            />
            <UpcomingBills />
          </div>

          {/* Middle Column - Balance & Expenses */}
          <div className="lg:col-span-4 space-y-6">
            <BalanceCard
              totalBalance={totalBalance}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
            />
            <ExpenseDonut
              totalExpenses={totalExpenses}
              categories={expenseCategories}
              change={expenseChange}
            />
            <MonthlySummary />
          </div>

          {/* Right Column - Transactions & Goals */}
          <div className="lg:col-span-4 space-y-6">
            <AnomalyDetection transactions={allTransactions} />
            <RecentTransactions transactions={recentTransactions} limit={5} />
            <GoalsProgress
              goals={goals}
              onAddClick={() => router.push("/goals")}
            />
          </div>
        </div>

        {/* Cash Flow Chart - Full Width (self-contained, fetches its own data) */}
        <CashFlowChart />
      </div>
    </AppLayout>
  );
}
