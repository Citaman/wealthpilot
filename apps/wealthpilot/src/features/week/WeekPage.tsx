import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { PageProps } from "../../app/App";
import { AccountPicker } from "../../app/ContextControls";
import { useReading } from "../../app/context";
import { DockActions } from "../../app/DockSlot";
import { hrefFor } from "../../app/router";
import { addDays, maxDate, minDate, weekStart } from "../../domain/dates";
import { weekPlan } from "../../domain/week";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { Empty } from "../../ui/Empty";
import { IconButton } from "../../ui/IconButton";
import { WeekDays } from "./WeekDays";
import { WeekEnvelopes } from "./WeekEnvelopes";
import { WeekHero } from "./WeekHero";
import { WeekCharges, WeekReserve, WeekTester } from "./WeekSide";
import { FUTURE_WEEKS, weekLabel, weekParam } from "./weekDates";
import "./week.css";

export function WeekPage({ ledger, params }: PageProps) {
  const { asOf, account, setAccount } = useReading();
  const current = weekStart(asOf);
  const first = weekStart(ledger.calendar.start ?? asOf);
  const last = addDays(current, 7 * FUTURE_WEEKS);
  const [chosen, setChosen] = useState(
    () => weekParam(params.get("week")) ?? current,
  );
  const week = minDate(maxDate(chosen, first), last);

  // Drilldowns (#/semaine?week=…&acct=…) set the week and the shared account.
  const weekQuery = params.get("week");
  const accountQuery = params.get("acct");
  useEffect(() => {
    const requested = weekParam(weekQuery);
    if (requested) setChosen(requested);
  }, [weekQuery]);
  useEffect(() => {
    if (accountQuery !== null)
      setAccount(accountQuery === "household" ? "" : accountQuery);
    // setAccount is recreated with the context value; only the query matters.
  }, [accountQuery]);

  const dock = (
    <DockActions>
      <div className="week-dock">
        <AccountPicker ledger={ledger} value={account} onChange={setAccount} />
        <div className="week-dock-weeks" role="group" aria-label="Semaine">
          <IconButton
            label="Semaine précédente"
            icon={<ChevronLeft aria-hidden />}
            disabledReason={week <= first ? "Début de l’historique" : undefined}
            onClick={() => setChosen(addDays(week, -7))}
          />
          <span className="week-dock-label" aria-live="polite">
            {weekLabel(week)}
          </span>
          <IconButton
            label="Semaine suivante"
            icon={<ChevronRight aria-hidden />}
            disabledReason={
              week >= last
                ? `Prévision limitée à ${FUTURE_WEEKS} semaines`
                : undefined
            }
            onClick={() => setChosen(addDays(week, 7))}
          />
        </div>
        {week !== current && (
          <Button variant="ghost" onClick={() => setChosen(current)}>
            Cette semaine
          </Button>
        )}
      </div>
    </DockActions>
  );

  if (!ledger.transactions.length)
    return (
      <>
        {dock}
        <CardShell title="Ma semaine">
          <Empty action={<a href={hrefFor("import")}>Importer un relevé</a>}>
            Aucune opération
          </Empty>
        </CardShell>
      </>
    );

  const plan = weekPlan(ledger, account, week);
  const tense = week < current ? "past" : week > current ? "future" : "current";

  return (
    <>
      {dock}
      <div className="week" data-tense={tense}>
        <WeekHero ledger={ledger} plan={plan} tense={tense} />
        <div className="week-days-row">
          <WeekDays key={`${week}|${account}`} ledger={ledger} plan={plan} />
        </div>
        <div className="week-col">
          <WeekEnvelopes ledger={ledger} plan={plan} tense={tense} />
        </div>
        <div className="week-col">
          <WeekTester
            ledger={ledger}
            plan={plan}
            tense={tense}
            onCurrentWeek={() => setChosen(current)}
          />
          <WeekCharges ledger={ledger} plan={plan} />
          <WeekReserve ledger={ledger} account={account} />
        </div>
      </div>
    </>
  );
}
