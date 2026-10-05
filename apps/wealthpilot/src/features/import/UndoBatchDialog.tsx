import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { navigate } from "../../app/router";
import { useToast } from "../../app/toast";
import {
  ImportError,
  undoBlockers,
  undoImport,
} from "../../data/importer/commit";
import type { Ledger } from "../../domain/ledger";
import type { Batch, Transaction } from "../../domain/types";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { batchPeriod, plural } from "./labels";

/** Confirms a batch undo; refuses while some of its rows were edited by hand. */
export function UndoBatchDialog({
  batch,
  ledger,
  open,
  onOpenChange,
  onUndone,
}: {
  batch: Batch;
  ledger: Ledger;
  open: boolean;
  onOpenChange(open: boolean): void;
  onUndone?(): void;
}) {
  const toast = useToast();
  const [blockers, setBlockers] = useState<Transaction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setBlockers(null);
    setFailure(null);
    undoBlockers(batch.id).then(
      (rows) => live && setBlockers(rows),
      (error) => live && setFailure(String(error)),
    );
    return () => {
      live = false;
    };
  }, [open, batch.id]);

  const count = ledger.transactions.filter(
    (t) => t.batchId === batch.id,
  ).length;
  const blocked = Boolean(blockers?.length);

  async function confirm() {
    setBusy(true);
    try {
      await undoImport(batch.id);
      onOpenChange(false);
      toast.show({
        message: `Import annulé · ${plural(count, "opération supprimée", "opérations supprimées")}`,
      });
      onUndone?.();
    } catch (error) {
      if (!(error instanceof ImportError)) return toast.error(error);
      setFailure(error.message);
      setBlockers(await undoBlockers(batch.id));
    } finally {
      setBusy(false);
    }
  }

  const show = () => {
    onOpenChange(false);
    navigate(
      "transactions",
      blockers?.length === 1 ? { tx: blockers[0].id } : { batch: batch.id },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        blocked
          ? "Annulation impossible"
          : count === 1
            ? "Supprimer l'opération de ce lot\u00a0?"
            : `Supprimer les ${plural(count, "opération", "opérations")} de ce lot\u00a0?`
      }
      description={
        <span className="mono">
          {batch.name} · {batchPeriod(batch)}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Garder le lot
          </Button>
          <Button
            variant="danger"
            loading={busy || blockers === null}
            disabledReason={
              blocked
                ? "Des opérations du lot ont été corrigées à la main."
                : undefined
            }
            onClick={confirm}
          >
            Supprimer le lot
          </Button>
        </>
      }
    >
      {blocked && blockers && (
        <p className="import-notice" data-tone="warning" role="alert">
          <TriangleAlert size={16} aria-hidden />
          <span>
            {plural(
              blockers.length,
              "opération de ce lot a été modifiée",
              "opérations de ce lot ont été modifiées",
            )}{" "}
            à la main
          </span>
          <span aria-hidden>·</span>
          <button type="button" className="import-link" onClick={show}>
            Voir
          </button>
        </p>
      )}
      {failure && !blocked && (
        <p className="import-missing" role="alert">
          {failure}
        </p>
      )}
    </Dialog>
  );
}
