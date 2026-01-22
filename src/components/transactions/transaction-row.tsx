"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Edit2, MoreHorizontal, Copy, Eye, EyeOff, Repeat, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "./category-select";
import { type Transaction, CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import { TransactionTypeBadge, TransactionTypeButton } from "@/components/budgets";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onSelect?: (id: number, selected: boolean) => void;
  onCreateRecurring?: (transaction: Transaction) => void;
  onToggleExcluded?: (transaction: Transaction) => void;
  isSelected?: boolean;
  showCheckbox?: boolean;
  compact?: boolean;
}

export function TransactionRow({
  transaction,
  onEdit,
  onSelect,
  onCreateRecurring,
  onToggleExcluded,
  isSelected = false,
  showCheckbox = false,
  compact = false,
}: TransactionRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { getAccountCurrency } = useMoney();

  const categoryData = CATEGORIES[transaction.category];
  const IconComponent = categoryData?.icon;

  return (
    <div
      className={cn(
        "group flex items-center gap-4 px-4 py-3 border-b transition-colors",
        "hover:bg-muted/50 cursor-pointer",
        isSelected && "bg-blue-50",
        transaction.isExcluded && "opacity-60"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(transaction)}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              onSelect?.(transaction.id!, !!checked);
            }}
          />
        </div>
      )}

      {/* Category Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          compact ? "w-8 h-8" : "w-10 h-10"
        )}
        style={{ backgroundColor: `${categoryData?.color}20` }}
      >
        {IconComponent && (
          <IconComponent
            className={cn(compact ? "h-4 w-4" : "h-5 w-5")}
            style={{ color: categoryData?.color }}
          />
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", compact && "text-sm")}>
            {transaction.merchant}
          </span>
          {transaction.isRecurring && (
            <Repeat className="h-3 w-3 text-muted-foreground" />
          )}
          {transaction.isExcluded && (
            <EyeOff className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <CategoryBadge
            category={transaction.category}
            subcategory={transaction.subcategory}
            size="sm"
            onClick={() => {}}
          />
          {transaction.id && (
            <div className="hidden sm:block">
              <TransactionTypeBadge
                transactionId={transaction.id}
                category={transaction.category}
              />
            </div>
          )}
          {transaction.tags && transaction.tags.length > 0 && (
            <div className="flex gap-1">
              {transaction.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">
                  {tag}
                </Badge>
              ))}
              {transaction.tags.length > 2 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  +{transaction.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground w-24 text-right hidden sm:block">
        {format(new Date(transaction.date), "MMM d")}
      </div>

      {/* Amount */}
      <div
        className={cn(
          "font-semibold tabular-nums text-right w-28",
          transaction.direction === "credit" ? "text-green-600" : "text-red-600",
          compact && "text-sm w-24"
        )}
      >
        {transaction.direction === "credit" ? "+" : "-"}
        <Money
          amount={Math.abs(transaction.amount)}
          currency={getAccountCurrency(transaction.accountId)}
          minimumFractionDigits={2}
          maximumFractionDigits={2}
        />
      </div>

      {/* Actions */}
      <div
        className={cn(
          "flex items-center gap-1 transition-opacity",
          isHovered ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {isHovered && transaction.id && (
          <div onClick={(e) => e.stopPropagation()}>
            <TransactionTypeButton
              transactionId={transaction.id}
              category={transaction.category}
              size="sm"
            />
          </div>
        )}

        {onToggleExcluded && transaction.id && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onToggleExcluded(transaction)}
            title={transaction.isExcluded ? "Include in budgets & analytics" : "Exclude from budgets & analytics"}
          >
            {transaction.isExcluded ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(transaction)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(transaction)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {onCreateRecurring && (
              <DropdownMenuItem onClick={() => onCreateRecurring(transaction)}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Create Recurring
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onToggleExcluded?.(transaction)}
              disabled={!onToggleExcluded}
            >
              {transaction.isExcluded ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Include in budgets & analytics
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Exclude from budgets & analytics
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Batch action bar for selected transactions
interface BatchActionBarProps {
  selectedCount: number;
  onCategorize: () => void;
  onTag: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  onCategorize,
  onTag,
  onDelete,
  onClearSelection,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg">
        <span className="font-medium">{selectedCount} selected</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onCategorize}
          >
            Categorize
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onTag}
          >
            Add Tags
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-primary-foreground hover:text-primary-foreground/80"
          onClick={onClearSelection}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
