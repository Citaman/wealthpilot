import { Plus, TriangleAlert } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { useToast } from "../../../app/toast";
import { saveDue } from "../../../data/commands";
import { available } from "../../../domain/available";
import { subcategoryForLabel } from "../../../domain/categories";
import { accountStatus } from "../../../domain/balances";
import {
  addDays,
  formatDay,
  formatWeekday,
  isIsoDate,
} from "../../../domain/dates";
import { upcoming, type Occurrence } from "../../../domain/events";
import { forecast, type Shortfall } from "../../../domain/forecast";
import { accountName, type Ledger } from "../../../domain/ledger";
import { formatEuro, parseMoney } from "../../../domain/money";
import { currentMonthEnd } from "../../../domain/periods";
import type { IsoDate } from "../../../domain/types";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { DateChip } from "../../../ui/DateChip";
import { Empty } from "../../../ui/Empty";
import { Field } from "../../../ui/Field";
import { Money } from "../../../ui/Money";
import { Picker } from "../../../ui/Picker";
import { Segmented } from "../../../ui/Segmented";
import { OccurrenceMenu } from "../../shared/OccurrenceMenu";
import { categoryText } from "../../shared/CategoryLabel";
import { Logo } from "../../shared/Logo";
import { FooterTile, MoreToggle } from "./cardParts";
import type { CardProps } from "./types";
import "./UpcomingCard.css";

const LIMIT = { narrow: 5, medium: 8, wide: Infinity } as const;

export function UpcomingCard({ card, ledger, account }: CardProps) {
  const until = currentMonthEnd(ledger.calendar, ledger.asOf);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setAdding(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };
  return (
    <CardShell
      palette={card.palette}
      title="À venir"
      actions={<span className="eyebrow muted">→ {formatDay(until)}</span>}
      footer={
        <FooterTile
          value={available(ledger, account).chargesTotal}
          label="à régler"
          action={
            <Button
              ref={addButton}
              variant="outline"
              icon={<Plus />}
              aria-expanded={adding}
              onClick={() => (adding ? close() : setAdding(true))}
            >
              Échéance
            </Button>
          }
        />
      }
    >
      <Agenda ledger={ledger} account={account} until={until} />
      {adding && <DueForm ledger={ledger} account={account} onDone={close} />}
    </CardShell>
  );
}

