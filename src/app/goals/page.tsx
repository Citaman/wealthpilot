"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  LayoutDashboard,
  PieChart,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import { parseISO, subDays } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoalCard } from "@/components/goals/goal-card";
import { getGoalHealth } from "@/components/goals/goal-utils";
import {
  useDashboard,
  useGoalContributionActions,
  useGoalContributions,
  useGoals,
  useAccounts,
} from "@/hooks/use-data";
import { type Goal, type GoalContribution } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";

const GOAL_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export default function GoalsPage() {
  const { goals, isLoading, addGoal, updateGoal, deleteGoal } = useGoals();
  const { accounts } = useAccounts();
  const { contributions } = useGoalContributions();
  const { addContribution, deleteContribution } = useGoalContributionActions();
  const dashboard = useDashboard();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [contributionGoalId, setContributionGoalId] = useState<number | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionDate, setContributionDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [contributionNote, setContributionNote] = useState("");
  const [contributionError, setContributionError] = useState<string | null>(null);
  const [deleteContributionConfirm, setDeleteContributionConfirm] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [sortMode, setSortMode] = useState<
    "progress" | "deadline" | "name" | "activity" | "remaining"
  >("progress");

  const contributionsByGoal = useMemo(() => {
    const map: Record<number, GoalContribution[]> = {};
    for (const c of contributions) {
      if (!map[c.goalId]) map[c.goalId] = [];
      map[c.goalId].push(c);
    }
    for (const [goalId, list] of Object.entries(map)) {
      list.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      });
      map[Number(goalId)] = list;
    }
    return map;
  }, [contributions]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
    color: GOAL_COLORS[0],
    linkedAccountId: "none",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      targetAmount: "",
      currentAmount: "",
      deadline: "",
      color: GOAL_COLORS[Math.floor(Math.random() * GOAL_COLORS.length)],
      linkedAccountId: "none",
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingGoal(null);
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setFormData({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline || "",
      color: goal.color,
      linkedAccountId: goal.linkedAccountId ? goal.linkedAccountId.toString() : "none",
    });
    setEditingGoal(goal);
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const goalData = {
      name: formData.name.trim(),
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: parseFloat(formData.currentAmount) || 0,
      deadline: formData.deadline || undefined,
      color: formData.color,
      icon: 'target',
      isActive: true,
      linkedAccountId: formData.linkedAccountId === "none" ? undefined : parseInt(formData.linkedAccountId),
    };

    if (editingGoal) {
      await updateGoal(editingGoal.id!, goalData);
    } else {
      await addGoal(goalData);
    }

    setIsAddDialogOpen(false);
    resetForm();
    setEditingGoal(null);
  };

  const handleDelete = async (id: number) => {
    await deleteGoal(id);
    setDeleteConfirm(null);
  };

  const openContribution = (goalId: number) => {
    setContributionGoalId(goalId);
    setContributionAmount("");
    setContributionNote("");
    setContributionError(null);
    setContributionDate(new Date().toISOString().split("T")[0]);
  };

  const handleContribute = async () => {
    if (!contributionGoalId || !contributionAmount) return;

    const goal = goals.find((g) => g.id === contributionGoalId);
    if (!goal) return;

    setContributionError(null);

    const amount = Number(contributionAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setContributionError("Please enter a valid amount (non-zero). Use negative for withdrawals.");
      return;
    }

    if (goal.currentAmount + amount < 0) {
      setContributionError("That withdrawal would make the goal balance negative.");
      return;
    }

    try {
      await addContribution({
        goalId: contributionGoalId,
        amount,
        date: contributionDate,
        note: contributionNote,
      });
      setContributionGoalId(null);
      setContributionAmount("");
      setContributionNote("");
      setContributionError(null);
      setContributionDate(new Date().toISOString().split("T")[0]);
    } catch (err) {
      setContributionError(err instanceof Error ? err.message : "Failed to add contribution");
    }
  };

  const now = new Date();

  const { activeGoals, completedGoals } = useMemo(() => {
    const active = goals.filter((g) => g.isActive && g.currentAmount < g.targetAmount);
    const completed = goals.filter((g) => !g.isActive || g.currentAmount >= g.targetAmount);
    return { activeGoals: active, completedGoals: completed };
  }, [goals]);

  const filteredActiveGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withMeta = activeGoals.map((g) => {
      const list = contributionsByGoal[g.id!] || [];
      const last = list[0]?.date || null;
      return { goal: g, lastActivity: last, remaining: g.targetAmount - g.currentAmount };
    });

    const filtered = q
      ? withMeta.filter(({ goal }) => goal.name.toLowerCase().includes(q))
      : withMeta;

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.goal.name.localeCompare(b.goal.name);
      if (sortMode === "deadline") {
        const ad = a.goal.deadline || "9999-12-31";
        const bd = b.goal.deadline || "9999-12-31";
        return ad.localeCompare(bd);
      }
      if (sortMode === "remaining") return a.remaining - b.remaining;
      if (sortMode === "activity") {
        const ad = a.lastActivity || "0000-01-01";
        const bd = b.lastActivity || "0000-01-01";
        return bd.localeCompare(ad);
      }
      // progress
      const ap = a.goal.targetAmount > 0 ? a.goal.currentAmount / a.goal.targetAmount : 0;
      const bp = b.goal.targetAmount > 0 ? b.goal.currentAmount / b.goal.targetAmount : 0;
      return bp - ap;
    });

    return sorted.map((x) => x.goal);
  }, [activeGoals, contributionsByGoal, query, sortMode]);

  const filteredCompletedGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? completedGoals.filter((g) => g.name.toLowerCase().includes(q))
      : completedGoals;
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [completedGoals, query]);

  const kpis = useMemo(() => {
    const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);

    const cutoff = subDays(now, 30);
    const net30 = contributions
      .filter((c) => parseISO(c.date) >= cutoff)
      .reduce((sum, c) => sum + c.amount, 0);

    const atRisk = activeGoals.reduce((count, g) => {
      const health = getGoalHealth({
        goal: g,
        contributions: contributionsByGoal[g.id!] || [],
        now,
      }).health;
      return count + (health === "atRisk" ? 1 : 0);
    }, 0);

    return { totalTarget, totalSaved, net30, atRisk };
  }, [activeGoals, contributions, contributionsByGoal, now]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/10" />
          <div className="relative p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Plan, track, and stay on pace
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Financial Goals</h2>
                <p className="text-muted-foreground">
                  A clean place to manage goals, contributions, and forecasts — with quick links into budgets and analytics.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" asChild>
                  <Link href="/">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button onClick={handleOpenAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  New goal
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search goals…"
                  className="border-0 bg-transparent p-0 focus-visible:ring-0"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    <span className="inline-flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Sort
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setSortMode("progress")}>Most funded</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMode("deadline")}>Nearest deadline</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMode("activity")}>Recent activity</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortMode("remaining")}>Least remaining</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortMode("name")}>Name (A → Z)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active target</p>
                  <p className="text-xl font-bold">
                    <Money amount={kpis.totalTarget} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saved</p>
                  <p className="text-xl font-bold text-emerald-600">
                    <Money amount={kpis.totalSaved} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                  <TrendingUp className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net funding (30d)</p>
                  <p className={cn("text-xl font-bold", kpis.net30 >= 0 ? "text-violet-700 dark:text-violet-300" : "text-red-600")}>
                    {kpis.net30 >= 0 ? "+" : "-"}
                    <Money amount={Math.abs(kpis.net30)} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <CheckCircle2 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">At risk</p>
                  <p className="text-xl font-bold">{kpis.atRisk}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connections */}
        <Card>
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Connect goals to the rest of your money flow</p>
                <p className="text-sm text-muted-foreground">
                  Review transactions, adjust your budget, and validate progress with analytics.
                  {!dashboard.isLoading && dashboard.hasData ? (
                    <span>
                      {" "}This month’s net savings:{" "}
                      <Money
                        amount={dashboard.totalIncome - dashboard.totalExpenses}
                        className="font-medium text-foreground"
                        minimumFractionDigits={0}
                        maximumFractionDigits={0}
                      />
                      {" "}({dashboard.savingsRate.toFixed(0)}% savings rate)
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/transactions">
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Transactions
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/budgets">
                    <Wallet className="mr-2 h-4 w-4" />
                    Budgets
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/analytics">
                    <PieChart className="mr-2 h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lists */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="active">Active ({filteredActiveGoals.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({filteredCompletedGoals.length})</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Active goals: <span className="font-medium text-foreground">{activeGoals.length}</span>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                Completed: <span className="font-medium text-foreground">{completedGoals.length}</span>
              </span>
            </div>
          </div>

          <TabsContent value="active">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="py-6 space-y-3">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-10 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredActiveGoals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Target className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold">No active goals</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Create a goal, then add contributions over time — forecasting and status will automatically get smarter.
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleOpenAdd}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create goal
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/budgets">Set a budget plan</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredActiveGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    contributions={contributionsByGoal[goal.id!] || []}
                    onEdit={handleOpenEdit}
                    onDelete={(id) => setDeleteConfirm(id)}
                    onAddContribution={openContribution}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {filteredCompletedGoals.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="font-medium">No completed goals yet</p>
                  <p className="text-sm text-muted-foreground">You’ll see completed goals here once targets are reached.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCompletedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    contributions={contributionsByGoal[goal.id!] || []}
                    onEdit={handleOpenEdit}
                    onDelete={(id) => setDeleteConfirm(id)}
                    onAddContribution={openContribution}
                    className="opacity-80"
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Goal Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit Goal" : "Add New Goal"}</DialogTitle>
            <DialogDescription>
              {editingGoal
                ? "Update your savings goal details"
                : "Create a new savings goal to track your progress"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Goal Name</label>
                <Input
                  placeholder="e.g., Emergency Fund"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Linked Account (Optional)</label>
                <Select
                  value={formData.linkedAccountId}
                  onValueChange={(value) => setFormData({ ...formData, linkedAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Virtual Goal)</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id!.toString()}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Link this goal to a real bank account to track its balance automatically.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Target Amount</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={formData.targetAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, targetAmount: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Current Amount</label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={formData.currentAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, currentAmount: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Deadline (optional)
                </label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {GOAL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-8 w-8 rounded-full transition-transform hover:scale-110",
                        formData.color === color && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingGoal ? "Save Changes" : "Create Goal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contribution Dialog */}
      <Dialog
        open={contributionGoalId !== null}
        onOpenChange={(open) => !open && setContributionGoalId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>
              Add a deposit (positive) or a withdrawal (negative). Contributions are saved as history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount</label>
                <Input
                  type="number"
                  placeholder="e.g. 100 (or -50)"
                  step="0.01"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input
                  type="date"
                  value={contributionDate}
                  onChange={(e) => setContributionDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Note (optional)</label>
              <Input
                placeholder="e.g. Salary savings"
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
              />
            </div>
            {contributionError && (
              <p className="text-sm text-red-600">{contributionError}</p>
            )}

            {contributionGoalId !== null && (contributionsByGoal[contributionGoalId] || []).length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">Recent history</p>
                <div className="max-h-48 overflow-auto rounded-md border">
                  <ul className="divide-y">
                    {(contributionsByGoal[contributionGoalId] || []).slice(0, 8).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {c.amount >= 0 ? "+" : "-"}
                            <Money amount={Math.abs(c.amount)} minimumFractionDigits={0} maximumFractionDigits={0} />
                            <span className="text-muted-foreground font-normal"> · {c.date}</span>
                          </p>
                          {c.note && <p className="text-muted-foreground truncate">{c.note}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => setDeleteContributionConfirm(c.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContributionGoalId(null)}>
              Cancel
            </Button>
            <Button onClick={handleContribute} disabled={!contributionAmount}>
              Add Contribution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contribution Confirmation */}
      <Dialog
        open={deleteContributionConfirm !== null}
        onOpenChange={(open) => !open && setDeleteContributionConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contribution</DialogTitle>
            <DialogDescription>
              This will remove the contribution and adjust the goal balance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContributionConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteContributionConfirm) return;
                try {
                  await deleteContribution(deleteContributionConfirm);
                  setDeleteContributionConfirm(null);
                } catch (err) {
                  setContributionError(
                    err instanceof Error ? err.message : "Failed to delete contribution"
                  );
                  setDeleteContributionConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this goal? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
