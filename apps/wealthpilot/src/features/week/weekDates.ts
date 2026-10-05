import {
  addDays,
  formatDay,
  formatWeekday,
  isIsoDate,
  weekday,
  weekStart,
} from "../../domain/dates";
import type { Occurrence } from "../../domain/events";
import type { IsoDate } from "../../domain/types";
import type { WeekEnvelope, WeekPlan } from "../../domain/week";

export const FUTURE_WEEKS = 4;

/** « 5 – 11 oct. », « 28 sept. – 4 oct. » */
export function weekLabel(start: IsoDate) {
  const end = addDays(start, 6);
  const from =
    start.slice(0, 7) === end.slice(0, 7)
      ? String(Number(start.slice(8)))
      : formatDay(start);
  return `${from} – ${formatDay(end)}`;
}

/** A `week` drilldown parameter, normalised to its Monday. */
export function weekParam(value: string | null): IsoDate | null {
  if (!value || !isIsoDate(value)) return null;
  return weekday(value) === 0 ? value : weekStart(value);
}

/** « jeu. 9 oct. » without the trailing dot noise of short weekdays. */
export const dayLabel = (date: IsoDate) => formatWeekday(date);
/** « jeu. » */
export const weekdayShort = (date: IsoDate) =>
  formatWeekday(date).split(" ")[0];

export const isEstimated = (o: Occurrence) =>
  o.kind === "estimate" && !o.confirmed;

/** Household transfers cancel out; for one account they are real movements. */
export const visibleMovement = (account: string) => (o: Occurrence) =>
  Boolean(account) || !o.internal;

/** A week plan saved without any limit left (all reset) is still a proposal. */
export const planStatus = (plan: WeekPlan) =>
  plan.envelopes.some((e) => e.saved)
    ? "confirmed"
    : plan.assumptions.status === "confirmed"
      ? "estimated"
      : plan.assumptions.status;

/** A dated charge in a category without limit is listed with the charges, not as an envelope. */
export const isActiveEnvelope = (e: WeekEnvelope) => e.limit > 0 || e.paid > 0;

/** The shared cash capacity, not the category limits, sets what is still possible. */
export const capacityBinds = (plan: WeekPlan) => {
  const { capacity } = plan.assumptions;
  const wanted = plan.envelopes
    .filter((e) => e.limit > 0)
    .reduce((n, e) => n + Math.max(0, e.limit - e.paid - e.committed), 0);
  return (
    capacity !== null && plan.totals.possible === capacity && wanted > capacity
  );
};
