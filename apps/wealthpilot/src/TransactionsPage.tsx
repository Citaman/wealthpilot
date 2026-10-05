import {
  useMemo,
  useState,
  useEffect,
  useDeferredValue,
  useRef,
  type RefObject,
} from "react";
import "./transaction-controls.css";
import {
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CornerDownLeft,
} from "lucide-react";
import type { Snapshot, Transaction } from "./types";
import type { TransactionSelection } from "./navigation";
import type { DateRange } from "./periods";
import { euro, dateLabel, monthEnd, parseMoney, today } from "./domain";
import { db } from "./store";
import { MerchantIcon, Field } from "./ui";
import { Select } from "./Select";
import { PageActions } from "./PageActions";
import { download } from "./download";
import { exportCSV } from "./importer";
import { merchantLabel, normalize, searchScore } from "./search";
import { subcategoryOf } from "./merchants";
type Patch = Pick<
  Transaction,
  | "merchantName"
  | "category"
  | "subcategory"
  | "categoryId"
  | "subcategoryId"
  | "note"
  | "internal"
>;
const editable = (t: Transaction): Patch => ({
  merchantName: t.merchantName,
  category: t.category,
  subcategory: t.subcategory,
  categoryId: t.categoryId,
  subcategoryId: t.subcategoryId,
  note: t.note,
  internal: t.internal,
});
type Draft = {
  name: string;
  category: string;
  subcategory: string;
  note: string;
  internal: boolean;
  all: boolean;
};
const draftFor = (t: Transaction): Draft => ({
  name: merchantLabel(t),
  category: t.category,
  subcategory: t.subcategory ?? subcategoryOf(t.raw),
  note: t.note ?? "",
  internal: t.internal,
  all: false,
});
type OriginPatch = {
  id: string;
  patch: Partial<Patch>;
  preserveDraft?: boolean;
};
type UndoPatch = { id: string; patch: Partial<Patch>; after: Partial<Patch> };
const pageSizes = [25, 50, 75, 100, 150];
const densities = ["compact", "standard", "comfortable"] as const;
type Density = (typeof densities)[number];
function savedPresentation() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("wealthpilot-ledger-presentation") ?? "{}",
    );
    return {
      pageSize: pageSizes.includes(saved.pageSize)
        ? (saved.pageSize as number)
        : 25,
      density: densities.includes(saved.density)
        ? (saved.density as Density)
        : ("standard" as Density),
    };
  } catch {
    return { pageSize: 25, density: "standard" as Density };
  }
}

