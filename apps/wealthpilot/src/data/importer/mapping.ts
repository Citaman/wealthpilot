import type { DateFormat } from "../../domain/dates";
import type { Account, Batch, ImportAccountMetadata } from "../../domain/types";
import type { ParsedFile } from "./parse";

export const mappingFields = [
  "date",
  "label",
  "amount",
  "debit",
  "credit",
  "direction",
  "account",
  "merchant",
  "category",
  "internal",
  "currency",
  "balance",
] as const;
export type Field = (typeof mappingFields)[number];
/** Field → source column name ("" = unmapped). */
export type Mapping = Record<Field, string> & { dateFormat?: DateFormat };

export const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases: Record<Field, string[]> = {
  date: [
    "date",
    "dateoperation",
    "datedeloperation",
    "datecomptable",
    "bookingdate",
  ],
  label: [
    "detaildelecriture",
    "detail",
    "libelle",
    "label",
    "description",
    "libelleoperation",
  ],
  amount: ["amount", "montant", "montantdeloperation", "montanteur"],
  debit: ["debit", "depense"],
  credit: ["credit", "recette"],
  direction: ["direction", "sens", "type"],
  account: ["account", "compte", "nomcompte"],
  merchant: ["merchant", "commercant", "beneficiaire"],
  category: ["category", "categorie"],
  internal: ["isinternal", "interne", "virementinterne"],
  currency: ["currency", "devise"],
  balance: ["dailybalance"],
};

export function detectMapping(columns: string[]): Mapping {
  return Object.fromEntries(
    mappingFields.map((field) => [
      field,
      aliases[field]
        .map((alias) => columns.find((c) => normal(c) === alias))
        .find(Boolean) ?? "",
    ]),
  ) as Mapping;
}

/** What still prevents a mapping from producing transactions. */
export function mappingIssues(m: Mapping): string[] {
  const issues: string[] = [];
  if (!m.date) issues.push("Choisissez la colonne de date.");
  if (!m.label && !m.merchant)
    issues.push("Choisissez le libellé ou le commerçant.");
  if (!m.amount && !m.debit && !m.credit)
    issues.push("Choisissez le montant signé ou les colonnes débit / crédit.");
  if (m.amount && (m.debit || m.credit))
    issues.push(
      "Montant signé et débit / crédit sont présents : choisissez la source à utiliser.",
    );
  return issues;
}

/** Manual mapping is skipped only when required columns are unambiguous. */
export function automaticMappingIssues(
  file: Pick<ParsedFile, "fields" | "profile">,
): string[] {
  const issues = mappingIssues(detectMapping(file.fields));
  for (const field of mappingFields) {
    const matches = file.fields.filter((name) =>
      aliases[field].includes(normal(name)),
    );
    // SG's full banking detail intentionally wins over its short type label.
    if (matches.length > 1 && !(field === "label" && file.profile === "sg"))
      issues.push(
        `Plusieurs colonnes possibles : ${matches.join(" / ")}. Confirmez leur rôle.`,
      );
  }
  return issues;
}

/** Distinct values of the account column; [] when the file has none. */
export function fileAccounts(
  file: Pick<ParsedFile, "rows">,
  m: Mapping,
): string[] {
  if (!m.account) return [];
  return [
    ...new Set(file.rows.map((r) => r[m.account]?.trim()).filter(Boolean)),
  ];
}

/**
 * Destination account for each source account of the file. The key is the
 * value of the account column, or "" for rows without one (single-account files).
 */
export type AccountChoice = Record<string, string>;

export const destination = (choice: AccountChoice, source: string) =>
  (choice[source] ?? source).trim();

/** Stable bank identity wins over display names; the UI must show this choice. */
export function metadataAccountId(
  entry: Pick<ImportAccountMetadata, "account" | "bankAccountId">,
  fallback: string,
  accounts: Account[],
): string {
  return (
    (entry.bankAccountId
      ? accounts.find((a) => a.bankAccountId === entry.bankAccountId)?.id
      : undefined) ??
    entry.account ??
    fallback.trim()
  );
}

export interface FileAnalysis {
  profile: ParsedFile["profile"];
  mapping: Mapping;
  /** Non-empty: show the column mapping step before choosing accounts. */
  mappingIssues: string[];
  /** Values of the account column; one destination to choose per entry. */
  detectedAccounts: string[];
  /** Existing account matching the SG bank identifier: preselected and locked. */
  identifiedAccount?: Account;
  /** Batch holding the very same bytes: there is nothing to import. */
  alreadyImported?: Batch;
  /** Initial destinations for the account dialog. */
  choice: AccountChoice;
}

export function analyzeFile(
  file: ParsedFile,
  tables: { accounts: Account[]; batches: Batch[] },
): FileAnalysis {
  const mapping = detectMapping(file.fields);
  const detectedAccounts = fileAccounts(file, mapping);
  const bankId = file.metadata?.accounts[0]?.bankAccountId;
  const identifiedAccount = bankId
    ? tables.accounts.find((a) => a.bankAccountId === bankId)
    : undefined;
  return {
    profile: file.profile,
    mapping,
    mappingIssues: [...file.errors, ...automaticMappingIssues(file)],
    detectedAccounts,
    identifiedAccount,
    alreadyImported: tables.batches.find((b) => b.hash === file.hash),
    choice: detectedAccounts.length
      ? Object.fromEntries(detectedAccounts.map((a) => [a, a]))
      : { "": identifiedAccount?.id ?? tables.accounts[0]?.id ?? "" },
  };
}
