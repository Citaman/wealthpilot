import Papa from "papaparse";
import { isIsoDate, weekday } from "../domain/dates";
import type {
  Account,
  AccountCoverage,
  BalanceCheckpoint,
  Batch,
  Budget,
  CategoryDefinition,
  Due,
  ImportMetadata,
  Preferences,
  Snapshot,
  Transaction,
} from "../domain/types";
import { db, readSnapshot, withDefaults } from "./db";
import { fingerprint } from "./importer/preview";

export class BackupError extends Error {
  name = "BackupError";
}

export async function exportBackup(): Promise<string> {
  return JSON.stringify(
    { format: "wealthpilot-next", version: 1, data: await readSnapshot() },
    null,
    2,
  );
}

function check(ok: unknown, what: string): asserts ok {
  if (!ok)
    throw new BackupError(`Sauvegarde invalide ou incompatible : ${what}.`);
}

type Test = (x: any) => unknown;
const text = (x: unknown): x is string =>
  typeof x === "string" && x.length < 20000;
const filled = (x: unknown) => text(x) && x.trim().length > 0;
const money = (x: unknown): x is number =>
  Number.isSafeInteger(x) && Math.abs(x as number) <= 1e12;
const positive = (x: unknown) => money(x) && x >= 0;
const bool = (x: unknown) => typeof x === "boolean";
const record = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const opt = (test: Test) => (x: unknown) => x === undefined || test(x);
const list =
  (test: Test, max = 100_000) =>
  (x: unknown) =>
    Array.isArray(x) && x.length <= max && x.every(test);
const distinct = (values: unknown[]) => new Set(values).size === values.length;
const oneOf =
  (...values: unknown[]) =>
  (x: unknown) =>
    values.includes(x);

function each<T>(items: T[], valid: (item: T) => unknown, what: string) {
  const bad = items.find((item) => !valid(item));
  const id = record(bad) && text(bad.id) ? ` « ${bad.id} »` : "";
  check(bad === undefined, what + id);
}

function validateTables(s: Snapshot) {
  for (const key of [
    "accounts",
    "transactions",
    "batches",
    "budgets",
    "dues",
  ] as const) {
    check(Array.isArray(s[key]) && s[key].length <= 100_000, key);
    each(
      s[key] as unknown[],
      (x) => record(x) && filled(x.id),
      `identifiant dans ${key}`,
    );
    check(
      distinct(s[key].map((x) => x.id)),
      `identifiants en double dans ${key}`,
    );
  }
  const accountIds = new Set(s.accounts.map((a) => a.id));
  const batchIds = new Set(s.batches.map((b) => b.id));
  const transactions = new Map(s.transactions.map((t) => [t.id, t]));
  const account = (x: unknown) => accountIds.has(x as string);

  const checkpoint = (c: BalanceCheckpoint) =>
    record(c) &&
    isIsoDate(c.date) &&
    money(c.amount) &&
    opt(oneOf("observed", "derived"))(c.status) &&
    opt(text)(c.sourceHash) &&
    opt((id) => batchIds.has(id))(c.batchId) &&
    opt(bool)(c.accepted);
  const coverage = (c: AccountCoverage) =>
    record(c) &&
    isIsoDate(c.from) &&
    isIsoDate(c.through) &&
    c.from <= c.through &&
    text(c.sourceHash) &&
    batchIds.has(c.batchId) &&
    bool(c.complete);
  each(
    s.accounts,
    (a: Account) =>
      opt((x) => text(x) && /^\d{5,34}$/.test(x))(a.bankAccountId) &&
      opt(checkpoint)(a.checkpoint) &&
      opt(list(checkpoint))(a.checkpoints) &&
      opt(list(coverage, 10_000))(a.coverage),
    "compte",
  );
  const bankIds = s.accounts.flatMap((a) =>
    a.bankAccountId ? [a.bankAccountId] : [],
  );
  check(distinct(bankIds), "identifiant bancaire partagé par deux comptes");

  const metadata = (m: ImportMetadata) =>
    record(m) &&
    oneOf("sg", "generic")(m.profile) &&
    list(text)(m.warnings) &&
    opt((n) => Number.isInteger(n) && n >= 0 && n <= 50_000)(m.reportedCount) &&
    list(
      (a) =>
        record(a) &&
        a.currency === "EUR" &&
        opt(text)(a.account) &&
        opt(text)(a.bankAccountId) &&
        list(checkpoint)(a.checkpoints) &&
        opt(isIsoDate)(a.coverageFrom) &&
        opt(isIsoDate)(a.coverageThrough),
      1000,
    )(m.accounts);
  each(
    s.batches,
    (b: Batch) =>
      text(b.hash) &&
      text(b.name) &&
      text(b.createdAt) &&
      Number.isFinite(Date.parse(b.createdAt)) &&
      isIsoDate(b.minDate) &&
      isIsoDate(b.maxDate) &&
      b.minDate <= b.maxDate &&
      Number.isInteger(b.count) &&
      b.count >= 0 &&
      opt(metadata)(b.metadata) &&
      opt((ids) => list((id) => transactions.has(id))(ids) && distinct(ids))(
        b.transactionIds,
      ),
    "lot d’import",
  );
  check(
    distinct(s.batches.map((b) => b.hash)),
    "même fichier importé deux fois",
  );

  each(
    s.transactions,
    (t: Transaction) =>
      isIsoDate(t.date) &&
      money(t.amount) &&
      text(t.label) &&
      text(t.merchant) &&
      text(t.category) &&
      [t.merchantName, t.subcategory, t.note, t.importedState].every(
        opt(text),
      ) &&
      opt(bool)(t.reviewed) &&
      bool(t.internal) &&
      account(t.account) &&
      batchIds.has(t.batchId) &&
      record(t.raw) &&
      Object.values(t.raw).every(text) &&
      t.fingerprint === fingerprint(t),
    "opération",
  );

  each(
    s.budgets,
    (b: Budget) =>
      /^\d{4}-\d{2}$/.test(b.month) &&
      isIsoDate(b.month + "-01") &&
      text(b.category) &&
      positive(b.amount) &&
      opt(account)(b.account),
    "enveloppe",
  );
  check(
    distinct(
      s.budgets.map((b) =>
        JSON.stringify([b.month, b.category, b.account ?? ""]),
      ),
    ),
    "deux enveloppes pour la même catégorie et le même mois",
  );

  each(
    s.dues,
    (d: Due) =>
      text(d.label) &&
      money(d.amount) &&
      isIsoDate(d.date) &&
      account(d.account) &&
      [d.category, d.originOccurrenceId, d.recurrenceKey].every(opt(text)) &&
      [d.internal, d.recurrenceConfirmed, d.estimated].every(opt(bool)) &&
      opt((c) => Number.isFinite(c) && c >= 0 && c <= 100)(d.confidence) &&
      (!d.transactionId ||
        (transactions.get(d.transactionId)?.account === d.account &&
          Math.sign(transactions.get(d.transactionId)!.amount) ===
            Math.sign(d.amount))),
    "échéance",
  );
  const reconciled = s.dues.flatMap((d) =>
    d.transactionId ? [d.transactionId] : [],
  );
  check(distinct(reconciled), "opération rapprochée de deux échéances");
  return account;
}

