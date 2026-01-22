"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CategorySelect } from "./category-select";
import { TagInput } from "./tag-input";
import { useToast } from "@/hooks/use-toast";
import { db, type Transaction } from "@/lib/db";

interface BulkWorkbenchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: number[];
  onComplete: () => void;
}

export function BulkWorkbench({
  open,
  onOpenChange,
  selectedIds,
  onComplete,
}: BulkWorkbenchProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // States for changes to apply
  const [category, setCategory] = useState<string>("");
  const [subcategory, setSubcategory] = useState<string>("");
  const [applyCategory, setApplyCategory] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [applyTags, setApplyTags] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [applyRecurring, setApplyRecurring] = useState(false);

  const [isExcluded, setIsExcluded] = useState(false);
  const [applyExcluded, setApplyExcluded] = useState(false);

  const handleApply = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Transaction> = {};
      if (applyCategory && category) {
        updates.category = category;
        updates.subcategory = subcategory;
      }
      if (applyTags) {
        updates.tags = tags;
      }
      if (applyRecurring) {
        updates.isRecurring = isRecurring;
      }
      if (applyExcluded) {
        updates.isExcluded = isExcluded;
      }

      if (Object.keys(updates).length === 0) {
        toast({ title: "No changes selected", variant: "destructive" });
        return;
      }

      await db.transactions.bulkUpdate(
        selectedIds.map(id => ({ key: id, changes: updates }))
      );

      toast({
        variant: "success",
        title: "Bulk Update Successful",
        description: `Updated ${selectedIds.length} transactions.`,
      });
      
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error("Bulk update failed:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while updating transactions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Update Transactions</DialogTitle>
          <DialogDescription>
            Applying changes to {selectedIds.length} selected transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="apply-cat" 
                checked={applyCategory} 
                onCheckedChange={(v) => setApplyCategory(!!v)} 
              />
              <Label htmlFor="apply-cat" className="font-semibold">Update Category</Label>
            </div>
            {applyCategory && (
              <div className="pl-6">
                <CategorySelect
                  category={category}
                  subcategory={subcategory}
                  onCategoryChange={setCategory}
                  onSubcategoryChange={setSubcategory}
                />
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="apply-tags" 
                checked={applyTags} 
                onCheckedChange={(v) => setApplyTags(!!v)} 
              />
              <Label htmlFor="apply-tags" className="font-semibold">Update Tags</Label>
            </div>
            {applyTags && (
              <div className="pl-6">
                <TagInput value={tags} onChange={setTags} />
              </div>
            )}
          </div>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="apply-rec" 
                  checked={applyRecurring} 
                  onCheckedChange={(v) => setApplyRecurring(!!v)} 
                />
                <Label htmlFor="apply-rec">Set Recurring</Label>
              </div>
              {applyRecurring && (
                <div className="pl-6 flex items-center gap-2">
                  <Checkbox 
                    id="val-rec" 
                    checked={isRecurring} 
                    onCheckedChange={(v) => setIsRecurring(!!v)} 
                  />
                  <Label htmlFor="val-rec" className="text-xs">Yes, recurring</Label>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="apply-ex" 
                  checked={applyExcluded} 
                  onCheckedChange={(v) => setApplyExcluded(!!v)} 
                />
                <Label htmlFor="apply-ex">Set Excluded</Label>
              </div>
              {applyExcluded && (
                <div className="pl-6 flex items-center gap-2">
                  <Checkbox 
                    id="val-ex" 
                    checked={isExcluded} 
                    onCheckedChange={(v) => setIsExcluded(!!v)} 
                  />
                  <Label htmlFor="val-ex" className="text-xs">Yes, exclude</Label>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={isSaving}>
            {isSaving ? "Updating..." : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
