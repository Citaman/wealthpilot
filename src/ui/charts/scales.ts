import { addDays, daysBetween } from "../../domain/dates";
import { formatEuro } from "../../domain/money";
import type { IsoDate } from "../../domain/types";

export interface LinearScale {
  (value: number): number;
  invert: (position: number) => number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = ((value: number) =>
    r0 + ((value - d0) / span) * (r1 - r0)) as LinearScale;
  scale.invert = (position) => d0 + ((position - r0) / (r1 - r0 || 1)) * span;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

const steps = [1, 2, 2.5, 5];

/**
 * Round ticks (1, 2, 2.5, 5 × 10ⁿ) covering [min, max], about `count` of them.
 * Among candidate steps, prefers the tick count closest to `count`, then the
 * least wasted range. Values are cents; the step is never below `minStep` (1 €).
 */
export function niceTicks(
  min: number,
  max: number,
  count = 4,
  minStep = 100,
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    const pad = Math.max(Math.abs(lo) * 0.1, minStep);
    lo -= pad;
    hi += pad;
  }
  const span = hi - lo;
  const power = Math.floor(Math.log10(span / Math.max(1, count - 1)));
  let best: { start: number; end: number; step: number; score: number } | null =
    null;
  for (const p of [power - 1, power, power + 1])
    for (const s of steps) {
      const step = s * 10 ** p;
      if (step < minStep) continue;
      const start = Math.floor(lo / step + 1e-9) * step;
      const end = Math.ceil(hi / step - 1e-9) * step;
      const ticks = Math.round((end - start) / step) + 1;
      const score = Math.abs(ticks - count) + (2 * (end - start - span)) / span;
      if (!best || score < best.score - 1e-9)
        best = { start, end, step, score };
    }
  if (!best) return [];
  const values: number[] = [];
  for (let v = best.start; v <= best.end + best.step / 2; v += best.step)
    values.push(Math.round(v) || 0);
  return values;
}

export interface DateScale {
  (date: IsoDate): number;
  from: IsoDate;
  to: IsoDate;
  days: number;
  /** Nearest calendar day for a pixel position. */
  invert: (position: number) => IsoDate;
}

export function dateScale(
  from: IsoDate,
  to: IsoDate,
  range: readonly [number, number],
): DateScale {
  const days = Math.max(1, daysBetween(from, to));
  const x = linearScale([0, days], range);
  const scale = ((date: IsoDate) => x(daysBetween(from, date))) as DateScale;
  scale.from = from;
  scale.to = to;
  scale.days = days;
  scale.invert = (position) =>
    addDays(from, Math.min(days, Math.max(0, Math.round(x.invert(position)))));
  return scale;
}

/** 4–6 evenly spaced dates (ends included) depending on the plot width. */
export function dateTicks(
  from: IsoDate,
  to: IsoDate,
  width: number,
): IsoDate[] {
  const days = daysBetween(from, to);
  if (days <= 0) return [from];
  const wanted = width < 300 ? 3 : width < 480 ? 4 : width < 760 ? 5 : 6;
  const count = Math.min(wanted, days + 1);
  return Array.from({ length: count }, (_, index) =>
    addDays(from, Math.round((days * index) / (count - 1))),
  );
}

/** Axis label: « 2 000 € », « −500 € ». */
export const axisEuro = (cents: number) =>
  formatEuro(cents, { cents: "never" });

/** Monospace glyph width at 12 px, used to size labels without measuring the DOM. */
export const MONO_CHAR = 7.2;
export const textWidth = (text: string, char = MONO_CHAR) => text.length * char;
