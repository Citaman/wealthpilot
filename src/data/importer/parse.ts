import Papa from "papaparse";
import { parseDate } from "../../domain/dates";
import { parseMoney } from "../../domain/money";
import type { ImportMetadata } from "../../domain/types";
import { detectMapping } from "./mapping";

export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export type Encoding = "utf-8" | "windows-1252";

export interface ParsedFile {
  name: string;
  /** SHA-256 of the raw bytes: the same file is never imported twice. */
  hash: string;
  encoding: Encoding;
  delimiter: string;
  profile: "sg" | "generic";
  fields: string[];
  rows: Record<string, string>[];
  errors: string[];
  /** File line number of `rows[0]`. */
  firstDataRow: number;
  /** SG preamble: bank identity, declared period and observed balance. */
  metadata?: ImportMetadata;
}

type Progress = (percent: number) => void;

export async function sha256(data: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function decodeCSV(data: ArrayBuffer): {
  text: string;
  encoding: Encoding;
} {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(data),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(data),
      encoding: "windows-1252",
    };
  }
}

export async function readCsv(
  data: ArrayBuffer,
  onProgress?: Progress,
): Promise<Omit<ParsedFile, "name">> {
  const hash = await sha256(data);
  const { text, encoding } = decodeCSV(data);
  return { hash, encoding, ...parseCSV(text, onProgress) };
}

// SG exports start with a six-field preamble (account, period, count, balance).
const SG_PREAMBLE = /^\d+;\d{2}\/\d{2}\/\d{4};\d{2}\/\d{2}\/\d{4};\d+;/;

export function parseCSV(text: string, onProgress?: Progress) {
  const clean = text.replace(/^\uFEFF/, "");
  const sg = SG_PREAMBLE.test(clean);
  const data: string[][] = [];
  const errors: string[] = [];
  let delimiter = ";";
  // The preamble has one field more than the header: Papa's guess would fail.
  Papa.parse<string[]>(clean, {
    ...(sg ? { delimiter: ";" } : {}),
    skipEmptyLines: "greedy",
    step(result) {
      data.push(result.data);
      delimiter = result.meta.delimiter;
      for (const e of result.errors)
        if (e.code !== "UndetectableDelimiter") errors.push(e.message);
      if (data.length % 500 === 0)
        onProgress?.(
          Math.min(
            99,
            Math.floor((result.meta.cursor / Math.max(1, clean.length)) * 100),
          ),
        );
    },
  });
  onProgress?.(100);
  const headerIndex = sg ? 1 : 0;
  const firstDataRow = sg ? 4 : 2;
  const profile = sg ? ("sg" as const) : ("generic" as const);
  if (!data.length)
    return {
      delimiter,
      profile,
      fields: [],
      rows: [],
      errors: ["Le fichier est vide."],
      firstDataRow,
    };
  const fields = (data[headerIndex] ?? []).map((x) => x.trim());
  if (new Set(fields).size !== fields.length || fields.some((x) => !x))
    errors.push("Les noms de colonnes doivent être distincts et non vides.");
  if (data.length - headerIndex - 1 > MAX_ROWS)
    errors.push("Maximum 50 000 opérations par fichier.");
  const rows = data.slice(headerIndex + 1).map((values, i) => {
    if (values.length !== fields.length)
      errors.push(`Ligne ${i + firstDataRow} : nombre de colonnes incorrect.`);
    return Object.fromEntries(fields.map((f, j) => [f, values[j] ?? ""]));
  });
  const metadata = sg ? sgMetadata(data[0], fields, rows, errors) : undefined;
  return {
    delimiter,
    profile,
    fields,
    rows,
    errors: [...new Set(errors)],
    firstDataRow,
    metadata,
  };
}

function sgMetadata(
  preamble: string[],
  fields: string[],
  rows: Record<string, string>[],
  errors: string[],
): ImportMetadata {
  const [bankAccountId, start, end, count, asOf, value] = preamble;
  const coverageFrom = parseDate(start ?? "");
  const coverageThrough = parseDate(end ?? "");
  const date = parseDate(asOf ?? "");
  const currency = value?.trim().match(/([A-Z]{3})$/)?.[1] ?? "";
  const amount = parseMoney(value?.replace(/[A-Z]{3}$/, "") ?? "");
  if (
    !coverageFrom ||
    !coverageThrough ||
    coverageFrom > coverageThrough ||
    !date ||
    date > coverageThrough ||
    amount === null ||
    currency !== "EUR" ||
    !/^\d{5,34}$/.test(bankAccountId ?? "") ||
    preamble.length !== 6
  )
    errors.push("Préambule SG invalide : vérifier dates, solde et devise EUR.");
  const mapping = detectMapping(fields);
  if (!mapping.date || !mapping.amount || !mapping.label)
    errors.push("En-tête SG non reconnu.");
  const metadata: ImportMetadata = {
    profile: "sg",
    reportedCount: Number(count),
    accounts: [],
    warnings: [
      "Le solde est observé à sa date bancaire, pas à la date d’export. Les opérations en attente ne sont pas inventées.",
    ],
  };
  if (metadata.reportedCount !== rows.length)
    errors.push(
      "Le nombre d’opérations déclaré par SG ne correspond pas aux lignes présentes.",
    );
  if (
    coverageFrom &&
    coverageThrough &&
    rows.some((r) => {
      const d = parseDate(r[mapping.date] ?? "");
      return d && (d < coverageFrom || d > coverageThrough);
    })
  )
    errors.push(
      "Une opération est hors de la période déclarée par le relevé SG.",
    );
  if (coverageFrom && coverageThrough && date && amount !== null)
    metadata.accounts.push({
      bankAccountId,
      currency,
      coverageFrom,
      coverageThrough,
      checkpoints: [{ date, amount, status: "observed" }],
    });
  return metadata;
}
