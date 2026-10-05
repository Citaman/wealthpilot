import { ArrowUpRight } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";
import { hrefFor, navigate } from "../../../app/router";
import { categoryColor } from "../../../domain/categories";
import { formatWeekday, weekday, weekStart } from "../../../domain/dates";
import { formatEuro } from "../../../domain/money";
import { weekPlan } from "../../../domain/week";
import { CardShell } from "../../../ui/CardShell";
import { CategoryDot } from "../../../ui/CategoryDot";
import { Empty } from "../../../ui/Empty";
import { SegmentBar } from "../../../ui/charts/SegmentBar";
import { Money } from "../../../ui/Money";
import type { CardProps } from "./types";
import {
  isActiveEnvelope,
  visibleMovement,
  weekdayShort,
} from "../../week/weekDates";
import "./WeekCard.css";

const interactive = "a, button, input, select, textarea, [role='menuitem']";

export function WeekCard({ card, ledger, account, editing }: CardProps) {
  const { asOf } = ledger;
  if (!ledger.transactions.length)
    return (
      <CardShell palette={card.palette} title="Cette semaine">
        <Empty action={<a href={hrefFor("import")}>Importer</a>}>
          Aucune opération
        </Empty>
      </CardShell>
    );
  const plan = weekPlan(ledger, account, weekStart(asOf));
  const params = { acct: account || "household" };
  const unknown = plan.assumptions.capacity === null;
  const lowest = plan.envelopes
    .filter(isActiveEnvelope)
    .toSorted((a, b) => a.possible - b.possible)
    .slice(0, 3);
  const visible = visibleMovement(account);
  const charges = plan.days
    .flatMap((d) => d.charges)
    .filter((o) => visible(o) && o.date >= asOf)
    .slice(0, 3);
  const days = plan.days.map((d) => ({
    date: d.date,
    spent: d.date <= asOf ? d.spent : 0,
    charges: d.charges.filter(visible).reduce((n, o) => n - o.amount, 0),
  }));
  const tallest = Math.max(1, ...days.map((d) => d.spent + d.charges));
  const height = (value: number) =>
    ({ "--h": `${(value / tallest) * 100}%` }) as CSSProperties;

  const open = (event: MouseEvent) => {
    if (editing || (event.target as Element).closest(interactive)) return;
    navigate("week", params);
  };

  return (
    <CardShell
      palette={card.palette}
      title="Cette semaine"
      className="week-card"
      data-editing={editing || undefined}
      onClick={open}
      footer={
        <a className="week-card-link" href={hrefFor("week", params)}>
          Ma semaine <ArrowUpRight size={14} aria-hidden />
        </a>
      }
    >
      <div className="week-card-hero">
        <p className="week-card-amount">
          {!unknown && plan.totals.limit === 0 ? (
            <span className="week-card-lead">Aucune limite</span>
          ) : (
            <>
              <span className="week-card-lead">Encore</span>
              <Money
                value={unknown ? null : plan.totals.possible}
                size="xl"
                tone="none"
                cents="never"
                unknownReason="Solde à confirmer"
              />
            </>
          )}
        </p>
        <p className="week-card-sub">
          {weekday(asOf) === 6
            ? "aujourd’hui"
            : `d’ici ${formatWeekday(plan.end)}`}
        </p>
      </div>
      <SegmentBar
        label="Enveloppes de la semaine"
        paid={plan.totals.paid}
        committed={plan.totals.committed}
        possible={plan.totals.possible}
      />
      <ol
        className="week-card-days"
        aria-label={`Jours : ${days
          .map(
            (d) =>
              `${formatWeekday(d.date)} ${d.date <= asOf ? `dépensé ${formatEuro(d.spent, { cents: "never" })}` : ""}${d.charges ? ` charges ${formatEuro(d.charges, { cents: "never" })}` : ""}`,
          )
          .join(", ")}`}
      >
        {days.map((d) => (
          <li
            key={d.date}
            aria-hidden
            data-today={d.date === asOf || undefined}
            data-future={d.date > asOf || undefined}
          >
            <span className="week-card-bar">
              {d.charges > 0 && (
                <span data-kind="charge" style={height(d.charges)} />
              )}
              {d.spent > 0 && (
                <span data-kind="spent" style={height(d.spent)} />
              )}
            </span>
            <span className="week-card-day">
              {formatWeekday(d.date).charAt(0).toUpperCase()}
            </span>
          </li>
        ))}
      </ol>
      {lowest.length > 0 && (
        <ul className="week-card-envs">
          {lowest.map((e) => (
            <li key={e.category}>
              <CategoryDot
                color={categoryColor(
                  e.category,
                  ledger.prefs.categoryDefinitions,
                )}
              />
              <span className="week-card-env-name">{e.category}</span>
              <Money value={e.possible} cents="never" tone="none" />
            </li>
          ))}
        </ul>
      )}
      {charges.length > 0 && (
        <ul
          className="week-card-charges"
          aria-label="Charges à venir cette semaine"
        >
          {charges.map((o) => (
            <li key={o.id}>
              <span className="mono">{weekdayShort(o.date)}</span>
              <span className="week-card-env-name">{o.label}</span>
              <Money value={o.amount} cents="never" tone="none" />
            </li>
          ))}
        </ul>
      )}
    </CardShell>
  );
}
