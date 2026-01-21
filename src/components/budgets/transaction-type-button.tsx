"use client";

import { useState } from "react";
import { Loader2, Check, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CATEGORY_TYPES,
  BudgetType,
  useTransactionTypeOverrides,
  useCategoryTypeOverrides,
  setTransactionTypeOverride,
  getCategoryBudgetType,
} from "@/lib/budget-types";

interface TransactionTypeButtonProps {
  transactionId: number;
  category: string;
  className?: string;
  onChange?: () => void;
  showLabel?: boolean;
  size?: "sm" | "default";
}

export function TransactionTypeButton({
  transactionId,
  category,
  className,
  onChange,
  showLabel = false,
  size = "sm",
}: TransactionTypeButtonProps) {
  const txOverrides = useTransactionTypeOverrides();
  const categoryOverrides = useCategoryTypeOverrides();
  const [saving, setSaving] = useState(false);

  const isLoading = txOverrides === undefined || categoryOverrides === undefined;

  // Get the effective type considering all override levels
  const txOverride = txOverrides?.[transactionId];
  const categoryType = getCategoryBudgetType(category, categoryOverrides || {});
  const effectiveType = txOverride || categoryType;
  const isOverridden = !!txOverride;
  const defaultType = DEFAULT_CATEGORY_TYPES[category] || "wants";

  const handleTypeChange = async (newType: BudgetType | null) => {
    setSaving(true);
    try {
      await setTransactionTypeOverride(transactionId, newType);
      onChange?.();
    } catch (error) {
      console.error("Failed to save transaction type override:", error);
    } finally {
      setSaving(false);
    }
  };

  const typeConfig: Record<BudgetType, { color: string; bgColor: string; label: string }> = {
    needs: { color: "text-blue-600", bgColor: "bg-blue-500", label: "Need" },
    wants: { color: "text-purple-600", bgColor: "bg-purple-500", label: "Want" },
    savings: { color: "text-emerald-600", bgColor: "bg-emerald-500", label: "Saving" },
    income: { color: "text-amber-600", bgColor: "bg-amber-500", label: "Income" },
  };

  const config = typeConfig[effectiveType];

  if (isLoading) {
    return (
      <Button variant="ghost" size={size} disabled className={className}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  // Don't show for income transactions
  if (categoryType === "income") {
    return null;
  }

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={size}
                className={cn(
                  "gap-1.5",
                  isOverridden && "ring-1 ring-offset-1 ring-primary/30",
                  className
                )}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <div className={cn("h-2 w-2 rounded-full", config.bgColor)} />
                    {showLabel && <span className="text-xs">{config.label}</span>}
                    {isOverridden && !showLabel && <Check className="h-2.5 w-2.5 text-primary" />}
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              {isOverridden ? (
                <span>Custom: <span className={config.color}>{config.label}</span></span>
              ) : (
                <span>Default ({defaultType}): <span className={config.color}>{config.label}</span></span>
              )}
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-36">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Budget Type
          </div>
          
          {(["needs", "wants", "savings"] as const).map((type) => {
            const tc = typeConfig[type];
            const isSelected = effectiveType === type;
            const isDefault = defaultType === type;
            
            return (
              <DropdownMenuItem
                key={type}
                onClick={() => handleTypeChange(isDefault && !txOverride ? null : type)}
                className={cn("gap-2", isSelected && "bg-muted")}
              >
                <div className={cn("h-2 w-2 rounded-full", tc.bgColor)} />
                <span>{tc.label}</span>
                {isDefault && (
                  <span className="text-xs text-muted-foreground ml-auto">(default)</span>
                )}
                {isSelected && <Check className="h-3 w-3 ml-auto" />}
              </DropdownMenuItem>
            );
          })}
          
          {isOverridden && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleTypeChange(null)}
                className="text-muted-foreground"
              >
                Reset to default
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

/**
 * Compact badge display showing transaction's budget type
 */
export function TransactionTypeBadge({
  transactionId,
  category,
  className,
}: {
  transactionId: number;
  category: string;
  className?: string;
}) {
  const txOverrides = useTransactionTypeOverrides();
  const categoryOverrides = useCategoryTypeOverrides();

  if (txOverrides === undefined || categoryOverrides === undefined) {
    return null;
  }

  const txOverride = txOverrides[transactionId];
  const categoryType = getCategoryBudgetType(category, categoryOverrides);
  const effectiveType = txOverride || categoryType;
  const isOverridden = !!txOverride;

  if (effectiveType === "income") {
    return null;
  }

  const typeConfig: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    needs: { variant: "default", label: "Need" },
    wants: { variant: "secondary", label: "Want" },
    savings: { variant: "outline", label: "Saving" },
  };

  const config = typeConfig[effectiveType] || typeConfig.wants;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "text-xs",
        isOverridden && "ring-1 ring-offset-1 ring-primary/30",
        effectiveType === "needs" && "bg-blue-500",
        effectiveType === "wants" && "bg-purple-500",
        effectiveType === "savings" && "bg-emerald-500",
        className
      )}
    >
      {config.label}
      {isOverridden && <span className="ml-1">*</span>}
    </Badge>
  );
}
