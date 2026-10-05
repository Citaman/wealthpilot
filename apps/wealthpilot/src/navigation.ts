// Historical values remain accepted in backups, but are not active routes.
export const dockPageIds = [
  "dashboard",
  "week",
  "transactions",
  "budgets",
  "previsions",
  "goals",
  "accounts",
  "analytics",
  "foyer",
  "recurrents",
  "calendar",
  "categories",
  "library",
  "import",
  "data",
  "references",
] as const;
export type DockPageId = (typeof dockPageIds)[number];
export const activePageIds = [
  "dashboard",
  "week",
  "transactions",
  "import",
] as const;
export type ActivePageId = (typeof activePageIds)[number];
export const isActivePage = (value: string): value is ActivePageId =>
  activePageIds.some((page) => page === value);
export function resolveActiveRoute(hash: string): ActivePageId | "unavailable" {
  const page = hash.replace(/^#/, "");
  // A section anchor inside Ma semaine, not an additional destination.
  if (page === "week-calculation") return "week";
  return !page ? "dashboard" : isActivePage(page) ? page : "unavailable";
}
export interface TransactionSelection {
  transactionId?: string;
  transactionIds?: string[];
  review?: "uncategorized" | "unreviewed";
  category?: string;
}
export interface TransactionDrilldown extends TransactionSelection {
  range?: import("./periods").DateRange;
  account: string;
  from: string;
  month: string;
}
export const defaultDockPages: readonly ActivePageId[] = activePageIds;
export const pageLabels: Record<DockPageId, string> = {
  dashboard: "Dashboard",
  week: "Ma semaine",
  transactions: "Transactions",
  budgets: "Budgets",
  previsions: "Prévisions",
  goals: "Objectifs",
  accounts: "Comptes",
  analytics: "Analyse",
  foyer: "Foyer et partage",
  recurrents: "Récurrents",
  calendar: "Calendrier",
  categories: "Catégories et règles",
  library: "Bibliothèque",
  import: "Import CSV",
  data: "Données",
  references: "Références",
};
