import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  MoreHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { DateRange } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import {
  cardPaletteIds,
  type CardPaletteId,
  type CardWidth,
  type DashboardCard,
} from "../../domain/types";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
import { IconButton } from "../../ui/IconButton";
import { Menu } from "../../ui/Menu";
import { Picker } from "../../ui/Picker";
import { Popover } from "../../ui/Popover";
import { Segmented } from "../../ui/Segmented";
import { moveItem, useSortable } from "../../ui/sortable";
import { catalog, paletteNames, widthLabels } from "./catalog";
import type { CardProps } from "./cards/types";
import { createCard, rowSpans } from "./layout";
import "./dashboard.css";

type Range = DateRange & { label: string };
type OptionValue = string | number | boolean;

export interface BoardProps {
  ledger: Ledger;
  cards: readonly DashboardCard[];
  editing: boolean;
  /** Dock account ("" = household). */
  account: string;
  range: Range;
  onOption(id: string, key: string, value: OptionValue): void;
  /** Draft edits (organize mode only). */
  onChange(cards: DashboardCard[]): void;
  onRemove(id: string): void;
  onFocusCard(id: string): void;
  highlight: string | null;
}

/** The account a card reads: its own override while that account exists, else the dock's. */
export const cardAccount = (
  ledger: Ledger,
  card: DashboardCard,
  dock: string,
) =>
  card.account && ledger.accounts.some((a) => a.id === card.account)
    ? card.account
    : dock;

type SlotProps = Omit<CardProps, "setOption"> & {
  onOption: BoardProps["onOption"];
};

// Re-renders only when what the card reads changes: never during a drag, and
// re-reading the saved layout does not re-render untouched cards.
const sameSlot = (a: SlotProps, b: SlotProps) =>
  a.ledger === b.ledger &&
  a.account === b.account &&
  a.range === b.range &&
  a.editing === b.editing &&
  a.onOption === b.onOption &&
  (a.card === b.card || JSON.stringify(a.card) === JSON.stringify(b.card));

const CardSlot = memo(function CardSlot({
  card,
  ledger,
  account,
  range,
  editing,
  onOption,
}: SlotProps) {
  const { Component } = catalog[card.type];
  const setOption = useCallback(
    (key: string, value: OptionValue) => onOption(card.id, key, value),
    [card.id, onOption],
  );
  return (
    <Component
      card={card}
      ledger={ledger}
      account={account}
      range={range}
      editing={editing}
      setOption={setOption}
    />
  );
}, sameSlot);

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Position-only FLIP for edits made outside a drag (menu moves, widths, removal). */
function useFlip(container: React.RefObject<HTMLElement | null>, key: string) {
  const first = useRef<Map<string, DOMRect> | null>(null);
  useLayoutEffect(() => {
    const before = first.current;
    first.current = null;
    if (!before || reducedMotion() || !container.current) return;
    container.current
      .querySelectorAll<HTMLElement>("[data-card-id]")
      .forEach((element) => {
        const from = before.get(element.dataset.cardId!);
        if (!from) return;
        const to = element.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        element.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      });
  }, [container, key]);
  return () => {
    const rects = new Map<string, DOMRect>();
    container.current
      ?.querySelectorAll<HTMLElement>("[data-card-id]")
      .forEach((element) =>
        rects.set(element.dataset.cardId!, element.getBoundingClientRect()),
      );
    first.current = rects;
  };
}

