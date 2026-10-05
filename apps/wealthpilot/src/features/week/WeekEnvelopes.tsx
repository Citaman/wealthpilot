import { useRef, useState, type CSSProperties } from "react";
import { useToast } from "../../app/toast";
import { saveWeekLimit } from "../../data/commands";
import { categoryColor } from "../../domain/categories";
import type { Ledger } from "../../domain/ledger";
import { formatEuro } from "../../domain/money";
import type { Cents } from "../../domain/types";
import type { WeekEnvelope, WeekPlan } from "../../domain/week";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { CategoryDot } from "../../ui/CategoryDot";
import { Disclosure } from "../../ui/Disclosure";
import { EditableMoney } from "../../ui/Editable";
import { Empty } from "../../ui/Empty";
import { Money } from "../../ui/Money";
import type { Tense } from "./WeekHero";
import { isActiveEnvelope, planStatus } from "./weekDates";

export function WeekEnvelopes({
  ledger,
  plan,
  tense,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  tense: Tense;
}) {
  const active = plan.envelopes.filter(isActiveEnvelope);
  const idle = plan.envelopes.filter((e) => !isActiveEnvelope(e));
  const { weeks } = plan.assumptions;
  const [idleOpen, setIdleOpen] = useState(false);
  const status = planStatus(plan);
  return (
    <CardShell
      title="Enveloppes"
      className="week-envelopes"
      actions={
        status === "confirmed" ? (
          <Badge tone="positive">Plan enregistré</Badge>
        ) : status === "estimated" ? (
          <Badge
            tone="estimated"
            title={`Limites proposées : médiane de ${weeks} semaines comparables`}
          >
            Proposé · {weeks} sem.
          </Badge>
        ) : null
      }
    >
      {active.length ? (
        <ul className="week-env-list">
          {active.map((e) => (
            <EnvelopeRow
              key={e.category}
              ledger={ledger}
              plan={plan}
              envelope={e}
              tense={tense}
            />
          ))}
        </ul>
      ) : (
        <Empty
          action={
            idle.length > 0 && (
              <Button variant="outline" onClick={() => setIdleOpen(true)}>
                Fixer une limite
              </Button>
            )
          }
        >
          Aucune limite cette semaine
        </Empty>
      )}
      {idle.length > 0 && (
        <Disclosure
          open={idleOpen}
          onOpenChange={setIdleOpen}
          className="week-env-idle"
          summary={`${idle.length} catégorie${idle.length > 1 ? "s" : ""} sans limite cette semaine`}
        >
          <ul className="week-env-list" data-idle>
            {idle.map((e) => (
              <EnvelopeRow
                key={e.category}
                ledger={ledger}
                plan={plan}
                envelope={e}
                tense={tense}
              />
            ))}
          </ul>
        </Disclosure>
      )}
    </CardShell>
  );
}

function EnvelopeRow({
  ledger,
  plan,
  envelope: e,
  tense,
}: {
  ledger: Ledger;
  plan: WeekPlan;
  envelope: WeekEnvelope;
  tense: Tense;
}) {
  const toast = useToast();
  const row = useRef<HTMLLIElement>(null);
  const color = categoryColor(e.category, ledger.prefs.categoryDefinitions);
  const used = e.paid + e.committed;
  const scale = Math.max(1, e.limit, used + e.possible);
  const share = (value: Cents) => `${(value / scale) * 100}%`;
  const over = e.limit > 0 && used > e.limit;
  const past = tense === "past";

  const save = async (next: Cents | null) => {
    try {
      const undo = await saveWeekLimit(
        plan.account,
        plan.start,
        e.category,
        next,
      );
      toast.undoable(
        next === null
          ? `${e.category} : proposition rétablie`
          : `Limite ${e.category} : ${formatEuro(next)}`,
        undo,
      );
    } catch (error) {
      toast.error(error);
      throw error;
    }
  };

  const reset = async () => {
    await save(null).catch(() => undefined);
    requestAnimationFrame(() =>
      row.current
        ?.querySelector<HTMLButtonElement>(".week-env-limit .ui-editable")
        ?.focus(),
    );
  };

  return (
    <li
      ref={row}
      className="week-env"
      data-over={over || undefined}
      style={{ "--bar": color } as CSSProperties}
    >
      <span className="week-env-name">
        <CategoryDot color={color} size={10} />
        <span>{e.category}</span>
      </span>
      <span className="week-env-amount">
        {past ? (
          <Money value={e.paid} size="s" tone="none" cents="never" />
        ) : over ? (
          <Money value={e.limit - used} size="s" cents="never" />
        ) : (
          <Money value={e.possible} size="s" tone="none" cents="never" />
        )}
        <span className="week-env-amount-label">
          {past
            ? "payé"
            : over
              ? "dépassé"
              : e.limit === 0
                ? "sans limite"
                : "possible"}
        </span>
      </span>
      <span
        className="week-env-bar"
        role="img"
        aria-label={`${e.category} : payé ${formatEuro(e.paid)}, engagé ${formatEuro(e.committed)}, possible ${formatEuro(e.possible)}, limite ${formatEuro(e.limit)}`}
      >
        {e.paid > 0 && (
          <span data-kind="paid" style={{ width: share(e.paid) }} />
        )}
        {e.committed > 0 && (
          <span data-kind="committed" style={{ width: share(e.committed) }} />
        )}
        {e.possible > 0 && (
          <span data-kind="possible" style={{ width: share(e.possible) }} />
        )}
        {e.limit > 0 && used + e.possible > e.limit && (
          <span className="week-env-tick" style={{ left: share(e.limit) }} />
        )}
      </span>
      <span className="week-env-detail mono">
        <span>payé {formatEuro(e.paid, { cents: "never" })}</span>
        <span aria-hidden>·</span>
        <span>engagé {formatEuro(e.committed, { cents: "never" })}</span>
        <span aria-hidden>·</span>
        <span className="week-env-limit">
          limite{" "}
          <EditableMoney
            value={e.limit}
            label={`Limite ${e.category}`}
            validate={(v) => (v < 0 ? "Montant positif" : null)}
            onCommit={save}
          />
        </span>
        {e.saved && e.proposed !== e.limit && (
          <button type="button" className="week-env-proposed" onClick={reset}>
            Proposé : {formatEuro(e.proposed, { cents: "never" })}
          </button>
        )}
      </span>
    </li>
  );
}
