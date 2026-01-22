"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  Search,
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
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionRow, BatchActionBar } from "@/components/transactions/transaction-row";
import { TransactionEditDialog } from "@/components/transactions/transaction-edit-dialog";
import { BulkWorkbench } from "@/components/transactions/bulk-workbench";
import { AddEditRecurringDialog } from "@/components/subscriptions";
import { useTransactions, useMerchantRules } from "@/hooks/use-data";
import { CATEGORIES, db, type Transaction, type RecurringTransaction, type RecurringType } from "@/lib/db";
import { linkTransactionToRecurring } from "@/lib/csv-parser";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { useAccount } from "@/contexts/account-context";
import { getPrimaryAccount } from "@/lib/accounts";
import { useSearchParams } from "next/navigation";

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
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading transactions...</div>
      </div>
    </AppLayout>
  );
}

function TransactionsPageContent() {
  const { convertFromAccount } = useMoney();
  // Account context
  const { selectedAccountId } = useAccount();
  const searchParams = useSearchParams();
  const seededSearch = useRef(false);
  
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

  // Date range
  const now = new Date();
  const [dateRange, setDateRange] = useState({
    start: subMonths(startOfMonth(now), 2),
    end: endOfMonth(now),
  });

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
    await updateTransaction(transaction.id, { isExcluded: !transaction.isExcluded });
  }, [updateTransaction]);

  const handleSaveRecurring = async (data: Partial<RecurringTransaction>) => {
    const now = new Date().toISOString();
    const account = await getPrimaryAccount();

    await db.recurringTransactions.add({
      ...data,
      accountId: account?.id || 1,
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

    await updateTransaction(transaction.id, {
      category: transaction.category,
      subcategory: transaction.subcategory,
      merchant: transaction.merchant,
      notes: transaction.notes,
      tags: transaction.tags,
      isRecurring: transaction.isRecurring,
      isExcluded: transaction.isExcluded,
    });

    if (applyToSimilar) {
      const similar = await findSimilarTransactions(transaction.merchantOriginal || transaction.merchant);
      const otherIds = similar.filter(t => t.id !== transaction.id).map(t => t.id!);
      
      if (otherIds.length > 0) {
        await updateTransactions(otherIds, {
          category: transaction.category,
          subcategory: transaction.subcategory,
          merchant: transaction.merchant,
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

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(paginatedTransactions.map((t) => t.id!)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBatchDelete = async () => {
    if (confirm(`Delete ${selectedIds.size} transactions?`)) {
      await deleteTransactions(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
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
    const income = filteredTransactions
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + convertFromAccount(t.amount, t.accountId), 0);
    const expenses = Math.abs(
      filteredTransactions
        .filter((t) => t.direction === "debit")
        .reduce((sum, t) => sum + convertFromAccount(t.amount, t.accountId), 0)
    );
    return { income, expenses, net: income - expenses };
  }, [filteredTransactions, convertFromAccount]);

  const isAllSelected = paginatedTransactions.length > 0 && 
    paginatedTransactions.every((t) => selectedIds.has(t.id!));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage all your transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCheckboxes(!showCheckboxes)}
            >
              <SquareStack className="h-4 w-4 mr-2" />
              {showCheckboxes ? "Done" : "Select"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600">
                +<Money amount={totals.income} />
              </p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                -<Money amount={totals.expenses} />
              </p>
            </CardContent>
          </Card>
          <Card className={cn(
            totals.net >= 0 ? "bg-blue-500/5 border-blue-500/20" : "bg-amber-500/5 border-amber-500/20"
          )}>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Net Flow</p>
              <p className={cn(
                "text-2xl font-bold",
                totals.net >= 0 ? "text-blue-600" : "text-amber-600"
              )}>
                {totals.net >= 0 ? "+" : "-"}
                <Money amount={Math.abs(totals.net)} />
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
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
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Income</SelectItem>
                  <SelectItem value="debit">Expense</SelectItem>
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
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="recurring">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3 w-3" />
                      Recurring
                    </div>
                  </SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
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
                    <SelectItem value="all">All Tags</SelectItem>
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
                  className="w-auto"
                  value={format(dateRange.start, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : subMonths(startOfMonth(new Date()), 2);
                    setDateRange(prev => ({ ...prev, start: date }));
                  }}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  className="w-auto"
                  value={format(dateRange.end, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : endOfMonth(new Date());
                    setDateRange(prev => ({ ...prev, end: date }));
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""} found
                  {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
                </CardDescription>
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
                  Amount {getSortIcon("amount")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="space-y-3 px-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </div>
            ) : (
              <>
                {showCheckboxes && (
                  <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-3">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      Select all on this page
                    </span>
                  </div>
                )}

                <div className="divide-y">
                  {paginatedTransactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      onEdit={handleEdit}
                      onSelect={handleSelect}
                      onCreateRecurring={handleCreateRecurring}
                      onToggleExcluded={handleToggleExcluded}
                      isSelected={selectedIds.has(tx.id!)}
                      showCheckbox={showCheckboxes}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 px-6 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of{" "}
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
                        Previous
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
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
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
