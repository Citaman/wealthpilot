import { useMemo, useState } from "react";
import type { Snapshot } from "./types";
import {
  addDays,
  dateLabel,
  euro,
  monthEnd,
  parseMoney,
  selectDashboard,
  today,
} from "./domain";
import { forecastCash } from "./forecasting";
import { withEstimates } from "./intelligence";
import { BalanceChart } from "./Chart";
import { EditorDialog } from "./Editors";
import { GoalsEditor } from "./Planning";
import { InsightWidget } from "./InsightWidget";
import { Field, Notice } from "./ui";
import { Select } from "./Select";
import { db } from "./store";
import { balanceCoverage } from "./coverage";
type Props = {
  snapshot: Snapshot;
  account: string;
  month: string;
  from: string;
  notify: (message: string) => void;
};
const home = () => {
  location.hash = "dashboard";
};

export function BudgetsPage({ snapshot, account, month, notify }: Props) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const rows = snapshot.budgets.filter(
      (b) => b.month === month && (b.account ?? "") === account,
    ),
    cents = parseMoney(amount);
  const source = rows.find((b) => b.id === from),
    destination = rows.find((b) => b.id === to);
  const envelopes = selectDashboard(
    withEstimates(snapshot, monthEnd(month)),
    month,
    account,
  ).budgets;
  const free = source
    ? Math.max(0, envelopes.find((b) => b.id === source.id)?.remaining ?? 0)
    : 0;
  async function transfer() {
    try {
      if (
        !source ||
        !destination ||
        source.id === destination.id ||
        cents === null ||
        cents <= 0 ||
        cents > free
      )
        throw new Error(
          "Choisissez deux enveloppes distinctes. La somme ne peut pas dépasser le restant après dépenses et engagements.",
        );
      await db.transaction("rw", db.tables, async () => {
        const a = await db.budgets.get(source.id),
          b = await db.budgets.get(destination.id);
        if (
          JSON.stringify(a) !== JSON.stringify(source) ||
          JSON.stringify(b) !== JSON.stringify(destination)
        )
          throw new Error(
            "Une enveloppe a changé. Vérifiez les nouvelles valeurs avant de réessayer.",
          );
        const latest = await db.snapshot();
        const latestFree =
          selectDashboard(
            withEstimates(latest, monthEnd(month)),
            month,
            account,
          ).budgets.find((b) => b.id === source.id)?.remaining ?? 0;
        if (cents > latestFree)
          throw new Error(
            "De nouvelles dépenses ou échéances ont réduit le restant. Vérifiez les montants avant de réessayer.",
          );
        await db.budgets.bulkPut([
          { ...source, amount: source.amount - cents },
          { ...destination, amount: destination.amount + cents },
        ]);
      });
      setAmount("");
      notify("Réallocation enregistrée. Le total alloué est inchangé.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">
            {account || "FOYER"} · {month}
          </span>
          <h1>Chaque euro, sa place.</h1>
        </div>
      </div>
      <EditorDialog
        inline
        kind="budgets"
        snapshot={snapshot}
        month={month}
        category=""
        account={account}
        onClose={home}
        notify={notify}
      />
      <section className="card">
        <h2>Réallouer sans augmenter le total</h2>
        <div className="form-grid">
          <Field label="Depuis l’enveloppe">
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Choisir</option>
              {rows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vers l’enveloppe">
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choisir</option>
              {rows.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.category}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Somme à déplacer (€)">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>
        {source && destination && cents !== null && (
          <p>
            Aperçu : {source.category} {euro(source.amount)} →{" "}
            {euro(source.amount - cents)} ; {destination.category}{" "}
            {euro(destination.amount)} → {euro(destination.amount + cents)}.
            Aucune opération bancaire créée ; aucune réserve supplémentaire.
          </p>
        )}
        {source && (
          <p>
            Restant réallouable après dépenses et engagements : {euro(free)}.
            Réallouer ne crée pas de trésorerie.
          </p>
        )}
        {error && <Notice error>{error}</Notice>}
        <button className="button yellow" onClick={() => void transfer()}>
          Confirmer la réallocation
        </button>
      </section>
    </main>
  );
}

export function ForecastPage({ snapshot, account, notify }: Props) {
  const [horizon, setHorizon] = useState("month"),
    [delay, setDelay] = useState(0),
    [increase, setIncrease] = useState(0),
    [name, setName] = useState("Mon scénario"),
    [error, setError] = useState("");
  const end =
    horizon === "month"
      ? monthEnd(today().slice(0, 7))
      : addDays(today(), horizon === "week" ? 7 : 91);
  const base = useMemo(
    () => forecastCash(snapshot, end, account),
    [snapshot, end, account],
  );
  const scenario = useMemo(() => {
    const projected = withEstimates(snapshot, end);
    // Freeze generated occurrences for comparison; shifted estimated IDs must not regenerate originals.
    const modified = {
      ...snapshot,
      preferences: {
        ...snapshot.preferences,
        recurrenceRules: snapshot.preferences.recurrenceRules?.map((r) => ({
          ...r,
          paused: true,
        })),
        dismissedRecurrences: [
          ...(snapshot.preferences.dismissedRecurrences ?? []),
          ...projected.dues
            .filter((d) => d.recurrenceKey)
            .map((d) => d.recurrenceKey!),
        ],
      },
      dues: projected.dues.map((d) => ({
        ...d,
        id: d.id.startsWith("estimate:") ? "scenario:" + d.id : d.id,
        estimated: false,
        date:
          !d.transactionId && d.date >= today() && d.amount > 0
            ? addDays(d.date, delay)
            : d.date,
        amount:
          !d.transactionId && d.date >= today() && d.amount < 0
            ? Math.round(d.amount * (1 + increase / 100))
            : d.amount,
      })),
    };
    return forecastCash(modified, end, account);
  }, [snapshot, end, account, delay, increase]);
  async function save() {
    try {
      if (!name.trim()) throw new Error("Nommez ce scénario.");
      await db.transaction("rw", db.preferences, async () => {
        const p = (await db.preferences.get("main")) ?? snapshot.preferences;
        if ((p.scenarios?.length ?? 0) >= 30)
          throw new Error("Limite de 30 scénarios.");
        await db.preferences.put({
          ...p,
          scenarios: [
            ...(p.scenarios ?? []),
            {
              id: crypto.randomUUID(),
              name: name.trim().slice(0, 80),
              account,
              incomeDelay: delay,
              expenseIncrease: increase,
            },
          ],
        });
      });
      notify(
        "Scénario enregistré, sans modifier les opérations ni les engagements.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <span className="eyebrow">{account || "FOYER"}</span>
          <h1>La suite, sans surprise.</h1>
        </div>
        <Select
          aria-label="Horizon prévisionnel"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
        >
          <option value="week">7 jours</option>
          <option value="month">Fin du mois</option>
          <option value="quarter">13 semaines</option>
        </Select>
      </div>
      <section className="card">
        <h2>Scénario de référence</h2>
        <BalanceChart
          points={base.points}
          safety={base.reserve}
          showTable={false}
        />
        <p>{base.assumptions}</p>
        {base.warnings.map((w) => (
          <Notice key={w}>{w}</Notice>
        ))}
      </section>
      <section className="card">
        <h2>Et si les choses changent ?</h2>
        <div className="form-grid">
          <Field label="Retard des revenus attendus (jours)">
            <input
              type="number"
              min="0"
              max="31"
              value={delay}
              onChange={(e) =>
                setDelay(Math.min(31, Math.max(0, Number(e.target.value))))
              }
            />
          </Field>
          <Field label="Hausse des charges prévues (%)">
            <input
              type="number"
              min="0"
              max="100"
              value={increase}
              onChange={(e) =>
                setIncrease(Math.min(100, Math.max(0, Number(e.target.value))))
              }
            />
          </Field>
        </div>
        <p>
          Les opérations déjà importées ne sont jamais déplacées. La variation
          porte sur les échéances attendues, pas sur l’historique. Les plafonds
          des enveloppes restent inchangés : une hausse de charge consomme
          d’abord leur provision libre, puis dégrade le solde si elle la
          dépasse.
        </p>
        <BalanceChart
          points={scenario.points}
          safety={scenario.reserve}
          showTable={false}
        />
        <dl className="insight-stats">
          <div>
            <dt>Point bas référence</dt>
            <dd>
              {base.low
                ? `${euro(base.low.value)} · ${dateLabel(base.low.date)}`
                : "Inconnu"}
            </dd>
          </div>
          <div>
            <dt>Point bas du scénario</dt>
            <dd>
              {scenario.low
                ? `${euro(scenario.low.value)} · ${dateLabel(scenario.low.date)}`
                : "Inconnu"}
            </dd>
          </div>
        </dl>
        <Field label="Nom du scénario">
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <button className="button yellow" onClick={() => void save()}>
          Enregistrer une copie
        </button>
        {error && <Notice error>{error}</Notice>}
      </section>
      <section className="card">
        <h2>Scénarios enregistrés</h2>
        {snapshot.preferences.scenarios
          ?.filter((s) => s.account === account)
          .map((s) => (
            <div className="recurrence-row" key={s.id}>
              <span>
                <b>{s.name}</b>
                <small>
                  Revenus +{s.incomeDelay} jours · charges +{s.expenseIncrease}{" "}
                  %
                </small>
              </span>
              <button
                className="button"
                onClick={() => {
                  setDelay(s.incomeDelay);
                  setIncrease(s.expenseIncrease);
                  setName(s.name + " · copie");
                }}
              >
                Comparer / dupliquer
              </button>
            </div>
          ))}
      </section>
    </main>
  );
}

export function AccountsPage(props: Props) {
  return (
    <main className="page">
      <div className="page-title">
        <h1>Les comptes, au clair.</h1>
      </div>
      <section className="card">
        {props.snapshot.accounts.map((a) => (
          <div className="recurrence-row" key={a.id}>
            <span>
              <b>{a.id}</b>
              <small>
                Couverture au {dateLabel(today())} :{" "}
                {
                  {
                    observed: "solde observé",
                    covered: "couverte par les relevés",
                    derived: "reconstruite, à confirmer",
                    incomplete: "incomplète",
                    unknown: "inconnue",
                  }[balanceCoverage(a, today())]
                }
              </small>
            </span>
            <strong>
              {a.checkpoint
                ? `${euro(a.checkpoint.amount)} · ${dateLabel(a.checkpoint.date)}`
                : "Solde à confirmer"}
            </strong>
          </div>
        ))}
      </section>
      <EditorDialog
        inline
        kind="accounts"
        snapshot={props.snapshot}
        month={props.month}
        category=""
        notify={props.notify}
        onClose={home}
      />
      <p>
        Les observations datées sont conservées. Réconcilier un solde ne crée
        aucune opération d’ajustement.
      </p>
    </main>
  );
}
export function GoalsPage(props: Props) {
  return (
    <main className="page">
      <div className="page-title">
        <h1>Les projets qui comptent.</h1>
      </div>
      <GoalsEditor
        snapshot={props.snapshot}
        notify={props.notify}
        onClose={home}
      />
    </main>
  );
}
export function AnalyticsPage(props: Props) {
  const d = useMemo(
    () =>
      selectDashboard(
        withEstimates(props.snapshot, monthEnd(props.month)),
        props.month,
        props.account,
        today(),
        props.from,
      ),
    [props.snapshot, props.month, props.account, props.from],
  );
  return (
    <main className="page">
      <div className="page-title">
        <h1>Comprendre mes dépenses.</h1>
      </div>
      <div className="week-envelopes">
        {(
          [
            "categories",
            "flows",
            "comparison",
            "unusual",
            "paidBy",
            "pace",
          ] as const
        ).map((id) => (
          <InsightWidget
            key={id}
            id={id}
            snapshot={props.snapshot}
            d={d}
            month={props.month}
            from={props.from}
            account={props.account}
            size="large"
            configure={home}
            transactions={() => {
              location.hash = "transactions";
            }}
            goals={() => {
              location.hash = "goals";
            }}
            plan={() => {
              location.hash = "week";
            }}
          />
        ))}
      </div>
    </main>
  );
}
