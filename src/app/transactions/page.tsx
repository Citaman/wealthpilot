"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Filter,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Tags,
  Repeat,
  SquareStack,
  Eye,
  EyeOff,
  Edit2,
  MoreHorizontal,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BatchActionBar } from "@/components/transactions/batch-action-bar";
import { TransactionEditDialog } from "@/components/transactions/transaction-edit-dialog";
import { BulkWorkbench } from "@/components/transactions/bulk-workbench";
import { AddEditRecurringDialog } from "@/components/subscriptions";
import { useTransactions, useMerchantRules } from "@/hooks/use-data";
import { CATEGORIES, db, type Transaction, type RecurringTransaction } from "@/lib/db";
import { linkTransactionToRecurring } from "@/lib/csv-parser";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { useAccount } from "@/contexts/account-context";
import { useSearchParams } from "next/navigation";
import { CategoryBadge } from "@/components/transactions/category-select";
import { TransactionTypeBadge, TransactionTypeButton } from "@/components/budgets";
import { TransactionsSkeleton } from "@/components/ui/skeleton-card";
import { calculateFinancialMetrics } from "@/lib/financial-metrics";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

type SortField = "date" | "amount" | "merchant" | "category";
type SortDirection = "asc" | "desc";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsPageFallback />}>
      <TransactionsPageContent />
    </Suspense>
  );
}

function TransactionsPageFallback() {
  return (
    <AppLayout>
      <TransactionsSkeleton />
    </AppLayout>
  );
}

