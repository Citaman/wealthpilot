"use client";

import { useMemo } from "react";
import { Store, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { isRealExpense } from "@/lib/financial-metrics";

interface TopMerchantsProps {
  transactions: Transaction[];
  limit?: number;
  className?: string;
}

interface MerchantData {
  name: string;
  total: number;
  count: number;
  avgAmount: number;
  percentage: number;
  trend: number; // % change from previous period
}

export function TopMerchants({ transactions, limit = 10, className }: TopMerchantsProps) {
  const { convertFromAccount } = useMoney();

  const merchantData = useMemo(() => {
    // Filter to expenses only
    const expenses = transactions.filter(isRealExpense);

    // Split transactions into two halves for trend comparison
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    // Build totals for the first half (prior period)
    const priorTotals = new Map<string, number>();
    firstHalf.forEach((tx) => {
      const merchant = tx.merchant || "Inconnu";
      priorTotals.set(merchant, (priorTotals.get(merchant) || 0) + Math.abs(convertFromAccount(tx.amount, tx.accountId)));
    });

    // Group by merchant (current/second half for main totals, full set for counts)
    const merchantMap = new Map<string, { total: number; count: number; amounts: number[] }>();

    expenses.forEach((tx) => {
      const merchant = tx.merchant || "Inconnu";
      const current = merchantMap.get(merchant) || { total: 0, count: 0, amounts: [] };
      const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
      current.total += amount;
      current.count += 1;
      current.amounts.push(amount);
      merchantMap.set(merchant, current);
    });

    // Recent half totals for trend
    const recentTotals = new Map<string, number>();
    secondHalf.forEach((tx) => {
      const merchant = tx.merchant || "Inconnu";
      recentTotals.set(merchant, (recentTotals.get(merchant) || 0) + Math.abs(convertFromAccount(tx.amount, tx.accountId)));
    });

    // Convert to array and sort
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(convertFromAccount(t.amount, t.accountId)), 0);

    const merchants: MerchantData[] = Array.from(merchantMap.entries())
      .map(([name, data]) => {
        const prior = priorTotals.get(name) || 0;
        const recent = recentTotals.get(name) || 0;
        const trend = prior > 0 ? ((recent - prior) / prior) * 100 : 0;

        return {
          name,
          total: data.total,
          count: data.count,
          avgAmount: data.total / data.count,
          percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
          trend,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return { merchants, totalExpenses };
  }, [transactions, limit, convertFromAccount]);

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-3 w-3 text-foreground" />;
    if (trend < -5) return <TrendingDown className="h-3 w-3 text-foreground" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Principaux marchands
            </CardTitle>
            <CardDescription>Les marchands qui concentrent vos dépenses</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total analysé</p>
            <p className="text-sm font-semibold"><Money amount={merchantData.totalExpenses} /></p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {merchantData.merchants.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            Aucune dépense disponible
          </div>
        ) : (
          <div className="space-y-4">
            {merchantData.merchants.map((merchant, index) => (
              <div key={merchant.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium truncate max-w-[180px]" title={merchant.name}>
                        {merchant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {merchant.count} transaction(s) · moyenne <Money amount={merchant.avgAmount} />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {merchant.trend !== 0 && getTrendIcon(merchant.trend)}
                    <div className="text-right">
                      <p className="font-semibold"><Money amount={merchant.total} /></p>
                      <p className="text-xs text-muted-foreground">
                        {merchant.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
                <Progress 
                  value={merchant.percentage} 
                  className="h-1.5"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
