// Owner: Transactions builder. Stub with the agreed props.
import type { ReactNode } from "react";
import type { Ledger } from "../../domain/ledger";

export interface CategoryMenuProps {
  ledger: Ledger;
  /** Current category name. */
  value: string;
  /** Up to 3 quick choices shown first (e.g. domain suggestCategories). */
  suggestions?: string[];
  onSelect(category: string, subcategory?: string): void;
  /** The element that opens the menu (rendered as-is, must be a button). */
  trigger: ReactNode;
  /** Expense or income categories first. */
  direction?: "expense" | "income";
}

export function CategoryMenu({ trigger }: CategoryMenuProps) {
  return <>{trigger}</>;
}
