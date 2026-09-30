"use client";

import Link from "next/link";
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { buildRecurringTimeline } from "@/lib/recurring";
import { useMoney } from "@/hooks/use-money";

interface UpcomingBillsProps { className?: string; accountId?: number | "all"; }

export function UpcomingBills({ className, accountId = "all" }: UpcomingBillsProps) {
  const { convertFromAccount } = useMoney();
  const today = new Date();
  const rangeEnd = addDays(today, 7);
  const queryStart = format(subDays(today, 5), "yyyy-MM-dd");
  const queryEnd = format(rangeEnd, "yyyy-MM-dd");
  const recurring = useLiveQuery(() => db.recurringTransactions.toArray().then((items) => accountId === "all" ? items : items.filter((item) => item.accountId === accountId)), [accountId]);
  const transactions = useLiveQuery(() => db.transactions.where("date").between(queryStart, queryEnd, true, true).toArray().then((items) => accountId === "all" ? items : items.filter((item) => item.accountId === accountId)), [queryStart, queryEnd, accountId]);

  const events = recurring && transactions
    ? buildRecurringTimeline({ recurring, transactions, rangeStart: today, rangeEnd, today })
      .filter((event) => event.direction === "expense" && event.status === "upcoming")
      .slice(0, 5)
    : null;

  if (!events) return <Card className={cn("p-6", className)}><p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Prochaines échéances</p><div className="space-y-3">{[0, 1, 2].map((index) => <div key={index} className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-16" /></div>)}</div></Card>;

  return (
    <Card className={cn("p-6", className)}>
      <div className="mb-4 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prochaines échéances</p>{events.length > 0 && <span className="text-xs text-muted-foreground">{events.length} dans les 7 jours</span>}</div>
      {events.length === 0 ? (
        <div className="py-6 text-center"><p className="text-sm text-muted-foreground">Aucune échéance confirmée cette semaine.</p><Link href="/subscriptions" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Gérer les récurrents</Link></div>
      ) : (
        <div className="space-y-1">{events.map((event) => {
          const date = parseISO(event.date);
          const days = differenceInCalendarDays(date, today);
          return <Link key={event.id} href={`/subscriptions?recurringId=${event.recurringId ?? ""}`} className="flex flex-col gap-2 rounded-lg px-2 py-2.5 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50"><Receipt className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{event.name}</p><p className="text-xs text-muted-foreground">{format(date, "d MMM", { locale: fr })} · {days === 0 ? "aujourd’hui" : `dans ${days} jour${days > 1 ? "s" : ""}`}</p></div></div><p className="shrink-0 pl-11 text-sm font-medium sm:pl-0"><Money amount={convertFromAccount(event.amount, event.accountId)} /></p></Link>;
        })}</div>
      )}
    </Card>
  );
}
