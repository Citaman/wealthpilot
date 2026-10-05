import { parseDate } from "../../domain/dates";
import { parseMoney } from "../../domain/money";
import {
  UNCATEGORIZED,
  type Account,
  type Cents,
  type ImportAccountMetadata,
  type ImportMetadata,
  type IsoDate,
  type Snapshot,
  type Transaction,
} from "../../domain/types";
import { balanceAt } from "../../domain/balances";
import {
  destination,
  fileAccounts,
  mappingIssues,
  metadataAccountId,
  normal,
  type AccountChoice,
  type Field,
  type Mapping,
} from "./mapping";
import type { ParsedFile } from "./parse";

export type ImportedTransaction = Omit<Transaction, "id" | "batchId">;

// Frozen formula: stored fingerprints and backups are validated against it.
// The account is lowercased, so "Courant" and "courant" collide; kept for compatibility.
export function fingerprint(
  t: Pick<Transaction, "account" | "date" | "amount" | "label">,
) {
  return JSON.stringify([
    t.account.trim().toLocaleLowerCase(),
    t.date,
    t.amount,
    t.label.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
  ]);
}

/** Duplicate identity: SG's full banking detail replaces the short label when present. */
export function importIdentity(
  t: Pick<Transaction, "account" | "date" | "amount" | "label" | "raw">,
) {
  const detail = Object.entries(t.raw ?? {}).find(([k]) =>
    ["detail", "detaildelecriture"].includes(normal(k)),
  )?.[1];
  return fingerprint({ ...t, label: detail || t.label });
}

/** Frozen format of `importedState`; batch undo compares it with the current row. */
export function transactionState(t: ImportedTransaction): string {
  return JSON.stringify([
    t.date,
    t.account,
    t.amount,
    t.label,
    t.merchant,
    t.category,
    t.internal,
    t.merchantName,
    t.subcategory,
    t.note,
    t.reviewed,
    ...(t.categoryId !== undefined || t.subcategoryId !== undefined
      ? [t.categoryId, t.subcategoryId]
      : []),
  ]);
}

/** Changes whenever duplicate detection or balance decisions could differ. */
export function previewToken(transactions: Transaction[], accounts: Account[]) {
  return JSON.stringify([
    transactions.map(importIdentity).sort(),
    [...accounts].sort((a, b) => a.id.localeCompare(b.id)),
  ]);
}

export interface PreviewRow {
  /** Line number in the source file. */
  index: number;
  status: "new" | "duplicate" | "invalid";
  reason?: string;
  tx?: ImportedTransaction;
  /** Existing transaction matched by a duplicate row. */
  existingId?: string;
}

export interface PreviewCheckpoint {
  account: string;
  /** Latest balance of the file for this account. */
  date: IsoDate;
  amount: Cents;
  status: "observed" | "derived";
  /** Observed minus the balance currently computed for that date. */
  delta?: Cents;
  coverageFrom?: IsoDate;
  coverageThrough?: IsoDate;
}

export interface Preview {
  file: Pick<ParsedFile, "name" | "hash" | "profile">;
  rows: PreviewRow[];
  counts: Record<PreviewRow["status"], number>;
  metadata: ImportMetadata;
  checkpoints: PreviewCheckpoint[];
  newAccounts: string[];
  /** Blocking problems: nothing can be committed while this is not empty. */
  errors: string[];
  token: string;
}

export type ImportTables = Pick<Snapshot, "transactions" | "accounts">;

const yes = (s: string) => ["y", "yes", "oui", "true", "1"].includes(normal(s));
const expense = ["expense", "debit", "depense", "out", "sortie", "d"];
const income = ["income", "credit", "revenu", "in", "entree", "c"];

