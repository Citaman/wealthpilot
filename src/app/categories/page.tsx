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
import { CATEGORIES, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

interface CategoryStats {
  category: string;
  subcategories: { name: string; amount: number; count: number }[];
  totalAmount: number;
  transactionCount: number;
  isExpanded: boolean;
}

export default function CategoriesPage() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", parentCategory: "" });

  // Date range - last 12 months
  const now = new Date();
  const dateRange = {
    start: subMonths(startOfMonth(now), 11),
    end: endOfMonth(now),
  };

  const { transactions, isLoading } = useTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
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

    // Aggregate transaction data
    transactions.forEach((tx) => {
      const stat = stats.get(tx.category);
      if (stat) {
        stat.totalAmount += tx.amount;
        stat.transactionCount += 1;

        const subcat = stat.subcategories.find((s) => s.name === tx.subcategory);
        if (subcat) {
          subcat.amount += tx.amount;
          subcat.count += 1;
        }
      }
    });

    return Array.from(stats.values()).sort((a, b) => {
      // Sort by absolute amount (expenses and income mixed)
      return Math.abs(b.totalAmount) - Math.abs(a.totalAmount);
    });
  }, [transactions, expandedCategories]);

  // Totals
  const totals = useMemo(() => {
    const income = transactions
      .filter((t) => t.direction === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = Math.abs(
      transactions
        .filter((t) => t.direction === "debit")
        .reduce((sum, t) => sum + t.amount, 0)
    );
    return { income, expenses };
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const toggleExpanded = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getPercentage = (amount: number, isIncome: boolean) => {
    const total = isIncome ? totals.income : totals.expenses;
    if (total === 0) return 0;
    return Math.round((Math.abs(amount) / total) * 100);
  };

  const getCategoryIcon = (category: string) => {
    const catData = CATEGORIES[category];
    return catData?.icon || HelpCircle;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">
              Manage your spending categories and view breakdown
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Total Income (12 months)</p>
              <p className="text-2xl font-bold text-emerald-600">
                +{formatCurrency(totals.income)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across all income categories
              </p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">Total Expenses (12 months)</p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(totals.expenses)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across all expense categories
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Category List */}
        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
            <CardDescription>
              Click on a category to see subcategory breakdown
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
                const percentage = getPercentage(stat.totalAmount, isIncome);
                const isExpanded = expandedCategories.has(stat.category);
                const hasTransactions = stat.transactionCount > 0;

                return (
                  <div key={stat.category}>
                    {/* Main category row */}
                    <div
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg transition-colors",
                        hasTransactions ? "hover:bg-muted/50 cursor-pointer" : "opacity-60"
                      )}
                      onClick={() => hasTransactions && toggleExpanded(stat.category)}
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
                          className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg",
                            isIncome
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stat.category}</span>
                            <Badge variant="secondary" className="text-xs">
                              {stat.transactionCount} txn
                            </Badge>
                          </div>
                          {hasTransactions && (
                            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isIncome ? "bg-emerald-500" : "bg-primary"
                                )}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={cn(
                            "font-semibold",
                            isIncome ? "text-emerald-600" : "text-foreground"
                          )}
                        >
                          {isIncome ? "+" : "-"}{formatCurrency(stat.totalAmount)}
                        </p>
                        {hasTransactions && (
                          <p className="text-xs text-muted-foreground">
                            {percentage}% of {isIncome ? "income" : "expenses"}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(stat.category);
                            setNewCategoryName(stat.category);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            disabled={stat.transactionCount > 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
                              className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{sub.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {sub.count}
                                </Badge>
                              </div>
                              <span
                                className={cn(
                                  "text-sm font-medium",
                                  isIncome ? "text-emerald-600" : ""
                                )}
                              >
                                {isIncome ? "+" : "-"}{formatCurrency(sub.amount)}
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
        {categoryStats.find((s) => s.category === "Uncategorized")?.transactionCount! > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10">
                <HelpCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-700">
                  {categoryStats.find((s) => s.category === "Uncategorized")?.transactionCount} uncategorized transactions
                </p>
                <p className="text-sm text-muted-foreground">
                  Review and categorize these transactions for accurate reporting
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/transactions?category=Uncategorized">Review</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Category</DialogTitle>
            <DialogDescription>
              Create a new category or subcategory for your transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                placeholder="e.g., Subscriptions"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent Category (optional)</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={newCategory.parentCategory}
                onChange={(e) => setNewCategory({ ...newCategory, parentCategory: e.target.value })}
              >
                <option value="">None (create main category)</option>
                {Object.keys(CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Leave empty to create a new main category
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement adding custom category
                setShowAddDialog(false);
                setNewCategory({ name: "", parentCategory: "" });
              }}
              disabled={!newCategory.name}
            >
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Rename this category. All transactions will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement category rename
                setEditingCategory(null);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
