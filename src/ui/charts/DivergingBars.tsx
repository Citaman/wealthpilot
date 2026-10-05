import { useId, type PointerEvent } from "react";
import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import { useMeasure } from "../useMeasure";
import { Bubble, HatchPattern, hatchId } from "./Bubble";
import { DataTable } from "./DataTable";
import { axisEuro, linearScale, niceTicks, textWidth } from "./scales";
import { useCursor } from "./useCursor";
import "./charts.css";

export interface FlowBar {
  key: string;
  /** Short axis label, e.g. « Oct. ». */
  label: string;
  /** Long label for the bubble and table, e.g. « Octobre ». */
  title?: string;
  income: Cents;
  /** Magnitude of the spending (positive). */
  spending: Cents;
  incomplete?: boolean;
}

export interface DivergingBarsProps {
  data: readonly FlowBar[];
  label: string;
  onSelect?: (key: string) => void;
  height?: number;
}

const signed = (value: Cents) =>
  formatEuro(value, { signed: true, cents: "never" });

/** Path of a vertical bar from y0 to y1 with the far end rounded. */
function bar(x: number, y0: number, y1: number, width: number, radius: number) {
  const h = Math.abs(y1 - y0);
  const r = Math.min(radius, width / 2, h);
  const dir = y1 < y0 ? 1 : -1;
  return [
    `M${x},${y0}`,
    `V${y1 + dir * r}`,
    `Q${x},${y1} ${x + r},${y1}`,
    `H${x + width - r}`,
    `Q${x + width},${y1} ${x + width},${y1 + dir * r}`,
    `V${y0}`,
    "Z",
  ].join("");
}

export function DivergingBars({
  data,
  label,
  onSelect,
  height,
}: DivergingBarsProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const pattern = hatchId(useId());
  const cursor = useCursor(
    data.length,
    onSelect ? (i) => onSelect(data[i].key) : undefined,
  );
  const plotHeight = height ?? (width > 640 ? 220 : width >= 360 ? 170 : 130);
  const top = 12;
  const bottom = top + plotHeight;

  const rows = data.map((d) => ({ ...d, net: d.income - d.spending }));
  const ticks = niceTicks(
    Math.min(0, ...rows.map((d) => -d.spending), ...rows.map((d) => d.net)),
    Math.max(0, ...rows.map((d) => d.income), ...rows.map((d) => d.net)),
    5,
  );
  const left = Math.max(...ticks.map((t) => textWidth(axisEuro(t)))) + 10;
  const right = width - 4;
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [bottom, top]);
  const band = (right - left) / Math.max(1, rows.length);
  const barWidth = Math.max(4, band * 0.6);
  const cx = (i: number) => left + band * i + band / 2;

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
    cursor.setIndex(
      Math.min(rows.length - 1, Math.max(0, Math.floor((px - left) / band))),
    );
  };

  const active = cursor.index === null ? null : rows[cursor.index];
  const tableRows = rows.map((d) => [
    d.title ?? d.label,
    formatEuro(d.income),
    formatEuro(-d.spending),
    signed(d.net),
  ]);

  return (
    <div ref={ref} className="ui-chart" style={{ minHeight: bottom + 28 }}>
      {width > 0 && (
        <div
          className="ui-chart-plot"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={rows.length - 1}
          aria-valuenow={cursor.index ?? undefined}
          aria-valuetext={
            active
              ? `${active.title ?? active.label} : entrées ${formatEuro(active.income)}, sorties ${formatEuro(active.spending)}, net ${signed(active.net)}`
              : undefined
          }
          data-clickable={onSelect ? true : undefined}
          data-active={active ? true : undefined}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onClick={() => active && onSelect?.(active.key)}
          {...cursor.handlers}
        >
          <svg width={width} height={bottom + 28} aria-hidden>
            <defs>
              <HatchPattern id={pattern} />
            </defs>
            <g className="ui-chart-grid">
              {ticks.map((t) => (
                <line
                  key={t}
                  x1={left}
                  x2={right}
                  y1={y(t)}
                  y2={y(t)}
                  data-base={t === 0 || undefined}
                />
              ))}
            </g>
            <g className="ui-chart-axis">
              {ticks.map((t) => (
                <text key={t} x={left - 10} y={y(t) + 4} textAnchor="end">
                  {axisEuro(t)}
                </text>
              ))}
              {rows.map((d, i) => (
                <text key={d.key} x={cx(i)} y={bottom + 20} textAnchor="middle">
                  {d.label}
                </text>
              ))}
            </g>
            {rows.map((d, i) => {
              const x = cx(i) - barWidth / 2;
              return (
                <g
                  key={d.key}
                  className="ui-flow-bar"
                  data-dim={active && active !== d ? true : undefined}
                  data-incomplete={d.incomplete || undefined}
                >
                  {d.income > 0 && (
                    <path
                      className="ui-flow-income"
                      d={bar(x, y(0), y(d.income), barWidth, 6)}
                    />
                  )}
                  {d.spending > 0 && (
                    <path
                      className="ui-flow-spending"
                      d={bar(x, y(0), y(-d.spending), barWidth, 6)}
                    />
                  )}
                  {d.incomplete &&
                    [d.income, -d.spending]
                      .filter(Boolean)
                      .map((v) => (
                        <path
                          key={v}
                          className="ui-flow-hatch"
                          d={bar(x, y(0), y(v), barWidth, 6)}
                          fill={`url(#${pattern})`}
                        />
                      ))}
                </g>
              );
            })}
            <polyline
              className="ui-flow-net-line"
              points={rows.map((d, i) => `${cx(i)},${y(d.net)}`).join(" ")}
            />
            {rows.map((d, i) => (
              <circle
                key={d.key}
                className="ui-flow-net"
                cx={cx(i)}
                cy={y(d.net)}
                r={4.5}
              />
            ))}
          </svg>
          {active && (
            <Bubble
              x={Math.min(Math.max(cx(cursor.index!), 90), width - 90)}
              y={Math.max(56, y(active.income) - 8)}
            >
              <strong>{active.title ?? active.label}</strong>
              {active.incomplete && " · en cours"}
              <br />
              Entrées {formatEuro(active.income, { cents: "never" })}
              <br />
              Sorties {formatEuro(-active.spending, { cents: "never" })}
              <br />
              Net {signed(active.net)}
            </Bubble>
          )}
        </div>
      )}
      <DataTable
        caption={label}
        columns={["Mois", "Entrées", "Sorties", "Net"]}
        rows={tableRows}
      />
    </div>
  );
}