function readRow(
  raw: Record<string, string>,
  m: Mapping,
  choice: AccountChoice,
) {
  const get = (field: Field) => raw[m[field]]?.trim() ?? "";
  const extra = (keys: string[]) =>
    Object.entries(raw).find(([k]) => keys.includes(normal(k)))?.[1] ?? "";
  const date = parseDate(get("date"));
  const label = get("label") || get("merchant");
  const account = destination(choice, get("account"));
  const direction = normal(get("direction"));
  let amount: Cents | null = null;
  if (m.amount) {
    amount = parseMoney(get("amount"));
    if (amount !== null && direction) {
      if (expense.includes(direction)) amount = -Math.abs(amount);
      else if (income.includes(direction)) amount = Math.abs(amount);
      else return { error: "Sens inconnu : vérifier la colonne sens." };
    }
  } else {
    const debit = get("debit") ? parseMoney(get("debit")) : 0;
    const credit = get("credit") ? parseMoney(get("credit")) : 0;
    if (
      debit !== null &&
      credit !== null &&
      !(debit && credit) &&
      (get("debit") || get("credit"))
    )
      amount = Math.abs(credit) - Math.abs(debit);
  }
  const currency = get("currency").toUpperCase();
  const error = !date
    ? "Date invalide (JJ/MM/AAAA ou AAAA-MM-JJ)."
    : amount === null
      ? "Montant invalide ou débit et crédit simultanés."
      : !label
        ? "Libellé manquant."
        : !account
          ? "Compte manquant."
          : currency && currency !== "EUR"
            ? "Seuls les comptes EUR sont pris en charge."
            : null;
  if (error) return { error };
  const hasSubcategory = Object.keys(raw).some((k) =>
    ["subcategory", "souscategorie"].includes(normal(k)),
  );
  const t: ImportedTransaction = {
    date: date!,
    amount: amount!,
    label,
    account,
    merchant: get("merchant") || label,
    merchantName: extra(["merchantname", "nomaffiche"]) || undefined,
    subcategory: hasSubcategory
      ? extra(["subcategory", "souscategorie"])
      : undefined,
    note: extra(["note", "notepersonnelle"]) || undefined,
    reviewed: yes(extra(["reviewed", "verifiee"])),
    category: get("category") || UNCATEGORIZED,
    internal: yes(get("internal")),
    raw,
    fingerprint: "",
  };
  t.fingerprint = fingerprint(t);
  return { t };
}

/** daily_balance columns are reconstructions: never promoted to observed balances. */
function derivedBalances(
  file: ParsedFile,
  m: Mapping,
  choice: AccountChoice,
  errors: string[],
) {
  const entries = new Map<string, ImportAccountMetadata>();
  for (const raw of file.rows) {
    if (!raw[m.balance]?.trim()) continue;
    const date = parseDate(raw[m.date] ?? "");
    const amount = parseMoney(raw[m.balance]);
    if ((raw[m.currency]?.trim().toUpperCase() || "EUR") !== "EUR") {
      errors.push(
        "Les soldes journaliers en devise autre que l’euro ne sont pas pris en charge.",
      );
      continue;
    }
    if (!date || amount === null) {
      errors.push("Solde journalier dérivé invalide.");
      continue;
    }
    const account = destination(choice, raw[m.account]?.trim() ?? "");
    const entry = entries.get(account) ?? {
      account,
      currency: "EUR",
      checkpoints: [],
    };
    entries.set(account, entry);
    const previous = entry.checkpoints.find((c) => c.date === date);
    if (previous && previous.amount !== amount)
      errors.push(
        "Soldes journaliers contradictoires pour le même compte et jour.",
      );
    else if (!previous)
      entry.checkpoints.push({ date, amount, status: "derived" });
  }
  return [...entries.values()];
}

function importMetadata(
  file: ParsedFile,
  m: Mapping,
  choice: AccountChoice,
  accounts: Account[],
  errors: string[],
): ImportMetadata {
  if (file.metadata)
    return {
      ...file.metadata,
      accounts: file.metadata.accounts.map((entry) => ({
        ...entry,
        account: metadataAccountId(entry, destination(choice, ""), accounts),
      })),
    };
  if (!m.balance) return { profile: "generic", accounts: [], warnings: [] };
  return {
    profile: "generic",
    accounts: derivedBalances(file, m, choice, errors),
    warnings: [
      "Les daily_balance sont des reconstructions : ils ne deviennent pas automatiquement des soldes bancaires observés.",
    ],
  };
}

