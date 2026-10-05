import { Ellipsis } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReading } from "../../../app/context";
import { navigate } from "../../../app/router";
import { useToast } from "../../../app/toast";
import { renameAccount, setCheckpoint } from "../../../data/commands";
import {
  accountStatus,
  householdBalance,
  type AccountStatus,
} from "../../../domain/balances";
import {
  daysBetween,
  formatDay,
  isIsoDate,
  maxDate,
  minDate,
  monthEnd,
  shiftMonth,
  type DateRange,
} from "../../../domain/dates";
import type { Ledger } from "../../../domain/ledger";
import { formatEuro } from "../../../domain/money";
import type { Cents } from "../../../domain/types";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { EditableMoney, EditableText } from "../../../ui/Editable";
import { Empty } from "../../../ui/Empty";
import { Field } from "../../../ui/Field";
import { IconButton } from "../../../ui/IconButton";
import { Menu } from "../../../ui/Menu";
import { Money } from "../../../ui/Money";
import { FooterTile } from "./cardParts";
import type { CardProps } from "./types";
import "./AccountsCard.css";

const freshness = {
  ok: { tone: "positive", label: "À jour" },
  stale: { tone: "warning", label: "À actualiser" },
  unknown: { tone: "negative", label: "Sans solde" },
} as const;

export function AccountsCard({ card, ledger, account }: CardProps) {
  const rows = accountStatus(ledger);
  return (
    <CardShell
      palette={card.palette}
      title="Comptes"
      footer={
        rows.length > 1 && (
          <FooterTile
            value={householdBalance(ledger, "", ledger.asOf)}
            label="total foyer"
            unknownReason="Un compte n’a pas de solde observé"
          />
        )
      }
    >
      {rows.length ? (
        <ul className="acc-list">
          {rows.map((s) => (
            <AccountRow
              key={s.id}
              ledger={ledger}
              status={s}
              current={s.id === account}
            />
          ))}
        </ul>
      ) : (
        <Empty>Aucun compte</Empty>
      )}
    </CardShell>
  );
}

