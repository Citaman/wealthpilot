import { ArrowRight, Check, Info } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { navigate } from "../../../app/router";
import { useToast } from "../../../app/toast";
import {
  confirmRecurrence,
  dismissRecurrence,
  updateTransactions,
  type Undo,
} from "../../../data/commands";
import { suggestCategories } from "../../../domain/categories";
import { formatDay } from "../../../domain/dates";
import { inbox, type InboxItem } from "../../../domain/inbox";
import { accountName, type Ledger } from "../../../domain/ledger";
import type { Recurrence } from "../../../domain/recurring";
import { filterTransactions, merchantLabel } from "../../../domain/search";
import type { Transaction } from "../../../domain/types";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { Money } from "../../../ui/Money";
import { CategoryMenu } from "../../shared/CategoryMenu";
import { acctParam, Logo, MoreToggle } from "./cardParts";
import type { CardProps } from "./types";
import "./InboxCard.css";

const QUEUE = 3;
const EVERYTHING = { from: "0000-01-01", to: "9999-12-31" };

const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`;

export function InboxCard({ card, ledger, account }: CardProps) {
  const items = inbox(ledger, account);
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const mark = (id: string, on: boolean) =>
    setDone((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const recurrences = items.flatMap((i) =>
    i.kind === "recurrence" && !done.has(i.recurrence.key)
      ? [i.recurrence]
      : [],
  );
  const others = items.filter(
    (i) =>
      i.kind !== "recurrence" &&
      (i.kind !== "uncategorized" || i.ids.some((id) => !done.has(id))),
  );
  const count =
    recurrences.length +
    others.reduce(
      (n, i) =>
        n +
        (i.kind === "uncategorized"
          ? i.ids.filter((id) => !done.has(id)).length
          : i.kind === "future"
            ? 0
            : 1),
      0,
    );
  const [first, ...rest] = others;
  const sections = [
    ...(first?.kind === "uncategorized" ? [first] : []),
    ...(recurrences.length ? ["recurrences" as const] : []),
    ...(first?.kind === "uncategorized" ? rest : others),
  ];

  return (
    <CardShell
      palette={card.palette}
      title="À traiter"
      actions={
        count > 0 && (
          <Badge tone="duplicate" title="Décisions en attente">
            {count}
          </Badge>
        )
      }
    >
      {sections.length ? (
        <ol className="inbox">
          {sections.map((item) =>
            item === "recurrences" ? (
              <Recurrences
                key="recurrences"
                ledger={ledger}
                list={recurrences}
                mark={mark}
              />
            ) : (
              <Item
                key={itemKey(item)}
                ledger={ledger}
                account={account}
                item={item}
                done={done}
                mark={mark}
              />
            ),
          )}
        </ol>
      ) : (
        <p className="inbox-empty">
          Rien à traiter <Check size={16} aria-hidden />
        </p>
      )}
    </CardShell>
  );
}

const itemKey = (item: InboxItem) =>
  item.kind === "balance" ? `b:${item.account}` : item.kind;

function Item({
  ledger,
  account,
  item,
  done,
  mark,
}: {
  ledger: Ledger;
  account: string;
  item: InboxItem;
  done: ReadonlySet<string>;
  mark(id: string, on: boolean): void;
}) {
  switch (item.kind) {
    case "uncategorized":
      return (
        <Uncategorized
          ledger={ledger}
          account={account}
          ids={item.ids}
          done={done}
          mark={mark}
        />
      );
    case "recurrence":
      return null;
    case "balance":
      return (
        <Section
          count={item.ageDays === null ? "?" : `${item.ageDays} j`}
          title={
            item.freshness === "unknown"
              ? `Solde ${accountName(ledger, item.account)} à confirmer`
              : `Solde ${accountName(ledger, item.account)} non observé depuis ${item.ageDays} j`
          }
          action={
            <Button
              variant="outline"
              onClick={() => navigate("import", { acct: item.account })}
            >
              Importer
            </Button>
          }
        />
      );
    case "overdue": {
      const dues = ledger.dues.filter((d) => item.ids.includes(d.id));
      const oldest = dues.map((d) => d.date).sort()[0];
      return (
        <Section
          count={item.ids.length}
          title={
            item.ids.length > 1
              ? `${item.ids.length} échéances passées à vérifier`
              : "Échéance passée à vérifier"
          }
          meta={
            dues.length === 1
              ? `${dues[0].label} · ${formatDay(dues[0].date)}`
              : oldest && `depuis le ${formatDay(oldest)}`
          }
          action={
            <Button
              variant="outline"
              iconEnd={<ArrowRight />}
              onClick={() =>
                navigate("transactions", {
                  from: oldest,
                  to: ledger.asOf,
                  acct: acctParam(account),
                  q: dues.length === 1 ? dues[0].label : undefined,
                })
              }
            >
              Vérifier
            </Button>
          }
        />
      );
    }
    case "future":
      return (
        <Section
          count={<Info size={18} aria-label="Information" />}
          tone="info"
          title={plural(
            item.ids.length,
            "opération future importée",
            "opérations futures importées",
          )}
          meta="comptées dans « À venir »"
        />
      );
  }
}

function Section({
  count,
  title,
  meta,
  action,
  tone,
  children,
}: {
  count: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  tone?: "info";
  children?: ReactNode;
}) {
  return (
    <li className="inbox-item" data-tone={tone}>
      <span className="inbox-count" aria-hidden={typeof count !== "object"}>
        {count}
      </span>
      <span className="inbox-title">
        <span className="inbox-title-text">{title}</span>
        {meta && <span className="mono muted inbox-meta">{meta}</span>}
      </span>
      {action && <span className="inbox-action">{action}</span>}
      {children && <div className="inbox-body">{children}</div>}
    </li>
  );
}

function Uncategorized({
  ledger,
  account,
  ids,
  done,
  mark,
}: {
  ledger: Ledger;
  account: string;
  ids: string[];
  done: ReadonlySet<string>;
  mark(id: string, on: boolean): void;
}) {
  const toast = useToast();
  const list = useRef<HTMLUListElement>(null);
  const left = ids.filter((id) => !done.has(id)).length;
  const rows = filterTransactions(ledger, {
    account,
    range: EVERYTHING,
    kind: "all",
    categories: [],
    min: null,
    max: null,
    uncategorized: true,
    withNote: false,
    query: "",
    sort: "date-desc",
  })
    .filter((t) => !t.internal && !done.has(t.id))
    .slice(0, QUEUE);

  const apply = async (
    t: Transaction,
    category: string,
    subcategory?: string,
  ) => {
    // The next operation slides in at once; the database catches up.
    mark(t.id, true);
    requestAnimationFrame(() =>
      list.current?.querySelector<HTMLButtonElement>(".inbox-chip")?.focus(),
    );
    let undo: Undo;
    try {
      undo = await updateTransactions([t.id], { category, subcategory });
    } catch (error) {
      mark(t.id, false);
      toast.error(error);
      return;
    }
    toast.undoable(`${merchantLabel(t)} · ${category}`, async () => {
      await undo();
      mark(t.id, false);
    });
  };

  if (!left) return null;
  return (
    <Section
      count={left}
      title={
        left > 1 ? "Opérations sans catégorie" : "Opération sans catégorie"
      }
      action={
        left > QUEUE && (
          <Button
            variant="ghost"
            iconEnd={<ArrowRight />}
            onClick={() =>
              navigate("transactions", {
                filter: "uncategorized",
                acct: acctParam(account),
              })
            }
          >
            Toutes
          </Button>
        )
      }
    >
      <ul className="inbox-queue" ref={list}>
        {rows.map((t) => (
          <QueueRow key={t.id} ledger={ledger} t={t} onApply={apply} />
        ))}
      </ul>
    </Section>
  );
}

function QueueRow({
  ledger,
  t,
  onApply,
}: {
  ledger: Ledger;
  t: Transaction;
  onApply(t: Transaction, category: string, subcategory?: string): void;
}) {
  const suggestions = suggestCategories(ledger, t);
  return (
    <li className="inbox-tx card-row-in">
      <span className="inbox-tx-head">
        <Logo ledger={ledger} name={merchantLabel(t)} size={28} />
        <span className="inbox-tx-text">
          <button
            type="button"
            className="card-link inbox-tx-name"
            onClick={() => navigate("transactions", { tx: t.id })}
          >
            {merchantLabel(t)}
          </button>
          <span className="mono muted">
            {formatDay(t.date)} · {accountName(ledger, t.account)}
          </span>
        </span>
        <Money value={t.amount} signed tone={t.amount > 0 ? "auto" : "none"} />
      </span>
      <span
        className="inbox-chips"
        role="group"
        aria-label={`Catégorie de ${merchantLabel(t)}`}
      >
        {suggestions.map((category) => (
          <button
            key={category}
            type="button"
            className="inbox-chip"
            onClick={() => onApply(t, category)}
          >
            {category}
          </button>
        ))}
        <CategoryMenu
          ledger={ledger}
          value={t.category}
          suggestions={suggestions}
          direction={t.amount > 0 ? "income" : "expense"}
          onSelect={(category, subcategory) =>
            onApply(t, category, subcategory)
          }
          trigger={
            <button type="button" className="inbox-chip" data-variant="more">
              Autre…
            </button>
          }
        />
      </span>
    </li>
  );
}

function Recurrences({
  ledger,
  list,
  mark,
}: {
  ledger: Ledger;
  list: Recurrence[];
  mark(id: string, on: boolean): void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { size } = useCardWidth();
  const queue = size === "wide" ? QUEUE : 2;
  const shown = open ? list : list.slice(0, queue);
  return (
    <Section
      count={list.length}
      title={
        list.length > 1 ? "Récurrences à confirmer" : "Récurrence à confirmer"
      }
    >
      <ul className="inbox-queue" id={id}>
        {shown.map((r) => (
          <RecurrenceRow key={r.key} ledger={ledger} r={r} mark={mark} />
        ))}
      </ul>
      {list.length > queue && (
        <MoreToggle
          hidden={list.length - queue}
          open={open}
          onToggle={() => setOpen(!open)}
          controls={id}
        />
      )}
    </Section>
  );
}

function RecurrenceRow({
  ledger,
  r,
  mark,
}: {
  ledger: Ledger;
  r: Recurrence;
  mark(id: string, on: boolean): void;
}) {
  const toast = useToast();
  const { size } = useCardWidth();
  const run = async (message: string, command: () => Promise<Undo>) => {
    mark(r.key, true);
    try {
      const undo = await command();
      toast.undoable(message, async () => {
        await undo();
        mark(r.key, false);
      });
    } catch (error) {
      mark(r.key, false);
      toast.error(error);
    }
  };
  const rhythm =
    r.frequency === "weekly" ? "chaque semaine" : `le ${r.day} du mois`;
  return (
    <li className="inbox-tx inbox-rec card-row-in">
      <span className="inbox-tx-head">
        <Logo ledger={ledger} name={r.name} category={r.category} size={28} />
        <span className="inbox-tx-text">
          <span className="inbox-tx-name">{r.name}</span>
          <span className="mono muted">
            {[
              rhythm,
              size !== "narrow" && accountName(ledger, r.account),
              size === "wide" && `prochaine ${formatDay(r.next)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <Money value={r.amount} signed tone={r.amount > 0 ? "auto" : "none"} />
      </span>
      <span className="inbox-chips">
        <button
          type="button"
          className="inbox-chip"
          data-variant="primary"
          onClick={() =>
            void run("Récurrence confirmée", () =>
              confirmRecurrence({
                id: crypto.randomUUID(),
                name: r.name,
                account: r.account,
                amount: r.amount,
                category: r.category,
                frequency: r.frequency,
                next: r.next,
                sourceKey: r.key,
              }),
            )
          }
        >
          Confirmer
        </button>
        <button
          type="button"
          className="inbox-chip"
          data-variant="more"
          onClick={() =>
            void run("Récurrence ignorée", () => dismissRecurrence(r.key))
          }
        >
          Ignorer
        </button>
      </span>
    </li>
  );
}
