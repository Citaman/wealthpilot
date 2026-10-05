import { useEffect } from "react";
import type { TransactionPatch } from "../../data/commands";
import { ToastView } from "../../ui/ToastView";

export interface Similar {
  ids: string[];
  merchant: string;
  category: string;
  patch: TransactionPatch;
}

const DURATION = 8000;

/**
 * Second action next to the shell's « Catégorie changée · Annuler » toast,
 * whose API carries a single action.
 */
export function SimilarPrompt({
  similar,
  onApply,
  onClose,
}: {
  similar: Similar;
  onApply(similar: Similar): void;
  onClose(): void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, DURATION);
    return () => clearTimeout(timer);
  }, [similar, onClose]);
  const n = similar.ids.length;
  return (
    <div className="tx-similar" role="status" aria-live="polite">
      <ToastView
        message={`${n} autre${n > 1 ? "s" : ""} « ${similar.merchant} » → ${similar.category} ?`}
        action={{
          label: `Appliquer aux ${n} autre${n > 1 ? "s" : ""}`,
          onClick: () => onApply(similar),
        }}
        onClose={onClose}
      />
    </div>
  );
}
