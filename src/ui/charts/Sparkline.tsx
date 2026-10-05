import { useMeasure } from "../useMeasure";
import { linearScale } from "./scales";
import "./charts.css";

export interface SparklineProps {
  values: readonly (number | null)[];
  label: string;
  height?: number;
}

export function Sparkline({ values, label, height = 36 }: SparklineProps) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const known = values.filter((v): v is number => v !== null);
  const pad = 4;
  const x = linearScale(
    [0, Math.max(1, values.length - 1)],
    [pad, Math.max(pad, width - pad)],
  );
  const y = linearScale(
    [Math.min(...known), Math.max(...known)],
    [height - pad, pad],
  );
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${i && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const lastIndex = values.findLastIndex((v) => v !== null);
  return (
    <div ref={ref} className="ui-sparkline" style={{ height }}>
      {width > 0 && known.length > 1 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          <path d={d} />
          <circle cx={x(lastIndex)} cy={y(values[lastIndex] as number)} r={3} />
        </svg>
      )}
    </div>
  );
}
