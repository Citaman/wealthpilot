import { formatDay } from "../domain/dates";
import type { IsoDate } from "../domain/types";
import "./DateChip.css";

export function DateChip({
  date,
  soon = false,
}: {
  date: IsoDate;
  soon?: boolean;
}) {
  const day = Number(date.slice(8, 10));
  const month = formatDay(date).replace(/^\d+\s*/, "");
  return (
    <span className="ui-date-chip" data-soon={soon || undefined}>
      <span className="ui-date-chip-day">{day}</span>
      <span className="ui-date-chip-month">{month}</span>
    </span>
  );
}