function AccountRow({
  ledger,
  status: s,
  current,
}: {
  ledger: Ledger;
  status: AccountStatus;
  current: boolean;
}) {
  const toast = useToast();
  const reading = useReading();
  const { size } = useCardWidth();
  const [entering, setEntering] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const badge = freshness[s.freshness];
  const close = () => {
    setEntering(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  return (
    <li className="acc-row" data-current={current || undefined}>
      <span className="acc-name">
        <EditableText
          value={s.name}
          label={`Nom du compte ${s.name}`}
          maxLength={40}
          onCommit={async (next) => {
            try {
              toast.undoable(
                "Compte renommé",
                await renameAccount(s.id, next === s.id ? "" : next),
              );
            } catch (error) {
              toast.error(error);
            }
          }}
        />
      </span>
      <span className="acc-observed mono muted">
        {s.checkpoint
          ? `observé le ${formatDay(s.checkpoint.date)}`
          : "à confirmer"}
        {size === "wide" && s.lastImport && (
          <> · importé le {formatDay(s.lastImport.slice(0, 10))}</>
        )}
      </span>
      <Coverage ledger={ledger} status={s} labels={size === "wide"} />
      <span className="acc-balance">
        <Money
          value={s.balance}
          size="s"
          tone="auto"
          cents="never"
          unknownReason="Aucun solde observé"
        />
        {s.freshness !== "ok" && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </span>
      <span className="acc-menu">
        <Menu
          label={`Actions pour ${s.name}`}
          trigger={
            <IconButton
              ref={trigger}
              label={`Actions pour ${s.name}`}
              icon={<Ellipsis />}
            />
          }
          items={[
            {
              label: "Saisir le solde observé",
              // After the menu has returned focus to its trigger.
              onSelect: () => requestAnimationFrame(() => setEntering(true)),
            },
            {
              label: "Importer un relevé",
              onSelect: () => navigate("import", { acct: s.id }),
            },
            {
              label: "Filtrer sur ce compte",
              disabledReason:
                reading.account === s.id
                  ? "Le dock affiche déjà ce compte"
                  : undefined,
              onSelect: () => reading.setAccount(s.id),
            },
          ]}
        />
      </span>
      {entering && <CheckpointForm ledger={ledger} status={s} onDone={close} />}
    </li>
  );
}

/** Observed balance entry: shows the gap with the computed balance before saving. */
function CheckpointForm({
  ledger,
  status: s,
  onDone,
}: {
  ledger: Ledger;
  status: AccountStatus;
  onDone(): void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(ledger.asOf);
  const computed = isIsoDate(date)
    ? householdBalance(ledger, s.id, date)
    : null;
  const [amount, setAmount] = useState<Cents | null>(null);
  const [pending, setPending] = useState(false);
  const field = useRef<HTMLSpanElement>(null);
  const dateError =
    !isIsoDate(date) || date > ledger.asOf ? "Date passée ou du jour" : null;

  useEffect(() => {
    field.current?.querySelector<HTMLButtonElement>(".ui-editable")?.click();
  }, []);

  const save = async () => {
    if (amount === null || dateError) return;
    setPending(true);
    try {
      toast.undoable(
        `Solde ${s.name} enregistré`,
        await setCheckpoint(s.id, { date, amount }),
      );
      onDone();
    } catch (error) {
      toast.error(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="acc-form"
      role="group"
      aria-label={`Solde observé de ${s.name}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <span className="acc-form-amount" ref={field}>
        <span className="ui-field-label">Solde observé</span>
        <EditableMoney
          value={amount}
          size="s"
          label={`Solde observé de ${s.name}`}
          onCommit={setAmount}
        />
      </span>
      <Field
        label="Date"
        type="date"
        max={ledger.asOf}
        value={date}
        error={dateError}
        onChange={(event) => setDate(event.currentTarget.value)}
      />
      <p className="acc-form-gap mono" aria-live="polite">
        {amount === null ? (
          <span className="muted">
            calculé{" "}
            {computed === null
              ? "—"
              : formatEuro(computed, { cents: "always" })}
          </span>
        ) : computed === null ? (
          <span className="muted">aucun solde calculé à comparer</span>
        ) : (
          <>
            écart <Money value={amount - computed} signed tone="auto" />
            <span className="muted">
              {" "}
              vs {formatEuro(computed, { cents: "always" })} calculé
            </span>
          </>
        )}
      </p>
      <span className="acc-form-actions">
        <Button
          variant="primary"
          loading={pending}
          disabledReason={
            amount === null
              ? "Saisissez le solde lu sur le relevé"
              : (dateError ?? undefined)
          }
          onClick={() => void save()}
        >
          Enregistrer
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Annuler
        </Button>
      </span>
    </div>
  );
}

const MONTHS = 12;

/** Last 12 months, each segment filled by the share of days covered by complete statements. */
function Coverage({
  ledger,
  status: s,
  labels,
}: {
  ledger: Ledger;
  status: AccountStatus;
  labels: boolean;
}) {
  const { asOf } = ledger;
  const rows = ledger.byAccount.get(s.id) ?? [];
  // Without statement metadata, the span of imported operations is shown, hatched.
  const derived = !s.coverage.length;
  const ranges: DateRange[] = derived
    ? rows.length
      ? [{ from: rows[0].date, to: rows.at(-1)!.date }]
      : []
    : s.coverage;
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const key = shiftMonth(asOf.slice(0, 7), i - MONTHS + 1);
    const from = `${key}-01`;
    const to = minDate(monthEnd(key), asOf);
    const days = daysBetween(from, to) + 1;
    const covered = ranges.reduce((n, r) => {
      const a = maxDate(r.from, from);
      const b = minDate(r.to, to);
      return a <= b ? n + daysBetween(a, b) + 1 : n;
    }, 0);
    return { key, from, ratio: Math.min(1, covered / days) };
  });
  const holes = months.filter((m) => m.ratio < 1).length;
  const name = (from: string) => formatDay(from).replace(/^\d+\s*/, "");
  return (
    <span
      className="acc-coverage"
      data-derived={derived || undefined}
      role="img"
      aria-label={
        derived
          ? `${s.name} : pas de relevé complet, opérations importées sur ${MONTHS - holes} mois`
          : holes
            ? `${s.name} : relevés complets sur ${MONTHS - holes} des ${MONTHS} derniers mois`
            : `${s.name} : 12 mois couverts`
      }
      title={
        derived
          ? "Opérations importées sans relevé complet"
          : "Couverture des relevés, 12 derniers mois"
      }
    >
      <span className="acc-segments">
        {months.map((m) => (
          <span
            key={m.key}
            className="acc-segment"
            data-full={m.ratio === 1 || undefined}
            title={`${name(m.from)} : ${Math.round(m.ratio * 100)} %`}
          >
            <span style={{ width: `${m.ratio * 100}%` }} />
          </span>
        ))}
      </span>
      {labels && (
        <span className="acc-axis mono muted" aria-hidden>
          <span>{name(months[0].from)}</span>
          <span>{name(months[MONTHS - 1].from)}</span>
        </span>
      )}
    </span>
  );
}
