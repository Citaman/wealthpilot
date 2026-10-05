import { useMemo, useState } from "react";
import { navigate } from "../../../app/router";
import { useToast } from "../../../app/toast";
import { setCheckpoint } from "../../../data/commands";
import { accountStatus, balanceSeries } from "../../../domain/balances";
import {
  daysBetween,
  formatDay,
  formatWeekday,
  maxDate,
  minDate,
  weekStart,
} from "../../../domain/dates";
import { forecast, reserveFor } from "../../../domain/forecast";
import { accountsIn, rowsIn, type Ledger } from "../../../domain/ledger";
import { formatEuro, parseMoney } from "../../../domain/money";
import { currentMonthEnd, nextMonthEnd } from "../../../domain/periods";
import { merchantLabel } from "../../../domain/search";
import type { IsoDate } from "../../../domain/types";
import { Button } from "../../../ui/Button";
import { CardShell, useCardWidth } from "../../../ui/CardShell";
import { CategoryDot } from "../../../ui/CategoryDot";
import { Field } from "../../../ui/Field";
import { Money } from "../../../ui/Money";
import { Picker } from "../../../ui/Picker";
import { Segmented } from "../../../ui/Segmented";
import { LineChart, type LineSeries } from "../../../ui/charts/LineChart";
import { Sparkline } from "../../../ui/charts/Sparkline";
import { Tile } from "./Tile";
import type { CardProps } from "./types";
import "./BalanceCard.css";

const euro = (value: number) => formatEuro(value, { cents: "never" });
const accountColor = (index: number) => `var(--series-${(index % 7) + 1})`;

export function BalanceCard(props: CardProps) {
  const { card, ledger, range, setOption } = props;
  const live = range.from <= ledger.asOf && range.to >= ledger.asOf;
  const withForecast = live && card.options?.forecast !== false;
  return (
    <CardShell
      palette={card.palette}
      title="Solde"
      actions={
        <Segmented
          className="balance-mode"
          label="Affichage du solde"
          size="compact"
          value={withForecast ? "forecast" : "real"}
          onChange={(mode) => setOption("forecast", mode === "forecast")}
          options={[
            { value: "real", label: "Réel" },
            {
              value: "forecast",
              label: "+ Prévision",
              disabledReason: live ? undefined : "Période passée",
            },
          ]}
        />
      }
    >
      <BalanceBody {...props} withForecast={withForecast} />
    </CardShell>
  );
}

function BalanceBody({
  ledger,
  account,
  range,
  withForecast,
}: CardProps & { withForecast: boolean }) {
  const { size } = useCardWidth();
  const { asOf, calendar } = ledger;
  const series = balanceSeries(ledger, { account, range, asOf });
  const known = series.points.filter((p) => p.value !== null);
  const first = known[0];
  const last = known.at(-1);
  const status = accountStatus(ledger);
  const inScope = accountsIn(ledger, account).map((a) => a.id);

  if (!last || !first)
    return (
      <UnknownBalance
        ledger={ledger}
        accounts={status
          .filter((s) => inScope.includes(s.id) && s.balance === null)
          .map((s) => ({ id: s.id, name: s.name }))}
      />
    );

  const observedOn = status
    .filter((s) => inScope.includes(s.id))
    .map((s) => s.checkpoint?.date)
    .filter((d): d is IsoDate => Boolean(d))
    .sort()[0];
  const live = last.date === asOf;
  const fc = live
    ? forecast(ledger, account, nextMonthEnd(calendar, asOf))
    : null;
  const monthEnd = currentMonthEnd(calendar, asOf);
  const endPoint = fc?.points.find((p) => p.date === monthEnd);

  const hero = (
    <div className="balance-hero">
      <Money value={last.value} size="l" tone="none" />
      {last !== first && (
        <span className="balance-delta">
          <Money
            value={last.value! - first.value!}
            size="text"
            signed
            cents="never"
          />
          <span className="muted">depuis le {formatDay(first.date)}</span>
        </span>
      )}
      {observedOn && (
        <span className="mono muted">observé le {formatDay(observedOn)}</span>
      )}
    </div>
  );

  if (size === "narrow")
    return (
      <>
        {hero}
        <Sparkline
          values={series.points.map((p) => p.value)}
          label={`Solde du ${formatDay(first.date)} au ${formatDay(last.date)}`}
          height={48}
        />
      </>
    );

  const lowest = known.reduce((a, p) => (p.value! < a.value! ? p : a));
  return (
    <>
      {hero}
      <BalanceChart
        ledger={ledger}
        account={account}
        range={range}
        withForecast={withForecast}
        wide={size === "wide"}
      />
      <div className="tiles">
        {withForecast && fc?.lowPoint ? (
          <Tile
            label="Point bas"
            value={fc.lowPoint.value}
            alert
            meta={
              fc.lowPoint.date === asOf
                ? "aujourd’hui"
                : `prévu · ${formatDay(fc.lowPoint.date)}`
            }
          />
        ) : (
          <Tile
            label="Point bas"
            value={lowest.value!}
            alert
            meta={formatDay(lowest.date)}
          />
        )}
        {endPoint ? (
          <Tile
            label="Fin du mois"
            value={endPoint.value}
            alert
            meta={`prévu · ${formatDay(monthEnd)}`}
          />
        ) : (
          <Tile
            label="Clôture"
            value={last.value!}
            alert
            meta={formatDay(last.date)}
          />
        )}
      </div>
    </>
  );
}

