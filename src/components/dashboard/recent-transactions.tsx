"use client";

import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CATEGORIES, type Transaction } from "@/lib/db";
import Link from "next/link";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface RecentTransactionsProps {
  transactions: Transaction[];
  limit?: number;
  showViewAll?: boolean;
}

export function RecentTransactions({
  transactions,
  limit = 5,
  showViewAll = true,
}: RecentTransactionsProps) {
  const { getAccountCurrency } = useMoney();
  const displayTransactions = transactions.slice(0, limit);

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES[category as keyof typeof CATEGORIES];
    if (cat?.icon) {
      const IconComponent = cat.icon;
      return <IconComponent className="h-4 w-4 text-muted-foreground" />;
    }
    return null;
  };

  // Format time relative to now for today's transactions
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    }
    return format(date, "d MMM, HH:mm", { locale: fr });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-medium">Transactions récentes</CardTitle>
        {showViewAll && (
          <Link href="/transactions" className="text-xs text-primary hover:underline">
            Tout voir &rarr;
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0 px-6 pb-6">
        {displayTransactions.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            Aucune transaction. Importez un relevé pour commencer.
          </div>
        ) : (
          <div>
            {displayTransactions.map((tx) => {
              const isCredit = tx.direction === "credit";

              return (
                <Link
                  key={tx.id}
                  href={tx.id ? `/transactions?editId=${tx.id}` : "/transactions"}
                  className="flex items-center gap-3 py-3 hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
                >
                  {/* Icon */}
                  <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                    {getCategoryIcon(tx.category)}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.merchant || tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.category} &middot; {formatTime(tx.date)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {isCredit ? "+" : "-"}
                      <Money
                        amount={Math.abs(tx.amount)}
                        currency={getAccountCurrency(tx.accountId)}
                        minimumFractionDigits={2}
                        maximumFractionDigits={2}
                      />
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
