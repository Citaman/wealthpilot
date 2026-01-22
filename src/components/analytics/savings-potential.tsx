"use client";

import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { PiggyBank, Lightbulb, TrendingDown, Coffee, Utensils, ShoppingBag, Clapperboard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";

interface SavingsPotentialProps {
  transactions: Transaction[];
  className?: string;
}

interface SavingOpportunity {
  id: string;
  title: string;
  description: string;
  potentialSavings: number;
  currentSpending: number;
  suggestedSpending: number;
  icon: React.ReactNode;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export function SavingsPotential({ transactions, className }: SavingsPotentialProps) {
  const opportunities = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    
    // Filter to expenses
    const thisMonthExpenses = transactions.filter(
      (t) => t.direction === "debit" && t.date.startsWith(thisMonth)
    );
    const lastMonthExpenses = transactions.filter(
      (t) => t.direction === "debit" && t.date.startsWith(lastMonth)
    );

    // Calculate category totals for this month
    const categorySpending = new Map<string, number>();
    thisMonthExpenses.forEach((tx) => {
      categorySpending.set(
        tx.category,
        (categorySpending.get(tx.category) || 0) + Math.abs(tx.amount)
      );
    });

    // Calculate total monthly income
    const monthlyIncome = transactions
      .filter((t) => t.direction === "credit" && t.date.startsWith(thisMonth))
      .reduce((s, t) => s + t.amount, 0);

    const suggestions: SavingOpportunity[] = [];

    // 1. Dining out / Restaurants
    const diningCategories = ["Restaurants", "Food & Dining", "Fast Food"];
    const diningSpending = diningCategories.reduce(
      (sum, cat) => sum + (categorySpending.get(cat) || 0),
      0
    );
    if (diningSpending > 100) {
      const recommended = diningSpending * 0.7; // Suggest 30% reduction
      suggestions.push({
        id: "dining",
        title: "Reduce dining out",
        description: "Cook at home more often. Meal prep on weekends can save time and money.",
        potentialSavings: diningSpending - recommended,
        currentSpending: diningSpending,
        suggestedSpending: recommended,
        icon: <Utensils className="h-4 w-4" />,
        category: "Dining",
        difficulty: "medium",
      });
    }

    // 2. Coffee shops
    const coffeeKeywords = ["coffee", "starbucks", "café", "cafe", "costa"];
    const coffeeTxs = thisMonthExpenses.filter((tx) =>
      coffeeKeywords.some((k) => tx.merchant?.toLowerCase().includes(k))
    );
    const coffeeSpending = coffeeTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    if (coffeeSpending > 30) {
      suggestions.push({
        id: "coffee",
        title: "Cut coffee shop visits",
        description: `You visited coffee shops ${coffeeTxs.length} times. Making coffee at home could save you significantly.`,
        potentialSavings: coffeeSpending * 0.8, // Can save 80%
        currentSpending: coffeeSpending,
        suggestedSpending: coffeeSpending * 0.2,
        icon: <Coffee className="h-4 w-4" />,
        category: "Coffee",
        difficulty: "easy",
      });
    }

    // 3. Shopping
    const shoppingCategories = ["Shopping", "Clothing", "Electronics"];
    const shoppingSpending = shoppingCategories.reduce(
      (sum, cat) => sum + (categorySpending.get(cat) || 0),
      0
    );
    if (monthlyIncome > 0 && shoppingSpending > monthlyIncome * 0.15) {
      const recommended = monthlyIncome * 0.1;
      suggestions.push({
        id: "shopping",
        title: "Review discretionary shopping",
        description: "Shopping is over 15% of your income. Try a 30-day wait rule before big purchases.",
        potentialSavings: shoppingSpending - recommended,
        currentSpending: shoppingSpending,
        suggestedSpending: recommended,
        icon: <ShoppingBag className="h-4 w-4" />,
        category: "Shopping",
        difficulty: "hard",
      });
    }

    // 4. Entertainment / Subscriptions
    const entertainmentCategories = ["Entertainment", "Streaming", "Subscriptions"];
    const entertainmentSpending = entertainmentCategories.reduce(
      (sum, cat) => sum + (categorySpending.get(cat) || 0),
      0
    );
    if (entertainmentSpending > 50) {
      suggestions.push({
        id: "entertainment",
        title: "Audit entertainment subscriptions",
        description: "Review streaming services and subscriptions. Cancel ones you rarely use.",
        potentialSavings: entertainmentSpending * 0.3,
        currentSpending: entertainmentSpending,
        suggestedSpending: entertainmentSpending * 0.7,
        icon: <Clapperboard className="h-4 w-4" />,
        category: "Entertainment",
        difficulty: "easy",
      });
    }

    // 5. General overspending categories
    categorySpending.forEach((amount, category) => {
      if (
        !diningCategories.includes(category) &&
        !shoppingCategories.includes(category) &&
        !entertainmentCategories.includes(category) &&
        amount > 200
      ) {
        const lastMonthAmount = lastMonthExpenses
          .filter((t) => t.category === category)
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        
        if (amount > lastMonthAmount * 1.3 && lastMonthAmount > 50) {
          suggestions.push({
            id: `cat-${category}`,
            title: `${category} spending up`,
            description: `Spending increased ${((amount - lastMonthAmount) / lastMonthAmount * 100).toFixed(0)}% vs last month. Review recent purchases.`,
            potentialSavings: amount - lastMonthAmount,
            currentSpending: amount,
            suggestedSpending: lastMonthAmount,
            icon: <TrendingDown className="h-4 w-4" />,
            category,
            difficulty: "medium",
          });
        }
      }
    });

    // Sort by potential savings
    suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);

    return suggestions.slice(0, 5);
  }, [transactions]);

  const totalPotentialSavings = opportunities.reduce((s, o) => s + o.potentialSavings, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const difficultyColors = {
    easy: "text-emerald-500 bg-emerald-500/10",
    medium: "text-amber-500 bg-amber-500/10",
    hard: "text-red-500 bg-red-500/10",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Savings Potential
            </CardTitle>
            <CardDescription>Areas where you could save money</CardDescription>
          </div>
          {totalPotentialSavings > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Potential monthly savings</p>
              <p className="text-lg font-bold text-emerald-500">
                <PrivacyBlur>{formatCurrency(totalPotentialSavings)}</PrivacyBlur>
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Lightbulb className="h-8 w-8 mb-2 opacity-50" />
            <p>Great job! No obvious savings found</p>
            <p className="text-sm">Keep up the good work</p>
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    {opportunity.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm">{opportunity.title}</h4>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full capitalize",
                        difficultyColors[opportunity.difficulty]
                      )}>
                        {opportunity.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {opportunity.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Current: </span>
                        <span className="font-medium">
                          <PrivacyBlur>{formatCurrency(opportunity.currentSpending)}</PrivacyBlur>
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Target: </span>
                        <span className="font-medium text-emerald-500">
                          <PrivacyBlur>{formatCurrency(opportunity.suggestedSpending)}</PrivacyBlur>
                        </span>
                      </div>
                      <div className="ml-auto">
                        <span className="font-semibold text-emerald-500">
                          Save <PrivacyBlur>{formatCurrency(opportunity.potentialSavings)}</PrivacyBlur>
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={(opportunity.suggestedSpending / opportunity.currentSpending) * 100}
                      className="h-1 mt-2"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
