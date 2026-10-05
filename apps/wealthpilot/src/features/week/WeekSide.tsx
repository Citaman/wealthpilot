import { useToast } from "../../app/toast";
import { setSafety } from "../../data/commands";
import { maxDate } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import { formatEuro } from "../../domain/money";
import type { WeekPlan } from "../../domain/week";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { EditableMoney } from "../../ui/Editable";
import { Empty } from "../../ui/Empty";
import { Money } from "../../ui/Money";
import { OccurrenceMenu } from "../shared/OccurrenceMenu";
import { PurchaseTester } from "../shared/PurchaseTester";
import { isEstimated, visibleMovement, weekdayShort } from "./weekDates";
import type { Tense } from "./WeekHero";

export function WeekTester({
  ledger,
  plan,
  tense,
  onCurrentWeek,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  tense: Tense;
  onCurrentWeek(): void;
}) {
  return (
    <CardShell title="Tester un achat" className="week-tester">
      {tense === "past" ? (
        <Empty
          action={
            <Button variant="outline" onClick={onCurrentWeek}>
              Cette semaine
            </Button>
          }
        >
          Semaine terminée
        </Empty>
      ) : (
        <PurchaseTester
          ledger={ledger}
          account={plan.account}
          minDate={maxDate(plan.start, ledger.asOf)}
          maxDate={plan.end}
          compact
        />
      )}
    </CardShell>
  );
}

export function WeekCharges({
  ledger,
  plan,
}: {
  ledger: Ledger;
  plan: WeekPlan;
}) {
  const charges = plan.days
    .flatMap((d) => d.charges)
    .filter(visibleMovement(plan.account));
  return (
    <CardShell title="Charges de la semaine" className="week-charges">
      {charges.length ? (
        <ul className="week-charge-list">
          {charges.map((o) => (
            <li key={o.id} className="week-charge">
              <span className="week-charge-date mono">
                {weekdayShort(o.date)} {Number(o.date.slice(8))}
              </span>
              <span className="week-charge-name">
                {o.label}
                {!plan.account && (
                  <span className="week-charge-meta">
                    {accountName(ledger, o.account)}
                    {o.overdue && " · en retard"}
                  </span>
                )}
              </span>
              {isEstimated(o) && <Badge tone="estimated">Estimé</Badge>}
              <Money value={o.amount} cents="never" />
              <OccurrenceMenu ledger={ledger} occurrence={o} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Aucune charge cette semaine</Empty>
      )}
    </CardShell>
  );
}

export function WeekReserve({
  ledger,
  account,
}: {
  ledger: Ledger;
  account: string;
}) {
  const toast = useToast();
  const { safety, projectsReserve } = ledger.prefs;
  return (
    <CardShell
      className="week-reserve"
      title="Réserve"
      actions={
        <EditableMoney
          value={safety}
          size="m"
          label="Réserve de sécurité du foyer"
          validate={(v) => (v < 0 ? "Montant positif" : null)}
          onCommit={async (next) => {
            if (next === null) return;
            try {
              toast.undoable(
                `Réserve : ${formatEuro(next)}`,
                await setSafety(next),
              );
            } catch (error) {
              toast.error(error);
              throw error;
            }
          }}
        />
      }
    >
      {(account || projectsReserve > 0) && (
        <p className="week-muted mono">
          {account
            ? `Foyer · non répartie sur ${accountName(ledger, account)}`
            : `+ projets ${formatEuro(projectsReserve, { cents: "never" })} protégés`}
        </p>
      )}
    </CardShell>
  );
}
