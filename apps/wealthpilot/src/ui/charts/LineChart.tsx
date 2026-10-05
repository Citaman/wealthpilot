import { useMemo, type PointerEvent } from "react";
import { formatWeekday, formatDay } from "../../domain/dates";
import { formatEuro } from "../../domain/money";
import type { Cents, IsoDate } from "../../domain/types";
import { useMeasure } from "../useMeasure";
import { placeAnnotations, type Box } from "./annotations";
import { DataTable } from "./DataTable";
import {
  axisEuro,
  dateScale,
  dateTicks,
  linearScale,
  niceTicks,
  textWidth,
} from "./scales";
import { useCursor } from "./useCursor";
import "./charts.css";

export interface LinePoint {
  date: IsoDate;
  value: Cents | null;
}

export interface LineSeries {
  id: string;
  label: string;
  points: readonly LinePoint[];
  /** observed: solid ink · forecast: cyan dashed · context: thin coloured line. */
  kind?: "observed" | "forecast" | "context";
  color?: string;
}

export interface LineChartProps {
  series: readonly LineSeries[];
  band?: readonly { date: IsoDate; low: Cents; high: Cents }[];
  threshold?: { value: Cents; label: string };
  today?: IsoDate;
  annotations?: readonly { date: IsoDate; value: Cents; label: string }[];
  /** Plot height; defaults by measured width (280 / 180 / 110). */
  height?: number;
  /** Accessible summary, e.g. « Solde du foyer, 18 sept. → 31 oct. ». */
  label: string;
  /** Bubble text for a date; defaults to « mer. 14 oct. · 2 440 € ». */
  describe?: (date: IsoDate) => string;
  onSelect?: (date: IsoDate) => void;
}

const M = { top: 10, right: 10, bottom: 26, gap: 10 };
const LABEL_H = 22;

const linePath = (points: { x: number; y: number }[]) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join("");