function Agenda({
  ledger,
  account,
  until,
}: {
  ledger: Ledger;
  account: string;
  until: IsoDate;
}) {
  const { size } = useCardWidth();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { asOf } = ledger;
  // Household transfers cancel out; for one account they are real movements.
  const items = upcoming(ledger, account, until).filter(
    (o) => account || !o.internal,
  );
  const plan = forecast(ledger, account, until);
  const limit = LIMIT[size];
  const shown = open ? items : items.slice(0, limit);
  const days = new Map<IsoDate, Occurrence[]>();
  for (const o of shown) days.set(o.date, [...(days.get(o.date) ?? []), o]);
  const balanceOn = (date: IsoDate) =>
    plan.points.find((p) => p.date === (date < asOf ? asOf : date))?.value ??
    null;
  const peak = Math.max(1, ...plan.points.map((p) => p.value));

  return (
    <div className="agenda" data-size={size}>
      {plan.shortfalls.map((s) => (
        <ShortfallLine key={s.account} ledger={ledger} shortfall={s} />
      ))}
      {items.length ? (
        <ol className="agenda-days" id={listId}>
          {[...days].map(([date, list], index) => (
            <li
              key={date}
              className={
                index && shown.indexOf(list[0]) >= limit
                  ? "agenda-day card-row-in"
                  : "agenda-day"
              }
            >
              <DateChip
                date={date}
                soon={date >= asOf && date <= addDays(asOf, 3)}
              />
              <ul className="agenda-rows" aria-label={formatWeekday(date)}>
                {list.map((o) => (
                  <Row key={o.id} ledger={ledger} o={o} />
                ))}
              </ul>
              {size === "wide" && (
                <Runway value={balanceOn(date)} peak={peak} />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <Empty>Rien de prévu d’ici le {formatDay(until)}</Empty>
      )}
      {items.length > limit && (
        <MoreToggle
          hidden={items.length - limit}
          open={open}
          onToggle={() => setOpen(!open)}
          controls={listId}
        />
      )}
    </div>
  );
}

/** Projected balance that evening, as a bar against the highest balance of the horizon. */
function Runway({ value, peak }: { value: number | null; peak: number }) {
  return (
    <span className="agenda-balance" title="Solde prévu ce soir-là">
      <span className="mono">
        <span className="muted">solde ≈ </span>
        <Money value={value} tone="auto" cents="never" />
      </span>
      <span className="agenda-runway" aria-hidden>
        <span
          data-negative={value !== null && value < 0 ? true : undefined}
          style={{
            width: `${value === null ? 0 : Math.max(2, Math.min(100, (Math.abs(value) / peak) * 100))}%`,
          }}
        />
      </span>
    </span>
  );
}

function ShortfallLine({
  ledger,
  shortfall: s,
}: {
  ledger: Ledger;
  shortfall: Shortfall;
}) {
  const before =
    s.date > ledger.asOf
      ? `avant le ${formatDay(addDays(s.date, -1))}`
      : "dès aujourd’hui";
  return (
    <p className="agenda-alert" role="status">
      <TriangleAlert size={18} aria-hidden />
      <span>
        <strong>
          {accountName(ledger, s.account)}{" "}
          {s.threshold
            ? `< réserve ${formatEuro(s.threshold, { cents: "never" })}`
            : "< 0"}{" "}
          le {formatDay(s.date)}
        </strong>{" "}
        <span className="mono">
          ({formatEuro(s.low.value, { cents: "never" })})
        </span>
        {" · "}prévoir {formatEuro(s.amount, { cents: "never" })} {before}
      </span>
    </p>
  );
}

function Row({ ledger, o }: { ledger: Ledger; o: Occurrence }) {
  const late = o.overdue && o.amount > 0;
  const sub = subcategoryForLabel(ledger, o.label, o.category);
  const meta = late
    ? "attendu, pas encore reçu"
    : [
        accountName(ledger, o.account),
        o.category && categoryText(o.category, sub),
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <li className="agenda-row" data-late={late || undefined}>
      <Logo
        ledger={ledger}
        name={o.label}
        category={o.category}
        subcategory={sub}
      />
      <span className="agenda-text">
        <span className="agenda-name">{o.label}</span>
        <span className="agenda-sub">
          <span className="agenda-meta">{meta}</span>
          {o.overdue && !late && (
            <Badge tone="warning" title="Date passée, pas encore rapprochée">
              À vérifier
            </Badge>
          )}
          {o.kind === "estimate" && !o.confirmed && (
            <Badge
              tone="estimated"
              title={
                o.confidence
                  ? `Récurrence détectée · confiance ${o.confidence} %`
                  : "Récurrence détectée"
              }
            >
              Estimé
            </Badge>
          )}
        </span>
      </span>
      <Money
        className={o.amount > 0 ? "agenda-amount agenda-in" : "agenda-amount"}
        value={o.amount}
        size="s"
        signed
        tone="none"
      />
      <OccurrenceMenu ledger={ledger} occurrence={o} />
    </li>
  );
}

function DueForm({
  ledger,
  account,
  onDone,
}: {
  ledger: Ledger;
  account: string;
  onDone(): void;
}) {
  const toast = useToast();
  const accounts = accountStatus(ledger);
  const [label, setLabel] = useState("");
  const [sign, setSign] = useState<"-" | "+">("-");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(ledger.asOf);
  const [target, setTarget] = useState(account || accounts[0]?.id || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cents = parseMoney(amount);
    const problems: Record<string, string> = {};
    if (!label.trim()) problems.label = "Libellé requis";
    if (cents === null || cents === 0) problems.amount = "Montant invalide";
    if (!isIsoDate(date) || date < ledger.asOf) problems.date = "Date à venir";
    if (!target) problems.account = "Compte requis";
    setErrors(problems);
    if (Object.keys(problems).length || cents === null) return;
    setPending(true);
    try {
      const undo = await saveDue({
        id: crypto.randomUUID(),
        label: label.trim(),
        amount: (sign === "-" ? -1 : 1) * Math.abs(cents),
        date,
        account: target,
      });
      toast.undoable("Échéance ajoutée", undo);
      onDone();
    } catch (error) {
      toast.error(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="due-form"
      aria-label="Nouvelle échéance"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <Field
        className="due-label"
        label="Libellé"
        autoFocus
        maxLength={120}
        value={label}
        error={errors.label}
        onChange={(event) => setLabel(event.currentTarget.value)}
      />
      <Field label="Montant" error={errors.amount} className="due-amount">
        {(control) => (
          <span className="due-amount-control">
            <Segmented
              size="compact"
              label="Sens"
              value={sign}
              onChange={setSign}
              options={[
                { value: "-", label: "−", ariaLabel: "Sortie" },
                { value: "+", label: "+", ariaLabel: "Entrée" },
              ]}
            />
            <input
              className="ui-input"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              {...control}
            />
          </span>
        )}
      </Field>
      <Field
        label="Date"
        type="date"
        min={ledger.asOf}
        value={date}
        error={errors.date}
        onChange={(event) => setDate(event.currentTarget.value)}
      />
      <Field label="Compte" error={errors.account}>
        {(control) => (
          <Picker
            label="Compte"
            value={target}
            onValueChange={setTarget}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            {...control}
          />
        )}
      </Field>
      <span className="due-actions">
        <Button type="submit" variant="primary" loading={pending}>
          Ajouter
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </span>
    </form>
  );
}
