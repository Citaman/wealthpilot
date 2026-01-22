"use client";

import { useMemo } from "react";
import { format, subMonths } from "date-fns";
import { AlertCircle, ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { detectAnomalies } from "@/lib/analytics";
import type { Transaction } from "@/lib/db";
import Link from "next/link";

interface AnomalyDetectionProps {
  transactions: Transaction[];
  className?: string;
}

export function AnomalyDetection({ transactions, className }: AnomalyDetectionProps) {
  const anomalies = useMemo(() => {
    if (transactions.length < 10) return [];

    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const currentMonthTx = transactions.filter((t) => t.date.startsWith(thisMonth));
    const historyTx = transactions.filter((t) => !t.date.startsWith(thisMonth));

    return detectAnomalies(currentMonthTx, historyTx);
  }, [transactions]);

  if (anomalies.length === 0) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">Needs Attention</CardTitle>
              <CardDescription>Detected unusual spending patterns</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900">
            {anomalies.length} {anomalies.length === 1 ? "anomaly" : "anomalies"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalies.map((anomaly, idx) => (
          <div
            key={`${anomaly.transaction.id}-${idx}`}
            className="flex items-center justify-between p-3 rounded-xl border bg-amber-50/30 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{anomaly.transaction.merchant}</p>
              <p className="text-xs text-muted-foreground">{anomaly.reason}</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="font-bold text-sm text-amber-600">
                <PrivacyBlur>{formatCurrency(Math.abs(anomaly.transaction.amount))}</PrivacyBlur>
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] font-medium text-amber-600">
                <TrendingUp className="h-3 w-3" />
                {Math.round(anomaly.deviation * 100)}% spike
              </div>
            </div>
          </div>
        ))}
        
        <Button variant="ghost" size="sm" className="w-full text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-900/20" asChild>
          <Link href="/transactions">
            Review all transactions
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
