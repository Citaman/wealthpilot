import { Copy } from "lucide-react";
import type { PageProps } from "../../app/App";
import { useToast } from "../../app/toast";
import { patchPreferences } from "../../data/commands";
import { usePreferences } from "../../data/hooks";
import { formatMonth } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import { formatEuro } from "../../domain/money";
import {
  allowances,
  people,
  scenarios,
  settlement,
  trajectory,
  type People,
  type PlanSettings,
  type Pressure,
  type ShareMode,
  type Trajectory,
} from "../../domain/plan";
import { Badge } from "../../ui/Badge";
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
      <Recovery path={path} settings={settings} save={save} />
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
  path,
  settings,
  save,
}: {
  path: Trajectory;
  settings: PlanSettings;
  save: Save;
}) {
  const effort = settings.effort ?? 0;
  const firstPositive = path.months.find((m) => m.withEffort >= 0);
  const now = path.months[0];
  const max = Math.max(
    1,
    ...path.months.flatMap((m) => [Math.abs(m.end), Math.abs(m.withEffort)]),
  );
  const sliderMax = Math.max(5000, Math.ceil(path.weeklyVariable / 500) * 500);
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
                : "Encore sous zéro dans 6 mois"}
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
              onChange={(e) => void save({ effort: Number(e.target.value) })}
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

      <CardShell title="Mois par mois" className="plan-months">
        <div
          className="plan-bars"
          role="img"
          aria-label="Solde du foyer en fin de mois, avec et sans effort"
        >
          {path.months.map((m) => (
            <div key={m.key} className="plan-bar">
              <Money value={m.withEffort} size="s" tone="auto" cents="never" />
              <div className="plan-bar-track">
                <span
                  className="plan-bar-fill"
                  data-negative={m.withEffort < 0 || undefined}
                  style={
                    {
                      "--h": `${(Math.abs(m.withEffort) / max) * 50}%`,
                    } as React.CSSProperties
                  }
                />
                {effort > 0 && (
                  <span
                    className="plan-bar-base"
                    style={
                      {
                        "--y": `${50 - (m.end / max) * 50}%`,
                      } as React.CSSProperties
                    }
                    title={`Sans effort : ${formatEuro(m.end)}`}
                  />
                )}
              </div>
              <span className="plan-bar-label">
                <span className="plan-long">{month(m.key)}</span>
                <span className="plan-short">{month(m.key).slice(0, 3)}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="plan-muted">
          Fin de mois = veille du salaire. Le trait montre le solde sans effort.
        </p>
      </CardShell>

      <CardShell title="Scénarios" className="plan-scenarios">
        <ul className="plan-list">
          {scenarios(path).map((s) => {
            const [label, tone] = pressureLabel[s.pressure];
            return (
              <li key={s.key}>
                <span>
                  ≥ 0 fin {month(s.key)}
                  <small>
                    {s.weekly
                      ? `${formatEuro(s.weekly)} / semaine`
                      : "sans effort"}
                  </small>
                </span>
                <Badge tone={tone}>{label}</Badge>
                <Button
                  size="s"
                  variant={s.weekly === settings.effort ? "primary" : "outline"}
                  disabledReason={
                    s.pressure === "impossible"
                      ? "Plus de la moitié des dépenses variables"
                      : undefined
                  }
                  onClick={() =>
                    void save(
                      { effort: s.weekly },
                      `Effort réglé à ${formatEuro(s.weekly)} / semaine`,
                    )
                  }
                >
                  Choisir
                </Button>
              </li>
            );
          })}
        </ul>
      </CardShell>

      <CardShell
        title="Ce qui entre et sort chaque mois"
        className="plan-fixed"
      >
        <dl className="plan-rows">
          <dt>Revenus réguliers</dt>
          <dd>
            <Money value={path.income} signed tone="auto" />
          </dd>
          {path.fixed.map((f) => (
            <FixedRow
              key={f.key}
              charge={f}
              months={path.months.map((m) => m.key)}
              settings={settings}
              save={save}
            />
          ))}
          <dt>Dépenses variables (médiane 3 mois)</dt>
          <dd>
            <Money value={-path.variable} tone="auto" />
          </dd>
        </dl>
      </CardShell>
    </>
  );
}

function FixedRow({
  charge,
  months,
  settings,
  save,
}: {
  charge: Trajectory["fixed"][number];
  months: string[];
  settings: PlanSettings;
  save: Save;
}) {
  return (
    <>
      <dt>
        {charge.name}
        <Picker
          label={`Fin de ${charge.name}`}
          size="compact"
          variant="ghost"
          value={charge.end ?? "always"}
          onValueChange={(v) => {
            const ends = { ...settings.ends };
            if (v === "always") delete ends[charge.key];
            else ends[charge.key] = v;
            void save({ ends });
          }}
          options={[
            { value: "always", label: "Chaque mois" },
            ...months.map((m) => ({ value: m, label: `Jusqu’à ${month(m)}` })),
          ]}
        />
      </dt>
      <dd>
        <Money value={-charge.monthly} tone="auto" />
      </dd>
    </>
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
          <span className="plan-muted">
            Salaires : {formatEuro(who.meIncome)} et{" "}
            {formatEuro(who.partnerIncome)}
          </span>
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
                          width: `${Math.min(100, r.limit ? (r.spent / r.limit) * 100 : 100)}%`,
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
