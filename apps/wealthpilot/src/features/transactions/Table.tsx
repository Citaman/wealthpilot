import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { formatWeekday } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import type { TransactionSort } from "../../domain/search";
import type { IsoDate, Transaction } from "../../domain/types";
import { Money } from "../../ui/Money";
import { Row } from "./Row";
import { RowDetail } from "./RowDetail";
import type { Density } from "./state";

const COLUMNS = 6;

export interface TableProps {
  ledger: Ledger;
  asOf: IsoDate;
  rows: Transaction[];
  pinned: Transaction | null;
  onUnpin(): void;
  /** Day → net of that day's filtered operations (date sorts only). */
  dayTotals: Map<IsoDate, number> | null;
  density: Density;
  sort: TransactionSort;
  onSort(sort: TransactionSort): void;
  selected: ReadonlySet<string>;
  onSelect(ids: string[], selected: boolean): void;
  openId: string | null;
  onOpen(id: string | null): void;
  onCategory(t: Transaction, category: string, subcategory?: string): void;
  tableRef: Ref<HTMLTableElement>;
}

export function Table({
  ledger,
  asOf,
  rows,
  pinned,
  onUnpin,
  dayTotals,
  density,
  sort,
  onSort,
  selected,
  onSelect,
  openId,
  onOpen,
  onCategory,
  tableRef,
}: TableProps) {
  const body = useRef<HTMLTableSectionElement>(null);
  const header = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const lastClicked = useRef<string | null>(null);
  const pageIds = useMemo(() => rows.map((t) => t.id), [rows]);
  const ids = useMemo(
    () => [...(pinned ? [pinned.id] : []), ...pageIds],
    [pinned, pageIds],
  );
  const current = activeId && ids.includes(activeId) ? activeId : ids[0];
  const chosen = pageIds.filter((id) => selected.has(id)).length;

  useEffect(() => {
    if (header.current)
      header.current.indeterminate = chosen > 0 && chosen < pageIds.length;
  }, [chosen, pageIds.length]);

  const rowElement = (id: string) => findRow(body.current, id);

  // Opening a row below another open one must not move it on screen.
  useLayoutEffect(() => {
    const target = anchor.current;
    anchor.current = null;
    const el = target && rowElement(target.id);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - target.top;
    if (Math.abs(delta) > 1) scrollBy({ top: delta, behavior: "instant" });
  }, [openId]);

  // A row that leaves the result (e.g. just categorized) hands focus to its neighbour.
  const lastIndex = useRef(0);
  useEffect(() => {
    if (!activeId) return;
    const index = ids.indexOf(activeId);
    if (index >= 0) {
      lastIndex.current = index;
      return;
    }
    if (document.activeElement === document.body && ids.length) {
      const next = ids[Math.min(lastIndex.current, ids.length - 1)];
      setActiveId(next);
      rowElement(next)?.focus({ preventScroll: true });
    }
  });

  const toggleOpen = useStable((id: string) => {
    const el = rowElement(id);
    if (el) anchor.current = { id, top: el.getBoundingClientRect().top };
    onOpen(openId === id ? null : id);
  });

  const select = useStable((id: string, extend: boolean) => {
      const from = lastClicked.current ? pageIds.indexOf(lastClicked.current) : -1;
      const to = pageIds.indexOf(id);
      lastClicked.current = id;
      const value = !selected.has(id);
      if (extend && from >= 0 && to >= 0)
        onSelect(
          pageIds.slice(Math.min(from, to), Math.max(from, to) + 1),
          value,
        );
      else onSelect([id], value);
  });

  const onKeyDown = useStable(
    (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
      if (event.target !== event.currentTarget) {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          event.currentTarget.contains(event.target as Node) &&
          openId === id
        ) {
          onOpen(null);
          event.currentTarget.focus();
        }
        return;
      }
      const index = ids.indexOf(id);
      const moves: Record<string, number> = {
        ArrowDown: index + 1,
        ArrowUp: index - 1,
        Home: 0,
        End: ids.length - 1,
      };
      if (event.key in moves) {
        event.preventDefault();
        const next = ids[moves[event.key]];
        if (next) rowElement(next)?.focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        toggleOpen(id);
      } else if (event.key === " ") {
        event.preventDefault();
        select(id, event.shiftKey);
      } else if (event.key === "Escape" && openId === id) {
        event.preventDefault();
        onOpen(null);
      }
    },
  );

  const closeDetail = useCallback(
    (id: string) => {
      onOpen(null);
      requestAnimationFrame(() => rowElement(id)?.focus());
    },
    [onOpen],
  );

  const sortHeader = (
    label: string,
    desc: TransactionSort,
    asc: TransactionSort,
  ) => {
    const state = sort === desc ? "descending" : sort === asc ? "ascending" : "none";
    return {
      "aria-sort": state,
      children: (
        <button
          type="button"
          className="tx-sort"
          data-active={state !== "none" || undefined}
          title={`Trier par ${label.toLowerCase()}`}
          onClick={() => onSort(sort === desc ? asc : desc)}
        >
          {label}
          {state === "ascending" ? (
            <ArrowUp size={12} aria-hidden />
          ) : (
            <ArrowDown size={12} aria-hidden />
          )}
        </button>
      ),
    } as const;
  };

  const renderRow = (t: Transaction, isPinned: boolean) => (
    <Fragment key={(isPinned ? "pin:" : "") + t.id}>
      <Row
        t={t}
        ledger={ledger}
        asOf={asOf}
        selected={selected.has(t.id)}
        open={openId === t.id}
        current={current === t.id}
        onUnpin={isPinned ? onUnpin : undefined}
        onSelect={select}
        onOpen={toggleOpen}
        onCategory={onCategory}
        onKeyDown={onKeyDown}
        onFocusRow={setActiveId}
      />
      {openId === t.id && (
        <RowDetail
          t={t}
          ledger={ledger}
          asOf={asOf}
          columns={COLUMNS}
          onCategory={onCategory}
          onClose={() => closeDetail(t.id)}
        />
      )}
    </Fragment>
  );

  let previousDay: string | null = null;
  return (
    <table
      className="tx-table"
      data-density={density}
      ref={tableRef}
      aria-label="Opérations"
    >
      <colgroup>
        <col className="tx-col-check" />
        <col className="tx-col-date" />
        <col className="tx-col-op" />
        <col className="tx-col-cat" />
        <col className="tx-col-acct" />
        <col className="tx-col-amount" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col" className="tx-c-check">
            <label className="tx-hit">
              <input
                ref={header}
                type="checkbox"
                checked={pageIds.length > 0 && chosen === pageIds.length}
                aria-label="Sélectionner cette page"
                onChange={(event) =>
                  onSelect(pageIds, event.currentTarget.checked)
                }
              />
              <span className="tx-head-page">Cette page</span>
            </label>
          </th>
          <th scope="col" className="tx-c-date" {...sortHeader("Date", "date-desc", "date-asc")} />
          <th scope="col" className="tx-c-op">
            Opération
          </th>
          <th scope="col" className="tx-c-cat">
            Catégorie
          </th>
          <th scope="col" className="tx-c-acct">
            Compte
          </th>
          <th scope="col" className="tx-c-amount" {...sortHeader("Montant", "amount-desc", "amount-asc")} />
        </tr>
      </thead>
      <tbody ref={body}>
        {pinned && renderRow(pinned, true)}
        {pinned && rows.length > 0 && (
          <tr className="tx-pin-gap" aria-hidden>
            <td colSpan={COLUMNS} />
          </tr>
        )}
        {rows.map((t) => {
          const day =
            dayTotals && t.date !== previousDay ? (
              <tr className="tx-day" key={`day:${t.date}`}>
                <td colSpan={COLUMNS - 1}>{formatWeekday(t.date)}</td>
                <td className="tx-c-amount">
                  <Money value={dayTotals.get(t.date) ?? 0} signed tone="none" />
                </td>
              </tr>
            ) : null;
          previousDay = t.date;
          return (
            <Fragment key={t.id}>
              {day}
              {renderRow(t, false)}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

/** A callback with a fixed identity that always sees the latest render. */
function useStable<A extends unknown[]>(fn: (...args: A) => void) {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}

export const findRow = (root: Element | null | undefined, id: string) =>
  [...(root?.querySelectorAll<HTMLElement>("tr[data-row]") ?? [])].find(
    (row) => row.dataset.row === id,
  );
