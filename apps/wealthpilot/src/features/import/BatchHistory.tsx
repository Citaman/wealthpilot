import { EllipsisVertical, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { navigate } from "../../app/router";
import { formatDay } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import type { Batch } from "../../domain/types";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { IconButton } from "../../ui/IconButton";
import { Menu } from "../../ui/Menu";
import { batchPeriod, localDay, localTime, plural } from "./labels";
import { UndoBatchDialog } from "./UndoBatchDialog";

const FIRST = 6;

export function BatchHistory({
  ledger,
  onUndone,
}: {
  ledger: Ledger;
  onUndone(batch: Batch): void;
}) {
  const [all, setAll] = useState(false);
  const [undoing, setUndoing] = useState<Batch | null>(null);
  const batches = useMemo(
    () =>
      ledger.batches.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [ledger.batches],
  );
  const accountsByBatch = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of ledger.transactions) {
      const set = map.get(t.batchId) ?? new Set<string>();
      set.add(t.account);
      map.set(t.batchId, set);
    }
    return map;
  }, [ledger.transactions]);
  if (!batches.length) return null;

  const accountsOf = (batch: Batch) => {
    const ids = new Set(accountsByBatch.get(batch.id));
    for (const entry of batch.metadata?.accounts ?? [])
      if (entry.account) ids.add(entry.account);
    return [...ids].map((id) => accountName(ledger, id)).join(", ");
  };
  const shown = all ? batches : batches.slice(0, FIRST);

  return (
    <CardShell
      className="import-card history"
      title="Imports"
      actions={
        <span className="mono muted">
          {plural(batches.length, "lot", "lots")}
        </span>
      }
    >
      <ul className="history-list">
        {shown.map((batch) => (
          <li key={batch.id} className="history-row" data-batch={batch.id}>
            <span className="history-icon" aria-hidden>
              <FileSpreadsheet size={16} />
            </span>
            <span className="history-name" title={batch.name}>
              {batch.name}
            </span>
            <span className="history-count tabular">
              {batch.count}
              <span className="mono muted"> op.</span>
            </span>
            <span className="mono history-period">{batchPeriod(batch)}</span>
            <span className="mono muted history-accounts">
              {accountsOf(batch) || "—"} · importé le{" "}
              {formatDay(localDay(batch.createdAt))}{" "}
              {localTime(batch.createdAt)}
            </span>
            <Menu
              label={`Actions du lot ${batch.name}`}
              trigger={
                <IconButton
                  label={`Actions du lot ${batch.name}`}
                  icon={<EllipsisVertical />}
                />
              }
              items={[
                {
                  label: "Voir les opérations",
                  onSelect: () => navigate("transactions", { batch: batch.id }),
                },
                {
                  label: "Annuler l'import",
                  destructive: true,
                  // Opened once the menu has closed, so each layer restores focus and pointer events.
                  onSelect: () => setTimeout(() => setUndoing(batch)),
                },
              ]}
            />
          </li>
        ))}
      </ul>
      {batches.length > FIRST && (
        <Button variant="ghost" onClick={() => setAll((v) => !v)}>
          {all ? "Réduire" : `Tout afficher (${batches.length})`}
        </Button>
      )}
      {undoing && (
        <UndoBatchDialog
          batch={undoing}
          ledger={ledger}
          open
          onOpenChange={(open) => {
            if (open) return;
            const id = undoing.id;
            setUndoing(null);
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLElement>(
                  `[data-batch="${id}"] .ui-icon-button`,
                )
                ?.focus(),
            );
          }}
          onUndone={() => onUndone(undoing)}
        />
      )}
    </CardShell>
  );
}