export function LineChart({
  series,
  band,
  threshold,
  today,
  annotations = [],
  height,
  label,
  describe,
  onSelect,
}: LineChartProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const plotHeight =
    height ??
    Math.min(
      width > 640 ? 280 : width >= 360 ? 180 : 110,
      Math.max(
        110,
        Math.round(
          (typeof window === "undefined" ? 800 : window.innerHeight) * 0.4,
        ),
      ),
    );

  const lines = useMemo(() => withTodayJoin(series, today), [series, today]);
  const dates = useMemo(() => {
    const all = new Set<IsoDate>();
    lines.forEach((s) => s.points.forEach((p) => all.add(p.date)));
    band?.forEach((p) => all.add(p.date));
    return [...all].sort();
  }, [lines, band]);

  const valueAt = useMemo(() => {
    const maps = lines.map(
      (s) => new Map(s.points.map((p) => [p.date, p.value])),
    );
    return (date: IsoDate) =>
      lines.map((s, i) => ({ series: s, value: maps[i].get(date) ?? null }));
  }, [lines]);

  const geometry = useMemo(() => {
    if (!width || !dates.length) return null;
    const values = lines
      .flatMap((s) => s.points.map((p) => p.value))
      .filter((v): v is number => v !== null);
    band?.forEach((p) => values.push(p.low, p.high));
    if (threshold) values.push(threshold.value);
    const ticks = niceTicks(
      Math.min(...values),
      Math.max(...values),
      plotHeight < 140 ? 3 : 4,
    );
    const left = Math.max(...ticks.map((t) => textWidth(axisEuro(t)))) + M.gap;
    const right = width - M.right;
    const top = M.top;
    const bottom = M.top + plotHeight;
    const x = dateScale(dates[0], dates[dates.length - 1], [left, right]);
    const y = linearScale([ticks[0], ticks[ticks.length - 1]], [bottom, top]);
    return { ticks, left, right, top, bottom, x, y };
  }, [width, dates, lines, band, threshold, plotHeight]);

  const todayIndex = today ? dates.indexOf(today) : -1;
  const cursor = useCursor(
    dates.length,
    onSelect ? (i) => onSelect(dates[i]) : undefined,
    todayIndex >= 0 ? todayIndex : undefined,
  );

  const text = (date: IsoDate) => {
    if (describe) return describe(date);
    const distinct = [
      ...new Set(
        valueAt(date)
          .filter((v) => v.value !== null)
          .map((v) => v.value),
      ),
    ];
    return [
      formatWeekday(date),
      ...distinct.map((v) => formatEuro(v as number, { cents: "never" })),
    ].join(" · ");
  };

  if (!geometry)
    return (
      <div
        ref={ref}
        className="ui-chart"
        style={{ height: plotHeight + M.top + M.bottom }}
      />
    );

  const { ticks, left, right, top, bottom, x, y } = geometry;
  const svgHeight = bottom + M.bottom;

  const thresholdBox: Box | null = threshold
    ? {
        x: right - textWidth(threshold.label) - 4,
        y: y(threshold.value) - 18,
        width: textWidth(threshold.label) + 4,
        height: 16,
      }
    : null;

  const placed = placeAnnotations(
    annotations.slice(0, 4).map((a, i) => ({
      id: String(i),
      x: x(a.date),
      y: y(a.value),
      label: a.label,
    })),
    {
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
      obstacles: thresholdBox ? [thresholdBox] : [],
      maxWidth: Math.max(80, Math.min(180, (right - left) / 2.2)),
      height: LABEL_H,
    },
  );

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    let best = 0;
    for (let i = 1; i < dates.length; i++)
      if (Math.abs(x(dates[i]) - px) < Math.abs(x(dates[best]) - px)) best = i;
    cursor.setIndex(best);
  };

  const active = cursor.index === null ? null : dates[cursor.index];
  const activeValues = active
    ? valueAt(active).filter((v) => v.value !== null)
    : [];
  const bubbleText = active ? text(active) : "";
  const bubbleWidth = textWidth(bubbleText) + 20;
  const bubbleTop = activeValues.length
    ? Math.min(...activeValues.map((v) => y(v.value as number))) - 14
    : top + 20;
  const bubbleLeft = active
    ? Math.min(
        Math.max(x(active), left + bubbleWidth / 2),
        width - bubbleWidth / 2,
      )
    : 0;

  return (
    <div ref={ref} className="ui-chart">
      <div
        className="ui-chart-plot"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={dates.length - 1}
        aria-valuenow={cursor.index ?? undefined}
        aria-valuetext={active ? bubbleText : undefined}
        data-clickable={onSelect ? true : undefined}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onClick={() => active && onSelect?.(active)}
        {...cursor.handlers}
      >
        <svg width={width} height={svgHeight} aria-hidden>
          <g className="ui-chart-grid">
            {ticks.map((t, i) => (
              <line
                key={t}
                x1={left}
                x2={right}
                y1={y(t)}
                y2={y(t)}
                data-base={i === 0 || undefined}
              />
            ))}
          </g>
          <g className="ui-chart-axis" data-axis="y">
            {ticks.map((t) => (
              <text key={t} x={left - M.gap} y={y(t) + 4} textAnchor="end">
                {axisEuro(t)}
              </text>
            ))}
          </g>
          <g className="ui-chart-axis" data-axis="x">
            {dateTicks(x.from, x.to, right - left).map((d, i, all) => (
              <text
                key={d}
                x={x(d)}
                y={bottom + 18}
                textAnchor={
                  i === 0 ? "start" : i === all.length - 1 ? "end" : "middle"
                }
              >
                {formatDay(d)}
              </text>
            ))}
          </g>
          {band && band.length > 1 && (
            <path
              className="ui-chart-band"
              d={
                linePath(band.map((p) => ({ x: x(p.date), y: y(p.high) }))) +
                linePath(
                  [...band]
                    .reverse()
                    .map((p) => ({ x: x(p.date), y: y(p.low) })),
                ).replace(/^M/, "L") +
                "Z"
              }
            />
          )}
          {threshold && (
            <g className="ui-chart-threshold">
              <line
                x1={left}
                x2={right}
                y1={y(threshold.value)}
                y2={y(threshold.value)}
              />
              <text x={right} y={y(threshold.value) - 6} textAnchor="end">
                {threshold.label}
              </text>
            </g>
          )}
          {lines.map((s) => (
            <SeriesLine key={s.id} series={s} x={x} y={y} />
          ))}
          {today && todayIndex >= 0 && (
            <g className="ui-chart-today">
              <line x1={x(today)} x2={x(today)} y1={top} y2={bottom} />
              {valueAt(today)
                .filter((v) => v.value !== null && v.series.kind !== "context")
                .slice(0, 1)
                .map((v) => (
                  <circle
                    key={v.series.id}
                    cx={x(today)}
                    cy={y(v.value as number)}
                    r={4.5}
                  />
                ))}
            </g>
          )}
          <g className="ui-chart-annotations">
            {placed.map((p) => {
              const forecast = today
                ? annotations[Number(p.id)].date > today
                : false;
              const edgeY =
                p.side === "above" ? p.box.y + p.box.height : p.box.y;
              const edgeX = Math.min(
                Math.max(p.anchor.x, p.box.x + 6),
                p.box.x + p.box.width - 6,
              );
              return (
                <g key={p.id} data-forecast={forecast || undefined}>
                  {p.connector && (
                    <line
                      x1={p.anchor.x}
                      y1={p.anchor.y}
                      x2={edgeX}
                      y2={edgeY}
                    />
                  )}
                  <circle cx={p.anchor.x} cy={p.anchor.y} r={5} />
                  <rect
                    x={p.box.x}
                    y={p.box.y}
                    width={p.box.width}
                    height={p.box.height}
                    rx={6}
                  />
                  <text
                    x={p.box.x + p.box.width / 2}
                    y={p.box.y + 15}
                    textAnchor="middle"
                  >
                    {p.text}
                  </text>
                  <title>{annotations[Number(p.id)].label}</title>
                </g>
              );
            })}
          </g>
          {active && (
            <g className="ui-chart-cursor">
              <line x1={x(active)} x2={x(active)} y1={top} y2={bottom} />
              {activeValues.map((v) => (
                <circle
                  key={v.series.id}
                  cx={x(active)}
                  cy={y(v.value as number)}
                  r={4}
                  data-kind={v.series.kind ?? "observed"}
                />
              ))}
            </g>
          )}
        </svg>
        {active && (
          <div
            className="ui-chart-bubble"
            style={{ left: bubbleLeft, top: Math.max(28, bubbleTop) }}
            aria-hidden
          >
            {bubbleText}
          </div>
        )}
      </div>
      <DataTable
        caption={label}
        columns={["Date", ...lines.map((s) => s.label)]}
        rows={dates.map((d) => [
          formatWeekday(d),
          ...valueAt(d).map((v) =>
            v.value === null ? "—" : formatEuro(v.value),
          ),
        ])}
      />
    </div>
  );
}

