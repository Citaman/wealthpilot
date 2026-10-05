import Papa from "papaparse";
import { parseDate, parseMoney } from "./domain";
import type { Account, ImportMetadata, Transaction } from "./types";
export type Field =
  | "date"
  | "label"
  | "amount"
  | "debit"
  | "credit"
  | "direction"
  | "account"
  | "merchant"
  | "category"
  | "internal"
  | "currency";
export type Mapping = Record<Field, string>;
export interface ParsedFile {
  fields: string[];
  rows: Record<string, string>[];
  errors: string[];
  metadata?: ImportMetadata;
  firstDataRow?: number;
}
export interface Candidate {
  row: number;
  transaction?: Omit<Transaction, "id" | "batchId">;
  error?: string;
  duplicate: boolean;
}
const normal = (s: string) =>
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
};
export function detectMapping(fields: string[]): Mapping {
  return Object.fromEntries(
    Object.entries(aliases).map(([key, values]) => [
      key,
      values
        .map((alias) => fields.find((f) => normal(f) === alias))
        .find(Boolean) ?? "",
    ]),
  ) as Mapping;
}
/** Only skip manual mapping when required columns have an unambiguous meaning. */
export function automaticMappingIssues(file: ParsedFile): string[] {
  const mapping = detectMapping(file.fields);
  const issues: string[] = [];
  if (!mapping.date) issues.push("Choisissez la colonne de date.");
  if (!mapping.label && !mapping.merchant)
    issues.push("Choisissez le libellé ou le commerçant.");
  if (!mapping.amount && !mapping.debit && !mapping.credit)
    issues.push("Choisissez le montant signé ou les colonnes débit / crédit.");
  for (const field of Object.keys(aliases) as Field[]) {
    const matches = file.fields.filter((name) =>
      aliases[field].includes(normal(name)),
    );
    // SG's full banking detail intentionally takes precedence over its short type label.
    if (
      matches.length > 1 &&
      !(field === "label" && file.metadata?.profile === "sg")
    )
      issues.push(
        `Plusieurs colonnes possibles : ${matches.join(" / ")}. Confirmez leur rôle.`,
      );
  }
  if (mapping.amount && (mapping.debit || mapping.credit))
    issues.push(
      "Montant signé et débit / crédit sont présents : choisissez la source à utiliser.",
    );
  return issues;
}

