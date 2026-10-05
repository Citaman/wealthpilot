import { GripVertical, Plus } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { navigate } from "../../../app/router";
import { useToast } from "../../../app/toast";
import { reorderEnvelopes, setBudget, type Undo } from "../../../data/commands";
import { spendingByCategory, usualSpending } from "../../../domain/analytics";
import { categoryColor, categoryNames } from "../../../domain/categories";
import {
  envelopes,
  envelopeTotals,
  type Envelope,
} from "../../../domain/envelopes";
import type { Ledger } from "../../../domain/ledger";
import { formatEuro } from "../../../domain/money";
import { currentMonthKey, monthOf, monthRange } from "../../../domain/periods";
import { formatDay, formatMonth, type DateRange } from "../../../domain/dates";
import { Button } from "../../../ui/Button";
import { useCardWidth, CardShell } from "../../../ui/CardShell";
import { CategoryDot } from "../../../ui/CategoryDot";
import { ConcentricRings } from "../../../ui/charts/ConcentricRings";
import { EditableMoney } from "../../../ui/Editable";
import { Empty } from "../../../ui/Empty";
import { Menu } from "../../../ui/Menu";
import { Money } from "../../../ui/Money";
import { ProgressBar } from "../../../ui/ProgressBar";
import { moveItem, useSortable } from "../../../ui/sortable";
import { acctParam, FooterTile, MoreToggle } from "./cardParts";
import type { CardProps } from "./types";
import "./EnvelopesCard.css";

const SHOWN = 6;

/** The dock's budget month when it shows one exactly, else the current one. */
function displayedMonth(ledger: Ledger, range: DateRange) {
  const key = monthOf(range.from, ledger.calendar);
  const r = monthRange(key, ledger.calendar);
  return r.from === range.from && r.to === range.to
    ? key
    : currentMonthKey(ledger.calendar, ledger.asOf);
}

/** Spending categories without an envelope, most spent first, with the usual amount. */
function candidates(ledger: Ledger, account: string, month: string) {
  const taken = new Set(
    envelopes(ledger, account, month).map((e) => e.category),
  );
  const usual = usualSpending(ledger, account, month);
  const current = new Map(
    spendingByCategory(ledger, {
      account,
      range: monthRange(month, ledger.calendar),
      asOf: ledger.asOf,
    }).map((s) => [s.category, s.amount]),
  );
  return categoryNames(ledger)
    .filter((c) => !taken.has(c) && (usual.has(c) || current.has(c)))
    .map((category) => ({
      category,
      usual: usual.get(category) ?? 0,
      current: current.get(category) ?? 0,
    }))
    .sort((a, b) => b.usual - a.usual || b.current - a.current);
}

const euros = (cents: number) => Math.round(cents / 100) * 100;

export function EnvelopesCard({
  card,
  ledger,
  account,
  range,
  editing,
}: CardProps) {
  const month = displayedMonth(ledger, range);
  const rows = envelopes(ledger, account, month);
  const [created, setCreated] = useState<string | null>(null);
  const toast = useToast();

  const create = async (category: string, amount: number) => {
    try {
      const undo = await setBudget({ month, category, account }, amount);
      setCreated(category);
      toast.undoable(`Enveloppe ${category} créée`, undo);
    } catch (error) {
      toast.error(error);
    }
  };

  const add = (trigger: "footer" | "empty") => {
    const options = candidates(ledger, account, month);
    return (
      <Menu
        label="Catégories sans enveloppe"
        side="top"
        align={trigger === "footer" ? "end" : "start"}
        trigger={
          trigger === "footer" ? (
            <Button
              variant="outline"
              icon={<Plus />}
              disabledReason={
                options.length
                  ? undefined
                  : "Chaque catégorie de dépense a déjà une enveloppe"
              }
            >
              Enveloppe
            </Button>
          ) : (
            <Button variant="outline" icon={<Plus />}>
              Créer
            </Button>
          )
        }
        items={
          options.length
            ? [
                { type: "label", label: "Habitude · 3 mois" },
                ...options.map((o) => ({
                  label: o.category,
                  icon: (
                    <CategoryDot
                      color={categoryColor(
                        o.category,
                        ledger.prefs.categoryDefinitions,
                      )}
                      size={10}
                    />
                  ),
                  meta: o.usual
                    ? formatEuro(euros(o.usual), { cents: "never" })
                    : "—",
                  onSelect: () => void create(o.category, euros(o.usual)),
                })),
              ]
            : [{ type: "label", label: "Aucune catégorie de dépense" }]
        }
      />
    );
  };

  const totals = envelopeTotals(rows);
  return (
    <CardShell
      palette={card.palette}
      title="Enveloppes"
      actions={
        <span className="eyebrow muted">
          {formatMonth(month, ledger.asOf.slice(0, 4))}
        </span>
      }
      footer={
        rows.length > 0 && (
          <FooterTile
            value={totals.free}
            label="restants"
            action={add("footer")}
          />
        )
      }
    >
      {rows.length ? (
        <Envelopes
          ledger={ledger}
          account={account}
          month={month}
          rows={rows}
          spent={totals.paid}
          created={created}
          onCreatedShown={() => setCreated(null)}
          disabled={editing}
        />
      ) : (
        <Empty action={add("empty")}>Aucune enveloppe</Empty>
      )}
    </CardShell>
  );
}