// Only fields v2 interprets are validated; legacy fields (board, widgets, tones,
// goal, householdPlan…) are restored verbatim and never block a restore.
function validatePreferences(
  s: Snapshot,
  account: (x: unknown) => boolean,
): Preferences {
  check(record(s.preferences) && s.preferences.id === "main", "préférences");
  const p = withDefaults(s.preferences);
  check(positive(p.safety), "réserve de sécurité");
  check(
    [p.budgetOrder, p.dismissedRecurrences, p.ignoredOccurrences].every(
      opt(list(text)),
    ),
    "listes de préférences",
  );
  check(
    opt((x) => record(x) && Object.values(x).every(text))(p.accountAliases),
    "noms de comptes",
  );
  check(
    opt((x) => record(x) && Array.isArray(x.cards))(p.dashboard),
    "disposition du dashboard",
  );
  check(
    opt(
      list(
        (w) =>
          record(w) &&
          isIsoDate(w.start) &&
          weekday(w.start) === 0 &&
          (w.account === "" || account(w.account)) &&
          Number.isFinite(w.reduction) &&
          w.reduction >= 0 &&
          w.reduction <= 100 &&
          positive(w.reserve) &&
          record(w.limits) &&
          Object.entries(w.limits).every(([k, v]) => filled(k) && positive(v)),
      ),
    )(p.weeklyPlans) &&
      distinct(
        (p.weeklyPlans ?? []).map((w) => JSON.stringify([w.start, w.account])),
      ),
    "plans de la semaine",
  );
  check(
    opt(
      list(
        (r) =>
          record(r) &&
          filled(r.id) &&
          filled(r.name) &&
          account(r.account) &&
          money(r.amount) &&
          r.amount !== 0 &&
          text(r.category) &&
          oneOf("monthly", "weekly")(r.frequency) &&
          isIsoDate(r.next) &&
          opt(text)(r.sourceKey) &&
          opt(bool)(r.paused) &&
          opt((end) => isIsoDate(end) && end >= r.next)(r.end),
      ),
    )(p.recurrenceRules) &&
      distinct((p.recurrenceRules ?? []).map((r) => r.id)),
    "récurrences confirmées",
  );
  check(
    opt(
      list(
        (r) =>
          record(r) &&
          filled(r.id) &&
          filled(r.name) &&
          text(r.pattern) &&
          r.pattern.trim().length >= 2 &&
          opt(account)(r.account) &&
          oneOf("all", "expense", "income")(r.direction) &&
          filled(r.category) &&
          opt(text)(r.subcategory) &&
          bool(r.enabled) &&
          Number.isInteger(r.priority),
      ),
    )(p.categoryRules) && distinct((p.categoryRules ?? []).map((r) => r.id)),
    "règles de catégorie",
  );
  validateCategories(s, p.categoryDefinitions);
  return p;
}

