import { Copy, Plus, X } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import type { PageProps } from "../../app/App";
import { useToast } from "../../app/toast";
import { patchPreferences } from "../../data/commands";
import { usePreferences } from "../../data/hooks";
import { formatMonth } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import { formatEuro, parseMoney } from "../../domain/money";
import {
  allowances,
  detectedSalary,
  people,
  scenarios,
  settlement,
  trajectory,
  type People,
  type PlanSettings,
  type Pressure,
  type Scenario,
  type ShareMode,
  type Trajectory,
} from "../../domain/plan";
import { Badge } from "../../ui/Badge";
import { IconButton } from "../../ui/IconButton";
import { Logo } from "../dashboard/cards/cardParts";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { EditableMoney } from "../../ui/Editable";
import { Empty } from "../../ui/Empty";
import { Money } from "../../ui/Money";
import { Picker } from "../../ui/Picker";
import { Segmented } from "../../ui/Segmented";
import "./plan.css";

const pct = (share: number) => `${Math.round(share * 100)} %`;
const month = (key: string) => formatMonth(key);

function usePlan() {
  const settings = usePreferences().plan ?? {};
  const toast = useToast();
  const save = async (patch: Partial<PlanSettings>, message?: string) => {
    try {
      const undo = await patchPreferences((p) => ({
        plan: { ...p.plan, ...patch },
      }));
      if (message) toast.undoable(message, undo);
    } catch (e) {
      toast.error(e);
    }
  };
  return { settings, save };
}

export function PlanPage({ ledger }: PageProps) {
  const { settings, save } = usePlan();
  const who = people(ledger, settings);
  if (!ledger.transactions.length || !who)
    return (
      <Empty>
        Il faut deux comptes avec des revenus pour construire le plan.
      </Empty>
    );
  const path = trajectory(ledger, settings);
  return (
    <div className="plan">
      <Recovery ledger={ledger} path={path} settings={settings} save={save} />
      <Split ledger={ledger} who={who} settings={settings} save={save} />
      <Allowances
        ledger={ledger}
        who={who}
        path={path}
        settings={settings}
        save={save}
      />
    </div>
  );
}

type Save = (patch: Partial<PlanSettings>, message?: string) => Promise<void>;

const pressureLabel: Record<
  Pressure,
  [string, Parameters<typeof Badge>[0]["tone"]]
> = {
  none: ["Déjà bon", "positive"],
  low: ["Pression faible", "positive"],
  medium: ["Pression moyenne", "warning"],
  high: ["Pression forte", "negative"],
  impossible: ["Irréaliste", "error"],
};