function Envelopes({
  ledger,
  account,
  month,
  rows,
  spent,
  created,
  onCreatedShown,
  disabled,
}: {
  ledger: Ledger;
  account: string;
  month: string;
  rows: Envelope[];
  spent: number;
  created: string | null;
  onCreatedShown(): void;
  disabled: boolean;
}) {
  const { size } = useCardWidth();
  const toast = useToast();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const refocus = useRef<{ element: HTMLElement; order: string } | null>(null);

  const all = rows.map((e) => e.category);
  const createdIndex = created ? all.indexOf(created) : -1;
  const expanded = size === "wide" || open || createdIndex >= SHOWN;
  const visible = expanded ? all : all.slice(0, SHOWN);
  const byCategory = new Map(rows.map((e) => [e.category, e]));

  const save = async (next: string[]) => {
    const order = [
      ...next,
      ...all.filter((c) => !next.includes(c)),
      ...ledger.prefs.budgetOrder.filter((c) => !all.includes(c)),
    ];
    try {
      toast.undoable(
        "Ordre des enveloppes enregistré",
        await reorderEnvelopes(order),
      );
    } catch (error) {
      toast.error(error);
    }
  };

  const sortable = useSortable({
    ids: visible,
    axis: "y",
    label: (c) => c,
    onCommit: (next) => void save(next),
    disabled,
  });

  // Alt+↑/↓ anywhere on a row; the focused control keeps the focus once the row moved.
  const onRowKey = (category: string) => (event: KeyboardEvent) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown"))
      return;
    event.preventDefault();
    const index = sortable.order.indexOf(category);
    const target = index + (event.key === "ArrowUp" ? -1 : 1);
    if (target < 0 || target >= sortable.order.length) return;
    const next = moveItem(sortable.order, category, target);
    if (document.activeElement instanceof HTMLElement)
      refocus.current = {
        element: document.activeElement,
        order: next.join("\u0000"),
      };
    void save(next);
  };
  const shownOrder = sortable.order.join("\u0000");
  useLayoutEffect(() => {
    const pending = refocus.current;
    if (!pending || pending.order !== shownOrder) return;
    refocus.current = null;
    if (
      pending.element.isConnected &&
      document.activeElement !== pending.element
    )
      pending.element.focus({ preventScroll: true });
  }, [shownOrder]);

  // A created envelope opens its amount for editing.
  useEffect(() => {
    if (!created || createdIndex < 0) return;
    if (createdIndex >= SHOWN) setOpen(true);
    list.current
      ?.querySelector<HTMLButtonElement>(
        `[data-envelope="${CSS.escape(created)}"] .env-allocated .ui-editable`,
      )
      ?.click();
    onCreatedShown();
  }, [created, createdIndex, onCreatedShown]);

  const r = monthRange(month, ledger.calendar);
  const drill = (category: string) =>
    navigate("transactions", {
      cat: category,
      from: r.from,
      to: r.to,
      acct: acctParam(account),
    });

  const commit = (e: Envelope) => async (amount: number | null) => {
    let undo: Undo;
    try {
      undo = await setBudget(
        { month, category: e.category, account: e.budgets[0].account },
        amount,
      );
    } catch (error) {
      if (error instanceof RangeError) throw error;
      toast.error(error);
      return;
    }
    toast.undoable(
      amount === null
        ? `Enveloppe ${e.category} supprimée`
        : `Enveloppe ${e.category} · ${formatEuro(amount, { cents: "auto" })}`,
      undo,
    );
  };

  const color = (c: string) =>
    categoryColor(c, ledger.prefs.categoryDefinitions);
  const rings = rows.slice(0, 5);

  return (
    <div className="env" data-size={size}>
      {size !== "narrow" && (
        <ConcentricRings
          label={`Enveloppes de ${formatMonth(month)}`}
          size={size === "wide" ? 280 : 220}
          rings={rings.map((e) => ({
            key: e.category,
            label: e.category,
            value: e.paid + e.committed,
            max: e.allocated,
            color: color(e.category),
          }))}
          activeIndex={active}
          onActiveChange={setActive}
          center={
            <>
              <Money
                value={spent}
                size={size === "wide" ? "l" : "m"}
                tone="none"
                cents="never"
              />
              <span className="env-center-label">dépensés</span>
            </>
          }
        />
      )}
      <div className="env-list-wrap">
        <ul className="env-list" id={listId} ref={list}>
          {sortable.order.map((category, index) => {
            const e = byCategory.get(category);
            if (!e) return null;
            const remaining = e.over
              ? e.allocated - e.paid - e.committed
              : e.free;
            const ringIndex = rings.findIndex((x) => x.category === category);
            return (
              <li
                key={category}
                {...sortable.getItemProps(category)}
                className={
                  index >= SHOWN && size !== "wide"
                    ? "env-row card-row-in"
                    : "env-row"
                }
                data-envelope={category}
                data-active={
                  active !== null && active === ringIndex ? true : undefined
                }
                onPointerEnter={() => ringIndex >= 0 && setActive(ringIndex)}
                onPointerLeave={() => setActive(null)}
                onKeyDown={onRowKey(category)}
              >
                <button
                  type="button"
                  className="env-handle"
                  title="Glisser ou Alt+↑/↓ pour réordonner"
                  {...sortable.getHandleProps(category)}
                >
                  <GripVertical size={16} aria-hidden />
                </button>
                <span className="env-head">
                  <CategoryDot color={color(category)} size={10} />
                  <button
                    type="button"
                    className="card-link env-name"
                    onClick={() => drill(category)}
                    title={`Voir les opérations ${category}`}
                  >
                    {category}
                  </button>
                </span>
                <span
                  className="env-amounts mono"
                  title={
                    e.committed
                      ? `Payé ${formatEuro(e.paid)} · prévu ${formatEuro(e.committed)}`
                      : undefined
                  }
                >
                  <span className="muted">
                    {formatEuro(e.paid, { cents: "never" })}
                    {" / "}
                  </span>
                  <span className="env-allocated">
                    {e.budgets.length === 1 ? (
                      <EditableMoney
                        value={e.allocated}
                        label={`Alloué ${category}`}
                        allowEmpty
                        validate={(v) => (v < 0 ? "Montant positif" : null)}
                        onCommit={commit(e)}
                      />
                    ) : (
                      <span title="Réparti sur plusieurs comptes : modifiez depuis un compte">
                        {formatEuro(e.allocated, { cents: "never" })}
                      </span>
                    )}
                  </span>
                </span>
                <span className="env-remaining">
                  <Money value={remaining} size="s" tone="auto" cents="never" />
                  {e.over && <span className="env-over mono">dépassé</span>}
                </span>
                <span className="env-bar">
                  <ProgressBar
                    label={category}
                    paid={e.paid}
                    committed={e.committed}
                    total={e.allocated}
                    color={color(category)}
                    showPercent={size !== "narrow"}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        {rows.some((e) => e.committed > 0) && (
          <p className="env-legend mono muted">
            <span className="env-legend-swatch" aria-hidden />
            prévu d’ici le {formatDay(r.to)}
          </p>
        )}
        {size !== "wide" && all.length > SHOWN && (
          <MoreToggle
            hidden={all.length - SHOWN}
            open={open}
            onToggle={() => setOpen(!open)}
            controls={listId}
          />
        )}
      </div>
      {sortable.placeholder}
      {sortable.status}
    </div>
  );
}
