import {
  fileAccounts,
  type AccountChoice,
  type Mapping,
} from "../../data/importer/mapping";
import type { ParsedFile } from "../../data/importer/parse";
import type { Account } from "../../domain/types";

/** Source accounts needing a destination; "" = rows without an account column value. */
export function sourceAccounts(file: ParsedFile, mapping: Mapping): string[] {
  const sources = fileAccounts(file, mapping);
  if (!mapping.account || file.rows.some((r) => !r[mapping.account]?.trim()))
    sources.push("");
  return sources;
}

/** Existing account matching the SG bank identifier: locked in the dialog. */
export function identifiedAccount(file: ParsedFile, accounts: Account[]) {
  const bankId = file.metadata?.accounts[0]?.bankAccountId;
  return bankId ? accounts.find((a) => a.bankAccountId === bankId) : undefined;
}

export const DEFAULT_NEW_ACCOUNT = "Compte courant";

export function initialChoice(
  file: ParsedFile,
  mapping: Mapping,
  accounts: Account[],
  preferred: string | null,
): AccountChoice {
  const known = new Set(accounts.map((a) => a.id));
  const locked = identifiedAccount(file, accounts)?.id;
  return Object.fromEntries(
    sourceAccounts(file, mapping).map((source) => [
      source,
      source ||
        locked ||
        (preferred && known.has(preferred) ? preferred : undefined) ||
        accounts[0]?.id ||
        DEFAULT_NEW_ACCOUNT,
    ]),
  );
}