export function Board({
  ledger,
  cards,
  editing,
  account,
  range,
  onOption,
  onChange,
  onRemove,
  onFocusCard,
  highlight,
}: BoardProps) {
  const container = useRef<HTMLDivElement>(null);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ids = cards.map((c) => c.id);
  const capture = useFlip(
    container,
    cards.map((c) => `${c.id}:${c.width}`).join("|"),
  );
  const name = (id: string) => catalog[byId.get(id)?.type ?? "balance"].title;

  const sortable = useSortable({
    ids,
    axis: "grid",
    label: name,
    disabled: !editing,
    onCommit: (next) => onChange(next.map((id) => byId.get(id)!)),
  });

  // Spans follow the committed order so cards keep their size while dragging.
  const desktop = rowSpans(cards, "desktop");
  const tablet = rowSpans(cards, "tablet");
  const spans = new Map(ids.map((id, i) => [id, [desktop[i], tablet[i]]]));

  const edit = (next: DashboardCard[]) => {
    capture();
    onChange(next);
  };
  const update = (id: string, patch: Partial<DashboardCard>) =>
    edit(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (id: string, to: number) =>
    edit(moveItem(ids, id, to).map((i) => byId.get(i)!));

  return (
    <>
      <div
        ref={container}
        className="board"
        data-editing={editing || undefined}
      >
        {sortable.order.map((id) => {
          const card = byId.get(id);
          if (!card) return null;
          const item = sortable.getItemProps(id);
          const [span, spanTablet] = spans.get(id)!;
          return (
            <div
              key={id}
              className="board-cell"
              data-card-id={id}
              data-highlight={highlight === id || undefined}
              onFocusCapture={() => onFocusCard(id)}
              {...item}
              style={
                {
                  ...item.style,
                  "--span": span,
                  "--span-t": spanTablet,
                } as CSSProperties
              }
            >
              {editing && (
                <EditBar
                  ledger={ledger}
                  card={card}
                  index={ids.indexOf(id)}
                  count={ids.length}
                  handle={sortable.getHandleProps(id)}
                  onWidth={(width) => update(id, { width })}
                  onPalette={(palette) => update(id, { palette })}
                  onSource={(source) =>
                    update(id, { account: source || undefined })
                  }
                  onMove={(to) => move(id, to)}
                  onDuplicate={() => {
                    const copy = {
                      ...createCard(card.type, card.width),
                      palette: card.palette,
                      account: card.account,
                      options: card.options,
                    };
                    const next = [...cards];
                    next.splice(ids.indexOf(id) + 1, 0, copy);
                    edit(next);
                  }}
                  onRemove={() => {
                    capture();
                    onRemove(id);
                  }}
                />
              )}
              <div className="board-card" inert={editing || undefined}>
                <ErrorBoundary label="Cette carte">
                  <CardSlot
                    card={card}
                    ledger={ledger}
                    account={cardAccount(ledger, card, account)}
                    range={range}
                    editing={editing}
                    onOption={onOption}
                  />
                </ErrorBoundary>
              </div>
            </div>
          );
        })}
      </div>
      {sortable.placeholder}
      {sortable.status}
    </>
  );
}

function EditBar({
  ledger,
  card,
  index,
  count,
  handle,
  onWidth,
  onPalette,
  onSource,
  onMove,
  onDuplicate,
  onRemove,
}: {
  ledger: Ledger;
  card: DashboardCard;
  index: number;
  count: number;
  handle: ReturnType<ReturnType<typeof useSortable>["getHandleProps"]>;
  onWidth(width: CardWidth): void;
  onPalette(palette: CardPaletteId): void;
  /** "" follows the dock. */
  onSource(account: string): void;
  onMove(to: number): void;
  onDuplicate(): void;
  onRemove(): void;
}) {
  const definition = catalog[card.type];
  const source =
    card.account && ledger.accounts.some((a) => a.id === card.account)
      ? card.account
      : "";
  const title = source
    ? `${definition.title} · ${accountName(ledger, source)}`
    : definition.title;
  return (
    <div className="board-editbar">
      <button type="button" className="board-handle" {...handle}>
        <GripVertical size={18} aria-hidden />
      </button>
      <span className="board-editbar-name" title={title}>
        {title}
      </span>
      <div className="board-editbar-tools">
        <Segmented
          label={`Largeur de ${definition.title}`}
          size="compact"
          value={String(card.width)}
          onChange={(value) => onWidth(Number(value) as CardWidth)}
          options={definition.widths.map((w) => ({
            value: String(w),
            label: widthLabels[w].short,
            ariaLabel: widthLabels[w].long,
          }))}
        />
        <PalettePicker
          name={definition.title}
          value={card.palette ?? definition.defaultPalette}
          onChange={onPalette}
        />
        {definition.supportsAccount && (
          <Picker
            label={`Source de ${definition.title}`}
            size="compact"
            variant="ghost"
            className="board-source"
            value={source || "dock"}
            valueLabel={source ? accountName(ledger, source) : "Dock"}
            onValueChange={(value) => onSource(value === "dock" ? "" : value)}
            options={[
              { value: "dock", label: "Compte du dock" },
              ...ledger.accounts.map((a) => ({
                value: a.id,
                label: accountName(ledger, a.id),
              })),
            ]}
          />
        )}
        <Menu
          label={`Actions de ${definition.title}`}
          trigger={
            <IconButton
              label={`Actions de ${definition.title}`}
              icon={<MoreHorizontal aria-hidden />}
            />
          }
          items={[
            {
              label: "Déplacer au début",
              icon: <ArrowUpToLine aria-hidden />,
              onSelect: () => onMove(0),
              disabledReason: index === 0 ? "Déjà en premier" : undefined,
            },
            {
              label: "Monter",
              icon: <ChevronUp aria-hidden />,
              onSelect: () => onMove(index - 1),
              disabledReason: index === 0 ? "Déjà en premier" : undefined,
            },
            {
              label: "Descendre",
              icon: <ChevronDown aria-hidden />,
              onSelect: () => onMove(index + 1),
              disabledReason:
                index === count - 1 ? "Déjà en dernier" : undefined,
            },
            {
              label: "Déplacer à la fin",
              icon: <ArrowDownToLine aria-hidden />,
              onSelect: () => onMove(count),
              disabledReason:
                index === count - 1 ? "Déjà en dernier" : undefined,
            },
            { type: "separator" },
            {
              label: "Dupliquer",
              icon: <Copy aria-hidden />,
              onSelect: onDuplicate,
            },
            {
              label: "Retirer",
              icon: <Trash2 aria-hidden />,
              destructive: true,
              onSelect: onRemove,
            },
          ]}
        />
        <IconButton
          label={`Retirer ${definition.title}`}
          icon={<X aria-hidden />}
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

function PalettePicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: CardPaletteId;
  onChange(palette: CardPaletteId): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      label={`Palette de ${name}`}
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="board-palettes"
      trigger={
        <button
          type="button"
          className="board-swatch-trigger"
          aria-label={`Palette de ${name} : ${paletteNames[value]}`}
          title={`Palette : ${paletteNames[value]}`}
        >
          <span className={`board-swatch palette-${value}`} aria-hidden />
        </button>
      }
    >
      <div className="board-palette-grid" role="group" aria-label="Palettes">
        {cardPaletteIds.map((id) => (
          <button
            key={id}
            type="button"
            className="board-palette-option"
            aria-pressed={id === value}
            onClick={() => {
              onChange(id);
              setOpen(false);
            }}
          >
            <span className={`board-swatch palette-${id}`} aria-hidden />
            <span>{paletteNames[id]}</span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
