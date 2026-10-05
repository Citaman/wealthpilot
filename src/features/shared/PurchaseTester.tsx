import { Ban, Calculator, Check, CircleAlert } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { categoryColor, categoryNames } from "../../domain/categories";
import {
  addDays,
  formatDay,
  maxDate,
  minDate,
  weekStart,
} from "../../domain/dates";
import { reserveFor } from "../../domain/forecast";
import { accountName, type Ledger } from "../../domain/ledger";
import { formatEuro, parseMoney } from "../../domain/money";
import { simulatePurchase, type Simulation } from "../../domain/simulate";
import type { Cents, IsoDate } from "../../domain/types";
import { weekPlan } from "../../domain/week";
import { Button } from "../../ui/Button";
import { CategoryDot } from "../../ui/CategoryDot";
import { Field } from "../../ui/Field";
import { Money } from "../../ui/Money";
import { Picker } from "../../ui/Picker";
import "./PurchaseTester.css";

export interface PurchaseTesterProps {
  ledger: Ledger;
  /** Default payer ("" = household / usual payer of the category). */
  account: string;
  minDate?: IsoDate;
  maxDate?: IsoDate;
  /** Narrow layout for a ⅓ dashboard card. */
  compact?: boolean;
}

// Radix Select reserves "" for "no value".
const HOUSEHOLD = "household";
const euro = (value: Cents) => formatEuro(value, { cents: "never" });

/** Categories that money leaves through (spent or budgeted), sorted. */
function spendingCategories(ledger: Ledger) {
  const used = new Set(ledger.budgets.map((b) => b.category));
  for (const t of ledger.transactions)
    if (t.amount < 0 && !t.internal) used.add(t.category);
  return categoryNames(ledger).filter((name) => used.has(name));
}

/** Account that most often paid this category over the last 120 days. */
function usualPayer(ledger: Ledger, category: string) {
  const since = addDays(ledger.asOf, -120);
  const counts = new Map<string, number>();
  for (const t of ledger.transactions)
    if (t.category === category && t.amount < 0 && t.date >= since)
      counts.set(t.account, (counts.get(t.account) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

const clampDate = (date: IsoDate, min: IsoDate, max?: IsoDate) =>
  max ? minDate(maxDate(date, min), max) : maxDate(date, min);

/** Live « Puis-je dépenser ? » simulation; never writes. */
export function PurchaseTester({
  ledger,
  account,
  minDate: min = ledger.asOf,
  maxDate: max,
  compact = false,
}: PurchaseTesterProps) {
  const categories = useMemo(() => spendingCategories(ledger), [ledger]);
  const [draft, setDraft] = useState("");
  const [chosenCategory, setCategory] = useState<string | null>(null);
  const [chosenDate, setDate] = useState<IsoDate | null>(null);
  const [chosenPayer, setPayer] = useState<string | null>(null);

  const category =
    chosenCategory && categories.includes(chosenCategory)
      ? chosenCategory
      : (["Restaurants", "Food", "Courses"].find((c) =>
          categories.includes(c),
        ) ??
        categories[0] ??
        "");
  const defaultDate = clampDate(ledger.asOf, min, max);
  const dateInRange =
    chosenDate !== null && chosenDate >= min && (!max || chosenDate <= max);
  const date = dateInRange ? chosenDate : defaultDate;
  const payer =
    chosenPayer !== null &&
    (chosenPayer === "" || ledger.accounts.some((a) => a.id === chosenPayer))
      ? chosenPayer
      : account || usualPayer(ledger, category);

  const amount = draft.trim() ? parseMoney(draft) : null;
  const amountError =
    draft.trim() && (amount === null || amount <= 0)
      ? "Montant invalide"
      : null;
  const dateError =
    chosenDate !== null && !dateInRange
      ? max && chosenDate > max
        ? `Au plus tard le ${formatDay(max)}`
        : `Au plus tôt le ${formatDay(min)}`
      : null;
  const simulation =
    amount !== null && amount > 0 && category && !dateError
      ? simulatePurchase(ledger, { amount, category, date, account: payer })
      : null;
  // The week's possible amount for this category, in the scope the tester was opened from.
  const weekEnvelope = simulation
    ? weekPlan(ledger, account, weekStart(date)).envelopes.find(
        (e) => e.category === category && e.limit > 0,
      )
    : undefined;
  const week =
    weekEnvelope && amount !== null && date >= ledger.asOf
      ? { before: weekEnvelope.possible, after: weekEnvelope.possible - amount }
      : null;
  const touched =
    draft !== "" ||
    chosenCategory !== null ||
    chosenDate !== null ||
    chosenPayer !== null;

  const payerName = payer ? accountName(ledger, payer) : "Foyer";
  const color = categoryColor(category, ledger.prefs.categoryDefinitions);

  return (
    <div className="purchase" data-compact={compact || undefined}>
      <div className="purchase-fields">
        <Field
          label="Montant"
          className="purchase-amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00 €"
          value={draft}
          error={amountError}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && draft) {
              event.stopPropagation();
              setDraft("");
            }
          }}
        />
        <Field label="Catégorie">
          {(control) => (
            <Picker
              {...control}
              label="Catégorie"
              value={category}
              onValueChange={setCategory}
              disabled={!categories.length}
              options={categories.map((name) => ({ value: name, label: name }))}
              valueLabel={
                <span className="purchase-category">
                  <CategoryDot color={color} />
                  {category || "Aucune"}
                </span>
              }
            />
          )}
        </Field>
        <Field
          label="Date"
          type="date"
          min={min}
          max={max}
          value={date}
          error={dateError}
          onChange={(event) => setDate(event.currentTarget.value || null)}
        />
        <Field label="Payé par">
          {(control) => (
            <Picker
              {...control}
              label="Payé par"
              value={payer || HOUSEHOLD}
              onValueChange={(v) => setPayer(v === HOUSEHOLD ? "" : v)}
              options={[
                { value: HOUSEHOLD, label: "Foyer" },
                ...ledger.accounts.map((a) => ({
                  value: a.id,
                  label: accountName(ledger, a.id),
                })),
              ]}
            />
          )}
        </Field>
      </div>

      <div className="purchase-result" aria-live="polite">
        {simulation ? (
          <Result
            simulation={simulation}
            week={week}
            category={category}
            color={color}
            payerName={payerName}
            reserve={reserveFor(ledger, payer)}
          />
        ) : (
          <p className="purchase-idle">
            <Calculator size={18} aria-hidden />
            {categories.length
              ? "Saisir un montant pour voir l’effet"
              : "Aucune catégorie de dépense"}
          </p>
        )}
      </div>

      {touched && (
        <div className="purchase-actions">
          <Button
            variant="ghost"
            title="Simulation : rien n’est enregistré"
            onClick={() => {
              setDraft("");
              setCategory(null);
              setDate(null);
              setPayer(null);
            }}
          >
            Effacer
          </Button>
        </div>
      )}
    </div>
  );
}

