import type { CSSProperties } from "react";
import { euro, type selectDashboard } from "./domain";
import { VisualizationRenderer } from "./VisualizationRenderer";

export function BudgetAlternatives({
  budgets,
  mode,
  open,
  color,
}: {
  budgets: ReturnType<typeof selectDashboard>["budgets"];
  mode: "columns" | "tiles";
  open: (category: string) => void;
  color: (category: string) => string;
}) {
  if (mode === "columns") {
    const items = budgets.map((b) => ({
      name: b.category,
      value: b.remaining,
      detail: `${euro(b.spent)} dépensés · ${euro(b.committed)} engagés`,
    }));
    return (
      <div>
        <p className="mono">Marge par enveloppe après les engagements</p>
        <VisualizationRenderer
          view="columns"
          items={items}
          all={items}
          color={(item) => color(item.name)}
        />
      </div>
    );
  }
  return (
    <div className="budget-envelopes">
      {budgets.map((b) => (
        <button
          key={b.id}
          className="budget-envelope"
          style={{ "--envelope-color": color(b.category) } as CSSProperties}
          onClick={() => open(b.category)}
        >
          <span className="envelope-heading">
            <i />
            <b>{b.category}</b>
          </span>
          <strong>{euro(b.remaining)}</strong>
          <small>
            {b.remaining < 0 ? "de dépassement" : "encore disponibles"}
          </small>
          <dl>
            <div>
              <dt>Plafond</dt>
              <dd>{euro(b.amount)}</dd>
            </div>
            <div>
              <dt>Dépensé</dt>
              <dd>{euro(b.spent)}</dd>
            </div>
            <div>
              <dt>À payer</dt>
              <dd>{euro(b.committed)}</dd>
            </div>
          </dl>
          <span className="text-button">Voir les opérations ↗</span>
        </button>
      ))}
    </div>
  );
}