interface Annotation {
  date: IsoDate;
  value: number;
  label: string;
}

/**
 * ≤ 4 marks by priority: forecast low point, biggest outflow, then the latest
 * identified incomes; a mark closer than `minGap` days to a kept one is dropped
 * so labels never pile up.
 */
function annotate(
  ledger: Ledger,
  account: string,
  points: { date: IsoDate; value: number | null }[],
  low: { date: IsoDate; value: number } | null,
  minGap: number,
): Annotation[] {
  const observed = points.filter((p) => p.value !== null);
  if (!observed.length) return [];
  const from = observed[0].date;
  const to = observed.at(-1)!.date;
  const valueOn = (date: IsoDate) =>
    observed.find((p) => p.date >= date)?.value ?? null;
  const marks: Annotation[] = [];
  const keep = (mark: Annotation) => {
    if (
      marks.length < 4 &&
      marks.every((m) => Math.abs(daysBetween(m.date, mark.date)) >= minGap)
    )
      marks.push(mark);
  };
  if (low && low.date > to)
    keep({ ...low, label: `Point bas ${euro(low.value)}` });

  const rows = rowsIn(ledger, account).filter(
    (t) => t.date >= from && t.date <= to && !t.internal,
  );
  const outflow = rows.reduce<(typeof rows)[number] | null>(
    (a, t) => (t.amount < 0 && (!a || t.amount < a.amount) ? t : a),
    null,
  );
  if (outflow) {
    const value = valueOn(outflow.date);
    if (value !== null)
      keep({
        date: outflow.date,
        value,
        label: `${merchantLabel(outflow)} ${euro(outflow.amount)}`,
      });
  }

  const byId = new Map(rows.map((t) => [t.id, t]));
  const incomes = ledger.calendar.observed
    .filter((b) => b.date >= from && b.date <= to)
    .map((b) => ({
      date: b.date,
      rows: b.transactionIds.flatMap((id) => byId.get(id) ?? []),
    }))
    .filter((b) => b.rows.length)
    .reverse();
  for (const income of incomes) {
    const value = valueOn(income.date);
    if (value === null) continue;
    const total = income.rows.reduce((n, t) => n + t.amount, 0);
    const name =
      income.rows.length === 1 ? merchantLabel(income.rows[0]) : "Revenus";
    keep({
      date: income.date,
      value,
      label: `${name} ${formatEuro(total, { signed: true, cents: "never" })}`,
    });
  }
  return marks.sort((a, b) => a.date.localeCompare(b.date));
}

