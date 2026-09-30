"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  CreditCard,
  Receipt,
  Landmark,
  Wallet,
  Archive,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SubscriptionCard,
  LoanCard,
  PaymentHistoryDialog,
  AddEditRecurringDialog,
  MergeRecurringDialog,
} from "@/components/subscriptions";
import {
  db,
  type RecurringTransaction,
  type RecurringType,
  type RecurringStatus,
} from "@/lib/db";
import { mergeRecurringItems } from "@/lib/csv-parser";
import { detectRecurringForAccounts, toMonthlyRecurringAmount } from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { logger } from "@/lib/logger";
import { useAccount } from "@/contexts/account-context";

type TabValue = "subscriptions" | "bills" | "loans" | "income" | "ended";

export default function SubscriptionsPage() {
  const { convertFromAccount } = useMoney();
  const { selectedAccountId, accounts } = useAccount();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("subscriptions");
  const [typeChangeMessage, setTypeChangeMessage] = useState<string | null>(null);
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogType, setAddDialogType] = useState<RecurringType>("subscription");
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [historyItem, setHistoryItem] = useState<RecurringTransaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [mergeSource, setMergeSource] = useState<RecurringTransaction | null>(null);

  // Load recurring transactions
  const loadRecurring = useCallback(async () => {
    try {
      const items = await db.recurringTransactions
        .filter((r) => !r.isExcluded && (selectedAccountId === "all" || r.accountId === selectedAccountId))
        .toArray();
      setRecurring(items);
    } catch (error) {
      logger.error("Failed to load recurring transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  useEffect(() => {
    if (!typeChangeMessage) return;
    const timeout = window.setTimeout(() => setTypeChangeMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [typeChangeMessage]);

  // Filter items by tab
  const filteredItems = useMemo(() => {
    const isEnded = (item: RecurringTransaction) =>
      item.status === "cancelled" || item.status === "completed";

    switch (activeTab) {
      case "subscriptions":
        return recurring.filter(
          (r) => (r.type === "subscription" || !r.type) && !isEnded(r)
        );
      case "bills":
        return recurring.filter((r) => r.type === "bill" && !isEnded(r));
      case "loans":
        return recurring.filter((r) => r.type === "loan" && !isEnded(r));
      case "income":
        return recurring.filter((r) => r.type === "income" && !isEnded(r));
      case "ended":
        return recurring.filter(isEnded);
      default:
        return [];
    }
  }, [recurring, activeTab]);

  // Count items by type
  const counts = useMemo(() => {
    const isEnded = (item: RecurringTransaction) =>
      item.status === "cancelled" || item.status === "completed";

    return {
      subscriptions: recurring.filter(
        (r) => (r.type === "subscription" || !r.type) && !isEnded(r)
      ).length,
      bills: recurring.filter((r) => r.type === "bill" && !isEnded(r)).length,
      loans: recurring.filter((r) => r.type === "loan" && !isEnded(r)).length,
      income: recurring.filter((r) => r.type === "income" && !isEnded(r)).length,
      ended: recurring.filter(isEnded).length,
    };
  }, [recurring]);

  // Calculate monthly totals by type
  const totals = useMemo(() => {
    const activeItems = recurring.filter(
      (r) =>
        r.status === "active" &&
        !r.isExcluded &&
        r.type !== "income"
    );

    const calculateMonthly = (items: RecurringTransaction[]) => items.reduce(
      (sum, item) => sum + Math.abs(convertFromAccount(toMonthlyRecurringAmount(item), item.accountId)), 0
    );

    const subscriptions = calculateMonthly(
      activeItems.filter((r) => r.type === "subscription" || !r.type)
    );
    const bills = calculateMonthly(activeItems.filter((r) => r.type === "bill"));
    const loans = calculateMonthly(activeItems.filter((r) => r.type === "loan"));
    
    const incomeItems = recurring.filter(
      (r) => r.status === "active" && r.type === "income"
    );
    const income = calculateMonthly(incomeItems);

    return {
      subscriptions,
      bills,
      loans,
      total: subscriptions + bills + loans,
      income,
    };
  }, [recurring, convertFromAccount]);

  // Auto-detect recurring transactions
  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      const accountIds = selectedAccountId === "all"
        ? accounts.filter((candidate) => candidate.isActive !== false && candidate.id).map((candidate) => candidate.id!)
        : accounts.filter((candidate) => candidate.id === selectedAccountId && candidate.id).map((candidate) => candidate.id!);
      if (accountIds.length === 0) {
        logger.error("No active account found");
        setTypeChangeMessage("Aucun compte actif n’est disponible pour la détection.");
        return;
      }

      // Call the detection function which handles DB operations internally
      const { created, byAccount } = await detectRecurringForAccounts(accountIds);

      logger.log("Recurring detection complete");
      const detail = accounts
        .filter((account) => account.id && byAccount[account.id] !== undefined)
        .map((account) => `${account.name} : ${byAccount[account.id!]} trouvé${byAccount[account.id!] > 1 ? "s" : ""}`)
        .join(" · ");
      setTypeChangeMessage(created > 0
        ? `${created} récurrent${created > 1 ? "s" : ""} détecté${created > 1 ? "s" : ""}. ${detail}`
        : `Aucun nouveau récurrent fiable. ${detail}`);
      await loadRecurring();
    } catch (error) {
      logger.error("Failed to detect recurring:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  // Save (add or update) a recurring item
  const handleSave = async (data: Partial<RecurringTransaction>) => {
    const now = new Date().toISOString();
    const accountId = data.accountId ?? editingItem?.accountId ?? (selectedAccountId === "all" ? undefined : selectedAccountId);
    if (accountId === undefined) {
      setTypeChangeMessage("Choisissez le compte concerné avant d’enregistrer ce récurrent.");
      return;
    }

    if (editingItem?.id) {
      // Update existing
      await db.recurringTransactions.update(editingItem.id, {
        ...data,
        accountId,
        updatedAt: now,
      });
    } else {
      // Add new
      await db.recurringTransactions.add({
        ...data,
        accountId,
        lastDetected: now,
        nextExpected: data.startDate || now,
        occurrences: [],
        createdAt: now,
        updatedAt: now,
      } as RecurringTransaction);
    }

    setEditingItem(null);
    setTypeChangeMessage(editingItem?.id ? "Récurrent mis à jour." : "Récurrent ajouté au bon compte.");
    await loadRecurring();
  };

  // Toggle pause/resume
  const handlePause = async (item: RecurringTransaction) => {
    if (!item.id) return;
    const newStatus: RecurringStatus =
      item.status === "paused" ? "active" : "paused";
    await db.recurringTransactions.update(item.id, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    await loadRecurring();
  };

  // Mark as cancelled
  const handleCancel = async (item: RecurringTransaction) => {
    if (!item.id) return;
    await db.recurringTransactions.update(item.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      endDate: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString(),
    });
    await loadRecurring();
  };

  // Mark loan as completed
  const handleMarkComplete = async (item: RecurringTransaction) => {
    if (!item.id) return;
    await db.recurringTransactions.update(item.id, {
      status: "completed",
      endDate: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString(),
    });
    await loadRecurring();
  };

  // Exclude (false positive)
  const handleExclude = async (item: RecurringTransaction) => {
    if (!item.id) return;
    await db.recurringTransactions.update(item.id, {
      isExcluded: true,
      updatedAt: new Date().toISOString(),
    });
    await loadRecurring();
  };

  // Delete
  const handleDelete = async (id: number) => {
    await db.recurringTransactions.delete(id);
    setDeleteConfirm(null);
    await loadRecurring();
  };

  // Change recurring type (subscription/bill/loan/income)
  const handleChangeType = async (item: RecurringTransaction, newType: RecurringType) => {
    if (!item.id) return;
    
    const oldType = item.type || "subscription";
    const now = new Date().toISOString();
    const isChangingToIncome = newType === "income";
    const isChangingFromIncome = oldType === "income";
    
    // Flip the amount sign if changing to/from income
    let newAmount = item.amount;
    if (isChangingToIncome && !isChangingFromIncome) {
      // Changing TO income - make positive
      newAmount = Math.abs(item.amount);
    } else if (!isChangingToIncome && isChangingFromIncome) {
      // Changing FROM income - make negative
      newAmount = -Math.abs(item.amount);
    }
    
    // Update category based on new type
    let newCategory = item.category;
    if (isChangingToIncome) {
      newCategory = "Income";
    } else if (isChangingFromIncome) {
      // Moving from income to something else, assign appropriate category
      newCategory = newType === "loan" ? "Housing" : "Bills";
    }
    
    await db.recurringTransactions.update(item.id, {
      type: newType,
      amount: newAmount,
      category: newCategory,
      updatedAt: now,
    });
    
    // Show message and switch to appropriate tab
    const typeLabels: Record<RecurringType, string> = {
      subscription: "Abonnements",
      bill: "Factures",
      loan: "Crédits",
      income: "Revenus",
    };
    setTypeChangeMessage(`« ${item.name} » a été déplacé vers ${typeLabels[newType]}.`);
    
    // Auto-switch to the new tab
    const tabMap: Record<RecurringType, TabValue> = {
      subscription: "subscriptions",
      bill: "bills",
      loan: "loans",
      income: "income",
    };
    setActiveTab(tabMap[newType]);
    
    await loadRecurring();
  };

  // Merge recurring items
  const handleMerge = async (targetId: number, sourceId: number) => {
    try {
      const result = await mergeRecurringItems(targetId, sourceId);
      if ((result.errors?.length ?? 0) > 0) {
        throw new Error(result.errors?.join(" "));
      }
      setMergeSource(null);
      setTypeChangeMessage("Les récurrences ont été fusionnées.");
      await loadRecurring();
    } catch (error) {
      logger.error("Failed to merge items:", error);
    }
  };

  // Open add dialog with correct type
  const openAddDialog = (type: RecurringType) => {
    setAddDialogType(type);
    setEditingItem(null);
    setAddDialogOpen(true);
  };

  // Get tab icon
  const getTabIcon = (tab: TabValue) => {
    switch (tab) {
      case "subscriptions":
        return <CreditCard className="h-4 w-4" />;
      case "bills":
        return <Receipt className="h-4 w-4" />;
      case "loans":
        return <Landmark className="h-4 w-4" />;
      case "income":
        return <Wallet className="h-4 w-4" />;
      case "ended":
        return <Archive className="h-4 w-4" />;
    }
  };

  // Empty state component
  const SubscriptionsEmptyState = ({ type }: { type: TabValue }) => {
    const messages: Record<TabValue, { title: string; desc: string }> = {
      subscriptions: {
        title: "Aucun abonnement",
        desc: "Ajoutez vos abonnements récurrents : streaming, salle de sport ou logiciels.",
      },
      bills: {
        title: "Aucune facture suivie",
        desc: "Suivez le loyer, l’énergie, les assurances et les autres factures récurrentes.",
      },
      loans: {
        title: "Aucun crédit suivi",
        desc: "Suivez le capital, le taux et l’avancement de chaque crédit.",
      },
      income: {
        title: "Aucun revenu récurrent",
        desc: "Suivez les salaires, dividendes ou revenus locatifs réguliers.",
      },
      ended: {
        title: "Aucun élément terminé",
        desc: "Les abonnements annulés et crédits terminés apparaîtront ici.",
      },
    };

    return (
      <EmptyState
        title={messages[type].title}
        description={messages[type].desc}
        primaryAction={
          type === "ended"
            ? undefined
            : {
                label: "Ajouter manuellement",
                onClick: () => openAddDialog(type === "subscriptions" ? "subscription" : type as RecurringType),
              }
        }
        secondaryAction={
          type === "ended"
            ? undefined
            : {
                label: isDetecting ? "Détection…" : "Détecter automatiquement",
                onClick: handleDetect,
              }
        }
        icon={getTabIcon(type)}
      />
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Suivez les abonnements, factures, crédits et revenus récurrents du foyer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDetect} disabled={isDetecting}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isDetecting && "animate-spin")} />
              {isDetecting ? "Détection…" : "Détecter automatiquement"}
            </Button>
          </div>
        </div>

        {/* Type Change Message */}
        {typeChangeMessage && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Éléments récurrents mis à jour</AlertTitle>
            <AlertDescription>
              {typeChangeMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Abonnements mensuels</p>
              </div>
              <p className="text-2xl font-semibold"><Money amount={totals.subscriptions} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Factures mensuelles</p>
              </div>
              <p className="text-2xl font-semibold"><Money amount={totals.bills} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensualités de crédits</p>
              </div>
              <p className="text-2xl font-semibold"><Money amount={totals.loans} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total mensuel</p>
              </div>
              <p className="text-2xl font-semibold"><Money amount={totals.total} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="subscriptions" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Abonnements
                {counts.subscriptions > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.subscriptions}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bills" className="gap-2">
                <Receipt className="h-4 w-4" />
                Factures
                {counts.bills > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.bills}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="loans" className="gap-2">
                <Landmark className="h-4 w-4" />
                Crédits
                {counts.loans > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.loans}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="income" className="gap-2">
                <Wallet className="h-4 w-4" />
                Revenus
                {counts.income > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.income}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ended" className="gap-2">
                <Archive className="h-4 w-4" />
                Terminés
                {counts.ended > 0 && (
                  <Badge variant="outline" className="ml-1">
                    {counts.ended}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {activeTab !== "ended" && (
              <Button
                onClick={() =>
                  openAddDialog(
                    activeTab === "subscriptions"
                      ? "subscription"
                      : (activeTab as RecurringType)
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter {" "}
                {activeTab === "subscriptions"
                  ? "un abonnement"
                  : activeTab === "bills"
                  ? "une facture"
                  : activeTab === "loans"
                  ? "un crédit"
                  : "un revenu"}
              </Button>
            )}
          </div>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <SubscriptionsEmptyState type="subscriptions" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <SubscriptionCard
                    key={item.id}
                    subscription={item}
                    onEdit={setEditingItem}
                    onViewHistory={setHistoryItem}
                    onPause={handlePause}
                    onCancel={handleCancel}
                    onDelete={(sub) => sub.id && setDeleteConfirm(sub.id)}
                    onExclude={handleExclude}
                    onMerge={setMergeSource}
                    onChangeType={handleChangeType}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bills Tab */}
          <TabsContent value="bills" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <SubscriptionsEmptyState type="bills" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <SubscriptionCard
                    key={item.id}
                    subscription={item}
                    onEdit={setEditingItem}
                    onViewHistory={setHistoryItem}
                    onPause={handlePause}
                    onCancel={handleCancel}
                    onDelete={(sub) => sub.id && setDeleteConfirm(sub.id)}
                    onExclude={handleExclude}
                    onMerge={setMergeSource}
                    onChangeType={handleChangeType}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <SubscriptionsEmptyState type="loans" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredItems.map((item) => (
                  <LoanCard
                    key={item.id}
                    loan={item}
                    onEdit={setEditingItem}
                    onViewHistory={setHistoryItem}
                    onDelete={(loan) => loan.id && setDeleteConfirm(loan.id)}
                    onMarkComplete={handleMarkComplete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Income Tab */}
          <TabsContent value="income" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <SubscriptionsEmptyState type="income" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <SubscriptionCard
                    key={item.id}
                    subscription={item}
                    onEdit={setEditingItem}
                    onViewHistory={setHistoryItem}
                    onPause={handlePause}
                    onCancel={handleCancel}
                    onDelete={(sub) => sub.id && setDeleteConfirm(sub.id)}
                    onExclude={handleExclude}
                    onMerge={setMergeSource}
                    onChangeType={handleChangeType}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ended Tab */}
          <TabsContent value="ended" className="mt-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <SubscriptionsEmptyState type="ended" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) =>
                  item.type === "loan" ? (
                    <LoanCard
                      key={item.id}
                      loan={item}
                      onEdit={setEditingItem}
                      onViewHistory={setHistoryItem}
                      onDelete={(loan) => loan.id && setDeleteConfirm(loan.id)}
                      onMarkComplete={handleMarkComplete}
                    />
                  ) : (
                    <SubscriptionCard
                      key={item.id}
                      subscription={item}
                      onEdit={setEditingItem}
                      onViewHistory={setHistoryItem}
                      onPause={handlePause}
                      onCancel={handleCancel}
                      onDelete={(sub) => sub.id && setDeleteConfirm(sub.id)}
                      onExclude={handleExclude}
                      onMerge={setMergeSource}
                      onChangeType={handleChangeType}
                    />
                  )
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Info */}
        {totals.total > 0 && (
          <Card className="bg-muted">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">
                    Vos dépenses récurrentes représentent <Money amount={totals.total * 12} minimumFractionDigits={2} maximumFractionDigits={2} /> par an.
                  </p>
                  <p className="text-muted-foreground">
                    Soit <Money amount={totals.total} minimumFractionDigits={2} maximumFractionDigits={2} /> par mois, environ{" "}
                    <Money amount={totals.total / 30} minimumFractionDigits={2} maximumFractionDigits={2} /> par jour.
                    {totals.income > 0 && (
                      <>
                        {" "}
                        Vos revenus récurrents sont de <Money amount={totals.income} minimumFractionDigits={2} maximumFractionDigits={2} /> par mois.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <AddEditRecurringDialog
        open={addDialogOpen || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false);
            setEditingItem(null);
          }
        }}
        recurring={editingItem}
        onSave={handleSave}
        defaultType={editingItem?.type || addDialogType}
        defaultAccountId={selectedAccountId === "all" ? undefined : selectedAccountId}
      />

      {/* Payment History Dialog */}
      <PaymentHistoryDialog
        subscription={historyItem}
        open={!!historyItem}
        onOpenChange={(open) => !open && setHistoryItem(null)}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l’élément</DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer cet élément récurrent ? Cette action est irréversible.
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

      {/* Merge Dialog */}
      <MergeRecurringDialog
        open={!!mergeSource}
        onOpenChange={(open) => !open && setMergeSource(null)}
        sourceItem={mergeSource}
        allItems={recurring}
        onMerge={handleMerge}
      />
    </AppLayout>
  );
}
