import { Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import { cardTypes, type CardType } from "../../domain/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
import { Sheet } from "../../ui/Sheet";
import { useMeasure } from "../../ui/useMeasure";
import { catalog, widthLabels, type CardDefinition } from "./catalog";
import "./dashboard.css";

/** Previews render at the width of a ⅓ card on a 1512 px screen, then shrink to fit. */
const PREVIEW_WIDTH = 460;
const PREVIEW_HEIGHT = 200;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const noop = () => undefined;

export function AddCardSheet({
  open,
  onOpenChange,
  ledger,
  account,
  range,
  counts,
  onAdd,
  onReset,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  ledger: Ledger;
  account: string;
  range: DateRange & { label: string };
  counts: ReadonlyMap<CardType, number>;
  onAdd(type: CardType): void;
  onReset(): void;
}) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return cardTypes
      .map((type) => catalog[type])
      .filter((d) =>
        words.every((w) => fold(`${d.title} ${d.question}`).includes(w)),
      );
  }, [query]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setConfirming(false);
        }
        onOpenChange(next);
      }}
      title="Ajouter une carte"
      toolbar={
        <label className="add-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Rechercher une carte</span>
          <input
            type="search"
            value={query}
            placeholder="Rechercher"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      }
      footer={
        confirming ? (
          <div className="add-confirm" role="group" aria-label="Confirmation">
            <span>Remplacer la disposition actuelle ?</span>
            <Button variant="primary" onClick={onReset}>
              Oui
            </Button>
            <Button
              variant="outline"
              autoFocus
              onClick={() => setConfirming(false)}
            >
              Non
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            icon={<RotateCcw aria-hidden />}
            onClick={() => setConfirming(true)}
          >
            Rétablir la disposition par défaut
          </Button>
        )
      }
    >
      {shown.length ? (
        <ul className="add-list">
          {shown.map((definition) => (
            <CatalogItem
              key={definition.type}
              definition={definition}
              count={counts.get(definition.type) ?? 0}
              ledger={ledger}
              account={account}
              range={range}
              onAdd={() => onAdd(definition.type)}
            />
          ))}
        </ul>
      ) : (
        <p className="add-none muted">Aucune carte ne correspond</p>
      )}
    </Sheet>
  );
}

function CatalogItem({
  definition,
  count,
  ledger,
  account,
  range,
  onAdd,
}: {
  definition: CardDefinition;
  count: number;
  ledger: Ledger;
  account: string;
  range: DateRange & { label: string };
  onAdd(): void;
}) {
  const { type, title, question, widths, defaultWidth } = definition;
  const titleId = `add-${type}`;
  return (
    <li className="add-item" aria-labelledby={titleId}>
      <div className="add-item-head">
        <h3 id={titleId} className="add-item-title">
          {title}
        </h3>
        {count > 0 && (
          <Badge tone="neutral">
            déjà présente{count > 1 ? ` ×${count}` : ""}
          </Badge>
        )}
      </div>
      <p className="add-item-question">{question}</p>
      <Preview
        definition={definition}
        ledger={ledger}
        account={account}
        range={range}
      />
      <div className="add-item-foot">
        <span className="add-widths mono" aria-label="Largeurs possibles">
          {widths.map((w) => (
            <span
              key={w}
              className="add-width"
              data-default={w === defaultWidth || undefined}
              title={
                w === defaultWidth
                  ? `${widthLabels[w].long} (par défaut)`
                  : widthLabels[w].long
              }
            >
              {widthLabels[w].short}
            </span>
          ))}
        </span>
        <Button
          variant="primary"
          icon={<Plus aria-hidden />}
          aria-describedby={titleId}
          onClick={onAdd}
        >
          Ajouter
        </Button>
      </div>
    </li>
  );
}

function Preview({
  definition,
  ledger,
  account,
  range,
}: {
  definition: CardDefinition;
  ledger: Ledger;
  account: string;
  range: DateRange & { label: string };
}) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const scale = width ? Math.min(1, width / PREVIEW_WIDTH) : 0;
  const card = useMemo(
    () => ({
      id: `preview-${definition.type}`,
      type: definition.type,
      width: 4 as const,
      palette: definition.defaultPalette,
    }),
    [definition],
  );
  const { Component } = definition;
  return (
    <div
      ref={ref}
      className="add-preview"
      style={{ height: PREVIEW_HEIGHT }}
      aria-hidden
      inert
    >
      {scale > 0 && (
        <div
          className="add-preview-inner"
          style={{ width: PREVIEW_WIDTH, transform: `scale(${scale})` }}
        >
          <ErrorBoundary label="Cet aperçu">
            <Component
              card={card}
              ledger={ledger}
              account={account}
              range={range}
              editing
              setOption={noop}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