function BalanceChart({
  ledger,
  account,
  range,
  withForecast,
  wide,
}: {
  ledger: Ledger;
  account: string;
  range: CardProps["range"];
  withForecast: boolean;
  wide: boolean;
}) {
  const { asOf, calendar } = ledger;
  const [focus, setFocus] = useState<string | null>(null);
  const series = balanceSeries(ledger, { account, range, asOf });
  const fc = withForecast
    ? forecast(ledger, account, nextMonthEnd(calendar, asOf))
    : null;
  const status = accountStatus(ledger);
  const reserve = reserveFor(ledger, account);
  const end = series.points.at(-1)?.date;
  const { width } = useCardWidth();
  const startDate = series.points[0]?.date;
  const lastDate = fc?.points.at(-1)?.date ?? end;
  // Days covered by one label width (~130 px) of plot.
  const minGap =
    startDate && lastDate
      ? Math.ceil(
          (daysBetween(startDate, lastDate) * 130) / Math.max(200, width - 120),
        )
      : 0;

  const chart = useMemo(() => {
    // Coverage gaps become breaks drawn as a grey dotted link; the last point
    // stays, it anchors the forecast.
    const observed = series.points.map((p) => ({
      date: p.date,
      value: p.gap && p.date !== end ? null : p.value,
    }));
    const lines: LineSeries[] = [
      {
        id: "balance",
        label: account ? "Solde" : "Solde du foyer",
        points: observed,
      },
    ];
    if (fc && fc.points.length > 1)
      lines.push({
        id: "forecast",
        label: "Prévision",
        kind: "forecast",
        points: fc.points.map((p) => ({ date: p.date, value: p.value })),
      });
    const index = series.perAccount.findIndex((p) => p.account === focus);
    if (index >= 0)
      lines.push({
        id: focus!,
        label: series.perAccount[index].name,
        kind: "context",
        color: accountColor(index),
        points: series.points.map((p, i) => ({
          date: p.date,
          value: series.perAccount[index].values[i],
        })),
      });
    const byDate = new Map(series.points.map((p) => [p.date, p]));
    const forecastByDate = new Map(fc?.points.map((p) => [p.date, p]) ?? []);
    return {
      lines,
      band: fc?.points.map((p) => ({ date: p.date, low: p.low, high: p.high })),
      annotations: annotate(
        ledger,
        account,
        observed,
        fc?.lowPoint ?? null,
        minGap,
      ),
      describe(date: IsoDate) {
        const point = byDate.get(date);
        const projected = forecastByDate.get(date);
        const parts = [formatWeekday(date)];
        if (point && point.value !== null && date <= asOf) {
          parts.push(euro(point.value));
          if (point.count)
            parts.push(
              `${point.count} opération${point.count > 1 ? "s" : ""} (${formatEuro(point.net, { signed: true, cents: "never" })})`,
            );
        } else if (projected) parts.push(`≈ ${euro(projected.value)} prévu`);
        const context = lines.find((l) => l.kind === "context");
        const value = context?.points.find((p) => p.date === date)?.value;
        if (context && value != null)
          parts.push(`${context.label} ${euro(value)}`);
        return parts.join(" · ");
      },
    };
  }, [series, fc, focus, account, end, ledger, asOf, minGap]);

  const select = (date: IsoDate) => {
    if (date > asOf) return;
    const from =
      series.granularity === "day"
        ? date
        : series.granularity === "week"
          ? weekStart(date)
          : `${date.slice(0, 7)}-01`;
    navigate("transactions", {
      from: maxDate(from, range.from),
      to: minDate(date, asOf),
      acct: account || "household",
    });
  };

  const legend =
    wide && !account && series.perAccount.length > 1 ? (
      <ul className="balance-legend" aria-label="Comptes">
        {series.perAccount.map((p, i) => (
          <li key={p.account}>
            <button
              type="button"
              className="balance-legend-item"
              aria-pressed={focus === p.account}
              onClick={() =>
                setFocus((f) => (f === p.account ? null : p.account))
              }
            >
              <CategoryDot color={accountColor(i)} size={10} />
              <span>{p.name}</span>
              <Money
                value={status.find((s) => s.id === p.account)?.balance}
                size="text"
                tone="none"
                cents="never"
                unknownReason="Solde à confirmer"
              />
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className="balance-chart">
      <LineChart
        label={`${account ? "Solde" : "Solde du foyer"}, ${formatDay(range.from)} → ${formatDay(fc?.points.at(-1)?.date ?? end ?? range.to)}`}
        series={chart.lines}
        band={chart.band}
        threshold={
          reserve > 0
            ? { value: reserve, label: `Réserve ${euro(reserve)}` }
            : undefined
        }
        today={end === asOf ? asOf : undefined}
        annotations={chart.annotations}
        describe={chart.describe}
        onSelect={select}
      />
      {legend}
    </div>
  );
}

function UnknownBalance({
  ledger,
  accounts,
}: {
  ledger: Ledger;
  accounts: { id: string; name: string }[];
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(ledger.asOf);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!accounts.length)
    return (
      <p className="balance-unknown">
        <span className="balance-unknown-title">
          Aucun solde sur la période
        </span>
      </p>
    );

  const save = async () => {
    const cents = parseMoney(amount);
    if (cents === null) return setError("Montant invalide");
    if (!date || date > ledger.asOf) return setError("Date invalide");
    setSaving(true);
    try {
      const undo = await setCheckpoint(target, { date, amount: cents });
      toast.undoable("Solde enregistré", undo);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="balance-unknown">
      <span className="balance-unknown-title">Solde à confirmer</span>
      {open ? (
        <form
          className="balance-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          {accounts.length > 1 && (
            <Field label="Compte">
              {(control) => (
                <Picker
                  {...control}
                  label="Compte"
                  value={target}
                  onValueChange={setTarget}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                />
              )}
            </Field>
          )}
          <Field
            label="Montant"
            inputMode="decimal"
            autoFocus
            value={amount}
            error={error}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
          <Field
            label="Date"
            type="date"
            max={ledger.asOf}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="balance-form-actions">
            <Button type="submit" variant="primary" loading={saving}>
              Enregistrer
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)}>
          Saisir le solde
        </Button>
      )}
    </div>
  );
}
