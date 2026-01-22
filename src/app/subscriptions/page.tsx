"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { addMonths, format } from "date-fns";
import {
  Plus,
  RefreshCw,
  CreditCard,
  Receipt,
  Landmark,
  Wallet,
  Archive,
  TrendingUp,
  Wrench,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getPrimaryAccount } from "@/lib/accounts";
import { 
  detectRecurringTransactions, 
  mergeRecurringItems,
  syncRecurringWithTransactions,
  fullRepairRecurring,
  type SyncResult,
} from "@/lib/csv-parser";
import { cn } from "@/lib/utils";

type TabValue = "subscriptions" | "bills" | "loans" | "income" | "ended";

export default function SubscriptionsPage() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
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
        .filter((r) => !r.isExcluded)
        .toArray();
      setRecurring(items);
    } catch (error) {
      console.error("Failed to load recurring transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

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

    const calculateMonthly = (items: RecurringTransaction[]) => {
      return items.reduce((sum, r) => {
        const amount = Math.abs(r.amount);
        switch (r.frequency) {
          case "weekly":
            return sum + amount * 4.33;
          case "biweekly":
            return sum + amount * 2.17;
          case "quarterly":
            return sum + amount / 3;
          case "yearly":
            return sum + amount / 12;
          default:
            return sum + amount;
        }
      }, 0);
    };

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
  }, [recurring]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Auto-detect recurring transactions
  const handleDetect = async () => {
    setIsDetecting(true);
    setSyncResult(null);
    try {
      const account = await getPrimaryAccount();
      if (!account?.id) {
        console.error("No active account found");
        return;
      }

      // Call the detection function which handles DB operations internally
      await detectRecurringTransactions();

      console.log("Recurring detection complete");
      await loadRecurring();
    } catch (error) {
      console.error("Failed to detect recurring:", error);
    } finally {
      setIsDetecting(false);
    }
  };

  // Sync & Repair - links transactions to existing recurring items
  const handleSyncRepair = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await fullRepairRecurring();
      setSyncResult(result);
      await loadRecurring();
    } catch (error) {
      console.error("Failed to sync:", error);
      setSyncResult({
        recurringUpdated: 0,
        transactionsLinked: 0,
        newRecurringCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Save (add or update) a recurring item
  const handleSave = async (data: Partial<RecurringTransaction>) => {
    const now = new Date().toISOString();
    const account = await getPrimaryAccount();

    if (editingItem?.id) {
      // Update existing
      await db.recurringTransactions.update(editingItem.id, {
        ...data,
        updatedAt: now,
      });
    } else {
      // Add new
      await db.recurringTransactions.add({
        ...data,
        accountId: account?.id || 1,
        lastDetected: now,
        nextExpected: data.startDate || now,
        occurrences: [],
        createdAt: now,
        updatedAt: now,
      } as RecurringTransaction);
    }

    setEditingItem(null);
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
      subscription: "Subscriptions",
      bill: "Bills",
      loan: "Loans",
      income: "Income",
    };
    setTypeChangeMessage(`"${item.name}" moved to ${typeLabels[newType]} tab`);
    
    // Auto-switch to the new tab
    const tabMap: Record<RecurringType, TabValue> = {
      subscription: "subscriptions",
      bill: "bills",
      loan: "loans",
      income: "income",
    };
    setActiveTab(tabMap[newType]);
    
    // Clear message after 3 seconds
    setTimeout(() => setTypeChangeMessage(null), 3000);
    
    await loadRecurring();
  };

  // Merge recurring items
  const handleMerge = async (targetId: number, sourceId: number) => {
    try {
      await mergeRecurringItems(targetId, sourceId);
      setMergeSource(null);
      await loadRecurring();
    } catch (error) {
      console.error("Failed to merge items:", error);
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
  const EmptyState = ({ type }: { type: TabValue }) => {
    const messages: Record<TabValue, { title: string; desc: string }> = {
      subscriptions: {
        title: "No subscriptions found",
        desc: "Add your recurring subscriptions like Netflix, Spotify, gym memberships",
      },
      bills: {
        title: "No bills tracked",
        desc: "Track recurring bills like rent, utilities, insurance",
      },
      loans: {
        title: "No loans tracked",
        desc: "Track loans with principal, interest rate, and payment progress",
      },
      income: {
        title: "No income sources",
        desc: "Track regular income like salary, dividends, or rental income",
      },
      ended: {
        title: "No ended items",
        desc: "Cancelled or completed subscriptions and loans will appear here",
      },
    };

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          {getTabIcon(type)}
        </div>
        <h3 className="text-lg font-medium mb-1">{messages[type].title}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          {messages[type].desc}
        </p>
        {type !== "ended" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDetect} disabled={isDetecting}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isDetecting && "animate-spin")} />
              Auto-Detect
            </Button>
            <Button onClick={() => openAddDialog(type === "subscriptions" ? "subscription" : type as RecurringType)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Manually
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Subscriptions & Recurring
            </h1>
            <p className="text-muted-foreground">
              Track subscriptions, bills, loans, and recurring income
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSyncRepair} 
              disabled={isSyncing || isDetecting}
            >
              <Wrench className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync & Repair"}
            </Button>
            <Button variant="outline" onClick={handleDetect} disabled={isDetecting || isSyncing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isDetecting && "animate-spin")} />
              {isDetecting ? "Detecting..." : "Auto-Detect"}
            </Button>
          </div>
        </div>

        {/* Sync Result Alert */}
        {syncResult && (
          <Alert variant={syncResult.errors.length > 0 ? "destructive" : "default"}>
            {syncResult.errors.length > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {syncResult.errors.length > 0 ? "Sync completed with errors" : "Sync completed successfully"}
            </AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                <p>• {syncResult.transactionsLinked} transactions linked to recurring items</p>
                <p>• {syncResult.recurringUpdated} recurring items updated with payment history</p>
                {syncResult.errors.length > 0 && (
                  <p className="text-red-600">• Errors: {syncResult.errors.join(", ")}</p>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2"
                onClick={() => setSyncResult(null)}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Type Change Message */}
        {typeChangeMessage && (
          <Alert className="border-blue-200 bg-blue-50">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">Type Changed</AlertTitle>
            <AlertDescription className="text-blue-600">
              {typeChangeMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-muted-foreground">Monthly Subscriptions</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totals.subscriptions)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">Monthly Bills</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totals.bills)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Monthly Loan Payments</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totals.loans)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">Total Monthly</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totals.total)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="subscriptions" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Subscriptions
                {counts.subscriptions > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.subscriptions}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bills" className="gap-2">
                <Receipt className="h-4 w-4" />
                Bills
                {counts.bills > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.bills}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="loans" className="gap-2">
                <Landmark className="h-4 w-4" />
                Loans
                {counts.loans > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.loans}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="income" className="gap-2">
                <Wallet className="h-4 w-4" />
                Income
                {counts.income > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {counts.income}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ended" className="gap-2">
                <Archive className="h-4 w-4" />
                Ended
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
                Add{" "}
                {activeTab === "subscriptions"
                  ? "Subscription"
                  : activeTab === "bills"
                  ? "Bill"
                  : activeTab === "loans"
                  ? "Loan"
                  : "Income"}
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
              <EmptyState type="subscriptions" />
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
              <EmptyState type="bills" />
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
              <EmptyState type="loans" />
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
              <EmptyState type="income" />
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
              <EmptyState type="ended" />
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
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">
                    Your recurring expenses cost {formatCurrency(totals.total * 12)} per
                    year
                  </p>
                  <p className="text-muted-foreground">
                    That's {formatCurrency(totals.total)} per month, or about{" "}
                    {formatCurrency(totals.total / 30)} per day.
                    {totals.income > 0 && (
                      <>
                        {" "}
                        Your recurring income is {formatCurrency(totals.income)}/month.
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
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this recurring item? This action cannot be
              undone.
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