/** Problems with the destination accounts chosen for the file's source accounts. */
export function accountChoiceIssues(
  file: ParsedFile,
  m: Mapping,
  choice: AccountChoice,
  accounts: Account[],
): string[] {
  const sources = fileAccounts(file, m);
  if (!m.account || file.rows.some((r) => !r[m.account]?.trim()))
    sources.push("");
  const targets = sources.map((s) => destination(choice, s));
  const bankId = file.metadata?.accounts[0]?.bankAccountId;
  const identified = bankId && accounts.find((a) => a.bankAccountId === bankId);
  const issues: string[] = [];
  for (const target of targets) {
    const existing = accounts.find((a) => a.id === target);
    if (!target || target.length > 100)
      issues.push("Donnez un nom de compte entre 1 et 100 caractères.");
    else if (
      !existing &&
      accounts.some(
        (a) => a.id.toLocaleLowerCase() === target.toLocaleLowerCase(),
      )
    )
      issues.push(
        `Le compte « ${target} » existe déjà sous une autre casse : choisissez-le dans la liste.`,
      );
    else if (identified && target !== identified.id)
      issues.push(
        `Ce relevé appartient au compte « ${identified.id} », reconnu par son numéro.`,
      );
    else if (
      bankId &&
      existing?.bankAccountId &&
      existing.bankAccountId !== bankId
    )
      issues.push(
        "Ce compte est lié à un autre identifiant bancaire. Choisissez un autre compte.",
      );
  }
  if (new Set(targets).size !== targets.length)
    issues.push(
      "Conservez les comptes distincts de ce fichier pour ne pas mélanger leurs opérations.",
    );
  return [...new Set(issues)];
}

function latestCheckpoints(
  metadata: ImportMetadata,
  tables: ImportTables,
): PreviewCheckpoint[] {
  return metadata.accounts.flatMap((entry) => {
    const latest = entry.checkpoints.toSorted((a, b) =>
      b.date.localeCompare(a.date),
    )[0];
    if (!latest) return [];
    const account = tables.accounts.find((a) => a.id === entry.account);
    const computed = account
      ? balanceAt(account, tables.transactions, latest.date)
      : null;
    return [
      {
        account: entry.account!,
        date: latest.date,
        amount: latest.amount,
        status: latest.status === "derived" ? "derived" : "observed",
        ...(computed === null ? {} : { delta: latest.amount - computed }),
        coverageFrom: entry.coverageFrom,
        coverageThrough: entry.coverageThrough,
      } satisfies PreviewCheckpoint,
    ];
  });
}

export function buildPreview(
  file: ParsedFile,
  m: Mapping,
  choice: AccountChoice,
  tables: ImportTables,
): Preview {
  const errors = [
    ...file.errors,
    ...mappingIssues(m),
    ...accountChoiceIssues(file, m, choice, tables.accounts),
  ];
  const existing = new Map<string, Transaction[]>();
  for (const t of tables.transactions) {
    const key = importIdentity(t);
    existing.set(key, [...(existing.get(key) ?? []), t]);
  }
  const rows = file.rows.map((raw, i): PreviewRow => {
    const index = i + file.firstDataRow;
    const { t, error } = readRow(raw, m, choice);
    if (!t) return { index, status: "invalid", reason: error };
    const match = existing.get(importIdentity(t))?.pop();
    return match
      ? { index, status: "duplicate", tx: t, existingId: match.id }
      : { index, status: "new", tx: t };
  });
  const metadata = importMetadata(file, m, choice, tables.accounts, errors);
  const known = new Set(tables.accounts.map((a) => a.id));
  const targets = [
    ...rows.flatMap((r) => (r.tx ? [r.tx.account] : [])),
    ...metadata.accounts.map((a) => a.account!),
  ];
  return {
    file: { name: file.name, hash: file.hash, profile: file.profile },
    rows,
    counts: {
      new: rows.filter((r) => r.status === "new").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
    },
    metadata,
    checkpoints: latestCheckpoints(metadata, tables),
    newAccounts: [...new Set(targets)].filter((a) => a && !known.has(a)),
    errors: [...new Set(errors)],
    token: previewToken(tables.transactions, tables.accounts),
  };
}