function validateCategories(s: Snapshot, definitions: unknown) {
  check(
    opt(
      list(
        (d: CategoryDefinition) =>
          record(d) &&
          filled(d.id) &&
          filled(d.name) &&
          opt(text)(d.parentId) &&
          opt(text)(d.icon) &&
          opt((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))(
            d.color,
          ) &&
          opt(bool)(d.archived),
      ),
    )(definitions),
    "catégories",
  );
  const all = (definitions ?? []) as CategoryDefinition[];
  const byId = new Map(all.map((d) => [d.id, d]));
  const root = (id: unknown) =>
    typeof id === "string" &&
    byId.has(id) &&
    byId.get(id)!.parentId === undefined;
  check(distinct(all.map((d) => d.id)), "identifiants de catégorie en double");
  each(
    all,
    (d) =>
      d.parentId === undefined || (d.parentId !== d.id && root(d.parentId)),
    "catégorie parente",
  );
  check(
    distinct(
      all.map((d) =>
        JSON.stringify([
          d.parentId ?? "",
          d.name.trim().toLocaleLowerCase("fr"),
        ]),
      ),
    ),
    "catégories en double",
  );
  each(
    s.transactions,
    (t) =>
      opt(root)(t.categoryId) &&
      (t.subcategoryId === undefined ||
        (t.categoryId !== undefined &&
          byId.get(t.subcategoryId)?.parentId === t.categoryId)),
    "catégorie d’opération",
  );
  each(s.budgets, (b) => opt(root)(b.categoryId), "catégorie d’enveloppe");
}

export function validateBackup(value: unknown): Snapshot {
  check(
    record(value) &&
      value.format === "wealthpilot-next" &&
      value.version === 1 &&
      record(value.data),
    "format",
  );
  const s = value.data as Snapshot;
  const account = validateTables(s);
  return { ...s, preferences: validatePreferences(s, account) };
}

export function parseBackup(json: string): Snapshot {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new BackupError("Ce fichier n’est pas une sauvegarde JSON lisible.");
  }
  return validateBackup(value);
}

/** Replaces every table atomically; the caller downloads a safety backup first. */
export function restoreBackup(s: Snapshot): Promise<void> {
  return db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.accounts.bulkAdd(s.accounts);
    await db.batches.bulkAdd(s.batches);
    await db.transactions.bulkAdd(s.transactions);
    await db.budgets.bulkAdd(s.budgets);
    await db.dues.bulkAdd(s.dues);
    await db.preferences.put(s.preferences);
  });
}

export function backupInventory(s: Snapshot) {
  const dates = s.transactions.map((t) => t.date).sort();
  return {
    transactions: s.transactions.length,
    accounts: s.accounts.length,
    batches: s.batches.length,
    budgets: s.budgets.length,
    dues: s.dues.length,
    from: dates[0] as string | undefined,
    through: dates.at(-1),
  };
}

// Spreadsheet formula injection: a leading = + - @ tab or CR is neutralised.
const safe = (value: string) =>
  /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
const frenchAmount = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

/** `;`-separated UTF-8 CSV with BOM, re-importable as-is (account ids are kept). */
export function exportTransactionsCsv(
  rows: Transaction[],
  aliases?: Record<string, string>,
): string {
  const csv = Papa.unparse(
    rows.map((t) => ({
      date: t.date,
      account: safe(t.account),
      ...(aliases
        ? { account_name: safe(aliases[t.account] ?? t.account) }
        : {}),
      amount: frenchAmount(t.amount),
      merchant: safe(t.merchant),
      merchant_name: safe(t.merchantName ?? ""),
      subcategory: safe(t.subcategory ?? ""),
      note: safe(t.note ?? ""),
      reviewed: t.reviewed ? "Y" : "N",
      libelle: safe(t.label),
      category: safe(t.category),
      is_internal: t.internal ? "Y" : "N",
      currency: "EUR",
    })),
    { delimiter: ";", newline: "\r\n" },
  );
  return "\uFEFF" + csv;
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
