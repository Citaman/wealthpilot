import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../app/router";
import { formatDay } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { batchPeriod, namesLabel, plural } from "./labels";
import type { Outcome } from "./PreviewStep";
import { StepHeading } from "./StepHeading";
import { UndoBatchDialog } from "./UndoBatchDialog";

export function ResultStep({
  outcome: { batch, names, skipped, balances },
  ledger,
  onAnother,
}: {
  outcome: Outcome;
  ledger: Ledger;
  onAnother(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const facts = [
    skipped > 0 &&
      plural(skipped, "déjà présente ignorée", "déjà présentes ignorées"),
    ...balances.map(
      (b) =>
        `solde de ${b.name} au ${formatDay(b.date)} ${b.decision === "keep" ? "ignoré" : "enregistré"}`,
    ),
  ].filter(Boolean);
  return (
    <CardShell
      palette="ink"
      motif
      className="import-card import-result"
      eyebrow={<StepHeading>Import terminé</StepHeading>}
    >
      <p className="result-hero">
        <span className="result-count tabular">{batch.count}</span>
        <span className="result-unit">
          {batch.count > 1 ? "opérations importées" : "opération importée"}
        </span>
      </p>
      <p className="result-sub">
        dans {namesLabel(names)} · {batchPeriod(batch)}
      </p>
      {facts.length > 0 && (
        <p className="mono result-facts">{facts.join(" · ")}</p>
      )}
      <div className="result-actions">
        <Button
          variant="accent"
          size="m"
          iconEnd={<ArrowRight aria-hidden />}
          onClick={() => navigate("transactions", { batch: batch.id })}
        >
          Voir les opérations
        </Button>
        <Button variant="outline" size="m" onClick={() => setConfirming(true)}>
          Annuler cet import
        </Button>
        <Button variant="ghost" size="m" onClick={onAnother}>
          Importer un autre fichier
        </Button>
      </div>
      <UndoBatchDialog
        batch={batch}
        ledger={ledger}
        open={confirming}
        onOpenChange={setConfirming}
        onUndone={onAnother}
      />
    </CardShell>
  );
}
