import type { IsoDate } from "./types";

// Business dates are plain calendar days. Arithmetic is done at UTC noon so a
// daylight-saving change can never move a date.
const noon = (date: IsoDate) => new Date(date + "T12:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function today(now = new Date()): IsoDate {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = noon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from: IsoDate, to: IsoDate) =>
  Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);

/** Monday of the week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -((noon(date).getUTCDay() + 6) % 7));
}

/** 0 = Monday … 6 = Sunday. */
export const weekday = (date: IsoDate) => (noon(date).getUTCDay() + 6) % 7;

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1, 12));
  return iso(d).slice(0, 7);
}

export function monthEnd(month: string): IsoDate {
  const [y, m] = month.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m, 0, 12)));
}

/** Day `day` of `month`, clamped to the month's last day. */
export function clampDay(month: string, day: number): IsoDate {
  const last = Number(monthEnd(month).slice(8));
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = noon(value);
  return !Number.isNaN(d.getTime()) && iso(d) === value;
}

/** Accepts `YYYY-MM-DD[T…]`, `DD/MM/YYYY`, `DD.MM.YYYY`, `DD-MM-YYYY`. */
export function parseDate(value: string): IsoDate | null {
  const s = value.trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  const frMatch = s.match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
  const parts = isoMatch
    ? [isoMatch[1], isoMatch[2], isoMatch[3]]
    : frMatch
      ? [frMatch[3], frMatch[2], frMatch[1]]
      : null;
  if (!parts) return null;
  const candidate = parts.join("-");
  return isIsoDate(candidate) ? candidate : null;
}

export const minDate = (a: IsoDate, b: IsoDate) => (a < b ? a : b);
export const maxDate = (a: IsoDate, b: IsoDate) => (a > b ? a : b);

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export const within = (date: IsoDate, range: DateRange) =>
  date >= range.from && date <= range.to;

export function eachDay(range: DateRange): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  return days;
}

const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { ...options, timeZone: "UTC" });
const short = format({ day: "numeric", month: "short" });
const long = format({ day: "numeric", month: "short", year: "numeric" });
const withWeekday = format({ weekday: "short", day: "numeric", month: "short" });
const fullDay = format({ weekday: "long", day: "numeric", month: "long" });
const monthName = format({ month: "long" });
const monthYear = format({ month: "long", year: "numeric" });

/** « 12 oct. » */
export const formatDay = (date: IsoDate) => short.format(noon(date));
/** « 12 oct. 2026 » */
export const formatDate = (date: IsoDate) => long.format(noon(date));
/** « mer. 14 oct. » */
export const formatWeekday = (date: IsoDate) => withWeekday.format(noon(date));
/** « mercredi 14 octobre » */
export const formatFullDay = (date: IsoDate) => fullDay.format(noon(date));
/** « Octobre » for a `YYYY-MM` key (year added when not the current one). */
export function formatMonth(month: string, currentYear?: string): string {
  const d = noon(`${month}-15`);
  const label =
    !currentYear || month.startsWith(currentYear)
      ? monthName.format(d)
      : monthYear.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
/** « 26 sept. → 24 oct. » */
export const formatRange = (range: DateRange) =>
  `${formatDay(range.from)} → ${formatDay(range.to)}`;
