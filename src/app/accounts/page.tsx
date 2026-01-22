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
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { DataTable } from "@/components/ui/data-table";
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
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

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
  const { convertFromAccount } = useMoney();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      .reduce((sum, a) => sum + convertFromAccount(a.balance, a.id), 0);

    const liabilities = accounts
      .filter((a) => a.type === "credit" || a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(convertFromAccount(a.balance, a.id)), 0);

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  }, [accounts, convertFromAccount]);

  // Get latest balance from transactions if no accounts
  const latestBalance = useMemo(() => {
    if (transactions.length === 0) return 0;
    const tx = transactions[0];
    return tx ? convertFromAccount(tx.balanceAfter || 0, tx.accountId) : 0;
  }, [transactions, convertFromAccount]);

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const query = search.toLowerCase();
    return accounts.filter((account) =>
      [account.name, account.type, account.institution]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [accounts, search]);

  const getAccountIcon = (type: string) => {
    const accountType = ACCOUNT_TYPES.find((t) => t.value === type);
    if (accountType) {
      const IconComponent = accountType.icon;
      return <IconComponent className="h-5 w-5" />;
    }
    return <Wallet className="h-5 w-5" />;
  };

  const tableColumns = [
    { key: "account", label: "Account", className: "min-w-[240px]" },
    { key: "type", label: "Type", className: "text-sm" },
    { key: "updated", label: "Updated", className: "text-right w-32", align: "right" as const },
    { key: "balance", label: "Balance", className: "text-right w-32", align: "right" as const },
    { key: "actions", label: "", className: "text-right w-20" },
  ];

  const gridTemplate = "minmax(240px,2fr) 140px 140px 140px 100px";

  const renderRow = (account: Account) => {
    const accountTypeInfo = ACCOUNT_TYPES.find((t) => t.value === account.type);
    return [
      <div key="account" className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${account.color}15`,
            color: account.color,
          }}
        >
          {getAccountIcon(account.type)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{account.name}</span>
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {accountTypeInfo?.label || account.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {account.institution || "Personal account"}
          </p>
        </div>
      </div>,
      <div key="type" className="text-sm text-muted-foreground capitalize">
        {account.type}
      </div>,
      <div key="updated" className="text-right text-sm text-muted-foreground">
        {format(new Date(account.updatedAt), "MMM d, yyyy")}
      </div>,
      <div
        key="balance"
        className={cn(
          "text-right font-semibold tabular-nums",
          account.balance < 0 && "text-destructive"
        )}
      >
        <Money amount={account.balance} currency={account.currency} />
      </div>,
      <div
        key="actions"
        className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100"
        onClick={(event) => event.stopPropagation()}
      >
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
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={() => setDeleteConfirm(account.id!)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>,
    ];
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-xl font-semibold text-success tabular-nums">
                    <Money amount={totals.assets || latestBalance} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Liabilities</p>
                  <p className="text-xl font-semibold text-destructive tabular-nums">
                    <Money amount={totals.liabilities} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-info/5 border-info/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                  <Wallet className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Worth</p>
                  <p className={cn(
                    "text-xl font-semibold tabular-nums",
                    (totals.netWorth || latestBalance) >= 0 ? "text-info" : "text-destructive"
                  )}>
                    <Money amount={totals.netWorth || latestBalance} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search accounts..."
          actions={
            <Button onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          }
        />

        {/* Accounts List */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Your Accounts</h2>
            <p className="text-sm text-muted-foreground">
              {filteredAccounts.length > 0
                ? `${filteredAccounts.length} account${filteredAccounts.length !== 1 ? "s" : ""} tracked`
                : "Add your accounts to track balances across institutions"}
            </p>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title="No accounts yet"
                description="Add your bank accounts, credit cards, and investment accounts to get a complete view of your finances."
                primaryAction={{ label: "Add your first account", onClick: handleOpenAdd }}
                icon={<Wallet className="h-6 w-6 text-primary" />}
              />
              {latestBalance !== 0 && (
                <div className="rounded-2xl border border-border/70 bg-card/90 p-4 text-sm text-muted-foreground">
                  Based on recent transactions, your current balance is approximately{" "}
                  <span className="font-semibold text-foreground">
                    <Money amount={latestBalance} />
                  </span>
                  .
                </div>
              )}
            </div>
          ) : (
            <DataTable
              columns={tableColumns}
              rows={filteredAccounts}
              rowKey={(row) => row.id!}
              renderRow={renderRow}
              gridTemplate={gridTemplate}
              onRowClick={handleOpenEdit}
              rowClassName={() => "group transition-colors hover:bg-muted/40"}
              emptyState={null}
            />
          )}
        </div>
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
