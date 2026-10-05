import { db } from "./db";
import { commitImport, type CommitOptions } from "./importer/commit";
import { detectMapping, type AccountChoice } from "./importer/mapping";
import { parseCSV, type ParsedFile } from "./importer/parse";
import { buildPreview } from "./importer/preview";

export const resetDatabase = () => Promise.all(db.tables.map((t) => t.clear()));

/** In-memory equivalent of the worker result; `name` doubles as the file hash. */
export const parsedFile = (text: string, name = "test.csv"): ParsedFile => ({
  name,
  hash: name,
  encoding: "utf-8",
  ...parseCSV(text),
});

export const currentTables = async () => ({
  transactions: await db.transactions.toArray(),
  accounts: await db.accounts.toArray(),
});

export async function previewText(
  text: string,
  choice: AccountChoice = { "": "Courant" },
  name = "test.csv",
) {
  const file = parsedFile(text, name);
  return buildPreview(
    file,
    detectMapping(file.fields),
    choice,
    await currentTables(),
  );
}

export async function importText(
  text: string,
  options: CommitOptions & { name?: string; choice?: AccountChoice } = {},
) {
  return commitImport(
    await previewText(text, options.choice, options.name),
    options,
  );
}

export const sgFixture = (
  balance = "1000.00",
  rows = "02/10/2026;CARTE;CARTE REF A;-10,00;EUR\n02/10/2026;CARTE;CARTE REF B;-10,00;EUR",
) =>
  `00012345678;01/09/2026;04/10/2026;${rows.split("\n").length};02/10/2026;${balance} EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n${rows}`;
