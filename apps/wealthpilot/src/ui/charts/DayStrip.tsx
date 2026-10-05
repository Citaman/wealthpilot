import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { formatFullDay, formatWeekday } from "../../domain/dates";
import { formatEuro } from "../../domain/money";
import type { Cents, IsoDate } from "../../domain/types";
import "./DayStrip.css";

export interface DayItem {
  label: string;
  /** Magnitude (positive); the sign comes from charges vs incomes. */
  amount: Cents;
  estimated?: boolean;
}

export interface StripDay {
  date: IsoDate;
  spent?: Cents | null;
  charges?: readonly DayItem[];
  incomes?: readonly DayItem[];
  endBalance?: Cents | null;
}

export interface DayStripProps {
  days: readonly StripDay[];
  label: string;
  today?: IsoDate;
  selected?: IsoDate | null;
  onSelect?: (date: IsoDate) => void;
}

const euro = (value: Cents) => formatEuro(value, { cents: "never" });

function describe(day: StripDay) {
  const charges = day.charges ?? [];
  const incomes = day.incomes ?? [];
  return [
    formatFullDay(day.date),
    day.spent ? `dépensé ${euro(day.spent)}` : null,
    ...charges.map(
      (c) => `${c.label} −${euro(c.amount)}${c.estimated ? " estimé" : ""}`,
    ),
    ...incomes.map(
      (c) => `${c.label} +${euro(c.amount)}${c.estimated ? " estimé" : ""}`,
    ),
    day.endBalance != null
      ? `solde fin de journée ${euro(day.endBalance)}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function DayStrip({
  days,
  label,
  today,
  selected,
  onSelect,
}: DayStripProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const maxSpent = Math.max(1, ...days.map((d) => d.spent ?? 0));
  const focusIndex = Math.max(
    0,
    days.findIndex((d) => d.date === (selected ?? today)),
  );

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: days.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    refs.current[
      Math.min(days.length - 1, Math.max(0, moves[event.key]))
    ]?.focus();
  };

  return (
    <div className="ui-daystrip">
      <div className="ui-daystrip-grid" role="group" aria-label={label}>
        {days.map((day, index) => {
          const weekday = formatWeekday(day.date)
            .split(" ")[0]
            .replace(".", "");
          const dayNumber = Number(day.date.slice(8, 10));
          const isToday = day.date === today;
          return (
            <button
              key={day.date}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              className="ui-day"
              data-today={isToday || undefined}
              data-past={today && day.date < today ? true : undefined}
              aria-pressed={onSelect ? selected === day.date : undefined}
              aria-current={isToday ? "date" : undefined}
              aria-label={describe(day)}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => onSelect?.(day.date)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="ui-day-head">
                <span className="ui-day-name">{weekday}</span>
                <span className="ui-day-number">{dayNumber}</span>
              </span>
              {day.spent != null && (
                <span className="ui-day-spent" aria-hidden>
                  <span
                    className="ui-day-spent-value"
                    data-zero={!day.spent || undefined}
                  >
                    {euro(day.spent)}
                  </span>
                  <span className="ui-day-meter">
                    <span
                      style={
                        {
                          "--h": `${(day.spent / maxSpent) * 100}%`,
                        } as CSSProperties
                      }
                    />
                  </span>
                </span>
              )}
              <span className="ui-day-items" aria-hidden>
                {(day.charges ?? []).map((c, i) => (
                  <Chip key={`c${i}`} item={c} kind="charge" />
                ))}
                {(day.incomes ?? []).map((c, i) => (
                  <Chip key={`i${i}`} item={c} kind="income" />
                ))}
                {!day.charges?.length && !day.incomes?.length && !day.spent && (
                  <span className="ui-day-empty">Rien de prévu</span>
                )}
              </span>
              <span className="ui-day-balance" aria-hidden>
                {day.endBalance != null ? euro(day.endBalance) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ item, kind }: { item: DayItem; kind: "charge" | "income" }) {
  return (
    <span
      className="ui-day-chip"
      data-kind={kind}
      data-estimated={item.estimated || undefined}
    >
      <span className="ui-day-chip-label">{item.label}</span>
      <span className="ui-day-chip-amount">
        {kind === "charge" ? "−" : "+"}
        {euro(item.amount)}
      </span>
    </span>
  );
}
