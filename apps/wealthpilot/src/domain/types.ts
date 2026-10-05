// Persisted shapes of the WealthPilotNext_v1 database. Field names and
// meanings are frozen: existing browsers and JSON backups must keep loading.

export type Cents = number;
/** Calendar date `YYYY-MM-DD`, never a timestamp. */
export type IsoDate = string;

export interface Transaction {
  id: string;
  batchId: string;
  date: IsoDate;
  account: string;
  amount: Cents;
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
  /** Legacy manual check flag, kept for backups only. */
  reviewed?: boolean;
  /** JSON of the editable fields at import time; guards batch undo. */
  importedState?: string;
}

export interface BalanceCheckpoint {
  date: IsoDate;
  amount: Cents;
  status?: "observed" | "derived";
  sourceHash?: string;
  batchId?: string;
  accepted?: boolean;
}

export interface AccountCoverage {
  from: IsoDate;
  through: IsoDate;
  sourceHash: string;
  batchId: string;
  complete: boolean;
}

export interface Account {
  id: string;
  bankAccountId?: string;
  /** Legacy single anchor; still merged with `checkpoints` and wins date ties. */
  checkpoint?: BalanceCheckpoint;
  checkpoints?: BalanceCheckpoint[];
  coverage?: AccountCoverage[];
}

export interface ImportAccountMetadata {
  account?: string;
  bankAccountId?: string;
  currency: string;
  coverageFrom?: IsoDate;
  coverageThrough?: IsoDate;
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
  minDate: IsoDate;
  maxDate: IsoDate;
  metadata?: ImportMetadata;
  transactionIds?: string[];
}

export interface Budget {
  id: string;
  category: string;
  categoryId?: string;
  amount: Cents;
  /** Budget-month key `YYYY-MM` (income-anchored, see periods). */
  month: string;
  account?: string;
}

export interface Due {
  id: string;
  label: string;
  amount: Cents;
  date: IsoDate;
  account: string;
  internal?: boolean;
  transactionId?: string;
  estimated?: boolean;
  confidence?: number;
  recurrenceKey?: string;
  category?: string;
  recurrenceConfirmed?: boolean;
  /** Estimated occurrence this persisted due replaces. Unique across dues. */
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
  amount: Cents;
  category: string;
  frequency: "weekly" | "monthly";
  next: IsoDate;
  sourceKey?: string;
  paused?: boolean;
  end?: IsoDate;
}

/** Goals are retired from the UI; their saved amounts still count as reserved money. */
export interface Goal {
  name: string;
  target: Cents;
  saved: Cents;
  account?: string;
  priority?: number;
  icon?: string;
  color?: string;
  monthly?: Cents;
  deadline?: IsoDate;
  description?: string;
  legacyId?: string;
}

export interface WeeklyPlan {
  /** Monday of the week. */
  start: IsoDate;
  account: string;
  limits: Record<string, Cents>;
  reduction: number;
  reserve: Cents;
}

export const cardTypes = [
  "balance",
  "available",
  "week",
  "envelopes",
  "upcoming",
  "flows",
  "spending",
  "simulate",
  "recent",
  "inbox",
  "accounts",
] as const;
export type CardType = (typeof cardTypes)[number];
export type CardWidth = 3 | 4 | 6 | 8 | 12;

export const cardPaletteIds = [
  "paper",
  "ink",
  "yellow",
  "pink",
  "cyan",
  "coral",
  "lavender",
  "plum",
  "midnight",
  "sage",
  "forest",
  "sand",
] as const;
export type CardPaletteId = (typeof cardPaletteIds)[number];

export interface DashboardCard {
  id: string;
  type: CardType;
  width: CardWidth;
  palette?: CardPaletteId;
  /** Overrides the dock account; absent means "follow the dock". */
  account?: string;
  options?: Record<string, string | number | boolean>;
}

export interface DashboardLayout {
  version: 2;
  cards: DashboardCard[];
}

export interface Preferences {
  id: "main";
  safety: Cents;
  essentials: Cents;
  weekly: Cents | null;
  goal: Goal | null;
  widgets: string[];
  budgetView: "list" | "rings";

  // Read and written by v2.
  dashboard?: DashboardLayout;
  budgetOrder?: string[];
  weeklyPlans?: WeeklyPlan[];
  dismissedRecurrences?: string[];
  ignoredOccurrences?: string[];
  recurrenceRules?: RecurrenceRule[];
  categoryDefinitions?: CategoryDefinition[];
  categoryRules?: CategoryRule[];
  /** Display names for accounts; the account id itself is part of fingerprints. */
  accountAliases?: Record<string, string>;
  extraGoals?: Goal[];

  // Legacy fields: preserved verbatim, never interpreted by v2.
  board?: unknown;
  sizes?: unknown;
  tones?: unknown;
  widgetViews?: unknown;
  budgetLimit?: number;
  cycleStartDay?: number;
  householdPlan?: unknown;
  scenarios?: unknown;
  dockPages?: string[];
  setupDone?: boolean;
  [legacy: string]: unknown;
}

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

export const UNCATEGORIZED = "À catégoriser";
