"use client";

import { useMemo } from "react";
import { Store, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/db";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

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
    const expenses = transactions.filter((t) => t.direction === "debit");
    
    // Group by merchant
    const merchantMap = new Map<string, { total: number; count: number; amounts: number[] }>();
    
    expenses.forEach((tx) => {
      const merchant = tx.merchant || "Unknown";
      const current = merchantMap.get(merchant) || { total: 0, count: 0, amounts: [] };
      const amount = Math.abs(convertFromAccount(tx.amount, tx.accountId));
      current.total += amount;
      current.count += 1;
      current.amounts.push(amount);
      merchantMap.set(merchant, current);
    });

    // Convert to array and sort
    const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(convertFromAccount(t.amount, t.accountId)), 0);
    
    const merchants: MerchantData[] = Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        avgAmount: data.total / data.count,
        percentage: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0,
        trend: 0, // TODO: calculate trend from previous period
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return { merchants, totalExpenses };
  }, [transactions, limit, convertFromAccount]);

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-3 w-3 text-red-500" />;
    if (trend < -5) return <TrendingDown className="h-3 w-3 text-emerald-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Top Merchants
            </CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total tracked</p>
            <p className="text-sm font-semibold"><Money amount={merchantData.totalExpenses} /></p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {merchantData.merchants.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No expense data available
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
                        {merchant.count} transactions · avg <Money amount={merchant.avgAmount} />
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold"><Money amount={merchant.total} /></p>
                    <p className="text-xs text-muted-foreground">
                      {merchant.percentage.toFixed(1)}%
                    </p>
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
