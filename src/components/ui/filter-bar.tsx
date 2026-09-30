"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type FilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function FilterBar({
  search,
  onSearchChange,
  placeholder = "Rechercher…",
  children,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-surface)] border bg-card p-4 shadow-sm md:flex-row md:items-center",
        className
      )}
    >
      <div className="w-full md:max-w-xs">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          icon={<Search className="h-4 w-4" />}
          aria-label="Rechercher"
        />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex items-center gap-2 md:ml-auto">{actions}</div>}
    </div>
  );
}
