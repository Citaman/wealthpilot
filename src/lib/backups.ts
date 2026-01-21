import { db } from "@/lib/db";

export type BackupFormatVersion = 1;
export type BackupStrategy = "snapshot";

export type BackupMetaV1 = {
  formatVersion: BackupFormatVersion;
  strategy: BackupStrategy;
  createdAt: string;
  appVersion?: string;
  schemaVersion?: number;
  userAgent?: string;
  timezone?: string;
};

export type BackupTablesV1 = {
  accounts: unknown[];
  transactions: unknown[];
  budgets: unknown[];
  goals: unknown[];
  goalContributions: unknown[];
  categoryRules: unknown[];
  recurringTransactions: unknown[];
  detectedSalaries: unknown[];
  settings: unknown[];
  merchantRules: unknown[];
  importRules: unknown[];
  customCategories: unknown[];
  balanceCheckpoints: unknown[];
};

export type BackupSnapshotV1 = {
  meta: BackupMetaV1;
  tables: BackupTablesV1;
};

export type BackupValidationIssue = {
  level: "error" | "warning";
  message: string;
  count?: number;
};

export type BackupPreview = {
  counts: Record<keyof BackupTablesV1, number>;
  transactionDateRange?: { from: string; to: string };
  accountsSummary: Array<{ id?: number; name?: string; currency?: string; balance?: number }>;
  issues: BackupValidationIssue[];
};

const REQUIRED_TABLE_KEYS: Array<keyof BackupTablesV1> = [
  "accounts",
  "transactions",
  "budgets",
  "goals",
  "goalContributions",
  "categoryRules",
  "recurringTransactions",
  "detectedSalaries",
  "settings",
  "merchantRules",
  "importRules",
  "customCategories",
  "balanceCheckpoints",
];

export function buildBackupFileName(prefix = "wealthpilot-backup", extension = "json") {
  const date = new Date().toISOString().split("T")[0];
  return `${prefix}-${date}.${extension}`;
}

export async function buildSnapshotV1(): Promise<BackupSnapshotV1> {
  const [
    accounts,
    transactions,
    budgets,
    goals,
    goalContributions,
    categoryRules,
    recurringTransactions,
    detectedSalaries,
    settings,
    merchantRules,
    importRules,
    customCategories,
    balanceCheckpoints,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.goalContributions.toArray(),
    db.categoryRules.toArray(),
    db.recurringTransactions.toArray(),
    db.detectedSalaries.toArray(),
    db.settings.toArray(),
    db.merchantRules.toArray(),
    db.importRules.toArray(),
    db.customCategories.toArray(),
    db.balanceCheckpoints.toArray(),
  ]);

  return {
    meta: {
      formatVersion: 1,
      strategy: "snapshot",
      createdAt: new Date().toISOString(),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
      schemaVersion: db.verno,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
    },
    tables: {
      accounts,
      transactions,
      budgets,
      goals,
      goalContributions,
      categoryRules,
      recurringTransactions,
      detectedSalaries,
      settings,
      merchantRules,
      importRules,
      customCategories,
      balanceCheckpoints,
    },
  };
}

export async function createBackupBlob(options?: { gzip?: boolean }) {
  const snapshot = await buildSnapshotV1();
  const json = JSON.stringify(snapshot, null, 2);
  const baseBlob = new Blob([json], { type: "application/json" });

  if (!options?.gzip) {
    return { blob: baseBlob, extension: "json" as const };
  }

  if (typeof CompressionStream === "undefined") {
    // Fallback to JSON if compression is not available.
    return { blob: baseBlob, extension: "json" as const, warning: "gzip-not-supported" as const };
  }

  const gzStream = baseBlob.stream().pipeThrough(new CompressionStream("gzip"));
  const gzBuffer = await new Response(gzStream).arrayBuffer();
  return {
    blob: new Blob([gzBuffer], { type: "application/gzip" }),
    extension: "json.gz" as const,
  };
}

