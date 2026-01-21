"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, type RecurringTransaction } from "@/lib/db";

interface MergeRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceItem: RecurringTransaction | null;
  allItems: RecurringTransaction[];
  onMerge: (targetId: number, sourceId: number) => void;
}

export function MergeRecurringDialog({
  open,
  onOpenChange,
  sourceItem,
  allItems,
  onMerge,
}: MergeRecurringDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);

  // Filter out the source item and search
  const availableItems = useMemo(() => {
    if (!sourceItem) return [];
    return allItems.filter((item) => {
      if (item.id === sourceItem.id) return false;
      if (item.status === "cancelled" || item.status === "completed") return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.merchant?.toLowerCase().includes(term)
      );
    });
  }, [allItems, sourceItem, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const handleMerge = () => {
    if (selectedTargetId && sourceItem?.id) {
      onMerge(selectedTargetId, sourceItem.id);
      onOpenChange(false);
      setSelectedTargetId(null);
      setSearchTerm("");
    }
  };

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedTargetId(null);
      setSearchTerm("");
    }
    onOpenChange(newOpen);
  };

  if (!sourceItem) return null;

  const sourceCategoryInfo = CATEGORIES[sourceItem.category];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Merge Recurring Items</DialogTitle>
          <DialogDescription>
            Select the target item to merge "{sourceItem.name}" into. The source
            item will be deleted after merging.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source item preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Merging from:
            </Label>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: `${sourceCategoryInfo?.color}15`,
                  color: sourceCategoryInfo?.color,
                }}
              >
                {sourceCategoryInfo?.icon && (
                  <sourceCategoryInfo.icon className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{sourceItem.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(sourceItem.amount)} • {sourceItem.frequency}
                </p>
              </div>
              {sourceItem.occurrences && sourceItem.occurrences.length > 0 && (
                <Badge variant="secondary">
                  {sourceItem.occurrences.length} payments
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Search */}
          <div>
            <Label>Select Target Item</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or merchant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Target selection */}
          <ScrollArea className="h-[250px] border rounded-lg p-2">
            {availableItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No other recurring items found
              </div>
            ) : (
              <div className="space-y-2">
                {availableItems.map((item) => {
                  const categoryInfo = CATEGORIES[item.category];
                  const isSelected = selectedTargetId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedTargetId(item.id!)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg flex items-center justify-center"
                            style={{
                              backgroundColor: `${categoryInfo?.color}15`,
                              color: categoryInfo?.color,
                            }}
                          >
                            {categoryInfo?.icon && (
                              <categoryInfo.icon className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.merchant && (
                              <p className="text-xs text-muted-foreground">
                                {item.merchant}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(item.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {item.frequency}
                          </p>
                        </div>
                      </div>
                      {item.occurrences && item.occurrences.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {item.occurrences.length} payment
                          {item.occurrences.length !== 1 ? "s" : ""} tracked
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Summary */}
          {selectedTargetId && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-sm">
              <p className="text-blue-900 dark:text-blue-100">
                <strong>After merge:</strong> All{" "}
                {sourceItem.occurrences?.length || 0} payment
                {(sourceItem.occurrences?.length || 0) !== 1 ? "s" : ""} from "
                {sourceItem.name}" will be added to the target. "{sourceItem.name}"
                will be deleted.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!selectedTargetId}>
            Merge Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
