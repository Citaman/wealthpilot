import { Money } from "../../../ui/Money";
import "./Tile.css";

/** Reading tile under a chart: label, amount, short mono detail. */
export function Tile({
  label,
  value,
  meta,
  signed = false,
  alert = false,
}: {
  label: string;
  value: number;
  meta?: string;
  signed?: boolean;
  /** Negative amounts turn red (a low point under zero, a negative net). */
  alert?: boolean;
}) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <Money
        value={value}
        size="m"
        tone={alert || signed ? "auto" : "none"}
        signed={signed}
        cents="never"
      />
      {meta && <span className="mono muted">{meta}</span>}
    </div>
  );
}
