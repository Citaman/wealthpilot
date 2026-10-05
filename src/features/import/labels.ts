import type { ParsedFile } from "../../data/importer/parse";
import { formatDay } from "../../domain/dates";
import type { Batch, IsoDate } from "../../domain/types";

const count = new Intl.NumberFormat("fr-FR");

/** « 1 508 » with a narrow no-break space. */
export const formatCount = (n: number) =>
  count.format(n).replace(/\s/g, "\u202f");

/** « 1 opération », « 142 opérations » (0 and 1 take the singular in French). */
export const plural = (n: number, one: string, many: string) =>
  `${formatCount(n)} ${n > 1 ? many : one}`;

const profiles: Record<ParsedFile["profile"], string> = {
  sg: "Société Générale",
  generic: "Générique",
};
const encodings: Record<ParsedFile["encoding"], string> = {
  "utf-8": "UTF-8",
  "windows-1252": "Windows-1252",
};

/** « Société Générale · UTF-8 · séparateur ; » */
export function fileFacts(file: ParsedFile) {
  const delimiter =
    file.delimiter === "\t" ? "tabulation" : `séparateur ${file.delimiter}`;
  return [profiles[file.profile], encodings[file.encoding], delimiter].join(
    " · ",
  );
}

/** « Commun », « Alex et Sam », « 3 comptes » */
export function namesLabel(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.length} comptes`;
}

/** Local calendar day of a timestamp (import time, not a bank date). */
export function localDay(iso: string): IsoDate {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
export const localTime = (iso: string) => time.format(new Date(iso));

export const batchPeriod = (batch: Pick<Batch, "minDate" | "maxDate">) =>
  batch.minDate === batch.maxDate
    ? formatDay(batch.minDate)
    : `${formatDay(batch.minDate)} → ${formatDay(batch.maxDate)}`;

export const backupFileName = (asOf: IsoDate, suffix = "") =>
  `wealthpilot-sauvegarde-${asOf}${suffix}.json`;