function Recovery({
  ledger,
  path,
  settings,
  save,
}: {
  ledger: Ledger;
  path: Trajectory;
  settings: PlanSettings;
  save: Save;
}) {
  const effort = settings.effort ?? 0;
  const firstPositive = path.months.find((m) => m.withEffort >= 0);
  const now = path.months[0];
  const options = scenarios(path);
  const sliderMax = Math.max(5000, Math.ceil(path.weeklyVariable / 500) * 500);
  const choose = (s: Scenario) =>
    save(
      { effort: s.weekly, target: s.key },
      `Objectif fin ${month(s.key)} : ${formatEuro(s.weekly)} / semaine`,
    );
  return (
    <>
      <CardShell
        palette="ink"
        motif
        eyebrow="Sortie du rouge"
        className="plan-hero"
      >
        <div className="plan-hero-grid">
          <div>
            <p className="plan-hero-line">
              Fin du mois de {now ? month(now.key) : "—"}
            </p>
            <Money value={now?.withEffort ?? null} size="hero" tone="auto" />
            <p className="plan-hero-line">
              {firstPositive
                ? firstPositive === now
                  ? "Au-dessus de zéro dès ce mois"
                  : `Au-dessus de zéro fin ${month(firstPositive.key)}`
                : `Encore sous zéro dans ${path.months.length} mois`}
            </p>
          </div>
          <label className="plan-effort">
            <span className="eyebrow">Effort d’épargne</span>
            <strong>{formatEuro(effort)} / semaine</strong>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={500}
              value={effort}
              onChange={(e) =>
                void save({ effort: Number(e.target.value), target: undefined })
              }
              aria-valuetext={`${formatEuro(effort)} par semaine`}
            />
            <span className="plan-muted">
              {path.weeklyVariable
                ? `${pct(effort / path.weeklyVariable)} des dépenses variables (${formatEuro(path.weeklyVariable)} / sem.)`
                : "Pas assez d’historique pour les dépenses variables"}
            </span>
          </label>
        </div>
      </CardShell>

      <CardShell
        title="Mois par mois"
        className="plan-months"
        actions={
          <Picker
            label="Objectif"
            size="compact"
            value={settings.target ?? "none"}
            valueLabel={
              settings.target
                ? `Objectif : fin ${month(settings.target)}`
                : "Choisir un objectif"
            }
            onValueChange={(v) => {
              const s = options.find((o) => o.key === v);
              if (s) void choose(s);
            }}
            options={options.map((o) => ({
              value: o.key,
              label: `Fin ${month(o.key)}`,
              meta: `${formatEuro(o.weekly)} / sem.`,
              description:
                pressureLabel[o.pressure][0] +
                (o.recommended ? " · recommandé" : ""),
            }))}
          />
        }
      >
        <ol className="plan-calendar">
          {path.months.map((m, i) => {
            const s = options[i];
            const [label, tone] = pressureLabel[s.pressure];
            return (
              <li key={m.key}>
                <button
                  type="button"
                  className="plan-month"
                  aria-pressed={settings.target === m.key}
                  disabled={s.pressure === "impossible"}
                  title={
                    s.pressure === "impossible"
                      ? "Plus de la moitié des dépenses variables"
                      : `Être au-dessus de zéro dès fin ${month(m.key)}`
                  }
                  onClick={() => void choose(s)}
                >
                  <span className="plan-month-name">
                    {month(m.key)}
                    {m.key.slice(0, 4) !== path.months[0].key.slice(0, 4) &&
                      ` ${m.key.slice(0, 4)}`}
                  </span>
                  <Money
                    value={m.withEffort}
                    size="s"
                    tone="auto"
                    cents="never"
                  />
                  {effort > 0 && (
                    <span className="plan-muted">
                      sans effort {formatEuro(m.end, { cents: "never" })}
                    </span>
                  )}
                  <span className="plan-month-need">
                    {s.weekly
                      ? `${formatEuro(s.weekly)} / sem.`
                      : "sans effort"}
                  </span>
                  <span className="plan-month-badges">
                    <Badge tone={tone}>{label}</Badge>
                    {s.recommended && <Badge tone="new">Recommandé</Badge>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="plan-muted">
          Fin de mois = veille du salaire. Cliquer un mois règle l’effort pour
          être au-dessus de zéro dès ce mois-là.
        </p>
      </CardShell>

      <MoneyTable ledger={ledger} path={path} settings={settings} save={save} />
    </>
  );
}

function MoneyTable({
  ledger,
  path,
  settings,
  save,
}: {
  ledger: Ledger;
  path: Trajectory;
  settings: PlanSettings;
  save: Save;
}) {
  const [adding, setAdding] = useState(false);
  const months = path.months.map((m) => m.key);
  const fixedTotal = path.fixed.reduce((n, f) => n + f.monthly, 0);
  const setEnd = (key: string, v: string) => {
    const ends = { ...settings.ends };
    if (v === "always") delete ends[key];
    else ends[key] = v;
    void save({ ends });
  };
  const row = (line: Trajectory["fixed"][number], sign: 1 | -1) => (
    <tr key={line.key}>
      <td>
        <span className="plan-cell-name">
          <Logo ledger={ledger} name={line.merchant} />
          <span>
            {line.name}
            {line.manual && <small> · ajoutée à la main</small>}
          </span>
        </span>
      </td>
      <td>{line.account ? accountName(ledger, line.account) : "—"}</td>
      <td className="plan-num">{line.day ? `le ${line.day}` : "—"}</td>
      <td>
        {sign < 0 ? (
          <Picker
            label={`Fin de ${line.name}`}
            size="compact"
            variant="ghost"
            value={line.end ?? "always"}
            onValueChange={(v) =>
              line.manual
                ? void save({
                    extra: (settings.extra ?? []).map((e) =>
                      e.id === line.key
                        ? { ...e, end: v === "always" ? undefined : v }
                        : e,
                    ),
                  })
                : setEnd(line.key, v)
            }
            options={[
              { value: "always", label: "Chaque mois" },
              ...months.map((m) => ({
                value: m,
                label: `Jusqu’à ${month(m)}`,
              })),
            ]}
          />
        ) : (
          "Chaque mois"
        )}
      </td>
      <td className="plan-num">
        <Money value={sign * line.monthly} tone="auto" />
        {line.manual && (
          <IconButton
            label={`Retirer ${line.name}`}
            icon={<X size={14} aria-hidden />}
            onClick={() =>
              void save(
                {
                  extra: (settings.extra ?? []).filter(
                    (e) => e.id !== line.key,
                  ),
                },
                `${line.name} retirée`,
              )
            }
          />
        )}
      </td>
    </tr>
  );
  const subtotal = (label: string, value: number) => (
    <tr className="plan-subtotal">
      <td colSpan={4}>{label}</td>
      <td className="plan-num">
        <Money value={value} tone="auto" />
      </td>
    </tr>
  );
  const rest = path.income - fixedTotal - path.variable;
  return (
    <CardShell
      title="Ce qui entre et sort chaque mois"
      className="plan-fixed"
      actions={
        <Button
          size="s"
          icon={<Plus size={16} aria-hidden />}
          onClick={() => setAdding(true)}
        >
          Charge
        </Button>
      }
    >
      <div className="plan-table-wrap">
        <table className="plan-table plan-money">
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Compte</th>
              <th className="plan-num">Jour</th>
              <th>Durée</th>
              <th className="plan-num">Par mois</th>
            </tr>
          </thead>
          <tbody>
            <tr className="plan-section">
              <th colSpan={5}>Revenus réguliers</th>
            </tr>
            {path.incomes.map((i) => row(i, 1))}
            {subtotal("Total des revenus", path.income)}
            <tr className="plan-section">
              <th colSpan={5}>Charges fixes</th>
            </tr>
            {path.fixed.map((f) => row(f, -1))}
            {adding && (
              <AddCharge
                settings={settings}
                save={save}
                onDone={() => setAdding(false)}
              />
            )}
            {subtotal("Total des charges fixes", -fixedTotal)}
            <tr className="plan-section">
              <th colSpan={5}>Vie courante</th>
            </tr>
            <tr>
              <td colSpan={4}>
                Courses, restaurants, achats… (médiane des 3 derniers mois)
              </td>
              <td className="plan-num">
                <Money value={-path.variable} tone="auto" />
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4}>Reste chaque mois</th>
              <td className="plan-num">
                <Money value={rest} tone="auto" size="m" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </CardShell>
  );
}

function AddCharge({
  settings,
  save,
  onDone,
}: {
  settings: PlanSettings;
  save: Save;
  onDone(): void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!name.trim() || !cents) return;
    await save(
      {
        extra: [
          ...(settings.extra ?? []),
          {
            id: `extra:${crypto.randomUUID()}`,
            name: name.trim(),
            monthly: Math.abs(cents),
          },
        ],
      },
      `${name.trim()} ajoutée`,
    );
    onDone();
  };
  return (
    <tr>
      <td colSpan={5}>
        <form
          className="plan-add"
          onSubmit={submit}
          onKeyDown={(e) => e.key === "Escape" && onDone()}
        >
          <input
            autoFocus
            aria-label="Libellé de la charge"
            placeholder="Impôt sur le revenu"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            aria-label="Montant par mois"
            placeholder="854"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button type="submit" size="s" variant="primary">
            Ajouter
          </Button>
          <Button size="s" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        </form>
      </td>
    </tr>
  );
}

const modeOptions: { value: ShareMode; label: string }[] = [
  { value: "income", label: "Selon revenus" },
  { value: "half", label: "50 / 50" },
  { value: "me", label: "100 % moi" },
  { value: "partner", label: "100 % elle" },
  { value: "personal", label: "Chacun le sien" },
];

function Split({
  ledger,
  who,
  settings,
  save,
}: {
  ledger: Ledger;
  who: People;
  settings: PlanSettings;
  save: Save;
}) {
  const me = accountName(ledger, who.me);
  const partner = accountName(ledger, who.partner);
  const s = settlement(ledger, settings, who);
  const usual = s.usual.filter((g) => g.total > 0);
  const mode =
    settings.share === undefined
      ? "income"
      : settings.share === 0.5
        ? "half"
        : "custom";
  return (
    <CardShell title="Partage des charges" className="plan-split">
      <div className="plan-split-head">
        <div>
          <span className="eyebrow">Clé de partage</span>
          <p className="plan-split-key">
            {me} {pct(who.share)} · {partner} {pct(1 - who.share)}
          </p>
          <dl className="plan-rows plan-salaries">
            {[
              [who.me, who.meIncome],
              [who.partner, who.partnerIncome],
            ].map(([account, income]) => {
              const id = String(account);
              const detected = detectedSalary(ledger, id);
              const manual = settings.incomes?.[id] !== undefined;
              return (
                <Fragment key={id}>
                  <dt>
                    Salaire de {accountName(ledger, id)}
                    <small className="plan-muted">
                      {manual
                        ? `saisi · détecté ${formatEuro(detected)}`
                        : "détecté sur le dernier relevé"}
                    </small>
                  </dt>
                  <dd>
                    <EditableMoney
                      label={`Salaire de référence de ${accountName(ledger, id)}`}
                      value={Number(income)}
                      allowEmpty
                      onCommit={(v) => {
                        const incomes = { ...settings.incomes };
                        if (v === null) delete incomes[id];
                        else incomes[id] = Math.abs(v);
                        return save(
                          { incomes },
                          "Salaire de référence enregistré",
                        );
                      }}
                    />
                  </dd>
                </Fragment>
              );
            })}
          </dl>
        </div>
        <div className="plan-split-controls">
          <Segmented
            label="Clé de partage"
            size="compact"
            value={mode}
            onChange={(v) =>
              void save({
                share:
                  v === "income" ? undefined : v === "half" ? 0.5 : who.share,
              })
            }
            options={[
              { value: "income", label: "Revenus" },
              { value: "half", label: "50 / 50" },
              { value: "custom", label: "Réglage" },
            ]}
          />
          {mode === "custom" && (
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(who.share * 100)}
              onChange={(e) =>
                void save({ share: Number(e.target.value) / 100 })
              }
              aria-label={`Part de ${me}`}
              aria-valuetext={`${me} ${pct(who.share)}`}
            />
          )}
        </div>
      </div>

      <div className="plan-transfer">
        <div>
          <span className="eyebrow">Chaque mois</span>
          <p className="plan-transfer-amount">
            {s.usualOwed >= 0 ? `${partner} → ${me}` : `${me} → ${partner}`}{" "}
            <Money value={Math.abs(s.usualOwed)} size="l" tone="none" />
          </p>
          <span className="plan-muted">
            Moyenne des 3 derniers mois sur les charges partagées
          </span>
        </div>
        <div className="plan-transfer-month">
          <span className="eyebrow">{month(s.month)}</span>
          <dl className="plan-rows">
            <dt>Part juste à ce jour</dt>
            <dd>
              <Money value={s.owed} tone="none" />
            </dd>
            <dt>Déjà versé par {partner}</dt>
            <dd>
              <Money value={s.received} tone="none" />
            </dd>
            <dt>Demandé ce mois</dt>
            <dd>
              <EditableMoney
                label={`Montant demandé à ${partner} en ${month(s.month)}`}
                value={s.asked}
                allowEmpty
                onCommit={(v) => {
                  const caps = { ...settings.caps };
                  if (v === null) delete caps[s.month];
                  else caps[s.month] = v;
                  return save({ caps }, "Montant demandé enregistré");
                }}
              />
            </dd>
            <dt>Avancé par {me}</dt>
            <dd>
              <Money value={s.advanced} tone="none" />
            </dd>
          </dl>
        </div>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th>Charge</th>
            <th>Par mois</th>
            <th>Payé {me}</th>
            <th>Payé {partner}</th>
            <th>Répartition</th>
          </tr>
        </thead>
        <tbody>
          {usual.map((g) => (
            <tr key={g.group} data-personal={g.share === null || undefined}>
              <td>{g.group}</td>
              <td>
                <Money value={g.total} tone="none" />
              </td>
              <td>
                <Money value={g.paidMe} tone="none" />
              </td>
              <td>
                <Money value={g.paidPartner} tone="none" />
              </td>
              <td>
                <Picker
                  label={`Répartition de ${g.group}`}
                  size="compact"
                  variant="ghost"
                  value={g.mode === "custom" ? "income" : g.mode}
                  onValueChange={(v) =>
                    void save({ modes: { ...settings.modes, [g.group]: v } })
                  }
                  options={modeOptions}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardShell>
  );
}

function Allowances({
  ledger,
  who,
  path,
  settings,
  save,
}: {
  ledger: Ledger;
  who: People;
  path: Trajectory;
  settings: PlanSettings;
  save: Save;
}) {
  const toast = useToast();
  const s = settlement(ledger, settings, who);
  return (
    <div className="plan-people">
      {[who.me, who.partner].map((account) => {
        const name = accountName(ledger, account);
        const rows = allowances(ledger, settings, account, path.weeklyVariable);
        const total = rows.reduce((n, r) => n + r.limit, 0);
        const message = [
          `Cette semaine pour ${name} :`,
          ...rows
            .filter((r) => r.limit > 0)
            .map((r) => `• ${r.category} : ${formatEuro(r.limit)}${times(r)}`),
          `Total : ${formatEuro(total)}.`,
          ...(account === who.partner && s.asked
            ? [
                `Virement vers ${accountName(ledger, who.me)} ce mois : ${formatEuro(s.asked)}.`,
              ]
            : []),
        ].join("\n");
        return (
          <CardShell
            key={account}
            title={`Semaine de ${name}`}
            actions={
              <Button
                size="s"
                icon={<Copy size={16} aria-hidden />}
                onClick={() =>
                  void navigator.clipboard.writeText(message).then(
                    () => toast.show({ message: "Message copié" }),
                    () => toast.error(new Error("Copie impossible")),
                  )
                }
              >
                Copier
              </Button>
            }
            footer={
              <p className="plan-muted">
                {formatEuro(total)} / semaine · dépenses personnelles hors
                charges partagées
              </p>
            }
          >
            {rows.length ? (
              <ul className="plan-list">
                {rows.map((r) => (
                  <li key={r.category}>
                    <span>
                      {r.category}
                      <small>
                        {formatEuro(r.spent)} dépensés · d’habitude{" "}
                        {formatEuro(r.usual)}
                        {times(r)}
                      </small>
                    </span>
                    <span
                      className="plan-meter"
                      data-over={r.spent > r.limit || undefined}
                    >
                      <span
                        style={{
                          width: `${Math.min(100, r.limit ? (r.spent / r.limit) * 100 : r.spent ? 100 : 0)}%`,
                        }}
                      />
                    </span>
                    <EditableMoney
                      label={`Limite ${r.category} pour ${name}`}
                      value={r.limit}
                      onCommit={(v) =>
                        save(
                          {
                            allowances: {
                              ...settings.allowances,
                              [account]: {
                                ...settings.allowances?.[account],
                                [r.category]: v ?? r.suggested,
                              },
                            },
                          },
                          `Limite ${r.category} : ${formatEuro(v ?? r.suggested)}`,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Aucune dépense personnelle récente</Empty>
            )}
          </CardShell>
        );
      })}
    </div>
  );
}

/** « ≈ 2 × 13 € » — how many usual purchases the limit allows. */
function times(r: { limit: number; ticket: number }) {
  if (!r.ticket) return "";
  const count = Math.floor(r.limit / r.ticket);
  return count
    ? ` (≈ ${count} × ${formatEuro(r.ticket)})`
    : ` (moins qu’un achat habituel de ${formatEuro(r.ticket)})`;
}
