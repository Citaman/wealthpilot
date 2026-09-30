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
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
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
import { logger } from "@/lib/logger";
import { deleteAccountSafely, getAccountTrust } from "@/lib/accounts";
import { addBalanceCheckpoint } from "@/lib/balance";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Compte courant", icon: Building2 },
  { value: "savings", label: "Épargne", icon: PiggyBank },
  { value: "credit", label: "Carte de crédit", icon: CreditCard },
  { value: "investment", label: "Investissement", icon: TrendingUp },
];

const ACCOUNT_COLORS = [
  "#FF6B4A", // coral
  "#FF8B70", // coral light
  "#FFAB96", // coral lighter
  "#FFCBBC", // coral lightest
  "#E8E8EC", // gray
];
const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"];

export default function AccountsPage() {
  const { convertFromAccount } = useMoney();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "checking",
    balance: "",
    currency: "EUR",
    institution: "",
    color: ACCOUNT_COLORS[0],
    balanceDate: format(new Date(), "yyyy-MM-dd"),
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
      logger.error("Error loading accounts:", error);
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
      currency: "EUR",
      institution: "",
      color: ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)],
      balanceDate: format(new Date(), "yyyy-MM-dd"),
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
      currency: account.currency || "EUR",
      institution: account.institution || "",
      color: account.color,
      balanceDate: format(new Date(), "yyyy-MM-dd"),
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
      currency: formData.currency.trim().toUpperCase() || "EUR",
      institution: formData.institution.trim(),
      color: formData.color,
      isActive: true,
    };

    if (editingAccount) {
      const balanceChanged = accountData.balance !== editingAccount.balance;
      await db.accounts.update(editingAccount.id!, {
        ...accountData,
        // A balance is derived once transactions exist; preserve its audit trail
        // by adding a dated known-balance checkpoint below.
        balance: balanceChanged ? editingAccount.balance : accountData.balance,
        updatedAt: now,
      });
      if (balanceChanged) {
        await addBalanceCheckpoint(
          editingAccount.id!,
          formData.balanceDate,
          accountData.balance,
          "Ajustement manuel du solde"
        );
      }
    } else {
      await db.accounts.add({
        ...accountData,
        initialBalance: accountData.balance,
        initialBalanceDate: formData.balanceDate,
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
    setDeleteError(null);
    try {
      await deleteAccountSafely(id);
      setDeleteConfirm(null);
      await loadData();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Ce compte ne peut pas être supprimé.");
    }
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
    { key: "account", label: "Compte", className: "min-w-[240px]" },
    { key: "type", label: "Type", className: "text-sm" },
    { key: "updated", label: "Actualisé", className: "text-right w-32", align: "right" as const },
    { key: "balance", label: "Solde", className: "text-right w-32", align: "right" as const },
    { key: "actions", label: "", className: "text-right w-20" },
  ];

  const renderRow = (account: Account) => {
    const accountTypeInfo = ACCOUNT_TYPES.find((t) => t.value === account.type);
    return [
      <div key="account" className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
        >
          {getAccountIcon(account.type)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{account.name}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {accountTypeInfo?.label || account.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {account.institution || "Compte personnel"}
          </p>
          <p className="text-xs text-muted-foreground">{getAccountTrust(account).label}</p>
        </div>
      </div>,
      <div key="type" className="text-sm text-muted-foreground capitalize">
        {accountTypeInfo?.label || account.type}
      </div>,
      <div key="updated" className="text-right text-sm text-muted-foreground">
        {format(new Date(account.updatedAt), "d MMM yyyy", { locale: fr })}
      </div>,
      <div
        key="balance"
        className="text-right font-semibold tabular-nums"
      >
        <Money amount={account.balance} currency={account.currency} />
      </div>,
      <div
        key="actions"
        className="flex items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => handleOpenEdit(account)}
          aria-label={`Modifier ${account.name}`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          onClick={() => {
            setDeleteError(null);
            setDeleteConfirm(account.id!);
          }}
          aria-label={`Supprimer ${account.name}`}
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
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total des actifs</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    <Money amount={accounts.length === 0 ? latestBalance : totals.assets} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <TrendingDown className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dettes</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    <Money amount={totals.liabilities} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Patrimoine net</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    <Money amount={accounts.length === 0 ? latestBalance : totals.netWorth} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Rechercher un compte…"
          actions={
            <Button onClick={handleOpenAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un compte
            </Button>
          }
        />

        {/* Accounts List */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Vos comptes</h2>
            <p className="text-sm text-muted-foreground">
              {filteredAccounts.length > 0
                ? `${filteredAccounts.length} compte${filteredAccounts.length !== 1 ? "s" : ""} suivi${filteredAccounts.length !== 1 ? "s" : ""}`
                : "Ajoutez vos comptes pour consolider les soldes du foyer"}
            </p>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                title="Aucun compte"
                description="Ajoutez vos comptes bancaires, cartes et placements pour obtenir une vue fiable du foyer."
                primaryAction={{ label: "Ajouter le premier compte", onClick: handleOpenAdd }}
                icon={<Wallet className="h-6 w-6 text-primary" />}
              />
              {latestBalance !== 0 && (
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  Based on recent transactions, your current balance is approximately{" "}
                  <span className="font-semibold text-foreground">
                    <Money amount={latestBalance} />
                  </span>
                  .
                </div>
              )}
            </div>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {filteredAccounts.map((account) => (
                <Card key={account.id}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold">{account.name}</p><p className="text-sm text-muted-foreground">{account.institution || "Institution non renseignée"}</p></div>
                      <p className="font-semibold"><Money amount={account.balance} currency={account.currency} /></p>
                    </div>
                    <p className="text-sm text-muted-foreground">{getAccountTrust(account).label} · {account.currency}</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => handleOpenEdit(account)}><Edit2 className="mr-2 h-4 w-4" />Modifier</Button>
                      <Button variant="outline" onClick={() => { setDeleteError(null); setDeleteConfirm(account.id!); }}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="hidden md:block">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[780px] text-sm">
                <thead><tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">{tableColumns.map((column) => <th key={column.key} scope="col" className={cn("px-4 py-3", column.className)}>{column.label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
                <tbody>{filteredAccounts.map((account) => <tr key={account.id} className="border-b last:border-0 hover:bg-muted/40" onDoubleClick={() => handleOpenEdit(account)}>{renderRow(account).map((cell, index) => <td key={tableColumns[index].key} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Account Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Modifier le compte" : "Ajouter un compte"}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Mettez à jour les informations et le point de solde."
                : "Ajoutez un compte financier avec un solde daté."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nom du compte</label>
              <Input
                placeholder="Ex. Compte courant principal"
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
                <label className="text-sm font-medium mb-1.5 block">Solde actuel</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Institution</label>
                <Input
                  placeholder="Ex. Société Générale"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Devise</label>
                <Select value={formData.currency} onValueChange={(currency) => setFormData({ ...formData, currency })}>
                  <SelectTrigger aria-label="Devise du compte"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUPPORTED_CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block" htmlFor="account-balance-date">Date du solde connu</label>
              <Input id="account-balance-date" type="date" value={formData.balanceDate} onChange={(event) => setFormData({ ...formData, balanceDate: event.target.value })} />
              <p className="mt-1 text-sm text-muted-foreground">Ce point daté sert de base au recalcul du compte.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Couleur</label>
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
                    aria-label={`Couleur ${color}`}
                    aria-pressed={formData.color === color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingAccount ? "Enregistrer" : "Ajouter le compte"}
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
            <DialogTitle>Supprimer le compte</DialogTitle>
            <DialogDescription>
              La suppression est possible uniquement si aucune transaction, échéance, checkpoint, détection de salaire ou objectif ne référence ce compte.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
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
