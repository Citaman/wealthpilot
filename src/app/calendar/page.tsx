"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { db, CATEGORIES } from "@/lib/db";
import { buildRecurringTimeline } from "@/lib/recurring";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { useAccount } from "@/contexts/account-context";

interface BillEvent {
  id: string;
  recurringId?: number;
  transactionId?: number;
  name: string;
  amount: number;
  date: Date;
  category: string;
  type: "upcoming" | "paid" | "overdue";
  isRecurring: boolean;
  frequency?: string;
  recurringType?: string;
  direction: "income" | "expense";
}

export default function CalendarPage() {
  const { convertFromAccount } = useMoney();
  const { selectedAccountId } = useAccount();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBills, setSelectedBills] = useState<BillEvent[]>([]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  // Live query for recurring transactions - auto-updates when data changes
  const recurring = useLiveQuery(
    async () => {
      return db.recurringTransactions
        .filter((r) => r.status === "active" && !r.isExcluded && (selectedAccountId === "all" || r.accountId === selectedAccountId))
        .toArray();
    },
    [selectedAccountId],
    [] // default value
  );

  // Live query for transactions in this month - auto-updates when data changes
  const transactions = useLiveQuery(
    async () => {
      const startStr = format(monthStart, "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");
      return db.transactions
        .where("date")
        .between(startStr, endStr, true, true)
        .filter((tx) => !tx.isExcluded && (selectedAccountId === "all" || tx.accountId === selectedAccountId))
        .toArray();
    },
    [currentMonth.getMonth(), currentMonth.getFullYear(), selectedAccountId],
    [] // default value
  );

  // Shared recurring engine: the same schedule and matching contract can feed subscriptions and Dashboard.
  const bills = useMemo(() => {
    if (!recurring || !transactions) return [];
    return buildRecurringTimeline({ recurring, transactions, rangeStart: monthStart, rangeEnd: monthEnd, today })
      .map((event): BillEvent => ({
        ...event,
        amount: Math.abs(convertFromAccount(event.amount, event.accountId)),
        date: new Date(`${event.date}T12:00:00`),
        type: event.status,
        isRecurring: true,
        recurringType: event.recurringType,
      }));
  }, [recurring, transactions, monthStart, monthEnd, today, convertFromAccount]);

  const isLoading = recurring === undefined || transactions === undefined;

  const getBillsForDate = (date: Date) => {
    return bills.filter((bill) => isSameDay(bill.date, date));
  };

  const handleDayClick = (date: Date) => {
    const dayBills = getBillsForDate(date);
    if (dayBills.length > 0) {
      setSelectedDate(date);
      setSelectedBills(dayBills);
    }
  };

  const upcomingBills = useMemo(() => {
    return bills
      .filter((b) => b.type === "upcoming" && b.date >= today)
      .slice(0, 5);
  }, [bills, today]);

  const overdueBills = useMemo(() => {
    return bills.filter((b) => b.type === "overdue");
  }, [bills]);

  const expenseTotal = useMemo(() => bills.filter((b) => b.direction === "expense").reduce((sum, b) => sum + b.amount, 0), [bills]);
  const incomeTotal = useMemo(() => bills.filter((b) => b.direction === "income").reduce((sum, b) => sum + b.amount, 0), [bills]);
  const paidTotal = useMemo(() => bills.filter((b) => b.direction === "expense" && b.type === "paid").reduce((sum, b) => sum + b.amount, 0), [bills]);

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES[category as keyof typeof CATEGORIES];
    if (cat?.icon) {
      const IconComponent = cat.icon;
      return <IconComponent className="h-3 w-3" />;
    }
    return null;
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case "subscription": return "Abonnement";
      case "bill": return "Facture";
      case "loan": return "Crédit";
      case "income": return "Revenu";
      default: return "Récurrent";
    }
  };

  const getFrequencyLabel = (frequency?: string) => ({
    weekly: "Hebdomadaire",
    biweekly: "Toutes les deux semaines",
    monthly: "Mensuel",
    quarterly: "Trimestriel",
    yearly: "Annuel",
  }[frequency || ""] || frequency || "");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Revenus et dépenses récurrents, prévus et réalisés
          </p>
          {isLoading && (
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dépenses prévues</p>
                  <p className="text-2xl font-semibold"><Money amount={expenseTotal} /></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dépenses réalisées</p>
                  <p className="text-2xl font-semibold"><Money amount={paidTotal} /></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenus prévus</p>
                  <p className="text-2xl font-semibold"><Money amount={incomeTotal} /></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">En retard</p>
                  <p className="text-2xl font-semibold">
                    {overdueBills.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{format(currentMonth, "MMMM yyyy", { locale: fr })}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Mois précédent"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Aujourd’hui
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Mois suivant"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:hidden" aria-label="Agenda du mois">
                {bills.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Aucun mouvement récurrent pour ce mois.</p>
                ) : bills.map((bill) => (
                  <button key={bill.id} type="button" onClick={() => handleDayClick(bill.date)} className="flex min-h-12 w-full items-center justify-between rounded-lg border p-3 text-left">
                    <span><span className="block font-medium">{bill.name}</span><span className="text-sm text-muted-foreground">{format(bill.date, "dd/MM")} · {bill.type === "paid" ? "Réalisé" : bill.type === "overdue" ? "En retard" : "Prévu"}</span></span>
                    <span className="font-semibold"><Money amount={bill.direction === "income" ? bill.amount : -bill.amount} /></span>
                  </button>
                ))}
              </div>

              {/* Day names */}
              <div className="mb-2 hidden grid-cols-7 gap-1 md:grid">
                {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="hidden grid-cols-7 gap-1 md:grid">
                {/* Empty cells for days before month start */}
                {Array.from({ length: startDayOfWeek }).map((_, index) => (
                  <div key={`empty-${index}`} className="p-2 min-h-[80px]" />
                ))}

                {/* Days */}
                {days.map((day) => {
                  const dayBills = getBillsForDate(day);
                  const hasBills = dayBills.length > 0;

                  return (
                    hasBills ? <button
                      key={day.toISOString()}
                      type="button"
                      aria-label={`${format(day, "dd/MM/yyyy")} — ${dayBills.length} mouvement${dayBills.length > 1 ? "s" : ""}`}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "p-2 min-h-[80px] rounded-lg border text-left transition-colors hover:bg-muted",
                        isToday(day) && "ring-1 ring-primary",
                        hasBills && "cursor-pointer",
                        !hasBills && "cursor-default"
                      )}
                    >
                      <div
                        className="text-sm font-medium mb-1"
                      >
                        {format(day, "d")}
                      </div>
                      {hasBills && (
                        <div className="space-y-1">
                          {dayBills.slice(0, 2).map((bill) => (
                            <div
                              key={bill.id}
                              className="text-xs px-1.5 py-0.5 rounded truncate bg-primary/10 text-primary"
                            >
                              {bill.name}
                            </div>
                          ))}
                          {dayBills.length > 2 && (
                            <div className="text-xs text-muted-foreground px-1.5">
                              +{dayBills.length - 2} autre{dayBills.length - 2 > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      )}
                    </button> : <div key={day.toISOString()} className={cn("min-h-[80px] rounded-lg border p-2", isToday(day) && "ring-1 ring-primary")}><div className="mb-1 text-sm font-medium">{format(day, "d")}</div></div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
                  <span>Prévu, réalisé ou en retard (détail dans l’événement)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Bills Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prochains mouvements</CardTitle>
                <CardDescription>Les 5 prochaines entrées ou sorties</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : upcomingBills.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun mouvement à venir ce mois-ci. Lancez la détection depuis Récurrents si nécessaire.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground"
                          >
                            {getCategoryIcon(bill.category)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{bill.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(bill.date, "d MMM", { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            <Money amount={bill.amount} />
                          </p>
                          {bill.frequency && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {getFrequencyLabel(bill.frequency)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {overdueBills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    Factures en retard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{bill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Échéance le {format(bill.date, "d MMM", { locale: fr })}
                          </p>
                        </div>
                        <p className="font-semibold">
                          <Money amount={bill.amount} />
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Day Detail Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
              </DialogTitle>
              <DialogDescription>
                {selectedBills.length} mouvement{selectedBills.length !== 1 ? "s" : ""} ce jour-là
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {selectedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground"
                    >
                      {getCategoryIcon(bill.category)}
                    </div>
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{bill.category}</span>
                        {bill.recurringType && (
                          <>
                            <span>•</span>
                            <span>{getTypeLabel(bill.recurringType)}</span>
                          </>
                        )}
                        {bill.frequency && (
                          <>
                            <span>•</span>
                            <span>{getFrequencyLabel(bill.frequency)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg"><Money amount={bill.amount} /></p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        bill.type === "paid" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}
                    >
                      {bill.type === "paid" ? "Réalisé" : bill.type === "upcoming" ? "À venir" : "En retard"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
