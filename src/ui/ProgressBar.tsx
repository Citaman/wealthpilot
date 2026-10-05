import type { CSSProperties } from "react";
import { formatEuro } from "../domain/money";
import type { Cents } from "../domain/types";
import "./ProgressBar.css";

export interface ProgressBarProps {
  paid: Cents;
  committed?: Cents;
  total: Cents;
  /** Category colour of the filled part. */
  color?: string;
  /** Subject of the accessible label, e.g. « Courses ». */
  label: string;
  showPercent?: boolean;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? (part / whole) * 100 : 0;

export function ProgressBar({
  paid,
  committed = 0,
  total,
  color = "var(--card-text)",
  label,
  showPercent = false,
}: ProgressBarProps) {
  const used = paid + committed;
  const over = total > 0 ? used > total : used > 0;
  const scale = Math.max(total, used, 1);
  const percent = total > 0 ? Math.round((used / total) * 100) : null;
  const spoken = [
    `${label} : payé ${formatEuro(paid)}`,
    committed ? `engagé ${formatEuro(committed)}` : null,
    `sur ${formatEuro(total)}`,
    over ? `dépassé de ${formatEuro(used - total)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="ui-progress" data-over={over || undefined}>
      <div
        className="ui-progress-bar"
        role="img"
        aria-label={spoken}
        style={{ "--bar": color } as CSSProperties}
      >
        <div className="ui-progress-track">
          <span
            className="ui-progress-paid"
            style={{ width: `${pct(paid, scale)}%` }}
          />
          {committed > 0 && (
            <span
              className="ui-progress-committed"
              style={{ width: `${pct(committed, scale)}%` }}
            />
          )}
        </div>
        {over && total > 0 && (
          <span
            className="ui-progress-limit"
            style={{ left: `${pct(total, scale)}%` }}
          />
        )}
      </div>
      {showPercent && (
        <span className="ui-progress-percent" aria-hidden>
          {percent === null ? "—" : `${percent} %`}
        </span>
      )}
    </div>
  );
}
