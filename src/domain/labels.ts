// Display names for bank wording. The stored merchant/label/raw stay untouched
// (fingerprints and recurrence keys depend on them); only what is shown changes.
import { normalizedText } from "./text";
import type { Transaction } from "./types";

// Payees recognised by name, whatever the wording around them.
const KNOWN: [RegExp, string][] = [
  [/banque francaise mutualiste|\bbfm\b/, "Crédit auto BFM"],
  [/dgfip|impot sur le revenu/, "Impôt sur le revenu"],
  [
    /minimum forfaitaire|jours debiteurs|agios|interets debiteurs/,
    "Frais de découvert",
  ],
  [/frais d incident/, "Frais d’incident"],
  [/retrait dab|retrait especes/, "Retrait d’espèces"],
];

const BANK_WORDING =
  /^\W*\d*\s*(?:VIR|PRLV|PRELEVEMENT|CARTE|ARRETE|RETRAIT)\b/i;
const STOP =
  /\s+(?:MOTIF|REF(?:ERENCE)?|ID|DATE|BQ|CPT|IOPD|COMMERCE ELECTRONIQUE)\b\s*:?.*$/i;
const SMALL = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "a",
  "au",
  "aux",
  "sur",
  "pour",
]);

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && SMALL.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

const tidy = (text: string) =>
  titleCase(
    text
      .replace(STOP, "")
      .replace(/\b(?:MR|MME|M|MLLE|MONSIEUR|MADAME)\.?\s+/gi, "")
      .replace(/\b\d{5,}\w*\b/g, "")
      .replace(/\s+\d{2}\s+\d{2}\b.*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );

const elide = (word: string) =>
  /^[aeiouyh]/i.test(word) ? `d’${word}` : `de ${word}`;

/** « VIR RECU … DE: MR ANTHONNY OLIME MOTIF: Voiture » → « Virement d’Anthonny Olime · Voiture ». */
export function cleanLabel(...texts: (string | undefined)[]): string {
  const candidates = texts.filter((t): t is string => Boolean(t?.trim()));
  const all = normalizedText(candidates.join(" "));
  const known = KNOWN.find(([pattern]) => pattern.test(all))?.[1];
  if (known) return known;
  const first = candidates[0] ?? "";
  const letters = first.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  const shouting =
    BANK_WORDING.test(first) ||
    (letters.length >= 3 && upper / letters.length > 0.7);
  // Curated names (« Loyer ORPI ») are kept as they are.
  if (!shouting) return first;
  for (const text of candidates) {
    const motif = text
      .match(/MOTIF\s*:\s*(.+?)(?:\s+(?:REF|ID|DATE)\s*:|$)/i)?.[1]
      ?.trim();
    const suffix =
      motif && !/^\d+$/.test(motif) && motif.length < 30 ? ` · ${motif}` : "";
    const from = text.match(
      /\bVIR(?:EMENT)?\b.*?\bRECU\b.*?\bDE\s*:\s*(.+)/i,
    )?.[1];
    if (from) return `Virement ${elide(tidy(from))}${suffix}`;
    const to = text.match(/\bVIR(?:EMENT)?\b.*?\bPOUR\s*:\s*(.+)/i)?.[1];
    if (to) return `Virement vers ${tidy(to)}${suffix}`;
    const creditor = text.match(/\bPRELEVEMENT\b.*?\bDE\s*:\s*(.+)/i)?.[1];
    if (creditor) return tidy(creditor);
    const card = text.match(/\bCARTE\s+X\d{4}\s+\d{2}\/\d{2}\s+(.+)/i)?.[1];
    if (card) return tidy(card);
  }
  return tidy(first) || first;
}

const rawDetail = (t: Pick<Transaction, "raw">) =>
  Object.entries(t.raw ?? {}).find(([k]) =>
    /^(detail|detail de l ecriture|libelle|description)$/.test(
      normalizedText(k),
    ),
  )?.[1];

const cache = new WeakMap<Transaction, string>();
/** What the UI shows for an operation: the user's name for it, else a clean bank label. */
export function merchantLabel(t: Transaction): string {
  if (t.merchantName) return t.merchantName;
  let name = cache.get(t);
  if (name === undefined) {
    // Generic bank stubs (« 000001 VIR INSTANT ») are explained by the raw detail.
    const generic = BANK_WORDING.test(t.merchant || t.label);
    name = generic
      ? cleanLabel(rawDetail(t), t.label, t.merchant)
      : cleanLabel(t.merchant, t.label, rawDetail(t));
    if (t.amount > 0 && name === "Impôt sur le revenu")
      name = "Remboursement d’impôt";
    cache.set(t, name);
  }
  return name;
}
