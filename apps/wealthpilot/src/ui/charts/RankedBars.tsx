import type { CSSProperties } from "react";
import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import { Badge } from "../Badge";
import { CategoryDot } from "../CategoryDot";
import { Money } from "../Money";
import "./RankedBars.css";

export interface RankedRow {
  key: string;
  label: string;
  amount: Cents;
  /** 0–1 share of the total. */
  share: number;
  color: string;
  /** Usual amount (e.g. 3-month median), drawn as a thin reference tick. */
  usual?: Cents | null;
  /** Shown as « +42 % vs habitude » when provided. */
  deltaPct?: number | null;
}

export interface RankedBarsProps {
  rows: readonly RankedRow[];
  label: string;
  onSelect?: (key: string) => void;
}

const percent = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value * 100)} %`;

export function RankedBars({ rows, label, onSelect }: RankedBarsProps) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.amount, r.usual ?? 0)));
  return (
    <ol className="ui-ranked" aria-label={label}>
      {rows.map((row) => {
        const content = (
          <>
            <span className="ui-ranked-head">
              <CategoryDot color={row.color} size={10} />
              <span className="ui-ranked-label">{row.label}</span>
              {row.deltaPct != null && (
                <Badge tone={row.deltaPct > 0 ? "warning" : "positive"}>
                  {row.deltaPct > 0 ? "+" : "−"}
                  {percent(Math.abs(row.deltaPct) / 100)} vs habitude
                </Badge>
              )}
              <Money
                className="ui-ranked-amount"
                value={row.amount}
                size="s"
                tone="none"
              />
              <span className="ui-ranked-share">{percent(row.share)}</span>
            </span>
            <span className="ui-ranked-track" aria-hidden>
              <span
                className="ui-ranked-fill"
                style={
                  {
                    width: `${(row.amount / max) * 100}%`,
                    "--bar": row.color,
                  } as CSSProperties
                }
              />
              {row.usual != null && (
                <span
                  className="ui-ranked-usual"
                  style={{ left: `${(row.usual / max) * 100}%` }}
                  title={`Habitude ${formatEuro(row.usual)}`}
                />
              )}
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {onSelect ? (
              <button
                type="button"
                className="ui-ranked-row"
                onClick={() => onSelect(row.key)}
                aria-label={`${row.label} : ${formatEuro(row.amount)}, ${percent(row.share)}${row.usual != null ? `, habitude ${formatEuro(row.usual)}` : ""}${row.deltaPct != null ? `, ${row.deltaPct > 0 ? "+" : "−"}${percent(Math.abs(row.deltaPct) / 100)} vs habitude` : ""}`}
              >
                {content}
              </button>
            ) : (
              <div className="ui-ranked-row">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
