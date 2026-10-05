import type { ReactNode } from "react";
import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import { useMeasure } from "../useMeasure";
import "./ConcentricRings.css";

export interface Ring {
  key: string;
  label: string;
  value: Cents;
  max: Cents;
  color: string;
}

export interface ConcentricRingsProps {
  /** At most 5 rings, outermost first. */
  rings: readonly Ring[];
  label: string;
  center?: ReactNode;
  activeIndex?: number | null;
  onActiveChange?: (index: number | null) => void;
  /** Maximum diameter in px; the chart shrinks to its container. */
  size?: number;
}

const GAP = 6;

export function ConcentricRings({
  rings,
  label,
  center,
  activeIndex = null,
  onActiveChange,
  size = 280,
}: ConcentricRingsProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const shown = rings.slice(0, 5);
  const d = Math.min(size, width || size);
  const c = d / 2;
  // ~7 % of the diameter, thinner when needed to keep 40 % of the radius for the centre label.
  const thickness = Math.max(
    4,
    Math.min(d * 0.07, (c * 0.6) / Math.max(1, shown.length) - GAP),
  );
  const radius = (i: number) => c - thickness / 2 - 1 - i * (thickness + GAP);
  const summary = shown
    .map((r) => `${r.label} ${formatEuro(r.value)} sur ${formatEuro(r.max)}`)
    .join(", ");
  const innerRadius = radius(shown.length - 1) - thickness / 2;

  return (
    <div ref={ref} className="ui-rings" style={{ maxWidth: size }}>
      <svg
        width={d}
        height={d}
        viewBox={`0 0 ${d} ${d}`}
        role="img"
        aria-label={`${label} : ${summary}`}
        onPointerLeave={() => onActiveChange?.(null)}
      >
        {shown.map((ring, i) => {
          const r = radius(i);
          const ratio =
            ring.max > 0 ? ring.value / ring.max : ring.value > 0 ? 2 : 0;
          const over = ratio > 1;
          return (
            <g
              key={ring.key}
              className="ui-ring"
              data-dim={
                activeIndex !== null && activeIndex !== i ? true : undefined
              }
              data-over={over || undefined}
              style={{ color: ring.color }}
              onPointerEnter={() => onActiveChange?.(i)}
            >
              <circle
                className="ui-ring-track"
                cx={c}
                cy={c}
                r={r}
                strokeWidth={thickness}
              />
              {ratio > 0 && (
                <circle
                  className="ui-ring-outline"
                  cx={c}
                  cy={c}
                  r={r}
                  strokeWidth={thickness + 2}
                  pathLength={100}
                  strokeDasharray={over ? undefined : `${ratio * 100} 100`}
                  transform={`rotate(-90 ${c} ${c})`}
                />
              )}
              {ratio > 0 && (
                <circle
                  className="ui-ring-arc"
                  cx={c}
                  cy={c}
                  r={r}
                  strokeWidth={thickness}
                  pathLength={100}
                  strokeDasharray={over ? undefined : `${ratio * 100} 100`}
                  transform={`rotate(-90 ${c} ${c})`}
                />
              )}
              {over && (
                <circle
                  className="ui-ring-marker"
                  cx={c}
                  cy={c - r}
                  r={thickness / 2 + 1.5}
                />
              )}
            </g>
          );
        })}
      </svg>
      {center && (
        <div
          className="ui-rings-center"
          style={{ width: innerRadius * 2 * 0.86 }}
        >
          {center}
        </div>
      )}
    </div>
  );
}