/** A forecast that starts after today is joined to the observed value of today. */
function withTodayJoin(
  series: readonly LineSeries[],
  today?: IsoDate,
): LineSeries[] {
  if (!today) return [...series];
  const observed = series.find((s) => (s.kind ?? "observed") === "observed");
  const anchor = observed?.points.find(
    (p) => p.date === today && p.value !== null,
  );
  return series.map((s) => {
    if (s.kind !== "forecast" || !anchor || !s.points.length) return s;
    const first = s.points.find((p) => p.value !== null);
    if (!first || first.date <= today) return s;
    return {
      ...s,
      points: [anchor, ...s.points.filter((p) => p.date > today)],
    };
  });
}

function SeriesLine({
  series,
  x,
  y,
}: {
  series: LineSeries;
  x: (date: IsoDate) => number;
  y: (value: number) => number;
}) {
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const p of series.points) {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ x: x(p.date), y: y(p.value) });
  }
  if (run.length) runs.push(run);
  const gaps = runs.slice(1).map((r, i) => [runs[i][runs[i].length - 1], r[0]]);
  const kind = series.kind ?? "observed";
  return (
    <g
      className="ui-chart-series"
      data-kind={kind}
      style={series.color ? { color: series.color } : undefined}
    >
      {gaps.map(([a, b], i) => (
        <line
          key={`gap-${i}`}
          className="ui-chart-gap"
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
        />
      ))}
      {runs.map((r, i) =>
        r.length === 1 ? (
          <circle
            key={i}
            cx={r[0].x}
            cy={r[0].y}
            r={2}
            className="ui-chart-dot"
          />
        ) : (
          <path key={i} d={linePath(r)} />
        ),
      )}
    </g>
  );
}
