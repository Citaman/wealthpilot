import { useState, useMemo, useRef, useEffect } from "react";
import { euro, dateLabel } from "./domain";
import { notableDays, type CashMovement } from "./chart-events";
import "./chart-events.css";
import { bucketKey, type Granularity } from "./periods";
function MovementDetails({ point }: { point: Point }) {
  const [limit, setLimit] = useState(20);
  return (
    <section
      className="chart-day-detail"
      aria-label={`Mouvements ${point.periodStart ? `depuis le ${dateLabel(point.periodStart)} jusqu’au` : "du"} ${dateLabel(point.date)}`}
    >
      <p>
        {point.future ? "Prévision partielle" : "Opérations importées"}
        {point.periodStart
          ? ` · ${dateLabel(point.periodStart)} → ${dateLabel(point.date)}`
          : ""}
        {!!point.movements?.length && (
          <>
            {" "}
            · Variation expliquée :{" "}
            <strong>
              {euro(point.movements.reduce((n, m) => n + m.amount, 0))}
            </strong>
          </>
        )}
      </p>
      <ul>
        {point.movements?.length
          ? point.movements.slice(0, limit).map((movement) => (
              <li key={movement.id}>
                <span>
                  <b>{movement.label}</b>
                  <small>
                    {movement.account} ·{" "}
                    {
                      {
                        transfer: "Virement interne",
                        income: "Entrée",
                        adjustment: "Écart d’ancrage · pas une transaction",
                        provision: "Provision · pas une transaction",
                        expense: "Sortie",
                      }[movement.kind]
                    }
                    {movement.estimated ? " · Estimation" : ""}
                  </small>
                </span>
                <strong>
                  {movement.amount > 0 ? "+" : ""}
                  {euro(movement.amount)}
                </strong>
              </li>
            ))
          : point.events?.map((event, i) => <li key={i}>{event}</li>)}
      </ul>
      {(point.movements?.length ?? 0) > limit && (
        <button className="text-button" onClick={() => setLimit((n) => n + 20)}>
          Afficher les mouvements suivants ({point.movements!.length - limit})
        </button>
      )}
    </section>
  );
}
export interface Point {
  date: string;
  value: number;
  future: boolean;
  lower?: number;
  upper?: number;
  uncertain?: boolean;
  events?: string[];
  movements?: CashMovement[];
  periodStart?: string;
}
// Closing balances, never sums. Keep the opening anchor and separate observed
// points from forecasts even when both fall in the same week/month.
export function aggregatePoints(
  points: Point[],
  granularity: Granularity,
): Point[] {
  if (granularity === "day" || points.length < 2) return points;
  const groups = new Map<string, Point>();
  for (const point of points.slice(1)) {
    const key = `${bucketKey(point.date, granularity)}|${point.future}`;
    const previous = groups.get(key);
    groups.set(key, {
      ...point,
      periodStart: previous?.periodStart ?? point.date,
      uncertain: point.uncertain || previous?.uncertain,
      movements: [...(previous?.movements ?? []), ...(point.movements ?? [])],
      events: [
        ...new Set([...(previous?.events ?? []), ...(point.events ?? [])]),
      ],
    });
  }
  return [points[0], ...groups.values()];
}
// Keep end dates visible, with enough physical space for every intermediate label.
export function chartTicks(length: number, width: number): number[] {
  if (!length) return [];
  if (length === 1) return [0];
  let count = Math.min(
    length,
    Math.max(2, Math.min(12, Math.floor((width - 100) / 76) + 1)),
  );
  let ticks: number[];
  do {
    ticks = Array.from({ length: count }, (_, i) =>
      Math.round((i * (length - 1)) / (count - 1)),
    );
    if (
      count <= 2 ||
      ticks
        .slice(1)
        .every(
          (tick, i) => ((tick - ticks[i]) * (width - 100)) / (length - 1) >= 76,
        )
    )
      return ticks;
    count--;
  } while (count >= 2);
  return ticks;
}
export function BalanceChart({
  points,
  safety,
  showTable,
  mode = "balance",
  visual = "line",
}: {
  points: Point[];
  safety: number;
  showTable: boolean;
  mode?: "balance" | "flow";
  visual?: "line" | "area" | "columns";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [notableLimit, setNotableLimit] = useState(5);
  const notables = useMemo(() => notableDays(points), [points]);
  const [width, setWidth] = useState(1000);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry?.contentRect.width)
        setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const plotWidth = width - 100;
  const ticks = new Set(chartTicks(points.length, width));
  const g = useMemo(() => {
    const vals = points.flatMap((p) => [
      p.value,
      p.lower ?? p.value,
      p.upper ?? p.value,
    ]);
    const min = Math.min(0, safety, ...vals);
    const max = Math.max(10000, safety, ...vals);
    const pad = (max - min) * 0.12;
    const lo = min - pad,
      hi = max + pad;
    return {
      x: (i: number) => 64 + (i * plotWidth) / Math.max(1, points.length - 1),
      y: (v: number) => 250 - ((v - lo) / (hi - lo)) * 210,
      lo,
      hi,
    };
  }, [points, safety, plotWidth]);
  const active =
    points[
      (hover !== null && hover < points.length ? hover : null) ??
        Math.max(
          0,
          points.findLastIndex((p) => !p.future),
        )
    ];
  const historical = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => !p.future);
  const future = points.map((p, i) => ({ ...p, i })).filter((p) => p.future);
  if (historical.length && future.length) future.unshift(historical.at(-1)!);
  const line = (p: typeof historical) =>
    p.map((v, n) => (n ? "L" : "M") + g.x(v.i) + "," + g.y(v.value)).join(" ");
  const known = historical.filter((p) => !p.uncertain);
  const historicalLine = known
    .map(
      (v, n) =>
        (n && known[n - 1].i === v.i - 1 ? "L" : "M") +
        g.x(v.i) +
        "," +
        g.y(v.value),
    )
    .join(" ");
  const band = future.length
    ? future
        .map(
          (p, i) => (i ? "L" : "M") + g.x(p.i) + "," + g.y(p.upper ?? p.value),
        )
        .join(" ") +
      future
        .toReversed()
        .map((p) => "L" + g.x(p.i) + "," + g.y(p.lower ?? p.value))
        .join(" ") +
      "Z"
    : "";
  let previousLabel = -Infinity;
  const annotations = notables.map((n) => {
    const showLabel = g.x(n.index) - previousLabel > 135;
    if (showLabel) previousLabel = g.x(n.index);
    return { ...n, showLabel };
  });
  const entries: Array<
    Omit<(typeof notables)[number], "largest"> & { largest?: CashMovement }
  > = notables.filter(
    (entry, i) => i < notableLimit || entry.point.date === expandedDate,
  );
  const extra = points.find(
    (point) =>
      point.date === expandedDate &&
      !notables.some((entry) => entry.point.date === point.date),
  );
  if (extra)
    entries.push({
      point: extra,
      index: points.indexOf(extra),
      extrema: undefined,
      significant: false,
      change: 0,
      largest: extra.movements?.[0],
    });
  entries.sort((a, b) => a.point.date.localeCompare(b.point.date));
  return (
    <>
      <div
        className="chart-wrap"
        ref={container}
        tabIndex={0}
        role="group"
        aria-label="Explorer les périodes du graphique avec les flèches"
        onKeyDown={(event) => {
          if (
            !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) ||
            !points.length
          )
            return;
          event.preventDefault();
          const current = active ? points.indexOf(active) : 0;
          setHover(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? points.length - 1
                : Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      current + (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
          );
        }}
      >
        <svg
          viewBox={`0 0 ${width} 290`}
          role="img"
          aria-label={`${mode === "flow" ? "Flux net cumulé" : "Évolution du solde"}, détails disponibles dans le tableau`}
        >
          {[0, 1, 2, 3].map((i) => {
            const v = g.lo + ((g.hi - g.lo) * i) / 3;
            return (
              <g key={i}>
                <line
                  x1="64"
                  x2={width - 36}
                  y1={g.y(v)}
                  y2={g.y(v)}
                  className="gridline"
                />
                <text x="54" y={g.y(v) + 4} textAnchor="end">
                  {euro(Math.round(v / 100) * 100)}
                </text>
              </g>
            );
          })}
          <line
            x1="64"
            x2={width - 36}
            y1={g.y(safety)}
            y2={g.y(safety)}
            className="safety-line"
          />
          <path d={band} fill="var(--series-2, var(--cyan))" opacity="0.16" />
          {visual === "area" && historical.length > 0 && (
            <path
              d={`${line(historical)} L${g.x(historical.at(-1)!.i)},${g.y(0)} L${g.x(historical[0].i)},${g.y(0)} Z`}
              fill="currentColor"
              opacity="0.09"
            />
          )}
          {visual === "columns" &&
            points.map((p, i) => (
              <rect
                key={p.date}
                x={
                  g.x(i) -
                  Math.min(12, (plotWidth / Math.max(1, points.length)) * 0.3)
                }
                y={g.y(Math.max(0, p.value))}
                width={Math.min(
                  24,
                  (plotWidth / Math.max(1, points.length)) * 0.6,
                )}
                height={Math.max(1, Math.abs(g.y(p.value) - g.y(0)))}
                rx="2"
                fill={
                  p.future ? "var(--series-2, var(--cyan))" : "currentColor"
                }
                opacity={p.uncertain ? 0.25 : 0.65}
              />
            ))}
          {visual !== "columns" && (
            <>
              <path
                d={line(historical)}
                className="forecast-line"
                opacity=".45"
              />
              <path d={historicalLine} className="actual-line" />
              <path d={line(future)} className="forecast-line" />
            </>
          )}
          <text x={width - 38} y={g.y(safety) - 6} textAnchor="end">
            {mode === "flow" ? "Origine" : "Réserve"} {euro(safety)}
          </text>
          {annotations.map(
            ({ point: p, index, largest, extrema, showLabel }, i) => (
              <g key={p.date}>
                <circle
                  cx={g.x(index)}
                  cy={g.y(p.value)}
                  r="4"
                  fill="currentColor"
                />
                {showLabel && (
                  <text
                    x={Math.max(120, Math.min(width - 100, g.x(index)))}
                    y={Math.max(18, g.y(p.value) - (i % 2 ? 36 : 16))}
                    textAnchor="middle"
                  >
                    {largest
                      ? `${largest.label.slice(0, 21)} ${largest.amount > 0 ? "+" : ""}${euro(largest.amount)}`
                      : `${extrema ?? (p.future ? "Prévu" : "Solde")} ${euro(p.value)}`}
                  </text>
                )}
              </g>
            ),
          )}
          {points.map((p, i) => (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              <rect
                x={g.x(i) - plotWidth / (2 * points.length)}
                y="24"
                width={plotWidth / points.length}
                height="232"
                fill="transparent"
              />
              {ticks.has(i) && (
                <text
                  className="chart-date-tick"
                  x={g.x(i)}
                  y="278"
                  textAnchor="middle"
                >
                  {p.date.slice(8)} / {p.date.slice(5, 7)}
                </text>
              )}
            </g>
          ))}
          {active && (
            <g pointerEvents="none">
              <line
                x1={g.x(points.indexOf(active))}
                x2={g.x(points.indexOf(active))}
                y1="30"
                y2="250"
                stroke="#9b9485"
                strokeDasharray="4 5"
              />
              <circle
                cx={g.x(points.indexOf(active))}
                cy={g.y(active.value)}
                r="6"
                className={
                  active.future
                    ? "chart-marker forecast-marker"
                    : "chart-marker actual-marker"
                }
                fill={
                  active.future
                    ? "var(--series-2, var(--cyan))"
                    : "currentColor"
                }
                stroke="var(--cream)"
                strokeWidth="3"
              />
            </g>
          )}
        </svg>
      </div>
      <div className="chart-caption">
        <span>
          {active?.periodStart && active.periodStart !== active.date
            ? `${dateLabel(active.periodStart)} → `
            : ""}
          {active ? dateLabel(active.date) : ""}{" "}
          <strong>{active ? euro(active.value) : ""}</strong>{" "}
          {active?.future
            ? "· prévision sur échéances saisies et récurrences détectées"
            : "· calculé depuis les opérations importées"}
        </span>
        <button
          className="text-button"
          disabled={
            !active || !(active.movements?.length || active.events?.length)
          }
          onClick={() =>
            active &&
            setExpandedDate(expandedDate === active.date ? null : active.date)
          }
          aria-expanded={expandedDate === active?.date}
        >
          Détail des mouvements
        </button>
        <span>
          {mode === "flow"
            ? "Zéro = entrées et sorties équilibrées"
            : "Seuil " + euro(safety)}
        </span>
      </div>
      {points.some((p) => p.uncertain) && (
        <small>
          Segments pâles pointillés : couverture à vérifier, reconstruction
          hypothétique. Bande : scénarios prudent/favorable, pas une
          probabilité.
        </small>
      )}
      {entries.length > 0 && (
        <div className="chart-event-heading">
          <strong>Mouvements clés</strong>
          <span>{notables.length} repères · Ouvrir pour détailler</span>
        </div>
      )}
      {entries.length > 0 && (
        <nav
          className="chart-event-list"
          aria-label="Repères de l’évolution du solde"
        >
          {entries.map(({ point, index, largest, extrema }) => (
            <div className="chart-event-entry" key={point.date}>
              <button
                type="button"
                className="chart-event-toggle"
                aria-expanded={expandedDate === point.date}
                onClick={() => {
                  setHover(index);
                  setExpandedDate(
                    expandedDate === point.date ? null : point.date,
                  );
                }}
              >
                <span>
                  {dateLabel(point.date)}
                  {point.future ? " · Prévu" : ""}
                  {extrema ? ` · ${extrema}` : ""}
                </span>
                <strong>
                  {largest?.label ?? point.events?.[0] ?? extrema}
                </strong>
                <span>
                  {largest
                    ? `${largest.amount > 0 ? "+" : ""}${euro(largest.amount)} · ${largest.account}`
                    : euro(point.value)}
                  {(point.movements?.length ?? 0) > 1
                    ? ` · ${point.movements!.length} mouvements`
                    : ""}
                </span>
                <span aria-hidden="true">
                  {expandedDate === point.date ? "−" : "+"}
                </span>
              </button>
              {expandedDate === point.date && (
                <MovementDetails key={point.date} point={point as Point} />
              )}
            </div>
          ))}
          {notables.length > notableLimit && (
            <button
              className="text-button"
              onClick={() => setNotableLimit((limit) => limit + 10)}
            >
              Afficher {Math.min(10, notables.length - notableLimit)} autres
              repères
            </button>
          )}
        </nav>
      )}
      {showTable && (
        <div className="scroll-table chart-table" tabIndex={0}>
          <table>
            <caption>Valeurs du graphique</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Type</th>
                <th>Mouvements</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{dateLabel(p.date)}</td>
                  <td>{euro(p.value)}</td>
                  <td>{p.future ? "Prévision partielle" : "Calculé"}</td>
                  <td>{p.events?.join(" ; ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