/** A selected single-account destination must also receive its source checkpoints. */
export function fileForImportAccount(
  file: ParsedFile,
  account: string,
  keepFileAccounts: boolean,
): ParsedFile {
  if (keepFileAccounts || !file.metadata || file.metadata.profile === "sg")
    return file;
  if (file.metadata.accounts.length > 1)
    throw new Error(
      "Ce fichier contient plusieurs comptes : conservez leurs affectations distinctes.",
    );
  return {
    ...file,
    metadata: {
      ...file.metadata,
      accounts: file.metadata.accounts.map((entry) => ({
        ...entry,
        account: account.trim(),
      })),
    },
  };
}
export function parseCSV(
  text: string,
  onProgress?: (percent: number) => void,
): ParsedFile {
  const data: string[][] = [];
  const parseErrors: Papa.ParseError[] = [];
  const clean = text.replace(/^\uFEFF/, "");
  // SG's six-field preamble is not the five-field transaction header. Use its
  // explicit delimiter, otherwise Papa's delimiter guess sees inconsistent rows.
  const sg = /^\d+;\d{2}\/\d{2}\/\d{4};\d{2}\/\d{2}\/\d{4};\d+;/.test(clean);
  Papa.parse<string[]>(clean, {
    ...(sg ? { delimiter: ";" } : {}),
    skipEmptyLines: "greedy",
    step(result) {
      data.push(result.data);
      parseErrors.push(...result.errors);
      if (data.length % 500 === 0)
        onProgress?.(
          Math.min(
            99,
            Math.floor((result.meta.cursor / Math.max(1, text.length)) * 100),
          ),
        );
    },
  });
  const parsed = { data, errors: parseErrors };
  onProgress?.(100);
  if (!parsed.data.length)
    return { fields: [], rows: [], errors: ["Le fichier est vide."] };
  const headerIndex = sg ? 1 : 0;
  const fields = (parsed.data[headerIndex] ?? []).map((x) => x.trim());
  const errors = parsed.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .map((e) => e.message);
  if (new Set(fields).size !== fields.length || fields.some((x) => !x))
    errors.push("Les noms de colonnes doivent être distincts et non vides.");
  if (parsed.data.length - headerIndex - 1 > 50000)
    errors.push("Maximum 50 000 opérations par fichier.");
  const firstDataRow = sg ? 4 : 2;
  const rows = parsed.data.slice(headerIndex + 1).map((values, i) => {
    if (values.length !== fields.length)
      errors.push(
        "Ligne " + (i + firstDataRow) + " : nombre de colonnes incorrect.",
      );
    return Object.fromEntries(fields.map((f, j) => [f, values[j] ?? ""]));
  });
  const metadata: ImportMetadata = {
    profile: sg ? "sg" : "generic",
    accounts: [],
    warnings: [],
  };
  if (sg) {
    const [bankAccountId, start, end, count, asOf, value] = parsed.data[0];
    const coverageFrom = parseDate(start ?? ""),
      coverageThrough = parseDate(end ?? ""),
      date = parseDate(asOf ?? "");
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
      parsed.data[0].length !== 6
    )
      errors.push(
        "Préambule SG invalide : vérifier dates, solde et devise EUR.",
      );
    if (
      !detectMapping(fields).date ||
      !detectMapping(fields).amount ||
      !detectMapping(fields).label
    )
      errors.push("En-tête SG non reconnu.");
    metadata.reportedCount = Number(count);
    if (metadata.reportedCount !== rows.length)
      errors.push(
        "Le nombre d’opérations déclaré par SG ne correspond pas aux lignes présentes.",
      );
    const dateColumn = detectMapping(fields).date;
    if (
      coverageFrom &&
      coverageThrough &&
      rows.some((r) => {
        const value = parseDate(r[dateColumn] ?? "");
        return value && (value < coverageFrom || value > coverageThrough);
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
    metadata.warnings.push(
      "Le solde est observé à sa date bancaire, pas à la date d’export. Les opérations en attente ne sont pas inventées.",
    );
  } else {
    const balanceField = fields.find((f) => normal(f) === "dailybalance");
    if (balanceField) {
      const mapping = detectMapping(fields);
      for (const raw of rows) {
        if (!raw[balanceField]?.trim()) continue;
        const date = parseDate(raw[mapping.date] ?? ""),
          amount = parseMoney(raw[balanceField]);
        const currency = raw[mapping.currency]?.trim().toUpperCase() || "EUR";
        if (currency !== "EUR") {
          errors.push(
            "Les soldes journaliers en devise autre que l’euro ne sont pas pris en charge.",
          );
          continue;
        }
        if (!date || amount === null) {
          errors.push("Solde journalier dérivé invalide.");
          continue;
        }
        const account = raw[mapping.account]?.trim() || undefined;
        let entry = metadata.accounts.find((a) => a.account === account);
        if (!entry) {
          entry = { account, currency: "EUR", checkpoints: [] };
          metadata.accounts.push(entry);
        }
        const previous = entry.checkpoints.find((p) => p.date === date);
        if (previous && previous.amount !== amount)
          errors.push(
            "Soldes journaliers contradictoires pour le même compte et jour.",
          );
        else if (!previous)
          entry.checkpoints.push({ date, amount, status: "derived" });
      }
      metadata.warnings.push(
        "Les daily_balance sont des reconstructions : ils ne deviennent pas automatiquement des soldes bancaires observés.",
      );
    }
  }
  return { fields, rows, errors: [...new Set(errors)], metadata, firstDataRow };
}
/** Stable bank identity wins over display names; the UI must show this choice. */
export function metadataAccountId(
  metadata: ImportMetadata["accounts"][number],
  fallback: string,
  accounts: Account[],
): string {
  return (
    (metadata.bankAccountId
      ? accounts.find((a) => a.bankAccountId === metadata.bankAccountId)?.id
      : undefined) ??
    metadata.account ??
    fallback.trim()
  );
}
export function fingerprint(t: {
  account: string;
  date: string;
  amount: number;
  label: string;
}) {
  return JSON.stringify([
    t.account.trim().toLocaleLowerCase(),
    t.date,
    t.amount,
    t.label.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
  ]);
}
export function importIdentity(
  t: Pick<Transaction, "account" | "date" | "amount" | "label"> & {
    raw?: Record<string, string>;
  },
) {
  return fingerprint({
    ...t,
    label:
      Object.entries(t.raw ?? {}).find(([k]) =>
        ["detail", "detaildelecriture"].includes(normal(k)),
      )?.[1] || t.label,
  });
}
export function previewImport(
  file: ParsedFile,
  m: Mapping,
  fallbackAccount: string,
  existing: Transaction[],
): Candidate[] {
  const counts = new Map<string, number>();
  existing.forEach((t) => {
    const key = importIdentity(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return file.rows.map((raw, i) => {
    const row = i + (file.firstDataRow ?? 2);
    const get = (field: Field) => raw[m[field]]?.trim() ?? "";
    const date = parseDate(get("date"));
    const label = get("label") || get("merchant");
    const account = get("account") || fallbackAccount.trim();
    const direction = normal(get("direction"));
    let amount: number | null = null;
    if (m.amount) {
      amount = parseMoney(get("amount"));
      if (amount !== null && direction) {
        if (
          ["expense", "debit", "depense", "out", "sortie", "d"].includes(
            direction,
          )
        )
          amount = -Math.abs(amount);
        else if (
          ["income", "credit", "revenu", "in", "entree", "c"].includes(
            direction,
          )
        )
          amount = Math.abs(amount);
        else
          return {
            row,
            error: "Sens inconnu : vérifier la colonne sens.",
            duplicate: false,
          };
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
    if (error) return { row, error, duplicate: false };
    const extra = (keys: string[]) =>
      Object.entries(raw).find(([k]) => keys.includes(normal(k)))?.[1] ?? "";
    const t = {
      date: date!,
      amount: amount!,
      label,
      account,
      merchant: get("merchant") || label,
      merchantName: extra(["merchantname", "nomaffiche"]) || undefined,
      subcategory: Object.keys(raw).some((k) =>
        ["subcategory", "souscategorie"].includes(normal(k)),
      )
        ? extra(["subcategory", "souscategorie"])
        : undefined,
      note: extra(["note", "notepersonnelle"]) || undefined,
      reviewed: ["y", "yes", "true", "1", "oui"].includes(
        normal(extra(["reviewed", "verifiee"])),
      ),
      category: get("category") || "À catégoriser",
      internal: ["y", "yes", "oui", "true", "1"].includes(
        normal(get("internal")),
      ),
      raw,
      fingerprint: "",
    };
    t.fingerprint = fingerprint(t);
    const key = importIdentity(t);
    const remaining = counts.get(key) ?? 0;
    if (remaining) counts.set(key, remaining - 1);
    return { row, transaction: t, duplicate: remaining > 0 };
  });
}
export async function sha256(data: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function decodeCSV(data: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}
export function exportCSV(rows: Transaction[]) {
  return Papa.unparse(
    rows.map((t) => ({
      date: t.date,
      account: t.account,
      amount: t.amount / 100,
      merchant: t.merchant,
      merchant_name: t.merchantName ?? "",
      subcategory: t.subcategory ?? "",
      note: t.note ?? "",
      reviewed: t.reviewed ? "Y" : "N",
      libelle: t.label,
      category: t.category,
      is_internal: t.internal ? "Y" : "N",
      currency: "EUR",
    })),
    { escapeFormulae: true, delimiter: ";", newline: "\r\n" },
  );
}
