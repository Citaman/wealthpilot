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
  Trash2,
  Wallet,
} from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";

import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGoalContributionActions, useGoalContributions, useGoals, useAccounts } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { getGoalHealth, getGoalIcon } from "@/components/goals/goal-utils";
import { Money } from "@/components/ui/money";

const GOAL_COLORS = [
  "#FF6B4A",
  "#FF8B70",
  "#FFAB96",
  "#FFCBBC",
  "#E8E8EC",
];

export default function GoalDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goalId = Number(params.id);

  const { goals, updateGoal, deleteGoal } = useGoals();
  const { accounts } = useAccounts();
  const { contributions } = useGoalContributions(Number.isFinite(goalId) ? goalId : undefined);
  const { addContribution, deleteContribution } = useGoalContributionActions();

  const storedGoal = useMemo(() => goals.find((g) => g.id === goalId) || null, [goals, goalId]);

  const linkedAccount = useMemo(() => {
    if (!storedGoal?.linkedAccountId) return null;
    return accounts.find(a => a.id === storedGoal.linkedAccountId) || null;
  }, [storedGoal, accounts]);

  const goal = useMemo(() => {
    if (!storedGoal || !linkedAccount) return storedGoal;
    return { ...storedGoal, currentAmount: linkedAccount.balance };
  }, [storedGoal, linkedAccount]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [contributionKind, setContributionKind] = useState<"deposit" | "withdrawal">("deposit");
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

  const now = useMemo(() => new Date(), []);

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
          <Button variant="outline" onClick={() => router.push("/goals")}>Retour</Button>
          <p>Identifiant d’objectif invalide.</p>
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
            Retour aux objectifs
          </Link>
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-medium">Objectif introuvable</p>
              <p className="text-sm text-muted-foreground">Il a peut-être été supprimé.</p>
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
        {/* Page Header */}
        <div className="space-y-4">
          <Link href="/goals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Retour aux objectifs
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                <GoalIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold">{goal.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{health.label}</span>
                  <span className="text-xs text-muted-foreground">{health.hint}</span>
                  {goal.deadline ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Échéance {format(parseISO(goal.deadline), "d MMM yyyy", { locale: fr })}
                    </span>
                  ) : null}
                  {linkedAccount ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      Lié à {linkedAccount.name}
                    </span>
                  ) : null}
                  {lastActivityDate ? (
                    <span className="text-xs text-muted-foreground">Dernière activité {lastActivityDate}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!linkedAccount && (
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un mouvement virtuel
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between" aria-label="Actions de l’objectif">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={openEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Modifier l’objectif
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteGoalConfirm(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer l’objectif
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {linkedAccount ? "Solde du compte" : "Progression virtuelle"}
              </p>
              <p className="text-2xl font-semibold">
                <Money amount={goal.currentAmount} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
              <p className="text-xs text-muted-foreground">
                sur <Money amount={goal.targetAmount} minimumFractionDigits={0} maximumFractionDigits={0} /> ({Math.min(progress, 100).toFixed(0)} %)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reste à atteindre</p>
              <p className="text-2xl font-semibold">
                <Money amount={Math.max(0, remaining)} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
              <p className="text-xs text-muted-foreground">{Math.max(0, (100 - Math.min(progress, 100))).toFixed(0)} % restants</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Versements nets (30 j)</p>
              <p className="text-2xl font-semibold">
                {net30 >= 0 ? "+" : "-"}
                <Money amount={Math.abs(net30)} minimumFractionDigits={0} maximumFractionDigits={0} />
              </p>
              <p className="text-xs text-muted-foreground">D’après les mouvements enregistrés</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rythme mensuel</p>
              <p className="text-2xl font-semibold">
                {health.forecast.averageMonthlyNet ? (
                  <Money amount={health.forecast.averageMonthlyNet} minimumFractionDigits={0} maximumFractionDigits={0} />
                ) : "—"}
                {health.forecast.averageMonthlyNet ? <span className="text-sm font-medium text-muted-foreground">/mois</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">Moyenne récente</p>
            </CardContent>
          </Card>
        </div>

        {/* Connections */}
        <Card>
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Relier cet objectif au reste du budget</p>
                <p className="text-sm text-muted-foreground">
                  Utilisez les transactions pour l’alimenter, les budgets pour le planifier et les analyses pour vérifier le rythme.
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

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
            <TabsTrigger value="activity">Activité</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Projection</CardTitle>
                  <CardDescription>Rythme nécessaire et date d’atteinte estimée</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {health.forecast.requiredMonthlyForDeadline ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Pour respecter l’échéance</span>
                      <span className="font-semibold">
                        <Money amount={health.forecast.requiredMonthlyForDeadline} minimumFractionDigits={0} maximumFractionDigits={0} />/mois
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Pour respecter l’échéance</span>
                      <span className="font-semibold">—</span>
                    </div>
                  )}

                  {health.forecast.averageMonthlyNet ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Moyenne récente nette</span>
                      <span className="font-semibold">
                        <Money amount={health.forecast.averageMonthlyNet} minimumFractionDigits={0} maximumFractionDigits={0} />/mois
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
                      <span className="text-muted-foreground">Moyenne récente nette</span>
                      <span className="font-semibold">—</span>
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground">Date d’atteinte estimée</p>
                    <p className="mt-1 font-semibold">
                      {health.forecast.estimatedReachDate
                        ? format(parseISO(health.forecast.estimatedReachDate), "MMM yyyy", { locale: fr })
                        : "Ajoutez quelques mouvements pour obtenir une projection fiable."}
                    </p>
                    {goal.deadline ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Échéance : {format(parseISO(goal.deadline), "d MMM yyyy", { locale: fr })}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Activité récente</CardTitle>
                  <CardDescription>{sortedContributions.length} mouvement(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {sortedContributions.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Aucun mouvement. Ajoutez un versement ou un retrait pour commencer le suivi.
                      </p>
                      <Button variant="outline" className="w-full" onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter le premier mouvement
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
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setDeleteConfirm(c.id!)}
                                aria-label={`Supprimer le mouvement du ${c.date}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button variant="outline" className="w-full" onClick={openAdd}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un mouvement
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
                <CardTitle className="text-base">Tous les mouvements</CardTitle>
                <CardDescription>L’historique est la source de référence du solde de l’objectif.</CardDescription>
              </CardHeader>
              <CardContent>
                {sortedContributions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun mouvement pour le moment.</p>
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
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => setDeleteConfirm(c.id!)}
                            aria-label={`Supprimer le mouvement du ${c.date}`}
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
            <DialogTitle>Ajouter un mouvement</DialogTitle>
            <DialogDescription>Choisissez un versement ou un retrait; le signe est appliqué automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de mouvement">
              <Button type="button" variant={contributionKind === "deposit" ? "default" : "outline"} onClick={() => setContributionKind("deposit")}>Versement</Button>
              <Button type="button" variant={contributionKind === "withdrawal" ? "default" : "outline"} onClick={() => setContributionKind("withdrawal")}>Retrait</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Montant</label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Note</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                setError(null);
                const raw = Number(amount);
                const numeric = contributionKind === "withdrawal" ? -Math.abs(raw) : Math.abs(raw);
                if (!Number.isFinite(numeric) || numeric === 0) {
                  setError("Saisissez un montant valide différent de zéro.");
                  return;
                }
                if (goal.currentAmount + numeric < 0) {
                  setError("Ce retrait rendrait le solde de l’objectif négatif.");
                  return;
                }
                try {
                  await addContribution({ goalId, amount: numeric, date, note });
                  setIsAddOpen(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Impossible d’ajouter la contribution");
                }
              }}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l’objectif</DialogTitle>
            <DialogDescription>Modifiez les paramètres. Utilisez les mouvements pour faire évoluer le solde.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom de l’objectif</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Compte lié (facultatif)</label>
              <Select
                value={editForm.linkedAccountId}
                onValueChange={(value) => setEditForm((v) => {
                  const account = value === "none" ? undefined : accounts.find((candidate) => candidate.id === Number(value));
                  return {
                    ...v,
                    linkedAccountId: value,
                    currentAmount: account ? account.balance.toString() : v.currentAmount,
                  };
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un compte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (objectif virtuel)</SelectItem>
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
                <label className="text-sm font-medium mb-1.5 block">Montant cible</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.targetAmount}
                  onChange={(e) => setEditForm((v) => ({ ...v, targetAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {editForm.linkedAccountId === "none" ? "Progression virtuelle" : "Solde du compte"}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.currentAmount}
                  disabled={editForm.linkedAccountId !== "none"}
                  onChange={(e) => setEditForm((v) => ({ ...v, currentAmount: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {editForm.linkedAccountId === "none"
                    ? "Valeur de planification uniquement : ce n’est pas de l’argent disponible sur un compte."
                    : "Valeur issue du compte lié : modifiez-la via les transactions ou un relevé de solde."}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Échéance (facultative)</label>
              <Input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm((v) => ({ ...v, deadline: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Couleur</label>
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
                    aria-label={`Choisir la couleur ${color}`}
                    aria-pressed={editForm.color === color}
                  />
                ))}
              </div>
            </div>

            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                setEditError(null);

                const name = editForm.name.trim();
                const targetAmount = Number(editForm.targetAmount);
                const selectedLinkedAccount = editForm.linkedAccountId === "none"
                  ? undefined
                  : accounts.find((account) => account.id === Number(editForm.linkedAccountId));
                const currentAmount = selectedLinkedAccount
                  ? selectedLinkedAccount.balance
                  : (Number(editForm.currentAmount) || 0);

                if (!name) {
                  setEditError("Saisissez un nom pour l’objectif.");
                  return;
                }
                if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
                  setEditError("Saisissez un montant cible valide.");
                  return;
                }
                if (!Number.isFinite(currentAmount) || currentAmount < 0) {
                  setEditError("Le montant actuel doit être positif ou nul.");
                  return;
                }
                if (currentAmount > targetAmount) {
                  setEditError("Le montant actuel ne peut pas dépasser la cible.");
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
                  setEditError(err instanceof Error ? err.message : "Impossible de modifier l’objectif");
                }
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la contribution</DialogTitle>
            <DialogDescription>Cette action ajustera le solde de l’objectif.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirm) return;
                try {
                  await deleteContribution(deleteConfirm);
                  setDeleteConfirm(null);
                } catch {
                  setDeleteConfirm(null);
                }
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteGoalConfirm} onOpenChange={setDeleteGoalConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l’objectif</DialogTitle>
            <DialogDescription>
              Cette action supprimera l’objectif et tout son historique de mouvements.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGoalConfirm(false)}>
              Annuler
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
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
