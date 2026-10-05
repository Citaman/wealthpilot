import {
  ArrowDownUp,
  Check,
  Rows2,
  Rows3,
  Rows4,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState, type Ref } from "react";
import {
  categoryColor,
  categoryNames,
  subcategoryNames,
} from "../../domain/categories";
import { formatDay } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import { formatEuro, parseMoney } from "../../domain/money";
import {
  normalize,
  subcategoryKey,
  type TransactionSort,
} from "../../domain/search";
import { Button } from "../../ui/Button";
import { CategoryDot } from "../../ui/CategoryDot";
import { Field } from "../../ui/Field";
import { Menu } from "../../ui/Menu";
import { Popover } from "../../ui/Popover";
import { Segmented } from "../../ui/Segmented";
import { CategoryLabel } from "../shared/CategoryLabel";
import {
  popoverFilterCount,
  sortLabels,
  type Density,
  type Kind,
  type LedgerFilters,
} from "./state";

export interface ToolbarProps {
  ledger: Ledger;
  filters: LedgerFilters;
  onChange(patch: Partial<LedgerFilters>): void;
  density: Density;
  onDensity(density: Density): void;
  searchRef: Ref<HTMLInputElement>;
  toolbarRef: Ref<HTMLDivElement>;
}

const kinds: { value: Kind; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "expense", label: "Dépenses" },
  { value: "income", label: "Revenus" },
  { value: "transfer", label: "Virements" },
];

const densityOptions = [
  {
    value: "compact" as const,
    label: <Rows4 aria-hidden />,
    ariaLabel: "Densité compacte",
  },
  {
    value: "standard" as const,
    label: <Rows3 aria-hidden />,
    ariaLabel: "Densité standard",
  },
  {
    value: "comfortable" as const,
    label: <Rows2 aria-hidden />,
    ariaLabel: "Densité confortable",
  },
];

