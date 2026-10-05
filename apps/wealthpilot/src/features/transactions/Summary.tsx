import type { summarize } from "../../domain/search";
import { Money } from "../../ui/Money";
import { plural } from "./SelectionBar";
import type { Kind } from "./state";

export function Summary({
  summary,
  kind,
  future,
}: {
  summary: ReturnType<typeof summarize>;
  kind: Kind;
  future: number;
}) {
  return (
    <p
      className="tx-summary"
      title="Totaux hors virements internes et opérations à venir"
    >
      <strong className="tx-summary-count">
        {plural(summary.count, "opération")}
      </strong>
      {kind === "transfer" ? (
        <span className="tx-summary-item muted">
          Virements internes · hors totaux
        </span>
      ) : (
        <>
          {kind !== "income" && (
            <span className="tx-summary-item">
              <span className="tx-summary-label">Sorties</span>
              <Money value={-summary.spending} tone="none" cents="always" />
            </span>
          )}
          {kind !== "expense" && (
            <span className="tx-summary-item">
              <span className="tx-summary-label">Entrées</span>
              <Money value={summary.income} signed cents="always" />
            </span>
          )}
          {kind === "all" && (
            <span className="tx-summary-item">
              <span className="tx-summary-label">Net</span>
              <Money value={summary.net} signed cents="always" />
            </span>
          )}
        </>
      )}
      {future > 0 && (
        <span className="tx-summary-item muted">
          {plural(future, "à venir")} hors totaux
        </span>
      )}
    </p>
  );
}