export async function readBackupFileAsText(file: File): Promise<string> {
  const isGzip = file.name.endsWith(".gz");
  if (!isGzip) return await file.text();

  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser cannot open .gz backups. Export an uncompressed .json backup or try another browser."
    );
  }

  const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSnapshotV1(parsed: unknown): { ok: boolean; snapshot?: BackupSnapshotV1; preview: BackupPreview } {
  const issues: BackupValidationIssue[] = [];

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      preview: {
        counts: REQUIRED_TABLE_KEYS.reduce((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {} as BackupPreview["counts"]),
        accountsSummary: [],
        issues: [{ level: "error", message: "Backup file is not a JSON object." }],
      },
    };
  }

  const meta = parsed.meta;
  const tables = parsed.tables;

  if (!isPlainObject(meta)) issues.push({ level: "error", message: "Missing meta section." });
  if (!isPlainObject(tables)) issues.push({ level: "error", message: "Missing tables section." });

  const metaObj = isPlainObject(meta) ? meta : undefined;
  const tablesObj = isPlainObject(tables) ? tables : undefined;

  if (metaObj) {
    if (metaObj.formatVersion !== 1) {
      issues.push({ level: "error", message: `Unsupported backup formatVersion: ${String(metaObj.formatVersion)}` });
    }
    if (metaObj.strategy !== "snapshot") {
      issues.push({ level: "error", message: `Unsupported backup strategy: ${String(metaObj.strategy)}` });
    }
    if (typeof metaObj.createdAt !== "string") {
      issues.push({ level: "error", message: "meta.createdAt must be a string." });
    }
  }

  const counts = REQUIRED_TABLE_KEYS.reduce((acc, key) => {
    const raw = tablesObj?.[key];
    acc[key] = Array.isArray(raw) ? raw.length : 0;
    if (!Array.isArray(raw)) {
      issues.push({ level: "error", message: `tables.${key} must be an array.` });
    }
    return acc;
  }, {} as BackupPreview["counts"]);

  const accounts = (tablesObj?.accounts as unknown[]) || [];
  const transactions = (tablesObj?.transactions as unknown[]) || [];
  const goals = (tablesObj?.goals as unknown[]) || [];
  const goalContributions = (tablesObj?.goalContributions as unknown[]) || [];
  const balanceCheckpoints = (tablesObj?.balanceCheckpoints as unknown[]) || [];

  const accountIds = new Set<number>();
  for (const a of accounts) {
    if (!isPlainObject(a) || typeof a.id !== "number") {
      issues.push({ level: "error", message: "All accounts must have a numeric id.", count: 1 });
      continue;
    }
    accountIds.add(a.id);
  }

  const invalidTx = { missingFields: 0, badAccountRef: 0 };
  const txDates: string[] = [];

  for (const t of transactions) {
    if (!isPlainObject(t)) {
      invalidTx.missingFields += 1;
      continue;
    }

    const date = t.date;
    const amount = t.amount;
    const accountId = t.accountId;

    if (typeof date !== "string" || typeof amount !== "number" || typeof accountId !== "number") {
      invalidTx.missingFields += 1;
      continue;
    }

    txDates.push(date);

    if (!accountIds.has(accountId)) {
      invalidTx.badAccountRef += 1;
    }
  }

  if (invalidTx.missingFields > 0) {
    issues.push({
      level: "error",
      message: "Some transactions are missing required fields (date, amount, accountId).",
      count: invalidTx.missingFields,
    });
  }

  if (invalidTx.badAccountRef > 0) {
    issues.push({
      level: "error",
      message: "Some transactions reference an accountId not present in accounts.",
      count: invalidTx.badAccountRef,
    });
  }

  const goalIds = new Set<number>();
  for (const g of goals) {
    if (isPlainObject(g) && typeof g.id === "number") goalIds.add(g.id);
  }

  let badGoalRef = 0;
  for (const c of goalContributions) {
    if (!isPlainObject(c) || typeof c.goalId !== "number") continue;
    if (!goalIds.has(c.goalId)) badGoalRef += 1;
  }
  if (badGoalRef > 0) {
    issues.push({
      level: "error",
      message: "Some goal contributions reference a goalId not present in goals.",
      count: badGoalRef,
    });
  }

  let badCheckpointRef = 0;
  for (const cp of balanceCheckpoints) {
    if (!isPlainObject(cp) || typeof cp.accountId !== "number") continue;
    if (!accountIds.has(cp.accountId)) badCheckpointRef += 1;
  }
  if (badCheckpointRef > 0) {
    issues.push({
      level: "error",
      message: "Some balance checkpoints reference an accountId not present in accounts.",
      count: badCheckpointRef,
    });
  }

  // Warnings
  if (counts.accounts === 0) issues.push({ level: "warning", message: "Backup contains 0 accounts." });
  if (counts.transactions === 0) issues.push({ level: "warning", message: "Backup contains 0 transactions." });

  const dateRange = txDates.length
    ? {
        from: txDates.reduce((a, b) => (a < b ? a : b)),
        to: txDates.reduce((a, b) => (a > b ? a : b)),
      }
    : undefined;

  const accountsSummary = accounts
    .filter(isPlainObject)
    .slice(0, 5)
    .map((a) => ({
      id: typeof a.id === "number" ? a.id : undefined,
      name: typeof a.name === "string" ? a.name : undefined,
      currency: typeof a.currency === "string" ? a.currency : undefined,
      balance: typeof a.balance === "number" ? a.balance : undefined,
    }));

  const ok = !issues.some((i) => i.level === "error");
  const snapshot = ok ? (parsed as BackupSnapshotV1) : undefined;

  return {
    ok,
    snapshot,
    preview: {
      counts,
      transactionDateRange: dateRange,
      accountsSummary,
      issues,
    },
  };
}

