import { ArrowLeftRight, StickyNote, X } from "lucide-react";
import { memo, type KeyboardEvent, type MouseEvent } from "react";
import { isUncategorized, suggestCategories } from "../../domain/categories";
import { formatDay } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import { merchantLabel, normalize } from "../../domain/search";
import type { IsoDate, Transaction } from "../../domain/types";
import { Badge } from "../../ui/Badge";
import { Money } from "../../ui/Money";
import { AccountTag } from "../shared/AccountTag";
import { CategoryLabel, categoryText } from "../shared/CategoryLabel";
import { CategoryMenu } from "../shared/CategoryMenu";
import { Logo } from "../shared/Logo";

export interface RowProps {
  t: Transaction;
  ledger: Ledger;
  asOf: IsoDate;
  selected: boolean;
  open: boolean;
  /** Roving tab stop: the row and its controls are tabbable. */
  current: boolean;
  /** Pinned drilldown row outside the filters. */
  onUnpin?: () => void;
  onSelect(id: string, extend: boolean): void;
  onOpen(id: string): void;
  onCategory(t: Transaction, category: string, subcategory?: string): void;
  onKeyDown(event: KeyboardEvent<HTMLTableRowElement>, id: string): void;
  onFocusRow(id: string): void;
}

/** The category already says it is a transfer: no extra « Virement » tag. */
const saysTransfer = (t: Transaction) =>
  /transfer|virement/.test(normalize(t.category));

export const Row = memo(function Row({
  t,
  ledger,
  asOf,
  selected,
  open,
  current,
  onUnpin,
  onSelect,
  onOpen,
  onCategory,
  onKeyDown,
  onFocusRow,
}: RowProps) {
  const name = merchantLabel(t);
  const future = t.date > asOf;
  const tab = current ? 0 : -1;
  const uncategorized = isUncategorized(t.category);
  const raw = [t.label, t.merchant].find(
    (text) => text && normalize(text) !== normalize(name),
  );

  const onClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("button, a, input, label"))
      return;
    onOpen(t.id);
  };

  return (
    <tr
      className="tx-row"
      data-row={t.id}
      data-selected={selected || undefined}
      data-open={open || undefined}
      data-future={future || undefined}
      tabIndex={tab}
      aria-selected={selected}
      aria-expanded={open}
      aria-label={`${name}, ${formatDay(t.date)}`}
      onClick={onClick}
      onKeyDown={(event) => onKeyDown(event, t.id)}
      onFocus={(event) => {
        if (event.currentTarget.contains(event.target)) onFocusRow(t.id);
      }}
    >
      <td className="tx-c-check">
        <label className="tx-hit">
          <input
            type="checkbox"
            tabIndex={tab}
            checked={selected}
            aria-label={`Sélectionner ${name} du ${formatDay(t.date)}`}
            onChange={() => undefined}
            onClick={(event) => onSelect(t.id, event.shiftKey)}
          />
        </label>
      </td>
      <td className="tx-c-date">{formatDay(t.date)}</td>
      <td className="tx-c-op">
        <span className="tx-op">
          <Logo
            ledger={ledger}
            name={name}
            category={t.category}
            subcategory={t.subcategory}
            icon={t.internal ? ArrowLeftRight : undefined}
            size={28}
          />
          <span className="tx-op-text">
            <span className="tx-op-name">
              <span className="tx-op-merchant">{name}</span>
              {future && <Badge tone="new">À venir</Badge>}
              {t.internal && !saysTransfer(t) && (
                <Badge title="Virement interne, hors totaux">Virement</Badge>
              )}
              {t.note?.trim() && (
                <StickyNote
                  className="tx-op-note"
                  size={14}
                  aria-label="Avec note"
                  role="img"
                >
                  <title>{t.note}</title>
                </StickyNote>
              )}
              {onUnpin && (
                <span className="tx-pin">
                  <Badge tone="warning">Hors période</Badge>
                  <button
                    type="button"
                    className="tx-icon"
                    aria-label="Retirer l’opération épinglée"
                    title="Retirer"
                    tabIndex={tab}
                    onClick={onUnpin}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </span>
              )}
            </span>
            {raw && <span className="tx-op-raw">{raw}</span>}
          </span>
        </span>
      </td>
      <td className="tx-c-cat">
        <CategoryMenu
          ledger={ledger}
          value={t.category}
          subcategory={t.subcategory}
          suggestions={uncategorized ? suggestCategories(ledger, t) : undefined}
          direction={t.amount > 0 ? "income" : "expense"}
          onSelect={(category, subcategory) =>
            onCategory(t, category, subcategory)
          }
          trigger={
            <button
              type="button"
              className="tx-cat"
              tabIndex={tab}
              aria-label={`Catégorie : ${categoryText(t.category, t.subcategory)}. Changer`}
            >
              <CategoryLabel
                ledger={ledger}
                category={t.category}
                subcategory={t.subcategory}
                derived={Boolean(t.subcategorySource)}
              />
            </button>
          }
        />
      </td>
      <td className="tx-c-acct">
        <AccountTag ledger={ledger} id={t.account} />
      </td>
      <td className="tx-c-amount">
        <Money value={t.amount} signed cents="always" />
      </td>
    </tr>
  );
});