function Result({
  simulation: s,
  week,
  category,
  color,
  payerName,
  reserve,
}: {
  simulation: Simulation;
  week: { before: Cents; after: Cents } | null;
  category: string;
  color: string;
  payerName: string;
  reserve: Cents;
}) {
  const verdict: Record<
    Simulation["verdict"],
    { icon: ReactNode; text: string }
  > = {
    ok: {
      icon: <Check size={18} aria-hidden />,
      text: !week
        ? `Oui · il restera ${euro(s.envelope?.after ?? 0)} en ${category}`
        : week.after >= 0
          ? `Oui · il restera ${euro(week.after)} en ${category} cette semaine`
          : `Oui dans le mois · semaine ${category} dépassée de ${euro(-week.after)}`,
    },
    outside: {
      icon: <CircleAlert size={18} aria-hidden />,
      text:
        s.free.before !== null && s.free.after !== null
          ? `Possible, hors enveloppe · libre ${euro(s.free.before)} → ${euro(s.free.after)}`
          : "Possible, hors enveloppe",
    },
    risk: {
      icon: <Ban size={18} aria-hidden />,
      text: `Non · ${payerName} passe sous ${reserve > 0 ? "la réserve" : "0 €"}${
        s.riskDate ? ` le ${formatDay(s.riskDate)}` : ""
      }`,
    },
  };
  // Within the month but beyond this week’s limit: not a plain yes.
  const tone =
    s.verdict === "ok" && week && week.after < 0 ? "outside" : s.verdict;
  const provisioned =
    s.inEnvelope && s.free.before !== null && s.free.before === s.free.after;
  return (
    <>
      <p className="purchase-verdict" data-verdict={tone}>
        {tone === s.verdict ? verdict[s.verdict].icon : verdict.outside.icon}
        <span>{verdict[s.verdict].text}</span>
      </p>
      <dl className="purchase-rows">
        {week && (
          <Row
            label={`${category} · semaine`}
            before={week.before}
            after={week.after}
            color={color}
          />
        )}
        {s.envelope && (
          <Row
            label={week ? `${category} · mois` : `Enveloppe ${category}`}
            before={s.envelope.before}
            after={s.envelope.after}
            color={color}
          />
        )}
        <Row
          label="Libre du mois"
          before={s.free.before}
          after={s.free.after}
        />
        <Row
          label={`Point bas · ${payerName}`}
          before={s.low.before?.value ?? null}
          after={s.low.after?.value ?? null}
          note={s.low.after && formatDay(s.low.after.date)}
          threshold={reserve}
        />
      </dl>
      {provisioned && (
        <p className="purchase-note">
          Déjà provisionné par l’enveloppe : le libre ne baisse pas une 2ᵉ fois.
        </p>
      )}
    </>
  );
}

function Row({
  label,
  before,
  after,
  color,
  note,
  threshold,
}: {
  label: string;
  before: Cents | null;
  after: Cents | null;
  color?: string;
  note?: string | null;
  threshold?: Cents;
}) {
  const scale = Math.max(1, Math.abs(before ?? 0), Math.abs(after ?? 0));
  const width = (value: Cents | null) =>
    `${(Math.max(0, value ?? 0) / scale) * 100}%`;
  const under = (value: Cents | null) =>
    value !== null &&
    (value < 0 || (threshold !== undefined && value < threshold));
  return (
    <div
      className="purchase-row"
      style={color ? ({ "--bar": color } as CSSProperties) : undefined}
    >
      <dt>{label}</dt>
      <dd className="purchase-values">
        <span className="purchase-before">
          <Money
            value={before}
            cents="never"
            tone="none"
            unknownReason="Solde à confirmer"
          />
        </span>
        <span aria-hidden className="purchase-arrow">
          →
        </span>
        <span className="purchase-after" data-under={under(after) || undefined}>
          <Money
            value={after}
            cents="never"
            unknownReason="Solde à confirmer"
          />
          {note && <span className="mono muted">{note}</span>}
        </span>
      </dd>
      <dd className="purchase-bars" aria-hidden>
        <span className="purchase-bar" data-kind="before">
          <span style={{ width: width(before) }} />
        </span>
        <span className="purchase-bar" data-kind="after">
          <span style={{ width: width(after) }} />
        </span>
      </dd>
    </div>
  );
}
