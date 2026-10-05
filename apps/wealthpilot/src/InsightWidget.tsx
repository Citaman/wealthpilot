import { useState, useMemo } from "react";
import { categoryPalette } from "./visual";
import type { Snapshot, WidgetId, WidgetSize } from "./types";
import { widgetNames } from "./types";
import {
  euro,
  dateLabel,
  parseMoney,
  balanceAt,
  selectDashboard,
  today,
} from "./domain";
import { detectRecurrences } from "./intelligence";
import { Field, Notice } from "./ui";
import { DataViz, type VizItem } from "./DataViz";
import { PurchaseTool } from "./WeekPage";
import { forecastCash, weeklyPlan } from "./forecasting";
import { weekStart } from "./domain";
import {
  AccountHealth,
  SafetyThreshold,
  WeeklyEnvelopes,
} from "./NativeInsights";
import { cycleComparison, unusualExpenses } from "./financialWidgetData";
import { checkpointForDate } from "./coverage";
import { activeWidgetIds, isActiveWidget } from "./productScope";
type Data = ReturnType<typeof selectDashboard>;
export function InsightWidget({
  id,
  snapshot: s,
  d,
  month,
  from,
  account,
  size,
  configure,
  transactions,
  plan,
  navigate,
}: {
  id: WidgetId;
  snapshot: Snapshot;
  d: Data;
  month: string;
  from: string;
  account: string;
  size: WidgetSize;
  configure: () => void;
  transactions: (selection?: {
    transactionId?: string;
    transactionIds?: string[];
    review?: "uncategorized" | "unreviewed";
    category?: string;
  }) => void;
  goals: () => void;
  plan: () => void;
  navigate?: (page: string) => void;
}) {
  const [amount, setAmount] = useState(""),
    [incomeLoss, setIncomeLoss] = useState("");
  const categoryColors = useMemo(
    () => (id === "categories" ? categoryPalette(s) : undefined),
    [id, s],
  );
  const count =
    size === "tiny"
      ? 1
      : size === "small"
        ? 2
        : size === "medium"
          ? 5
          : size === "large"
            ? 8
            : 10;
  const tiny = size === "tiny";
  const compact = tiny || size === "small";
  const upcoming = d.projection.events.filter(
    (v) =>
      !v.transactionId &&
      (!account || v.account === account) &&
      v.date >= d.cutoff &&
      v.date <= d.horizon,
  );
  const expenseDue = upcoming
    .filter((v) => v.amount < 0 && !v.internal)
    .reduce((n, v) => n - v.amount, 0);
  const rows = d.rows.filter((t) => !t.internal && t.amount < 0);
  const sum = (n: number | null) => (n === null ? "À confirmer" : euro(n));
  const stats = (items: [string, string][]) => (
    <dl className="insight-stats">
      {items.slice(0, count).map(([label, value], i) => (
        <div key={label + i}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
  const bars = (items: VizItem[], visible = count) => {
    return (
      <DataViz
        items={items}
        limit={visible}
        widget={id}
        initial={s.preferences.widgetViews?.[id]}
        size={size}
        colors={categoryColors}
      />
    );
  };
  let content: React.ReactNode;
  switch (id) {
    case "goal":
    case "goals":
    case "goalDate":
    case "effort":
    case "savings":
      return null;
    case "balance":
      content = (
        <>
          <strong className="insight-value">{sum(d.balance)}</strong>
          <small>Solde au {dateLabel(d.cutoff)}</small>
          {size !== "tiny" &&
            bars(
              d.accounts
                .filter((a) => balanceAt(a, d.tx, d.cutoff) !== null)
                .map((a) => {
                  const anchor = checkpointForDate(a, d.cutoff);
                  return {
                    name: a.id,
                    value: balanceAt(a, d.tx, d.cutoff)!,
                    detail:
                      anchor && (size === "large" || size === "xlarge")
                        ? `Référence au ${dateLabel(anchor.date)}${size === "xlarge" ? ` · ${anchor.status === "derived" ? "reconstituée" : "solde enregistré"}` : ""}`
                        : undefined,
                  };
                }),
            )}
          {d.accounts.some((a) => balanceAt(a, d.tx, d.cutoff) === null) && (
            <p>
              Non représenté(s), solde inconnu :{" "}
              {d.accounts
                .filter((a) => balanceAt(a, d.tx, d.cutoff) === null)
                .map((a) => a.id)
                .join(", ")}
              .
            </p>
          )}
        </>
      );
      break;
    case "weekly": {
      const week = weeklyPlan(s, weekStart(today()), account);
      content = (
        <>
          <strong className="insight-value">
            {sum(
              week.capacity === null || week.status === "unconfigured"
                ? null
                : week.remaining,
            )}
          </strong>
          <small>
            {week.start} — {week.end} · {account || "Foyer"}
          </small>
          {week.capacity === null && (
            <Notice>
              Impossible de proposer une enveloppe sûre sans solde de référence
              :{" "}
              {s.accounts
                .filter(
                  (a) =>
                    (!account || a.id === account) &&
                    balanceAt(a, s.transactions, today()) === null,
                )
                .map((a) => a.id)
                .join(", ") || "aucun compte confirmé"}
              . Vérifiez les soldes sur la page Comptes.
            </Notice>
          )}
          {(size === "large" || size === "xlarge") &&
            week.capacity === null && (
              <ul>
                {week.forecast.warnings.slice(0, 4).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          {week.status === "unconfigured" && (
            <Notice>
              Choisissez Tous les comptes pour le plan du foyer, ou préparez un
              plan spécifique à ce compte.
            </Notice>
          )}
          {week.status === "estimated" && (
            <small>Proposition exploratoire à confirmer.</small>
          )}
          {!tiny &&
            stats([
              ["Déjà dépensé", euro(week.spent)],
              ["À payer", euro(week.committed)],
            ])}
          {!compact && <WeeklyEnvelopes week={week} size={size} />}
          <a
            className="text-button"
            href="#week"
            onClick={(event) => {
              if (navigate) {
                event.preventDefault();
                navigate("week");
              }
            }}
          >
            Préparer ma semaine
          </a>
        </>
      );
      break;
    }
    case "low":
      content = (
        <>
          <strong className="insight-value">{sum(d.low?.value ?? null)}</strong>
          <p>
            {d.low
              ? dateLabel(d.low.date)
              : "Sélectionnez une période incluant des jours futurs et confirmez les soldes."}
          </p>
          {!compact && (
            <small>
              Projection partielle : échéances saisies et estimées
              {account
                ? ", sans affecter les provisions du foyer à ce compte"
                : ", avec les essentiels ou enveloppes répartis à titre estimatif sur les jours restants"}
              .
            </small>
          )}
        </>
      );
      break;
    case "flows":
      content = tiny ? (
        <>
          <strong className="insight-value">
            {euro(d.income - d.spending)}
          </strong>
          <small>
            Flux net · {euro(d.income)} entrés, {euro(d.spending)} dépensés
          </small>
        </>
      ) : (
        bars([
          { name: "Entrées externes", value: d.income },
          { name: "Dépenses externes", value: d.spending },
          { name: "Net externe", value: d.income - d.spending },
        ])
      );
      break;
    case "scenario": {
      const saving = amount === "" ? 0 : parseMoney(amount);
      const loss = incomeLoss === "" ? 0 : parseMoney(incomeLoss);
      const delta =
        saving !== null && loss !== null && saving >= 0 && loss >= 0
          ? saving - loss
          : null;
      content = (
        <>
          <Field label="Charges mensuelles supprimées (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Revenus mensuels perdus (€)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={incomeLoss}
              onChange={(e) => setIncomeLoss(e.target.value)}
            />
          </Field>
          <strong className="insight-value">
            {delta === null
              ? "Montant invalide"
              : `${delta > 0 ? "+" : ""}${euro(delta)}`}
          </strong>
          <p>Variation de votre marge chaque mois.</p>
          {size !== "small" &&
            delta !== null &&
            stats([
              ["Effet sur 3 mois", euro(delta * 3)],
              ["Effet sur un an", euro(delta * 12)],
            ])}
          <small>
            Comparaison à activité identique, sans inflation ni intérêts. Ce
            n’est pas une prévision de solde ; vos opérations et budgets restent
            inchangés.
          </small>
        </>
      );
      break;
    }
    case "purchase": {
      content = compact ? (
        <>
          <p>Vérifiez un achat avant de le faire.</p>
          <a
            className="button"
            href="#week"
            onClick={(event) => {
              if (navigate) {
                event.preventDefault();
                navigate("week");
              }
            }}
          >
            Tester un achat
          </a>
        </>
      ) : (
        <PurchaseTool key={account} snapshot={s} account={account} />
      );
      break;
    }
    case "safety":
      content = (
        <>
          <SafetyThreshold
            minimum={s.preferences.safety}
            balance={d.balance}
            low={d.low ?? undefined}
            size={size}
            navigate={navigate}
          />
          <button className="text-button" onClick={plan}>
            Modifier le minimum
          </button>
        </>
      );
      break;
    case "accounts":
      content = (
        <AccountHealth
          snapshot={s}
          account={account}
          cutoff={d.cutoff}
          size={size}
          navigate={navigate}
          events={d.projection.events}
        />
      );
      break;
    case "charges":
      content = (
        <>
          <strong className="insight-value">{euro(expenseDue)}</strong>
          <small>Échéances restantes jusqu’au {dateLabel(d.horizon)}</small>
          {size !== "tiny" &&
            bars(
              upcoming
                .filter((v) => v.amount < 0 && !v.internal)
                .map((v) => ({
                  name: v.label,
                  value: -v.amount,
                  date: v.date,
                  detail: v.id.startsWith("known:")
                    ? "Importée à date future"
                    : v.estimated
                      ? "Estimée depuis la récurrence"
                      : "Saisie",
                })),
            )}
        </>
      );
      break;
    case "funding": {
      const accountFunding = d.accounts.map((a) => {
        const future = forecastCash(s, d.horizon, a.id, d.cutoff).points.filter(
          (point) => point.date > d.cutoff,
        );
        const projection = {
          balance: balanceAt(a, d.tx, d.cutoff),
          low: future.length
            ? future.reduce((low, point) =>
                point.value < low.value ? point : low,
              )
            : null,
        };
        return {
          a,
          projection,
          missing:
            projection.balance === null
              ? null
              : Math.max(
                  0,
                  -Math.min(
                    projection.balance,
                    projection.low?.value ?? projection.balance,
                  ),
                ),
        };
      });
      content = (
        <>
          {tiny ? (
            <>
              <strong className="insight-value">
                {accountFunding.some((v) => v.missing === null)
                  ? "À confirmer"
                  : euro(
                      accountFunding.reduce(
                        (sum, v) => sum + (v.missing ?? 0),
                        0,
                      ),
                    )}
              </strong>
              <small>
                {accountFunding.filter((v) => (v.missing ?? 0) > 0).length}{" "}
                compte(s) à approvisionner · prévision partielle
              </small>
            </>
          ) : (
            stats(
              accountFunding.map(({ a, projection: projectedAccount }) => {
                const b = projectedAccount.balance;
                if (b === null) return [a.id, "Solde à confirmer"];
                const minimum = Math.min(b, projectedAccount.low?.value ?? b);
                const lowDate =
                  projectedAccount.low && projectedAccount.low.value < b
                    ? projectedAccount.low.date
                    : d.cutoff;
                const needsReview = s.dues.some(
                  (v) =>
                    !v.transactionId &&
                    v.account === a.id &&
                    v.date <= d.cutoff,
                );
                return [
                  a.id,
                  minimum < 0
                    ? `${euro(-minimum)} à prévoir avant le ${dateLabel(lowDate)}`
                    : needsReview
                      ? "Échéances échues ou du jour à rapprocher"
                      : "Charges couvertes selon prévision",
                ];
              }),
            )
          )}
          {!compact && (
            <small>
              Point bas par compte, selon les dates des revenus et charges
              attendus. Provisions du foyer non réparties entre comptes ;
              échéances échues non reportées automatiquement. Aucun virement
              exécuté.
            </small>
          )}
        </>
      );
      break;
    }
    case "paidBy": {
      const byAccount = d.accounts
        .map((a) => ({
          name: a.id,
          value: rows
            .filter((t) => t.account === a.id)
            .reduce((n, t) => n - t.amount, 0),
        }))
        .sort((a, b) => b.value - a.value);
      content = (
        <>
          {tiny ? (
            <>
              <strong className="insight-value">
                {euro(byAccount[0]?.value ?? 0)}
              </strong>
              <small>
                {byAccount[0]?.name ?? "Aucun compte"} · compte le plus
                sollicité
              </small>
            </>
          ) : (
            bars(byAccount)
          )}
          {!compact && (
            <small>
              Répartition par compte. Aucun partage entre personnes n’est déduit
              du titulaire.
            </small>
          )}
        </>
      );
      break;
    }
    case "uncategorized": {
      const list = d.rows.filter((t) =>
        /à catégoriser|a categoriser|non class|uncategor|autre|other|^$/i.test(
          t.category.trim(),
        ),
      );
      content = (
        <>
          <strong className="insight-value">{list.length}</strong>
          <p>Opérations à catégoriser sur cette période</p>
          {size !== "tiny" &&
            bars(
              list.map((t) => ({
                name: (t.merchant || t.label) + " · " + t.date,
                value: t.amount,
              })),
            )}
          <button
            className="text-button"
            onClick={() => transactions({ review: "uncategorized" })}
          >
            Ouvrir les transactions
          </button>
        </>
      );
      break;
    }
    case "recurring": {
      const rec = detectRecurrences(s.transactions).filter(
        (r) => !account || r.account === account,
      );
      content = (
        <>
          {rec.length ? (
            bars(
              rec.map((r) => ({
                name: r.name + " · " + r.account,
                value: r.amount,
                detail: `${r.frequency === "monthly" ? "Mensuel" : "Hebdomadaire"} · ${r.count} occurrences · signal ${r.confidence}/100${s.preferences.dismissedRecurrences?.includes(r.key) ? " · ignoré" : ""}`,
              })),
            )
          ) : (
            <p>
              Pas encore de cadence assez régulière : trois occurrences minimum
              sont nécessaires.
            </p>
          )}
          <a
            className="text-button"
            href="#recurrents"
            onClick={(event) => {
              if (navigate) {
                event.preventDefault();
                navigate("recurrents");
              }
            }}
          >
            Vérifier les récurrences
          </a>
        </>
      );
      break;
    }
    case "categories": {
      const list = [...d.categories]
        .map(([name, value]) => ({
          name,
          value,
          detail: d.spending
            ? Math.round((value / d.spending) * 100) + " % des dépenses"
            : "",
        }))
        .sort((a, b) => b.value - a.value);
      content = bars(list);
      break;
    }
    case "pace": {
      const days = Math.max(
          0,
          Math.round(
            (Date.parse(d.cutoff) - Date.parse(d.period.from)) / 86400000,
          ) + 1,
        ),
        avg = days ? Math.round(d.spending / days) : null;
      content = (
        <>
          <strong className="insight-value">
            {avg === null ? "Pas encore observé" : `${euro(avg)} / jour`}
          </strong>
          {!tiny &&
            stats([
              ["Jours écoulés dans la période", days + " jours"],
              ["Dépenses", euro(d.spending)],
              [
                "Allocation hebdomadaire",
                account
                  ? "Voir le plan de ce compte"
                  : sum(s.preferences.weekly),
              ],
            ])}
          <small>
            {tiny
              ? `${days} jours écoulés · couverture à vérifier`
              : "Moyenne des opérations réalisées sur les jours écoulés. La couverture des relevés reste à vérifier ; pas une prévision."}
          </small>
        </>
      );
      break;
    }
    case "unusual": {
      const review = unusualExpenses(
        s,
        account,
        from,
        month,
        d.cutoff,
        d.period,
      );
      const anomalies = review.rows;
      content = (
        <>
          {anomalies.length ? (
            tiny ? (
              <>
                <strong className="insight-value">
                  {euro(-anomalies[0].amount)}
                </strong>
                <small>{anomalies[0].merchant || anomalies[0].label}</small>
              </>
            ) : (
              bars(
                anomalies.map((t) => ({
                  name: (t.merchant || t.label) + " · " + t.date,
                  value: -t.amount,
                  detail:
                    "Plus de 50 % de la moyenne par mois budgétaire de cette catégorie et plus de 100 €",
                })),
              )
            )
          ) : (
            <p>
              {review.history.months.length
                ? "Pas de dépense dépassant le seuil dans les catégories comparables."
                : "Historique antérieur insuffisant pour comparer cette période."}
            </p>
          )}
          {review.unassessedCount > 0 && (
            <small>
              {review.unassessedCount} opération(s) sans référence comparable
              dans ce périmètre.
            </small>
          )}
          {!compact && review.history.months.length > 0 && (
            <small>
              Référence : "mois budgétaires précédents"{" "}
              {review.history.months.join(", ")} · {account || "tout le foyer"}{" "}
              · couverture des relevés à vérifier. Ce seuil descriptif n’est pas
              une détection de fraude.
            </small>
          )}
          <button
            className="text-button"
            onClick={() =>
              transactions({ transactionIds: anomalies.map((t) => t.id) })
            }
          >
            Examiner les opérations
          </button>
        </>
      );
      break;
    }
    case "comparison": {
      const comparison = cycleComparison(s, account, d.period, d.cutoff);
      const unit = "Mois budgétaire";
      content = (
        <>
          {bars(
            comparison.map((period) => ({
              name: period.key,
              value: period.value,
              detail: period.future
                ? `${unit} futur — aucun réalisé à cette date`
                : `${dateLabel(period.from)} — ${dateLabel(period.to)} · ${
                    period.partial
                      ? period.current &&
                        today() >= period.cycle.from &&
                        today() <= period.cycle.to
                        ? `${unit} en cours — partiel au ${dateLabel(period.to)}`
                        : `${unit} partiel — sélection limitée`
                      : `${unit} passé — couverture des relevés à vérifier`
                  }`,
            })),
          )}
          <small>
            Totaux des opérations importées, sans extrapolation. Une période
            partielle n’est pas directement comparable à un cycle complet ; les
            jours sans opérations ne prouvent pas la couverture du relevé.
          </small>
        </>
      );
      break;
    }
    case "configuration": {
      const board = s.preferences.board;
      const current = board?.views.find((v) => v.id === board.activeView);
      const instances = current?.instances.filter((i) =>
        isActiveWidget(i.type),
      );
      content = (
        <>
          <strong className="insight-value">
            {instances?.length ??
              s.preferences.widgets.filter(isActiveWidget).length}
          </strong>
          <p>Cartes enregistrées · {current?.name ?? "Mon dashboard"}</p>
          {!compact &&
            stats([
              ["Dispositions", String(board?.views.length ?? 1)],
              [
                "Sources personnalisées",
                String(
                  instances?.filter((i) => i.source.kind !== "global").length ??
                    0,
                ),
              ],
            ])}
          <button className="button yellow" onClick={configure}>
            Organiser cette disposition
          </button>
        </>
      );
      break;
    }
    case "library": {
      const board = s.preferences.board;
      const instances = board?.views.find(
        (v) => v.id === board.activeView,
      )?.instances;
      const installed = new Set(
        (instances?.map((i) => i.type) ?? s.preferences.widgets).filter(
          isActiveWidget,
        ),
      );
      const suggestions = (
        ["weekly", "purchase", "accounts", "unusual", "funding"] as WidgetId[]
      ).filter((id) => !installed.has(id));
      content = (
        <>
          <strong className="insight-value">
            {activeWidgetIds.length - installed.size}
          </strong>
          <p>Familles encore disponibles</p>
          <ul>
            {suggestions.slice(0, size === "medium" ? 3 : 6).map((id) => (
              <li key={id}>{widgetNames[id]}</li>
            ))}
          </ul>
          <button className="button yellow" onClick={configure}>
            Explorer les composants
          </button>
        </>
      );
      break;
    }
    default:
      content = <Notice>Choisissez un bloc dans la bibliothèque.</Notice>;
  }
  return (
    <section
      className={`card insight-card insight-${id} insight-density-${size}`}
    >
      <div className="card-heading">
        <h2>
          {id === "balance" && account ? "Solde du compte" : widgetNames[id]}
        </h2>
      </div>
      {content}
    </section>
  );
}
