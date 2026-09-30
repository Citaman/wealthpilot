"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Save,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CategorySelect } from "./category-select";
import { TagInput, COMMON_TAGS } from "./tag-input";
import { type Transaction } from "@/lib/db";
import { TransactionTypeButton } from "@/components/budgets";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";

interface TransactionEditDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (transaction: Transaction, applyToSimilar?: boolean) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  similarCount?: number;
}

export function TransactionEditDialog({
  transaction,
  open,
  onOpenChange,
  onSave,
  onDelete,
  similarCount = 0,
}: TransactionEditDialogProps) {
  const { getAccountCurrency } = useMoney();
  const [editedTx, setEditedTx] = useState<Transaction | null>(null);
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      setEditedTx({ ...transaction });
      setApplyToSimilar(false);
      setHasChanges(false);
      setDeleteArmed(false);
    }
  }, [transaction]);

  // Track changes
  useEffect(() => {
    if (transaction && editedTx) {
      const changed =
        editedTx.category !== transaction.category ||
        editedTx.subcategory !== transaction.subcategory ||
        editedTx.merchant !== transaction.merchant ||
        editedTx.notes !== transaction.notes ||
        editedTx.isRecurring !== transaction.isRecurring ||
        editedTx.isExcluded !== transaction.isExcluded ||
        JSON.stringify(editedTx.tags) !== JSON.stringify(transaction.tags);
      setHasChanges(changed);
    }
  }, [editedTx, transaction]);

  if (!editedTx) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedTx, applyToSimilar);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (transaction) {
      setEditedTx({ ...transaction });
      setHasChanges(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier la transaction
            {hasChanges && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                Modifications non enregistrées
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transaction Summary (read-only) */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(editedTx.date), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="font-medium">{editedTx.merchantOriginal || editedTx.merchant}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {editedTx.description}
              </p>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {editedTx.direction === "credit" ? "+" : "-"}
              <Money
                amount={Math.abs(editedTx.amount)}
                currency={getAccountCurrency(editedTx.accountId)}
                minimumFractionDigits={2}
                maximumFractionDigits={2}
              />
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <CategorySelect
              category={editedTx.category}
              subcategory={editedTx.subcategory}
              onCategoryChange={(cat) =>
                setEditedTx((prev) => prev && { ...prev, category: cat, subcategory: "" })
              }
              onSubcategoryChange={(sub) =>
                setEditedTx((prev) => prev && { ...prev, subcategory: sub })
              }
            />
          </div>

          {/* Merchant Name */}
          <div className="space-y-2">
            <Label>Nom du marchand</Label>
            <Input
              value={editedTx.merchant}
              onChange={(e) =>
                setEditedTx((prev) => prev && { ...prev, merchant: e.target.value })
              }
              placeholder="Nom normalisé du marchand"
            />
            {editedTx.merchantOriginal && editedTx.merchantOriginal !== editedTx.merchant && (
              <p className="text-xs text-muted-foreground">
                Original : {editedTx.merchantOriginal}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Libellés</Label>
            <TagInput
              value={editedTx.tags || []}
              onChange={(tags) =>
                setEditedTx((prev) => prev && { ...prev, tags })
              }
              suggestions={COMMON_TAGS}
              placeholder="Ajouter des libellés…"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={editedTx.notes || ""}
              onChange={(e) =>
                setEditedTx((prev) => prev && { ...prev, notes: e.target.value })
              }
              placeholder="Ajouter une note sur cette transaction…"
              rows={3}
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={editedTx.isRecurring}
                onCheckedChange={(checked) =>
                  setEditedTx((prev) => prev && { ...prev, isRecurring: !!checked })
                }
              />
              <span className="text-sm">Transaction récurrente</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={editedTx.isExcluded || false}
                onCheckedChange={(checked) =>
                  setEditedTx((prev) => prev && { ...prev, isExcluded: !!checked })
                }
              />
              <span className="text-sm">Exclure des budgets et analyses</span>
            </label>
          </div>

          {/* Budget Type Override */}
          {editedTx.id && (
            <div className="space-y-2">
              <Label>Type de budget (besoin, envie ou épargne)</Label>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <TransactionTypeButton
                  transactionId={editedTx.id}
                  category={editedTx.category}
                  size="default"
                  showLabel
                />
                <p className="text-xs text-muted-foreground">
                  Ce choix ne s’applique qu’à cette transaction.
                </p>
              </div>
            </div>
          )}

          {/* Bulk Apply Option */}
          {similarCount > 0 && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-muted">
              <Checkbox
                id="apply-similar"
                checked={applyToSimilar}
                onCheckedChange={(checked) => setApplyToSimilar(!!checked)}
              />
              <label htmlFor="apply-similar" className="text-sm cursor-pointer">
                Appliquer la catégorie et le marchand aux{" "}
                <span className="font-semibold">{similarCount}</span> transaction(s) similaire(s)
              </label>
            </div>
          )}

          {/* Advanced Section */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Détails avancés
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Identifiant :</span>
                  <span className="ml-2 font-mono">{editedTx.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Moyen de paiement :</span>
                  <span className="ml-2">{editedTx.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date de valeur :</span>
                  <span className="ml-2">{editedTx.valueDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solde après opération :</span>
                  <span className="ml-2">
                    <Money
                      amount={editedTx.balanceAfter}
                      currency={getAccountCurrency(editedTx.accountId)}
                      minimumFractionDigits={2}
                      maximumFractionDigits={2}
                    />
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Description complète :</span>
                <p className="mt-1 text-xs font-mono bg-background p-2 rounded border">
                  {editedTx.description}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {onDelete && editedTx.id && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!deleteArmed) { setDeleteArmed(true); return; }
                  await onDelete(editedTx.id!);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleteArmed ? "Confirmer la suppression" : "Supprimer"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Réinitialiser
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