function TransactionsPageContent() {
  const { convertFromAccount, getAccountCurrency } = useMoney();
  const { toast } = useToast();
  // Account context
  const { selectedAccountId } = useAccount();
  const searchParams = useSearchParams();
  const seededSearch = useRef(false);
  const seededFilters = useRef(false);
  const seededEdit = useRef(false);
  const now = new Date();
  const [dateRange, setDateRange] = useState({
    start: subMonths(startOfMonth(now), 2),
    end: endOfMonth(now),
  });
  
  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [recurringFilter, setRecurringFilter] = useState<string>("all");
  
  // Sorting & Pagination
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  
  // Edit Dialog
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [similarCount, setSimilarCount] = useState(0);

  // Create Recurring Dialog
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [recurringFromTransaction, setRecurringFromTransaction] = useState<Transaction | null>(null);

  // Bulk Workbench
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    if (seededSearch.current) return;
    const query = searchParams.get("q");
    if (query) setSearch(query);
    seededSearch.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (seededFilters.current) return;

    const category = searchParams.get("category");
    const direction = searchParams.get("type") || searchParams.get("direction");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (category) setCategoryFilter(category);
    if (direction === "debit" || direction === "credit") setDirectionFilter(direction);
    if (start && end && !Number.isNaN(Date.parse(start)) && !Number.isNaN(Date.parse(end))) {
      setDateRange({ start: new Date(`${start}T12:00:00`), end: new Date(`${end}T12:00:00`) });
    }
    seededFilters.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (seededEdit.current) return;
    const editId = searchParams.get("editId");
    if (!editId) return;
    const parsed = Number(editId);
    if (!Number.isFinite(parsed)) return;
    seededEdit.current = true;
    db.transactions.get(parsed).then((tx) => {
      if (tx) setEditingTransaction(tx);
    });
  }, [searchParams]);

  // Data hooks
  const { 
    transactions, 
    isLoading, 
    updateTransaction,
    updateTransactions,
    deleteTransaction,
    deleteTransactions,
    findSimilarTransactions,
  } = useTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: selectedAccountId,
  });

  const { createRuleFromTransaction } = useMerchantRules();

  // Filtered & sorted transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.merchant.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.category.toLowerCase().includes(searchLower) ||
          t.subcategory.toLowerCase().includes(searchLower) ||
          (t.notes || "").toLowerCase().includes(searchLower) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Direction filter
    if (directionFilter !== "all") {
      filtered = filtered.filter((t) => t.direction === directionFilter);
    }

    // Recurring filter
    if (recurringFilter !== "all") {
      filtered = filtered.filter((t) => t.isRecurring === (recurringFilter === "recurring"));
    }

    // Tag filter
    if (tagFilter !== "all") {
      filtered = filtered.filter((t) => t.tags?.includes(tagFilter));
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case "merchant":
          comparison = a.merchant.localeCompare(b.merchant);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, search, categoryFilter, directionFilter, recurringFilter, tagFilter, sortField, sortDirection]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    transactions.forEach((t) => {
      t.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [transactions]);

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const handleEdit = useCallback(async (transaction: Transaction) => {
    setEditingTransaction(transaction);
    const similar = await findSimilarTransactions(transaction.merchantOriginal || transaction.merchant);
    setSimilarCount(similar.filter(t => t.id !== transaction.id).length);
  }, [findSimilarTransactions]);

  const handleCreateRecurring = useCallback((transaction: Transaction) => {
    setRecurringFromTransaction(transaction);
    setRecurringDialogOpen(true);
  }, []);

  const handleToggleExcluded = useCallback(async (transaction: Transaction) => {
    if (!transaction.id) return;
    const nextExcluded = !transaction.isExcluded;
    await updateTransaction(transaction.id, { isExcluded: nextExcluded });
    toast({
      title: nextExcluded ? "Transaction exclue" : "Transaction réintégrée",
      description: nextExcluded ? "Elle ne compte plus dans les budgets et analyses." : "Elle compte de nouveau dans les budgets et analyses.",
      action: <ToastAction altText="Annuler" onClick={() => updateTransaction(transaction.id!, { isExcluded: transaction.isExcluded })}>Annuler</ToastAction>,
    });
  }, [toast, updateTransaction]);

  const handleSaveRecurring = async (data: Partial<RecurringTransaction>) => {
    const now = new Date().toISOString();
    await db.recurringTransactions.add({
      ...data,
      accountId: recurringFromTransaction?.accountId ?? data.accountId,
      lastDetected: now,
      nextExpected: data.startDate || now,
      occurrences: recurringFromTransaction ? [{
        id: crypto.randomUUID(),
        transactionId: recurringFromTransaction.id,
        date: recurringFromTransaction.date,
        amount: recurringFromTransaction.amount,
        status: 'paid' as const,
      }] : [],
      createdAt: now,
      updatedAt: now,
    } as RecurringTransaction);

    // Mark the transaction as recurring
    if (recurringFromTransaction?.id) {
      await db.transactions.update(recurringFromTransaction.id, { isRecurring: true });
    }

    setRecurringFromTransaction(null);
    setRecurringDialogOpen(false);
  };

  const handleLinkToExisting = async (recurringId: number, transactionId: number) => {
    try {
      await linkTransactionToRecurring(transactionId, recurringId);
      setRecurringFromTransaction(null);
      setRecurringDialogOpen(false);
    } catch (error) {
      console.error("Failed to link transaction:", error);
    }
  };

  const handleSave = async (transaction: Transaction, applyToSimilar?: boolean) => {
    if (!transaction.id) return;

    const original = await db.transactions.get(transaction.id);
    const categoryChanged = original && (
      original.category !== transaction.category ||
      original.subcategory !== transaction.subcategory
    );

    await updateTransaction(transaction.id, {
      category: transaction.category,
      subcategory: transaction.subcategory,
      merchant: transaction.merchant,
      notes: transaction.notes,
      tags: transaction.tags,
      isRecurring: transaction.isRecurring,
      isExcluded: transaction.isExcluded,
      ...(categoryChanged ? {
        classificationSource: 'manual' as const,
        classificationConfidence: 1,
        classificationReason: 'Catégorie confirmée manuellement dans WealthPilot.',
      } : {}),
    });

    if (applyToSimilar) {
      const similar = await findSimilarTransactions(transaction.merchantOriginal || transaction.merchant);
      const otherIds = similar.filter(t => t.id !== transaction.id).map(t => t.id!);
      
      if (otherIds.length > 0) {
        await updateTransactions(otherIds, {
          category: transaction.category,
          subcategory: transaction.subcategory,
          merchant: transaction.merchant,
          classificationSource: 'manual',
          classificationConfidence: 1,
          classificationReason: 'Catégorie appliquée manuellement à des transactions similaires.',
        });
      }

      await createRuleFromTransaction(
        transaction.merchantOriginal || transaction.merchant,
        transaction.merchant,
        transaction.category,
        transaction.subcategory
      );
    }
  };

  const handleDelete = async (id: number) => {
    await deleteTransaction(id);
  };

  const handleSelect = (id: number, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (selected: boolean | "indeterminate") => {
    if (selected === "indeterminate") return;
    if (selected) {
      setSelectedIds(new Set(paginatedTransactions.map((t) => t.id!)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    toast({
      variant: "destructive",
      title: `Supprimer ${ids.length} transaction${ids.length > 1 ? "s" : ""} ?`,
      description: "Cette action modifie les soldes recalculés.",
      action: <ToastAction altText="Confirmer la suppression" onClick={async () => { await deleteTransactions(ids); setSelectedIds(new Set()); }}>Confirmer</ToastAction>,
    });
  };

  const exportToCSV = () => {
    const headers = ["Date", "Merchant", "Category", "Subcategory", "Amount", "Direction", "Balance", "Tags", "Notes"];
    const rows = filteredTransactions.map((t) => [
      t.date,
      `"${t.merchant.replace(/"/g, '""')}"`,
      t.category,
      t.subcategory,
      t.amount.toFixed(2),
      t.direction,
      t.balanceAfter.toFixed(2),
      `"${(t.tags || []).join(', ')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate totals
  const totals = useMemo(() => {
    return calculateFinancialMetrics(filteredTransactions, convertFromAccount);
  }, [filteredTransactions, convertFromAccount]);
  const filteredPeriodLabel = `${format(dateRange.start, "dd/MM/yyyy")} – ${format(dateRange.end, "dd/MM/yyyy")}`;

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDirectionFilter("all");
    setTagFilter("all");
    setRecurringFilter("all");
    setDateRange({ start: subMonths(startOfMonth(new Date()), 2), end: endOfMonth(new Date()) });
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(search) || categoryFilter !== "all" || directionFilter !== "all" || tagFilter !== "all" || recurringFilter !== "all";
  const invalidDateRange = dateRange.start > dateRange.end;

  const isAllSelected = paginatedTransactions.length > 0 && 
    paginatedTransactions.every((t) => selectedIds.has(t.id!));

  const tableColumns = [
    {
      key: "select",
      label: showCheckboxes ? (
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={handleSelectAll}
          aria-label="Sélectionner toutes les transactions de la page"
        />
      ) : (
        ""
      ),
      className: "w-10",
    },
    { key: "merchant", label: "Marchand", className: "min-w-[220px]" },
    { key: "date", label: "Date", className: "text-right w-24", align: "right" as const },
    { key: "amount", label: "Montant", className: "text-right w-28", align: "right" as const },
    { key: "actions", label: "", className: "text-right w-24" },
  ];

  const renderRow = (tx: Transaction) => {
    const categoryData = CATEGORIES[tx.category];
    const IconComponent = categoryData?.icon;

    return [
      <div key="select" onClick={(event) => event.stopPropagation()}>
        {showCheckboxes ? (
          <Checkbox
            checked={selectedIds.has(tx.id!)}
            onCheckedChange={(checked) => handleSelect(tx.id!, !!checked)}
            aria-label={`Sélectionner ${tx.merchant}`}
          />
        ) : null}
      </div>,
      <div key="merchant" className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50"
        >
          {IconComponent && (
            <IconComponent className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{tx.merchant}</span>
            {tx.isRecurring && <Repeat className="h-3 w-3 text-muted-foreground" />}
            {tx.isExcluded && <EyeOff className="h-3 w-3 text-muted-foreground" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CategoryBadge
              category={tx.category}
              subcategory={tx.subcategory}
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                void handleEdit(tx);
              }}
            />
            {tx.id && (
              <TransactionTypeBadge transactionId={tx.id} category={tx.category} />
            )}
            {tx.tags && tx.tags.length > 0 && (
              <div className="flex gap-1">
                {tx.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
                {tx.tags.length > 2 && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    +{tx.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>,
      <div key="date" className="text-right text-sm text-muted-foreground">
        {format(new Date(tx.date), "MMM d")}
      </div>,
      <div
        key="amount"
        className="text-right font-semibold tabular-nums"
      >
        {tx.direction === "credit" ? "+" : "-"}
        <Money
          amount={Math.abs(tx.amount)}
          currency={getAccountCurrency(tx.accountId)}
          minimumFractionDigits={2}
          maximumFractionDigits={2}
        />
      </div>,
      <div
        key="actions"
        className="flex items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        {tx.id && (
          <TransactionTypeButton
            transactionId={tx.id}
            category={tx.category}
            size="sm"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleToggleExcluded(tx)}
          title={tx.isExcluded ? "Réintégrer aux budgets et analyses" : "Exclure des budgets et analyses"}
          aria-label={tx.isExcluded ? `Réintégrer ${tx.merchant}` : `Exclure ${tx.merchant}`}
        >
          {tx.isExcluded ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleEdit(tx)}
          aria-label={`Modifier ${tx.merchant}`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Plus d’actions pour ${tx.merchant}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(tx)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Modifier
            </DropdownMenuItem>
            {tx.id && (
              <DropdownMenuItem onClick={() => handleCreateRecurring(tx)}>
                <Repeat className="mr-2 h-4 w-4" />
                Créer une récurrence
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleToggleExcluded(tx)}>
              {tx.isExcluded ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Réintégrer aux budgets et analyses
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Exclure des budgets et analyses
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenus reconnus</p>
              <p className="text-2xl font-semibold tabular-nums">
                +<Money amount={totals.income} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Période filtrée : {filteredPeriodLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dépenses réelles</p>
              <p className="text-2xl font-semibold tabular-nums">
                -<Money amount={totals.expenses} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Période filtrée : {filteredPeriodLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flux net</p>
              <p className="text-2xl font-semibold tabular-nums">
                {totals.net >= 0 ? "+" : "-"}
                <Money amount={Math.abs(totals.net)} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{totals.net >= 0 ? "Excédent" : "Déficit"} sur la période filtrée</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          placeholder="Rechercher une transaction…"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCheckboxes(!showCheckboxes)}
              >
                <SquareStack className="mr-2 h-4 w-4" />
                {showCheckboxes ? "Annuler la sélection" : "Sélectionner"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={filteredTransactions.length === 0}
                title={filteredTransactions.length === 0 ? "Aucune transaction à exporter" : "Exporter les transactions filtrées"}
              >
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Réinitialiser</Button>}
            </>
          }
        >
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.keys(CATEGORIES).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={directionFilter}
            onValueChange={(v) => {
              setDirectionFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="credit">Revenu</SelectItem>
              <SelectItem value="debit">Dépense</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={recurringFilter}
            onValueChange={(v) => {
              setRecurringFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Fréquence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="recurring">
                <div className="flex items-center gap-2">
                  <Repeat className="h-3 w-3" />
                  Récurrente
                </div>
              </SelectItem>
              <SelectItem value="one-time">Ponctuelle</SelectItem>
            </SelectContent>
          </Select>

          {allTags.length > 0 && (
            <Select
              value={tagFilter}
              onValueChange={(v) => {
                setTagFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les libellés</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    <div className="flex items-center gap-2">
                      <Tags className="h-3 w-3" />
                      {tag}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Date de début"
              className="w-[140px]"
              value={format(dateRange.start, "yyyy-MM-dd")}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : subMonths(startOfMonth(new Date()), 2);
                setDateRange(prev => ({ ...prev, start: date }));
              }}
            />
            <span aria-hidden="true" className="text-muted-foreground">–</span>
            <Input
              type="date"
              aria-label="Date de fin"
              className="w-[140px]"
              value={format(dateRange.end, "yyyy-MM-dd")}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : endOfMonth(new Date());
                setDateRange(prev => ({ ...prev, end: date }));
              }}
            />
          </div>
          {invalidDateRange && <p role="alert" className="w-full text-sm text-destructive">La date de fin doit être postérieure à la date de début.</p>}
        </FilterBar>

        {/* Transactions List */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Toutes les transactions</h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
                {selectedIds.size > 0 && ` · ${selectedIds.size} sélectionnée${selectedIds.size > 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("date")}
                className={cn(sortField === "date" && "bg-muted")}
              >
                Date {getSortIcon("date")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSort("amount")}
                className={cn(sortField === "amount" && "bg-muted")}
              >
                Montant {getSortIcon("amount")}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <TransactionsSkeleton />
          ) : (
            paginatedTransactions.length === 0 ? (
              <EmptyState
                title="Aucune transaction trouvée"
                description={hasActiveFilters ? "Modifiez les filtres ou réinitialisez-les." : "Importez un relevé bancaire pour commencer à suivre les opérations du foyer."}
                icon={<Filter className="h-6 w-6 text-primary" />}
                primaryAction={hasActiveFilters ? { label: "Réinitialiser les filtres", onClick: resetFilters } : { label: "Importer un relevé", onClick: () => { window.location.href = "/import"; } }}
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        {tableColumns.map((column) => <th key={column.key} scope="col" aria-sort={column.key === sortField ? (sortDirection === "asc" ? "ascending" : "descending") : undefined} className={cn("px-4 py-3", column.className)}>{column.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTransactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={cn("border-b last:border-0 hover:bg-muted/40", selectedIds.has(tx.id!) && "bg-primary/10", tx.isExcluded && "opacity-60")}
                          onDoubleClick={() => handleEdit(tx)}
                        >
                          {renderRow(tx).map((cell, index) => <td key={tableColumns[index].key} className="px-4 py-3">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3 md:hidden" aria-label="Transactions">
                  {paginatedTransactions.map((tx) => (
                    <li key={tx.id} className={cn("rounded-xl border bg-card p-4", tx.isExcluded && "opacity-60")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{tx.merchant}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{format(new Date(tx.date), "d MMM yyyy")} · {tx.category}</p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums">{tx.direction === "credit" ? "+" : "−"}<Money amount={Math.abs(tx.amount)} currency={getAccountCurrency(tx.accountId)} /></p>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleToggleExcluded(tx)}>{tx.isExcluded ? "Réintégrer" : "Exclure"}</Button>
                        <Button size="sm" onClick={() => handleEdit(tx)}>Modifier</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Affichage de {(currentPage - 1) * itemsPerPage + 1} à{" "}
                {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} sur{" "}
                {filteredTransactions.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        className="w-9"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TransactionEditDialog
        transaction={editingTransaction}
        open={editingTransaction !== null}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        similarCount={similarCount}
      />

      <AddEditRecurringDialog
        open={recurringDialogOpen}
        onOpenChange={(open) => {
          setRecurringDialogOpen(open);
          if (!open) setRecurringFromTransaction(null);
        }}
        recurring={null}
        onSave={handleSaveRecurring}
        onLinkToExisting={handleLinkToExisting}
        defaultType={recurringFromTransaction?.direction === 'credit' ? 'income' : 'subscription'}
        initialValues={recurringFromTransaction ? {
          name: recurringFromTransaction.merchant,
          merchant: recurringFromTransaction.merchantOriginal || recurringFromTransaction.merchant,
          amount: recurringFromTransaction.amount,
          category: recurringFromTransaction.category,
          subcategory: recurringFromTransaction.subcategory,
          startDate: recurringFromTransaction.date,
          transactionId: recurringFromTransaction.id,
        } : undefined}
        sourceTransaction={recurringFromTransaction}
      />

      <BatchActionBar
        selectedCount={selectedIds.size}
        onCategorize={() => setBulkDialogOpen(true)}
        onTag={() => setBulkDialogOpen(true)}
        onDelete={handleBatchDelete}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <BulkWorkbench
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedIds={Array.from(selectedIds)}
        onComplete={() => setSelectedIds(new Set())}
      />
    </AppLayout>
  );
}
