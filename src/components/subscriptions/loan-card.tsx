"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MoreHorizontal, Calendar, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORIES, type RecurringTransaction } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface LoanCardProps {
  loan: RecurringTransaction;
  onEdit: (loan: RecurringTransaction) => void;
  onViewHistory: (loan: RecurringTransaction) => void;
  onDelete: (loan: RecurringTransaction) => void;
  onMarkComplete: (loan: RecurringTransaction) => void;
}

export function LoanCard({
  loan,
  onEdit,
  onViewHistory,
  onDelete,
  onMarkComplete,
}: LoanCardProps) {
  const { convertFromAccount } = useMoney();
  const categoryInfo = CATEGORIES[loan.category];
  const loanDetails = loan.loan;
  const isActive = loan.status === "active";
  const isCompleted = loan.status === "completed";

  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <Badge variant="default">
          Remboursé
        </Badge>
      );
    }
    if (loan.status === "paused") {
      return <Badge variant="secondary">En pause</Badge>;
    }
    return <Badge variant="default">Actif</Badge>;
  };

  const paymentProgress = loanDetails
    ? (loanDetails.paymentsMade / loanDetails.termMonths) * 100
    : 0;

  const nextPaymentDate = loan.nextExpected ? new Date(loan.nextExpected) : null;

  // Get category icon
  const IconComponent = categoryInfo?.icon;

  return (
    <Card className={cn(isCompleted && "opacity-70")}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${categoryInfo?.color}15`,
                color: categoryInfo?.color,
              }}
            >
              {IconComponent && <IconComponent className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{loan.name}</h4>
                {getStatusBadge()}
              </div>
              {loan.merchant && (
                <p className="text-sm text-muted-foreground">{loan.merchant}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions pour ${loan.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(loan)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewHistory(loan)}>
                <Calendar className="mr-2 h-4 w-4" />
                Historique des paiements
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {!isCompleted && (
                <DropdownMenuItem onClick={() => onMarkComplete(loan)}>
                  Marquer comme remboursé
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(loan)}
                className="text-foreground"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Progress Section */}
        {loanDetails && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progression</span>
              <span>
                {loanDetails.paymentsMade} / {loanDetails.termMonths} paiements
              </span>
            </div>
            <Progress value={paymentProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Payé : <Money amount={Math.abs(convertFromAccount(loanDetails.totalPaid, loan.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
              <span>Restant : <Money amount={Math.abs(convertFromAccount(loanDetails.remainingBalance, loan.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} /></span>
            </div>
          </div>
        )}

        {/* Key Stats */}
        {loanDetails && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-xs text-muted-foreground">Mensualité</p>
              <p className="font-semibold"><Money amount={Math.abs(convertFromAccount(loan.amount, loan.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} /></p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-xs text-muted-foreground">Taux</p>
              <p className="font-semibold">{loanDetails.interestRate}%</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="text-xs text-muted-foreground">Mois restants</p>
              <p className="font-semibold">{loanDetails.paymentsRemaining}</p>
            </div>
          </div>
        )}

        {/* Principal/Interest Breakdown */}
        {loanDetails && loanDetails.totalPaid > 0 && (
          <div className="p-3 bg-muted rounded-lg mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm">Capital remboursé</span>
              <span className="font-medium">
                <Money
                  amount={Math.abs(convertFromAccount(loanDetails.totalPaid - loanDetails.totalInterestPaid, loan.accountId))}
                  minimumFractionDigits={2}
                  maximumFractionDigits={2}
                />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Intérêts payés</span>
              <span className="font-medium text-foreground">
                <Money amount={Math.abs(convertFromAccount(loanDetails.totalInterestPaid, loan.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} />
              </span>
            </div>
          </div>
        )}

        {/* Next Payment */}
        {nextPaymentDate && isActive && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prochaine échéance :</span>
            <span className="font-medium">
              {format(nextPaymentDate, "d MMM yyyy", { locale: fr })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
