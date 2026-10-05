import { Download } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PageProps } from "../../app/App";
import { PeriodPicker, SharedAccountPicker } from "../../app/ContextControls";
import { useReading } from "../../app/context";
import { DockActions } from "../../app/DockSlot";
import { clearParams, hrefFor } from "../../app/router";
import { useToast } from "../../app/toast";
import { downloadFile, exportTransactionsCsv } from "../../data/backup";
import { updateTransactions, type TransactionPatch } from "../../data/commands";
import { similarTransactions } from "../../domain/categories";
import { isIsoDate } from "../../domain/dates";
import {
  filterTransactions,
  merchantLabel,
  sortTransactions,
  summarize,
} from "../../domain/search";
import type { IsoDate, Transaction } from "../../domain/types";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { Menu } from "../../ui/Menu";
import { Pagination } from "./Pagination";
import { plural, SelectionBar } from "./SelectionBar";
import { SimilarPrompt, type Similar } from "./SimilarPrompt";
import {
  categoryPatch,
  defaultFilters,
  hasNarrowing,
  isTyping,
  otherCandidates,
  readPresentation,
  writePresentation,
  type LedgerFilters,
} from "./state";
import { Summary } from "./Summary";
import { findRow, Table } from "./Table";
import { Chips, filterChips, Toolbar } from "./Toolbar";
import "./transactions.css";

function filtersFromParams(params: URLSearchParams): LedgerFilters {
  const from = params.get("from");
  const to = params.get("to");
  const validFrom = isIsoDate(from) ? from : null;
  const validTo = isIsoDate(to) ? to : null;
  const cat = params.get("cat");
  return {
    ...defaultFilters,
    query: params.get("q") ?? "",
    categories: cat ? [cat] : [],
    uncategorized: params.get("filter") === "uncategorized",
    batchId: params.get("batch") || null,
    range:
      validFrom || validTo
        ? { from: validFrom ?? "0000-01-01", to: validTo ?? "9999-12-31" }
        : null,
  };
}

