"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  Calendar,
  MoreHorizontal,
  Pencil,
  PieChart,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGoalContributionActions, useGoalContributions, useGoals, useAccounts } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { getGoalHealth, getGoalIcon } from "@/components/goals/goal-utils";
import { Money } from "@/components/ui/money";

const GOAL_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

export default function GoalDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goalId = Number(params.id);

  const { goals, updateGoal, deleteGoal } = useGoals();
  const { accounts } = useAccounts();
  const { contributions } = useGoalContributions(Number.isFinite(goalId) ? goalId : undefined);
  const { addContribution, deleteContribution } = useGoalContributionActions();

  const goal = useMemo(() => goals.find((g) => g.id === goalId) || null, [goals, goalId]);

  const linkedAccount = useMemo(() => {
    if (!goal?.linkedAccountId) return null;
    return accounts.find(a => a.id === goal.linkedAccountId);
  }, [goal, accounts]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteGoalConfirm, setDeleteGoalConfirm] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
    color: GOAL_COLORS[0],
    linkedAccountId: "none",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const sortedContributions = useMemo(() => {
    return [...contributions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [contributions]);

  const now = new Date();

  const net30 = useMemo(() => {
    const cutoff = subDays(now, 30);
    return sortedContributions
      .filter((c) => parseISO(c.date) >= cutoff)
      .reduce((sum, c) => sum + c.amount, 0);
  }, [now, sortedContributions]);

  if (!Number.isFinite(goalId)) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Button variant="outline" onClick={() => router.push("/goals")}>Back</Button>
          <p>Invalid goal id.</p>
        </div>
      </AppLayout>
    );
  }

  if (!goal) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Link href="/goals" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to goals
          </Link>
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">Goal not found</p>
              <p className="text-sm text-muted-foreground">It may have been deleted.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const remaining = goal.targetAmount - goal.currentAmount;

  const health = getGoalHealth({ goal, contributions: sortedContributions, now });
  const GoalIcon = getGoalIcon(goal);
  const lastActivityDate = sortedContributions[0]?.date || null;

  const openAdd = () => {
    setIsAddOpen(true);
    setAmount("");
    setNote("");
    setError(null);
    setDate(new Date().toISOString().split("T")[0]);
  };

  const openEdit = () => {
    setEditError(null);
    setEditForm({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline || "",
      color: goal.color,
      linkedAccountId: goal.linkedAccountId ? goal.linkedAccountId.toString() : "none",
    });
    setIsEditOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/10" />
          <div className="relative p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Link href="/goals" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to goals
                </Link>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-xl border bg-background/70 px-3 py-2">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${goal.color}20` }}
                    >
                      <GoalIcon className="h-4.5 w-4.5" style={{ color: goal.color }} />
                    </span>
                    <div className="min-w-0">
                      <h1 className="truncate text-2xl font-bold tracking-tight">{goal.name}</h1>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge className={cn("border", health.badgeClassName)}>{health.label}</Badge>
                        <span className="text-xs text-muted-foreground">{health.hint}</span>
                        {goal.deadline ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            Deadline {format(parseISO(goal.deadline), "MMM d, yyyy")}
                          </span>
                        ) : null}
                        {linkedAccount ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Wallet className="h-3.5 w-3.5" />
                            Linked to {linkedAccount.name}
                          </span>
                        ) : null}
                        {lastActivityDate ? (
                          <span className="text-xs text-muted-foreground">Last activity {lastActivityDate}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add contribution
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={openEdit}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit goal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => setDeleteGoalConfirm(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete goal
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-background/70">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CircularProgress progress={Math.min(progress, 100)} color={goal.color} size={52} strokeWidth={4} />
                    <div>
                      <p className="text-sm text-muted-foreground">Saved</p>
                      <p className="text-xl font-bold">
                        <Money amount={goal.currentAmount} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of <Money amount={goal.targetAmount} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/70">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-xl font-bold">
                        <Money amount={Math.max(0, remaining)} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                      <p className="text-xs text-muted-foreground">{Math.max(0, (100 - Math.min(progress, 100))).toFixed(0)}% left</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/70">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
                      <TrendingUp className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net funding (30d)</p>
                      <p className={cn("text-xl font-bold", net30 >= 0 ? "text-violet-700 dark:text-violet-300" : "text-red-600")}>
                        {net30 >= 0 ? "+" : "-"}
                        <Money amount={Math.abs(net30)} minimumFractionDigits={0} maximumFractionDigits={0} />
                      </p>
                      <p className="text-xs text-muted-foreground">Based on contributions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/70">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly pace</p>
                      <p className="text-xl font-bold">
                        {health.forecast.averageMonthlyNet ? (
                          <Money amount={health.forecast.averageMonthlyNet} minimumFractionDigits={0} maximumFractionDigits={0} />
                        ) : "—"}
                        {health.forecast.averageMonthlyNet ? <span className="text-sm font-medium text-muted-foreground">/mo</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">Recent average</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Connections */}
        <Card>
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Connect this goal</p>
                <p className="text-sm text-muted-foreground">
                  Use Transactions to fund it, Budgets to plan it, and Analytics to validate your pace.
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

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Forecast</CardTitle>
                  <CardDescription>Deadline pace + estimated reach</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {health.forecast.requiredMonthlyForDeadline ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">To hit the deadline</span>
                      <span className="font-semibold">
                        <Money amount={health.forecast.requiredMonthlyForDeadline} minimumFractionDigits={0} maximumFractionDigits={0} />/mo
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">To hit the deadline</span>
                      <span className="font-semibold">—</span>
                    </div>
                  )}

                  {health.forecast.averageMonthlyNet ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Recent average (net)</span>
                      <span className="font-semibold">
                        <Money amount={health.forecast.averageMonthlyNet} minimumFractionDigits={0} maximumFractionDigits={0} />/mo
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Recent average (net)</span>
                      <span className="font-semibold">—</span>
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground">Estimated reach</p>
                    <p className="mt-1 font-semibold">
                      {health.forecast.estimatedReachDate
                        ? format(parseISO(health.forecast.estimatedReachDate), "MMM yyyy")
                        : "Add a few contributions over time to unlock a useful forecast."}
                    </p>
                    {goal.deadline ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Deadline: {format(parseISO(goal.deadline), "MMM d, yyyy")}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <CardDescription>{sortedContributions.length} contribution(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {sortedContributions.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No contributions yet. Add a deposit (or a withdrawal) to start tracking.
                      </p>
                      <Button variant="outline" className="w-full" onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add first contribution
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-md border">
                        <ul className="divide-y">
                          {sortedContributions.slice(0, 5).map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {c.amount >= 0 ? "+" : "-"}
                                  <Money amount={Math.abs(c.amount)} minimumFractionDigits={0} maximumFractionDigits={0} />
                                  <span className="text-muted-foreground font-normal"> · {c.date}</span>
                                </p>
                                {c.note ? (
                                  <p className="truncate text-muted-foreground">{c.note}</p>
                                ) : null}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteConfirm(c.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button variant="outline" className="w-full" onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add contribution
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">All contributions</CardTitle>
                <CardDescription>History is the source of truth for the goal balance.</CardDescription>
              </CardHeader>
              <CardContent>
                {sortedContributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contributions yet.</p>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <ul className="divide-y">
                      {sortedContributions.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {c.amount >= 0 ? "+" : "-"}
                              <Money amount={Math.abs(c.amount)} minimumFractionDigits={0} maximumFractionDigits={0} />
                              <span className="text-muted-foreground font-normal"> · {c.date}</span>
                            </p>
                            {c.note ? (
                              <p className="truncate text-muted-foreground">{c.note}</p>
                            ) : null}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteConfirm(c.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>Use a negative amount for withdrawals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount</label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Note</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setError(null);
                const numeric = Number(amount);
                if (!Number.isFinite(numeric) || numeric === 0) {
                  setError("Enter a valid non-zero amount.");
                  return;
                }
                if (goal.currentAmount + numeric < 0) {
                  setError("That would make the goal balance negative.");
                  return;
                }
                try {
                  await addContribution({ goalId, amount: numeric, date, note });
                  setIsAddOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to add contribution");
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
            <DialogDescription>Update your goal details. Use contributions for ongoing balance changes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Goal name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Linked Account (Optional)</label>
              <Select
                value={editForm.linkedAccountId}
                onValueChange={(value) => setEditForm((v) => ({ ...v, linkedAccountId: value }))}
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Target amount</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.targetAmount}
                  onChange={(e) => setEditForm((v) => ({ ...v, targetAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Current amount</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.currentAmount}
                  onChange={(e) => setEditForm((v) => ({ ...v, currentAmount: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Tip: prefer adding a contribution to keep history consistent.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Deadline (optional)</label>
              <Input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm((v) => ({ ...v, deadline: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full transition-transform hover:scale-110",
                      editForm.color === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditForm((v) => ({ ...v, color }))}
                  />
                ))}
              </div>
            </div>

            {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setEditError(null);

                const name = editForm.name.trim();
                const targetAmount = Number(editForm.targetAmount);
                const currentAmount = Number(editForm.currentAmount) || 0;

                if (!name) {
                  setEditError("Please enter a goal name.");
                  return;
                }
                if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
                  setEditError("Please enter a valid target amount.");
                  return;
                }
                if (!Number.isFinite(currentAmount) || currentAmount < 0) {
                  setEditError("Current amount must be >= 0.");
                  return;
                }
                if (currentAmount > targetAmount) {
                  setEditError("Current amount cannot exceed the target amount.");
                  return;
                }

                try {
                  await updateGoal(goal.id!, {
                    name,
                    targetAmount,
                    currentAmount,
                    deadline: editForm.deadline || undefined,
                    color: editForm.color,
                    isActive: currentAmount < targetAmount,
                    linkedAccountId: editForm.linkedAccountId === "none" ? undefined : parseInt(editForm.linkedAccountId),
                  });
                  setIsEditOpen(false);
                } catch (err) {
                  setEditError(err instanceof Error ? err.message : "Failed to update goal");
                }
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contribution</DialogTitle>
            <DialogDescription>This will adjust the goal balance.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirm) return;
                try {
                  await deleteContribution(deleteConfirm);
                  setDeleteConfirm(null);
                } catch (err) {
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteGoalConfirm} onOpenChange={setDeleteGoalConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete goal</DialogTitle>
            <DialogDescription>
              This will remove the goal. Contribution history may remain in storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGoalConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await deleteGoal(goal.id!);
                  router.push("/goals");
                } finally {
                  setDeleteGoalConfirm(false);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
