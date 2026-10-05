import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { hrefFor } from "../../app/router";
import { categoryColor } from "../../domain/categories";
import { formatFullDay } from "../../domain/dates";
import { brandFor } from "../../domain/merchants";
import type { Occurrence } from "../../domain/events";
import { accountName, type Ledger } from "../../domain/ledger";
import { filterTransactions, merchantLabel } from "../../domain/search";
import type { IsoDate } from "../../domain/types";
import type { WeekPlan } from "../../domain/week";
import { Badge } from "../../ui/Badge";
import { CardShell } from "../../ui/CardShell";
import { CategoryDot } from "../../ui/CategoryDot";
import { DayStrip, type DayItem } from "../../ui/charts/DayStrip";
import { MerchantLogo } from "../../ui/MerchantLogo";
import { Money } from "../../ui/Money";
import { OccurrenceMenu } from "../shared/OccurrenceMenu";
import { isEstimated, visibleMovement } from "./weekDates";

const item = (o: Occurrence): DayItem => ({
  label: o.label,
  amount: Math.abs(o.amount),
  estimated: isEstimated(o),
});

export function WeekDays({ ledger, plan }: { ledger: Ledger; plan: WeekPlan }) {
  const [selected, setSelected] = useState<IsoDate | null>(null);
  const visible = visibleMovement(plan.account);
  const days = plan.days.map((d) => ({
    date: d.date,
    spent: d.date <= ledger.asOf ? d.spent : null,
    charges: d.charges.filter(visible).map(item),
    incomes: d.incomes.filter(visible).map(item),
    endBalance: d.endBalance,
  }));
  const day = plan.days.find((d) => d.date === selected);

  return (
    <CardShell
      title="Jour par jour"
      className="week-days"
      actions={
        <span className="week-days-legend mono" aria-hidden>
          <span data-kind="spent">dépensé</span>
          <span data-kind="charge">charge</span>
          <span data-kind="income">revenu</span>
          <span>solde fin de journée</span>
        </span>
      }
    >
      <div
        onKeyDown={(event) => {
          if (event.key === "Escape" && selected) {
            event.stopPropagation();
            setSelected(null);
          }
        }}
      >
        <DayStrip
          label="Jours de la semaine"
          days={days}
          today={ledger.asOf}
          selected={selected}
          onSelect={(date) => setSelected(date === selected ? null : date)}
        />
      </div>
      {day && (
        <DayPanel
          ledger={ledger}
          account={plan.account}
          date={day.date}
          expected={[...day.charges, ...day.incomes].filter(visible)}
        />
      )}
    </CardShell>
  );
}

function DayPanel({
  ledger,
  account,
  date,
  expected,
}: {
  ledger: Ledger;
  account: string;
  date: IsoDate;
  expected: Occurrence[];
}) {
  const operations =
    date <= ledger.asOf
      ? filterTransactions(ledger, {
          account,
          range: { from: date, to: date },
          kind: "all",
          categories: [],
          min: null,
          max: null,
          uncategorized: false,
          withNote: false,
          query: "",
          sort: "amount-desc",
        })
      : [];
  const title = formatFullDay(date);
  const definitions = ledger.prefs.categoryDefinitions;
  return (
    <section className="week-day-panel" aria-label={title}>
      <header className="week-day-panel-head">
        <h3>{title.charAt(0).toUpperCase() + title.slice(1)}</h3>
        <a
          className="week-link"
          href={hrefFor("transactions", {
            from: date,
            to: date,
            acct: account || "household",
          })}
        >
          Voir dans Transactions <ArrowUpRight size={14} aria-hidden />
        </a>
      </header>
      {!operations.length && !expected.length ? (
        <p className="week-muted">Aucune opération ce jour</p>
      ) : (
        <ul className="week-ops">
          {operations.map((t) => {
            const name = merchantLabel(t);
            const color = categoryColor(t.category, definitions);
            return (
              <li key={t.id} className="week-op">
                <MerchantLogo
                  name={name}
                  color={color}
                  src={brandFor(name)?.src}
                  size={28}
                />
                <span className="week-op-name">
                  {name}
                  <span className="week-op-meta">
                    <CategoryDot color={color} />
                    {t.category}
                    {!account && ` · ${accountName(ledger, t.account)}`}
                    {t.internal && " · virement interne"}
                  </span>
                </span>
                <Money value={t.amount} signed cents="always" />
              </li>
            );
          })}
          {expected.map((o) => (
            <li key={o.id} className="week-op" data-expected>
              <span className="week-op-expected" aria-hidden />
              <span className="week-op-name">
                {o.label}
                <span className="week-op-meta">
                  {o.category && (
                    <>
                      <CategoryDot color={categoryColor(o.category, definitions)} />
                      {o.category} ·{" "}
                    </>
                  )}
                  {!account && `${accountName(ledger, o.account)} · `}
                  {o.overdue ? "en retard" : "prévu"}
                </span>
              </span>
              {isEstimated(o) && <Badge tone="estimated">Estimé</Badge>}
              <Money value={o.amount} signed cents="never" />
              <OccurrenceMenu ledger={ledger} occurrence={o} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