export function TransactionsPage({ ledger, params, active }: PageProps) {
  const toast = useToast();
  const { asOf, account, setAccount, range, setPeriod } = useReading();
  const [filters, setFilters] = useState(defaultFilters);
  const [presentation, setPresentation] = useState(readPresentation);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Similar | null>(null);
  const query = useDeferredValue(filters.query);
  const search = useRef<HTMLInputElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusAfterPage = useRef(false);
  const revealTx = useRef<string | null>(null);
  const { pageSize, density } = presentation;

  // Drilldown parameters are applied once per change, then the page owns the state.
  const paramKey = params.toString();
  const [appliedKey, setAppliedKey] = useState("");
  if (paramKey !== appliedKey) {
    setAppliedKey(paramKey);
    if (paramKey) {
      const tx = params.get("tx");
      setFilters(filtersFromParams(params));
      setPage(0);
      setOpenId(tx);
      setPinId(tx);
      revealTx.current = tx;
    }
  }
  const acct = params.get("acct");
  useEffect(() => {
    if (acct) setAccount(acct === "household" ? "" : acct);
  }, [acct, setAccount]);

  const scopeKey = `${account}|${range.from}|${range.to}`;
  const [previousScope, setPreviousScope] = useState(scopeKey);
  if (scopeKey !== previousScope) {
    setPreviousScope(scopeKey);
    setPage(0);
  }

  const byId = useMemo(
    () => new Map(ledger.transactions.map((t) => [t.id, t])),
    [ledger.transactions],
  );
  const effectiveRange = filters.range ?? range;
  const result = filterTransactions(ledger, {
    account,
    range: { from: effectiveRange.from, to: effectiveRange.to },
    kind: filters.kind,
    categories: filters.categories,
    min: filters.min,
    max: filters.max,
    uncategorized: filters.uncategorized,
    withNote: filters.withNote,
    query,
    sort: filters.sort,
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
  });
  const positions = useMemo(
    () => new Map(result.map((t, i) => [t.id, i])),
    [result],
  );
  const summary = useMemo(() => summarize(result, asOf), [result, asOf]);
  const pageCount = Math.max(1, Math.ceil(result.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const rows = useMemo(
    () => result.slice(current * pageSize, (current + 1) * pageSize),
    [result, current, pageSize],
  );
  const pinned =
    pinId && !positions.has(pinId) ? (byId.get(pinId) ?? null) : null;

  const grouped = filters.sort.startsWith("date") && !query.trim();
  const byDay = useMemo(() => {
    if (!grouped) return null;
    const days = new Map<IsoDate, Transaction[]>();
    for (const t of result) {
      const list = days.get(t.date);
      if (list) list.push(t);
      else days.set(t.date, [t]);
    }
    return days;
  }, [grouped, result]);
  const dayTotals = useMemo(() => {
    if (!byDay) return null;
    const totals = new Map<IsoDate, number>();
    for (const t of rows)
      if (!totals.has(t.date))
        totals.set(t.date, summarize(byDay.get(t.date) ?? [], t.date).net);
    return totals;
  }, [byDay, rows]);

  const selection = useMemo(
    () => [...selected].filter((id) => byId.has(id)),
    [selected, byId],
  );
  const outside = selection.filter((id) => !positions.has(id)).length;
  const inResult = selection.length - outside;

  // A drilldown to one operation lands on its page.
  useEffect(() => {
    const id = revealTx.current;
    if (!id || !active) return;
    revealTx.current = null;
    const index = positions.get(id);
    if (index !== undefined) setPage(Math.floor(index / pageSize));
    requestAnimationFrame(() => {
      const row = findRow(table.current, id);
      row?.scrollIntoView({ block: "center" });
      row?.focus({ preventScroll: true });
    });
  }, [positions, pageSize, active, appliedKey]);

  useEffect(() => {
    if (!focusAfterPage.current) return;
    focusAfterPage.current = false;
    const el = table.current;
    if (!el) return;
    const offset = toolbar.current?.offsetHeight ?? 0;
    const top = el.getBoundingClientRect().top + scrollY - offset - 8;
    if (top < scrollY) scrollTo({ top, behavior: "instant" });
    el.querySelector<HTMLElement>("tbody tr[data-row]")?.focus({
      preventScroll: true,
    });
  }, [current, pageSize]);

  // The table header sticks under the toolbar, whatever its wrapped height.
  useLayoutEffect(() => {
    const bar = toolbar.current;
    if (!bar) return;
    const observer = new ResizeObserver(() =>
      root.current?.style.setProperty("--tx-sticky", `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, [ledger.transactions.length > 0]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      )
        return;
      event.preventDefault();
      search.current?.focus();
      search.current?.select();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active]);

  const update = useCallback(
    (patch: Partial<LedgerFilters>, fromChip = false) => {
      setFilters((f) => ({ ...f, ...patch }));
      setPage(0);
      if (fromChip && paramKey) clearParams("transactions");
    },
    [paramKey],
  );

  const clearAll = () => {
    setFilters((f) => ({ ...defaultFilters, sort: f.sort }));
    setPage(0);
    if (paramKey) clearParams("transactions");
  };

  const presentationChange = (next: Partial<typeof presentation>) => {
    const value = { ...presentation, ...next };
    setPresentation(value);
    writePresentation(value);
  };

  const changePage = (next: number) => {
    focusAfterPage.current = true;
    setPage(Math.min(pageCount - 1, Math.max(0, next)));
  };

  const changePageSize = (size: number) => {
    focusAfterPage.current = true;
    setPage(Math.floor((current * pageSize) / size));
    presentationChange({ pageSize: size });
  };

  const onSelect = useCallback((ids: string[], value: boolean) => {
    setSelected((set) => {
      const next = new Set(set);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const onCategory = useCallback(
    async (t: Transaction, category: string, subcategory?: string) => {
      const patch = categoryPatch(ledger, category, subcategory);
      try {
        const undo = await updateTransactions([t.id], patch);
        const others = otherCandidates(
          similarTransactions(ledger, t),
          t,
          category,
        );
        toast.undoable("Catégorie changée", async () => {
          setSimilar(null);
          await undo();
        });
        setSimilar(
          others.length
            ? {
                ids: others.map((o) => o.id),
                merchant: merchantLabel(t),
                category,
                patch,
              }
            : null,
        );
      } catch (error) {
        toast.error(error);
      }
    },
    [ledger, toast],
  );

  const closeSimilar = useCallback(() => setSimilar(null), []);

  const applySimilar = async (s: Similar) => {
    setSimilar(null);
    try {
      toast.undoable(
        `${plural(s.ids.length, "opération")} « ${s.merchant} » en ${s.category}`,
        await updateTransactions(s.ids, s.patch),
      );
    } catch (error) {
      toast.error(error);
    }
  };

  const applyToSelection = async (patch: TransactionPatch, message: string) => {
    try {
      toast.undoable(message, await updateTransactions(selection, patch));
      setSelected(new Set());
    } catch (error) {
      toast.error(error);
    }
  };

  const exportRows = (list: Transaction[]) => {
    const aliases = ledger.prefs.accountAliases;
    downloadFile(
      `wealthpilot-operations-${asOf}.csv`,
      exportTransactionsCsv(list, Object.keys(aliases).length ? aliases : undefined),
      "text/csv;charset=utf-8",
    );
    toast.show({ message: `${plural(list.length, "opération")} exportée${list.length > 1 ? "s" : ""}` });
  };
  const exportSelection = () =>
    exportRows(
      sortTransactions(
        selection.map((id) => byId.get(id)!),
        filters.sort,
      ),
    );

  const unpin = () => {
    if (openId === pinId) setOpenId(null);
    setPinId(null);
    if (paramKey) clearParams("transactions");
  };

  const dock = (
    <DockActions>
      <SharedAccountPicker ledger={ledger} />
      <PeriodPicker ledger={ledger} />
      <Menu
        label="Exporter"
        side="top"
        trigger={
          <Button
            variant="ghost"
            className="tx-dock-button"
            icon={<Download aria-hidden />}
            aria-label="Exporter en CSV"
          >
            <span className="tx-dock-label">Exporter</span>
          </Button>
        }
        items={[
          { type: "label", label: "CSV" },
          {
            label: `Résultat filtré (${result.length})`,
            disabledReason: result.length ? undefined : "Aucune opération",
            onSelect: () => exportRows(result),
          },
          ...(selection.length
            ? [
                {
                  label: `Sélection (${selection.length})`,
                  onSelect: exportSelection,
                },
              ]
            : []),
        ]}
      />
    </DockActions>
  );

  if (!ledger.transactions.length)
    return (
      <div className="tx" ref={root}>
        {dock}
        <div className="tx-empty-all">
          <Empty action={<a href={hrefFor("import")}>Importer un relevé</a>}>
            Aucune opération
          </Empty>
        </div>
      </div>
    );

  const chips = filterChips(ledger, filters, (patch) => update(patch, true));
  const pager = (position: "haut" | "bas") =>
    result.length > 0 && (
      <Pagination
        position={position}
        page={current}
        pageSize={pageSize}
        total={result.length}
        onPage={changePage}
        onPageSize={changePageSize}
      />
    );

  return (
    <div className="tx" ref={root}>
      {dock}
      <Toolbar
        ledger={ledger}
        filters={filters}
        onChange={update}
        density={density}
        onDensity={(d) => presentationChange({ density: d })}
        searchRef={search}
        toolbarRef={toolbar}
      />
      <Chips chips={chips} onClearAll={clearAll} />
      <div className="tx-head">
        <Summary
          summary={summary}
          kind={filters.kind}
          future={result.filter((t) => t.date > asOf).length}
        />
        {pager("haut")}
      </div>
      <div
        className="tx-card"
        data-stale={filters.query !== query || undefined}
      >
        {(rows.length > 0 || pinned) && (
          <Table
            tableRef={table}
            ledger={ledger}
            asOf={asOf}
            rows={rows}
            pinned={pinned}
            onUnpin={unpin}
            dayTotals={dayTotals}
            density={density}
            sort={filters.sort}
            onSort={(sort) => update({ sort })}
            selected={selected}
            onSelect={onSelect}
            openId={openId}
            onOpen={setOpenId}
            onCategory={onCategory}
          />
        )}
        {result.length === 0 && (
          <div className="tx-empty">
            {hasNarrowing(filters) ? (
              <Empty
                action={
                  <button type="button" className="tx-link" onClick={clearAll}>
                    Effacer les filtres
                  </button>
                }
              >
                Aucune opération ne correspond
              </Empty>
            ) : (
              <Empty
                action={
                  <button
                    type="button"
                    className="tx-link"
                    onClick={() => setPeriod({ kind: "all" })}
                  >
                    Tout l’historique
                  </button>
                }
              >
                Aucune opération sur cette période
              </Empty>
            )}
          </div>
        )}
      </div>
      <div className="tx-foot">{pager("bas")}</div>
      {selection.length > 0 && (
        <SelectionBar
          ledger={ledger}
          count={selection.length}
          outside={outside}
          selectable={inResult < result.length ? result.length : null}
          allInternal={selection.every((id) => byId.get(id)?.internal)}
          onSelectAll={() => onSelect(result.map((t) => t.id), true)}
          onApply={applyToSelection}
          onExport={exportSelection}
          onClear={() => setSelected(new Set())}
        />
      )}
      {similar && active && (
        <SimilarPrompt
          similar={similar}
          onApply={applySimilar}
          onClose={closeSimilar}
        />
      )}
    </div>
  );
}