export async function restoreReplaceSnapshotV1(snapshot: BackupSnapshotV1) {
  // One atomic IndexedDB transaction: clear then repopulate.
  const tables = [
    db.accounts,
    db.transactions,
    db.budgets,
    db.goals,
    db.goalContributions,
    db.categoryRules,
    db.recurringTransactions,
    db.detectedSalaries,
    db.settings,
    db.merchantRules,
    db.importRules,
    db.customCategories,
    db.balanceCheckpoints,
  ];

  await (db as any).transaction(
    "rw",
    ...tables,
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.budgets.clear(),
        db.goals.clear(),
        db.goalContributions.clear(),
        db.categoryRules.clear(),
        db.recurringTransactions.clear(),
        db.detectedSalaries.clear(),
        db.settings.clear(),
        db.merchantRules.clear(),
        db.importRules.clear(),
        db.customCategories.clear(),
        db.balanceCheckpoints.clear(),
      ]);

      const t = snapshot.tables;

      if (t.accounts.length) await db.accounts.bulkAdd(t.accounts as any[]);
      if (t.transactions.length) await db.transactions.bulkAdd(t.transactions as any[]);
      if (t.budgets.length) await db.budgets.bulkAdd(t.budgets as any[]);
      if (t.goals.length) await db.goals.bulkAdd(t.goals as any[]);
      if (t.goalContributions.length) await db.goalContributions.bulkAdd(t.goalContributions as any[]);
      if (t.categoryRules.length) await db.categoryRules.bulkAdd(t.categoryRules as any[]);
      if (t.recurringTransactions.length) await db.recurringTransactions.bulkAdd(t.recurringTransactions as any[]);
      if (t.detectedSalaries.length) await db.detectedSalaries.bulkAdd(t.detectedSalaries as any[]);
      if (t.settings.length) await db.settings.bulkAdd(t.settings as any[]);
      if (t.merchantRules.length) await db.merchantRules.bulkAdd(t.merchantRules as any[]);
      if (t.importRules.length) await db.importRules.bulkAdd(t.importRules as any[]);
      if (t.customCategories.length) await db.customCategories.bulkAdd(t.customCategories as any[]);
      if (t.balanceCheckpoints.length) await db.balanceCheckpoints.bulkAdd(t.balanceCheckpoints as any[]);
    }
  );
}

export async function setStringSetting(key: string, value: string) {
  const existing = await db.settings.where("key").equals(key).first();
  if (existing?.id) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

export async function getStringSetting(key: string): Promise<string | null> {
  const existing = await db.settings.where("key").equals(key).first();
  if (!existing) return null;
  return typeof existing.value === "string" ? existing.value : null;
}

export async function clearAllUserData() {
  const tables = [
    db.accounts,
    db.transactions,
    db.budgets,
    db.goals,
    db.goalContributions,
    db.categoryRules,
    db.recurringTransactions,
    db.detectedSalaries,
    db.settings,
    db.merchantRules,
    db.importRules,
    db.customCategories,
    db.balanceCheckpoints,
  ];

  await (db as any).transaction(
    "rw",
    ...tables,
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.budgets.clear(),
        db.goals.clear(),
        db.goalContributions.clear(),
        db.categoryRules.clear(),
        db.recurringTransactions.clear(),
        db.detectedSalaries.clear(),
        db.settings.clear(),
        db.merchantRules.clear(),
        db.importRules.clear(),
        db.customCategories.clear(),
        db.balanceCheckpoints.clear(),
      ]);
    }
  );
}
