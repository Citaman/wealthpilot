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
  const activateRow = (event: React.KeyboardEvent, row: T) => {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick(row);
  };

  return (
    <div className={cn("w-full overflow-x-auto rounded-[var(--radius-surface)] border bg-card shadow-sm", className)} role="region" aria-label="Tableau de données" tabIndex={0}>
      <div className="min-w-max" role="table" aria-rowcount={rows.length + 1} aria-colcount={columns.length}>
        <div className="grid min-h-11 items-center bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground" style={{ gridTemplateColumns: gridTemplate }} role="row">
          {columns.map((column) => (
            <div key={column.key} role="columnheader" className={cn(column.className, column.align === "right" && "text-right", column.align === "center" && "text-center")}>
              {column.label || <span className="sr-only">Actions</span>}
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="p-6" role="row"><div role="cell">{emptyState}</div></div>
        ) : (
          <div className="divide-y">
            {rows.map((row, rowIndex) => (
              <div
                key={rowKey(row)}
                role="row"
                aria-rowindex={rowIndex + 2}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("grid min-h-14 items-center px-4 py-3 text-sm transition-colors hover:bg-muted/70 focus-visible:bg-accent", onRowClick && "cursor-pointer", rowClassName?.(row))}
                style={{ gridTemplateColumns: gridTemplate }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={(event) => activateRow(event, row)}
              >
                {renderRow(row).map((cell, index) => (
                  <div key={columns[index]?.key || index} role="cell" className={cn(columns[index]?.className)}>{cell}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
