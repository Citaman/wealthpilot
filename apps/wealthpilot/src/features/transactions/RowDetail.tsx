import { ChevronDown } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useToast } from "../../app/toast";
import { updateTransactions, type TransactionPatch } from "../../data/commands";
import {
  categoryColor,
  isUncategorized,
  suggestCategories,
} from "../../domain/categories";
import { formatDate, formatFullDay } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import { merchantLabel } from "../../domain/search";
import type { IsoDate, Transaction } from "../../domain/types";
import { Badge } from "../../ui/Badge";
import { CategoryDot } from "../../ui/CategoryDot";
import { Disclosure } from "../../ui/Disclosure";
import { EditableText } from "../../ui/Editable";
import { CategoryMenu } from "../shared/CategoryMenu";

export interface RowDetailProps {
  t: Transaction;
  ledger: Ledger;
  asOf: IsoDate;
  columns: number;
  onCategory(t: Transaction, category: string, subcategory?: string): void;
  onClose(): void;
}

export function RowDetail({
  t,
  ledger,
  asOf,
  columns,
  onCategory,
  onClose,
}: RowDetailProps) {
  const toast = useToast();
  const batch = ledger.batches.find((b) => b.id === t.batchId);
  const raw = Object.entries(t.raw ?? {});
  const uncategorized = isUncategorized(t.category);

  const save = async (message: string, patch: TransactionPatch) => {
    try {
      toast.undoable(message, await updateTransactions([t.id], patch));
    } catch (error) {
      toast.error(error);
      throw error;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      event.currentTarget.contains(event.target as Node)
    ) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <tr className="tx-detail-row" onKeyDown={onKeyDown}>
      <td colSpan={columns}>
        <div
          className="tx-detail"
          role="region"
          aria-label={`Détail de ${merchantLabel(t)}`}
        >
          <dl className="tx-detail-fields">
            <div className="tx-field">
              <dt>Marchand</dt>
              <dd>
                <EditableText
                  label="Marchand"
                  value={merchantLabel(t)}
                  onCommit={(merchantName) =>
                    save("Marchand renommé", { merchantName })
                  }
                />
              </dd>
            </div>
            <div className="tx-field">
              <dt>Catégorie</dt>
              <dd>
                <CategoryMenu
                  ledger={ledger}
                  value={t.category}
                  suggestions={suggestCategories(ledger, t)}
                  direction={t.amount > 0 ? "income" : "expense"}
                  onSelect={(category, subcategory) =>
                    onCategory(t, category, subcategory)
                  }
                  trigger={
                    <button type="button" className="tx-cat" data-empty={uncategorized || undefined}>
                      {!uncategorized && (
                        <CategoryDot
                          color={categoryColor(
                            t.category,
                            ledger.prefs.categoryDefinitions,
                          )}
                        />
                      )}
                      <span className="tx-cat-name">
                        {uncategorized ? "À catégoriser" : t.category}
                      </span>
                      {t.subcategory && (
                        <span className="tx-cat-sub">{t.subcategory}</span>
                      )}
                      <ChevronDown size={14} aria-hidden />
                    </button>
                  }
                />
              </dd>
            </div>
            <div className="tx-field">
              <dt id={`internal-${t.id}`}>Virement interne</dt>
              <dd>
                <button
                  type="button"
                  role="switch"
                  className="tx-switch"
                  aria-checked={t.internal}
                  aria-labelledby={`internal-${t.id}`}
                  title="Un virement interne est exclu des entrées et sorties"
                  onClick={() =>
                    void save(
                      t.internal
                        ? "Virement interne retiré"
                        : "Marquée virement interne",
                      { internal: !t.internal },
                    ).catch(() => undefined)
                  }
                >
                  <span className="tx-switch-track" aria-hidden />
                  <span>{t.internal ? "Oui" : "Non"}</span>
                </button>
              </dd>
            </div>
            <div className="tx-field">
              <dt>Compte</dt>
              <dd>{accountName(ledger, t.account)}</dd>
            </div>
            <div className="tx-field tx-field-2">
              <dt>Libellé bancaire</dt>
              <dd className="tx-mono-wrap">{t.label}</dd>
            </div>
            <div className="tx-field">
              <dt>Date</dt>
              <dd>
                {formatFullDay(t.date)}
                {t.date > asOf && <Badge tone="new">À venir</Badge>}
              </dd>
            </div>
            <div className="tx-field">
              <dt>Lot d’import</dt>
              <dd>
                {batch ? (
                  <>
                    <span className="tx-batch-name" title={batch.name}>
                      {batch.name}
                    </span>
                    <span className="mono muted">
                      {formatDate(batch.createdAt.slice(0, 10))}
                    </span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </dd>
            </div>
            <div className="tx-field tx-field-2">
              <dt>
                <label htmlFor={`note-${t.id}`}>Note</label>
              </dt>
              <dd>
                <NoteField
                  key={t.note ?? ""}
                  id={`note-${t.id}`}
                  value={t.note ?? ""}
                  onSave={(note) =>
                    save(note ? "Note enregistrée" : "Note supprimée", {
                      note: note || undefined,
                    })
                  }
                />
              </dd>
            </div>
          </dl>
          <Disclosure
            className="tx-raw"
            summary={`Champs bruts (${raw.length})`}
          >
            {raw.length ? (
              <dl className="tx-raw-list">
                {raw.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">Aucun champ brut conservé</p>
            )}
          </Disclosure>
        </div>
      </td>
    </tr>
  );
}

function NoteField({
  id,
  value,
  onSave,
}: {
  id: string;
  value: string;
  onSave(note: string): Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const next = draft.trim();
    if (next !== value.trim()) void onSave(next).catch(() => setDraft(value));
  };
  return (
    <textarea
      id={id}
      className="tx-note"
      rows={1}
      maxLength={500}
      placeholder="Ajouter une note"
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // First Escape drops the draft; the next one closes the detail.
        if (event.key === "Escape" && draft !== value) {
          event.preventDefault();
          setDraft(value);
        }
      }}
    />
  );
}
