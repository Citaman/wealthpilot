import { ArrowLeftRight, Download, Tags, X } from "lucide-react";
import { useState } from "react";
import type { TransactionPatch } from "../../data/commands";
import type { Ledger } from "../../domain/ledger";
import { Button } from "../../ui/Button";
import { Dialog, DialogClose } from "../../ui/Dialog";
import { IconButton } from "../../ui/IconButton";
import { CategoryMenu } from "../shared/CategoryMenu";
import { categoryPatch } from "./state";
import { categoryText } from "../shared/CategoryLabel";

const nf = new Intl.NumberFormat("fr-FR");
export const plural = (n: number, word: string) =>
  `${nf.format(n)} ${word}${n > 1 ? "s" : ""}`;

export interface SelectionBarProps {
  ledger: Ledger;
  count: number;
  /** Selected operations hidden by the current filters. */
  outside: number;
  /** Filtered result size, when it is not already entirely selected. */
  selectable: number | null;
  allInternal: boolean;
  onSelectAll(): void;
  onApply(patch: TransactionPatch, message: string): Promise<void>;
  onExport(): void;
  onClear(): void;
}

interface Pending {
  title: string;
  confirm: string;
  patch: TransactionPatch;
  message: string;
}

export function SelectionBar({
  ledger,
  count,
  outside,
  selectable,
  allInternal,
  onSelectAll,
  onApply,
  onExport,
  onClear,
}: SelectionBarProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const ops = plural(count, "opération");

  const request = (action: Pending) => {
    if (count > 1) setPending(action);
    else void onApply(action.patch, action.message);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await onApply(pending.patch, pending.message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tx-selbar" role="region" aria-label="Sélection">
      <p className="tx-selbar-count" aria-live="polite">
        <strong>{plural(count, "sélectionnée")}</strong>
        {outside > 0 && (
          <span className="tx-selbar-outside">
            dont {nf.format(outside)} hors du filtre
          </span>
        )}
      </p>
      {selectable !== null && (
        <button type="button" className="tx-link" onClick={onSelectAll}>
          Sélectionner les {nf.format(selectable)} du résultat
        </button>
      )}
      <div className="tx-selbar-actions">
        <CategoryMenu
          ledger={ledger}
          value=""
          onSelect={(category, subcategory) =>
            request({
              title: `Catégoriser ${ops} en ${categoryText(category, subcategory)} ?`,
              confirm: "Catégoriser",
              patch: categoryPatch(ledger, category, subcategory),
              message: `${ops} ${count > 1 ? "catégorisées" : "catégorisée"}`,
            })
          }
          trigger={
            <Button variant="accent" icon={<Tags aria-hidden />}>
              Catégoriser…
            </Button>
          }
        />
        <Button
          variant="outline"
          icon={<ArrowLeftRight aria-hidden />}
          onClick={() =>
            request(
              allInternal
                ? {
                    title: `Retirer ${ops} des virements internes ?`,
                    confirm: "Retirer",
                    patch: { internal: false },
                    message: `${ops} retirée${count > 1 ? "s" : ""} des virements`,
                  }
                : {
                    title: `Marquer ${ops} comme virement${count > 1 ? "s" : ""} interne${count > 1 ? "s" : ""} ?`,
                    confirm: "Marquer",
                    patch: { internal: true },
                    message: `${ops} en virement interne`,
                  },
            )
          }
        >
          {allInternal ? "Pas un virement" : "Virement interne"}
        </Button>
        <Button
          variant="outline"
          icon={<Download aria-hidden />}
          onClick={onExport}
        >
          Exporter
        </Button>
        <IconButton
          label="Vider la sélection"
          icon={<X aria-hidden />}
          onClick={onClear}
        />
      </div>
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && !busy && setPending(null)}
        title={pending?.title ?? ""}
        description={
          outside > 0
            ? `Dont ${nf.format(outside)} hors du filtre actuel. Annulable ensuite.`
            : "Annulable ensuite."
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button variant="primary" loading={busy} onClick={confirm}>
              {pending?.confirm}
            </Button>
          </>
        }
      />
    </div>
  );
}
