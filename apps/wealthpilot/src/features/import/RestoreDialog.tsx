import { useState } from "react";
import { useToast } from "../../app/toast";
import {
  backupInventory,
  downloadFile,
  exportBackup,
  restoreBackup,
} from "../../data/backup";
import { formatDay } from "../../domain/dates";
import type { IsoDate, Snapshot } from "../../domain/types";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { backupFileName, formatCount, plural } from "./labels";

export type RestoreRequest =
  | { file: string; savedOn: string; snapshot: Snapshot }
  | { file: string; error: string };

type Inventory = ReturnType<typeof backupInventory>;

const lines: [keyof Inventory, string][] = [
  ["transactions", "Opérations"],
  ["accounts", "Comptes"],
  ["budgets", "Enveloppes"],
  ["dues", "Échéances"],
  ["batches", "Lots d'import"],
];

const span = (i: Inventory) =>
  i.from && i.through
    ? `${formatDay(i.from)} → ${formatDay(i.through)}`
    : "aucune opération";

export function RestoreDialog({
  request,
  current,
  asOf,
  onClose,
  onRestored,
  onPickAnother,
}: {
  request: RestoreRequest | null;
  current: Snapshot;
  asOf: IsoDate;
  onClose(): void;
  onRestored(): void;
  onPickAnother(): void;
}) {
  const toast = useToast();
  const [safety, setSafety] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!request) return null;

  if ("error" in request)
    return (
      <Dialog
        open
        onOpenChange={(open) => !open && onClose()}
        title="Sauvegarde illisible"
        description={<span className="mono">{request.file}</span>}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="primary" onClick={onPickAnother}>
              Choisir un autre fichier
            </Button>
          </>
        }
      >
        <p className="import-missing" role="alert">
          {request.error}
        </p>
        <p className="mono muted">Aucune donnée modifiée.</p>
      </Dialog>
    );

  const incoming = backupInventory(request.snapshot);
  const now = backupInventory(current);

  async function replace() {
    if (!request || "error" in request) return;
    setBusy(true);
    try {
      if (safety)
        downloadFile(
          backupFileName(asOf, "-avant-restauration"),
          await exportBackup(),
          "application/json",
        );
      await restoreBackup(request.snapshot);
      onRestored();
      toast.show({
        message: `Données restaurées · ${plural(incoming.transactions, "opération", "opérations")}`,
      });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      size="m"
      onOpenChange={(open) => !open && onClose()}
      title={"Remplacer mes données\u00a0?"}
      description={
        <span className="mono">
          {request.file} · sauvegarde du {formatDay(request.savedOn)}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" loading={busy} onClick={replace}>
            Remplacer mes données
          </Button>
        </>
      }
    >
      <table className="restore-table">
        <thead>
          <tr>
            <td />
            <th scope="col">Sauvegarde</th>
            <th scope="col">Actuel</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td className="tabular">{formatCount(Number(incoming[key]))}</td>
              <td className="tabular">{formatCount(Number(now[key]))}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Période</th>
            <td className="mono">{span(incoming)}</td>
            <td className="mono">{span(now)}</td>
          </tr>
        </tbody>
      </table>
      <label className="restore-safety">
        <input
          type="checkbox"
          checked={safety}
          onChange={(e) => setSafety(e.target.checked)}
        />
        Télécharger d'abord une sauvegarde de l'état actuel
      </label>
    </Dialog>
  );
}
