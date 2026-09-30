"use client";

import { useState, useEffect } from "react";
import { Settings, Loader2, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CATEGORY_TYPES,
  BudgetType,
  useCategoryTypeOverrides,
  setCategoryTypeOverride,
} from "@/lib/budget-types";
import { logger } from "@/lib/logger";

interface CategoryTypeOverridesProps {
  onChange?: () => void;
}

export function CategoryTypeOverrides({ onChange }: CategoryTypeOverridesProps) {
  const overrides = useCategoryTypeOverrides();
  const [localOverrides, setLocalOverrides] = useState<Record<string, BudgetType>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isLoading = overrides === undefined;

  // Sync local state with loaded overrides
  useEffect(() => {
    if (!isLoading && overrides) {
      setLocalOverrides(overrides);
    }
  }, [overrides, isLoading]);

  const handleTypeChange = async (category: string, newType: string) => {
    const defaultType = DEFAULT_CATEGORY_TYPES[category];
    
    // Update local state immediately
    setLocalOverrides((prev) => {
      const updated = { ...prev };
      if (newType === defaultType) {
        // If setting back to default, remove override
        delete updated[category];
      } else {
        updated[category] = newType as BudgetType;
      }
      return updated;
    });
    
    // Save to database
    setSaving(category);
    setSaveStatus(null);
    setSaveError(null);
    try {
      if (newType === defaultType) {
        // Remove override
        await setCategoryTypeOverride(category, null);
      } else {
        await setCategoryTypeOverride(category, newType as BudgetType);
      }
      onChange?.();
      setSaveStatus(`${category} enregistré`);
    } catch (error) {
      logger.error("Failed to save category type override:", error);
      setSaveError(`Impossible d’enregistrer ${category}. Réessayez.`);
    } finally {
      setSaving(null);
    }
  };

  const getEffectiveType = (category: string): BudgetType => {
    return localOverrides[category] || DEFAULT_CATEGORY_TYPES[category] || "wants";
  };

  const isOverridden = (category: string): boolean => {
    return category in localOverrides;
  };

  const typeColors: Record<BudgetType, string> = {
    needs: "bg-info",
    wants: "bg-warning",
    savings: "bg-success",
    income: "bg-primary",
  };

  const resetAllOverrides = async () => {
    setSaving("all");
    setSaveStatus(null);
    setSaveError(null);
    try {
      // Clear all overrides
      for (const category of Object.keys(localOverrides)) {
        await setCategoryTypeOverride(category, null);
      }
      setLocalOverrides({});
      onChange?.();
      setSaveStatus("Classement par défaut restauré");
    } catch (error) {
      logger.error("Failed to reset overrides:", error);
      setSaveError("Impossible de restaurer le classement par défaut. Réessayez.");
    } finally {
      setSaving(null);
    }
  };

  const categoriesWithTypes = Object.entries(CATEGORIES)
    .filter(([cat]) => cat !== "Income") // Don't show Income category
    .map(([category, info]) => ({
      category,
      icon: info.icon,
      color: info.color,
      defaultType: DEFAULT_CATEGORY_TYPES[category] || "wants",
      effectiveType: getEffectiveType(category),
      isOverridden: isOverridden(category),
    }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              Classement des catégories
            </CardTitle>
            <CardDescription>
              Choisissez comment chaque catégorie compte dans le budget.
            </CardDescription>
          </div>
          {Object.keys(localOverrides).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllOverrides}
              disabled={saving !== null}
            >
              Tout réinitialiser
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {saving ? "Enregistrement en cours" : saveStatus}
        </div>
        {saveError && <p role="alert" className="mb-3 text-sm text-destructive">{saveError}</p>}
        <div className="space-y-2">
          {categoriesWithTypes.map(({ category, defaultType, effectiveType, isOverridden }) => (
            <div
              key={category}
              className={cn(
                "flex flex-col items-start justify-between gap-2 rounded-lg p-2 transition-colors sm:flex-row sm:items-center",
                isOverridden && "bg-muted"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{category}</span>
                {isOverridden && (
                  <Badge variant="outline" className="text-xs">
                    Modifié
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {saving === category && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                {saving !== category && isOverridden && (
                  <Check className="h-3 w-3 text-success" />
                )}
                
                <Select
                  value={effectiveType}
                  onValueChange={(value) => handleTypeChange(category, value)}
                  disabled={saving !== null}
                >
                  <SelectTrigger className="w-[120px] h-8" aria-label={`Type de budget pour ${category}`}>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", typeColors[effectiveType])} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="needs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-info" />
                        Besoins {defaultType === "needs" && <span className="text-xs text-muted-foreground">(défaut)</span>}
                      </div>
                    </SelectItem>
                    <SelectItem value="wants">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-warning" />
                        Envies {defaultType === "wants" && <span className="text-xs text-muted-foreground">(défaut)</span>}
                      </div>
                    </SelectItem>
                    <SelectItem value="savings">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        Épargne {defaultType === "savings" && <span className="text-xs text-muted-foreground">(défaut)</span>}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Types de budget :</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-info" />
              <span className="text-xs">Besoins – dépenses essentielles</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-warning" />
              <span className="text-xs">Envies – dépenses discrétionnaires</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs">Épargne – objectifs futurs</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