export function Toolbar({
  ledger,
  filters,
  onChange,
  density,
  onDensity,
  searchRef,
  toolbarRef,
}: ToolbarProps) {
  const count = popoverFilterCount(filters);
  return (
    <div className="tx-toolbar" ref={toolbarRef}>
      <div className="tx-search">
        <Search size={16} aria-hidden />
        <input
          ref={searchRef}
          type="search"
          aria-label="Rechercher une opération"
          aria-keyshortcuts="/"
          placeholder="Rechercher…"
          value={filters.query}
          onChange={(event) => onChange({ query: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (event.key === "Escape" && filters.query) {
              event.preventDefault();
              onChange({ query: "" });
            }
          }}
        />
        {filters.query ? (
          <button
            type="button"
            className="tx-search-clear"
            aria-label="Effacer la recherche"
            title="Effacer la recherche"
            onClick={() => onChange({ query: "" })}
          >
            <X size={14} aria-hidden />
          </button>
        ) : (
          <kbd className="tx-kbd" aria-hidden>
            /
          </kbd>
        )}
      </div>
      <Segmented
        label="Type d’opération"
        value={filters.kind}
        onChange={(kind) => onChange({ kind })}
        options={kinds}
        className="tx-kinds"
      />
      <div className="tx-tools">
        <Popover
          label="Filtres"
          align="end"
          className="tx-filters-pop"
          trigger={
            <Button
              variant={count ? "primary" : "outline"}
              icon={<SlidersHorizontal aria-hidden />}
              aria-label={count ? `Filtres, ${count} actifs` : "Filtres"}
            >
              <span className="tx-tool-label">Filtres</span>
              {count > 0 && <span className="tx-count">{count}</span>}
            </Button>
          }
        >
          <FiltersPanel ledger={ledger} filters={filters} onChange={onChange} />
        </Popover>
        <Menu
          label="Trier"
          trigger={
            <Button
              variant="outline"
              icon={<ArrowDownUp aria-hidden />}
              aria-label={`Trier : ${sortLabels[filters.sort]}`}
            >
              <span className="tx-tool-label">{sortLabels[filters.sort]}</span>
            </Button>
          }
          items={(Object.keys(sortLabels) as TransactionSort[]).map((sort) => ({
            label: sortLabels[sort],
            icon: sort === filters.sort ? <Check aria-hidden /> : <span />,
            onSelect: () => onChange({ sort }),
          }))}
        />
        <Segmented
          label="Densité"
          value={density}
          onChange={onDensity}
          options={densityOptions}
          className="tx-density"
        />
      </div>
    </div>
  );
}

function FiltersPanel({
  ledger,
  filters,
  onChange,
}: {
  ledger: Ledger;
  filters: LedgerFilters;
  onChange(patch: Partial<LedgerFilters>): void;
}) {
  const [search, setSearch] = useState("");
  const names = categoryNames(ledger);
  const shown = useMemo(() => {
    const q = normalize(search);
    const all = names.flatMap((n) => [
      n,
      ...subcategoryNames(ledger, n).map((sub) => subcategoryKey(n, sub)),
    ]);
    return q ? all.filter((n) => normalize(n).includes(q)) : all;
  }, [ledger, names, search]);
  const selected = new Set(filters.categories);
  const toggle = (name: string) =>
    onChange({
      categories: selected.has(name)
        ? filters.categories.filter((c) => c !== name)
        : [...filters.categories, name],
    });
  return (
    <div className="tx-filters">
      <fieldset className="tx-filters-group">
        <legend className="eyebrow">Catégories</legend>
        <input
          className="tx-filters-search"
          type="search"
          placeholder="Filtrer les catégories"
          aria-label="Filtrer les catégories"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <ul className="tx-filters-cats">
          {shown.map((name) => (
            <li key={name} data-sub={name.includes(" › ") || undefined}>
              <label className="tx-check">
                <input
                  type="checkbox"
                  checked={selected.has(name)}
                  onChange={() => toggle(name)}
                />
                {name.includes(" › ") ? (
                  <span>{name.split(" › ").at(-1)}</span>
                ) : (
                  <CategoryLabel ledger={ledger} category={name} size="s" />
                )}
              </label>
            </li>
          ))}
          {!shown.length && <li className="muted">Aucune catégorie</li>}
        </ul>
      </fieldset>
      <fieldset className="tx-filters-group">
        <legend className="eyebrow">Montant</legend>
        <div className="tx-filters-amounts">
          <AmountField
            label="Min"
            value={filters.min}
            onCommit={(min) => onChange({ min })}
          />
          <AmountField
            label="Max"
            value={filters.max}
            onCommit={(max) => onChange({ max })}
          />
        </div>
      </fieldset>
      <fieldset className="tx-filters-group">
        <legend className="sr-only">Autres</legend>
        <label className="tx-check">
          <input
            type="checkbox"
            checked={filters.uncategorized}
            onChange={(event) =>
              onChange({ uncategorized: event.currentTarget.checked })
            }
          />
          <span>Sans catégorie</span>
        </label>
        <label className="tx-check">
          <input
            type="checkbox"
            checked={filters.withNote}
            onChange={(event) =>
              onChange({ withNote: event.currentTarget.checked })
            }
          />
          <span>Avec note</span>
        </label>
      </fieldset>
    </div>
  );
}

function AmountField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number | null;
  onCommit(value: number | null): void;
}) {
  const shown = value === null ? "" : String(value / 100).replace(".", ",");
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    const cents = text ? parseMoney(text) : null;
    if (text && cents === null) return setError("Montant invalide");
    setError(null);
    setDraft(null);
    onCommit(cents === null ? null : Math.abs(cents));
  };
  return (
    <Field
      label={`${label} (€)`}
      inputMode="decimal"
      placeholder="—"
      value={draft ?? shown}
      error={error}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

export interface Chip {
  key: string;
  label: string;
  color?: string;
  remove(): void;
}

export function filterChips(
  ledger: Ledger,
  filters: LedgerFilters,
  onChange: (patch: Partial<LedgerFilters>) => void,
): Chip[] {
  const chips: Chip[] = [];
  const { range } = filters;
  if (range)
    chips.push({
      key: "range",
      label:
        range.from === "0000-01-01"
          ? `Jusqu’au ${formatDay(range.to)}`
          : range.to === "9999-12-31"
            ? `Depuis le ${formatDay(range.from)}`
            : `${formatDay(range.from)} → ${formatDay(range.to)}`,
      remove: () => onChange({ range: null }),
    });
  if (filters.batchId) {
    const batch = ledger.batches.find((b) => b.id === filters.batchId);
    chips.push({
      key: "batch",
      label: `Lot ${batch?.name ?? filters.batchId}`,
      remove: () => onChange({ batchId: null }),
    });
  }
  for (const name of filters.categories)
    chips.push({
      key: `cat:${name}`,
      label: name,
      color: categoryColor(
        name.split(" › ")[0],
        ledger.prefs.categoryDefinitions,
      ),
      remove: () =>
        onChange({ categories: filters.categories.filter((c) => c !== name) }),
    });
  if (filters.min !== null)
    chips.push({
      key: "min",
      label: `≥ ${formatEuro(filters.min)}`,
      remove: () => onChange({ min: null }),
    });
  if (filters.max !== null)
    chips.push({
      key: "max",
      label: `≤ ${formatEuro(filters.max)}`,
      remove: () => onChange({ max: null }),
    });
  if (filters.uncategorized)
    chips.push({
      key: "uncategorized",
      label: "Sans catégorie",
      remove: () => onChange({ uncategorized: false }),
    });
  if (filters.withNote)
    chips.push({
      key: "note",
      label: "Avec note",
      remove: () => onChange({ withNote: false }),
    });
  return chips;
}

export function Chips({
  chips,
  onClearAll,
}: {
  chips: Chip[];
  onClearAll(): void;
}) {
  if (!chips.length) return null;
  return (
    <ul className="tx-chips" aria-label="Filtres actifs">
      {chips.map((chip) => (
        <li key={chip.key} className="tx-chip">
          {chip.color && <CategoryDot color={chip.color} />}
          <span>{chip.label}</span>
          <button
            type="button"
            aria-label={`Retirer le filtre ${chip.label}`}
            title="Retirer"
            onClick={chip.remove}
          >
            <X size={14} aria-hidden />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button type="button" className="tx-link" onClick={onClearAll}>
            Tout effacer
          </button>
        </li>
      )}
    </ul>
  );
}
