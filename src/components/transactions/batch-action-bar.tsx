"use client";

import { Button } from "@/components/ui/button";

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
    <div className="fixed inset-x-3 bottom-[calc(var(--shell-mobile-nav-height)+1rem+env(safe-area-inset-bottom))] z-50 lg:bottom-8 lg:left-1/2 lg:right-auto lg:-translate-x-1/2">
      <div className="dock-surface flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-3 text-foreground lg:flex-nowrap lg:gap-4 lg:rounded-full lg:px-6">
        <span className="font-semibold" aria-live="polite">{selectedCount} sélectionnée(s)</span>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={onCategorize}>Catégoriser</Button>
          <Button size="sm" variant="secondary" onClick={onTag}>Ajouter des tags</Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>Supprimer</Button>
        </div>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClearSelection}>Annuler</Button>
      </div>
    </div>
  );
}
