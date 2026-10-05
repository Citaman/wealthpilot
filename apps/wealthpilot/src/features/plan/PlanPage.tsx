import {
  ArrowRight,
  Ban,
  CalendarDays,
  ChartColumn,
  ChartSpline,
  Copy,
  Plus,
  Table2,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { PageProps } from "../../app/App";
import { useToast } from "../../app/toast";
import { dismissRecurrence, patchPreferences } from "../../data/commands";
import { usePreferences } from "../../data/hooks";
import { formatMonth } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import { formatEuro, parseMoney } from "../../domain/money";
import {
  allowances,
  detectedSalary,
  spendingGroups,
  type Allowance,
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
import { categoryColor } from "../../domain/categories";
import { Badge } from "../../ui/Badge";
import { DivergingBars } from "../../ui/charts/DivergingBars";
import { LineChart } from "../../ui/charts/LineChart";
import { IconButton } from "../../ui/IconButton";
import { Menu } from "../../ui/Menu";
import { CategoryLabel, groupText, splitGroup } from "../shared/CategoryLabel";
import { Logo } from "../shared/Logo";
import { Button } from "../../ui/Button";
import { CardShell, useCardWidth } from "../../ui/CardShell";
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

/** A slider keeps its own value while saves round-trip: fast keys or drags never jump back. */
function useSliderValue(stored: number) {
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => {
    if (draft === stored) setDraft(null);
  }, [draft, stored]);
  return [draft ?? stored, setDraft] as const;
}

/** Below this card width the money tables become stacked lists. */
const STACKED = 560;

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
  const [slider, setSlider] = useSliderValue(effort);
  const firstPositive = path.months.find((m) => m.withEffort >= 0);
  const now = path.months[0];
  const options = scenarios(path);
  const view = settings.view ?? "calendar";
  const date = (key: string) => `${key}-01`;
  const calendar = (
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
              aria-disabled={s.pressure === "impossible" || undefined}
              title={
                s.pressure === "impossible"
                  ? "Plus de la moitié des dépenses variables"
                  : `Être au-dessus de zéro dès fin ${month(m.key)}`
              }
              onClick={() => s.pressure !== "impossible" && void choose(s)}
            >
              <span className="plan-month-name">
                {month(m.key)}
                {m.key.slice(0, 4) !== path.months[0].key.slice(0, 4) &&
                  ` ${m.key.slice(0, 4)}`}
              </span>
              <Money value={m.withEffort} size="s" tone="auto" cents="never" />
              {effort > 0 && (
                <span className="plan-muted">
                  sans effort {formatEuro(m.end, { cents: "never" })}
                </span>
              )}
              <span className="plan-month-need">
                {s.weekly ? `${formatEuro(s.weekly)} / sem.` : "sans effort"}
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
  );
  const line = (
    <LineChart
      label="Solde du foyer en fin de mois"
      height={260}
      threshold={{ value: 0, label: "Zéro" }}
      series={[
        {
          id: "effort",
          label: "Avec effort",
          kind: "observed",
          points: path.months.map((m) => ({
            date: date(m.key),
            value: m.withEffort,
          })),
        },
        ...(effort > 0
          ? [
              {
                id: "base",
                label: "Sans effort",
                kind: "context" as const,
                points: path.months.map((m) => ({
                  date: date(m.key),
                  value: m.end,
                })),
              },
            ]
          : []),
      ]}
      describe={(d) => `Fin ${month(d.slice(0, 7))}`}
    />
  );
  const bars = (
    <DivergingBars
      label="Solde du foyer en fin de mois"
      data={path.months.map((m) => ({
        key: m.key,
        label: month(m.key).slice(0, 3),
        title: month(m.key),
        income: Math.max(0, m.withEffort),
        spending: Math.max(0, -m.withEffort),
      }))}
      onSelect={(key) => {
        const s = options.find((o) => o.key === key);
        if (s) void choose(s);
      }}
    />
  );
  const table = (
    <div className="plan-table-wrap">
      <table className="plan-table plan-money">
        <thead>
          <tr>
            <th>Fin de mois</th>
            <th className="plan-num">Sans effort</th>
            <th className="plan-num">Avec effort</th>
            <th className="plan-num">Effort pour y être ≥ 0</th>
            <th>Pression</th>
          </tr>
        </thead>
        <tbody>
          {path.months.map((m, i) => (
            <tr
              key={m.key}
              data-selected={settings.target === m.key || undefined}
            >
              <td>
                {month(m.key)} {m.key.slice(0, 4)}
              </td>
              <td className="plan-num">
                <Money value={m.end} tone="auto" cents="never" />
              </td>
              <td className="plan-num">
                <Money value={m.withEffort} tone="auto" cents="never" />
              </td>
              <td className="plan-num">
                {options[i].weekly
                  ? `${formatEuro(options[i].weekly)} / sem.`
                  : "—"}
              </td>
              <td>
                <Badge tone={pressureLabel[options[i].pressure][1]}>
                  {pressureLabel[options[i].pressure][0]}
                </Badge>
                {options[i].recommended && <Badge tone="new">Recommandé</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
            <strong>{formatEuro(slider)} / semaine</strong>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={500}
              value={slider}
              onChange={(e) => {
                const next = Number(e.target.value);
                setSlider(next);
                void save({ effort: next, target: undefined });
              }}
              aria-valuetext={`${formatEuro(slider)} par semaine`}
            />
            <span className="plan-muted">
              {path.weeklyVariable
                ? `${pct(slider / path.weeklyVariable)} des dépenses variables (${formatEuro(path.weeklyVariable)} / sem.)`
                : "Pas assez d’historique pour les dépenses variables"}
            </span>
          </label>
        </div>
      </CardShell>

      <CardShell
        title="Mois par mois"
        className="plan-months"
        actions={
          <>
            <Segmented
              label="Vue"
              size="compact"
              value={view}
              onChange={(v) => void save({ view: v })}
              options={[
                {
                  value: "calendar",
                  label: <CalendarDays size={16} aria-hidden />,
                  ariaLabel: "Calendrier",
                },
                {
                  value: "line",
                  label: <ChartSpline size={16} aria-hidden />,
                  ariaLabel: "Courbe",
                },
                {
                  value: "bars",
                  label: <ChartColumn size={16} aria-hidden />,
                  ariaLabel: "Barres",
                },
                {
                  value: "table",
                  label: <Table2 size={16} aria-hidden />,
                  ariaLabel: "Tableau",
                },
              ]}
            />
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
          </>
        }
      >
        {view === "calendar"
          ? calendar
          : view === "line"
            ? line
            : view === "bars"
              ? bars
              : table}
        <p
          className="plan-muted"
          title="Choisir un mois règle l’effort pour être au-dessus de zéro dès ce mois-là"
        >
          Fin de mois = veille du salaire
        </p>
      </CardShell>

      <MoneyTable ledger={ledger} path={path} settings={settings} save={save} />
    </>
  );
}

interface MoneyLine {
  line: Trajectory["fixed"][number];
  sign: 1 | -1;
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
  return (
    <CardShell
      title="Ce qui entre et sort chaque mois"
      className="plan-fixed"
      actions={
        <Button
          size="s"
          icon={<Plus size={16} aria-hidden />}
          aria-expanded={adding}
          onClick={() => setAdding(true)}
        >
          Charge
        </Button>
      }
    >
      <MoneyLines
        ledger={ledger}
        path={path}
        settings={settings}
        save={save}
        adding={
          adding && (
            <AddCharge
              settings={settings}
              save={save}
              onDone={() => setAdding(false)}
            />
          )
        }
      />
    </CardShell>
  );
}

/** Table on wide cards; on narrow ones a stacked list where the amount always stays in view. */
function MoneyLines({
  ledger,
  path,
  settings,
  save,
  adding,
}: {
  ledger: Ledger;
  path: Trajectory;
  settings: PlanSettings;
  save: Save;
  adding: ReactNode;
}) {
  const { width } = useCardWidth();
  const stacked = width > 0 && width < STACKED;
  const toast = useToast();
  const months = path.months.map((m) => m.key);
  const fixedTotal = path.fixed.reduce((n, f) => n + f.monthly, 0);
  const rest = path.income - fixedTotal - path.variable;
  const setEnd = (key: string, v: string) => {
    const ends = { ...settings.ends };
    if (v === "always") delete ends[key];
    else ends[key] = v;
    void save({ ends });
  };

  const name = ({ line }: MoneyLine) => (
    <span className="plan-cell-name">
      <Logo ledger={ledger} name={line.merchant} category={line.category} />
      <span>
        {line.name}
        {line.manual && <small> · ajoutée à la main</small>}
      </span>
    </span>
  );
  const account = ({ line }: MoneyLine) =>
    line.account ? accountName(ledger, line.account) : "—";
  const day = ({ line }: MoneyLine) => (line.day ? `le ${line.day}` : "—");
  const duration = ({ line, sign }: MoneyLine) =>
    sign < 0 ? (
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
    );
  const amount = ({ line, sign }: MoneyLine) => (
    <>
      <Money value={sign * line.monthly} tone="auto" signed={sign > 0} />
      {line.manual ? (
        <IconButton
          label={`Retirer ${line.name}`}
          icon={<X size={14} aria-hidden />}
          onClick={() =>
            void save(
              {
                extra: (settings.extra ?? []).filter((e) => e.id !== line.key),
              },
              `${line.name} retirée`,
            )
          }
        />
      ) : (
        <IconButton
          label={`Arrêter ${line.name}`}
          title={`${line.name} n’existe plus : ne plus la compter`}
          icon={<Ban size={14} aria-hidden />}
          onClick={async () => {
            try {
              toast.undoable(
                `${line.name} arrêtée`,
                await dismissRecurrence(line.key),
              );
            } catch (e) {
              toast.error(e);
            }
          }}
        />
      )}
    </>
  );

  const incomes = path.incomes.map((line) => ({ line, sign: 1 as const }));
  const charges = path.fixed.map((line) => ({ line, sign: -1 as const }));
  const variable =
    "Courses, restaurants, achats… (médiane des 3 derniers mois)";

  if (stacked)
    return (
      <div className="plan-stack plan-money-list">
        <StackSection
          title="Revenus réguliers"
          total={["Total des revenus", path.income]}
        >
          {incomes.map((l) => (
            <li key={l.line.key} className="plan-stack-row">
              {name(l)}
              <span className="plan-stack-amount">{amount(l)}</span>
              <span className="plan-stack-meta">
                {account(l)} · {day(l)} · Chaque mois
              </span>
            </li>
          ))}
        </StackSection>
        <StackSection
          title="Charges fixes"
          total={["Total des charges fixes", -fixedTotal]}
          after={adding}
        >
          {charges.map((l) => (
            <li key={l.line.key} className="plan-stack-row">
              {name(l)}
              <span className="plan-stack-amount">{amount(l)}</span>
              <span className="plan-stack-meta">
                {account(l)} · {day(l)} · {duration(l)}
              </span>
            </li>
          ))}
        </StackSection>
        <StackSection title="Vie courante">
          <li className="plan-stack-row">
            <span>{variable}</span>
            <span className="plan-stack-amount">
              <Money value={-path.variable} tone="auto" />
            </span>
          </li>
        </StackSection>
        <p className="plan-stack-rest">
          <span>Reste chaque mois</span>
          <Money value={rest} tone="auto" size="m" signed={rest > 0} />
        </p>
      </div>
    );

  const row = (l: MoneyLine) => (
    <tr key={l.line.key}>
      <td>{name(l)}</td>
      <td>{account(l)}</td>
      <td className="plan-num">{day(l)}</td>
      <td>{duration(l)}</td>
      <td className="plan-num">{amount(l)}</td>
    </tr>
  );
  const subtotal = (label: string, value: number) => (
    <tr className="plan-subtotal">
      <td colSpan={4}>{label}</td>
      <td className="plan-num">
        <Money value={value} tone="auto" signed={value > 0} />
      </td>
    </tr>
  );
  return (
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
          {incomes.map(row)}
          {subtotal("Total des revenus", path.income)}
          <tr className="plan-section">
            <th colSpan={5}>Charges fixes</th>
          </tr>
          {charges.map(row)}
          {adding && (
            <tr>
              <td colSpan={5}>{adding}</td>
            </tr>
          )}
          {subtotal("Total des charges fixes", -fixedTotal)}
          <tr className="plan-section">
            <th colSpan={5}>Vie courante</th>
          </tr>
          <tr>
            <td colSpan={4}>{variable}</td>
            <td className="plan-num">
              <Money value={-path.variable} tone="auto" />
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4}>Reste chaque mois</th>
            <td className="plan-num">
              <Money value={rest} tone="auto" size="m" signed={rest > 0} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StackSection({
  title,
  total,
  after,
  children,
}: {
  title: string;
  total?: [string, number];
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="plan-stack-section" aria-label={title}>
      <h3 className="plan-stack-title">{title}</h3>
      <ul className="plan-stack-rows">{children}</ul>
      {after}
      {total && (
        <p className="plan-stack-total">
          <span>{total[0]}</span>
          <Money value={total[1]} tone="auto" signed={total[1] > 0} />
        </p>
      )}
    </section>
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
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!name.trim()) return setError("Libellé requis");
    if (!cents) return setError("Montant invalide");
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
    <form
      className="plan-add"
      aria-label="Nouvelle charge"
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onDone()}
    >
      <input
        autoFocus
        aria-label="Libellé de la charge"
        aria-invalid={error === "Libellé requis" || undefined}
        placeholder="Impôt sur le revenu"
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      <input
        aria-label="Montant par mois"
        aria-invalid={error === "Montant invalide" || undefined}
        placeholder="854"
        inputMode="decimal"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setError(null);
        }}
      />
      <Button type="submit" size="s" variant="primary">
        Ajouter
      </Button>
      <Button size="s" variant="ghost" onClick={onDone}>
        Annuler
      </Button>
      {error && (
        <span className="plan-add-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

const modeOptions = (
  me: string,
  partner: string,
): { value: ShareMode; label: string }[] => [
  { value: "income", label: "Selon revenus" },
  { value: "half", label: "50 / 50" },
  { value: "me", label: `100 % ${me}` },
  { value: "partner", label: `100 % ${partner}` },
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
  // « Réglage » stays chosen even when the slider passes through 50 %.
  const [tuning, setTuning] = useState(false);
  const [share, setShare] = useSliderValue(Math.round(who.share * 100));
  const mode =
    settings.share === undefined
      ? "income"
      : tuning || settings.share !== 0.5
        ? "custom"
        : "half";
  return (
    <CardShell title="Partage des charges" className="plan-split">
      <div className="plan-key">
        <div className="plan-key-head">
          <span className="eyebrow">Clé de partage</span>
          <Segmented
            label="Clé de partage"
            size="compact"
            value={mode}
            onChange={(v) => {
              setTuning(v === "custom");
              void save({
                share:
                  v === "income" ? undefined : v === "half" ? 0.5 : who.share,
              });
            }}
            options={[
              { value: "income", label: "Revenus" },
              { value: "half", label: "50 / 50" },
              { value: "custom", label: "Réglage" },
            ]}
          />
        </div>
        <div className="plan-key-bar" aria-hidden>
          <span style={{ flexGrow: share }}>
            {me} {share} %
          </span>
          <span style={{ flexGrow: 100 - share }}>
            {partner} {100 - share} %
          </span>
        </div>
        {mode === "custom" && (
          <input
            type="range"
            min={0}
            max={100}
            value={share}
            onChange={(e) => {
              const next = Number(e.target.value);
              setShare(next);
              void save({ share: next / 100 });
            }}
            aria-label={`Part de ${me}`}
            aria-valuetext={`${me} ${share} %`}
          />
        )}
        <div className="plan-key-salaries">
          {[who.me, who.partner].map((id) => {
            const income = id === who.me ? who.meIncome : who.partnerIncome;
            const manual = settings.incomes?.[id] !== undefined;
            return (
              <span
                key={id}
                title={
                  manual
                    ? `Saisi · détecté ${formatEuro(detectedSalary(ledger, id))}`
                    : "Dernier salaire détecté"
                }
              >
                {accountName(ledger, id)}
                <EditableMoney
                  label={`Salaire de référence de ${accountName(ledger, id)}`}
                  value={income}
                  allowEmpty
                  onCommit={(v) => {
                    const incomes = { ...settings.incomes };
                    if (v === null) delete incomes[id];
                    else incomes[id] = Math.abs(v);
                    return save({ incomes }, "Salaire de référence enregistré");
                  }}
                />
                {manual && <Badge tone="neutral">saisi</Badge>}
              </span>
            );
          })}
        </div>
      </div>

      <Settle ledger={ledger} who={who} settings={settings} save={save} />

      <SplitLines
        ledger={ledger}
        groups={usual}
        me={me}
        partner={partner}
        settings={settings}
        save={save}
      />
    </CardShell>
  );
}

/** Charges paid per person and their split mode; stacked on narrow cards. */
function SplitLines({
  ledger,
  groups,
  me,
  partner,
  settings,
  save,
}: {
  ledger: Ledger;
  groups: ReturnType<typeof settlement>["usual"];
  me: string;
  partner: string;
  settings: PlanSettings;
  save: Save;
}) {
  const { width } = useCardWidth();
  const name = (group: string) => (
    <span className="plan-cell-name">
      <Logo ledger={ledger} name={group} {...splitGroup(group)} size={28} />
      <CategoryLabel ledger={ledger} {...splitGroup(group)} icon={false} />
    </span>
  );
  const picker = (g: (typeof groups)[number]) => (
    <Picker
      label={`Répartition de ${groupText(g.group)}`}
      size="compact"
      variant="ghost"
      value={g.mode === "custom" ? "income" : g.mode}
      onValueChange={(v) =>
        void save({ modes: { ...settings.modes, [g.group]: v } })
      }
      options={modeOptions(me, partner)}
    />
  );
  if (width > 0 && width < STACKED)
    return (
      <ul className="plan-stack-rows plan-split-list">
        {groups.map((g) => (
          <li
            key={g.group}
            className="plan-stack-row"
            data-personal={g.share === null || undefined}
          >
            {name(g.group)}
            <span className="plan-stack-amount">
              <Money value={g.total} tone="none" />
            </span>
            <span className="plan-stack-meta">
              {me} {formatEuro(g.paidMe)} · {partner}{" "}
              {formatEuro(g.paidPartner)}
            </span>
            <span className="plan-stack-control">{picker(g)}</span>
          </li>
        ))}
      </ul>
    );
  return (
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
        {groups.map((g) => (
          <tr key={g.group} data-personal={g.share === null || undefined}>
            <td>{name(g.group)}</td>
            <td>
              <Money value={g.total} tone="none" />
            </td>
            <td>
              <Money value={g.paidMe} tone="none" />
            </td>
            <td>
              <Money value={g.paidPartner} tone="none" />
            </td>
            <td>{picker(g)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Splitwise-style settle-up: who pays whom this month, and how far along. */
function Settle({
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
  const fair = Math.max(0, s.owed);
  const paid = Math.min(s.received, fair);
  const askedLeft = Math.max(0, Math.min(fair, s.asked ?? 0) - paid);
  const advanced = Math.max(0, fair - paid - askedLeft);
  const total = Math.max(1, fair);
  const from = s.owed >= 0 ? partner : me;
  const to = s.owed >= 0 ? me : partner;
  return (
    <div className="plan-settle">
      <span className="eyebrow">{month(s.month)} · à régler</span>
      <p className="plan-settle-amount">
        {from} <ArrowRight size={20} aria-hidden /> {to}
        <Money value={Math.abs(s.owed)} size="l" tone="none" />
      </p>
      <div
        className="plan-settle-bar"
        role="img"
        aria-label={`Versé ${formatEuro(s.received)}, demandé ${formatEuro(s.asked ?? 0)}, avancé ${formatEuro(advanced)}`}
      >
        <span data-part="paid" style={{ flexGrow: paid / total }} />
        <span data-part="asked" style={{ flexGrow: askedLeft / total }} />
        <span data-part="advanced" style={{ flexGrow: advanced / total }} />
      </div>
      <dl className="plan-settle-legend">
        <div data-part="paid">
          <dt>Versé</dt>
          <dd>
            <Money value={s.received} tone="none" />
          </dd>
        </div>
        <div data-part="asked">
          <dt>Demandé</dt>
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
        </div>
        <div data-part="advanced">
          <dt>Avancé par {me}</dt>
          <dd>
            <Money value={advanced} tone="none" />
          </dd>
        </div>
      </dl>
      <p className="plan-muted">
        ≈ {formatEuro(Math.abs(s.usualOwed), { cents: "never" })} par mois en
        moyenne (3 derniers mois)
      </p>
    </div>
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
  const colorOf = (key: string) =>
    categoryColor(key.split(" · ")[0], ledger.prefs.categoryDefinitions);
  /** Its money goes to the remaining lines, in proportion to their limits. */
  const remove = (account: string, rows: Allowance[], line: Allowance) => {
    const others = rows.filter((x) => x !== line);
    const sum = others.reduce((n, x) => n + x.limit, 0);
    const limits = { ...settings.allowances?.[account] };
    for (const o of others)
      limits[o.category] =
        o.limit +
        Math.round(
          (line.limit * (sum ? o.limit / sum : 1 / others.length)) / 100,
        ) *
          100;
    delete limits[line.category];
    return save(
      {
        hidden: {
          ...settings.hidden,
          [account]: [...(settings.hidden?.[account] ?? []), line.category],
        },
        added: {
          ...settings.added,
          [account]: (settings.added?.[account] ?? []).filter(
            (k) => k !== line.category,
          ),
        },
        allowances: { ...settings.allowances, [account]: limits },
      },
      line.limit
        ? `${groupText(line.category)} retirée · ${formatEuro(line.limit)} réparti sur les autres`
        : `${groupText(line.category)} retirée`,
    );
  };
  const add = (account: string, key: string) =>
    save(
      {
        added: {
          ...settings.added,
          [account]: [...(settings.added?.[account] ?? []), key],
        },
        hidden: {
          ...settings.hidden,
          [account]: (settings.hidden?.[account] ?? []).filter(
            (k) => k !== key,
          ),
        },
      },
      `${groupText(key)} ajoutée`,
    );
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
            .map(
              (r) =>
                `• ${groupText(r.category)} : ${formatEuro(r.limit)}${times(r)}`,
            ),
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
              <>
                <Menu
                  label={`Ajouter une ligne à la semaine de ${name}`}
                  trigger={
                    <Button size="s" icon={<Plus size={16} aria-hidden />}>
                      Ligne
                    </Button>
                  }
                  items={spendingGroups(ledger, account)
                    .filter((k) => !rows.some((r) => r.category === k))
                    .map((k) => ({
                      label: groupText(k),
                      onSelect: () => void add(account, k),
                    }))}
                />
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
              </>
            }
            footer={
              <p className="plan-muted">
                {formatEuro(total)} / semaine · dépenses personnelles hors
                charges partagées
              </p>
            }
          >
            {total > 0 && (
              <div className="plan-mix" aria-hidden>
                {rows
                  .filter((r) => r.limit > 0)
                  .map((r) => (
                    <span
                      key={r.category}
                      title={`${groupText(r.category)} ${formatEuro(r.limit)}`}
                      style={{
                        flexGrow: r.limit,
                        background: colorOf(r.category),
                      }}
                    />
                  ))}
              </div>
            )}
            {rows.length ? (
              <ul className="plan-list">
                {rows.map((r) => (
                  <li
                    key={r.category}
                    style={
                      {
                        "--cat": colorOf(r.category),
                      } as React.CSSProperties
                    }
                  >
                    <Logo
                      ledger={ledger}
                      name={r.category}
                      {...splitGroup(r.category)}
                    />
                    <span className="plan-item">
                      <CategoryLabel
                        ledger={ledger}
                        {...splitGroup(r.category)}
                        icon={false}
                      />
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
                      label={`Limite ${groupText(r.category)} pour ${name}`}
                      value={r.limit}
                      validate={(v) => (v < 0 ? "Montant positif" : null)}
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
                          `Limite ${groupText(r.category)} : ${formatEuro(v ?? r.suggested)}`,
                        )
                      }
                    />
                    <IconButton
                      label={`Retirer ${groupText(r.category)} de la semaine de ${name}`}
                      icon={<X size={14} aria-hidden />}
                      onClick={() => void remove(account, rows, r)}
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
