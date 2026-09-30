"use client";

import { useState, useMemo } from "react";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  PlusCircle,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MoreHorizontal,
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTransactions } from "@/hooks/use-data";
import { CATEGORIES, db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { useAccount } from "@/contexts/account-context";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from "dexie-react-hooks";
import { calculateFinancialMetrics, classifyFinancialTransaction } from "@/lib/financial-metrics";

interface CategoryStats {
  category: string;
  subcategories: { name: string; amount: number; count: number }[];
  totalAmount: number;
  transactionCount: number;
  isExpanded: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  Income: "Revenus",
  Housing: "Logement",
  Food: "Alimentation",
  Transport: "Transport",
  Shopping: "Achats",
  Bills: "Factures",
  Health: "Santé",
  Entertainment: "Loisirs",
  Family: "Famille",
  Services: "Services",
  Transfers: "Transferts",
  Taxes: "Impôts",
  Uncategorized: "À catégoriser",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

export default function CategoriesPage() {
  const { selectedAccountId } = useAccount();
  const { convertFromAccount } = useMoney();
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", parentCategory: "" });
  const liveCustomCategories = useLiveQuery(() => db.customCategories.toArray(), []);
  const customCategories = useMemo(() => liveCustomCategories ?? [], [liveCustomCategories]);
  const customCategoryNames = useMemo(
    () => new Set(
      customCategories
        .filter((category) => !category.isSystem && !(category.name in CATEGORIES))
        .map((category) => category.name)
    ),
    [customCategories]
  );

  // Date range - last 12 months
  const now = new Date();
  const dateRange = {
    start: subMonths(startOfMonth(now), 11),
    end: endOfMonth(now),
  };

  const { transactions, isLoading } = useTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: selectedAccountId,
  });

  // Calculate category stats
  const categoryStats = useMemo(() => {
    const stats: Map<string, CategoryStats> = new Map();

    // Initialize all categories
    Object.entries(CATEGORIES).forEach(([cat, catData]) => {
      stats.set(cat, {
        category: cat,
        subcategories: catData.subcategories.map((sub) => ({ name: sub, amount: 0, count: 0 })),
        totalAmount: 0,
        transactionCount: 0,
        isExpanded: expandedCategories.has(cat),
      });
    });

    customCategories.forEach((customCategory) => {
      const existing = stats.get(customCategory.name);
      if (existing) {
        for (const subcategory of customCategory.subcategories) {
          if (!existing.subcategories.some((item) => item.name === subcategory)) {
            existing.subcategories.push({ name: subcategory, amount: 0, count: 0 });
          }
        }
        return;
      }

      stats.set(customCategory.name, {
        category: customCategory.name,
        subcategories: customCategory.subcategories.map((name) => ({ name, amount: 0, count: 0 })),
        totalAmount: 0,
        transactionCount: 0,
        isExpanded: expandedCategories.has(customCategory.name),
      });
    });

    // Aggregate transaction data
    transactions.forEach((tx) => {
      const kind = classifyFinancialTransaction(tx);
      if (kind === "excluded" || kind === "unrecognized-credit") return;
      const stat = stats.get(tx.category);
      if (stat) {
        const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
        const baseAmount = kind === "refund" ? -amount : amount;
        stat.totalAmount += baseAmount;
        stat.transactionCount += 1;

        const subcat = stat.subcategories.find((s) => s.name === tx.subcategory);
        if (subcat) {
          subcat.amount += baseAmount;
          subcat.count += 1;
        }
      }
    });

    return Array.from(stats.values()).sort((a, b) => {
      // Sort by absolute amount (expenses and income mixed)
      return Math.abs(b.totalAmount) - Math.abs(a.totalAmount);
    });
  }, [transactions, expandedCategories, convertFromAccount, customCategories]);

  const deleteCustomCategory = async (category: string) => {
    if (!customCategoryNames.has(category)) return;
    try {
      await db.transaction("rw", db.customCategories, db.budgets, async () => {
        await db.customCategories.where("name").equals(category).delete();
        await db.budgets.where("category").equals(category).delete();
      });
      toast({ title: "Catégorie supprimée", description: `« ${category} » a été supprimée.` });
      setDeleteCategoryConfirm(null);
    } catch {
      toast({ variant: "destructive", title: "Impossible de supprimer la catégorie" });
    }
  };

  // Totals
  const totals = useMemo(() => {
    const metrics = calculateFinancialMetrics(transactions, convertFromAccount);
    const transfers = transactions
      .filter((t) => classifyFinancialTransaction(t) === "transfer" && t.direction === "debit")
      .reduce((sum, t) => sum + Math.abs(convertFromAccount(t.amount, t.accountId)), 0);
    return { income: metrics.income, expenses: metrics.expenses, transfers };
  }, [transactions, convertFromAccount]);

  const uncategorizedCount =
    categoryStats.find((s) => s.category === "Uncategorized")?.transactionCount ?? 0;
  const qualityQueue = useMemo(() => transactions.filter((transaction) =>
    transaction.category === "Uncategorized" ||
    (transaction.category === "Transfers" && transaction.linkedTransferId === undefined) ||
    !transaction.category ||
    !transaction.merchant ||
    transaction.merchant.toLowerCase() === "unknown"
  ), [transactions]);

  const toggleExpanded = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getPercentage = (amount: number, kind: "income" | "expense" | "transfer") => {
    const total = kind === "income" ? totals.income : kind === "transfer" ? totals.transfers : totals.expenses;
    if (total === 0) return 0;
    return Math.round((Math.abs(amount) / total) * 100);
  };

  const getCategoryIcon = (category: string) => {
    const catData = CATEGORIES[category as keyof typeof CATEGORIES];
    return catData?.icon;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Séparez revenus, dépenses et transferts, puis corrigez les éléments à vérifier.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter une catégorie
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenus (12 mois)</p>
              <p className="text-2xl font-semibold">
                +<Money amount={totals.income} minimumFractionDigits={2} maximumFractionDigits={2} />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hors transferts internes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dépenses (12 mois)</p>
              <p className="text-2xl font-semibold">
                -<Money amount={totals.expenses} minimumFractionDigits={2} maximumFractionDigits={2} />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hors transferts internes et opérations exclues
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transferts internes (12 mois)</p>
              <p className="text-2xl font-semibold"><Money amount={totals.transfers} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
              <p className="text-xs text-muted-foreground mt-1">Suivis séparément, jamais comptés comme dépenses</p>
            </CardContent>
          </Card>
        </div>

        <Card className={qualityQueue.length > 0 ? "border-amber-500/40" : undefined}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
            <div className="flex-1"><p className="font-medium">File qualité</p><p className="text-sm text-muted-foreground">{qualityQueue.length} transaction{qualityQueue.length > 1 ? "s" : ""} à vérifier : catégorie ou marchand manquant.</p></div>
            {qualityQueue.length > 0 && <Button variant="outline" asChild><a href="/transactions?category=Uncategorized">Nettoyer maintenant</a></Button>}
          </CardContent>
        </Card>

        {/* Category List */}
        <Card>
          <CardHeader>
            <CardTitle>Toutes les catégories</CardTitle>
            <CardDescription>
              Ouvrez une catégorie pour voir le détail des sous-catégories.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              categoryStats.map((stat) => {
                const Icon = getCategoryIcon(stat.category);
                const isIncome = stat.category === "Income";
                const isTransfer = stat.category === "Transfers";
                const percentage = getPercentage(stat.totalAmount, isTransfer ? "transfer" : isIncome ? "income" : "expense");
                const isExpanded = expandedCategories.has(stat.category);
                const hasTransactions = stat.transactionCount > 0;

                return (
                  <div key={stat.category}>
                    {/* Main category row */}
                    <div
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg transition-colors",
                        hasTransactions ? "hover:bg-muted cursor-pointer" : "opacity-60"
                      )}
                      onClick={() => hasTransactions && toggleExpanded(stat.category)}
                      role={hasTransactions ? "button" : undefined}
                      tabIndex={hasTransactions ? 0 : undefined}
                      aria-expanded={hasTransactions ? isExpanded : undefined}
                      aria-label={hasTransactions ? `${categoryLabel(stat.category)}, ${stat.transactionCount} transactions` : undefined}
                      onKeyDown={(event) => {
                        if (!hasTransactions || event.currentTarget !== event.target) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleExpanded(stat.category);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {hasTransactions ? (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 text-muted-foreground"
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{categoryLabel(stat.category)}</span>
                            <Badge variant="secondary" className="text-xs">
                              {stat.transactionCount} txn
                            </Badge>
                          </div>
                          {hasTransactions && (
                            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all bg-primary"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className="font-semibold"
                        >
                          {isTransfer ? "↔" : isIncome ? "+" : "-"}
                          <Money amount={Math.abs(stat.totalAmount)} minimumFractionDigits={2} maximumFractionDigits={2} />
                        </p>
                        {hasTransactions && (
                          <p className="text-xs text-muted-foreground">
                            {percentage}% des {isTransfer ? "transferts" : isIncome ? "revenus" : "dépenses"}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${categoryLabel(stat.category)}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(stat.category);
                            setNewCategoryName(stat.category);
                          }} disabled={!customCategoryNames.has(stat.category)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {customCategoryNames.has(stat.category) ? "Modifier" : "Catégorie système"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            disabled={stat.transactionCount > 0 || !customCategoryNames.has(stat.category)}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteCategoryConfirm(stat.category);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Subcategories */}
                    {isExpanded && hasTransactions && (
                      <div className="ml-12 pl-4 border-l-2 border-muted space-y-1 pb-2">
                        {stat.subcategories
                          .filter((sub) => sub.count > 0)
                          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                          .map((sub) => (
                            <div
                              key={sub.name}
                              className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{sub.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {sub.count}
                                </Badge>
                              </div>
                              <span
                                className="text-sm font-medium"
                              >
                                {isTransfer ? "↔" : isIncome ? "+" : "-"}
                                <Money amount={Math.abs(sub.amount)} minimumFractionDigits={2} maximumFractionDigits={2} />
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Uncategorized Alert */}
        {uncategorizedCount > 0 && (
          <Card>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {uncategorizedCount} transaction{uncategorizedCount > 1 ? "s" : ""} à catégoriser
                </p>
                <p className="text-sm text-muted-foreground">
                  Vérifiez ces transactions pour fiabiliser les analyses.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/transactions?category=Uncategorized">Vérifier</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une catégorie personnalisée</DialogTitle>
            <DialogDescription>
              Créez une catégorie principale ou une sous-catégorie pour vos transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de la catégorie</label>
              <Input
                placeholder="Ex. Abonnements"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Catégorie parente (facultative)</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={newCategory.parentCategory}
                onChange={(e) => setNewCategory({ ...newCategory, parentCategory: e.target.value })}
              >
                <option value="">Aucune (créer une catégorie principale)</option>
                {categoryStats.map((category) => (
                  <option key={category.category} value={category.category}>{categoryLabel(category.category)}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Laissez vide pour créer une catégorie principale.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                const name = newCategory.name.trim();
                if (!name) return;

                try {
                  const now = new Date().toISOString();
                  if (newCategory.parentCategory) {
                    // Adding a subcategory to an existing parent — store in customCategories
                    const existing = await db.customCategories
                      .where("name")
                      .equals(newCategory.parentCategory)
                      .first();

                    if (existing) {
                      const subs = existing.subcategories.includes(name)
                        ? existing.subcategories
                        : [...existing.subcategories, name];
                      await db.customCategories.update(existing.id!, { subcategories: subs, updatedAt: now });
                    } else {
                      await db.customCategories.add({
                        name: newCategory.parentCategory,
                        icon: "folder",
                        color: "#6b7280",
                        subcategories: [name],
                        isSystem: false,
                        createdAt: now,
                        updatedAt: now,
                      });
                    }
                    toast({ title: "Sous-catégorie ajoutée", description: `« ${name} » a été ajoutée sous ${categoryLabel(newCategory.parentCategory)}.` });
                  } else {
                    // Adding a new top-level category
                    const existing = await db.customCategories.where("name").equals(name).first();
                    if (name in CATEGORIES || existing) {
                      toast({
                        variant: "destructive",
                        title: "Cette catégorie existe déjà",
                        description: `Choisissez un autre nom que « ${name} ».` ,
                      });
                      return;
                    }
                    await db.customCategories.add({
                      name,
                      icon: "folder",
                      color: "#6b7280",
                      subcategories: [],
                      isSystem: false,
                      createdAt: now,
                      updatedAt: now,
                    });
                    toast({ title: "Catégorie créée", description: `« ${name} » est maintenant disponible.` });
                  }
                } catch {
                  toast({ variant: "destructive", title: "Impossible d’ajouter la catégorie" });
                }
                setShowAddDialog(false);
                setNewCategory({ name: "", parentCategory: "" });
              }}
              disabled={!newCategory.name}
            >
              Ajouter la catégorie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
            <DialogDescription>
              Renommez cette catégorie. Les transactions associées seront mises à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de la catégorie</label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                const trimmed = newCategoryName.trim();
                if (!trimmed || !editingCategory || trimmed === editingCategory) {
                  setEditingCategory(null);
                  return;
                }

                try {
                  // Batch-update all transactions with the old category name
                  await db.transaction("rw", db.transactions, db.budgets, db.customCategories, async () => {
                    const txs = await db.transactions
                      .where("category")
                      .equals(editingCategory)
                      .toArray();

                    for (const tx of txs) {
                      await db.transactions.update(tx.id!, { category: trimmed, updatedAt: new Date().toISOString() });
                    }

                    // Update budgets referencing the old category
                    const budgets = await db.budgets
                      .where("category")
                      .equals(editingCategory)
                      .toArray();

                    for (const b of budgets) {
                      await db.budgets.update(b.id!, { category: trimmed, updatedAt: new Date().toISOString() });
                    }

                    const customCategory = await db.customCategories
                      .where("name")
                      .equals(editingCategory)
                      .first();
                    if (customCategory?.id) {
                      await db.customCategories.update(customCategory.id, {
                        name: trimmed,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  });

                  toast({ title: "Catégorie renommée", description: `« ${editingCategory} » → « ${trimmed} »` });
                } catch {
                  toast({ variant: "destructive", title: "Impossible de renommer la catégorie" });
                }
                setEditingCategory(null);
              }}
              disabled={!newCategoryName.trim() || newCategoryName.trim() === editingCategory}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCategoryConfirm} onOpenChange={(open) => !open && setDeleteCategoryConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la catégorie</DialogTitle>
            <DialogDescription>La catégorie « {deleteCategoryConfirm} » sera supprimée. Cette action est disponible uniquement quand aucune transaction ne l’utilise.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteCategoryConfirm && void deleteCustomCategory(deleteCategoryConfirm)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
