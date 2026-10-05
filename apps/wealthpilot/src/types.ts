import type { CardPaletteId } from "./cardPalettes";

export interface Transaction {
  id: string;
  batchId: string;
  date: string;
  account: string;
  amount: number;
  merchant: string;
  label: string;
  category: string;
  categoryId?: string;
  subcategoryId?: string;
  internal: boolean;
  fingerprint: string;
  raw: Record<string, string>;
  merchantName?: string;
  subcategory?: string;
  note?: string;
  reviewed?: boolean;
  importedState?: string;
}
export interface Account {
  id: string;
  bankAccountId?: string;
  checkpoint?: BalanceCheckpoint;
  checkpoints?: BalanceCheckpoint[];
  coverage?: AccountCoverage[];
}
export interface BalanceCheckpoint {
  date: string;
  amount: number;
  status?: "observed" | "derived";
  sourceHash?: string;
  batchId?: string;
  accepted?: boolean;
}
export interface AccountCoverage {
  from: string;
  through: string;
  sourceHash: string;
  batchId: string;
  complete: boolean;
}
export interface ImportAccountMetadata {
  account?: string;
  bankAccountId?: string;
  currency: string;
  coverageFrom?: string;
  coverageThrough?: string;
  checkpoints: BalanceCheckpoint[];
}
export interface ImportMetadata {
  profile: "sg" | "generic";
  reportedCount?: number;
  accounts: ImportAccountMetadata[];
  warnings: string[];
}
export interface Batch {
  id: string;
  name: string;
  hash: string;
  createdAt: string;
  count: number;
  minDate: string;
  maxDate: string;
  metadata?: ImportMetadata;
  transactionIds?: string[];
}
export interface Budget {
  categoryId?: string;
  account?: string;
  id: string;
  category: string;
  amount: number;
  month: string;
}
export interface Due {
  internal?: boolean;
  id: string;
  label: string;
  amount: number;
  date: string;
  account: string;
  transactionId?: string;
  estimated?: boolean;
  confidence?: number;
  recurrenceKey?: string;
  category?: string;
  recurrenceConfirmed?: boolean;
  originOccurrenceId?: string;
}
export interface CategoryRule {
  id: string;
  name: string;
  pattern: string;
  account?: string;
  direction: "all" | "expense" | "income";
  category: string;
  subcategory?: string;
  enabled: boolean;
  priority: number;
}
export interface CategoryDefinition {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  color?: string;
  archived?: boolean;
}
export interface RecurrenceRule {
  id: string;
  name: string;
  account: string;
  amount: number;
  category: string;
  frequency: "weekly" | "monthly";
  next: string;
  sourceKey?: string;
  paused?: boolean;
  end?: string;
}
export interface Goal {
  account?: string;
  priority?: number;
  icon?: string;
  color?: string;
  name: string;
  target: number;
  saved: number;
  monthly?: number;
  deadline?: string;
  description?: string;
  legacyId?: string;
}
export type WidgetId =
  | "chart"
  | "available"
  | "budgets"
  | "goal"
  | "dues"
  | "transactions"
  | "sources"
  | "balance"
  | "weekly"
  | "low"
  | "flows"
  | "purchase"
  | "scenario"
  | "goals"
  | "goalDate"
  | "effort"
  | "safety"
  | "accounts"
  | "charges"
  | "funding"
  | "paidBy"
  | "savings"
  | "uncategorized"
  | "recurring"
  | "categories"
  | "pace"
  | "unusual"
  | "comparison"
  | "configuration"
  | "library";
export type WidgetSize = "tiny" | "small" | "medium" | "large" | "xlarge";
export interface Preferences {
  /** Legacy backup field; ignored by the automatic income-based calendar. */
  cycleStartDay?: number;
  dockPages?: import("./navigation").DockPageId[];
  categoryDefinitions?: CategoryDefinition[];
  categoryRules?: CategoryRule[];
  householdPlan?: {
    members: Array<{ name: string; account: string; share: number }>;
  };
  recurrenceRules?: RecurrenceRule[];
  ignoredOccurrences?: string[];
  scenarios?: Array<{
    id: string;
    name: string;
    account: string;
    incomeDelay: number;
    expenseIncrease: number;
  }>;
  board?: import("./layout").BoardState;
  weeklyPlans?: Array<{
    start: string;
    account: string;
    limits: Record<string, number>;
    reduction: number;
    reserve: number;
  }>;
  widgetViews?: Partial<
    Record<WidgetId, import("./visualizationRegistry").VisualizationId>
  >;
  budgetOrder?: string[];
  budgetLimit?: number;
  id: "main";
  safety: number;
  essentials: number;
  weekly: number | null;
  goal: Goal | null;
  widgets: WidgetId[];
  budgetView: "list" | "rings";
  sizes?: Partial<Record<WidgetId, WidgetSize>>;
  extraGoals?: Goal[];
  dismissedRecurrences?: string[];
  setupDone?: boolean;
  tones?: Partial<Record<WidgetId, CardPaletteId>>;
}
export const widgetNames: Record<WidgetId, string> = {
  chart: "Évolution du solde",
  available: "Disponible à dépenser",
  budgets: "Vos budgets",
  goal: "Mon objectif",
  dues: "Échéances à venir",
  transactions: "Opérations",
  sources: "Source et fraîcheur",
  balance: "Solde du foyer",
  weekly: "Disponible cette semaine",
  low: "Point bas prévisionnel",
  flows: "Revenus et dépenses",
  purchase: "Puis-je dépenser ?",
  scenario: "Scénarios du mois",
  goals: "Tous mes objectifs",
  goalDate: "Date d’achat estimée",
  effort: "Effort d’épargne",
  safety: "Fonds de sécurité",
  accounts: "Santé des comptes",
  charges: "Charges du foyer",
  funding: "Compte à approvisionner",
  paidBy: "Dépenses par compte",
  savings: "Épargne des projets",
  uncategorized: "À catégoriser",
  recurring: "Récurrences détectées",
  categories: "Répartition des dépenses",
  pace: "Rythme de dépenses",
  unusual: "Dépenses inhabituelles",
  comparison: "Comparaison des mois",
  configuration: "Configurer les blocs",
  library: "Bibliothèque et tailles",
};
export const defaultPreferences: Preferences = {
  id: "main",
  safety: 0,
  essentials: 0,
  weekly: null,
  goal: null,
  widgets: ["chart", "available", "budgets", "dues", "transactions", "sources"],
  budgetView: "list",
};
export interface Snapshot {
  transactions: Transaction[];
  accounts: Account[];
  batches: Batch[];
  budgets: Budget[];
  dues: Due[];
  preferences: Preferences;
}
export const emptySnapshot: Snapshot = {
  transactions: [],
  accounts: [],
  batches: [],
  budgets: [],
  dues: [],
  preferences: defaultPreferences,
};
