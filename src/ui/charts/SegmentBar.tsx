import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import { Money } from "../Money";
import "./SegmentBar.css";

export interface SegmentBarProps {
  paid: Cents;
  committed: Cents;
  possible: Cents;
  label: string;
  legend?: boolean;
}

const parts = [
  { key: "paid", name: "Payé" },
  { key: "committed", name: "Engagé" },
  { key: "possible", name: "Possible" },
] as const;

export function SegmentBar({
  paid,
  committed,
  possible,
  label,
  legend = true,
}: SegmentBarProps) {
  const values = { paid, committed, possible: Math.max(0, possible) };
  const total = Math.max(1, values.paid + values.committed + values.possible);
  const spoken = parts
    .map((p) => `${p.name.toLowerCase()} ${formatEuro(values[p.key])}`)
    .join(", ");
  return (
    <div className="ui-segbar">
      <div
        className="ui-segbar-track"
        role="img"
        aria-label={`${label} : ${spoken}`}
      >
        {parts.map(
          (p) =>
            values[p.key] > 0 && (
              <span
                key={p.key}
                className="ui-segbar-part"
                data-kind={p.key}
                style={{ flexGrow: values[p.key] / total }}
              />
            ),
        )}
      </div>
      {legend && (
        <ul className="ui-segbar-legend" aria-hidden>
          {parts.map((p) => (
            <li key={p.key}>
              <span className="ui-segbar-swatch" data-kind={p.key} />
              <span className="ui-segbar-name">{p.name}</span>
              <Money value={values[p.key]} cents="never" tone="none" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
