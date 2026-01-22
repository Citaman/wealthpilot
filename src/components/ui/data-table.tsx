"use client";

import { cn } from "@/lib/utils";

export type DataTableColumn = {
  key: string;
  label: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

type DataTableProps<T> = {
  columns: DataTableColumn[];
  rows: T[];
  rowKey: (row: T) => string | number;
  renderRow: (row: T) => React.ReactNode[];
  gridTemplate?: string;
  emptyState?: React.ReactNode;
  className?: string;
  rowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  renderRow,
  gridTemplate,
  emptyState,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card/90", className)}>
      <div
        className="grid items-center border-b border-border/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              column.className,
              column.align === "right" && "text-right",
              column.align === "center" && "text-center"
            )}
          >
            {column.label}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="p-6">{emptyState}</div>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((row) => (
            <div
              key={rowKey(row)}
              className={cn(
                "grid items-center px-4 py-3 text-sm",
                onRowClick && "cursor-pointer",
                rowClassName?.(row)
              )}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {renderRow(row).map((cell, index) => (
                <div key={index} className={cn(columns[index]?.className)}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