export function TransactionsPage({
  snapshot,
  from,
  month,
  account,
  range,
  navigationFilter,
  notify,
}: {
  snapshot: Snapshot;
  from: string;
  month: string;
  account: string;
  range?: DateRange;
  navigationFilter?: TransactionSelection & {
    category: string;
    revision: number;
  };
  notify: (s: string) => void;
}) {
  const fromDate = range?.from ?? from + "-01";
  const toDate = range?.to ?? monthEnd(month);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [direction, setDirection] = useState("all"),
    [sort, setSort] = useState("date-desc"),
    [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(() => savedPresentation().pageSize),
    [density, setDensity] = useState<Density>(
      () => savedPresentation().density,
    ),
    [editing, setEditing] = useState<string | null>(null),
    [detailMode, setDetailMode] = useState<"details" | "category">("details"),
    [filters, setFilters] = useState(false),
    [minimum, setMinimum] = useState(""),
    [maximum, setMaximum] = useState(""),
    [classification, setClassification] = useState("all"),
    [selected, setSelected] = useState<string[]>([]),
    [bulkCategory, setBulkCategory] = useState(""),
    [undo, setUndo] = useState<UndoPatch[]>([]),
    [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [targetIds, setTargetIds] = useState<string[] | null>(null);
  const [outsideTarget, setOutsideTarget] = useState<{
    id: string;
    context: string;
  } | null>(null);
  const outsideHeading = useRef<HTMLHeadingElement>(null);
  const pendingTarget = useRef<string | null>(null);
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const searchInput = useRef<HTMLInputElement>(null);
  const paginationTop = useRef<HTMLElement>(null);
  const selectionCount = useRef(0);
  selectionCount.current = selected.length;
  useEffect(() => {
    try {
      localStorage.setItem(
        "wealthpilot-ledger-presentation",
        JSON.stringify({ pageSize, density }),
      );
    } catch {
      /* Presentation only; financial writes remain in IndexedDB. */
    }
  }, [pageSize, density]);
  function restoreRowFocus(id: string | null) {
    requestAnimationFrame(() =>
      ((id && rowButtons.current.get(id)) || searchInput.current)?.focus(),
    );
  }
  function closeDetails(discard = false) {
    if (discard && editing)
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[editing];
        return next;
      });
    restoreRowFocus(editing);
    setOutsideTarget(null);
    setEditing(null);
  }
  const q = useDeferredValue(query);
  const contextKey = JSON.stringify([
    fromDate,
    toDate,
    account,
    query,
    category,
    direction,
    minimum,
    maximum,
    classification,
  ]);
  // A drilldown grants access to one out-of-period detail, not a wider ledger.
  // Returning to an earlier filter must not silently reopen that detail.
  useEffect(() => {
    if (outsideTarget && outsideTarget.context !== contextKey) {
      setOutsideTarget(null);
      setEditing((previous) =>
        previous === outsideTarget.id ? null : previous,
      );
      pendingTarget.current = null;
    }
  }, [contextKey]);
  useEffect(() => {
    if (!navigationFilter) return;
    const target = snapshot.transactions.find(
      (t) =>
        t.id === navigationFilter.transactionId &&
        (!account || t.account === account),
    );
    setQuery("");
    setCategory(navigationFilter.category);
    setDirection("all");
    setClassification(
      navigationFilter.review === "uncategorized" ? "uncategorized" : "all",
    );
    setTargetIds(navigationFilter.transactionIds ?? null);
    pendingTarget.current = target?.id ?? null;
    setOutsideTarget(
      target && (target.date < fromDate || target.date > toDate)
        ? {
            id: target.id,
            context: JSON.stringify([
              fromDate,
              toDate,
              account,
              "",
              navigationFilter.category,
              "all",
              "",
              "",
              navigationFilter.review === "uncategorized"
                ? "uncategorized"
                : "all",
            ]),
          }
        : null,
    );
    setMinimum("");
    setMaximum("");
    setFilters(
      !!navigationFilter.category ||
        navigationFilter.review === "uncategorized",
    );
    setEditing(target?.id ?? null);
    setDetailMode("details");
    setPage(0);
    setSelected([]);
  }, [navigationFilter]);
  const outsideTransaction =
    outsideTarget?.context === contextKey && editing === outsideTarget.id
      ? snapshot.transactions.find(
          (t) =>
            t.id === outsideTarget.id &&
            (!account || t.account === account) &&
            (t.date < fromDate || t.date > toDate),
        )
      : undefined;
  useEffect(() => {
    if (!outsideTransaction) return;
    pendingTarget.current = null;
    const frame = requestAnimationFrame(() => {
      const heading = outsideHeading.current;
      if (!heading?.isConnected || heading.closest("[hidden]")) return;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView?.({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [outsideTransaction?.id]);
  useEffect(() => {
    setPage(0);
    if (selectionCount.current)
      notify(
        "Filtres modifiés : la sélection a été effacée. Vos brouillons sont conservés.",
      );
    setSelected([]);
  }, [
    fromDate,
    toDate,
    account,
    q,
    category,
    direction,
    minimum,
    maximum,
    classification,
  ]);
  useEffect(() => {
    setPage(0);
  }, [sort]);
  const categories = useMemo(
    () => [...new Set(snapshot.transactions.map((t) => t.category))].sort(),
    [snapshot.transactions],
  );
  const scoped = useMemo(
    () =>
      snapshot.transactions.filter(
        (t) =>
          t.date >= fromDate &&
          t.date <= toDate &&
          (!account || t.account === account),
      ),
    [snapshot.transactions, fromDate, toDate, account],
  );
  const minAmount = minimum.trim() ? parseMoney(minimum) : null;
  const maxAmount = maximum.trim() ? parseMoney(maximum) : null;
  const amountError =
    minimum.trim() && (minAmount === null || minAmount < 0)
      ? "Le montant minimum doit être un nombre positif ou nul."
      : maximum.trim() && (maxAmount === null || maxAmount < 0)
        ? "Le montant maximum doit être un nombre positif ou nul."
        : minAmount !== null && maxAmount !== null && minAmount > maxAmount
          ? "Le minimum doit être inférieur ou égal au maximum."
          : "";
  const rows = useMemo(
    () =>
      scoped
        .map((t) => ({ t, score: searchScore(t, q) }))
        .filter(
          ({ t, score }) =>
            score > 0 &&
            (!targetIds || targetIds.includes(t.id)) &&
            (!category || t.category === category) &&
            (classification === "all" ||
              /à catégoriser|a categoriser|non class|uncategor|autre|other|^$/i.test(
                t.category.trim(),
              )) &&
            (direction === "all" ||
              (direction === "internal"
                ? t.internal
                : !t.internal &&
                  (direction === "expense" ? t.amount < 0 : t.amount > 0))) &&
            (amountError ||
              minAmount === null ||
              Math.abs(t.amount) >= minAmount) &&
            (amountError ||
              maxAmount === null ||
              Math.abs(t.amount) <= maxAmount),
        )
        .sort((a, b) =>
          q && a.score !== b.score
            ? b.score - a.score
            : sort === "amount"
              ? Math.abs(b.t.amount) - Math.abs(a.t.amount)
              : sort === "merchant"
                ? merchantLabel(a.t).localeCompare(merchantLabel(b.t))
                : sort === "date-asc"
                  ? a.t.date.localeCompare(b.t.date)
                  : b.t.date.localeCompare(a.t.date),
        )
        .map(({ t }) => t),
    [
      scoped,
      targetIds,
      q,
      category,
      classification,
      direction,
      minAmount,
      maxAmount,
      amountError,
      sort,
    ],
  );
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1),
    current = Math.min(page, lastPage),
    visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  useEffect(() => {
    const id = pendingTarget.current;
    if (!id || q !== "" || query !== "") return;
    const index = rows.findIndex((t) => t.id === id);
    if (index < 0) return;
    setPage(Math.floor(index / pageSize));
    requestAnimationFrame(() => {
      const button = rowButtons.current.get(id);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView?.({ block: "center", behavior: "instant" });
    });
    pendingTarget.current = null;
  }, [rows, pageSize, q, query]);
  useEffect(() => {
    setPage((previous) => Math.min(previous, lastPage));
  }, [lastPage]);
  function changePage(next: number) {
    setPage(Math.max(0, Math.min(lastPage, next)));
    requestAnimationFrame(() => {
      paginationTop.current?.focus({ preventScroll: true });
      paginationTop.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    });
  }
  function changePageSize(next: number) {
    if (!pageSizes.includes(next)) return;
    const anchor =
      visible.find((t) => {
        const rect = rowButtons.current.get(t.id)?.getBoundingClientRect();
        return rect && rect.bottom > 0 && rect.top < window.innerHeight - 100;
      }) ?? visible[0];
    const anchorIndex = anchor ? rows.findIndex((t) => t.id === anchor.id) : 0;
    setPageSize(next);
    setPage(Math.floor(Math.max(0, anchorIndex) / next));
    if (anchor)
      requestAnimationFrame(() =>
        rowButtons.current
          .get(anchor.id)
          ?.scrollIntoView({ block: "nearest", behavior: "instant" }),
      );
  }
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(
    () => snapshot.transactions.filter((t) => selectedSet.has(t.id)),
    [snapshot.transactions, selectedSet],
  );
  const pagination = (position: "top" | "bottom") => (
    <LedgerPagination
      position={position}
      count={rows.length}
      page={current}
      pageSize={pageSize}
      onPage={changePage}
      onPageSize={changePageSize}
      focusRef={position === "top" ? paginationTop : undefined}
    />
  );
  const spending = rows
      .filter((t) => !t.internal && t.amount < 0)
      .reduce((n, t) => n - t.amount, 0),
    income = rows
      .filter((t) => !t.internal && t.amount > 0)
      .reduce((n, t) => n + t.amount, 0);
  const merchantCount = new Set(rows.map((t) => normalize(merchantLabel(t))))
    .size;
  const activeFilters =
    Number(!!category) +
    Number(direction !== "all") +
    Number(classification !== "all") +
    Number(!!minimum) +
    Number(!!maximum);
  async function update(
    ids: string[],
    patch: Partial<Patch>,
    origin?: OriginPatch,
  ) {
    setBusy(true);
    try {
      const before: UndoPatch[] = [];
      await db.transaction("rw", db.transactions, async () => {
        for (const id of ids) {
          const t = await db.transactions.get(id);
          if (!t) continue;
          const next = {
            ...patch,
            ...(origin?.id === id ? origin.patch : {}),
          };
          if ("category" in next || "subcategory" in next) {
            const definitions = snapshot.preferences.categoryDefinitions ?? [];
            const category = definitions.find(
              (d) =>
                !d.parentId &&
                !d.archived &&
                d.name === (next.category ?? t.category),
            );
            const subcategory =
              category &&
              definitions.find(
                (d) =>
                  d.parentId === category.id &&
                  !d.archived &&
                  d.name === (next.subcategory ?? t.subcategory),
              );
            next.categoryId = category?.id;
            next.subcategoryId = subcategory?.id;
          }
          const previous = editable(t);
          const changedKeys = (Object.keys(next) as (keyof Patch)[]).filter(
            (key) => next[key] !== previous[key],
          );
          before.push({
            id,
            patch: Object.fromEntries(
              changedKeys.map((key) => [key, previous[key]]),
            ),
            after: Object.fromEntries(
              changedKeys.map((key) => [key, next[key]]),
            ),
          });
          await db.transactions.update(id, next);
        }
      });
      setUndo(before);
      notify(
        `${before.length} opération${before.length > 1 ? "s" : ""} mise${before.length > 1 ? "s" : ""} à jour.`,
      );
      if (origin) {
        if (!origin.preserveDraft)
          setDrafts((previous) => {
            const next = { ...previous };
            delete next[origin.id];
            return next;
          });
        if (editing === origin.id) closeDetails();
      } else restoreRowFocus(ids[0] ?? null);
      setSelected([]);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setTargetIds(null);
    setQuery("");
    setCategory("");
    setDirection("all");
    setClassification("all");
    setMinimum("");
    setMaximum("");
  }
  return (
    <main className={"page ledger-page ledger-density-" + density}>
      <h1 className="sr-only">Transactions</h1>
      <PageActions page="transactions">
        <button
          className="dock-action"
          aria-label="Exporter le résultat filtré"
          disabled={!rows.length}
          onClick={() =>
            download(
              "wealthpilot-selection.csv",
              exportCSV(rows),
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={17} /> <span>Exporter</span>
        </button>
      </PageActions>
      <div className="ledger-summary">
        <div>
          <span>Sorties du résultat filtré</span>
          <strong>{euro(spending)}</strong>
        </div>
        <div>
          <span>Entrées</span>
          <strong>{euro(income)}</strong>
        </div>
        <div>
          <span>Commerçants & entités</span>
          <strong>{merchantCount}</strong>
        </div>
      </div>
      {outsideTransaction && (
        <section
          className="ledger-outside-period"
          aria-label="Opération consultée hors période"
        >
          <header>
            <h2 ref={outsideHeading} tabIndex={-1}>
              {outsideTransaction.date > today()
                ? "Opération future consultée depuis les prévisions"
                : "Opération consultée hors de la période"}
            </h2>
            <p>
              Cette opération est consultée séparément. Elle est exclue des
              totaux, des sélections et des exports de l’historique affiché du{" "}
              {dateLabel(fromDate)} au {dateLabel(toDate)}.
            </p>
          </header>
          <TransactionDetails
            key={outsideTransaction.id}
            transaction={outsideTransaction}
            draft={
              drafts[outsideTransaction.id] ?? draftFor(outsideTransaction)
            }
            setDraft={(next) =>
              setDrafts((previous) => ({
                ...previous,
                [outsideTransaction.id]: next,
              }))
            }
            snapshot={snapshot}
            categories={categories}
            busy={busy}
            update={update}
            close={closeDetails}
          />
        </section>
      )}
      <section
        className="ledger-surface"
        aria-label="Journal des transactions"
        aria-busy={query !== q}
        data-search-query={q}
      >
        {targetIds && (
          <p className="notice">
            Sélection issue du dashboard : {targetIds.length} opération(s).{" "}
            <button className="text-button" onClick={() => setTargetIds(null)}>
              Afficher toutes les opérations de ce périmètre
            </button>
          </p>
        )}
        <div className="ledger-search">
          <Search size={21} />
          <input
            ref={searchInput}
            aria-label="Rechercher une opération"
            type="search"
            placeholder="Un nom, une catégorie, un souvenir…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={"button compact " + (filters ? "dark" : "")}
            onClick={() => setFilters(!filters)}
            aria-expanded={filters}
          >
            <SlidersHorizontal size={16} /> Filtres{" "}
            {activeFilters > 0 && <b>{activeFilters}</b>}
          </button>
        </div>
        <div className="ledger-viewbar">
          <div className="ledger-tabs" aria-label="Type d’opération">
            {[
              ["all", "Tout"],
              ["expense", "Dépenses"],
              ["income", "Revenus"],
              ["internal", "Virements"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={direction === value}
                onClick={() => setDirection(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <Select
            aria-label="Trier les opérations"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="date-desc">Plus récentes</option>
            <option value="date-asc">Plus anciennes</option>
            <option value="amount">Montants les plus élevés</option>
            <option value="merchant">Commerçant A–Z</option>
          </Select>
        </div>
        <fieldset className="ledger-density-control">
          <legend>Densité d’affichage</legend>
          {densities.map((value, i) => (
            <button
              key={value}
              type="button"
              aria-pressed={density === value}
              onClick={() => setDensity(value)}
            >
              {["Compacte", "Standard", "Confortable"][i]}
            </button>
          ))}
          <span>
            La densité ne change ni les données ni le nombre de lignes.
          </span>
        </fieldset>
        {filters && (
          <div className="ledger-filters">
            <Field label="Catégorie">
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Catégorisation">
              <Select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
              >
                <option value="all">Toutes les opérations</option>
                <option value="uncategorized">À catégoriser</option>
              </Select>
            </Field>
            <Field label="Montant minimum (€)">
              <input
                inputMode="decimal"
                aria-invalid={!!amountError}
                aria-describedby={
                  amountError ? "amount-filter-error" : undefined
                }
                value={minimum}
                onChange={(e) => setMinimum(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Montant maximum (€)">
              <input
                inputMode="decimal"
                aria-invalid={!!amountError}
                aria-describedby={
                  amountError ? "amount-filter-error" : undefined
                }
                value={maximum}
                onChange={(e) => setMaximum(e.target.value)}
                placeholder="Sans limite"
              />
            </Field>
            {amountError && (
              <p id="amount-filter-error" className="filter-error" role="alert">
                {amountError} Les bornes de montant ne sont pas appliquées.
              </p>
            )}
            <button className="text-button" onClick={reset}>
              Réinitialiser les filtres
            </button>
          </div>
        )}
        <div className="ledger-resultline">
          <label className="ledger-select-page">
            <input
              type="checkbox"
              aria-label="Sélectionner cette page"
              disabled={!visible.length}
              checked={
                visible.length > 0 &&
                visible.every((t) => selected.includes(t.id))
              }
              ref={(node) => {
                if (node)
                  node.indeterminate =
                    visible.some((t) => selected.includes(t.id)) &&
                    !visible.every((t) => selected.includes(t.id));
              }}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...new Set([...selected, ...visible.map((t) => t.id)])]
                    : selected.filter(
                        (id) => !visible.some((t) => t.id === id),
                      ),
                )
              }
            />
            Sélectionner cette page
          </label>
          <span>
            {rows.length} opérations · {dateLabel(fromDate)} →{" "}
            {dateLabel(toDate)}
          </span>
          {query && (
            <span>
              Accents, abréviations et fautes tolérés · pertinence d’abord
            </span>
          )}
        </div>
        {!!Object.keys(drafts).length && (
          <div className="ledger-drafts" role="status">
            {Object.keys(drafts).length} brouillon(s) conservé(s) dans cette
            vue. Rouvrez une opération pour reprendre ou annuler sa
            modification.
          </div>
        )}
        {!!selected.length && (
          <div className="ledger-bulk">
            <b id="ledger-selection-summary">
              {selectedRows.length} sélectionnées sur {rows.length} résultats ·
              toutes pages confondues
            </b>
            <small className="ledger-selection-warning">
              Changer un filtre effacera cette sélection ; les brouillons seront
              conservés.
            </small>
            <button
              className="button compact"
              disabled={!selectedRows.length}
              onClick={() =>
                download(
                  "wealthpilot-operations-selectionnees.csv",
                  exportCSV(selectedRows),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={15} /> Exporter les sélectionnées
            </button>
            <Select
              aria-label="Catégorie des opérations sélectionnées"
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            >
              <option value="">Choisir une catégorie</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <button
              className="button compact"
              aria-describedby="ledger-selection-summary"
              disabled={!bulkCategory || busy}
              onClick={() =>
                update(selected, { category: bulkCategory, subcategory: "" })
              }
            >
              Appliquer
            </button>
            <button
              className="icon-button"
              aria-label="Désélectionner"
              onClick={() => setSelected([])}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!!undo.length && (
          <div className="ledger-undo" role="status">
            <span>
              Modification enregistrée pour {undo.length} opération(s).
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await db.transaction("rw", db.transactions, async () => {
                    for (const u of undo) {
                      const current = await db.transactions.get(u.id);
                      if (
                        !current ||
                        (Object.keys(u.after) as (keyof Patch)[]).some(
                          (key) => current[key] !== u.after[key],
                        )
                      )
                        throw new Error(
                          "Une opération a été modifiée depuis cette action. L’annulation n’a rien changé ; vérifiez ses détails.",
                        );
                      await db.transactions.update(u.id, u.patch);
                    }
                  });
                  restoreRowFocus(undo[0]?.id ?? null);
                  setUndo([]);
                  notify("Modification annulée.");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Annuler la modification
            </button>
          </div>
        )}
        {pagination("top")}
        {!rows.length ? (
          <div className="ledger-empty">
            <Search size={30} />
            <h2>Aucun mouvement trouvé.</h2>
            <p>Essayez un nom plus court ou élargissez la période.</p>
            <button className="button" onClick={reset}>
              Effacer la recherche et les filtres
            </button>
          </div>
        ) : (
          <div className="ledger-table" role="table" aria-label="Transactions">
            <div className="ledger-head" role="row">
              <span role="columnheader">
                <span className="sr-only">Sélection</span>
              </span>
              <span role="columnheader">Opération</span>
              <span role="columnheader">Catégorie</span>
              <span role="columnheader">Compte</span>
              <span role="columnheader">Montant</span>
            </div>
            {visible.map((t) => (
              <div
                className={
                  "ledger-entry " + (editing === t.id ? "expanded" : "")
                }
                key={t.id}
              >
                <div className="ledger-row" role="row">
                  <span role="cell">
                    <input
                      type="checkbox"
                      aria-label={
                        "Sélectionner " + merchantLabel(t) + " du " + t.date
                      }
                      aria-describedby={
                        drafts[t.id] ? "draft-" + t.id : undefined
                      }
                      checked={selected.includes(t.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, t.id]
                            : selected.filter((id) => id !== t.id),
                        )
                      }
                    />
                  </span>
                  <div role="cell">
                    <button
                      ref={(node) => {
                        if (node) rowButtons.current.set(t.id, node);
                        else rowButtons.current.delete(t.id);
                      }}
                      className="ledger-merchant"
                      aria-describedby={
                        drafts[t.id] ? "draft-" + t.id : undefined
                      }
                      aria-label={
                        "Détails de " +
                        merchantLabel(t) +
                        " du " +
                        dateLabel(t.date)
                      }
                      aria-expanded={
                        editing === t.id && detailMode === "details"
                      }
                      onClick={() => {
                        setEditing(
                          editing === t.id && detailMode === "details"
                            ? null
                            : t.id,
                        );
                        setDetailMode("details");
                      }}
                    >
                      <MerchantIcon
                        name={merchantLabel(t)}
                        category={t.category}
                        subcategory={t.subcategory ?? subcategoryOf(t.raw)}
                      />
                      <span>
                        <b>{merchantLabel(t)}</b>
                        <small>
                          {dateLabel(t.date)}
                          {t.note ? " · Note" : ""}
                          {drafts[t.id] && (
                            <span id={"draft-" + t.id}>
                              {" "}
                              · Brouillon non enregistré
                            </span>
                          )}
                        </small>
                      </span>
                    </button>
                  </div>
                  <div role="cell">
                    <button
                      className="category-chip"
                      onClick={() => {
                        setEditing(
                          editing === t.id && detailMode === "category"
                            ? null
                            : t.id,
                        );
                        setDetailMode("category");
                      }}
                      aria-label={"Catégoriser " + merchantLabel(t)}
                      aria-expanded={
                        editing === t.id && detailMode === "category"
                      }
                    >
                      {t.category}
                    </button>
                    <small className="subcategory-label">
                      {t.subcategory ?? subcategoryOf(t.raw)}
                    </small>
                  </div>
                  <span className="ledger-account" role="cell">
                    {t.account}
                    {t.internal && <small>Virement interne</small>}
                  </span>
                  <strong
                    role="cell"
                    className={t.amount > 0 ? "positive" : ""}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {euro(t.amount)}
                  </strong>
                </div>
                {editing === t.id && detailMode === "category" ? (
                  <CategoryInline
                    key={t.id}
                    transaction={t}
                    categories={categories}
                    draft={drafts[t.id] ?? draftFor(t)}
                    setDraft={(next) =>
                      setDrafts((previous) => ({ ...previous, [t.id]: next }))
                    }
                    busy={busy}
                    update={update}
                    close={closeDetails}
                    details={() => setDetailMode("details")}
                  />
                ) : (
                  editing === t.id && (
                    <TransactionDetails
                      key={t.id}
                      transaction={t}
                      draft={drafts[t.id] ?? draftFor(t)}
                      setDraft={(next) =>
                        setDrafts((previous) => ({ ...previous, [t.id]: next }))
                      }
                      snapshot={snapshot}
                      categories={categories}
                      busy={busy}
                      update={update}
                      close={closeDetails}
                    />
                  )
                )}
              </div>
            ))}
          </div>
        )}
        {pagination("bottom")}
      </section>
    </main>
  );
}
function LedgerPagination({
  position,
  count,
  page,
  pageSize,
  onPage,
  onPageSize,
  focusRef,
}: {
  position: "top" | "bottom";
  count: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  focusRef?: RefObject<HTMLElement | null>;
}) {
  const pages = Math.ceil(count / pageSize);
  const [jump, setJump] = useState(pages ? String(page + 1) : "");
  const [error, setError] = useState("");
  useEffect(() => {
    setJump(pages ? String(page + 1) : "");
    setError("");
  }, [page, pages]);
  const numbered = [
    ...new Set([
      0,
      pages - 1,
      ...Array.from({ length: 5 }, (_, i) => page + i - 2),
    ]),
  ]
    .filter((n) => n >= 0 && n < pages)
    .sort((a, b) => a - b);
  const where = position === "top" ? "haut" : "bas";
  return (
    <nav
      className="ledger-pagination"
      aria-label={"Pagination des transactions — " + where}
      ref={focusRef}
      tabIndex={-1}
    >
      <div className="ledger-page-summary" aria-live="polite">
        <strong>
          {count ? page * pageSize + 1 : 0}–
          {Math.min((page + 1) * pageSize, count)} sur {count}
        </strong>
        <span>
          {pages ? "Page " + (page + 1) + " sur " + pages : "Aucune page"}
        </span>
      </div>
      <label className="ledger-page-size">
        <span>Lignes</span>
        <Select
          aria-label={"Lignes par page — " + where}
          value={String(pageSize)}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {String(size)}
            </option>
          ))}
        </Select>
      </label>
      <div className="ledger-page-buttons">
        <button
          type="button"
          aria-label="Première page"
          title="Première page"
          disabled={!pages || page === 0}
          onClick={() => onPage(0)}
        >
          «
        </button>
        <button
          type="button"
          aria-label="Page précédente"
          title="Page précédente"
          disabled={!pages || page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {numbered.map((number, i) => (
          <span className="ledger-page-number" key={number}>
            {i > 0 && number > numbered[i - 1] + 1 && (
              <span aria-hidden="true" className="ledger-page-ellipsis">
                …
              </span>
            )}
            <button
              type="button"
              aria-label={"Page " + (number + 1)}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onPage(number)}
            >
              {number + 1}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label="Page suivante"
          title="Page suivante"
          disabled={!pages || page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          aria-label="Dernière page"
          title="Dernière page"
          disabled={!pages || page >= pages - 1}
          onClick={() => onPage(pages - 1)}
        >
          »
        </button>
      </div>
      <form
        className="ledger-page-jump"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(jump);
          if (
            !pages ||
            !Number.isInteger(value) ||
            value < 1 ||
            value > pages
          ) {
            setError("Choisissez une page de 1 à " + pages + ".");
            return;
          }
          setError("");
          onPage(value - 1);
        }}
      >
        <label>
          <span>Aller à</span>
          <input
            type="number"
            min="1"
            max={pages || 1}
            step="1"
            value={jump}
            aria-label={"Numéro de page — " + where}
            aria-invalid={!!error}
            aria-describedby={error ? "page-error-" + position : undefined}
            disabled={!pages}
            onChange={(e) => {
              setJump(e.target.value);
              setError("");
            }}
          />
        </label>
        <button type="submit" disabled={!pages}>
          OK
        </button>
        {error && (
          <span
            className="ledger-page-error"
            id={"page-error-" + position}
            role="alert"
          >
            {error}
          </span>
        )}
      </form>
    </nav>
  );
}
function CategoryInline({
  transaction: t,
  categories,
  draft,
  setDraft,
  busy,
  update,
  close,
  details,
}: {
  transaction: Transaction;
  categories: string[];
  draft: Draft;
  setDraft: (draft: Draft) => void;
  busy: boolean;
  update: (
    ids: string[],
    patch: Partial<Patch>,
    origin?: OriginPatch,
  ) => Promise<boolean>;
  close: (discard?: boolean) => void;
  details: () => void;
}) {
  const [custom, setCustom] = useState(!categories.includes(draft.category));
  const changeCategory = (category: string) =>
    setDraft({
      ...draft,
      category,
      subcategory: category === draft.category ? draft.subcategory : "",
    });
  return (
    <form
      className="category-inline"
      aria-label={"Classer " + merchantLabel(t)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.category.trim()) return;
        const preserveDraft =
          draft.name !== merchantLabel(t) ||
          draft.note !== (t.note ?? "") ||
          draft.internal !== t.internal ||
          draft.all;
        await update(
          [t.id],
          {
            category: draft.category.trim(),
            subcategory: draft.subcategory.trim(),
          },
          { id: t.id, patch: {}, preserveDraft },
        );
      }}
    >
      <Field label="Catégorie">
        {custom ? (
          <input
            autoFocus
            required
            maxLength={80}
            value={draft.category}
            onChange={(e) => changeCategory(e.target.value)}
          />
        ) : (
          <Select
            autoFocus
            value={draft.category}
            onChange={(e) => {
              if (e.target.value === "__new") {
                setCustom(true);
                changeCategory("");
              } else changeCategory(e.target.value);
            }}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
            <option value="__new">Créer une catégorie…</option>
          </Select>
        )}
      </Field>
      <Field label="Sous-catégorie">
        <input
          maxLength={80}
          value={draft.subcategory}
          onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })}
          placeholder="Facultative"
        />
      </Field>
      <div className="actions">
        <button type="button" className="text-button" onClick={details}>
          Tous les détails
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => close(true)}
        >
          Annuler
        </button>
        <button
          className="button dark"
          disabled={busy || !draft.category.trim()}
        >
          Enregistrer le classement
        </button>
      </div>
    </form>
  );
}
function TransactionDetails({
  transaction: t,
  draft,
  setDraft,
  snapshot,
  categories,
  busy,
  update,
  close,
}: {
  transaction: Transaction;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  snapshot: Snapshot;
  categories: string[];
  busy: boolean;
  update: (
    ids: string[],
    patch: Partial<Patch>,
    origin?: OriginPatch,
  ) => Promise<boolean>;
  close: (discard?: boolean) => void;
}) {
  const { name, category, subcategory, note, internal, all } = draft;
  const change = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const [custom, setCustom] = useState(!categories.includes(category));
  function changeCategory(next: string) {
    change({
      category: next,
      subcategory: next === category ? subcategory : "",
    });
  }
  const related = snapshot.transactions.filter(
    (v) =>
      normalize(v.merchant || v.label) === normalize(t.merchant || t.label),
  );
  return (
    <form
      className="transaction-details"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || !category.trim()) return;
        await update(
          all ? related.map((v) => v.id) : [t.id],
          {
            merchantName: name.trim(),
            category: category.trim(),
            subcategory: subcategory.trim(),
          },
          { id: t.id, patch: { internal, note: note.trim() } },
        );
      }}
    >
      <div className="detail-heading">
        <div>
          <span className="eyebrow">DÉTAIL DE L’OPÉRATION</span>
          <h3>{merchantLabel(t)}</h3>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fermer les détails"
          onClick={() => close()}
        >
          <X size={18} />
        </button>
      </div>
      <div className="detail-grid">
        <div className="detail-context">
          <span>Libellé bancaire original</span>
          <p>{t.label}</p>
          <dl>
            <dt>Date</dt>
            <dd>{dateLabel(t.date)}</dd>
            <dt>Compte</dt>
            <dd>{t.account}</dd>
            <dt>Montant</dt>
            <dd>{euro(t.amount)}</dd>
            <dt>Chez cette entité</dt>
            <dd>{related.length} opérations</dd>
          </dl>
          <details>
            <summary>Voir les données du relevé</summary>
            <dl className="raw-fields">
              {Object.entries(t.raw).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
        <div className="detail-form">
          <div className="form-grid">
            <Field label="Nom affiché">
              <input
                value={name}
                maxLength={100}
                required
                onChange={(e) => change({ name: e.target.value })}
              />
            </Field>
            <Field label="Catégorie">
              {custom ? (
                <input
                  aria-label="Nouvelle catégorie"
                  required
                  maxLength={80}
                  value={category}
                  onChange={(e) => changeCategory(e.target.value)}
                />
              ) : (
                <Select
                  value={category}
                  onChange={(e) =>
                    e.target.value === "__new"
                      ? (setCustom(true), changeCategory(""))
                      : changeCategory(e.target.value)
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                  <option value="__new">Créer une catégorie…</option>
                </Select>
              )}
            </Field>
            <Field label="Sous-catégorie">
              <input
                value={subcategory}
                maxLength={80}
                onChange={(e) => change({ subcategory: e.target.value })}
                placeholder="Ex. Restaurant, laboratoire…"
              />
            </Field>
            <Field label="Note personnelle">
              <input
                value={note}
                maxLength={300}
                onChange={(e) => change({ note: e.target.value })}
                placeholder={"Un détail propre à cette opération"}
              />
            </Field>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => change({ internal: e.target.checked })}
            />
            Virement entre mes comptes
          </label>
          {related.length > 1 && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => change({ all: e.target.checked })}
              />
              Appliquer le nom et le classement aux {related.length} opérations
              de cette entité, sur tout l’historique
            </label>
          )}
          {all && (
            <p className="footnote">
              Le nom, la catégorie et la sous-catégorie s’appliquent à toute
              l’entité. La note et le statut de virement interne ne changent que
              pour cette opération.
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="text-button"
              onClick={() => close(true)}
            >
              Annuler
            </button>
            <button
              className="button dark"
              disabled={busy || !name.trim() || !category.trim()}
            >
              <CornerDownLeft size={16} />
              {all
                ? `Enregistrer pour ${related.length} opérations`
                : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
