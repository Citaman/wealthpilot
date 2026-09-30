"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  PieChart,
  Plus,
  Search,
  SlidersHorizontal,
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
import { useAccount } from "@/contexts/account-context";

const GOAL_COLORS = [
  "#FF6B4A", // coral
  "#FF8B70", // coral light
  "#FFAB96", // coral lighter
  "#FFCBBC", // coral lightest
  "#E8E8EC", // gray
];

export default function GoalsPage() {
  const { selectedAccountId } = useAccount();
  const { goals, isLoading, addGoal, updateGoal, deleteGoal } = useGoals();
  const { accounts } = useAccounts();
  const { contributions } = useGoalContributions();
  const { addContribution, deleteContribution } = useGoalContributionActions();
  const dashboard = useDashboard(selectedAccountId);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [contributionGoalId, setContributionGoalId] = useState<number | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionKind, setContributionKind] = useState<"deposit" | "withdrawal">("deposit");
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

  const goalsWithRealBalances = useMemo(() => goals
    .filter((goal) => (
      selectedAccountId === "all" ||
      !goal.linkedAccountId ||
      goal.linkedAccountId === selectedAccountId
    ))
    .map((goal) => {
      if (!goal.linkedAccountId) return goal;
      const account = accounts.find((candidate) => candidate.id === goal.linkedAccountId);
      return account ? { ...goal, currentAmount: account.balance } : goal;
    }), [goals, accounts, selectedAccountId]);

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

  useEffect(() => {
    if (new URL(window.location.href).searchParams.get('new') === '1') {
      handleOpenAdd();
      const url = new URL(window.location.href);
      url.searchParams.delete('new');
      window.history.replaceState({}, '', url);
    }
    // This deep link is consumed once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const linkedAccount = formData.linkedAccountId === "none"
      ? undefined
      : accounts.find((account) => account.id === parseInt(formData.linkedAccountId));
    const goalData = {
      name: formData.name.trim(),
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: linkedAccount ? linkedAccount.balance : (parseFloat(formData.currentAmount) || 0),
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
    setContributionKind("deposit");
    setContributionNote("");
    setContributionError(null);
    setContributionDate(new Date().toISOString().split("T")[0]);
  };

  const handleContribute = async () => {
    if (!contributionGoalId || !contributionAmount) return;

    const goal = goalsWithRealBalances.find((g) => g.id === contributionGoalId);
    if (!goal) return;
    if (goal.linkedAccountId) {
      setContributionError("Cet objectif suit le solde d’un compte réel. Ajoutez l’argent via une transaction du compte.");
      return;
    }

    setContributionError(null);

    const rawAmount = Number(contributionAmount);
    const amount = contributionKind === "withdrawal" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setContributionError("Saisissez un montant valide supérieur à zéro.");
      return;
    }

    if (goal.currentAmount + amount < 0) {
      setContributionError("Ce retrait rendrait le solde de l’objectif négatif.");
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
      setContributionError(err instanceof Error ? err.message : "Impossible d’ajouter le mouvement.");
    }
  };

  const now = useMemo(() => new Date(), []);

  const { activeGoals, completedGoals } = useMemo(() => {
    const active = goalsWithRealBalances.filter((g) => g.isActive && g.currentAmount < g.targetAmount);
    const completed = goalsWithRealBalances.filter((g) => !g.isActive || g.currentAmount >= g.targetAmount);
    return { activeGoals: active, completedGoals: completed };
  }, [goalsWithRealBalances]);

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
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Objectifs financiers</h2>
            <p className="text-muted-foreground">
              Suivez vos projets, leurs mouvements et leur date d’atteinte estimée.
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="bg-primary text-white">
            <Plus className="mr-2 h-4 w-4" />
            Nouvel objectif
          </Button>
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un objectif…"
              className="bg-muted/50 border-0"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="justify-between">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Trier
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setSortMode("progress")}>Mieux financés</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("deadline")}>Échéance la plus proche</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("activity")}>Activité récente</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode("remaining")}>Plus petit reste</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortMode("name")}>Nom (A → Z)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cible active</p>
                  <p className="text-2xl font-semibold">
                    <Money amount={kpis.totalTarget} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Financé</p>
                  <p className="text-2xl font-semibold">
                    <Money amount={kpis.totalSaved} minimumFractionDigits={0} maximumFractionDigits={0} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contributions nettes (30 j)</p>
                  <p className="text-2xl font-semibold">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">À risque</p>
                  <p className="text-2xl font-semibold">{kpis.atRisk}</p>
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
                <p className="text-sm font-semibold">Relier les objectifs au budget du foyer</p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez les transactions, ajustez le budget et contrôlez la progression dans les analyses.
                  {!dashboard.isLoading && dashboard.hasData ? (
                    <span>
                      {" "}Épargne nette ce mois-ci :{" "}
                      <Money
                        amount={dashboard.totalIncome - dashboard.totalExpenses}
                        className="font-medium text-foreground"
                        minimumFractionDigits={0}
                        maximumFractionDigits={0}
                      />
                      {" "}({dashboard.savingsRate.toFixed(0)} % d’épargne)
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
                    Analyses
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
              <TabsTrigger value="active">Actifs ({filteredActiveGoals.length})</TabsTrigger>
              <TabsTrigger value="completed">Terminés ({filteredCompletedGoals.length})</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Objectifs actifs : <span className="font-medium text-foreground">{activeGoals.length}</span>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                Terminés : <span className="font-medium text-foreground">{completedGoals.length}</span>
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
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                    <Target className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold">Aucun objectif actif</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Créez un objectif puis ajoutez des mouvements : la projection deviendra plus fiable au fil du temps.
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleOpenAdd}>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer un objectif
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/budgets">Définir un budget</Link>
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
                    linkedAccountName={accounts.find((account) => account.id === goal.linkedAccountId)?.name}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {filteredCompletedGoals.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="font-medium">Aucun objectif terminé</p>
                  <p className="text-sm text-muted-foreground">Les objectifs atteints apparaîtront ici.</p>
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
                    linkedAccountName={accounts.find((account) => account.id === goal.linkedAccountId)?.name}
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
            <DialogTitle>{editingGoal ? "Modifier l’objectif" : "Ajouter un objectif"}</DialogTitle>
            <DialogDescription>
              {editingGoal
                ? "Modifiez les informations de cet objectif."
                : "Créez un objectif virtuel ou lié à un compte réel."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nom de l’objectif</label>
                <Input
                  placeholder="ex. Fonds d’urgence"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Compte lié (facultatif)</label>
                <Select
                  value={formData.linkedAccountId}
                  onValueChange={(value) => {
                    const account = value === "none" ? undefined : accounts.find((candidate) => candidate.id === Number(value));
                    setFormData({
                      ...formData,
                      linkedAccountId: value,
                      currentAmount: account ? account.balance.toString() : formData.currentAmount,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun — objectif virtuel</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id!.toString()}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Un compte lié fournit la progression depuis son solde réel. Sinon, les mouvements sont virtuels.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Montant cible</label>
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
                  <label className="text-sm font-medium mb-1.5 block">
                    {formData.linkedAccountId === "none" ? "Progression virtuelle" : "Solde du compte"}
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    value={formData.currentAmount}
                    disabled={formData.linkedAccountId !== "none"}
                    onChange={(e) =>
                      setFormData({ ...formData, currentAmount: e.target.value })
                    }
                  />
                  {formData.linkedAccountId !== "none" && (
                    <p className="mt-1 text-xs text-muted-foreground">Lu depuis le compte lié ; non modifiable ici.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Échéance (facultative)
                </label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Couleur</label>
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
                      aria-label={`Choisir la couleur ${color}`}
                      aria-pressed={formData.color === color}
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
                Annuler
              </Button>
              <Button type="submit">
                {editingGoal ? "Enregistrer" : "Créer l’objectif"}
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
            <DialogTitle>Ajouter un mouvement d’objectif</DialogTitle>
            <DialogDescription>
              Choisissez un versement ou un retrait; le signe est appliqué automatiquement et l’historique est conservé.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de mouvement">
              <Button type="button" variant={contributionKind === "deposit" ? "default" : "outline"} onClick={() => setContributionKind("deposit")}>Versement</Button>
              <Button type="button" variant={contributionKind === "withdrawal" ? "default" : "outline"} onClick={() => setContributionKind("withdrawal")}>Retrait</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Montant</label>
                <Input
                  type="number"
                  placeholder="ex. 100"
                  min="0"
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
              <label className="text-sm font-medium mb-1.5 block">Note (facultative)</label>
              <Input
                placeholder="ex. Épargne du salaire"
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
              />
            </div>
            {contributionError && (
              <p className="text-sm text-destructive">{contributionError}</p>
            )}

            {contributionGoalId !== null && (contributionsByGoal[contributionGoalId] || []).length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium mb-2">Historique récent</p>
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
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => setDeleteContributionConfirm(c.id!)}
                          aria-label={`Supprimer le mouvement du ${c.date}`}
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
              Annuler
            </Button>
            <Button onClick={handleContribute} disabled={!contributionAmount}>
              Ajouter le mouvement
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
            <DialogTitle>Supprimer le mouvement</DialogTitle>
            <DialogDescription>
              Le mouvement sera retiré et le solde de l’objectif recalculé.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContributionConfirm(null)}>
              Annuler
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
                    err instanceof Error ? err.message : "Impossible de supprimer le mouvement."
                  );
                  setDeleteContributionConfirm(null);
                }
              }}
            >
              Supprimer
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
            <DialogTitle>Supprimer l’objectif</DialogTitle>
            <DialogDescription>
              L’objectif et son historique seront supprimés. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
