"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  CreditCard,
  Building2,
  PiggyBank,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
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
import { db, type Account, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", icon: Building2 },
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "credit", label: "Credit Card", icon: CreditCard },
  { value: "investment", label: "Investment", icon: TrendingUp },
  { value: "cash", label: "Cash", icon: Wallet },
];

const ACCOUNT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    balance: "",
    color: ACCOUNT_COLORS[0],
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accountsData, txData] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.orderBy("date").reverse().limit(100).toArray(),
      ]);
      setAccounts(accountsData);
      setTransactions(txData);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      type: "checking",
      balance: "",
      color: ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)],
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingAccount(null);
    setAddDialogOpen(true);
  };

  const handleOpenEdit = (account: Account) => {
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      color: account.color,
    });
    setEditingAccount(account);
    setAddDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    const now = new Date().toISOString();
    const accountData = {
      name: formData.name,
      type: formData.type as Account["type"],
      balance: parseFloat(formData.balance) || 0,
      color: formData.color,
      isActive: true,
    };

    if (editingAccount) {
      await db.accounts.update(editingAccount.id!, {
        ...accountData,
        updatedAt: now,
      });
    } else {
      await db.accounts.add({
        ...accountData,
        createdAt: now,
        updatedAt: now,
      } as Account);
    }

    setAddDialogOpen(false);
    resetForm();
    setEditingAccount(null);
    await loadData();
  };

  const handleDelete = async (id: number) => {
    await db.accounts.delete(id);
    setDeleteConfirm(null);
    await loadData();
  };

  // Calculate totals
  const totals = useMemo(() => {
    const assets = accounts
      .filter((a) => a.type !== "credit" && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0);

    const liabilities = accounts
      .filter((a) => a.type === "credit" || a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  }, [accounts]);

  // Get latest balance from transactions if no accounts
  const latestBalance = useMemo(() => {
    if (transactions.length === 0) return 0;
    return transactions[0]?.balanceAfter || 0;
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getAccountIcon = (type: string) => {
    const accountType = ACCOUNT_TYPES.find((t) => t.value === type);
    if (accountType) {
      const IconComponent = accountType.icon;
      return <IconComponent className="h-5 w-5" />;
    }
    return <Wallet className="h-5 w-5" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="text-muted-foreground">
              Manage your financial accounts
            </p>
          </div>
          <Button onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(totals.assets || latestBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Liabilities</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(totals.liabilities)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Worth</p>
                  <p className={cn(
                    "text-xl font-bold",
                    (totals.netWorth || latestBalance) >= 0 ? "text-blue-600" : "text-red-600"
                  )}>
                    {formatCurrency(totals.netWorth || latestBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Accounts</CardTitle>
            <CardDescription>
              {accounts.length > 0
                ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""} tracked`
                : "Add your accounts to track balances across institutions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No accounts yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Add your bank accounts, credit cards, and investment accounts to get a complete view of your finances.
                </p>
                <Button onClick={handleOpenAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Account
                </Button>

                {latestBalance !== 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Based on your transactions, your current balance is approximately:
                    </p>
                    <p className="text-xl font-bold mt-1">{formatCurrency(latestBalance)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map((account) => {
                  const accountTypeInfo = ACCOUNT_TYPES.find((t) => t.value === account.type);

                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${account.color}15`,
                          color: account.color,
                        }}
                      >
                        {getAccountIcon(account.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                            {accountTypeInfo?.label || account.type}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {format(new Date(account.updatedAt), "MMM d, yyyy")}
                        </p>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            "text-xl font-bold",
                            account.balance < 0 ? "text-red-600" : ""
                          )}
                        >
                          {formatCurrency(account.balance)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(account)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                          onClick={() => setDeleteConfirm(account.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Account Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add Account"}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Update your account details"
                : "Add a new financial account to track"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Account Name</label>
              <Input
                placeholder="e.g., Main Checking"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Current Balance</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Color</label>
              <div className="flex gap-2">
                {ACCOUNT_COLORS.map((color) => (
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
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingAccount ? "Save Changes" : "Add Account"}
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
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this account? This will only remove it from tracking, not affect your actual bank account.
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
