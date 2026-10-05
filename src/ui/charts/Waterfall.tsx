import type { ReactNode } from "react";
import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import { Money } from "../Money";
import "./Waterfall.css";

export interface WaterfallRow {
  key: string;
  label: ReactNode;
  /** base/total: absolute amount · step: signed change. */
  value: Cents;
  kind: "base" | "step" | "total";
  /** Replaces the formatted amount, e.g. an EditableMoney. */
  amount?: ReactNode;
  /** Rendered under the row, e.g. a disclosure listing the charges. */
  detail?: ReactNode;
}

export interface WaterfallProps {
  rows: readonly WaterfallRow[];
  label: string;
}

export function Waterfall({ rows, label }: WaterfallProps) {
  let running = 0;
  const spans = rows.map((row) => {
    if (row.kind === "step") {
      const from = running;
      running += row.value;
      return [from, running] as const;
    }
    running = row.value;
    return [0, row.value] as const;
  });
  const ends = spans.flat();
  const min = Math.min(0, ...ends);
  const max = Math.max(1, ...ends);
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <ol className="ui-waterfall" aria-label={label}>
      {rows.map((row, i) => {
        const [a, b] = spans[i];
        const start = pos(Math.min(a, b));
        const size = Math.max(0.5, pos(Math.max(a, b)) - start);
        const sign =
          row.kind === "step"
            ? row.value < 0
              ? "−"
              : "+"
            : row.kind === "total"
              ? "="
              : "";
        return (
          <li
            key={row.key}
            className="ui-waterfall-row"
            data-kind={row.kind}
            data-negative={b < 0 || undefined}
          >
            <span className="ui-waterfall-label">
              {sign && (
                <span className="ui-waterfall-sign" aria-hidden>
                  {sign}
                </span>
              )}
              {row.label}
            </span>
            <span className="ui-waterfall-amount">
              {row.amount ?? (
                <Money
                  value={row.kind === "step" ? Math.abs(row.value) : row.value}
                  size={row.kind === "total" ? "m" : "s"}
                  tone={row.kind === "total" ? "auto" : "none"}
                  cents="never"
                  aria-label={
                    row.kind === "step"
                      ? `${row.value < 0 ? "moins" : "plus"} ${formatEuro(Math.abs(row.value))}`
                      : undefined
                  }
                />
              )}
            </span>
            <span className="ui-waterfall-track" aria-hidden>
              <span
                className="ui-waterfall-bar"
                style={{ left: `${start}%`, width: `${size}%` }}
              />
            </span>
            {row.detail && (
              <div className="ui-waterfall-detail">{row.detail}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
