"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MoreHorizontal,
  Calendar,
  Pause,
  Play,
  XCircle,
  Trash2,
  Edit,
  ChevronDown,
  Link2,
  Merge,
  CreditCard,
  Receipt,
  Landmark,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CATEGORIES, type RecurringTransaction, type RecurringType } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface SubscriptionCardProps {
  subscription: RecurringTransaction;
  onEdit: (sub: RecurringTransaction) => void;
  onViewHistory: (sub: RecurringTransaction) => void;
  onPause: (sub: RecurringTransaction) => void;
  onCancel: (sub: RecurringTransaction) => void;
  onDelete: (sub: RecurringTransaction) => void;
  onExclude: (sub: RecurringTransaction) => void;
  onMerge?: (sub: RecurringTransaction) => void;
  onLinkTransaction?: (sub: RecurringTransaction) => void;
  onChangeType?: (sub: RecurringTransaction, newType: RecurringType) => void;
}

export function SubscriptionCard({
  subscription: sub,
  onEdit,
  onViewHistory,
  onPause,
  onCancel,
  onDelete,
  onExclude,
  onMerge,
  onLinkTransaction,
  onChangeType,
}: SubscriptionCardProps) {
  const { convertFromAccount } = useMoney();
  const categoryInfo = CATEGORIES[sub.category];
  const isActive = sub.status === "active";
  const isPaused = sub.status === "paused";
  const isCancelled = sub.status === "cancelled";
  const currentType = sub.type || "subscription";

  // Type options with icons and labels
  const typeOptions: { type: RecurringType; label: string; icon: typeof CreditCard }[] = [
    { type: "subscription", label: "Abonnement", icon: CreditCard },
    { type: "bill", label: "Facture", icon: Receipt },
    { type: "loan", label: "Crédit", icon: Landmark },
    { type: "income", label: "Revenu", icon: Wallet },
  ];

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case "weekly":
        return "semaine";
      case "biweekly":
        return "2 semaines";
      case "monthly":
        return "mois";
      case "quarterly":
        return "trimestre";
      case "yearly":
        return "an";
      default:
        return freq;
    }
  };

  const getStatusBadge = () => {
    if (isCancelled) {
      return <Badge variant="secondary">Annulé</Badge>;
    }
    if (isPaused) {
      return <Badge variant="secondary">En pause</Badge>;
    }
    if (sub.status === "completed") {
      return <Badge variant="outline">Terminé</Badge>;
    }
    return <Badge variant="default">Actif</Badge>;
  };

  const nextPaymentDate = sub.nextExpected ? new Date(sub.nextExpected) : null;
  const isUpcoming =
    nextPaymentDate &&
    nextPaymentDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
    nextPaymentDate.getTime() > Date.now();

  // Get category icon
  const IconComponent = categoryInfo?.icon;

  return (
    <Card className={cn(!isActive && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
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
                <h4 className="font-semibold">{sub.name}</h4>
                {getStatusBadge()}
              </div>
              {sub.merchant && (
                <p className="text-sm text-muted-foreground">{sub.merchant}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions pour ${sub.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(sub)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewHistory(sub)}>
                <Calendar className="mr-2 h-4 w-4" />
                Voir l’historique
              </DropdownMenuItem>
              {onLinkTransaction && (
                <DropdownMenuItem onClick={() => onLinkTransaction(sub)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Relier une transaction
                </DropdownMenuItem>
              )}
              {onMerge && (
                <DropdownMenuItem onClick={() => onMerge(sub)}>
                  <Merge className="mr-2 h-4 w-4" />
                  Fusionner avec un autre
                </DropdownMenuItem>
              )}
              
              {/* Change Type Submenu */}
              {onChangeType && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Changer le type
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {typeOptions
                      .filter((opt) => opt.type !== currentType)
                      .map((opt) => (
                        <DropdownMenuItem
                          key={opt.type}
                          onClick={() => onChangeType(sub, opt.type)}
                        >
                          <opt.icon className="mr-2 h-4 w-4" />
                          {opt.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              <DropdownMenuSeparator />
              {isActive ? (
                <DropdownMenuItem onClick={() => onPause(sub)}>
                  <Pause className="mr-2 h-4 w-4" />
                  Mettre en pause
                </DropdownMenuItem>
              ) : isPaused ? (
                <DropdownMenuItem onClick={() => onPause(sub)}>
                  <Play className="mr-2 h-4 w-4" />
                  Reprendre
                </DropdownMenuItem>
              ) : null}
              {!isCancelled && sub.status !== "completed" && (
                <DropdownMenuItem onClick={() => onCancel(sub)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Marquer comme annulé
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onExclude(sub)}
                className="text-muted-foreground"
              >
                Ce n’est pas {sub.type === "bill" ? "une facture" : "un abonnement"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(sub)}
                className="text-foreground"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Amount and Next Payment */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-lg font-semibold">
              <Money amount={Math.abs(convertFromAccount(sub.amount, sub.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} />
              <span className="text-sm font-normal text-muted-foreground">
                /{frequencyLabel(sub.frequency)}
              </span>
            </p>
            {sub.isVariable && sub.averageAmount && (
              <p className="text-xs text-muted-foreground">
                Moy. : <Money amount={Math.abs(convertFromAccount(sub.averageAmount, sub.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} />
              </p>
            )}
          </div>
          {nextPaymentDate && isActive && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                Prochaine : {format(nextPaymentDate, "d MMM", { locale: fr })}
              </p>
              {isUpcoming && (
                <span className="text-xs text-muted-foreground font-medium">
                  Bientôt due
                </span>
              )}
            </div>
          )}
        </div>

        {/* Detection basis (collapsible) */}
        {sub.occurrences && sub.occurrences.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-3 w-3" />
              {sub.isUserCreated
                ? "Historique des paiements"
                : `Base de détection : ${sub.occurrences.length} occurrences`}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
                {sub.occurrences.slice(0, 5).map((occ, idx) => (
                  <div
                    key={occ.id || idx}
                    className="flex justify-between text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          occ.status === "paid" && "bg-[#FF6B4A]",
                          occ.status === "pending" && "bg-[#FFAB96]",
                          occ.status === "missed" && "bg-[#E8E8EC]"
                        )}
                      />
                      {format(new Date(occ.date), "d MMM yyyy", { locale: fr })}
                    </span>
                    <span>
                      <Money amount={Math.abs(convertFromAccount(occ.amount, sub.accountId))} minimumFractionDigits={2} maximumFractionDigits={2} />
                    </span>
                  </div>
                ))}
                {sub.occurrences.length > 5 && (
                  <button
                    onClick={() => onViewHistory(sub)}
                    className="text-xs text-primary hover:underline"
                  >
                    Voir les {sub.occurrences.length} occurrences
                  </button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
